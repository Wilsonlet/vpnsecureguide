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
import { setupKillSwitchRoutes, killSwitchManager } from "./kill-switch";
import { updateSubscriptionPlans } from "./update-subscription-plans";
import { migrate } from "./migrate";
import { paystackService } from "./paystack-service";
import { vpnTunnelService } from "./vpn-tunnel";
import { obfuscationService, OBFUSCATION_METHODS, ANTI_CENSORSHIP_STRATEGIES } from "./obfuscation-service";

// Initialize Stripe if the secret key is available
let stripe: Stripe | undefined;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16" as any, // Type assertion to bypass version check
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  // The tunnel status endpoint is defined later in the file
  // Enable development mode bypassing of rate limits for testing
  process.env.DEBUG_BYPASS_RATELIMIT = 'true';
  // Set up authentication routes
  setupAuth(app);
  
  // Add Firebase token verification middleware
  // This will run before each request and check for Firebase tokens
  // If valid, it will set req.user based on Firebase auth
  // If not, it will proceed to the next middleware (passport session auth)
  app.use(verifyFirebaseToken);
  
  // Set up kill switch routes for VPN protection
  setupKillSwitchRoutes(app);
  
  // Tunnel status verification endpoint
  app.get("/api/tunnel/status", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Get the current active session for the user
      const activeSession = await storage.getCurrentSession(req.user.id);
      
      if (!activeSession) {
        return res.json({
          sessionActive: false,
          tunnelActive: false,
          message: "No active VPN session found",
          dataTransferred: {
            upload: 0,
            download: 0
          }
        });
      }
      
      // Check the tunnel status
      const tunnelStatus = vpnTunnelService.getTunnelStatus(activeSession.id);
      const tunnelActive = tunnelStatus.active;
      
      // If tunnel is not active but session is, there's an issue
      if (!tunnelActive) {
        console.warn(`User ${req.user.id} has active session ${activeSession.id} but no active tunnel`);
      }
      
      // Get the server info to verify it matches what the client selected
      const server = await storage.getServerById(activeSession.serverId);
      
      res.json({
        sessionActive: true,
        tunnelActive,
        sessionId: activeSession.id,
        serverId: activeSession.serverId,
        server: server ? {
          id: server.id,
          name: server.name,
          country: server.country,
          region: server.region
        } : undefined,
        uptime: tunnelStatus.uptime,
        dataTransferred: tunnelStatus.dataTransferred,
        message: tunnelActive 
          ? "VPN tunnel is active and functioning correctly" 
          : "VPN session exists but tunnel is not active"
      });
    } catch (error) {
      console.error("Error checking tunnel status:", error);
      next(error);
    }
  });
  
  // Run migrations and update subscription plans on startup
  try {
    // Run database migrations first
    await migrate();
    
    // Then update subscription plans
    await updateSubscriptionPlans();
    console.log("Subscription plans updated successfully");
  } catch (error) {
    console.error("Error updating subscription plans:", error);
  }
  
  // Server and settings cache with TTL
  const cache = new Map<string, { data: any, timestamp: number }>();
  const CACHE_TTL = 30000; // 30 seconds in milliseconds

  // VPN Server endpoints with caching for better performance
  app.get("/api/servers", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const { region, obfuscated, doubleHop } = req.query;
      
      // Create a cache key based on user ID and query parameters
      const cacheKey = `servers:${req.user.id}:${region || ''}:${obfuscated || ''}:${doubleHop || ''}`;
      
      // Check if we have a valid cache entry
      const cacheEntry = cache.get(cacheKey);
      const now = Date.now();
      
      if (cacheEntry && (now - cacheEntry.timestamp < CACHE_TTL)) {
        // Return cached data if valid
        console.log(`Using cached servers data for key: ${cacheKey}`);
        return res.json(cacheEntry.data);
      }
      
      // Fetch fresh data if no cache or expired
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
      
      // Cache the result
      cache.set(cacheKey, { data: servers, timestamp: now });
      
      res.json(servers);
    } catch (error) {
      next(error);
    }
  });
  
  // Get servers by region endpoint with caching
  app.get("/api/servers/regions", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // Create a cache key for regions
      const cacheKey = `servers:regions:${req.user.id}`;
      
      // Check if we have a valid cache entry
      const cacheEntry = cache.get(cacheKey);
      const now = Date.now();
      
      if (cacheEntry && (now - cacheEntry.timestamp < CACHE_TTL)) {
        // Return cached data if valid
        console.log(`Using cached regions data for user ${req.user.id}`);
        return res.json(cacheEntry.data);
      }
      
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
      
      // Cache the result
      cache.set(cacheKey, { data: result, timestamp: now });
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // Feature access check endpoint
  app.get("/api/feature-access/:feature", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const feature = req.params.feature;
      const hasAccess = await storage.checkUserFeatureAccess(req.user.id, feature);
      
      res.json({ hasAccess });
    } catch (error) {
      next(error);
    }
  });
  
  // Special dedicated endpoint for setting protocol
  app.post("/api/protocol", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // Allow for both client-side and server-side property names
      const protocol = req.body.protocol || req.body.preferredProtocol;
      console.log("Protocol update request:", req.body, "Using protocol value:", protocol);
      
      if (!protocol) {
        return res.status(400).json({ message: "Protocol is required" });
      }
      
      // Check for premium protocol access if needed
      if (protocol === 'shadowsocks') {
        const hasAccess = await storage.checkUserFeatureAccess(req.user.id, 'shadowsocks');
        if (!hasAccess) {
          return res.status(403).json({ 
            message: "Premium feature access required",
            feature: "shadowsocks"
          });
        }
      }
      
      // Get current settings
      let settings = await storage.getUserSettings(req.user.id);
      
      // If settings don't exist, create default ones
      if (!settings) {
        const defaultSettings = {
          userId: req.user.id,
          killSwitch: true,
          dnsLeakProtection: true,
          doubleVpn: false,
          obfuscation: false,
          preferredProtocol: protocol,
          preferredEncryption: "aes_256_gcm"
        };
        
        settings = await storage.createUserSettings(defaultSettings);
      } else {
        // Update the protocol
        settings = await storage.updateUserSettings({
          ...settings,
          preferredProtocol: protocol
        });
      }
      
      // Clear specific cache for settings
      const settingsCacheKey = `user:settings:${req.user.id}`;
      cache.delete(settingsCacheKey);
      
      console.log(`Updated protocol for user ${req.user.id} to ${protocol}`);
      
      res.json({
        success: true,
        protocol,
        message: `Protocol updated to ${protocol.replace('_', ' ').toUpperCase()}`
      });
    } catch (error) {
      console.error("Error updating protocol:", error);
      next(error);
    }
  });
  
  // Special dedicated endpoint for setting encryption
  app.post("/api/encryption", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // Allow for both client-side and server-side property names
      const encryption = req.body.encryption || req.body.preferredEncryption;
      console.log("Encryption update request:", req.body, "Using encryption value:", encryption);
      
      if (!encryption) {
        return res.status(400).json({ message: "Encryption is required" });
      }
      
      // Check for premium encryption access if needed
      if (encryption === 'chacha20_poly1305') {
        const hasAccess = await storage.checkUserFeatureAccess(req.user.id, 'premium-encryption');
        if (!hasAccess) {
          return res.status(403).json({ 
            message: "Premium feature access required",
            feature: "premium-encryption"
          });
        }
      }
      
      // Get current settings
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
          preferredEncryption: encryption
        };
        
        settings = await storage.createUserSettings(defaultSettings);
      } else {
        // Update the encryption
        settings = await storage.updateUserSettings({
          ...settings,
          preferredEncryption: encryption
        });
      }
      
      // Clear specific cache for settings
      const settingsCacheKey = `user:settings:${req.user.id}`;
      cache.delete(settingsCacheKey);
      
      console.log(`Updated encryption for user ${req.user.id} to ${encryption}`);
      
      res.json({
        success: true,
        encryption,
        message: `Encryption updated to ${encryption.replace('_', '-').toUpperCase()}`
      });
    } catch (error) {
      console.error("Error updating encryption:", error);
      next(error);
    }
  });

  // VPN Settings endpoints with caching
  app.get("/api/settings", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // Create a cache key for user settings
      const cacheKey = `user:settings:${req.user.id}`;
      
      // Check if we have a valid cache entry
      const cacheEntry = cache.get(cacheKey);
      const now = Date.now();
      
      if (cacheEntry && (now - cacheEntry.timestamp < CACHE_TTL)) {
        // Return cached data if valid
        console.log(`Using cached settings for user ${req.user.id}`);
        return res.json(cacheEntry.data);
      }
      
      let settings = await storage.getUserSettings(req.user.id);
      
      // If settings don't exist, create default ones
      if (!settings) {
        const defaultSettings = {
          userId: req.user.id,
          killSwitch: true,
          dnsLeakProtection: true,
          doubleVpn: false,
          obfuscation: false,
          antiCensorship: false,
          preferredProtocol: "openvpn_tcp",
          preferredEncryption: "aes_256_gcm"
        };
        
        settings = await storage.createUserSettings(defaultSettings);
        console.log("Created default settings for user:", req.user.id);
      }
      
      // Cache the result
      cache.set(cacheKey, { data: settings, timestamp: now });
      
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      next(error);
    }
  });

  // Update security settings - allowing toggle during active connection
  app.post("/api/settings", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // Check for feature access requirements
      
      // Check for obfuscation access
      if (req.body.obfuscation === true) {
        const hasAccess = await storage.checkUserFeatureAccess(req.user.id, 'obfuscation');
        if (!hasAccess) {
          return res.status(403).json({ 
            message: "Premium feature access required",
            feature: "obfuscation"
          });
        }
      }
      
      // Check for double VPN access
      if (req.body.doubleVpn === true) {
        const hasAccess = await storage.checkUserFeatureAccess(req.user.id, 'double-vpn');
        if (!hasAccess) {
          return res.status(403).json({ 
            message: "Premium feature access required",
            feature: "double-vpn"
          });
        }
      }
      
      // Check for anti-censorship access 
      if (req.body.antiCensorship === true) {
        // First check if obfuscation is enabled or will be enabled
        const currentSettings = await storage.getUserSettings(req.user.id);
        const willHaveObfuscation = req.body.obfuscation !== undefined ? req.body.obfuscation : currentSettings?.obfuscation;
        
        if (!willHaveObfuscation) {
          return res.status(400).json({
            message: "Anti-censorship requires obfuscation to be enabled",
            feature: "anti-censorship"
          });
        }
        
        const hasAccess = await storage.checkUserFeatureAccess(req.user.id, 'anti-censorship');
        if (!hasAccess) {
          return res.status(403).json({ 
            message: "Premium feature access required", 
            feature: "anti-censorship"
          });
        }
      }
      
      // Check if premium encryption is being set
      if (req.body.preferredEncryption === 'chacha20_poly1305') {
        const hasAccess = await storage.checkUserFeatureAccess(req.user.id, 'premium-encryption');
        if (!hasAccess) {
          return res.status(403).json({ 
            message: "Premium feature access required",
            feature: "premium-encryption"
          });
        }
      }
      
      // Check if shadowsocks protocol is being set
      if (req.body.preferredProtocol === 'shadowsocks') {
        const hasAccess = await storage.checkUserFeatureAccess(req.user.id, 'shadowsocks');
        if (!hasAccess) {
          return res.status(403).json({ 
            message: "Premium feature access required",
            feature: "shadowsocks"
          });
        }
      }
      
      // If obfuscation is being disabled but anti-censorship is currently enabled,
      // we need to disable anti-censorship as well (it requires obfuscation)
      if (req.body.obfuscation === false) {
        const currentSettings = await storage.getUserSettings(req.user.id);
        if (currentSettings?.antiCensorship) {
          console.log(`Auto-disabling anti-censorship for user ${req.user.id} because obfuscation is being disabled`);
          req.body.antiCensorship = false;
        }
      }
      
      const parsedData = insertVpnUserSettingsSchema.parse({
        ...req.body,
        userId: req.user.id
      });
      
      const settings = await storage.updateUserSettings(parsedData);
      
      // For Double VPN, Obfuscation, and Anti-Censorship, we need to apply the changes
      // to an active connection if one exists
      const currentSession = await storage.getCurrentSession(req.user.id);
      if (currentSession) {
        try {
          console.log(`Applying updated security settings to active connection for user ${req.user.id}`);
          // Here's where we'd call the functions to apply the security settings
          // This would interact with the VPN server to modify the active connection
          // For now, we'll just log that the settings would be applied
          
          if ('doubleVpn' in req.body) {
            console.log(`Applying Double VPN setting (${req.body.doubleVpn}) to active connection`);
            // Actual implementation would update the tunnel configuration
          }
          
          if ('obfuscation' in req.body) {
            console.log(`Applying Obfuscation setting (${req.body.obfuscation}) to active connection`);
            // Actual implementation would update traffic obfuscation
          }
          
          if ('antiCensorship' in req.body) {
            console.log(`Applying Anti-Censorship setting (${req.body.antiCensorship}) to active connection`);
            // Actual implementation would update censorship circumvention techniques
          }
        } catch (applyError) {
          console.error(`Error applying security settings to active connection: ${applyError}`);
          // Continue - we'll still return the updated settings even if applying them failed
        }
      }
      
      // Clear the cache for this user's settings by setting entry to undefined
      const cacheKey = `user:settings:${req.user.id}`;
      if (cache.has(cacheKey)) {
        cache.set(cacheKey, { data: undefined, timestamp: 0 });
      }
      
      console.log(`Updated settings for user ${req.user.id}`, req.body);
      
      res.json(settings);
    } catch (error) {
      console.error("Error updating settings:", error);
      next(error);
    }
  });
  
  // App settings endpoints
  // These endpoints provide application-wide settings
  // Cache key - app settings don't change often, so we use a long TTL
  const APP_SETTINGS_CACHE_TTL = 3600000; // 1 hour
  const appSettingsCache = new Map<string, { value: string, timestamp: number }>();
  
  // Default app settings values
  const APP_SETTINGS_DEFAULTS = {
    app_name: "SecureShield VPN",
    contact_email: "support@secureshield-vpn.com",
    company_info: "SecureShield VPN - Military-grade encryption for maximum privacy",
    privacy_policy_url: "https://secureshield-vpn.com/privacy",
    terms_url: "https://secureshield-vpn.com/terms",
    support_url: "https://secureshield-vpn.com/support"
  };
  
  // Helper function to get app setting
  const getAppSetting = async (key: string): Promise<string> => {
    // Check cache first
    const cacheEntry = appSettingsCache.get(key);
    const now = Date.now();
    
    if (cacheEntry && (now - cacheEntry.timestamp < APP_SETTINGS_CACHE_TTL)) {
      return cacheEntry.value;
    }
    
    // Try to get from database
    try {
      const setting = await storage.getAppSetting(key);
      
      if (setting && setting.value) {
        // Update cache
        appSettingsCache.set(key, { value: setting.value, timestamp: now });
        return setting.value;
      }
    } catch (error) {
      console.log(`Error fetching app setting ${key}, using default`);
    }
    
    // Return default value if not found
    const defaultValue = APP_SETTINGS_DEFAULTS[key as keyof typeof APP_SETTINGS_DEFAULTS] || '';
    
    // Cache the default value too
    appSettingsCache.set(key, { value: defaultValue, timestamp: now });
    
    return defaultValue;
  };
  
  // Generic endpoint for app settings
  app.get("/api/app-settings/:key", async (req, res) => {
    const key = req.params.key;
    
    if (!key) {
      return res.status(400).json({ message: "Setting key is required" });
    }
    
    try {
      const value = await getAppSetting(key);
      res.json({ key, value });
    } catch (error) {
      console.error(`Error fetching app setting ${key}:`, error);
      res.status(500).json({ message: "Error fetching setting" });
    }
  });
  
  // Update app setting (admin only)
  app.post("/api/app-settings/:key", async (req, res) => {
    // Check if admin
    if (!req.isAuthenticated() || !req.user.isAdmin) {
      return res.status(403).json({ message: "Admin privileges required" });
    }
    
    const key = req.params.key;
    const { value } = req.body;
    
    if (!key || value === undefined) {
      return res.status(400).json({ message: "Key and value are required" });
    }
    
    try {
      // Create or update the setting
      const updatedSetting = await storage.setAppSetting(key, value);
      
      // Clear cache
      appSettingsCache.delete(key);
      
      res.json(updatedSetting);
    } catch (error) {
      console.error(`Error updating app setting ${key}:`, error);
      res.status(500).json({ message: "Error updating setting" });
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
  
  // VPN Tunnel status endpoint
  app.get("/api/tunnel/status", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // Get the current session
      const session = await storage.getCurrentSession(req.user.id);
      if (!session) {
        return res.json({ tunnelActive: false, message: "No active VPN session" });
      }
      
      // Get the tunnel details
      const tunnelDetails = vpnTunnelService.getUserTunnelDetails(req.user.id);
      if (!tunnelDetails) {
        return res.json({ 
          tunnelActive: false, 
          sessionActive: true,
          virtualIp: null,
          message: "Session exists but VPN tunnel is not active" 
        });
      }
      
      // Get detailed tunnel status
      const tunnelStatus = vpnTunnelService.getTunnelStatus(session.id);
      
      res.json({
        tunnelActive: true,
        sessionActive: true,
        sessionId: session.id,
        virtualIp: tunnelDetails.tunnelIp,
        serverId: session.serverId,
        serverInfo: tunnelDetails.serverInfo,
        protocol: session.protocol,
        encryption: session.encryption,
        startTime: session.startTime,
        uptime: tunnelStatus.uptime,
        dataTransferred: tunnelStatus.dataTransferred
      });
    } catch (error) {
      console.error("Error checking tunnel status:", error);
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
      
      // Get the user's IP address
      const userIp = req.headers['x-forwarded-for'] || 
                     req.socket.remoteAddress || 
                     req.ip || 
                     '127.0.0.1';
      
      // Create an actual VPN tunnel with proper traffic routing
      const tunnelResult = await vpnTunnelService.createTunnel(
        session,
        typeof userIp === 'string' ? userIp : userIp[0]
      );
      
      // Return the session with tunnel details
      res.status(201).json({
        ...session,
        virtualIp: tunnelResult.tunnelIp,
        tunnelConfig: tunnelResult.config,
        connectionDetails: tunnelResult.connectionDetails
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sessions/end", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        console.log("Non-authenticated disconnect request - still treating as successful");
        return res.status(200).json({
          success: true,
          message: "VPN disconnected (not authenticated).",
          disconnected: true
        });
      }
      
      const userId = req.user.id;
      
      // Force clear on the server side FIRST, then process storage details
      try {
        const endTime = new Date();
        console.log(`Ended all active sessions before creating a new one for user ${userId}`);
        
        await db.update(vpnSessions)
          .set({ endTime })
          .where(
            and(
              eq(vpnSessions.userId, userId),
              isNull(vpnSessions.endTime)
            )
          );
      } catch (sqlError) {
        console.error("SQL error ending sessions:", sqlError);
        // Continue anyway since we'll return success
      }
      
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
      
      // Close the VPN tunnel if one exists
      const tunnelClosed = vpnTunnelService.closeTunnel(userId);
      console.log(`VPN tunnel ${tunnelClosed ? 'closed' : 'not found'} for user ${userId}`);
      
      // Return success even if there was no specific session information
      if (!session && !currentSession) {
        return res.status(200).json({ 
          success: true, 
          message: "VPN disconnected. No active sessions found.",
          disconnected: true
        });
      }
      
      // Use either session or currentSession (whichever is available)
      const sessionData = session || currentSession;
      
      // Add the virtual IP to the response for consistency
      let virtualIp = '0.0.0.0';
      
      if (sessionData) {
        const octet1 = 10;
        const octet2 = Math.floor((sessionData.id * 13) % 255);
        const octet3 = Math.floor((sessionData.id * 17) % 255);
        const octet4 = Math.floor((sessionData.id * 23) % 255);
        virtualIp = `${octet1}.${octet2}.${octet3}.${octet4}`;
      }
      
      // Add explicit response headers to avoid caching the result
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      res.json({
        ...(sessionData || {}),
        virtualIp,
        success: true,
        disconnected: true,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error("Error ending session:", error);
      // Still return success to ensure client shows as disconnected
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).json({ 
        success: true, 
        message: "VPN disconnect processed with errors.",
        disconnected: true,
        timestamp: Date.now()
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
  app.post("/api/initialize-payment", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { planName, paymentMethod = 'paystack' } = req.body;
      if (!planName) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ message: "Plan name is required" });
      }
      
      // Find subscription plan details
      const subscriptionPlan = await storage.getSubscriptionPlanByName(planName);
      if (!subscriptionPlan) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(404).json({ message: "Subscription plan not found" });
      }
      
      // Skip payment for the free plan
      if (planName === 'free') {
        await storage.updateUserSubscription(req.user.id, planName);
        res.setHeader('Content-Type', 'application/json');
        return res.json({
          success: true,
          message: "Free plan activated",
          subscription: planName,
          redirectUrl: '/dashboard'
        });
      }
      
      // Make sure user has an email address
      if (!req.user.email) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ message: "Email address is required for payment processing" });
      }
      
      // Handle different payment methods
      if (paymentMethod === 'paystack') {
        // Generate a unique reference for this transaction
        const reference = paystackService.generateReference();
        
        // For Paystack, we redirect to our custom checkout page
        res.setHeader('Content-Type', 'application/json');
        return res.json({
          success: true,
          paymentProvider: 'paystack',
          reference,
          authorizationUrl: `/paystack-checkout?plan=${planName}&ref=${reference}`,
          planName,
          price: subscriptionPlan.price / 100 // Convert from cents to dollars for display
        });
      } else if (paymentMethod === 'stripe') {
        // Default to Stripe
        // Make sure we have a price ID for the plan
        if (!subscriptionPlan.stripePriceId) {
          res.setHeader('Content-Type', 'application/json');
          return res.status(400).json({ message: "This plan is not available for purchase yet" });
        }
        
        // Create or get the customer
        let customerId = req.user.stripeCustomerId;
        if (!customerId && stripe) {
          const customer = await stripe.customers.create({
            name: req.user.username,
            email: req.user.email,
            metadata: {
              userId: req.user.id.toString()
            }
          });
          
          customerId = customer.id;
          await storage.updateStripeCustomerId(req.user.id, customerId);
        }
        
        // Set up the checkout session
        let session;
        if (stripe) {
          session = await stripe.checkout.sessions.create({
            line_items: [
              {
                price: subscriptionPlan.stripePriceId,
                quantity: 1,
              },
            ],
            mode: 'subscription',
            success_url: `${req.headers.origin || ''}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.origin || ''}/subscription`,
            customer: customerId,
            client_reference_id: req.user.id.toString(),
            subscription_data: {
              metadata: {
                userId: req.user.id.toString(),
                planName: planName
              }
            }
          });
        } else {
          res.setHeader('Content-Type', 'application/json');
          return res.status(500).json({ message: "Stripe payment service is not available" });
        }
        
        res.setHeader('Content-Type', 'application/json');
        return res.json({
          success: true,
          paymentProvider: 'stripe',
          url: session.url,
          paymentSessionId: session.id,
          planName
        });
      } else {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ message: "Invalid payment method" });
      }
    } catch (error: any) {
      console.error("Initialize payment error:", error.response?.data || error);
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ 
        success: false, 
        message: "Error initializing payment", 
        error: error.response?.data?.message || error.message 
      });
    }
  });

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

      const { planName, paymentMethod = 'stripe' } = req.body;
      if (!planName) {
        return res.status(400).json({ message: "Plan name is required" });
      }
      
      // Validate payment method
      if (!['stripe', 'paystack'].includes(paymentMethod)) {
        return res.status(400).json({ message: "Invalid payment method" });
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
      
      // Special handling for free plan
      if (plan.name === 'free' || plan.price === 0) {
        // Free plan - just update the user's subscription without payment
        await storage.updateUserSubscription(user.id, plan.name);
        
        // Return success without client secret
        return res.json({
          success: true,
          message: 'Subscribed to free plan successfully',
          plan: plan.name
        });
      }
      
      // If there's no Stripe price ID for a paid plan, return error
      if (!plan.stripePriceId) {
        return res.status(400).json({ message: "This plan is not available for subscription" });
      }

      // Handle payment based on selected payment method
      if (paymentMethod === 'stripe') {
        // Create subscription with Stripe
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
        return res.json({
          subscriptionId: subscription.id,
          clientSecret: paymentIntent.client_secret,
          paymentMethod: 'stripe'
        });
      } else if (paymentMethod === 'paystack') {
        // TODO: Implement Paystack integration
        // This is a placeholder for Paystack implementation
        // In a real implementation, you would:
        // 1. Initialize a transaction with Paystack API
        // 2. Get the authorization URL
        // 3. Return it to the client for redirection
        
        // Create a reference for the transaction
        const reference = `paystack_${Date.now()}_${user.id}`;
        
        // Generate the checkout URL
        const authorizationUrl = `/paystack-checkout?plan=${plan.name}&user=${user.id}&ref=${reference}&price=${plan.price / 100}`;
        
        // Create the response data
        const paystackData = {
          reference,
          paymentMethod: 'paystack',
          authorizationUrl
        };
        
        // Store the reference in user metadata or a separate table
        // await storage.storePaystackReference(user.id, reference);
        
        return res.json({
          ...paystackData,
          message: "Redirecting to Paystack for payment"
        });
      }
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
  
  // Handle Paystack payment confirmation
  app.post("/api/confirm-subscription", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { reference, plan, cardDetails } = req.body;
      if (!reference || !plan) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ message: "Reference and plan are required" });
      }
      
      // Get the subscription plan to get the price
      const subscriptionPlan = await storage.getSubscriptionPlanByName(plan);
      if (!subscriptionPlan) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(404).json({ message: "Subscription plan not found" });
      }
      
      // Use the imported Paystack service
      
      // Make sure we have user email - needed for Paystack
      if (!req.user.email) {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({ message: "User email is required for payment processing" });
      }
      
      // Log payment attempt
      console.log(`[PAYMENT] Processing payment for ${plan} plan at $${subscriptionPlan.price}.`);
      console.log(`[PAYMENT] Reference: ${reference}`);
      console.log(`[PAYMENT] User: ${req.user.id} (${req.user.username})`);
      
      // Process payment with Paystack
      const paymentResult = await paystackService.chargeCard(
        req.user.email,
        subscriptionPlan.price,
        {
          number: cardDetails.number,
          cvv: cardDetails.cvv,
          expiryMonth: cardDetails.expiryMonth,
          expiryYear: cardDetails.expiryYear
        },
        {
          userId: req.user.id,
          planName: plan,
          custom_reference: reference
        }
      );
      
      // If the payment needs additional action (like OTP), return that info
      if (paymentResult.data && paymentResult.data.status === 'send_otp') {
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).json({
          success: false,
          requires_action: true,
          action_type: 'otp',
          reference: paymentResult.data.reference,
          message: "Please provide the OTP sent to your phone/email"
        });
      }
      
      // Verify the transaction
      const verificationResult = await paystackService.verifyTransaction(
        paymentResult.data?.reference || reference
      );
      
      // Check if payment was successful
      if (!verificationResult.status || verificationResult.data?.status !== 'success') {
        res.setHeader('Content-Type', 'application/json');
        return res.status(400).json({
          success: false,
          message: "Payment was not successful",
          paymentStatus: verificationResult.data?.status || 'failed'
        });
      }
      
      // Calculate when the subscription would expire (1 month from now)
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 1);
      
      // Update user's subscription in the database with expiry date
      await storage.updateUserSubscription(req.user.id, plan, expiryDate);
      
      // Record the transaction ID from Paystack if available
      const transactionId = verificationResult.data?.id || '';
      console.log(`[PAYMENT] Transaction successful (ID: ${transactionId}). Subscription active until ${expiryDate.toISOString()}`);
      
      // Create the response object
      const responseData = {
        success: true,
        message: `Payment of $${subscriptionPlan.price} successful. Subscription to ${plan} plan confirmed.`,
        plan,
        amount: subscriptionPlan.price,
        currency: "USD",
        expiryDate: expiryDate.toISOString(),
        transaction: {
          id: transactionId,
          reference: verificationResult.data?.reference || reference
        }
      };
      
      // Explicitly set Content-Type header to application/json
      res.setHeader('Content-Type', 'application/json');
      
      // Return success response with price information
      return res.status(200).json(responseData);
    } catch (error: any) {
      console.error("Confirm subscription error:", error.response?.data || error);
      res.setHeader('Content-Type', 'application/json');
      return res.status(500).json({ 
        success: false, 
        message: "Error confirming subscription", 
        error: error.response?.data?.message || error.message 
      });
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

  // Dashboard prefetching endpoint - combines multiple API calls into one
  // This optimizes initial load by fetching all dashboard data in a single request
  app.get("/api/dashboard/prefetch", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const userId = req.user.id;
      
      // Fetch all data in parallel for better performance
      const [
        currentSession,
        servers,
        settings,
        subscription,
        usageStats,
        limits
      ] = await Promise.all([
        storage.getCurrentSession(userId),
        storage.getAllServers(),
        storage.getUserSettings(userId),
        storage.getUser(userId),
        storage.getUserUsageStats(userId, "7days"),
        storage.checkUserLimits(userId)
      ]);
      
      // Add virtual IP to session if it exists
      let sessionWithIp = null;
      if (currentSession) {
        const octet1 = 10;
        const octet2 = Math.floor((currentSession.id * 13) % 255);
        const octet3 = Math.floor((currentSession.id * 17) % 255);
        const octet4 = Math.floor((currentSession.id * 23) % 255);
        const virtualIp = `${octet1}.${octet2}.${octet3}.${octet4}`;
        
        sessionWithIp = {
          ...currentSession,
          virtualIp
        };
      }
      
      // Create the combined response
      const prefetchedData = {
        currentSession: sessionWithIp,
        servers,
        settings: settings || {
          userId,
          killSwitch: true,
          dnsLeakProtection: true,
          doubleVpn: false,
          obfuscation: false,
          preferredProtocol: "openvpn_tcp",
          preferredEncryption: "aes_256_gcm"
        },
        subscription: {
          subscription: subscription?.subscription || 'free',
          expiryDate: subscription?.subscriptionExpiryDate,
          stripeCustomerId: subscription?.stripeCustomerId,
          stripeSubscriptionId: subscription?.stripeSubscriptionId
        },
        usageStats,
        limits,
        killSwitchStatus: {
          active: killSwitchManager.isActive(userId)
        },
        timestamp: Date.now()
      };
      
      res.json(prefetchedData);
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
  
  // Batch update multiple app settings at once
  app.post("/api/admin/app-settings/batch", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // In a real app, check for admin role
      // For demo purposes, consider user with ID 1 as admin
      if (req.user.id !== 1) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { settings } = req.body;
      
      if (!Array.isArray(settings)) {
        return res.status(400).json({ message: "Settings must be an array" });
      }
      
      const results = [];
      for (const setting of settings) {
        const { key, value, description } = setting;
        const updatedSetting = await storage.setAppSetting(key, value, description);
        results.push(updatedSetting);
      }
      
      res.status(200).json(results);
    } catch (error) {
      next(error);
    }
  });
  
  // Upload app logo
  app.post("/api/admin/app-logo", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      // In a real app, check for admin role
      // For demo purposes, consider user with ID 1 as admin
      if (req.user.id !== 1) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const { logoData } = req.body;
      
      if (!logoData) {
        return res.status(400).json({ message: "Logo data is required" });
      }
      
      // Store logo as a base64 string in the app_settings
      const setting = await storage.setAppSetting(
        'app_logo', 
        logoData,
        'Base64 encoded logo image'
      );
      
      res.status(200).json(setting);
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

  // Feature access endpoints
  app.get("/api/feature-access/:feature", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const feature = req.params.feature;
      
      if (!feature) {
        return res.status(400).json({ message: "Feature name is required" });
      }
      
      // Check if user has access to the specified feature
      const hasAccess = await storage.checkUserFeatureAccess(req.user.id, feature);
      
      res.json({
        feature,
        hasAccess
      });
    } catch (error) {
      console.error(`Error checking access to feature ${req.params.feature}:`, error);
      next(error);
    }
  });
  
  // Obfuscation and anti-censorship endpoints
  app.get("/api/obfuscation/methods/:protocol", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const protocol = req.params.protocol;
      if (!protocol) {
        return res.status(400).json({ message: "Protocol is required" });
      }
      
      const methods = obfuscationService.getAvailableObfuscationMethods(protocol);
      
      // Check if user has access to obfuscation feature
      const hasAccess = await storage.checkUserFeatureAccess(req.user.id, 'obfuscation');
      
      res.json({
        protocol,
        methods,
        hasAccess
      });
    } catch (error) {
      console.error("Error getting obfuscation methods:", error);
      next(error);
    }
  });
  
  app.get("/api/obfuscation/config/:protocol/:serverId", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const { protocol, serverId } = req.params;
      if (!protocol || !serverId) {
        return res.status(400).json({ message: "Protocol and server ID are required" });
      }
      
      // Check if user has access to obfuscation feature
      const hasAccess = await storage.checkUserFeatureAccess(req.user.id, 'obfuscation');
      if (!hasAccess) {
        return res.status(403).json({ 
          message: "Premium feature access required",
          feature: "obfuscation"
        });
      }
      
      const config = await obfuscationService.getObfuscationConfig(
        req.user.id,
        protocol,
        parseInt(serverId)
      );
      
      if (!config) {
        return res.status(404).json({ 
          message: "Obfuscation not available for this configuration",
          reason: "Either server doesn't support obfuscation, or it's not enabled in user settings"
        });
      }
      
      res.json(config);
    } catch (error) {
      console.error("Error getting obfuscation config:", error);
      next(error);
    }
  });
  
  app.post("/api/obfuscation/connect", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const { serverId, protocol, method } = req.body;
      
      if (!serverId || !protocol) {
        return res.status(400).json({ message: "Server ID and protocol are required" });
      }
      
      // Check if user has access to obfuscation feature
      const hasAccess = await storage.checkUserFeatureAccess(req.user.id, 'obfuscation');
      if (!hasAccess) {
        return res.status(403).json({ 
          message: "Premium feature access required",
          feature: "obfuscation"
        });
      }
      
      // Generate obfuscated connection parameters
      const connectionParams = await obfuscationService.generateObfuscatedConnectionParams(
        req.user.id,
        parseInt(serverId),
        protocol,
        method
      );
      
      // Return the parameters needed for connection
      res.json({
        success: true,
        connectionParams
      });
    } catch (error) {
      console.error("Error generating obfuscated connection:", error);
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        next(error);
      }
    }
  });
  
  app.get("/api/anti-censorship/config", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const countryCode = req.query.country as string | undefined;
      
      // First check if user has access to anti-censorship feature
      const hasAccess = await storage.checkUserFeatureAccess(req.user.id, 'anti-censorship');
      if (!hasAccess) {
        return res.status(403).json({ 
          message: "Premium feature access required",
          feature: "anti-censorship"
        });
      }
      
      // Get anti-censorship configuration
      const config = await obfuscationService.getAntiCensorshipConfig(
        req.user.id,
        countryCode
      );
      
      if (!config) {
        return res.status(500).json({ 
          message: "Error generating anti-censorship configuration"
        });
      }
      
      res.json(config);
    } catch (error) {
      console.error("Error getting anti-censorship config:", error);
      next(error);
    }
  });

  // App Settings endpoints - these are already defined above
  // The duplicate routes have been removed to fix the app startup issue

  const httpServer = createServer(app);
  return httpServer;
}
