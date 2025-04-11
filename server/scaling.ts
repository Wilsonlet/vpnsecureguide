import { storage } from "./storage";
import { VpnServer } from "@shared/schema";

/**
 * Server Load Balancer for VPN connections
 * Designed to handle selection of optimal servers at scale
 */
export class VpnLoadBalancer {
  // Cache of server status with TTL
  private serverCache: Map<string, { 
    servers: VpnServer[],
    timestamp: number 
  }> = new Map();
  
  // TTL for cache in milliseconds (30 seconds)
  private cacheTTL = 30000;
  
  constructor(private readonly storageProvider = storage) {}
  
  /**
   * Get available servers with intelligent caching for high-scale environments
   */
  async getAvailableServers(filters: { 
    region?: string,
    obfuscated?: boolean,
    doubleHop?: boolean
  } = {}): Promise<VpnServer[]> {
    // Generate cache key based on filters
    const cacheKey = this.generateCacheKey(filters);
    const now = Date.now();
    
    // Check if we have a valid cached result
    const cachedResult = this.serverCache.get(cacheKey);
    if (cachedResult && (now - cachedResult.timestamp) < this.cacheTTL) {
      return cachedResult.servers;
    }
    
    // Fetch fresh data
    const servers = await this.storageProvider.getFilteredServers(filters);
    
    // Update cache
    this.serverCache.set(cacheKey, {
      servers,
      timestamp: now
    });
    
    return servers;
  }
  
  /**
   * Select optimal server based on user's region and server load
   */
  async selectOptimalServer(
    userId: number, 
    region?: string, 
    premium = false
  ): Promise<VpnServer | null> {
    // Get available servers matching criteria
    const servers = await this.getAvailableServers({ 
      region,
      // Only consider premium servers if user has premium access
      ...(premium ? {} : { premium: false })
    });
    
    if (servers.length === 0) return null;
    
    // Sort servers by a weighted score of load and latency
    const sortedServers = [...servers].sort((a, b) => {
      // Weight load more heavily than latency
      // Handle null/undefined values with defaults
      const aLoad = a.load ?? 100;  // Default to high load if null
      const aLatency = a.latency ?? 500;  // Default to high latency if null
      const bLoad = b.load ?? 100;
      const bLatency = b.latency ?? 500;
      
      const scoreA = (aLoad * 0.7) + (aLatency * 0.3);
      const scoreB = (bLoad * 0.7) + (bLatency * 0.3);
      return scoreA - scoreB;
    });
    
    // Add some user-specific variance to prevent all users hitting the same server
    // This helps distribute load across multiple good servers
    const userVariance = userId % Math.min(3, sortedServers.length);
    const selectedIndex = Math.min(userVariance, sortedServers.length - 1);
    
    return sortedServers[selectedIndex];
  }
  
  /**
   * Generate a cache key from server filters
   */
  private generateCacheKey(filters: any): string {
    return Object.entries(filters)
      .filter(([_, value]) => value !== undefined)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}:${value}`)
      .join('|');
  }
  
  /**
   * Update server load in real-time
   * Would be called by VPN server monitoring system
   */
  async updateServerLoad(serverId: number, load: number): Promise<void> {
    // Implementation would update server load in database
    // and invalidate related cache entries

    // For demonstration purposes, we'll just clear the whole cache
    this.serverCache.clear();
  }
}

/**
 * Connection Rate Limiter with tiered approach
 * Prevents abuse while allowing higher priority for paid users
 */
export class ConnectionRateLimiter {
  // Map of user IDs to their recent connection timestamps
  private connectionRequests: Map<number, number[]> = new Map();
  
  // Map of user IDs to their disconnection timestamps
  private disconnectTimes: Map<number, number> = new Map();
  
  // Window period in milliseconds (5 seconds)
  private windowPeriod = 5000;
  
  // Set up limiter with cleanup interval
  constructor() {
    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }
  
  /**
   * Check if a user's connection request should be rate limited
   */
  canConnect(userId: number, subscriptionTier: string): { 
    allowed: boolean,
    reason?: string
  } {
    const now = Date.now();
    
    // Check if user recently disconnected (prevents rapid reconnects)
    const disconnectTime = this.disconnectTimes.get(userId) || 0;
    if (now - disconnectTime < 3000) {
      return {
        allowed: false,
        reason: "RECENT_DISCONNECT"
      };
    }
    
    // Get connection attempts in the sliding window
    const attempts = this.connectionRequests.get(userId) || [];
    const recentAttempts = attempts.filter(time => now - time < this.windowPeriod);
    
    // Different limits based on subscription tier
    let maxAttempts: number;
    switch (subscriptionTier.toLowerCase()) {
      case 'ultimate':
        maxAttempts = 10;
        break;
      case 'premium':
        maxAttempts = 5;
        break;
      case 'basic':
        maxAttempts = 3;
        break;
      default: // free tier
        maxAttempts = 2;
        break;
    }
    
    if (recentAttempts.length >= maxAttempts) {
      return {
        allowed: false,
        reason: "RATE_LIMITED"
      };
    }
    
    // Track this attempt
    recentAttempts.push(now);
    this.connectionRequests.set(userId, recentAttempts);
    
    return { allowed: true };
  }
  
  /**
   * Record a disconnection event
   */
  recordDisconnect(userId: number): void {
    this.disconnectTimes.set(userId, Date.now());
  }
  
  /**
   * Clean up old connection records
   */
  private cleanup(): void {
    const now = Date.now();
    
    // Clean up connection requests older than window period
    this.connectionRequests.forEach((timestamps, userId) => {
      const validTimestamps = timestamps.filter(time => now - time < this.windowPeriod);
      if (validTimestamps.length === 0) {
        this.connectionRequests.delete(userId);
      } else {
        this.connectionRequests.set(userId, validTimestamps);
      }
    });
    
    // Clean up disconnect times older than 1 minute
    this.disconnectTimes.forEach((timestamp, userId) => {
      if (now - timestamp > 60000) {
        this.disconnectTimes.delete(userId);
      }
    });
  }
}

/**
 * Connection Statistics Tracker
 * Monitors active connections, bandwidth usage, etc.
 */
export class ConnectionStatistics {
  // Count of active connections by server ID
  private activeConnections: Map<number, number> = new Map();
  
  // Current bandwidth usage by server ID (bytes/sec)
  private bandwidthUsage: Map<number, { upload: number, download: number }> = new Map();
  
  /**
   * Record a new connection
   */
  recordConnection(serverId: number): void {
    const current = this.activeConnections.get(serverId) || 0;
    this.activeConnections.set(serverId, current + 1);
  }
  
  /**
   * Record a disconnection
   */
  recordDisconnection(serverId: number): void {
    const current = this.activeConnections.get(serverId) || 0;
    if (current > 0) {
      this.activeConnections.set(serverId, current - 1);
    }
  }
  
  /**
   * Update bandwidth usage for a server
   */
  updateBandwidth(serverId: number, upload: number, download: number): void {
    this.bandwidthUsage.set(serverId, { upload, download });
  }
  
  /**
   * Get global statistics
   */
  getGlobalStats(): {
    totalConnections: number,
    totalUploadBandwidth: number,
    totalDownloadBandwidth: number
  } {
    let totalConnections = 0;
    let totalUploadBandwidth = 0;
    let totalDownloadBandwidth = 0;
    
    // Sum active connections
    this.activeConnections.forEach(count => {
      totalConnections += count;
    });
    
    // Sum bandwidth usage
    this.bandwidthUsage.forEach(({ upload, download }) => {
      totalUploadBandwidth += upload;
      totalDownloadBandwidth += download;
    });
    
    return {
      totalConnections,
      totalUploadBandwidth,
      totalDownloadBandwidth
    };
  }
  
  /**
   * Get statistics for a specific server
   */
  getServerStats(serverId: number): {
    connections: number,
    uploadBandwidth: number,
    downloadBandwidth: number
  } {
    const connections = this.activeConnections.get(serverId) || 0;
    const { upload, download } = this.bandwidthUsage.get(serverId) || { upload: 0, download: 0 };
    
    return {
      connections,
      uploadBandwidth: upload,
      downloadBandwidth: download
    };
  }
}

// Create singletons for use throughout the application
export const vpnLoadBalancer = new VpnLoadBalancer();
export const connectionRateLimiter = new ConnectionRateLimiter();
export const connectionStatistics = new ConnectionStatistics();