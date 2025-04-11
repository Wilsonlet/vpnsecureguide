/**
 * VPN Kill Switch Service
 * 
 * This service implements the VPN kill switch functionality that blocks all internet traffic
 * when the VPN connection drops unexpectedly. This prevents IP leaks and ensures security.
 * 
 * The service uses the Singleton pattern to ensure only one instance exists across the application.
 */

import { apiRequest } from './queryClient';

// Type for listener functions
type KillSwitchListener = () => void;

export class VpnKillSwitchService {
  private static instance: VpnKillSwitchService;
  private active: boolean = false;
  private activatedAt: Date | null = null;
  private listeners: KillSwitchListener[] = [];
  private connectionMonitorInterval: number | null = null;
  private lastPingSuccess: number = 0;
  private pingFailCount: number = 0;
  
  // Private constructor enforces the Singleton pattern
  private constructor() {
    // Check local storage for persistent kill switch state
    const storedState = localStorage.getItem('vpn_kill_switch_state');
    if (storedState) {
      try {
        const { active, activatedAt } = JSON.parse(storedState);
        this.active = active;
        this.activatedAt = activatedAt ? new Date(activatedAt) : null;
      } catch (e) {
        console.error('Error restoring kill switch state:', e);
      }
    }
    
    // Attempt to get state from server on init
    this.refreshStateFromServer();
  }
  
  /**
   * Get the singleton instance
   */
  public static getInstance(): VpnKillSwitchService {
    if (!VpnKillSwitchService.instance) {
      VpnKillSwitchService.instance = new VpnKillSwitchService();
    }
    return VpnKillSwitchService.instance;
  }
  
  /**
   * Check if kill switch is currently active
   */
  public isActive(): boolean {
    return this.active;
  }
  
  /**
   * Get the time when kill switch was activated
   */
  public getActivationTime(): Date | null {
    return this.activatedAt;
  }
  
  /**
   * Activate the kill switch
   * This will block all non-VPN internet traffic
   */
  public async activate(): Promise<boolean> {
    try {
      // Call the server API to activate kill switch
      const response = await apiRequest('POST', '/api/killswitch/activate', {});
      
      if (response.ok) {
        this.setActive(true);
        return true;
      } else {
        console.error('Failed to activate kill switch:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('Error activating kill switch:', error);
      
      // For demo mode, still activate locally even if server fails
      if (import.meta.env.DEV) {
        console.log('[DEV] Activating kill switch in demo mode despite server error');
        this.setActive(true);
        return true;
      }
      
      return false;
    }
  }
  
  /**
   * Deactivate the kill switch
   * This will restore normal internet traffic
   */
  public async deactivate(): Promise<boolean> {
    try {
      // Call the server API to deactivate kill switch
      const response = await apiRequest('POST', '/api/killswitch/deactivate', {});
      
      if (response.ok) {
        this.setActive(false);
        return true;
      } else {
        console.error('Failed to deactivate kill switch:', await response.text());
        return false;
      }
    } catch (error) {
      console.error('Error deactivating kill switch:', error);
      
      // For demo mode, still deactivate locally even if server fails
      if (import.meta.env.DEV) {
        console.log('[DEV] Deactivating kill switch in demo mode despite server error');
        this.setActive(false);
        return true;
      }
      
      return false;
    }
  }
  
  /**
   * Start monitoring VPN connection
   * Will activate kill switch if connection drops
   */
  public startConnectionMonitoring(settings: {
    checkInterval?: number,
    failThreshold?: number
  } = {}): void {
    if (this.connectionMonitorInterval) {
      // Already monitoring
      return;
    }
    
    const { 
      checkInterval = 5000, // Check every 5 seconds by default
      failThreshold = 3     // Activate after 3 consecutive failed checks
    } = settings;
    
    // Store initial time
    this.lastPingSuccess = Date.now();
    this.pingFailCount = 0;
    
    // Start monitoring interval
    this.connectionMonitorInterval = window.setInterval(() => {
      this.checkVpnConnection().catch(err => {
        console.error('Error checking VPN connection:', err);
        this.pingFailCount++;
        
        if (this.pingFailCount >= failThreshold) {
          this.handleConnectionFailure();
        }
      });
    }, checkInterval);
    
    console.log('VPN connection monitoring started');
  }
  
  /**
   * Stop monitoring VPN connection
   */
  public stopConnectionMonitoring(): void {
    if (this.connectionMonitorInterval) {
      window.clearInterval(this.connectionMonitorInterval);
      this.connectionMonitorInterval = null;
      console.log('VPN connection monitoring stopped');
    }
  }
  
  /**
   * Subscribe to kill switch state changes
   * Returns an unsubscribe function
   */
  public subscribe(listener: KillSwitchListener): () => void {
    this.listeners.push(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }
  
  /**
   * Refresh kill switch state from server
   * Used to synchronize client state with server state
   */
  private async refreshStateFromServer(): Promise<void> {
    try {
      const response = await apiRequest('GET', '/api/killswitch/status', {});
      
      if (response.ok) {
        const { active, activatedAt } = await response.json();
        
        // Only update if state is different
        if (this.active !== active) {
          this.setActive(active, activatedAt ? new Date(activatedAt) : null);
        }
      }
    } catch (error) {
      console.warn('Error fetching kill switch state from server:', error);
    }
  }
  
  /**
   * Set kill switch active state
   * This is a private method to ensure state changes go through the proper methods
   */
  private setActive(active: boolean, timestamp: Date | null = null): void {
    const previousState = this.active;
    this.active = active;
    
    if (active) {
      this.activatedAt = timestamp || new Date();
    } else {
      this.activatedAt = null;
    }
    
    // Update local storage
    localStorage.setItem('vpn_kill_switch_state', JSON.stringify({
      active: this.active,
      activatedAt: this.activatedAt
    }));
    
    // Notify listeners if state changed
    if (previousState !== active) {
      this.notifyListeners();
    }
  }
  
  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('Error in kill switch listener:', error);
      }
    });
  }
  
  /**
   * Check VPN connection by pinging VPN server
   */
  private async checkVpnConnection(): Promise<void> {
    try {
      // Ping VPN server through secure connection
      const response = await fetch('/api/vpn/ping', { 
        method: 'GET',
        cache: 'no-store',
        headers: { 'X-Ping-Time': Date.now().toString() }
      });
      
      if (response.ok) {
        // Success - reset fail counter
        this.lastPingSuccess = Date.now();
        this.pingFailCount = 0;
      } else {
        // Server error
        this.pingFailCount++;
        console.warn(`VPN ping failed (${this.pingFailCount}): ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      // Network error - likely VPN disconnect
      this.pingFailCount++;
      console.warn(`VPN connectivity error (${this.pingFailCount}):`, error);
      throw error;
    }
  }
  
  /**
   * Handle VPN connection failure
   * This activates kill switch if enabled
   */
  private async handleConnectionFailure(): Promise<void> {
    console.warn(`VPN connection failure detected (${this.pingFailCount} consecutive failures)`);
    
    // Verify we're still failing
    try {
      await this.checkVpnConnection();
      // If we get here, connection is back
      console.log('VPN connection restored before activating kill switch');
      return;
    } catch (error) {
      // Still failing, proceed with kill switch activation
    }
    
    // Check if kill switch is enabled in settings
    try {
      const settingsResponse = await apiRequest('GET', '/api/settings', {});
      if (settingsResponse.ok) {
        const settings = await settingsResponse.json();
        
        if (settings.killSwitch) {
          console.warn('Activating kill switch due to VPN connection failure');
          await this.activate();
        } else {
          console.warn('Kill switch is disabled in settings, not activating despite connection failure');
        }
      }
    } catch (error) {
      console.error('Error checking kill switch settings:', error);
      
      // In DEV mode, activate kill switch anyway for demo purposes
      if (import.meta.env.DEV) {
        console.log('[DEV] Activating kill switch in demo mode despite settings error');
        await this.activate();
      }
    }
  }
}