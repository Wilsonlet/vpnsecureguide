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
 * Token Bucket Rate Limiter with tiered approach
 * Provides smoother rate limiting for better user experience
 * Prevents abuse while allowing higher priority for paid users
 */
export class ConnectionRateLimiter {
  // Map of user IDs to their token bucket state
  private tokenBuckets: Map<number, {
    tokens: number;
    lastRefill: number;
    maxTokens: number;
    refillRate: number; // tokens per ms
  }> = new Map();
  
  // Map of user IDs to their disconnection timestamps
  private disconnectTimes: Map<number, number> = new Map();
  
  // Map of user IDs to error metrics
  private errorMetrics: Map<number, {
    failedAttempts: number;
    lastErrorTime: number;
    errorReasons: Record<string, number>;
  }> = new Map();
  
  // Global error metrics
  private globalErrors: {
    totalFailedConnections: number;
    totalAuthErrors: number;
    highLatencyEvents: number;
    byServer: Map<number, {
      failedConnections: number;
      highLatencyCount: number;
    }>;
  } = {
    totalFailedConnections: 0,
    totalAuthErrors: 0,
    highLatencyEvents: 0,
    byServer: new Map()
  };
  
  // Set up limiter with cleanup interval
  constructor() {
    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60000);
  }
  
  /**
   * Check if a user's connection request should be rate limited using token bucket algorithm
   */
  canConnect(userId: number, subscriptionTier: string): { 
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  } {
    const now = Date.now();
    
    // Check if user recently disconnected (prevents rapid reconnects)
    const disconnectTime = this.disconnectTimes.get(userId) || 0;
    if (now - disconnectTime < 3000) {
      this.recordError(userId, "RECENT_DISCONNECT");
      return {
        allowed: false,
        reason: "RECENT_DISCONNECT",
        retryAfter: 3000 - (now - disconnectTime)
      };
    }
    
    // Initialize or get token bucket for this user
    if (!this.tokenBuckets.has(userId)) {
      this.initializeBucket(userId, subscriptionTier);
    }
    
    const bucket = this.tokenBuckets.get(userId)!;
    
    // Refill tokens based on time elapsed since last refill
    const timeElapsed = now - bucket.lastRefill;
    const tokensToAdd = timeElapsed * bucket.refillRate;
    
    bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
    bucket.lastRefill = now;
    
    // Check if we have a token available for this request
    if (bucket.tokens < 1) {
      // Calculate wait time until one token is available
      const waitTime = Math.ceil((1 - bucket.tokens) / bucket.refillRate);
      this.recordError(userId, "RATE_LIMITED");
      return {
        allowed: false,
        reason: "RATE_LIMITED",
        retryAfter: waitTime
      };
    }
    
    // Consume a token
    bucket.tokens -= 1;
    
    return { allowed: true };
  }
  
  /**
   * Initialize a token bucket for a user based on their subscription tier
   */
  private initializeBucket(userId: number, subscriptionTier: string): void {
    // Different limits based on subscription tier
    let maxTokens: number;
    let refillRate: number; // tokens per millisecond
    
    switch (subscriptionTier.toLowerCase()) {
      case 'ultimate':
        maxTokens = 10;
        refillRate = 10 / 5000; // 10 tokens per 5 seconds
        break;
      case 'premium':
        maxTokens = 5;
        refillRate = 5 / 5000; // 5 tokens per 5 seconds
        break;
      case 'basic':
        maxTokens = 3;
        refillRate = 3 / 5000; // 3 tokens per 5 seconds
        break;
      default: // free tier
        maxTokens = 2;
        refillRate = 2 / 5000; // 2 tokens per 5 seconds
        break;
    }
    
    this.tokenBuckets.set(userId, {
      tokens: maxTokens, // Start with full bucket
      lastRefill: Date.now(),
      maxTokens,
      refillRate
    });
  }
  
  /**
   * Record a disconnection event
   */
  recordDisconnect(userId: number): void {
    this.disconnectTimes.set(userId, Date.now());
  }
  
  /**
   * Record an error for metrics tracking
   */
  recordError(userId: number, reason: string): void {
    const now = Date.now();
    
    // Update user-specific error metrics
    const userMetrics = this.errorMetrics.get(userId) || {
      failedAttempts: 0,
      lastErrorTime: now,
      errorReasons: {}
    };
    
    userMetrics.failedAttempts++;
    userMetrics.lastErrorTime = now;
    userMetrics.errorReasons[reason] = (userMetrics.errorReasons[reason] || 0) + 1;
    
    this.errorMetrics.set(userId, userMetrics);
    
    // Update global error metrics
    this.globalErrors.totalFailedConnections++;
    if (reason === 'AUTH_ERROR') {
      this.globalErrors.totalAuthErrors++;
    }
  }
  
  /**
   * Record a server error or high latency event
   */
  recordServerIssue(serverId: number, isHighLatency: boolean = false, isConnectionFailure: boolean = false): void {
    const serverMetrics = this.globalErrors.byServer.get(serverId) || {
      failedConnections: 0,
      highLatencyCount: 0
    };
    
    if (isHighLatency) {
      serverMetrics.highLatencyCount++;
      this.globalErrors.highLatencyEvents++;
    }
    
    if (isConnectionFailure) {
      serverMetrics.failedConnections++;
    }
    
    this.globalErrors.byServer.set(serverId, serverMetrics);
  }
  
  /**
   * Get global error metrics for monitoring
   */
  getGlobalErrorMetrics(): typeof this.globalErrors {
    return this.globalErrors;
  }
  
  /**
   * Reset global error metrics (e.g., after reporting to monitoring system)
   */
  resetGlobalErrorMetrics(): void {
    this.globalErrors = {
      totalFailedConnections: 0,
      totalAuthErrors: 0,
      highLatencyEvents: 0,
      byServer: new Map()
    };
  }
  
  /**
   * Clean up old records
   */
  private cleanup(): void {
    const now = Date.now();
    
    // Clean up token buckets for users inactive for over 1 hour
    this.tokenBuckets.forEach((bucket, userId) => {
      if (now - bucket.lastRefill > 3600000) {
        this.tokenBuckets.delete(userId);
      }
    });
    
    // Clean up disconnect times older than 1 minute
    this.disconnectTimes.forEach((timestamp, userId) => {
      if (now - timestamp > 60000) {
        this.disconnectTimes.delete(userId);
      }
    });
    
    // Clean up error metrics older than 24 hours
    this.errorMetrics.forEach((metrics, userId) => {
      if (now - metrics.lastErrorTime > 86400000) {
        this.errorMetrics.delete(userId);
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
  
  // Server health metrics
  private serverHealth: Map<number, {
    connectionAttempts: number;
    successfulConnections: number;
    failedConnections: number;
    highLatencyEvents: number;
    latencyValues: number[]; // Store last 100 latency values for analysis
    lastUpdated: number;
  }> = new Map();
  
  // Error logs with timestamp for 72h retention
  private errorLogs: Array<{
    timestamp: number;
    serverId: number;
    userId: number;
    errorType: string;
    details: string;
  }> = [];
  
  // Webhook endpoints for alerts
  private alertWebhooks: string[] = [];
  
  constructor() {
    // Clean up old error logs regularly (every hour)
    setInterval(() => this.cleanupErrorLogs(), 3600000);
  }
  
  /**
   * Record a new connection
   */
  recordConnection(serverId: number): void {
    const current = this.activeConnections.get(serverId) || 0;
    this.activeConnections.set(serverId, current + 1);
    
    // Update server health metrics
    const health = this.getServerHealthMetrics(serverId);
    health.connectionAttempts++;
    health.successfulConnections++;
    health.lastUpdated = Date.now();
    this.serverHealth.set(serverId, health);
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
   * Record connection failure with server
   */
  recordConnectionFailure(serverId: number, userId: number, reason: string, details: string = ''): void {
    // Update server health metrics
    const health = this.getServerHealthMetrics(serverId);
    health.connectionAttempts++;
    health.failedConnections++;
    health.lastUpdated = Date.now();
    this.serverHealth.set(serverId, health);
    
    // Log the error
    this.logError(serverId, userId, reason, details);
    
    // If error rate exceeds threshold, trigger alert
    const failureRate = health.failedConnections / health.connectionAttempts;
    if (failureRate > 0.1 && health.connectionAttempts > 10) { // More than 10% failures with at least 10 attempts
      this.triggerServerAlert(serverId, `High connection failure rate: ${(failureRate * 100).toFixed(1)}%`);
    }
  }
  
  /**
   * Record latency measurement for a server
   */
  recordLatency(serverId: number, latencyMs: number): void {
    const health = this.getServerHealthMetrics(serverId);
    
    // Keep last 100 latency measurements
    health.latencyValues.push(latencyMs);
    if (health.latencyValues.length > 100) {
      health.latencyValues.shift(); // Remove oldest
    }
    
    // Check if this is a high latency event
    if (latencyMs > 200) { // Consider >200ms as high latency
      health.highLatencyEvents++;
      
      // Log significant latency spikes
      if (latencyMs > 500) {
        this.logError(serverId, 0, 'HIGH_LATENCY', `Latency spike: ${latencyMs}ms`);
      }
    }
    
    health.lastUpdated = Date.now();
    this.serverHealth.set(serverId, health);
    
    // Check if average latency is high
    const avgLatency = this.calculateAverageLatency(health.latencyValues);
    if (avgLatency > 300 && health.latencyValues.length >= 10) {
      this.triggerServerAlert(serverId, `High average latency: ${avgLatency.toFixed(1)}ms`);
    }
  }
  
  /**
   * Calculate average latency from array of measurements
   */
  private calculateAverageLatency(latencyValues: number[]): number {
    if (latencyValues.length === 0) return 0;
    const sum = latencyValues.reduce((acc, val) => acc + val, 0);
    return sum / latencyValues.length;
  }
  
  /**
   * Add a webhook URL for alerts
   */
  addAlertWebhook(url: string): void {
    if (!this.alertWebhooks.includes(url)) {
      this.alertWebhooks.push(url);
    }
  }
  
  /**
   * Trigger an alert about server issues
   */
  private async triggerServerAlert(serverId: number, message: string): Promise<void> {
    const timestamp = new Date().toISOString();
    const alert = {
      timestamp,
      serverId,
      message,
      stats: this.getServerStats(serverId),
      health: this.getServerHealthMetrics(serverId)
    };
    
    // Log to console
    console.warn(`[SERVER ALERT] Server ${serverId}: ${message}`);
    
    // Send to webhooks
    for (const webhookUrl of this.alertWebhooks) {
      try {
        // In a real implementation, this would make an HTTP request
        // to the webhook URL with the alert data
        console.log(`Would send alert to webhook ${webhookUrl}`);
        // await fetch(webhookUrl, {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify(alert)
        // });
      } catch (error) {
        console.error(`Failed to send alert to webhook ${webhookUrl}:`, error);
      }
    }
  }
  
  /**
   * Log an error with timestamp (72h retention)
   */
  private logError(serverId: number, userId: number, errorType: string, details: string): void {
    this.errorLogs.push({
      timestamp: Date.now(),
      serverId,
      userId,
      errorType,
      details
    });
  }
  
  /**
   * Clean up error logs older than 72 hours
   */
  private cleanupErrorLogs(): void {
    const now = Date.now();
    const retention = 72 * 60 * 60 * 1000; // 72 hours in milliseconds
    
    this.errorLogs = this.errorLogs.filter(log => (now - log.timestamp) < retention);
  }
  
  /**
   * Get recent error logs
   */
  getRecentErrorLogs(hours: number = 24): Array<{
    timestamp: number;
    serverId: number;
    userId: number;
    errorType: string;
    details: string;
  }> {
    const now = Date.now();
    const timeThreshold = now - (hours * 60 * 60 * 1000);
    
    return this.errorLogs
      .filter(log => log.timestamp >= timeThreshold)
      .sort((a, b) => b.timestamp - a.timestamp); // newest first
  }
  
  /**
   * Get health metrics for a specific server
   */
  private getServerHealthMetrics(serverId: number) {
    return this.serverHealth.get(serverId) || {
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      highLatencyEvents: 0,
      latencyValues: [],
      lastUpdated: Date.now()
    };
  }
  
  /**
   * Get global statistics
   */
  getGlobalStats(): {
    totalConnections: number;
    totalUploadBandwidth: number;
    totalDownloadBandwidth: number;
    totalServers: number;
    serverHealth: {
      healthy: number;
      degraded: number;
      unhealthy: number;
    };
    errorRates: {
      connectionFailures: number;
      highLatencyRate: number;
    };
  } {
    let totalConnections = 0;
    let totalUploadBandwidth = 0;
    let totalDownloadBandwidth = 0;
    let healthyCounts = { healthy: 0, degraded: 0, unhealthy: 0 };
    let totalFailures = 0;
    let totalAttempts = 0;
    let totalHighLatency = 0;
    
    // Sum active connections
    this.activeConnections.forEach(count => {
      totalConnections += count;
    });
    
    // Sum bandwidth usage
    this.bandwidthUsage.forEach(({ upload, download }) => {
      totalUploadBandwidth += upload;
      totalDownloadBandwidth += download;
    });
    
    // Analyze server health
    this.serverHealth.forEach(health => {
      totalAttempts += health.connectionAttempts;
      totalFailures += health.failedConnections;
      totalHighLatency += health.highLatencyEvents;
      
      // Determine server health status
      const failureRate = health.connectionAttempts > 0 
        ? health.failedConnections / health.connectionAttempts
        : 0;
      
      if (failureRate > 0.15 || health.highLatencyEvents > 100) {
        healthyCounts.unhealthy++;
      } else if (failureRate > 0.05 || health.highLatencyEvents > 20) {
        healthyCounts.degraded++;
      } else {
        healthyCounts.healthy++;
      }
    });
    
    return {
      totalConnections,
      totalUploadBandwidth,
      totalDownloadBandwidth,
      totalServers: this.serverHealth.size,
      serverHealth: healthyCounts,
      errorRates: {
        connectionFailures: totalAttempts > 0 ? totalFailures / totalAttempts : 0,
        highLatencyRate: totalAttempts > 0 ? totalHighLatency / totalAttempts : 0
      }
    };
  }
  
  /**
   * Get statistics for a specific server
   */
  getServerStats(serverId: number): {
    connections: number;
    uploadBandwidth: number;
    downloadBandwidth: number;
    health: {
      connectionAttempts: number;
      successfulConnections: number;
      failedConnections: number;
      failureRate: number;
      highLatencyEvents: number;
      averageLatency: number;
      healthStatus: 'healthy' | 'degraded' | 'unhealthy';
    };
  } {
    const connections = this.activeConnections.get(serverId) || 0;
    const { upload, download } = this.bandwidthUsage.get(serverId) || { upload: 0, download: 0 };
    const health = this.getServerHealthMetrics(serverId);
    
    const failureRate = health.connectionAttempts > 0 
      ? health.failedConnections / health.connectionAttempts
      : 0;
    
    // Determine health status
    let healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    if (failureRate > 0.15 || health.highLatencyEvents > 100) {
      healthStatus = 'unhealthy';
    } else if (failureRate > 0.05 || health.highLatencyEvents > 20) {
      healthStatus = 'degraded';
    }
    
    return {
      connections,
      uploadBandwidth: upload,
      downloadBandwidth: download,
      health: {
        connectionAttempts: health.connectionAttempts,
        successfulConnections: health.successfulConnections,
        failedConnections: health.failedConnections,
        failureRate,
        highLatencyEvents: health.highLatencyEvents,
        averageLatency: this.calculateAverageLatency(health.latencyValues),
        healthStatus
      }
    };
  }
}

// Create singletons for use throughout the application
export const vpnLoadBalancer = new VpnLoadBalancer();
export const connectionRateLimiter = new ConnectionRateLimiter();
export const connectionStatistics = new ConnectionStatistics();