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
    // New settings with defaults
    autoConnect: false,
    quickConnectType: 'fastest',
    startWithSystem: false,
    splitTunneling: false,
    customDns: false,
    customDnsServer: '1.1.1.1',
  });
  
  // Fetch user data and settings on mount
  useEffect(() => {
    const fetchUserDataAndSettings = async () => {
      try {
        // Fetch user subscription
        const userResponse = await fetch('/api/user');
        if (userResponse.ok) {
          const userData = await userResponse.json();
          if (userData.subscription) {
            setState(currentState => ({
              ...currentState,
              subscription: userData.subscription
            }));
            console.log('User subscription loaded:', userData.subscription);
          }
        }
        
        // Fetch user settings 
        try {
          const settingsResponse = await fetch('/api/settings', {
            credentials: 'include',
          });
          
          if (settingsResponse.ok) {
            const settings = await settingsResponse.json();
            setState(currentState => ({
              ...currentState,
              // Update connection settings - use server values exactly as they are
              protocol: settings.preferredProtocol,
              encryption: settings.preferredEncryption,
              killSwitch: settings.killSwitch,
              dnsLeakProtection: settings.dnsLeakProtection,
              doubleVpn: settings.doubleVpn,
              obfuscation: settings.obfuscation,
              antiCensorship: settings.antiCensorship,
            }));
            console.log('VPN settings loaded from server:', settings);
          }
        } catch (settingsError) {
          console.error('Error loading VPN settings:', settingsError);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };
    
    fetchUserDataAndSettings();
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

  const updateSettings = (settings: Partial<VpnConnectionState>) => {
    setState(currentState => ({
      ...currentState,
      ...settings,
    }));
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