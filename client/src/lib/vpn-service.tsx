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
  });

  const connect = (options: {
    serverId: number;
    protocol: string;
    encryption: string;
    server: VpnServer;
  }) => {
    setState({
      ...state,
      connected: true,
      connectTime: new Date(),
      protocol: options.protocol,
      encryption: options.encryption,
      selectedServer: options.server,
      virtualIp: generateRandomIp(),
    });
  };

  const disconnect = () => {
    setState({
      ...state,
      connected: false,
      connectTime: null,
    });
  };

  const updateSettings = (settings: Partial<VpnConnectionState>) => {
    setState({
      ...state,
      ...settings,
    });
  };

  const selectServer = (server: VpnServer) => {
    setState({
      ...state,
      selectedServer: server,
    });
  };

  const setAvailableServers = (servers: VpnServer[]) => {
    setState({
      ...state,
      availableServers: servers,
    });
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
