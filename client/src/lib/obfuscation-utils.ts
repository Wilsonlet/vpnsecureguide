import { apiRequest } from './queryClient';

/**
 * Utility functions for handling VPN obfuscation and anti-censorship features
 */

export enum ObfuscationMethod {
  NONE = 'none',
  STUNNEL = 'stunnel',
  OBFS4 = 'obfs4',
  SHADOWSOCKS = 'shadowsocks',
  CLOAK = 'cloak',
  SNI = 'sni',
  V2RAY = 'v2ray',
  WEBSOCKET = 'websocket'
}

export enum AntiCensorshipStrategy {
  DOMAIN_FRONTING = 'domain_fronting',
  BRIDGE_RELAY = 'bridge_relay',
  SCRAMBLESUIT = 'scramblesuit',
  MEEK = 'meek'
}

export type ObfuscationConfig = {
  method: ObfuscationMethod;
  port: number;
  options: Record<string, any>;
  serverIp: string;
  serverId: number;
  serverName: string;
  serverCountry: string;
  clientConfig: Record<string, any>;
};

export type AntiCensorshipConfig = {
  strategy: AntiCensorshipStrategy;
  options: {
    frontDomains?: string[];
    entryPoints: string[];
    fallbackProtocol: string;
    bridgeType?: string;
  };
};

/**
 * Get available obfuscation methods for the specified protocol
 * @param protocol - The VPN protocol (e.g., 'openvpn_tcp', 'wireguard')
 * @returns Array of available obfuscation methods and access information
 */
export async function getAvailableObfuscationMethods(protocol: string): Promise<{
  methods: ObfuscationMethod[];
  hasAccess: boolean;
  protocol: string;
}> {
  try {
    const response = await apiRequest('GET', `/api/obfuscation/methods/${protocol}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching obfuscation methods:', error);
    return {
      methods: [ObfuscationMethod.NONE],
      hasAccess: false,
      protocol
    };
  }
}

/**
 * Get obfuscation configuration for connecting to a specific server with a specific protocol
 * @param protocol - The VPN protocol
 * @param serverId - The ID of the VPN server
 * @returns Obfuscation configuration or null if not available
 */
export async function getObfuscationConfig(
  protocol: string,
  serverId: number
): Promise<ObfuscationConfig | null> {
  try {
    const response = await apiRequest('GET', `/api/obfuscation/config/${protocol}/${serverId}`);
    if (!response.ok) {
      if (response.status === 403) {
        console.warn('Premium feature access required for obfuscation');
        return null;
      }
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching obfuscation config:', error);
    return null;
  }
}

/**
 * Get anti-censorship configuration based on user's location or subscription
 * @param countryCode - Optional country code to get region-specific configuration
 * @returns Anti-censorship configuration or null if not available
 */
export async function getAntiCensorshipConfig(
  countryCode?: string
): Promise<AntiCensorshipConfig | null> {
  try {
    const url = countryCode
      ? `/api/anti-censorship/config?country=${countryCode}`
      : '/api/anti-censorship/config';
      
    const response = await apiRequest('GET', url);
    if (!response.ok) {
      if (response.status === 403) {
        console.warn('Premium feature access required for anti-censorship');
        return null;
      }
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching anti-censorship config:', error);
    return null;
  }
}

/**
 * Initialize an obfuscated VPN connection
 * @param serverId - The ID of the VPN server
 * @param protocol - The VPN protocol
 * @param method - Optional specific obfuscation method to use
 * @returns Connection parameters for the client
 */
export async function initializeObfuscatedConnection(
  serverId: number,
  protocol: string,
  method?: ObfuscationMethod
): Promise<{ connectionParams: ObfuscationConfig }> {
  try {
    const response = await apiRequest('POST', '/api/obfuscation/connect', {
      serverId,
      protocol,
      method
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error initializing obfuscated connection:', error);
    throw error;
  }
}

/**
 * Check if the current network environment requires obfuscation
 * This is a utility function that can be expanded with more advanced detection
 * @returns Boolean indicating whether obfuscation might be needed
 */
export async function detectObfuscationNeeded(): Promise<boolean> {
  // This is a mock implementation that could be expanded with actual detection logic
  // For example:
  // 1. Check if able to connect to common VPN ports
  // 2. Detect DPI fingerprinting from the network
  // 3. Check if in a country known for VPN blocking
  
  try {
    // Here we would implement actual detection logic
    // For now we'll just return a default value
    return false;
  } catch (error) {
    console.error('Error detecting obfuscation need:', error);
    return false;
  }
}

/**
 * Get recommended obfuscation settings based on network conditions and location
 * @param countryCode - User's country code
 * @param currentProtocol - Currently selected VPN protocol
 * @returns Recommended obfuscation settings
 */
export async function getRecommendedObfuscationSettings(
  countryCode?: string,
  currentProtocol?: string
): Promise<{
  recommendedMethod: ObfuscationMethod;
  recommendedProtocol: string;
  useAntiCensorship: boolean;
}> {
  // Countries known for strong censorship that would benefit from anti-censorship
  const restrictedCountries = ['CN', 'IR', 'RU', 'TR', 'VN', 'SA', 'AE', 'EG'];
  
  // Default values
  let recommendedMethod = ObfuscationMethod.NONE;
  let recommendedProtocol = currentProtocol || 'openvpn_tcp';
  let useAntiCensorship = false;
  
  if (countryCode && restrictedCountries.includes(countryCode)) {
    // For restricted countries, recommend strong obfuscation
    useAntiCensorship = true;
    
    // Recommend protocol and method based on country
    switch (countryCode) {
      case 'CN': // China
        recommendedMethod = ObfuscationMethod.SHADOWSOCKS;
        recommendedProtocol = 'shadowsocks';
        break;
      case 'IR': // Iran
        recommendedMethod = ObfuscationMethod.OBFS4;
        recommendedProtocol = 'openvpn_tcp';
        break;
      case 'RU': // Russia
        recommendedMethod = ObfuscationMethod.STUNNEL;
        recommendedProtocol = 'openvpn_tcp';
        break;
      default:
        // For other restricted countries
        recommendedMethod = ObfuscationMethod.WEBSOCKET;
        recommendedProtocol = 'wireguard';
    }
  } else {
    // For non-restricted countries, recommend based on protocol
    if (currentProtocol) {
      switch (currentProtocol) {
        case 'openvpn_tcp':
          recommendedMethod = ObfuscationMethod.STUNNEL;
          break;
        case 'openvpn_udp':
          recommendedMethod = ObfuscationMethod.OBFS4;
          break;
        case 'wireguard':
          recommendedMethod = ObfuscationMethod.WEBSOCKET;
          break;
        case 'shadowsocks':
          recommendedMethod = ObfuscationMethod.V2RAY;
          break;
        case 'ikev2':
          recommendedMethod = ObfuscationMethod.SNI;
          break;
      }
    }
  }
  
  return {
    recommendedMethod,
    recommendedProtocol,
    useAntiCensorship
  };
}