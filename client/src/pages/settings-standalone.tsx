/**
 * Standalone Settings Page
 * 
 * A completely self-contained settings page with minimal dependencies.
 * All logic is contained in this one file for simplicity.
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import Sidebar from '@/components/layout/sidebar';
import MobileNav from '@/components/layout/mobile-nav';
import Header from '@/components/layout/header';
import { useAuth } from '@/hooks/use-auth';
import { useVpnState } from '@/lib/vpn-service';
import { ObfuscationSettings } from '@/components/vpn/obfuscation-settings';
import { getAvailableObfuscationMethods } from '@/lib/obfuscation-utils';

export default function SettingsStandalone() {
  const { user } = useAuth();
  
  // Settings state
  const [protocol, setProtocol] = useState('wireguard');
  const [encryption, setEncryption] = useState('aes_256_gcm');
  const [killSwitch, setKillSwitch] = useState(false);
  const [dnsLeakProtection, setDnsLeakProtection] = useState(false);
  const [doubleVpn, setDoubleVpn] = useState(false);
  const [obfuscation, setObfuscation] = useState(false);
  const [antiCensorship, setAntiCensorship] = useState(false);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [connected, setConnected] = useState(false); // VPN connected state
  const [hasObfuscationAccess, setHasObfuscationAccess] = useState(false);
  
  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch('/api/settings', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          console.log('Loaded settings:', data);
          
          // Update state with loaded data
          setProtocol(data.preferredProtocol || 'wireguard');
          setEncryption(data.preferredEncryption || 'aes_256_gcm');
          setKillSwitch(data.killSwitch || false);
          setDnsLeakProtection(data.dnsLeakProtection || false);
          setDoubleVpn(data.doubleVpn || false);
          setObfuscation(data.obfuscation || false);
          setAntiCensorship(data.antiCensorship || false);
        } else {
          setErrorMessage('Failed to load settings');
        }
      } catch (error) {
        console.error('Error loading settings:', error);
        setErrorMessage('Error connecting to server');
      } finally {
        setLoading(false);
      }
    }
    
    // Also check if VPN is connected
    async function checkVpnStatus() {
      try {
        const response = await fetch('/api/sessions/current', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setConnected(data !== null);
        }
      } catch (error) {
        console.error('Error checking VPN status:', error);
      }
    }
    
    // Check if user has access to obfuscation feature
    async function checkObfuscationAccess() {
      try {
        const response = await fetch('/api/feature-access/obfuscation', {
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setHasObfuscationAccess(data.hasAccess);
        }
      } catch (error) {
        console.error('Error checking obfuscation access:', error);
        // Default to no access if there's an error
        setHasObfuscationAccess(false);
      }
    }
    
    loadSettings();
    checkVpnStatus();
    checkObfuscationAccess();
  }, []);
  
  // Import the VPN context
  const vpnState = useVpnState();
  
  // Handle saving connection settings
  const handleSaveConnectionSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSuccessMessage('');
    setErrorMessage('');
    setSaving(true);
    
    try {
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          preferredProtocol: protocol,
          preferredEncryption: encryption,
        }),
        credentials: 'include',
      });
      
      if (response.ok) {
        // Update the VPN context with new settings
        vpnState.updateSettings({
          protocol: protocol,
          encryption: encryption
        });
        
        setSuccessMessage(`Settings saved successfully at ${new Date().toLocaleTimeString()}`);
      } else {
        const text = await response.text();
        setErrorMessage(`Failed to save settings: ${text}`);
      }
    } catch (error) {
      console.error('Settings save error:', error);
      setErrorMessage(`Network error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  };
  
  // Handle toggle changes
  const handleToggle = async (setting: string, value: boolean) => {
    try {
      // Optimistically update UI
      switch (setting) {
        case 'killSwitch':
          setKillSwitch(value);
          break;
        case 'dnsLeakProtection':
          setDnsLeakProtection(value);
          break;
        case 'doubleVpn':
          setDoubleVpn(value);
          break;
        case 'obfuscation':
          setObfuscation(value);
          break;
        case 'antiCensorship':
          setAntiCensorship(value);
          break;
      }
      
      // Save to server
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [setting]: value }),
        credentials: 'include',
      });
      
      if (response.ok) {
        // Update the global VPN state
        switch (setting) {
          case 'killSwitch':
            vpnState.updateSettings({ killSwitch: value });
            break;
          case 'dnsLeakProtection':
            vpnState.updateSettings({ dnsLeakProtection: value });
            break;
          case 'doubleVpn':
            vpnState.updateSettings({ doubleVpn: value });
            break;
          case 'obfuscation':
            vpnState.updateSettings({ obfuscation: value });
            break;
          case 'antiCensorship':
            vpnState.updateSettings({ antiCensorship: value });
            break;
        }
      } else {
        // Revert on error
        switch (setting) {
          case 'killSwitch':
            setKillSwitch(!value);
            break;
          case 'dnsLeakProtection':
            setDnsLeakProtection(!value);
            break;
          case 'doubleVpn':
            setDoubleVpn(!value);
            break;
          case 'obfuscation':
            setObfuscation(!value);
            break;
          case 'antiCensorship':
            setAntiCensorship(!value);
            break;
        }
        setErrorMessage('Failed to update setting');
      }
    } catch (error) {
      console.error('Error updating setting:', error);
      setErrorMessage('Network error');
      
      // Revert on error
      switch (setting) {
        case 'killSwitch':
          setKillSwitch(!value);
          break;
        case 'dnsLeakProtection':
          setDnsLeakProtection(!value);
          break;
        case 'doubleVpn':
          setDoubleVpn(!value);
          break;
        case 'obfuscation':
          setObfuscation(!value);
          break;
        case 'antiCensorship':
          setAntiCensorship(!value);
          break;
      }
    }
  };
  
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }
  
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar for desktop */}
      <Sidebar />
      
      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {/* Top header */}
        <Header username={user?.username || ''} />
        
        <div className="p-4 md:p-6 space-y-6">
          <h1 className="text-2xl font-bold mb-6">VPN Settings</h1>
          
          {/* Connection Settings Card */}
          <Card className="border border-gray-800 shadow-lg bg-gray-950">
            <CardContent className="p-6">
              <h2 className="text-xl font-medium mb-6">Connection Settings</h2>
              
              <form onSubmit={handleSaveConnectionSettings} className="space-y-6">
                <div>
                  <label htmlFor="protocol" className="block mb-2 text-sm font-medium">VPN Protocol</label>
                  <select
                    id="protocol"
                    value={protocol}
                    onChange={(e) => setProtocol(e.target.value)}
                    disabled={connected}
                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded text-white"
                  >
                    <option value="openvpn_tcp">OpenVPN (TCP)</option>
                    <option value="openvpn_udp">OpenVPN (UDP)</option>
                    <option value="wireguard">WireGuard</option>
                    <option value="ikev2">IKEv2/IPSec</option>
                    <option value="shadowsocks">Shadowsocks (Premium)</option>
                  </select>
                </div>
                
                <div>
                  <label htmlFor="encryption" className="block mb-2 text-sm font-medium">Encryption Method</label>
                  <select
                    id="encryption"
                    value={encryption}
                    onChange={(e) => setEncryption(e.target.value)}
                    disabled={connected}
                    className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded text-white"
                  >
                    <option value="aes_256_gcm">AES-256-GCM</option>
                    <option value="aes_128_gcm">AES-128-GCM</option>
                    <option value="chacha20_poly1305">ChaCha20-Poly1305 (Premium)</option>
                  </select>
                </div>
                
                {connected && (
                  <div className="p-3 bg-yellow-900/30 border border-yellow-700 rounded text-yellow-300 text-sm">
                    Disconnect from the VPN to change protocol or encryption settings
                  </div>
                )}
                
                <Button 
                  type="submit"
                  disabled={connected || saving}
                  className="px-4 py-2"
                >
                  {saving ? 'Saving...' : 'Save Connection Settings'}
                </Button>
              </form>
              
              {successMessage && (
                <div className="mt-4 p-3 bg-green-900/30 border border-green-800 rounded text-green-300">
                  {successMessage}
                </div>
              )}
              
              {errorMessage && (
                <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-300">
                  {errorMessage}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Security Settings Card */}
          <Card className="border border-gray-800 shadow-lg bg-gray-950">
            <CardContent className="p-6">
              <h2 className="text-xl font-medium mb-6">Security Features</h2>
              
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Kill Switch</h3>
                    <p className="text-sm text-gray-400 mt-1">Block internet if VPN disconnects</p>
                  </div>
                  <Switch 
                    checked={killSwitch} 
                    onCheckedChange={(checked) => handleToggle('killSwitch', checked)} 
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">DNS Leak Protection</h3>
                    <p className="text-sm text-gray-400 mt-1">Use secure DNS servers only</p>
                  </div>
                  <Switch 
                    checked={dnsLeakProtection} 
                    onCheckedChange={(checked) => handleToggle('dnsLeakProtection', checked)} 
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-medium">Double VPN</h3>
                    <p className="text-sm text-gray-400 mt-1">Route through two servers</p>
                  </div>
                  <Switch 
                    checked={doubleVpn} 
                    onCheckedChange={(checked) => handleToggle('doubleVpn', checked)} 
                    disabled={connected}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* Advanced Obfuscation Settings Card */}
          <ObfuscationSettings 
            userSettings={{
              obfuscation: obfuscation,
              antiCensorship: antiCensorship
            }}
            updateSettings={async (settings) => {
              try {
                const response = await fetch('/api/settings', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(settings),
                  credentials: 'include',
                });
                
                if (response.ok) {
                  // Update local state
                  setObfuscation(settings.obfuscation);
                  setAntiCensorship(settings.antiCensorship);
                  
                  // Update global VPN state
                  vpnState.updateSettings({
                    obfuscation: settings.obfuscation,
                    antiCensorship: settings.antiCensorship 
                  });
                  
                  return Promise.resolve();
                } else {
                  return Promise.reject(new Error('Failed to update settings'));
                }
              } catch (error) {
                console.error('Error updating obfuscation settings:', error);
                return Promise.reject(error);
              }
            }}
            hasAccess={hasObfuscationAccess}
            currentProtocol={protocol}
          />
        </div>
      </main>
    </div>
  );
}