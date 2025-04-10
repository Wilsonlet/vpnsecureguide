import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertVpnSessionSchema, insertVpnUserSettingsSchema, subscriptionTiers } from "@shared/schema";
import { z } from "zod";
import Stripe from "stripe";

// Initialize Stripe if the secret key is available
let stripe: Stripe | undefined;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
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

  const httpServer = createServer(app);
  return httpServer;
}
