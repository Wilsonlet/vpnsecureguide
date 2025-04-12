import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ToggleSwitch from '@/components/common/toggle-switch';
import { useVpnState } from '@/lib/vpn-service.tsx';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

export default function SecuritySettingsCard() {
  const vpnState = useVpnState();
  const { toast } = useToast();
  
  // Local state for settings
  const [protocol, setProtocol] = useState(vpnState.protocol);
  const [encryption, setEncryption] = useState(vpnState.encryption);
  const [killSwitch, setKillSwitch] = useState(vpnState.killSwitch);
  const [dnsLeakProtection, setDnsLeakProtection] = useState(vpnState.dnsLeakProtection);
  const [doubleVpn, setDoubleVpn] = useState(vpnState.doubleVpn);
  const [obfuscation, setObfuscation] = useState(vpnState.obfuscation);
  
  // Check if user has access to Shadowsocks protocol
  const { data: shadowsocksAccess } = useQuery({
    queryKey: ['/api/feature-access/shadowsocks'],
    queryFn: async () => {
      const res = await fetch('/api/feature-access/shadowsocks');
      if (!res.ok) throw new Error('Failed to check Shadowsocks access');
      return res.json();
    },
    staleTime: 60000, // Cache for 1 minute
    // Default to no access if there's an error
    initialData: { hasAccess: false }
  });
  
  // Check if user has access to premium encryption features
  const { data: premiumEncryptionAccess } = useQuery({
    queryKey: ['/api/feature-access/premium-encryption'],
    queryFn: async () => {
      const res = await fetch('/api/feature-access/premium-encryption');
      if (!res.ok) throw new Error('Failed to check premium encryption access');
      return res.json();
    },
    staleTime: 60000, // Cache for 1 minute
    // Default to no access if there's an error
    initialData: { hasAccess: false }
  });
  
  // Flag to track if we're currently fetching settings to prevent infinite loops
  const isFetchingRef = useRef(false);

  // Define a settings fetching function that can be used both on mount and after updates
  const fetchSettings = async () => {
    // Prevent concurrent fetches or infinite loops
    if (isFetchingRef.current) return;
    
    try {
      isFetchingRef.current = true;
      const res = await fetch('/api/settings');
      
      if (res.ok) {
        const settings = await res.json();
        console.log('Settings refreshed from server:', settings);
        
        // Create a single update object for VPN state
        const vpnStateUpdates: any = {};
        
        // Update local state with fetched settings
        if (settings.preferredProtocol) {
          // Update UI state
          setProtocol(settings.preferredProtocol);
          vpnStateUpdates.protocol = settings.preferredProtocol;
        }
        
        if (settings.preferredEncryption) {
          // Update UI state
          setEncryption(settings.preferredEncryption);
          vpnStateUpdates.encryption = settings.preferredEncryption;
        }
        
        // Update other settings
        if (settings.killSwitch !== undefined) {
          setKillSwitch(settings.killSwitch);
          vpnStateUpdates.killSwitch = settings.killSwitch;
        }
        
        if (settings.dnsLeakProtection !== undefined) {
          setDnsLeakProtection(settings.dnsLeakProtection);
          vpnStateUpdates.dnsLeakProtection = settings.dnsLeakProtection;
        }
        
        if (settings.doubleVpn !== undefined) {
          setDoubleVpn(settings.doubleVpn);
          vpnStateUpdates.doubleVpn = settings.doubleVpn;
        }
        
        if (settings.obfuscation !== undefined) {
          setObfuscation(settings.obfuscation);
          vpnStateUpdates.obfuscation = settings.obfuscation;
        }
        
        // Apply all VPN state updates in a single operation
        // to reduce the number of renders and prevent maximum update depth errors
        if (Object.keys(vpnStateUpdates).length > 0) {
          vpnState.updateSettings(vpnStateUpdates);
        }
      }
    } catch (error) {
      console.error('Failed to refresh user settings:', error);
    } finally {
      // Always reset the fetching flag when done
      isFetchingRef.current = false;
    }
  };
  
  // Fetch settings on component mount - using a ref to prevent over-rendering
  const didFetchRef = useRef(false);
  useEffect(() => {
    if (!didFetchRef.current) {
      fetchSettings();
      didFetchRef.current = true;
    }
  }, []);
  
  // Update local state when vpnState changes
  useEffect(() => {
    setProtocol(vpnState.protocol || 'openvpn_tcp');
    setEncryption(vpnState.encryption || 'aes_256_gcm');
    setKillSwitch(vpnState.killSwitch || false);
    setDnsLeakProtection(vpnState.dnsLeakProtection || false);
    setDoubleVpn(vpnState.doubleVpn || false);
    setObfuscation(vpnState.obfuscation || false);
  }, [
    vpnState.protocol,
    vpnState.encryption,
    vpnState.killSwitch,
    vpnState.dnsLeakProtection,
    vpnState.doubleVpn,
    vpnState.obfuscation
  ]);

  // Handle protocol change
  const handleProtocolChange = async (value: string) => {
    console.log("Protocol selection changed to:", value);
    
    // Check if user is trying to select Shadowsocks without premium access
    if (value === 'shadowsocks' && !shadowsocksAccess?.hasAccess) {
      toast({
        title: 'Premium Feature',
        description: 'Shadowsocks protocol is only available with Premium or Ultimate plans',
        variant: 'destructive',
      });
      return; // Don't allow the change
    }
    
    try {
      // Show loading state and temporarily set UI state
      setProtocol(value);
      
      // Create a payload for the server with both parameter forms to ensure compatibility
      const payload = { 
        protocol: value,
        preferredProtocol: value
      };
      
      console.log("Sending protocol update request:", payload);
      
      // Send update to server - use dedicated API endpoint
      const response = await apiRequest('POST', '/api/protocol', payload);
      
      if (!response.ok) {
        // Check if it's a feature access error
        if (response.status === 403) {
          toast({
            title: 'Premium Feature Required',
            description: 'This protocol requires a premium subscription plan',
            variant: 'destructive',
          });
          // Revert to previous value
          setProtocol(vpnState.protocol || 'openvpn_tcp');
          return;
        }
        
        throw new Error('Failed to update protocol setting');
      }
      
      // Get the response data
      const result = await response.json();
      console.log("Protocol update success:", result);
      
      // Update local state permanently with the protocol value
      vpnState.updateSettings({ 
        protocol: value
      });
      
      // Show success toast
      toast({
        title: 'Protocol Updated',
        description: result.message || `Protocol updated to ${value.replace('_', ' ').toUpperCase()}`,
        variant: 'default',
      });
      
    } catch (error) {
      console.error('Error updating protocol:', error);
      // Revert to previous value
      setProtocol(vpnState.protocol || 'openvpn_tcp');
      toast({
        title: 'Update Failed',
        description: 'Failed to update protocol setting',
        variant: 'destructive',
      });
    }
  };

  // Handle encryption change
  const handleEncryptionChange = async (value: string) => {
    console.log("Encryption selection changed to:", value);
    
    // Check if user is trying to select premium encryption without access
    if (value === 'chacha20_poly1305' && !premiumEncryptionAccess?.hasAccess) {
      toast({
        title: 'Premium Feature',
        description: 'ChaCha20-Poly1305 encryption is only available with Premium or Ultimate plans',
        variant: 'destructive',
      });
      return; // Don't allow the change
    }
    
    try {
      // Show loading state
      setEncryption(value);
      
      // Create a payload for the server with both parameter forms to ensure compatibility
      const payload = { 
        encryption: value,
        preferredEncryption: value
      };
      
      console.log("Sending encryption update request:", payload);
      
      // Send update to server - use dedicated API endpoint
      const response = await apiRequest('POST', '/api/encryption', payload);
      
      if (!response.ok) {
        // Check if it's a feature access error
        if (response.status === 403) {
          toast({
            title: 'Premium Feature Required',
            description: 'This encryption method requires a premium subscription plan',
            variant: 'destructive',
          });
          // Revert to previous value
          setEncryption(vpnState.encryption || 'aes_256_gcm');
          return;
        }
        
        throw new Error('Failed to update encryption setting');
      }
      
      // Get the response data
      const result = await response.json();
      console.log("Encryption update success:", result);
      
      // Update local state permanently with the encryption value
      vpnState.updateSettings({ 
        encryption: value
      });
      
      // Show success toast
      toast({
        title: 'Encryption Updated',
        description: result.message || `Encryption updated to ${value.replace('_', '-').toUpperCase()}`,
        variant: 'default',
      });
      
    } catch (error) {
      console.error('Error updating encryption:', error);
      // Revert to previous value
      setEncryption(vpnState.encryption || 'aes_256_gcm');
      toast({
        title: 'Update Failed',
        description: 'Failed to update encryption setting',
        variant: 'destructive',
      });
    }
  };

  // Handle toggle changes
  const handleKillSwitchChange = (checked: boolean) => {
    setKillSwitch(checked);
    updateSettings({ killSwitch: checked });
  };

  const handleDnsLeakProtectionChange = (checked: boolean) => {
    setDnsLeakProtection(checked);
    updateSettings({ dnsLeakProtection: checked });
  };

  const handleDoubleVpnChange = (checked: boolean) => {
    setDoubleVpn(checked);
    updateSettings({ doubleVpn: checked });
  };

  const handleObfuscationChange = (checked: boolean) => {
    setObfuscation(checked);
    updateSettings({ obfuscation: checked });
  };

  // Update settings on the server and in local state
  const updateSettings = async (settings: any) => {
    try {
      console.log("Updating settings:", settings);
      
      // Handle protocol - convert from client property name to server property name
      if (settings.protocol) {
        // Use the protocol endpoint
        try {
          const protocolRes = await apiRequest('POST', '/api/protocol', { 
            protocol: settings.protocol,
            preferredProtocol: settings.protocol // Send both for compatibility
          });
          
          if (protocolRes.ok) {
            vpnState.updateSettings({
              protocol: settings.protocol
            });
          }
        } catch (protocolErr) {
          console.error('Error updating protocol:', protocolErr);
        }
      }
      
      // Handle encryption - convert from client property name to server property name
      if (settings.encryption) {
        try {
          const encryptionRes = await apiRequest('POST', '/api/encryption', { 
            encryption: settings.encryption,
            preferredEncryption: settings.encryption // Send both for compatibility
          });
          
          if (encryptionRes.ok) {
            vpnState.updateSettings({
              encryption: settings.encryption
            });
          }
        } catch (encryptionErr) {
          console.error('Error updating encryption:', encryptionErr);
        }
      }
      
      // For other settings, use the general settings endpoint
      const otherSettings = { ...settings };
      delete otherSettings.protocol;
      delete otherSettings.encryption;
      
      if (Object.keys(otherSettings).length > 0) {
        // Send the request to save other settings on the server
        const res = await apiRequest('POST', '/api/settings', otherSettings);
        
        if (res.ok) {
          // Update other settings in local VPN state
          vpnState.updateSettings({
            killSwitch: settings.killSwitch !== undefined ? settings.killSwitch : vpnState.killSwitch,
            dnsLeakProtection: settings.dnsLeakProtection !== undefined ? settings.dnsLeakProtection : vpnState.dnsLeakProtection,
            doubleVpn: settings.doubleVpn !== undefined ? settings.doubleVpn : vpnState.doubleVpn,
            obfuscation: settings.obfuscation !== undefined ? settings.obfuscation : vpnState.obfuscation
          });
          
        }
      }
    } catch (error) {
      console.error('General settings update error:', error);
      toast({
        title: 'Settings Error',
        description: 'Failed to update security settings',
        variant: 'destructive'
      });
    }
  };

  return (
    <Card className="border border-gray-800 shadow-lg bg-gray-950">
      <CardHeader className="border-b border-gray-800 p-5">
        <h3 className="font-medium">Protocol & Security</h3>
      </CardHeader>
      <CardContent className="p-5 space-y-5">
        <div>
          <label className="text-sm text-gray-400 block mb-2">VPN Protocol</label>
          <Select value={protocol} onValueChange={handleProtocolChange} disabled={vpnState.connected}>
            <SelectTrigger className="w-full bg-gray-800 border-gray-700">
              <SelectValue placeholder="Select Protocol" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="openvpn_tcp">OpenVPN (TCP)</SelectItem>
              <SelectItem value="openvpn_udp">OpenVPN (UDP)</SelectItem>
              <SelectItem value="wireguard">WireGuard</SelectItem>
              <SelectItem 
                value="shadowsocks" 
                disabled={!shadowsocksAccess?.hasAccess}
                className="relative"
              >
                <div className="flex items-center">
                  Shadowsocks
                  {!shadowsocksAccess?.hasAccess && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs font-semibold bg-gradient-to-r from-amber-500 to-yellow-500 text-black rounded">
                      Premium
                    </span>
                  )}
                </div>
              </SelectItem>
              <SelectItem value="ikev2">IKEv2/IPSec</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <label className="text-sm text-gray-400 block mb-2">Encryption Level</label>
          <Select value={encryption} onValueChange={handleEncryptionChange} disabled={vpnState.connected}>
            <SelectTrigger className="w-full bg-gray-800 border-gray-700">
              <SelectValue placeholder="Select Encryption" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aes_256_gcm">AES-256-GCM</SelectItem>
              <SelectItem 
                value="chacha20_poly1305"
                disabled={!premiumEncryptionAccess?.hasAccess}
                className="relative"
              >
                <div className="flex items-center">
                  ChaCha20-Poly1305
                  {!premiumEncryptionAccess?.hasAccess && (
                    <span className="ml-2 px-1.5 py-0.5 text-xs font-semibold bg-gradient-to-r from-amber-500 to-yellow-500 text-black rounded">
                      Premium
                    </span>
                  )}
                </div>
              </SelectItem>
              <SelectItem value="aes_128_gcm">AES-128-GCM</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">Kill Switch</h4>
              <p className="text-sm text-gray-400 mt-1">Block internet if VPN disconnects</p>
            </div>
            <ToggleSwitch checked={killSwitch} onChange={handleKillSwitchChange} />
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">DNS Leak Protection</h4>
              <p className="text-sm text-gray-400 mt-1">Use secure DNS servers only</p>
            </div>
            <ToggleSwitch checked={dnsLeakProtection} onChange={handleDnsLeakProtectionChange} />
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">Double VPN</h4>
              <p className="text-sm text-gray-400 mt-1">Route through two servers</p>
            </div>
            <ToggleSwitch checked={doubleVpn} onChange={handleDoubleVpnChange} disabled={vpnState.connected} />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Obfuscation</h4>
              <p className="text-sm text-gray-400 mt-1">Hide VPN traffic pattern</p>
            </div>
            <ToggleSwitch checked={obfuscation} onChange={handleObfuscationChange} disabled={vpnState.connected} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
