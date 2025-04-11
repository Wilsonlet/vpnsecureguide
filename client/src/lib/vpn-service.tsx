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
  }) => void;
  disconnect: () => void;
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
  connect: () => {},
  disconnect: () => {},
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

  const connect = (options: {
    serverId: number;
    protocol: string;
    encryption: string;
    server: VpnServer;
  }) => {
    // Use the existing virtualIp if already set by updateSettings
    // This prevents the UI from displaying a random IP that differs from the one
    // assigned by the server
    setState((currentState) => ({
      ...currentState,
      connected: true,
      connectTime: currentState.connectTime || new Date(),
      protocol: options.protocol,
      encryption: options.encryption,
      selectedServer: options.server,
      // Only generate a random IP if there isn't one already set
      virtualIp: currentState.virtualIp || generateRandomIp(),
    }));
  };

  const disconnect = () => {
    setState(currentState => ({
      ...currentState,
      connected: false,
      connectTime: null,
    }));
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
