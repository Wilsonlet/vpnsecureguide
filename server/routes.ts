import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { db } from "./db";
import { insertVpnSessionSchema, insertVpnUserSettingsSchema, subscriptionTiers, subscriptionPlans } from "@shared/schema";
import { z } from "zod";
import { eq } from "drizzle-orm";
import Stripe from "stripe";

// Initialize Stripe if the secret key is available
let stripe: Stripe | undefined;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16" as any, // Type assertion to bypass version check
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // VPN Server endpoints
  app.get("/api/servers", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const servers = await storage.getAllServers();
      res.json(servers);
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

  app.post("/api/sessions/start", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // End any existing session first
      await storage.endCurrentSession(req.user.id);
      
      // Validate request body
      const parsedData = insertVpnSessionSchema.parse({
        ...req.body,
        userId: req.user.id
      });
      
      // Create a new session
      const session = await storage.createSession(parsedData);
      
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
      
      const session = await storage.endCurrentSession(req.user.id);
      if (!session) {
        // Return success even if there was no session to end
        return res.status(200).json({ success: true, message: "No active session to end" });
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
        success: true
      });
    } catch (error) {
      console.error("Error ending session:", error);
      next(error);
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

  const httpServer = createServer(app);
  return httpServer;
}
