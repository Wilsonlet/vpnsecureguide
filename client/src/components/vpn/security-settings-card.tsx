import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import ToggleSwitch from '@/components/common/toggle-switch';
import { useVpnState } from '@/lib/vpn-service.tsx';
import { useToast } from '@/hooks/use-toast';
import SimpleSettingsForm from './simple-settings-form';

export default function SecuritySettingsCard() {
  const vpnState = useVpnState();
  const { toast } = useToast();
  
  // Local state for toggle settings
  const [killSwitch, setKillSwitch] = useState(vpnState.killSwitch || false);
  const [dnsLeakProtection, setDnsLeakProtection] = useState(vpnState.dnsLeakProtection || false);
  const [doubleVpn, setDoubleVpn] = useState(vpnState.doubleVpn || false);
  const [obfuscation, setObfuscation] = useState(vpnState.obfuscation || false);
  
  // Update local state when vpnState changes
  useEffect(() => {
    setKillSwitch(vpnState.killSwitch || false);
    setDnsLeakProtection(vpnState.dnsLeakProtection || false);
    setDoubleVpn(vpnState.doubleVpn || false);
    setObfuscation(vpnState.obfuscation || false);
  }, [
    vpnState.killSwitch,
    vpnState.dnsLeakProtection,
    vpnState.doubleVpn,
    vpnState.obfuscation
  ]);

  // Handle toggle changes
  const handleKillSwitchChange = async (checked: boolean) => {
    setKillSwitch(checked);
    await updateSetting({ killSwitch: checked });
  };

  const handleDnsLeakProtectionChange = async (checked: boolean) => {
    setDnsLeakProtection(checked);
    await updateSetting({ dnsLeakProtection: checked });
  };

  const handleDoubleVpnChange = async (checked: boolean) => {
    setDoubleVpn(checked);
    await updateSetting({ doubleVpn: checked });
  };

  const handleObfuscationChange = async (checked: boolean) => {
    setObfuscation(checked);
    await updateSetting({ obfuscation: checked });
  };

  // Update a single setting on the server
  const updateSetting = async (setting: any) => {
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(setting),
        credentials: 'include'
      });
      
      if (response.ok) {
        // Update global VPN state
        vpnState.updateSettings(setting);
        
        toast({
          title: 'Setting Updated',
          description: 'Your security setting has been updated',
          variant: 'default',
        });
      } else {
        throw new Error('Failed to update setting');
      }
    } catch (error) {
      console.error('Setting update error:', error);
      toast({
        title: 'Update Error',
        description: 'Failed to update security setting',
        variant: 'destructive'
      });
      
      // Revert UI state on error
      if ('killSwitch' in setting) setKillSwitch(!setting.killSwitch);
      if ('dnsLeakProtection' in setting) setDnsLeakProtection(!setting.dnsLeakProtection);
      if ('doubleVpn' in setting) setDoubleVpn(!setting.doubleVpn);
      if ('obfuscation' in setting) setObfuscation(!setting.obfuscation);
    }
  };

  return (
    <div className="space-y-5">
      {/* Protocol and Encryption Settings */}
      <SimpleSettingsForm />
    
      {/* Security Toggles */}
      <Card className="border border-gray-800 shadow-lg bg-gray-950">
        <CardHeader className="border-b border-gray-800 p-5">
          <h3 className="font-medium">Security Features</h3>
        </CardHeader>
        <CardContent className="p-5 space-y-4">
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
        </CardContent>
      </Card>
    </div>
  );
}