import { useEffect, useState } from 'react';
import { useVpnState } from '@/lib/vpn-service';
import { useToast } from '@/hooks/use-toast';

export default function SettingsForm() {
  const { toast } = useToast();
  const vpnState = useVpnState();
  
  // Form state
  const [protocol, setProtocol] = useState('openvpn_tcp');
  const [encryption, setEncryption] = useState('aes_256_gcm');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState('');
  
  // Load initial values from VPN state
  useEffect(() => {
    setProtocol(vpnState.protocol || 'openvpn_tcp');
    setEncryption(vpnState.encryption || 'aes_256_gcm');
  }, [vpnState.protocol, vpnState.encryption]);
  
  // Protocol and encryption options
  const protocols = [
    { value: 'openvpn_tcp', label: 'OpenVPN (TCP)' },
    { value: 'openvpn_udp', label: 'OpenVPN (UDP)' },
    { value: 'wireguard', label: 'WireGuard' },
    { value: 'shadowsocks', label: 'Shadowsocks' },
    { value: 'ikev2', label: 'IKEv2/IPSec' },
  ];
  
  const encryptions = [
    { value: 'aes_256_gcm', label: 'AES-256-GCM' },
    { value: 'chacha20_poly1305', label: 'ChaCha20-Poly1305' },
    { value: 'aes_128_gcm', label: 'AES-128-GCM' },
  ];
  
  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      // Create payload with both settings
      const payload = {
        preferredProtocol: protocol,
        preferredEncryption: encryption,
      };
      
      // Send request to server
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      
      if (response.ok) {
        // Get result
        const settings = await response.json();
        console.log('Settings updated:', settings);
        
        // Update global state
        vpnState.updateSettings({
          protocol: settings.preferredProtocol,
          encryption: settings.preferredEncryption
        });
        
        // Success message
        toast({
          title: 'Settings Updated',
          description: 'Your connection settings have been saved',
          variant: 'default',
        });
        
        // Update last saved time
        setLastSaved(new Date().toLocaleTimeString());
      } else {
        // Error from server
        const error = await response.json();
        throw new Error(error.message || 'Failed to update settings');
      }
    } catch (error) {
      console.error('Settings update error:', error);
      
      // Error message
      toast({
        title: 'Update Failed',
        description: error.message || 'Could not update settings',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Connection Settings</h2>
      
      <div className="space-y-4">
        <div>
          <label htmlFor="protocol" className="block text-sm font-medium mb-2">
            VPN Protocol
          </label>
          <select
            id="protocol"
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
            disabled={vpnState.connected || isSubmitting}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
          >
            {protocols.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
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
            onChange={(e) => setEncryption(e.target.value)}
            disabled={vpnState.connected || isSubmitting}
            className="w-full p-2 bg-gray-800 border border-gray-700 rounded-md text-white"
          >
            {encryptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="flex justify-between items-center pt-4">
        {lastSaved && (
          <span className="text-xs text-gray-400">Last saved: {lastSaved}</span>
        )}
        
        <button
          type="submit"
          disabled={vpnState.connected || isSubmitting}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md disabled:bg-gray-700 disabled:text-gray-400"
        >
          {isSubmitting ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
      
      {vpnState.connected && (
        <p className="text-yellow-500 text-sm mt-2">
          Disconnect from VPN to change protocol or encryption settings
        </p>
      )}
    </form>
  );
}