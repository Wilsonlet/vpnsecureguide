import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { insertVpnSessionSchema, insertVpnUserSettingsSchema } from "@shared/schema";
import { z } from "zod";

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
      
      const settings = await storage.getUserSettings(req.user.id);
      if (!settings) {
        return res.status(404).json({ message: "Settings not found" });
      }
      res.json(settings);
    } catch (error) {
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
        return res.status(404).json({ message: "No active session" });
      }
      res.json(session);
    } catch (error) {
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
      res.status(201).json(session);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/sessions/end", async (req, res, next) => {
    try {
      if (!req.isAuthenticated()) return res.status(401).json({ message: "Not authenticated" });
      
      const session = await storage.endCurrentSession(req.user.id);
      if (!session) {
        return res.status(404).json({ message: "No active session to end" });
      }
      res.json(session);
    } catch (error) {
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
