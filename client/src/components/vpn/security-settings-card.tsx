import { useEffect, useState, useRef } from 'react';
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
  const [antiCensorship, setAntiCensorship] = useState(vpnState.antiCensorship || false);
  
  // Track pending updates to prevent race conditions
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, boolean>>({});
  
  // Use a ref to track in-flight requests to prevent overlapping updates to the same setting
  const activeRequests = useRef<Record<string, boolean>>({});
  
  // Update local state when vpnState changes, but only if we don't have a pending update
  useEffect(() => {
    // Don't update local state if we have a pending update for this setting
    if (!pendingUpdates['killSwitch']) {
      setKillSwitch(vpnState.killSwitch || false);
    }
    if (!pendingUpdates['dnsLeakProtection']) {
      setDnsLeakProtection(vpnState.dnsLeakProtection || false);
    }
    if (!pendingUpdates['doubleVpn']) {
      setDoubleVpn(vpnState.doubleVpn || false);
    }
    if (!pendingUpdates['obfuscation']) {
      setObfuscation(vpnState.obfuscation || false);
    }
    if (!pendingUpdates['antiCensorship']) {
      setAntiCensorship(vpnState.antiCensorship || false);
    }
  }, [
    vpnState.killSwitch,
    vpnState.dnsLeakProtection,
    vpnState.doubleVpn,
    vpnState.obfuscation,
    vpnState.antiCensorship,
    pendingUpdates
  ]);

  // Handle toggle changes
  const handleKillSwitchChange = async (checked: boolean) => {
    // Prevent double-clicks and overlapping updates
    if (activeRequests.current['killSwitch']) {
      console.log('Ignoring killSwitch update - request already in progress');
      return;
    }
    setKillSwitch(checked);
    await updateSetting({ killSwitch: checked });
  };

  const handleDnsLeakProtectionChange = async (checked: boolean) => {
    if (activeRequests.current['dnsLeakProtection']) return;
    setDnsLeakProtection(checked);
    await updateSetting({ dnsLeakProtection: checked });
  };

  const handleDoubleVpnChange = async (checked: boolean) => {
    if (activeRequests.current['doubleVpn']) return;
    setDoubleVpn(checked);
    await updateSetting({ doubleVpn: checked });
  };

  const handleObfuscationChange = async (checked: boolean) => {
    if (activeRequests.current['obfuscation']) return;
    setObfuscation(checked);
    await updateSetting({ obfuscation: checked });
  };
  
  const handleAntiCensorshipChange = async (checked: boolean) => {
    if (activeRequests.current['antiCensorship']) return;
    console.log('Changing antiCensorship to:', checked);
    setAntiCensorship(checked);
    await updateSetting({ antiCensorship: checked });
  };

  // Update a single setting on the server
  const updateSetting = async (setting: any) => {
    // Extract the setting name and value
    const settingName = Object.keys(setting)[0];
    const settingValue = setting[settingName];
    
    // Mark this setting as having an active request
    activeRequests.current[settingName] = true;
    
    // Mark as pending update to prevent UI changes
    setPendingUpdates(prev => ({
      ...prev,
      [settingName]: true
    }));
    
    try {
      console.log(`SecuritySettings: Updating ${settingName} to ${settingValue}`);
      
      // Update VPN state immediately for responsive UI
      vpnState.updateSettings(setting);
      
      // Add a small delay to ensure the UI updates before making the API call
      // This improves the perceived performance and prevents UI jank
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Send update to server with a timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout
      
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(setting),
        credentials: 'include',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        // Get response data
        const data = await response.json();
        console.log('SecuritySettings: Server response for setting update:', data);
        
        // Update global VPN state with server response data to ensure sync
        vpnState.updateSettings({
          killSwitch: data.killSwitch,
          dnsLeakProtection: data.dnsLeakProtection, 
          doubleVpn: data.doubleVpn,
          obfuscation: data.obfuscation,
          antiCensorship: data.antiCensorship
        });
        
        // Also update local state to match server response
        if ('killSwitch' in data) setKillSwitch(data.killSwitch);
        if ('dnsLeakProtection' in data) setDnsLeakProtection(data.dnsLeakProtection);
        if ('doubleVpn' in data) setDoubleVpn(data.doubleVpn);
        if ('obfuscation' in data) setObfuscation(data.obfuscation);
        if ('antiCensorship' in data) setAntiCensorship(data.antiCensorship);
        
        console.log(`SecuritySettings: Successfully updated ${settingName} to ${data[settingName]}`);
        
        toast({
          title: 'Setting Updated',
          description: `${settingName.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())} has been updated`,
          variant: 'default',
        });
      } else {
        const errorText = await response.text();
        console.error(`SecuritySettings: Failed to update ${settingName}:`, errorText);
        throw new Error(`Failed to update ${settingName}: ${errorText}`);
      }
    } catch (error) {
      console.error('SecuritySettings: Update error:', error);
      
      // Show toast error
      toast({
        title: 'Update Error',
        description: 'Failed to update security setting. Please try again.',
        variant: 'destructive'
      });
      
      // Revert local state on error
      if ('killSwitch' in setting) setKillSwitch(!setting.killSwitch);
      if ('dnsLeakProtection' in setting) setDnsLeakProtection(!setting.dnsLeakProtection);
      if ('doubleVpn' in setting) setDoubleVpn(!setting.doubleVpn);
      if ('obfuscation' in setting) setObfuscation(!setting.obfuscation);
      if ('antiCensorship' in setting) setAntiCensorship(!setting.antiCensorship);
      
      // Also revert the VPN state to match what's in server state
      vpnState.updateSettings({
        killSwitch: vpnState.killSwitch, 
        dnsLeakProtection: vpnState.dnsLeakProtection,
        doubleVpn: vpnState.doubleVpn, 
        obfuscation: vpnState.obfuscation, 
        antiCensorship: vpnState.antiCensorship
      });
      
      // Refresh the entire settings from server to ensure we're completely in sync
      try {
        const refreshResponse = await fetch('/api/settings', { 
          credentials: 'include',
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        if (refreshResponse.ok) {
          const data = await refreshResponse.json();
          vpnState.updateSettings(data);
          setKillSwitch(data.killSwitch);
          setDnsLeakProtection(data.dnsLeakProtection);
          setDoubleVpn(data.doubleVpn);
          setObfuscation(data.obfuscation);
          setAntiCensorship(data.antiCensorship);
          console.log('SecuritySettings: Refreshed all settings from server after error');
        }
      } catch (refreshError) {
        console.error('Failed to refresh settings after error:', refreshError);
      }
    } finally {
      // Clean up: mark this setting as no longer having an active request
      activeRequests.current[settingName] = false;
      
      // Remove from pending updates after a short delay
      // This delay prevents visual "flicker" on fast networks
      setTimeout(() => {
        setPendingUpdates(prev => ({
          ...prev,
          [settingName]: false
        }));
      }, 300);
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
            <ToggleSwitch 
              checked={killSwitch} 
              onChange={handleKillSwitchChange}
              disabled={pendingUpdates['killSwitch'] || activeRequests.current['killSwitch']} 
            />
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">DNS Leak Protection</h4>
              <p className="text-sm text-gray-400 mt-1">Use secure DNS servers only</p>
            </div>
            <ToggleSwitch 
              checked={dnsLeakProtection} 
              onChange={handleDnsLeakProtectionChange}
              disabled={pendingUpdates['dnsLeakProtection'] || activeRequests.current['dnsLeakProtection']} 
            />
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">Double VPN</h4>
              <p className="text-sm text-gray-400 mt-1">Route through two servers</p>
            </div>
            <ToggleSwitch 
              checked={doubleVpn} 
              onChange={handleDoubleVpnChange} 
              disabled={pendingUpdates['doubleVpn'] || activeRequests.current['doubleVpn']} 
            />
          </div>
          
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium">Obfuscation</h4>
              <p className="text-sm text-gray-400 mt-1">Hide VPN traffic pattern</p>
            </div>
            <ToggleSwitch 
              checked={obfuscation} 
              onChange={handleObfuscationChange} 
              disabled={pendingUpdates['obfuscation'] || activeRequests.current['obfuscation']} 
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Anti-Censorship</h4>
              <p className="text-sm text-gray-400 mt-1">Additional protection for restricted regions</p>
            </div>
            <ToggleSwitch 
              checked={antiCensorship} 
              onChange={handleAntiCensorshipChange} 
              disabled={!obfuscation || pendingUpdates['antiCensorship'] || activeRequests.current['antiCensorship']} 
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}