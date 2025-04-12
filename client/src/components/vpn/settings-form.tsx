import { useState, useEffect } from 'react';
import { useVpnState } from '@/lib/vpn-service';
import { useToast } from '@/hooks/use-toast';

export default function SettingsForm() {
  const vpnState = useVpnState();
  const { toast } = useToast();
  
  // Local state for UI
  const [protocol, setProtocol] = useState(vpnState.protocol || 'openvpn_tcp');
  const [encryption, setEncryption] = useState(vpnState.encryption || 'aes_256_gcm');
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState('');
  
  // Premium feature access
  const isPremium = vpnState.subscription === 'premium' || vpnState.subscription === 'ultimate';
  
  // Protocol options
  const protocolOptions = [
    { value: 'openvpn_tcp', label: 'OpenVPN (TCP)', premium: false },
    { value: 'openvpn_udp', label: 'OpenVPN (UDP)', premium: false },
    { value: 'wireguard', label: 'WireGuard', premium: false },
    { value: 'shadowsocks', label: 'Shadowsocks', premium: true },
    { value: 'ikev2', label: 'IKEv2/IPSec', premium: false },
  ];
  
  // Encryption options
  const encryptionOptions = [
    { value: 'aes_256_gcm', label: 'AES-256-GCM', premium: false },
    { value: 'chacha20_poly1305', label: 'ChaCha20-Poly1305', premium: true },
    { value: 'aes_128_gcm', label: 'AES-128-GCM', premium: false },
  ];
  
  // Update local state when vpnState changes
  useEffect(() => {
    if (vpnState.protocol) setProtocol(vpnState.protocol);
    if (vpnState.encryption) setEncryption(vpnState.encryption);
  }, [vpnState.protocol, vpnState.encryption]);
  
  // Load initial settings
  useEffect(() => {
    fetchSettings();
  }, []);
  
  // Fetch current settings from server
  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings');
      if (response.ok) {
        const settings = await response.json();
        console.log('Settings loaded:', settings);
        
        // Update UI state
        if (settings.preferredProtocol) setProtocol(settings.preferredProtocol);
        if (settings.preferredEncryption) setEncryption(settings.preferredEncryption);
        
        // Update global VPN state
        vpnState.updateSettings({
          protocol: settings.preferredProtocol,
          encryption: settings.preferredEncryption,
          killSwitch: settings.killSwitch,
          dnsLeakProtection: settings.dnsLeakProtection,
          doubleVpn: settings.doubleVpn,
          obfuscation: settings.obfuscation
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };
  
  // Handle protocol change
  const handleProtocolChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProtocol = e.target.value;
    setProtocol(newProtocol);
  };
  
  // Handle encryption change
  const handleEncryptionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEncryption = e.target.value;
    setEncryption(newEncryption);
  };
  
  // Save settings to server
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Check premium feature access
    const selectedProtocolOption = protocolOptions.find(opt => opt.value === protocol);
    const selectedEncryptionOption = encryptionOptions.find(opt => opt.value === encryption);
    
    if (selectedProtocolOption?.premium && !isPremium) {
      toast({
        title: 'Premium Feature',
        description: 'This protocol requires a premium subscription',
        variant: 'destructive',
      });
      return;
    }
    
    if (selectedEncryptionOption?.premium && !isPremium) {
      toast({
        title: 'Premium Feature',
        description: 'This encryption requires a premium subscription',
        variant: 'destructive',
      });
      return;
    }
    
    setIsSaving(true);
    
    try {
      // Build the payload
      const payload = {
        preferredProtocol: protocol,
        preferredEncryption: encryption,
      };
      
      // Send to server
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log('Settings saved:', result);
        
        // Update global VPN state
        vpnState.updateSettings({
          protocol,
          encryption
        });
        
        toast({
          title: 'Settings Saved',
          description: 'Your VPN settings have been updated',
          variant: 'default',
        });
        
        setLastSaved(new Date().toLocaleTimeString());
      } else {
        console.error('Failed to save settings:', response.statusText);
        toast({
          title: 'Save Failed',
          description: 'Could not update settings. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Error',
        description: 'An error occurred while saving settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <form onSubmit={handleSave} className="space-y-6 bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Connection Settings</h2>
      
      <div>
        <label htmlFor="protocol" className="block text-sm font-medium mb-2">
          VPN Protocol
        </label>
        <select
          id="protocol"
          value={protocol}
          onChange={handleProtocolChange}
          disabled={vpnState.connected || isSaving}
          className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
        >
          {protocolOptions.map(option => (
            <option 
              key={option.value} 
              value={option.value}
              disabled={option.premium && !isPremium}
            >
              {option.label} {option.premium && !isPremium ? '(Premium)' : ''}
            </option>
          ))}
        </select>
      </div>
      
      <div>
        <label htmlFor="encryption" className="block text-sm font-medium mb-2">
          Encryption Method
        </label>
        <select
          id="encryption"
          value={encryption}
          onChange={handleEncryptionChange}
          disabled={vpnState.connected || isSaving}
          className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
        >
          {encryptionOptions.map(option => (
            <option 
              key={option.value} 
              value={option.value}
              disabled={option.premium && !isPremium}
            >
              {option.label} {option.premium && !isPremium ? '(Premium)' : ''}
            </option>
          ))}
        </select>
      </div>
      
      <div className="flex justify-between items-center pt-4">
        {lastSaved && (
          <span className="text-xs text-gray-400">Last saved: {lastSaved}</span>
        )}
        
        <div className="space-x-4">
          <button
            type="button"
            onClick={fetchSettings}
            disabled={isSaving}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-md"
          >
            Refresh
          </button>
          
          <button
            type="submit"
            disabled={vpnState.connected || isSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:opacity-70 rounded-md"
          >
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
      
      {vpnState.connected && (
        <p className="text-yellow-500 text-sm mt-2">
          Disconnect from VPN to change protocol or encryption settings
        </p>
      )}
    </form>
  );
}