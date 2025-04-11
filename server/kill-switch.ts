/**
 * VPN Kill Switch Implementation
 * 
 * This module handles the server-side implementation of the VPN kill switch feature.
 * The kill switch blocks all non-VPN traffic when the VPN connection drops to prevent
 * IP leaks and ensure security.
 */

import { Request, Response, NextFunction } from 'express';
import { storage } from './storage';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { vpnSessions } from '@shared/schema';

// Class to manage kill switch state for each user
class KillSwitchManager {
  private activeKillSwitches: Map<number, { 
    activatedAt: Date,
    reason: string 
  }> = new Map();
  
  // Activate kill switch for a user
  public activate(userId: number, reason: string = 'manual'): boolean {
    // Save activation time
    this.activeKillSwitches.set(userId, {
      activatedAt: new Date(),
      reason
    });
    
    console.log(`Kill switch activated for user ${userId}, reason: ${reason}`);
    return true;
  }
  
  // Deactivate kill switch for a user
  public deactivate(userId: number): boolean {
    const wasActive = this.activeKillSwitches.has(userId);
    this.activeKillSwitches.delete(userId);
    
    if (wasActive) {
      console.log(`Kill switch deactivated for user ${userId}`);
    }
    
    return wasActive;
  }
  
  // Check if kill switch is active for a user
  public isActive(userId: number): boolean {
    return this.activeKillSwitches.has(userId);
  }
  
  // Get kill switch details for a user
  public getDetails(userId: number): { 
    active: boolean, 
    activatedAt?: Date,
    reason?: string 
  } {
    const data = this.activeKillSwitches.get(userId);
    
    if (!data) {
      return { active: false };
    }
    
    return {
      active: true,
      activatedAt: data.activatedAt,
      reason: data.reason
    };
  }
  
  // Automatically trigger kill switch for a user if their VPN connection drops
  public async handleDisconnect(userId: number, abrupt: boolean = true): Promise<boolean> {
    try {
      // Check if user has kill switch enabled in settings
      const settings = await storage.getUserSettings(userId);
      
      if (!settings || !settings.killSwitch) {
        console.log(`Kill switch not enabled for user ${userId}, skipping activation on disconnect`);
        return false;
      }
      
      // Only activate on abrupt disconnects, not user-initiated ones
      if (abrupt) {
        console.log(`Activating kill switch for user ${userId} due to abrupt VPN disconnect`);
        return this.activate(userId, 'disconnect');
      } else {
        console.log(`Normal VPN disconnect for user ${userId}, kill switch not activated`);
        return false;
      }
    } catch (error) {
      console.error(`Error handling disconnect for user ${userId}:`, error);
      return false;
    }
  }
}

// Singleton instance
export const killSwitchManager = new KillSwitchManager();

// Express middleware to handle kill switch routes
export function setupKillSwitchRoutes(app: any) {
  // Get kill switch status
  app.get('/api/killswitch/status', (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const userId = req.user.id;
    const details = killSwitchManager.getDetails(userId);
    
    res.json(details);
  });
  
  // Activate kill switch
  app.post('/api/killswitch/activate', async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      const userId = req.user.id;
      
      // Check if user has kill switch enabled in settings
      const settings = await storage.getUserSettings(userId);
      
      if (!settings || !settings.killSwitch) {
        return res.status(400).json({ 
          message: 'Kill switch is not enabled in settings',
          success: false
        });
      }
      
      // Activate kill switch
      const success = killSwitchManager.activate(userId, req.body.reason || 'manual');
      
      if (success) {
        // Get details after activation
        const details = killSwitchManager.getDetails(userId);
        
        res.json({
          success: true,
          message: 'Kill switch activated successfully',
          ...details
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to activate kill switch'
        });
      }
    } catch (error) {
      next(error);
    }
  });
  
  // Deactivate kill switch
  app.post('/api/killswitch/deactivate', (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.isAuthenticated()) {
        return res.status(401).json({ message: 'Not authenticated' });
      }
      
      const userId = req.user.id;
      const success = killSwitchManager.deactivate(userId);
      
      res.json({
        success: true,
        wasActive: success,
        message: success ? 'Kill switch deactivated' : 'Kill switch was not active'
      });
    } catch (error) {
      next(error);
    }
  });
  
  // Handle VPN ping for connection monitoring
  app.get('/api/vpn/ping', (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    const pingTime = req.header('X-Ping-Time') || Date.now().toString();
    
    res.json({
      success: true,
      timestamp: Date.now(),
      pingTime,
      message: 'VPN connection active'
    });
  });
  
  // Instead of trying to hook into an existing endpoint, we'll create middleware 
  // to be used with the session end endpoint in routes.ts
  
  // Create kill switch middleware that can be used with session end endpoint
  app.use('/api/sessions/end', async (req: Request, res: Response, next: NextFunction) => {
    // Only process POST requests, let others pass through
    if (req.method !== 'POST') {
      return next();
    }
    
    try {
      if (req.isAuthenticated() && req.user) {
        const userId = req.user.id;
        const abrupt = Boolean(req.body.abrupt);
        
        // Check kill switch setting before session end
        await killSwitchManager.handleDisconnect(userId, abrupt);
        console.log(`Kill switch checked for user ${userId} (abrupt: ${abrupt})`);
      }
      
      // Continue to the actual endpoint handler
      next();
    } catch (error) {
      console.error('Error in kill switch middleware:', error);
      // Continue anyway, don't block the request
      next();
    }
  });
  
  console.log('Kill switch middleware installed for VPN session termination');
}