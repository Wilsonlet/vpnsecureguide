import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ToggleSwitch from '@/components/common/toggle-switch';
import { useVpnState } from '@/lib/vpn-service.tsx';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

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
    setProtocol(value);
    updateSettings({ preferredProtocol: value });
  };

  // Handle encryption change
  const handleEncryptionChange = (value: string) => {
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
      const res = await apiRequest('POST', '/api/settings', {
        ...settings
      });
      
      if (res.ok) {
        // Update local VPN state
        vpnState.updateSettings({
          protocol: settings.preferredProtocol || vpnState.protocol,
          encryption: settings.preferredEncryption || vpnState.encryption,
          killSwitch: settings.killSwitch !== undefined ? settings.killSwitch : vpnState.killSwitch,
          dnsLeakProtection: settings.dnsLeakProtection !== undefined ? settings.dnsLeakProtection : vpnState.dnsLeakProtection,
          doubleVpn: settings.doubleVpn !== undefined ? settings.doubleVpn : vpnState.doubleVpn,
          obfuscation: settings.obfuscation !== undefined ? settings.obfuscation : vpnState.obfuscation
        });
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
              <SelectItem value="shadowsocks">Shadowsocks</SelectItem>
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
              <SelectItem value="chacha20_poly1305">ChaCha20-Poly1305</SelectItem>
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
