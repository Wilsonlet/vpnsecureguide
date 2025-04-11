import { createContext, useContext, useState } from 'react';
import { VpnServer } from '@shared/schema';

export type VpnConnectionState = {
  connected: boolean;
  connectTime: Date | null;
  protocol: string;
  encryption: string;
  killSwitch: boolean;
  dnsLeakProtection: boolean;
  doubleVpn: boolean;
  obfuscation: boolean;
  selectedServer: VpnServer | null;
  availableServers: VpnServer[];
  virtualIp: string;
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
  selectedServer: null,
  availableServers: [],
  virtualIp: generateRandomIp(),
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
  const [state, setState] = useState<VpnConnectionState>({
    connected: false,
    connectTime: null,
    protocol: 'openvpn_tcp',
    encryption: 'aes_256_gcm',
    killSwitch: true,
    dnsLeakProtection: true,
    doubleVpn: false,
    obfuscation: false,
    selectedServer: null,
    availableServers: [],
    virtualIp: generateRandomIp(),
    // New settings with defaults
    autoConnect: false,
    quickConnectType: 'fastest',
    startWithSystem: false,
    splitTunneling: false,
    customDns: false,
    customDnsServer: '1.1.1.1',
  });

  const connect = async (options: {
    serverId: number;
    protocol: string;
    encryption: string;
    server: VpnServer;
  }) => {
    try {
      console.log("VPN Connect called with options:", options);
      
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
        const errorText = await res.text();
        console.error("Error starting VPN session:", errorText);
        throw new Error("Failed to connect to VPN");
      }
      
      const sessionData = await res.json();
      console.log("VPN session started:", sessionData);
      
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
    }
  };

  const disconnect = async () => {
    try {
      console.log("VPN Disconnect called");
      
      // Update state immediately to reflect disconnection attempt
      setState(currentState => ({
        ...currentState,
        connected: false,
        connectTime: null,
      }));
      
      // Send the disconnection request to the server
      const res = await fetch('/api/sessions/end', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error("Error ending VPN session:", errorText);
        throw new Error("Failed to disconnect from VPN");
      }
      
      console.log("VPN session ended successfully");
      return true;
    } catch (error) {
      console.error("VPN disconnect error:", error);
      throw error;
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
