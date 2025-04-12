/**
 * Simple Settings Form
 * 
 * A back-to-basics no-frills form that should work reliably.
 * Minimal dependencies, minimal state, minimal API calls.
 */

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useVpnState } from '@/lib/vpn-service';

export default function SimpleSettingsForm() {
  const vpnState = useVpnState();
  const [protocol, setProtocol] = useState(vpnState.protocol || 'wireguard');
  const [encryption, setEncryption] = useState(vpnState.encryption || 'aes_256_gcm');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Load settings from VPN state when component mounts or vpnState changes
  useEffect(() => {
    // Only update if the vpnState has valid values
    if (vpnState.protocol) {
      setProtocol(vpnState.protocol);
    }
    if (vpnState.encryption) {
      setEncryption(vpnState.encryption);
    }
  }, [vpnState.protocol, vpnState.encryption]);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setSaving(true);
    
    try {
      // Use the dedicated protocol endpoint first
      const protocolResponse = await fetch('/api/protocol', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          protocol: protocol, // Use the field name expected by the server
        }),
        credentials: 'include',
      });
      
      if (!protocolResponse.ok) {
        const errorText = await protocolResponse.text();
        setError(`Failed to save protocol: ${errorText}`);
        return;
      }
      
      // Next, use the dedicated encryption endpoint
      const encryptionResponse = await fetch('/api/encryption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          encryption: encryption, // Use the field name expected by the server
        }),
        credentials: 'include',
      });
      
      if (!encryptionResponse.ok) {
        const errorText = await encryptionResponse.text();
        setError(`Failed to save encryption: ${errorText}`);
        return;
      }
      
      // If both requests are successful, get the settings to ensure we have the latest values
      const settingsResponse = await fetch('/api/settings', {
        credentials: 'include',
      });
      
      if (settingsResponse.ok) {
        const settings = await settingsResponse.json();
        console.log('Settings retrieved successfully:', settings);
        
        setMessage(`Settings saved successfully at ${new Date().toLocaleTimeString()}`);
        
        // Update the global VPN state with server response data
        vpnState.updateSettings({
          protocol: settings.preferredProtocol,
          encryption: settings.preferredEncryption
        });
        
        // Also explicitly update the local state variables
        setProtocol(settings.preferredProtocol);
        setEncryption(settings.preferredEncryption);
        
        console.log('Updated protocol to:', settings.preferredProtocol, 'and encryption to:', settings.preferredEncryption);
      } else {
        // Still consider this a success since the individual updates worked
        setMessage(`Settings saved successfully at ${new Date().toLocaleTimeString()}`);
      }
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <div className="border border-gray-800 rounded-lg p-6 bg-gray-900">
      <h2 className="text-xl font-medium mb-6">Connection Settings</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="protocol" className="block mb-2 text-sm font-medium">VPN Protocol</label>
          <select
            id="protocol"
            value={protocol}
            onChange={(e) => setProtocol(e.target.value)}
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
            className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded text-white"
          >
            <option value="aes_256_gcm">AES-256-GCM</option>
            <option value="aes_128_gcm">AES-128-GCM</option>
            <option value="chacha20_poly1305">ChaCha20-Poly1305 (Premium)</option>
          </select>
        </div>
        
        <Button 
          type="submit"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded"
          disabled={saving}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </Button>
        
        {message && (
          <div className="mt-4 p-3 bg-green-900/30 border border-green-800 rounded text-green-300">
            {message}
          </div>
        )}
        
        {error && (
          <div className="mt-4 p-3 bg-red-900/30 border border-red-800 rounded text-red-300">
            {error}
          </div>
        )}
      </form>
    </div>
  );
}