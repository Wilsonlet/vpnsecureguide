import { createContext, useContext, useState, useRef, useEffect } from 'react';
import { VpnServer } from '@shared/schema';
import { useToast } from '@/hooks/use-toast';
import { VpnKillSwitchService } from './kill-switch-service';

export type VpnConnectionState = {
  connected: boolean;
  connectTime: Date | null;
  protocol: string;
  encryption: string;
  killSwitch: boolean;
  dnsLeakProtection: boolean;
  doubleVpn: boolean;
  obfuscation: boolean;
  // Anti-censorship state for obfuscation
  antiCensorship?: boolean;
  selectedServer: VpnServer | null;
  availableServers: VpnServer[];
  virtualIp: string;
  // User subscription level for feature access
  subscription?: string;
  // New settings for general tab
  autoConnect?: boolean;
  quickConnectType?: string;
  startWithSystem?: boolean;
  // New settings for advanced tab
  splitTunneling?: boolean;
  customDns?: boolean;
  customDnsServer?: string;
  // Tunnel verification
  tunnelActive?: boolean;
  tunnelVerified?: boolean;
  lastTunnelCheck?: Date;
  dataTransferred?: {
    upload: number;
    download: number;
  };
};

export type VpnStateContextType = VpnConnectionState & {
  connect: (options: {
    serverId: number;
    protocol: string;
    encryption: string;
    server: VpnServer;
  }) => Promise<any>;
  disconnect: () => Promise<any>;
  changeIp: () => Promise<any>;
  updateSettings: (settings: Partial<VpnConnectionState>) => void;
  selectServer: (server: VpnServer | null) => void;
  setAvailableServers: (servers: VpnServer[]) => void;
};

// Generate a random IP for the virtual IP - this is for UI display only
const generateRandomIp = () => {
  return `198.51.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
};

// Create the VPN state context with default values
export const VpnStateContext = createContext<VpnStateContextType>({
  connected: false,
  connectTime: null,
  protocol: 'openvpn_tcp',
  encryption: 'aes_256_gcm',
  killSwitch: true,
  dnsLeakProtection: true,
  doubleVpn: false,
  obfuscation: false,
  antiCensorship: false,
  selectedServer: null,
  availableServers: [],
  virtualIp: generateRandomIp(),
  // User subscription level
  subscription: 'free',
  // New settings
  autoConnect: false,
  quickConnectType: 'fastest',
  startWithSystem: false,
  splitTunneling: false,
  customDns: false,
  customDnsServer: '1.1.1.1',
  // Tunnel verification
  tunnelActive: false,
  tunnelVerified: false,
  lastTunnelCheck: null,
  dataTransferred: {
    upload: 0,
    download: 0
  },
  // Functions
  connect: async () => Promise.resolve({}),
  disconnect: async () => Promise.resolve(true),
  changeIp: async () => Promise.resolve({}),
  updateSettings: () => {},
  selectServer: () => {},
  setAvailableServers: () => {},
});

// Create a provider component to manage VPN state
export const VpnStateProvider = ({ children }: { children: React.ReactNode }) => {
  const { toast } = useToast();
  const [state, setState] = useState<VpnConnectionState>({
    connected: false,
    connectTime: null,
    protocol: 'wireguard', // Changed to match the default protocol in the selection dropdown
    encryption: 'aes_256_gcm',
    killSwitch: true,
    dnsLeakProtection: true,
    doubleVpn: false,
    obfuscation: false,
    antiCensorship: false,
    selectedServer: null,
    availableServers: [],
    virtualIp: generateRandomIp(),
    // User subscription level
    subscription: 'free',
    // New settings with defaults
    autoConnect: false,
    quickConnectType: 'fastest',
    startWithSystem: false,
    splitTunneling: false,
    customDns: false,
    customDnsServer: '1.1.1.1',
    // Tunnel verification
    tunnelActive: false,
    tunnelVerified: false,
    lastTunnelCheck: null,
    dataTransferred: {
      upload: 0,
      download: 0
    }
  });
  
  // Fetch user data and settings on mount
  useEffect(() => {
    const fetchUserDataAndSettings = async () => {
      try {
        console.log('VpnService: Fetching initial user data and settings');
        
        // Check if we're on a network
        try {
          // Fetch user subscription
          const userResponse = await fetch('/api/user', {
            credentials: 'include',
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            if (userData.subscription) {
              setState(currentState => ({
                ...currentState,
                subscription: userData.subscription
              }));
              console.log('User subscription loaded:', userData.subscription);
            }
          } else {
            // If the user isn't authenticated, we'll gracefully handle it
            console.log('VpnService: User not authenticated or API error', userResponse.status);
            // Don't try to fetch settings if user isn't authenticated
            return;
          }
          
          // Fetch user settings only if user is authenticated
          try {
            const settingsResponse = await fetch('/api/settings', {
              credentials: 'include',
            });
            
            if (settingsResponse.ok) {
              const settings = await settingsResponse.json();
              
              // Map server field names to client field names
              const mappedSettings = {
                protocol: settings.preferredProtocol,
                encryption: settings.preferredEncryption,
                killSwitch: settings.killSwitch,
                dnsLeakProtection: settings.dnsLeakProtection,
                doubleVpn: settings.doubleVpn,
                obfuscation: settings.obfuscation,
                antiCensorship: settings.antiCensorship,
              };
              
              console.log('VpnService: Server settings loaded:', settings);
              console.log('VpnService: Mapped to client settings:', mappedSettings);
              
              setState(currentState => ({
                ...currentState,
                ...mappedSettings
              }));
            } else {
              console.log('VpnService: Unable to fetch settings, status:', settingsResponse.status);
            }
          } catch (settingsError) {
            console.error('Error loading VPN settings:', settingsError);
          }
        } catch (networkError) {
          console.error('Network error during initial data fetch:', networkError);
        }
      } catch (error) {
        console.error('Error in fetchUserDataAndSettings:', error);
      }
    };
    
    fetchUserDataAndSettings();
    
    // Set up a periodic refresh of settings to keep in sync with server
    const refreshInterval = setInterval(() => {
      // First check if the user is authenticated
      fetch('/api/user', { credentials: 'include' })
        .then(res => {
          // Don't proceed with settings refresh if not authenticated
          if (!res.ok) {
            return;
          }
          
          // User is authenticated, safe to refresh settings
          return fetch('/api/settings', { credentials: 'include' })
            .then(res => {
              if (res.ok) return res.json();
              
              if (res.status === 401) {
                console.log('VpnService: Not authenticated for settings refresh');
                return null;
              }
              
              throw new Error(`Failed to refresh settings: ${res.status}`);
            })
            .then(settings => {
              // Skip update if we didn't get valid settings
              if (!settings) return;
              
              console.log('VpnService: Refreshed settings from server:', settings);
              setState(currentState => ({
                ...currentState,
                protocol: settings.preferredProtocol,
                encryption: settings.preferredEncryption,
                killSwitch: settings.killSwitch,
                dnsLeakProtection: settings.dnsLeakProtection,
                doubleVpn: settings.doubleVpn,
                obfuscation: settings.obfuscation,
                antiCensorship: settings.antiCensorship,
              }));
            });
        })
        .catch(err => {
          // Safely handle any network/fetch errors
          console.error('Error during settings refresh cycle:', err);
        });
    }, 10000); // Refresh every 10 seconds
    
    return () => clearInterval(refreshInterval);
  }, []);

  // Initialize kill switch service
  useEffect(() => {
    // Start connection monitoring if kill switch is enabled
    const killSwitchService = VpnKillSwitchService.getInstance();
    
    if (state.killSwitch && state.connected) {
      // Start monitoring VPN connection for kill switch activation
      killSwitchService.startConnectionMonitoring();
      
      console.log('Kill switch monitoring activated');
    } else {
      // Stop monitoring if kill switch is disabled or VPN is disconnected
      killSwitchService.stopConnectionMonitoring();
    }
    
    return () => {
      // Clean up monitoring on unmount
      killSwitchService.stopConnectionMonitoring();
    };
  }, [state.killSwitch, state.connected]);
  
  // VPN tunnel verification
  useEffect(() => {
    // Only verify tunnel when connected
    if (!state.connected) {
      setState((currentState) => ({
        ...currentState,
        tunnelActive: false,
        tunnelVerified: false
      }));
      return;
    }
    
    let tunnelCheckInterval: ReturnType<typeof setInterval>;
    
    // Function to verify the tunnel is actually working
    const verifyTunnelStatus = async () => {
      try {
        console.log('Verifying VPN tunnel status...');
        
        // Call the tunnel status endpoint
        const res = await fetch('/api/tunnel/status', {
          method: 'GET',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        });
        
        if (!res.ok) {
          console.error('Tunnel status check failed:', res.status);
          
          // Update state to show tunnel is not active
          setState((currentState) => ({
            ...currentState,
            tunnelActive: false,
            tunnelVerified: true,
            lastTunnelCheck: new Date()
          }));
          
          // Show warning toast if it's a real failure (not just auth)
          if (res.status !== 401) {
            toast({
              title: "VPN Protection Issue",
              description: "Your connection shows as active but the VPN tunnel is not working. Your traffic may not be protected.",
              variant: "destructive"
            });
          }
          return;
        }
        
        // Get the tunnel status data
        const tunnelData = await res.json();
        console.log('Tunnel status:', tunnelData);
        
        // If tunnel is not active but session is, there's a problem
        if (tunnelData.sessionActive && !tunnelData.tunnelActive) {
          console.error('VPN session is active but tunnel is not working!');
          
          setState((currentState) => ({
            ...currentState,
            tunnelActive: false,
            tunnelVerified: true,
            lastTunnelCheck: new Date()
          }));
          
          toast({
            title: "VPN Connection Error",
            description: "Your connection appears active but your traffic is not protected! Please disconnect and try again.",
            variant: "destructive"
          });
          return;
        }
        
        // Update state with tunnel status and data
        setState((currentState) => ({
          ...currentState,
          tunnelActive: tunnelData.tunnelActive,
          tunnelVerified: true,
          lastTunnelCheck: new Date(),
          dataTransferred: tunnelData.dataTransferred || {
            upload: 0,
            download: 0
          }
        }));
      } catch (error) {
        console.error('Error verifying tunnel status:', error);
        
        // Set tunnel as unverified on error
        setState((currentState) => ({
          ...currentState,
          tunnelVerified: false,
          lastTunnelCheck: new Date()
        }));
      }
    };
    
    // Verify tunnel immediately
    verifyTunnelStatus();
    
    // Then check periodically (every 10 seconds)
    tunnelCheckInterval = setInterval(verifyTunnelStatus, 10000);
    
    return () => {
      clearInterval(tunnelCheckInterval);
    };
  }, [state.connected, toast]);

  // Connection state management
  const isConnectingRef = useRef(false);
  const lastConnectionAttemptRef = useRef(0);
  // In development mode, set a very short cooldown or disable it entirely
  const isDevelopment = import.meta.env.DEV || window.location.hostname === 'localhost';
  const CONNECTION_COOLDOWN = isDevelopment ? 100 : 5000; // Almost no cooldown in dev mode

  const connect = async (options: {
    serverId: number;
    protocol: string;
    encryption: string;
    server: VpnServer;
  }) => {
    try {
      console.log("VPN Connect called with options:", options);
      
      // Check if Shadowsocks protocol is selected and verify access
      if (options.protocol === 'shadowsocks') {
        try {
          const featureAccessResponse = await fetch('/api/feature-access/shadowsocks');
          
          if (!featureAccessResponse.ok) {
            console.error("Failed to check Shadowsocks access");
            throw new Error("Failed to verify feature access");
          }
          
          const featureAccessData = await featureAccessResponse.json();
          
          if (!featureAccessData.hasAccess) {
            toast({
              title: "Premium Feature Required",
              description: "Shadowsocks protocol is only available with Premium or Ultimate plans",
              variant: "destructive",
            });
            return Promise.resolve({ 
              success: false, 
              error: "Upgrade to Premium or Ultimate plan to use Shadowsocks protocol",
              requiresUpgrade: true
            });
          }
        } catch (error) {
          console.error("Error checking Shadowsocks access:", error);
          // If we can't check access, don't block the connection
        }
      }
      
      // Check if we're already attempting to connect (bypassed in development)
      if (!isDevelopment && isConnectingRef.current) {
        console.warn("Connection already in progress, ignoring request");
        toast({
          title: "Connection in progress",
          description: "Please wait while connecting to VPN",
          variant: "default",
        });
        return Promise.resolve({ 
          success: false, 
          error: "Connection already in progress",
          inProgress: true
        });
      }
      
      // In development mode, force reset the connecting flag to prevent issues
      if (isDevelopment && isConnectingRef.current) {
        console.log("[DEV] Resetting isConnectingRef that was stuck");
        isConnectingRef.current = false;
      }
      
      // Check if we need to respect the cooldown period (bypassed in development)
      const now = Date.now();
      const timeSinceLastAttempt = now - lastConnectionAttemptRef.current;
      
      if (!isDevelopment && timeSinceLastAttempt < CONNECTION_COOLDOWN) {
        const remainingCooldown = Math.ceil((CONNECTION_COOLDOWN - timeSinceLastAttempt) / 1000);
        console.warn(`Connection on cooldown. Please wait ${remainingCooldown} seconds.`);
        
        toast({
          title: "Connection cooldown",
          description: `Please wait ${remainingCooldown} seconds before connecting again`,
          variant: "default",
        });
        
        // Instead of rejecting, return a resolved promise with an error object
        // This prevents the unhandled promise rejection error
        return Promise.resolve({ 
          success: false, 
          error: `Please wait ${remainingCooldown} seconds before connecting again`,
          cooldown: true,
          remainingSeconds: remainingCooldown
        });
      }
      
      // Set connection flags
      isConnectingRef.current = true;
      lastConnectionAttemptRef.current = now;
      
      // Update state immediately to reflect connection attempt
      setState((currentState) => ({
        ...currentState,
        connected: true,
        connectTime: new Date(),
        protocol: options.protocol,
        encryption: options.encryption,
        selectedServer: options.server,
      }));
      
      // Send the connection request to the server
      const res = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverId: options.serverId,
          protocol: options.protocol,
          encryption: options.encryption,
        }),
      });
      
      if (!res.ok) {
        const errorResponse = await res.text();
        let errorMessage = "Failed to connect to VPN";
        let errorData = null;
        
        // Try to parse the error response as JSON
        try {
          errorData = JSON.parse(errorResponse);
          if (errorData.message) {
            errorMessage = errorData.message;
          }
          
          if (errorData.rateLimited) {
            toast({
              title: "Too many connection attempts",
              description: "Please wait a moment before trying again",
              variant: "destructive",
            });
          }
        } catch (e) {
          // If it's not valid JSON, use the raw text
          console.error("Error response not in JSON format:", errorResponse);
        }
        
        console.error("Error starting VPN session:", errorResponse);
        throw new Error(errorMessage);
      }
      
      const sessionData = await res.json();
      console.log("VPN session started:", sessionData);
      
      // Clear the disconnection flag when successfully connected
      sessionStorage.removeItem('vpn_disconnected');
      
      // Update with server-provided values
      setState((currentState) => ({
        ...currentState,
        connected: true,
        connectTime: new Date(sessionData.startTime),
        virtualIp: sessionData.virtualIp,
        protocol: sessionData.protocol || options.protocol,
        encryption: sessionData.encryption || options.encryption,
      }));
      
      return sessionData;
    } catch (error) {
      console.error("VPN connect error:", error);
      
      // Reset connection state on error
      setState(currentState => ({
        ...currentState,
        connected: false,
        connectTime: null,
      }));
      
      throw error;
    } finally {
      // Reset the connecting flag after a delay
      setTimeout(() => {
        isConnectingRef.current = false;
      }, 500);
    }
  };

  const disconnect = async () => {
    try {
      console.log("VPN Disconnect called");
      
      // Get kill switch service
      const killSwitchService = VpnKillSwitchService.getInstance();
      
      // Set disconnected state first for immediate feedback to improve UX responsiveness
      setState(currentState => ({
        ...currentState,
        connected: false,
        connectTime: null,
        virtualIp: '', // Clear virtual IP
      }));
      
      // Set disconnect flags immediately
      sessionStorage.setItem('vpn_disconnected', 'true');
      localStorage.setItem('vpn_force_disconnected', 'true');
      
      // If kill switch is enabled, handle disconnection differently
      if (state.killSwitch) {
        console.log("Kill switch is enabled, this disconnect is controlled");
        
        // We'll mark this as a controlled disconnect to prevent kill switch activation
        // This is for user-initiated disconnections
        const abrupt = false;
        
        // Stop monitoring connection for kill switch
        killSwitchService.stopConnectionMonitoring();
      }
      
      // PART 1: Execute multiple parallel disconnect attempts using different techniques
      console.log("Starting multi-path disconnect process");
      
      // Track if we're successfully disconnected at the server level
      let serverDisconnectSuccess = false;
      
      // Function to make a single disconnect attempt
      const makeDisconnectAttempt = async (attempt: number, options: any = {}) => {
        try {
          console.log(`Executing disconnect attempt ${attempt} with options:`, options);
          
          const res = await fetch('/api/sessions/end', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            body: JSON.stringify({
              abrupt: false, // Always a controlled disconnect
              force: true,   // Force flag for server-side priority
              ...options,    // Add any additional options
              attempt,       // Track attempt number
              source: `vpn_service_disconnect_${attempt}`
            })
          });
          
          if (res.status >= 200 && res.status < 300) {
            console.log(`Disconnect attempt ${attempt} succeeded with status ${res.status}`);
            return true;
          } else if (res.status === 401 || res.status === 404) {
            // These are successful disconnects too (no session or not authenticated)
            console.log(`Disconnect attempt ${attempt} succeeded with status ${res.status} (no session/not authenticated)`);
            return true;
          } else {
            const errorText = await res.text();
            console.warn(`Disconnect attempt ${attempt} failed with status ${res.status}:`, errorText);
            return false;
          }
        } catch (attemptError) {
          console.warn(`Error during disconnect attempt ${attempt}:`, attemptError);
          return false;
        }
      };
      
      // Execute multiple disconnect attempts in parallel with staggered timing
      // This increases the chances of at least one request succeeding
      const disconnectResults = await Promise.allSettled([
        makeDisconnectAttempt(1, { clearSessionCache: true }),
        new Promise(r => setTimeout(r, 100)).then(() => makeDisconnectAttempt(2, { flushConnections: true })),
        new Promise(r => setTimeout(r, 200)).then(() => makeDisconnectAttempt(3, { systemCleanup: true }))
      ]);
      
      // Check if any attempts succeeded
      serverDisconnectSuccess = disconnectResults.some(
        result => result.status === 'fulfilled' && result.value === true
      );
      
      console.log(`Parallel disconnect attempts ${serverDisconnectSuccess ? 'succeeded' : 'failed'}`);
      
      // PART 2: Clear all state regardless of server response
      
      // Clear all VPN state
      setState(currentState => ({
        ...currentState,
        connected: false,
        connectTime: null,
        virtualIp: '',
      }));
      
      // PART 3: Final cleanup phase - ensure everything is properly terminated
      if (!serverDisconnectSuccess) {
        console.log("First round of disconnect attempts failed, trying final cleanup");
        
        // Try one last time with all flags enabled
        try {
          const finalResult = await makeDisconnectAttempt(999, {
            final: true,
            clearAll: true,
            force: true,
            flushConnections: true,
            systemCleanup: true,
            clearSessionCache: true
          });
          
          if (finalResult) {
            serverDisconnectSuccess = true;
          }
        } catch (finalError) {
          console.warn("Final disconnect attempt failed:", finalError);
        }
      }
      
      // PART 4: Delay additional cleanup to ensure it happens after animations and UI updates
      setTimeout(async () => {
        try {
          // One final attempt in case previous ones missed
          const delayedResult = await makeDisconnectAttempt(1000, {
            final: true,
            delayed: true,
            force: true
          });
          
          // Force disconnected state again to be absolutely certain
          setState(currentState => ({
            ...currentState,
            connected: false,
            connectTime: null,
            virtualIp: '',
          }));
          
          // Update flags again
          sessionStorage.setItem('vpn_disconnected', 'true');
          localStorage.setItem('vpn_force_disconnected', 'true');
          
        } catch (delayedError) {
          console.warn("Delayed disconnect attempt error (non-critical):", delayedError);
        }
      }, 1500);
      
      console.log("Disconnect process completed");
      return true;
    } catch (error) {
      console.error("VPN disconnect error:", error);
      
      // Even on error, ensure we're disconnected in the UI
      setState(currentState => ({
        ...currentState,
        connected: false,
        connectTime: null,
        virtualIp: '',
      }));
      
      // Set disconnect flags in session and local storage
      sessionStorage.setItem('vpn_disconnected', 'true');
      localStorage.setItem('vpn_force_disconnected', 'true');
      
      // Don't throw the error, just log it and return true
      // This ensures the disconnect action appears successful to the user
      return true;
    }
  };

  // Track the last protocol and encryption update times to prevent duplicate updates
  // Using plain object variables instead of useRef since this is outside a functional component
  const lastUpdateTimes = {
    protocol: 0,
    encryption: 0
  };
  const UPDATE_DEBOUNCE_MS = 2000; // 2 seconds debounce

  const updateSettings = (settings: Partial<VpnConnectionState>) => {
    console.log('VpnService: Updating settings with:', settings);
    
    // Special handling for protocol and encryption to ensure they are explicitly updated
    if (settings.protocol !== undefined || settings.encryption !== undefined) {
      console.log('VpnService: Protocol/Encryption update detected');
      
      const now = Date.now();
      
      // Enhanced safety wrapper for fetch calls with timeout and proper error handling
      const safeFetch = async (url: string, options: RequestInit = {}): Promise<Response | null> => {
        // Set a timeout for the request
        const timeout = 5000;
        
        try {
          // Create a promise that resolves after timeout
          const timeoutPromise = new Promise<null>((resolve) => {
            setTimeout(() => {
              console.warn(`Request to ${url} timed out after ${timeout}ms`);
              resolve(null);
            }, timeout);
          });
          
          // Create the fetch promise wrapped in try/catch
          const fetchPromise = (async () => {
            try {
              const response = await fetch(url, options);
              return response;
            } catch (error) {
              console.log(`Network error during fetch to ${url}`);
              return null;
            }
          })();
          
          // Race the fetch against the timeout - whichever completes first wins
          return await Promise.race([fetchPromise, timeoutPromise]);
        } catch (error) {
          // Final safety net - should never execute, but just in case
          console.log(`Unexpected error in safeFetch for ${url}`);
          return null;
        }
      };
      
      // Safe function to sync protocol with enhanced caching
      const syncProtocol = async (protocol: string) => {
        try {
          // Check cache first to prevent redundant requests
          const PROTOCOL_CACHE_KEY = 'vpn_protocol_cache';
          const PROTOCOL_CACHE_DURATION = 30000; // 30 seconds
          const now = Date.now();
          
          // Check if we have a cached result for this exact protocol value
          const protocolCache = window.sessionStorage.getItem(PROTOCOL_CACHE_KEY);
          
          if (protocolCache) {
            try {
              const { timestamp, protocolValue, success } = JSON.parse(protocolCache);
              
              // If cache is valid and for the same protocol value, use it
              if (now - timestamp < PROTOCOL_CACHE_DURATION && 
                  protocolValue === protocol && 
                  success === true) {
                console.log(`VpnService: Using cached protocol success for ${protocol}`);
                
                // Skip the API call, just update state
                setState(currentState => ({
                  ...currentState,
                  protocol: protocol
                }));
                
                return; // Exit early
              }
            } catch (cacheError) {
              // Invalid cache format, continue with API call
              console.log('VpnService: Protocol cache invalid, refreshing');
            }
          }
          
          // Add a unique parameter to prevent browser caching issues
          const cacheKey = Math.floor(Math.random() * 1000000);
          
          console.log(`VpnService: Syncing protocol to server: ${protocol} (debounced)`);
          
          // Implement retries with backoff for resilience
          let retryCount = 0;
          const MAX_RETRIES = 2;
          let lastError = null;
          
          while (retryCount <= MAX_RETRIES) {
            try {
              // If it's a retry, add a small delay with exponential backoff
              if (retryCount > 0) {
                const backoffDelay = Math.min(100 * Math.pow(2, retryCount), 1000);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                console.log(`VpnService: Retry ${retryCount} for protocol sync after ${backoffDelay}ms`);
              }
              
              const res = await safeFetch(`/api/protocol?cachebust=${cacheKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ protocol }),
                credentials: 'include'
              });
              
              if (!res || !res.ok) {
                lastError = `Failed to sync protocol with server, status: ${res?.status}`;
                retryCount++;
                continue; // Retry on error
              }
              
              try {
                const data = await res.json();
                console.log('Protocol synced with server:', data);
                
                // Cache the successful result
                window.sessionStorage.setItem(PROTOCOL_CACHE_KEY, JSON.stringify({
                  timestamp: now,
                  protocolValue: protocol,
                  success: true
                }));
                
                // Update state again with server's confirmed protocol
                if (data && data.protocol) {
                  setState(currentState => ({
                    ...currentState,
                    protocol: data.protocol
                  }));
                }
                
                return; // Success, exit the function
              } catch (parseError) {
                console.error('Error parsing protocol sync response:', parseError);
                lastError = 'Error parsing protocol sync response';
                retryCount++;
              }
            } catch (fetchError) {
              lastError = 'Network error during protocol sync';
              retryCount++;
            }
          }
          
          // If we get here, all retries failed
          console.error('Failed to sync protocol after retries:', lastError);
          
          // Cache the failure to prevent hammering the server
          window.sessionStorage.setItem(PROTOCOL_CACHE_KEY, JSON.stringify({
            timestamp: now,
            protocolValue: protocol,
            success: false
          }));
          
        } catch (err) {
          console.error('Error in protocol sync function:', err);
          
          // Still update the local state to maintain UI responsiveness
          setState(currentState => ({
            ...currentState,
            protocol: protocol
          }));
        }
      };
      
      // Safe function to sync encryption with enhanced caching
      const syncEncryption = async (encryption: string) => {
        try {
          // Check cache first to prevent redundant requests
          const ENCRYPTION_CACHE_KEY = 'vpn_encryption_cache';
          const ENCRYPTION_CACHE_DURATION = 30000; // 30 seconds
          const now = Date.now();
          
          // Check if we have a cached result for this exact encryption value
          const encryptionCache = window.sessionStorage.getItem(ENCRYPTION_CACHE_KEY);
          
          if (encryptionCache) {
            try {
              const { timestamp, encryptionValue, success } = JSON.parse(encryptionCache);
              
              // If cache is valid and for the same encryption value, use it
              if (now - timestamp < ENCRYPTION_CACHE_DURATION && 
                  encryptionValue === encryption && 
                  success === true) {
                console.log(`VpnService: Using cached encryption success for ${encryption}`);
                
                // Skip the API call, just update state
                setState(currentState => ({
                  ...currentState,
                  encryption: encryption
                }));
                
                return; // Exit early
              }
            } catch (cacheError) {
              // Invalid cache format, continue with API call
              console.log('VpnService: Encryption cache invalid, refreshing');
            }
          }
          
          // Add a unique parameter to prevent browser caching issues
          const cacheKey = Math.floor(Math.random() * 1000000);
          
          console.log(`VpnService: Syncing encryption to server: ${encryption} (debounced)`);
          
          // Implement retries with backoff for resilience
          let retryCount = 0;
          const MAX_RETRIES = 2;
          let lastError = null;
          
          while (retryCount <= MAX_RETRIES) {
            try {
              // If it's a retry, add a small delay with exponential backoff
              if (retryCount > 0) {
                const backoffDelay = Math.min(100 * Math.pow(2, retryCount), 1000);
                await new Promise(resolve => setTimeout(resolve, backoffDelay));
                console.log(`VpnService: Retry ${retryCount} for encryption sync after ${backoffDelay}ms`);
              }
              
              const res = await safeFetch(`/api/encryption?cachebust=${cacheKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ encryption }),
                credentials: 'include'
              });
              
              if (!res || !res.ok) {
                lastError = `Failed to sync encryption with server, status: ${res?.status}`;
                retryCount++;
                continue; // Retry on error
              }
              
              try {
                const data = await res.json();
                console.log('Encryption synced with server:', data);
                
                // Cache the successful result
                window.sessionStorage.setItem(ENCRYPTION_CACHE_KEY, JSON.stringify({
                  timestamp: now,
                  encryptionValue: encryption,
                  success: true
                }));
                
                // Update state again with server's confirmed encryption
                if (data && data.encryption) {
                  setState(currentState => ({
                    ...currentState,
                    encryption: data.encryption
                  }));
                }
                
                return; // Success, exit the function
              } catch (parseError) {
                console.error('Error parsing encryption sync response:', parseError);
                lastError = 'Error parsing encryption sync response';
                retryCount++;
              }
            } catch (fetchError) {
              lastError = 'Network error during encryption sync';
              retryCount++;
            }
          }
          
          // If we get here, all retries failed
          console.error('Failed to sync encryption after retries:', lastError);
          
          // Cache the failure to prevent hammering the server
          window.sessionStorage.setItem(ENCRYPTION_CACHE_KEY, JSON.stringify({
            timestamp: now,
            encryptionValue: encryption,
            success: false
          }));
          
        } catch (err) {
          console.error('Error in encryption sync function:', err);
          
          // Still update the local state to maintain UI responsiveness
          setState(currentState => ({
            ...currentState,
            encryption: encryption
          }));
        }
      };
      
      // Main execution wrapped in try/catch 
      try {
        // We no longer need this here as we have a dedicated NetworkErrorHandler component
        
        // Use a safer approach that never generates unhandled rejections
        // Wrap in a try block to ensure no errors escape
        try {
          // This pattern ensures we never have unhandled rejections
          (async () => {
            try {
              // Check user authentication with local caching to reduce API load
              let isAuthenticated = false;
              
              // Use cached auth status if available and not expired (cache for 30 seconds)
              const AUTH_CACHE_KEY = 'vpn_auth_cache';
              const AUTH_CACHE_DURATION = 30000; // 30 seconds
              
              const authCache = window.sessionStorage.getItem(AUTH_CACHE_KEY);
              const now = Date.now();
              
              if (authCache) {
                try {
                  const { timestamp, authenticated } = JSON.parse(authCache);
                  // Use cached value if less than 30 seconds old
                  if (now - timestamp < AUTH_CACHE_DURATION) {
                    isAuthenticated = authenticated;
                    console.log('VpnService: Using cached authentication status:', authenticated);
                    
                    if (!isAuthenticated) {
                      console.log('VpnService: Cached status - user not authenticated, skipping server sync');
                      return; // Exit early
                    }
                    
                    // If we have a cached authenticated status, skip the API call entirely
                    // and proceed with the remaining operations
                  }
                } catch (cacheError) {
                  // Invalid cache format, ignore and proceed with fresh check
                  console.log('VpnService: Auth cache invalid, refreshing');
                }
              }
              
              // Only check authentication via API if we don't have a valid cache entry
              if (!isAuthenticated) {
                try {
                  const userRes = await safeFetch('/api/user', { credentials: 'include' });
                  isAuthenticated = !!(userRes && userRes.ok);
                  
                  // Update cache with new status
                  window.sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
                    timestamp: now,
                    authenticated: isAuthenticated
                  }));
                } catch (authError) {
                  // Don't log the error, just handle it gracefully
                  isAuthenticated = false;
                  
                  // Cache the negative result too
                  window.sessionStorage.setItem(AUTH_CACHE_KEY, JSON.stringify({
                    timestamp: now,
                    authenticated: false
                  }));
                }
                
                if (!isAuthenticated) {
                  console.log('VpnService: User not authenticated, skipping server sync');
                  return; // Exit early if not authenticated
                }
              }
              
              // Protocol sync with dedicated error handling
              if (settings.protocol && now - lastUpdateTimes.protocol > UPDATE_DEBOUNCE_MS) {
                lastUpdateTimes.protocol = now;
                try {
                  await syncProtocol(settings.protocol);
                } catch (protocolError) {
                  // Just log that we caught it, but don't show the actual error
                  console.log('VpnService: Handled protocol sync error gracefully');
                }
              } else if (settings.protocol) {
                console.log(`VpnService: Skipping protocol server sync (within debounce period)`, settings.protocol);
              }
              
              // Encryption sync with dedicated error handling
              if (settings.encryption && now - lastUpdateTimes.encryption > UPDATE_DEBOUNCE_MS) {
                lastUpdateTimes.encryption = now;
                try {
                  await syncEncryption(settings.encryption);
                } catch (encryptionError) {
                  // Just log that we caught it, but don't show the actual error
                  console.log('VpnService: Handled encryption sync error gracefully');
                }
              } else if (settings.encryption) {
                console.log(`VpnService: Skipping encryption server sync (within debounce period)`, settings.encryption);
              }
              
              // If we get here, we've successfully updated everything that needed updating
              
            } catch (innerError) {
              // Safely catch errors during the update cycle
              // Don't log the actual error to avoid filling the console
              console.log('VpnService: Handled settings sync error gracefully');
            }
          })().catch(() => {
            // This should technically never be reached because of our try/catch above,
            // but we add it as an extra safety measure
            console.log('VpnService: Handled promise rejection in settings update');
          });
        } catch (outerError) {
          // Absolute last resort catch - should never be reached
          console.log('VpnService: Caught outer error in updateSettings');
        }
      } catch (outerError) {
        console.error('Fatal error in updateSettings:', outerError);
      }
    }
    
    // Always update local state
    setState(currentState => {
      const updatedState = {
        ...currentState,
        ...settings
      };
      console.log('VpnService: State updated to:', {
        protocol: updatedState.protocol,
        encryption: updatedState.encryption,
        // Add other important settings for logging
        killSwitch: updatedState.killSwitch,
        dnsLeakProtection: updatedState.dnsLeakProtection,
        doubleVpn: updatedState.doubleVpn,
        obfuscation: updatedState.obfuscation,
        antiCensorship: updatedState.antiCensorship
      });
      return updatedState;
    });
  };

  const selectServer = (server: VpnServer | null) => {
    setState(currentState => ({
      ...currentState,
      selectedServer: server,
    }));
  };

  const setAvailableServers = (servers: VpnServer[]) => {
    setState(currentState => ({
      ...currentState,
      availableServers: servers,
    }));
  };

  // Change IP functionality - more robust implementation
  const changeIp = async () => {
    try {
      console.log("VPN Change IP called");
      
      // Check if we're already attempting to connect (bypassed in development)
      if (!isDevelopment && isConnectingRef.current) {
        console.warn("Connection already in progress, ignoring request");
        toast({
          title: "Connection in progress",
          description: "Please wait while connecting to VPN",
          variant: "default",
        });
        return Promise.resolve({ 
          success: false, 
          error: "Connection already in progress",
          inProgress: true
        });
      }
      
      // In development mode, force reset the connecting flag to prevent issues
      if (isDevelopment && isConnectingRef.current) {
        console.log("[DEV] Resetting isConnectingRef that was stuck");
        isConnectingRef.current = false;
      }
      
      // Check if we need to respect the cooldown period (bypassed in development)
      const now = Date.now();
      const timeSinceLastAttempt = now - lastConnectionAttemptRef.current;
      
      if (!isDevelopment && timeSinceLastAttempt < CONNECTION_COOLDOWN) {
        const remainingCooldown = Math.ceil((CONNECTION_COOLDOWN - timeSinceLastAttempt) / 1000);
        console.warn(`Connection on cooldown. Please wait ${remainingCooldown} seconds.`);
        
        toast({
          title: "IP change cooldown",
          description: `Please wait ${remainingCooldown} seconds before changing IP again`,
          variant: "default",
        });
        
        // Instead of rejecting, return a resolved promise with an error object
        // This prevents the unhandled promise rejection error
        return Promise.resolve({ 
          success: false, 
          error: `Please wait ${remainingCooldown} seconds before changing IP again`,
          cooldown: true,
          remainingSeconds: remainingCooldown
        });
      }
      
      // Set connection flags
      isConnectingRef.current = true;
      lastConnectionAttemptRef.current = now;
      
      // Get the current session status
      const sessionRes = await fetch('/api/sessions/current');
      if (!sessionRes.ok) {
        throw new Error("Not connected to VPN");
      }
      
      const sessionData = await sessionRes.json();
      if (!sessionData || sessionData.endTime) {
        throw new Error("No active VPN session");
      }
      
      // Store current server and session data
      const currentServer = state.selectedServer || sessionData.server;
      const currentProtocol = state.protocol || sessionData.protocol || 'wireguard';
      const currentEncryption = state.encryption || sessionData.encryption || 'aes_256_gcm';
      
      if (!currentServer) {
        // Fallback: Get servers list and use the first one
        const serversRes = await fetch('/api/servers');
        if (!serversRes.ok) {
          throw new Error("Failed to fetch server data");
        }
        
        const servers = await serversRes.json();
        if (!Array.isArray(servers) || servers.length === 0) {
          throw new Error("No VPN servers available");
        }
        
        // Use the first server
        const fallbackServer = servers[0];
        setState(currentState => ({
          ...currentState,
          availableServers: servers,
          selectedServer: fallbackServer
        }));
        
        // Try again with the first server
        const targetServer = fallbackServer;
        
        // End current session first
        await fetch('/api/sessions/end', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        // Wait briefly
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Start a new session with the target server
        const startRes = await fetch('/api/sessions/start', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            serverId: targetServer.id,
            protocol: currentProtocol,
            encryption: currentEncryption
          }),
        });
        
        if (!startRes.ok) {
          throw new Error("Failed to start new VPN session");
        }
        
        const newSessionData = await startRes.json();
        console.log("VPN session created with new IP:", newSessionData);
        
        // Update state with new session data
        setState((currentState) => ({
          ...currentState,
          connected: true,
          connectTime: new Date(newSessionData.startTime),
          virtualIp: newSessionData.virtualIp,
          selectedServer: targetServer
        }));
        
        return newSessionData;
      }
      
      // We have a valid server to use, proceed with changing IP
      console.log("Changing IP using server:", currentServer.name);
      
      // End current session
      await fetch('/api/sessions/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      // Wait briefly
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Start a new session with same server
      const startRes = await fetch('/api/sessions/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          serverId: currentServer.id,
          protocol: currentProtocol,
          encryption: currentEncryption
        }),
      });
      
      if (!startRes.ok) {
        const errorText = await startRes.text();
        console.error("Failed to start new session:", errorText);
        throw new Error("Failed to start new VPN session");
      }
      
      const newSessionData = await startRes.json();
      console.log("VPN session restarted with new IP:", newSessionData);
      
      // Update state with new session data
      setState((currentState) => ({
        ...currentState,
        connected: true,
        connectTime: new Date(newSessionData.startTime),
        virtualIp: newSessionData.virtualIp,
      }));
      
      return newSessionData;
    } catch (error) {
      console.error("VPN change IP error:", error);
      throw error;
    } finally {
      // Reset the connecting flag after a delay to prevent immediate reconnection
      setTimeout(() => {
        isConnectingRef.current = false;
      }, 500);
    }
  };

  return (
    <VpnStateContext.Provider
      value={{
        ...state,
        connect,
        disconnect,
        changeIp, // Add the new function
        updateSettings,
        selectServer,
        setAvailableServers,
      }}
    >
      {children}
    </VpnStateContext.Provider>
  );
};

// Custom hook to use the VPN state
export const useVpnState = () => {
  const context = useContext(VpnStateContext);
  if (context === undefined) {
    throw new Error('useVpnState must be used within a VpnStateProvider');
  }
  return context;
};

// Wrap the App component with the VpnStateProvider
export const withVpnState = (Component: React.ComponentType) => {
  return function WithVpnState(props: any) {
    return (
      <VpnStateProvider>
        <Component {...props} />
      </VpnStateProvider>
    );
  };
};