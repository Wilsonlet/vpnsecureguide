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
  updateSettings: (settings: Partial<VpnConnectionState>) => void;
  selectServer: (server: VpnServer) => void;
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

  const selectServer = (server: VpnServer) => {
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

  return (
    <VpnStateContext.Provider
      value={{
        ...state,
        connect,
        disconnect,
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
