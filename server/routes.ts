import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import { insertVpnSessionSchema, insertVpnUserSettingsSchema, insertAppSettingSchema, subscriptionTiers, subscriptionPlans, vpnSessions, VpnServer } from "@shared/schema";
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import Stripe from "stripe";
import { vpnLoadBalancer, connectionRateLimiter, connectionStatistics } from "./scaling";
import { verifyFirebaseToken } from "./firebase-auth";

// Initialize Stripe if the secret key is available
let stripe: Stripe | undefined;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16" as any, // Type assertion to bypass version check
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Enable development mode bypassing of rate limits for testing
  process.env.DEBUG_BYPASS_RATELIMIT = 'true';
  // Set up authentication routes
  setupAuth(app);
  
  // Add Firebase token verification middleware
  // This will run before each request and check for Firebase tokens
  // If valid, it will set req.user based on Firebase auth
  // If not, it will proceed to the next middleware (passport session auth)
  app.use(verifyFirebaseToken);

  // VPN Server endpoints
  app.get("/api/servers", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const { region, obfuscated, doubleHop } = req.query;
      
      let servers;
      if (region || obfuscated || doubleHop) {
        // Use the new filtered server query
        const filters = {
          region: region as string | undefined,
          obfuscated: obfuscated === 'true',
          doubleHop: doubleHop === 'true'
        };
        servers = await storage.getFilteredServers(filters);
      } else {
        // Use the existing method if no filters are specified
        servers = await storage.getAllServers();
      }
      
      res.json(servers);
    } catch (error) {
      next(error);
    }
  });
  
  // Get servers by region endpoint
  app.get("/api/servers/regions", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // Get all servers
      const servers = await storage.getAllServers();
      
      // Group servers by region
      const serversByRegion = servers.reduce((acc, server) => {
        if (!acc[server.region]) {
          acc[server.region] = [];
        }
        acc[server.region].push(server);
        return acc;
      }, {} as Record<string, VpnServer[]>);
      
      // Format the response in a more structured way
      const result = Object.entries(serversByRegion).map(([region, servers]) => ({
        region,
        count: servers.length,
        servers
      }));
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // VPN Settings endpoints
  app.get("/api/settings", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      let settings = await storage.getUserSettings(req.user.id);
      
      // If settings don't exist, create default ones
      if (!settings) {
        const defaultSettings = {
          userId: req.user.id,
          killSwitch: true,
          dnsLeakProtection: true,
          doubleVpn: false,
          obfuscation: false,
          preferredProtocol: "openvpn_tcp",
          preferredEncryption: "aes_256_gcm"
        };
        
        settings = await storage.createUserSettings(defaultSettings);
        console.log("Created default settings for user:", req.user.id);
      }
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      next(error);
    }
  });

  app.post("/api/settings", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const parsedData = insertVpnUserSettingsSchema.parse({
        ...req.body,
        userId: req.user.id
      });
      
      const settings = await storage.updateUserSettings(parsedData);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  // VPN Session endpoints
  app.get("/api/sessions", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const sessions = await storage.getUserSessions(req.user.id);
      res.json(sessions);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/sessions/current", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const session = await storage.getCurrentSession(req.user.id);
      if (!session) {
        // Instead of 404, return null with 200 status for easier client handling
        return res.status(200).json(null);
      }
      
      // Generate a virtual IP for the session (consistent for the same session ID)
      const octet1 = 10; // Use private IP range
      const octet2 = Math.floor((session.id * 13) % 255);
      const octet3 = Math.floor((session.id * 17) % 255);
      const octet4 = Math.floor((session.id * 23) % 255);
      const virtualIp = `${octet1}.${octet2}.${octet3}.${octet4}`;
      
      res.json({
        ...session,
        virtualIp
      });
    } catch (error) {
      console.error("Error fetching current session:", error);
      next(error);
    }
  });

  // Use the new connection rate limiter for scalable rate limiting
  // The cleanup is now handled internally by the ConnectionRateLimiter class
  
  app.post("/api/sessions/start", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const userId = req.user.id;
      const userSubscription = req.user.subscription || 'free';
      
      // Use the enhanced rate limiter that handles different subscription tiers
      const rateCheck = connectionRateLimiter.canConnect(userId, userSubscription);
      
      if (!rateCheck.allowed) {
        const message = rateCheck.reason === "RECENT_DISCONNECT"
          ? "You've just disconnected. Please wait a moment before reconnecting."
          : "Too many connection attempts. Please slow down and try again in a few seconds.";
          
        console.log(`Rate limiting connection for user ${userId}: ${rateCheck.reason}`);
        return res.status(429).json({ 
          message,
          reason: rateCheck.reason,
          rateLimited: true 
        });
      }
      
      // End any existing session first
      await storage.endCurrentSession(userId);
      
      // Make sure we don't have other active sessions using Drizzle ORM
      try {
        await db.update(vpnSessions)
          .set({ endTime: new Date() })
          .where(
            and(
              eq(vpnSessions.userId, userId),
              isNull(vpnSessions.endTime)
            )
          );
        console.log("Ended all active sessions before creating a new one");
      } catch (sqlErr) {
        console.error("Error ending active sessions with ORM:", sqlErr);
      }
      
      // Validate request body
      const parsedData = insertVpnSessionSchema.parse({
        ...req.body,
        userId
      });
      
      // Get server ID from request
      const serverId = parsedData.serverId;
      
      // Create a new session
      const session = await storage.createSession(parsedData);
      
      // Track this connection in the statistics
      connectionStatistics.recordConnection(serverId);
      
      // Clear any disconnect flags
      if (req.session) {
        (req.session as any).vpnDisconnected = false;
      }
      
      // Generate a virtual IP for the session
      const octet1 = 10; // Use private IP range
      const octet2 = Math.floor((session.id * 13) % 255);
      const octet3 = Math.floor((session.id * 17) % 255);
      const octet4 = Math.floor((session.id * 23) % 255);
      const virtualIp = `${octet1}.${octet2}.${octet3}.${octet4}`;
      
      res.status(201).json({
        ...session,
        virtualIp
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sessions/end", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const userId = req.user.id;
      
      // Get current session before ending it to retrieve server ID
      const currentSession = await storage.getCurrentSession(userId);
      
      // Call the storage endCurrentSession to properly end any active session
      const session = await storage.endCurrentSession(userId);
      
      // Record disconnection in our scaling rate limiter
      connectionRateLimiter.recordDisconnect(userId);
      
      // Record disconnection in statistics if we had an active session
      if (currentSession?.serverId) {
        connectionStatistics.recordDisconnection(currentSession.serverId);
      }
      
      // End all active VPN sessions for this user with a SQL query
      try {
        const endTime = new Date();
        
        await db.update(vpnSessions)
          .set({ endTime })
          .where(
            and(
              eq(vpnSessions.userId, userId),
              isNull(vpnSessions.endTime)
            )
          );
        
        console.log(`Force ended all VPN sessions for user ${userId}`);
      } catch (sqlError) {
        console.error("SQL error ending sessions:", sqlError);
        // Continue anyway since we'll return success
      }
      
      // Return success even if there was no specific session information
      if (!session) {
        return res.status(200).json({ 
          success: true, 
          message: "VPN disconnected. All sessions closed.",
          disconnected: true
        });
      }
      
      // Add the virtual IP to the response for consistency
      const octet1 = 10;
      const octet2 = Math.floor((session.id * 13) % 255);
      const octet3 = Math.floor((session.id * 17) % 255);
      const octet4 = Math.floor((session.id * 23) % 255);
      const virtualIp = `${octet1}.${octet2}.${octet3}.${octet4}`;
      
      res.json({
        ...session,
        virtualIp,
        success: true,
        disconnected: true
      });
    } catch (error) {
      console.error("Error ending session:", error);
      // Still return success to ensure client shows as disconnected
      res.status(200).json({ 
        success: true, 
        message: "VPN disconnect processed with errors.",
        disconnected: true
      });
    }
  });

  // Usage statistics endpoint
  app.get("/api/usage", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const period = z.enum(["7days", "30days", "month"]).safeParse(req.query.period);
      const periodValue = period.success ? period.data : "7days";
      
      const stats = await storage.getUserUsageStats(req.user.id, periodValue);
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // Get usage limits (for checking if user has exceeded their plan limits)
  app.get("/api/limits", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const limits = await storage.checkUserLimits(req.user.id);
      res.json(limits);
    } catch (error) {
      next(error);
    }
  });

  // Subscription plan endpoints
  app.get("/api/subscription-plans", async (req, res, next) => {
    try {
      const plans = await storage.getAllSubscriptionPlans();
      res.json(plans);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/subscription", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({
        subscription: user.subscription,
        expiryDate: user.subscriptionExpiryDate,
        stripeCustomerId: user.stripeCustomerId,
        stripeSubscriptionId: user.stripeSubscriptionId
      });
    } catch (error) {
      next(error);
    }
  });

  // Stripe Payment Endpoints
  app.post("/api/create-payment-intent", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      if (!stripe) {
        return res.status(503).json({ message: "Payment service not available" });
      }
      
      const { amount } = req.body;
      
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: "usd",
        metadata: {
          userId: req.user.id.toString()
        }
      });
      
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Stripe payment intent error:", error);
      res.status(500).json({ message: "Error creating payment intent", error: error.message });
    }
  });

  // Create subscription endpoint
  app.post("/api/create-subscription", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      if (!stripe) {
        return res.status(503).json({ message: "Payment service not available" });
      }

      const { planName } = req.body;
      if (!planName) {
        return res.status(400).json({ message: "Plan name is required" });
      }

      // Get the subscription plan
      const plan = await storage.getSubscriptionPlanByName(planName);
      if (!plan) {
        return res.status(404).json({ message: "Subscription plan not found" });
      }

      const user = req.user;
      
      // If no email, return error
      if (!user.email) {
        return res.status(400).json({ message: "Email is required for subscription" });
      }

      // Create or retrieve Stripe customer
      let customerId = user.stripeCustomerId;
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email,
          name: user.username,
          metadata: {
            userId: user.id.toString()
          }
        });
        
        customerId = customer.id;
        await storage.updateStripeCustomerId(user.id, customerId);
      }
      
      // If there's no Stripe price ID, return error
      if (!plan.stripePriceId) {
        return res.status(400).json({ message: "This plan is not available for subscription" });
      }

      // Create subscription
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: plan.stripePriceId }],
        payment_behavior: "default_incomplete",
        expand: ["latest_invoice.payment_intent"],
      });

      // Update user subscription info
      await storage.updateStripeSubscriptionId(user.id, subscription.id);
      
      // Access expanded fields using type assertions
      // The type definitions might be different than the actual API response
      const invoice = subscription.latest_invoice as any;
      const paymentIntent = invoice?.payment_intent as any;
      
      // Return client secret for the payment intent
      res.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      console.error("Stripe subscription error:", error);
      res.status(500).json({ message: "Error creating subscription", error: error.message });
    }
  });

  // Update subscription endpoint
  app.post("/api/update-subscription", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      if (!stripe) {
        return res.status(503).json({ message: "Payment service not available" });
      }

      const { planName } = req.body;
      if (!planName) {
        return res.status(400).json({ message: "Plan name is required" });
      }

      const user = req.user;
      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ message: "No active subscription found" });
      }

      // Get the subscription plan
      const plan = await storage.getSubscriptionPlanByName(planName);
      if (!plan) {
        return res.status(404).json({ message: "Subscription plan not found" });
      }

      // If there's no Stripe price ID, return error
      if (!plan.stripePriceId) {
        return res.status(400).json({ message: "This plan is not available for subscription" });
      }

      // Retrieve the subscription
      const subscription = await stripe.subscriptions.retrieve(user.stripeSubscriptionId);

      // Update the subscription with the new price
      await stripe.subscriptions.update(subscription.id, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: plan.stripePriceId,
          },
        ],
      });

      // Update user subscription in the database
      await storage.updateUserSubscription(user.id, planName);

      res.json({ 
        success: true,
        message: "Subscription updated",
        subscription: planName
      });
    } catch (error: any) {
      console.error("Update subscription error:", error);
      res.status(500).json({ message: "Error updating subscription", error: error.message });
    }
  });

  // Cancel subscription endpoint
  app.post("/api/cancel-subscription", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      if (!stripe) {
        return res.status(503).json({ message: "Payment service not available" });
      }

      const user = req.user;
      if (!user.stripeSubscriptionId) {
        return res.status(400).json({ message: "No active subscription found" });
      }

      // Cancel the subscription at period end
      await stripe.subscriptions.update(user.stripeSubscriptionId, {
        cancel_at_period_end: true,
      });

      res.json({ 
        success: true,
        message: "Subscription will be canceled at the end of the billing period" 
      });
    } catch (error: any) {
      console.error("Cancel subscription error:", error);
      res.status(500).json({ message: "Error canceling subscription", error: error.message });
    }
  });
  
  // Update to free subscription endpoint (no payment required)
  app.post("/api/update-free-subscription", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const { planName } = req.body;
      if (!planName || planName !== 'free') {
        return res.status(400).json({ message: "Invalid plan name for free subscription" });
      }
      
      const user = req.user;
      
      // If user has a Stripe subscription, cancel it
      if (user.stripeSubscriptionId && stripe) {
        try {
          await stripe.subscriptions.cancel(user.stripeSubscriptionId);
        } catch (stripeError) {
          console.error("Error canceling Stripe subscription:", stripeError);
          // Continue even if Stripe cancellation fails
        }
      }
      
      // Update user's subscription in the database (without expiry date for free tier)
      await storage.updateUserSubscription(user.id, planName);
      
      // Clear Stripe subscription ID if it exists
      if (user.stripeSubscriptionId) {
        await storage.updateStripeSubscriptionId(user.id, "");
      }
      
      res.json({
        success: true,
        message: "Subscription updated to Free plan",
        subscription: planName
      });
    } catch (error: any) {
      console.error("Update free subscription error:", error);
      res.status(500).json({ message: "Error updating subscription", error: error.message });
    }
  });
  
  // App settings endpoints
  app.get("/api/app-settings", async (req, res, next) => {
    try {
      const settings = await storage.getAllAppSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/app-settings/:key", async (req, res, next) => {
    try {
      const key = req.params.key;
      const setting = await storage.getAppSetting(key);
      
      if (!setting) {
        return res.status(404).json({ message: "Setting not found" });
      }
      
      res.json(setting);
    } catch (error) {
      next(error);
    }
  });

  // Admin endpoints
  // Admin endpoint to update app settings
  app.post("/api/admin/app-settings", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // In a real app, check for admin role
      // For demo purposes, consider user with ID 1 as admin
      if (req.user.id !== 1) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { key, value, description } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ message: "Key and value are required" });
      }
      
      const setting = await storage.setAppSetting(key, value, description);
      res.json(setting);
    } catch (error) {
      next(error);
    }
  });
  
  // Admin endpoint to get all servers including disabled ones
  app.get("/api/admin/servers", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // In a real app, check for admin role
      // For demo purposes, consider user with ID 1 as admin
      if (req.user.id !== 1) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // In real app, you'd have proper admin-only access to all servers
      // including servers that might be disabled for regular users
      const servers = await storage.getAllServers();
      res.json(servers);
    } catch (error) {
      next(error);
    }
  });
  
  // Admin endpoint to get global monitoring data
  app.get("/api/admin/monitoring", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // In a real app, check for admin role
      // For demo purposes, consider user with ID 1 as admin
      if (req.user.id !== 1) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get comprehensive monitoring data
      const globalStats = connectionStatistics.getGlobalStats();
      const rateMetrics = connectionRateLimiter.getGlobalErrorMetrics();
      
      res.json({
        timestamp: new Date().toISOString(),
        connectionStats: globalStats,
        rateMetrics,
        // Include server health data
        servers: await Promise.all(
          (await storage.getAllServers()).map(async server => {
            return {
              ...server,
              stats: connectionStatistics.getServerStats(server.id)
            };
          })
        )
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Admin endpoint to get error logs
  app.get("/api/admin/error-logs", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // In a real app, check for admin role
      // For demo purposes, consider user with ID 1 as admin
      if (req.user.id !== 1) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Get hours parameter with default of 24 hours
      const hours = parseInt(req.query.hours as string) || 24;
      
      // Get error logs for specified time period
      const logs = connectionStatistics.getRecentErrorLogs(hours);
      
      res.json({
        timestamp: new Date().toISOString(),
        period: `${hours} hours`,
        totalErrors: logs.length,
        logs
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Admin endpoint to configure monitoring alerts
  app.post("/api/admin/configure-alerts", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // In a real app, check for admin role
      // For demo purposes, consider user with ID 1 as admin
      if (req.user.id !== 1) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { webhookUrl, slackWebhook } = req.body;
      
      // Store webhook URLs for alerts
      if (webhookUrl) {
        connectionStatistics.addAlertWebhook(webhookUrl);
      }
      
      // For Slack integration 
      if (slackWebhook && process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID) {
        // In a real implementation, this would store the Slack webhook configuration
        // and use it to send alerts
        await storage.setAppSetting('monitoring_slack_webhook', slackWebhook);
        
        connectionStatistics.addAlertWebhook('slack://internal'); // Special internal protocol
        
        res.json({
          success: true,
          message: "Alert configuration updated successfully",
          slackIntegration: true,
          webhooks: [webhookUrl, 'slack://internal'].filter(Boolean)
        });
      } else {
        res.json({
          success: true,
          message: "Alert configuration updated successfully",
          slackIntegration: false,
          webhooks: [webhookUrl].filter(Boolean)
        });
      }
    } catch (error) {
      next(error);
    }
  });

  // Admin endpoint to update Stripe price IDs
  app.post("/api/admin/update-price-ids", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // In a real app, check for admin role
      // For demo purposes, consider user with ID 1 as admin
      if (req.user.id !== 1) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { stripePriceIds } = req.body;
      if (!stripePriceIds || typeof stripePriceIds !== 'object') {
        return res.status(400).json({ message: "Invalid price IDs data" });
      }
      
      // Update each plan's price ID
      for (const [planId, priceId] of Object.entries(stripePriceIds)) {
        if (typeof priceId === 'string') {
          // Skip updating free plan's price ID if it's empty
          const plan = await storage.getSubscriptionPlan(parseInt(planId));
          if (plan && plan.price === 0 && !priceId) {
            continue;
          }
          
          // Update the price ID in the database
          await db
            .update(subscriptionPlans)
            .set({ stripePriceId: priceId })
            .where(eq(subscriptionPlans.id, parseInt(planId)));
        }
      }
      
      res.json({
        success: true,
        message: "Price IDs updated successfully"
      });
    } catch (error: any) {
      console.error("Update price IDs error:", error);
      res.status(500).json({ message: "Error updating price IDs", error: error.message });
    }
  });
  
  // Admin endpoint to update Paystack plan codes
  app.post("/api/admin/update-paystack-plan-codes", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // In a real app, check for admin role
      // For demo purposes, consider user with ID 1 as admin
      if (req.user.id !== 1) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { paystackPlanCodes } = req.body;
      if (!paystackPlanCodes || typeof paystackPlanCodes !== 'object') {
        return res.status(400).json({ message: "Invalid Paystack plan codes data" });
      }
      
      // Update each plan's Paystack plan code
      for (const [planId, planCode] of Object.entries(paystackPlanCodes)) {
        if (typeof planCode === 'string') {
          // Skip updating free plan's code if it's empty
          const plan = await storage.getSubscriptionPlan(parseInt(planId));
          if (plan && plan.price === 0 && !planCode) {
            continue;
          }
          
          // Update the Paystack plan code in the database
          await db
            .update(subscriptionPlans)
            .set({ paystackPlanCode: planCode })
            .where(eq(subscriptionPlans.id, parseInt(planId)));
        }
      }
      
      res.json({
        success: true,
        message: "Paystack plan codes updated successfully"
      });
    } catch (error: any) {
      console.error("Update Paystack plan codes error:", error);
      res.status(500).json({ message: "Error updating Paystack plan codes", error: error.message });
    }
  });

  // Admin routes for user management
  app.get("/api/admin/users", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // Check if user is admin (for demo, user with ID 1 is admin)
      if (req.user.id !== 1) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      // Get all users from storage
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error: any) {
      console.error("Admin get users error:", error);
      res.status(500).json({ message: "Error retrieving users", error: error.message });
    }
  });

  app.post("/api/admin/update-user-subscription", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // Check if user is admin (for demo, user with ID 1 is admin)
      if (req.user.id !== 1) {
        return res.status(403).json({ message: "Not authorized" });
      }
      
      const { userId, subscription, expiryDate } = req.body;
      
      if (!userId || !subscription) {
        return res.status(400).json({ message: "User ID and subscription are required" });
      }
      
      // Update user subscription
      const updatedUser = await storage.updateUserSubscription(
        parseInt(userId), 
        subscription, 
        expiryDate ? new Date(expiryDate) : undefined
      );
      
      res.json({
        success: true,
        message: "User subscription updated successfully",
        user: updatedUser
      });
    } catch (error: any) {
      console.error("Admin update user subscription error:", error);
      res.status(500).json({ message: "Error updating user subscription", error: error.message });
    }
  });

  // App Settings endpoints - these are already defined above
  // The duplicate routes have been removed to fix the app startup issue

  const httpServer = createServer(app);
  return httpServer;
}
