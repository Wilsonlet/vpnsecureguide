/**
 * VPN Obfuscation Service
 * 
 * This service provides methods to obfuscate VPN traffic to bypass deep packet inspection (DPI)
 * and evade censorship in restricted regions.
 */

import { type VpnServer, type VpnUserSettings, subscriptionTiers } from '@shared/schema';
import { storage } from './storage';

// Obfuscation methods
export const OBFUSCATION_METHODS = {
  NONE: 'none',
  STUNNEL: 'stunnel',           // SSL/TLS encapsulation
  OBFS4: 'obfs4',               // Tor's obfs4 obfuscation
  SHADOWSOCKS: 'shadowsocks',   // Shadowsocks protocol
  CLOAK: 'cloak',               // Cloak plugin (advanced anti-DPI)
  SNI: 'sni',                   // SNI-based obfuscation
  V2RAY: 'v2ray',               // V2Ray obfuscation
  WEBSOCKET: 'websocket',       // Websocket encapsulation
};

// Anti-censorship strategies
export const ANTI_CENSORSHIP_STRATEGIES = {
  DOMAIN_FRONTING: 'domain_fronting',   // Using CDNs to mask traffic
  BRIDGE_RELAY: 'bridge_relay',         // Custom bridge relays
  SCRAMBLESUIT: 'scramblesuit',         // ScrambleSuit protocol
  MEEK: 'meek',                         // Meek protocol (uses cloud services)
};

// Define protocol specific obfuscation capabilities
const PROTOCOL_OBFUSCATION_COMPATIBILITY = {
  openvpn_tcp: [
    OBFUSCATION_METHODS.STUNNEL, 
    OBFUSCATION_METHODS.OBFS4,
    OBFUSCATION_METHODS.WEBSOCKET,
    OBFUSCATION_METHODS.SNI
  ],
  openvpn_udp: [
    OBFUSCATION_METHODS.OBFS4
  ],
  wireguard: [
    OBFUSCATION_METHODS.STUNNEL,
    OBFUSCATION_METHODS.WEBSOCKET
  ],
  shadowsocks: [
    OBFUSCATION_METHODS.CLOAK,
    OBFUSCATION_METHODS.WEBSOCKET,
    OBFUSCATION_METHODS.V2RAY
  ],
  ikev2: [
    OBFUSCATION_METHODS.SNI
  ]
};

/**
 * Service that handles VPN traffic obfuscation and anti-censorship techniques
 */
class ObfuscationService {
  // Default obfuscation configuration by protocol
  private readonly defaultObfuscationConfig: Record<string, any> = {
    openvpn_tcp: {
      method: OBFUSCATION_METHODS.STUNNEL,
      port: 443,
      options: {
        sniDomain: 'cdn.cloudflare.com'
      }
    },
    openvpn_udp: {
      method: OBFUSCATION_METHODS.OBFS4,
      port: 41194,
      options: {}
    },
    wireguard: {
      method: OBFUSCATION_METHODS.WEBSOCKET,
      port: 443,
      options: {
        wsPath: '/wg',
        host: 'cdn.securevpn.com'
      }
    },
    shadowsocks: {
      method: OBFUSCATION_METHODS.V2RAY,
      port: 443,
      options: {
        host: 'ajax.googleapis.com'
      }
    },
    ikev2: {
      method: OBFUSCATION_METHODS.SNI,
      port: 443,
      options: {
        sniDomain: 'aws.amazon.com'
      }
    }
  };

  /**
   * Get the available obfuscation methods for a given protocol
   * @param protocol - VPN protocol
   * @returns Array of available obfuscation methods
   */
  public getAvailableObfuscationMethods(protocol: string): string[] {
    const protocolKey = protocol as keyof typeof PROTOCOL_OBFUSCATION_COMPATIBILITY;
    
    return PROTOCOL_OBFUSCATION_COMPATIBILITY[protocolKey] || [OBFUSCATION_METHODS.NONE];
  }

  /**
   * Get obfuscation configuration for a connection
   * @param userId - User ID
   * @param protocol - VPN protocol
   * @param serverId - VPN server ID
   * @returns Obfuscation configuration or null if obfuscation is not available/enabled
   */
  public async getObfuscationConfig(
    userId: number,
    protocol: string,
    serverId: number
  ): Promise<any | null> {
    try {
      // Check user settings to see if obfuscation is enabled
      const userSettings = await storage.getUserSettings(userId);
      
      if (!userSettings?.obfuscation) {
        return null; // Obfuscation disabled in user settings
      }
      
      // Check if user has access to obfuscation feature through subscription
      const user = await storage.getUser(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      const subscriptionPlan = await storage.getSubscriptionPlanByName(user.subscription);
      
      if (!subscriptionPlan?.obfuscationAccess) {
        return null; // User's subscription doesn't include obfuscation
      }
      
      // Check if server supports obfuscation
      const server = await storage.getServerById(serverId);
      
      if (!server?.obfuscated) {
        return null; // Server doesn't support obfuscation
      }
      
      // Get the default config for this protocol
      const protocolKey = protocol as string;
      const defaultConfig = this.defaultObfuscationConfig[protocolKey];
      
      if (!defaultConfig) {
        return null; // No default config for this protocol
      }
      
      // Clone the default config and add server-specific info
      const config = {
        ...defaultConfig,
        serverIp: server.ip,
        serverId: server.id,
        serverName: server.name,
        serverCountry: server.country
      };
      
      return config;
    } catch (error) {
      console.error('Error getting obfuscation config:', error);
      return null;
    }
  }
  
  /**
   * Get anti-censorship configuration based on user's location and server capabilities
   * @param userId - User ID
   * @param countryCode - User's country code (for location-specific configs)
   * @returns Anti-censorship configuration
   */
  public async getAntiCensorshipConfig(
    userId: number,
    countryCode?: string
  ): Promise<any | null> {
    try {
      // Check if user has access to anti-censorship features
      const user = await storage.getUser(userId);
      
      if (!user || user.subscription === subscriptionTiers.FREE) {
        return null; // Free users don't get anti-censorship features
      }
      
      // Create region-specific configurations
      const restrictedRegionConfigs: Record<string, any> = {
        // China
        CN: {
          strategy: ANTI_CENSORSHIP_STRATEGIES.DOMAIN_FRONTING,
          options: {
            frontDomains: ['azure.microsoft.com', 'officecdn.microsoft.com'],
            entryPoints: ['HK', 'SG', 'JP'],
            fallbackProtocol: 'shadowsocks'
          }
        },
        // Iran
        IR: {
          strategy: ANTI_CENSORSHIP_STRATEGIES.BRIDGE_RELAY,
          options: {
            bridgeType: 'obfs4',
            entryPoints: ['TR', 'AE', 'DE'],
            fallbackProtocol: 'stunnel'
          }
        },
        // Russia
        RU: {
          strategy: ANTI_CENSORSHIP_STRATEGIES.SCRAMBLESUIT,
          options: {
            entryPoints: ['FI', 'DE', 'SE'],
            fallbackProtocol: 'shadowsocks'
          }
        },
        // UAE
        AE: {
          strategy: ANTI_CENSORSHIP_STRATEGIES.MEEK,
          options: {
            entryPoints: ['DE', 'SG', 'US'],
            fallbackProtocol: 'wireguard+websocket'
          }
        },
        // Default for other restricted regions
        DEFAULT: {
          strategy: ANTI_CENSORSHIP_STRATEGIES.DOMAIN_FRONTING,
          options: {
            frontDomains: ['cloudfront.net', 'akamaihd.net'],
            entryPoints: ['US', 'NL', 'SG'],
            fallbackProtocol: 'openvpn_tcp+stunnel'
          }
        }
      };
      
      // Return config based on country or default
      if (countryCode && restrictedRegionConfigs[countryCode]) {
        return restrictedRegionConfigs[countryCode];
      }
      
      return restrictedRegionConfigs.DEFAULT;
    } catch (error) {
      console.error('Error getting anti-censorship config:', error);
      return null;
    }
  }
  
  /**
   * Generate connection parameters with obfuscation for client
   * @param userId - User ID
   * @param serverId - Server ID
   * @param protocol - VPN protocol
   * @param obfuscationMethod - Specific obfuscation method to use (optional)
   * @returns Connection parameters with obfuscation details
   */
  public async generateObfuscatedConnectionParams(
    userId: number,
    serverId: number,
    protocol: string,
    obfuscationMethod?: string
  ): Promise<any> {
    try {
      // Get base obfuscation config
      const baseConfig = await this.getObfuscationConfig(userId, protocol, serverId);
      
      if (!baseConfig) {
        throw new Error('Obfuscation is not available for this connection');
      }
      
      // Override with specific method if provided and compatible
      if (obfuscationMethod) {
        const availableMethods = this.getAvailableObfuscationMethods(protocol);
        
        if (!availableMethods.includes(obfuscationMethod)) {
          throw new Error(`Obfuscation method ${obfuscationMethod} is not compatible with ${protocol}`);
        }
        
        baseConfig.method = obfuscationMethod;
      }
      
      // Generate config based on obfuscation method
      switch (baseConfig.method) {
        case OBFUSCATION_METHODS.STUNNEL:
          return this.generateStunnelConfig(baseConfig);
          
        case OBFUSCATION_METHODS.OBFS4:
          return this.generateObfs4Config(baseConfig);
          
        case OBFUSCATION_METHODS.WEBSOCKET:
          return this.generateWebsocketConfig(baseConfig);
          
        case OBFUSCATION_METHODS.V2RAY:
          return this.generateV2RayConfig(baseConfig);
          
        case OBFUSCATION_METHODS.SNI:
          return this.generateSniConfig(baseConfig);
          
        case OBFUSCATION_METHODS.CLOAK:
          return this.generateCloakConfig(baseConfig);
          
        default:
          throw new Error(`Unsupported obfuscation method: ${baseConfig.method}`);
      }
    } catch (error) {
      console.error('Error generating obfuscated connection params:', error);
      throw error;
    }
  }
  
  /**
   * Generate stunnel configuration
   * @param baseConfig - Base configuration object
   * @returns Stunnel configuration
   */
  private generateStunnelConfig(baseConfig: any): any {
    return {
      ...baseConfig,
      clientConfig: {
        type: 'stunnel',
        accept: '127.0.0.1:1194',
        connect: `${baseConfig.serverIp}:${baseConfig.port}`,
        sni: baseConfig.options.sniDomain || 'cdn.cloudflare.com',
        verify: false
      }
    };
  }
  
  /**
   * Generate obfs4 configuration
   * @param baseConfig - Base configuration object
   * @returns obfs4 configuration
   */
  private generateObfs4Config(baseConfig: any): any {
    return {
      ...baseConfig,
      clientConfig: {
        type: 'obfs4',
        connect: `${baseConfig.serverIp}:${baseConfig.port}`,
        cert: 'obfs4_cert_string_would_go_here',
        iatMode: 0
      }
    };
  }
  
  /**
   * Generate websocket configuration
   * @param baseConfig - Base configuration object
   * @returns Websocket configuration
   */
  private generateWebsocketConfig(baseConfig: any): any {
    return {
      ...baseConfig,
      clientConfig: {
        type: 'websocket',
        url: `wss://${baseConfig.options.host || baseConfig.serverIp}:${baseConfig.port}${baseConfig.options.wsPath || '/vpn'}`,
        headers: {
          'Host': baseConfig.options.host || 'cdn.securevpn.com',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      }
    };
  }
  
  /**
   * Generate V2Ray configuration
   * @param baseConfig - Base configuration object
   * @returns V2Ray configuration
   */
  private generateV2RayConfig(baseConfig: any): any {
    return {
      ...baseConfig,
      clientConfig: {
        type: 'v2ray',
        server: baseConfig.serverIp,
        port: baseConfig.port,
        host: baseConfig.options.host || 'ajax.googleapis.com',
        path: '/resources',
        security: 'tls',
        network: 'ws',
        id: 'v2ray_id_would_go_here'
      }
    };
  }
  
  /**
   * Generate SNI-based configuration
   * @param baseConfig - Base configuration object
   * @returns SNI configuration
   */
  private generateSniConfig(baseConfig: any): any {
    return {
      ...baseConfig,
      clientConfig: {
        type: 'sni',
        server: baseConfig.serverIp,
        port: baseConfig.port,
        sniHostname: baseConfig.options.sniDomain || 'aws.amazon.com'
      }
    };
  }
  
  /**
   * Generate Cloak plugin configuration
   * @param baseConfig - Base configuration object
   * @returns Cloak configuration
   */
  private generateCloakConfig(baseConfig: any): any {
    return {
      ...baseConfig,
      clientConfig: {
        type: 'cloak',
        server: baseConfig.serverIp,
        port: baseConfig.port,
        uid: 'cloak_uid_would_go_here',
        publicKey: 'cloak_public_key_would_go_here',
        transportProtocol: 'direct',
        streamTimeout: 300,
        proxyMethod: 'shadowsocks'
      }
    };
  }
}

export const obfuscationService = new ObfuscationService();