import { useEffect, useState } from 'react';
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
  
  // Load user settings on component mount
  useEffect(() => {
    const fetchUserSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        
        if (res.ok) {
          const settings = await res.json();
          // Update local state with fetched settings
          if (settings.preferredProtocol) {
            setProtocol(settings.preferredProtocol);
            // Also update the VPN state context
            vpnState.updateSettings({
              protocol: settings.preferredProtocol
            });
          }
          
          if (settings.preferredEncryption) {
            setEncryption(settings.preferredEncryption);
            // Also update the VPN state context
            vpnState.updateSettings({
              encryption: settings.preferredEncryption
            });
          }
        }
      } catch (error) {
        console.error('Failed to load user settings:', error);
      }
    };
    
    fetchUserSettings();
  }, []);
  
  // Update local state when vpnState changes
  useEffect(() => {
    setProtocol(vpnState.protocol);
    setEncryption(vpnState.encryption);
    setKillSwitch(vpnState.killSwitch);
    setDnsLeakProtection(vpnState.dnsLeakProtection);
    setDoubleVpn(vpnState.doubleVpn);
    setObfuscation(vpnState.obfuscation);
  }, [
    vpnState.protocol,
    vpnState.encryption,
    vpnState.killSwitch,
    vpnState.dnsLeakProtection,
    vpnState.doubleVpn,
    vpnState.obfuscation
  ]);

  // Handle protocol change
  const handleProtocolChange = (value: string) => {
    // Check if user is trying to select Shadowsocks without premium access
    if (value === 'shadowsocks' && !shadowsocksAccess?.hasAccess) {
      toast({
        title: 'Premium Feature',
        description: 'Shadowsocks protocol is only available with Premium or Ultimate plans',
        variant: 'destructive',
      });
      return; // Don't allow the change
    }
    
    setProtocol(value);
    updateSettings({ preferredProtocol: value });
  };

  // Handle encryption change
  const handleEncryptionChange = (value: string) => {
    // Check if user is trying to select premium encryption without access
    if (value === 'chacha20_poly1305' && !premiumEncryptionAccess?.hasAccess) {
      toast({
        title: 'Premium Feature',
        description: 'ChaCha20-Poly1305 encryption is only available with Premium or Ultimate plans',
        variant: 'destructive',
      });
      return; // Don't allow the change
    }
    
    setEncryption(value);
    updateSettings({ preferredEncryption: value });
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
      // Handle protocol and encryption separately
      if (settings.preferredProtocol) {
        vpnState.updateSettings({
          protocol: settings.preferredProtocol
        });
      }
      
      if (settings.preferredEncryption) {
        vpnState.updateSettings({
          encryption: settings.preferredEncryption
        });
      }
      
      // Send the request to save on the server
      const res = await apiRequest('POST', '/api/settings', {
        ...settings
      });
      
      if (res.ok) {
        // Update other settings in local VPN state
        vpnState.updateSettings({
          killSwitch: settings.killSwitch !== undefined ? settings.killSwitch : vpnState.killSwitch,
          dnsLeakProtection: settings.dnsLeakProtection !== undefined ? settings.dnsLeakProtection : vpnState.dnsLeakProtection,
          doubleVpn: settings.doubleVpn !== undefined ? settings.doubleVpn : vpnState.doubleVpn,
          obfuscation: settings.obfuscation !== undefined ? settings.obfuscation : vpnState.obfuscation
        });
        
        // Show success toast for better feedback
        if (settings.preferredProtocol || settings.preferredEncryption) {
          toast({
            title: 'Settings Updated',
            description: 'Your security settings have been updated',
            variant: 'default'
          });
        }
      }
    } catch (error) {
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
