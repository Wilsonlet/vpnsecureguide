import { useEffect, useState } from 'react';
import { useVpnState } from '@/lib/vpn-service';
import { useToast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

export default function SettingsForm() {
  const { toast } = useToast();
  const vpnState = useVpnState();
  
  // Form state
  const [protocol, setProtocol] = useState(vpnState.protocol || 'openvpn_tcp');
  const [encryption, setEncryption] = useState(vpnState.encryption || 'aes_256_gcm');
  const [savingProtocol, setSavingProtocol] = useState(false);
  const [savingEncryption, setSavingEncryption] = useState(false);
  const [lastSaved, setLastSaved] = useState('');

  // Load settings from server on initial load
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/settings', { credentials: 'include' });
        if (res.ok) {
          const data = await res.json();
          if (data) {
            // Update local state
            setProtocol(data.preferredProtocol || 'openvpn_tcp');
            setEncryption(data.preferredEncryption || 'aes_256_gcm');
            
            // Update global state
            vpnState.updateSettings({
              protocol: data.preferredProtocol,
              encryption: data.preferredEncryption
            });
          }
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      }
    };
    
    loadSettings();
  }, [vpnState.updateSettings]);
  
  // Protocol and encryption options
  const protocols = [
    { value: 'openvpn_tcp', label: 'OpenVPN (TCP)', premium: false },
    { value: 'openvpn_udp', label: 'OpenVPN (UDP)', premium: false },
    { value: 'wireguard', label: 'WireGuard', premium: false },
    { value: 'ikev2', label: 'IKEv2/IPSec', premium: false },
    { value: 'shadowsocks', label: 'Shadowsocks', premium: true },
  ];
  
  const encryptions = [
    { value: 'aes_256_gcm', label: 'AES-256-GCM', premium: false },
    { value: 'aes_128_gcm', label: 'AES-128-GCM', premium: false },
    { value: 'chacha20_poly1305', label: 'ChaCha20-Poly1305', premium: true },
  ];
  
  // Handle protocol change - saves immediately
  const handleProtocolChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newProtocol = e.target.value;
    
    // Check if this is a premium protocol (Shadowsocks)
    const isPremiumProtocol = protocols.find(p => p.value === newProtocol)?.premium;
    
    // Prepare optimistic UI update
    setProtocol(newProtocol);
    setSavingProtocol(true);
    
    try {
      // This uses the general settings endpoint
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          preferredProtocol: newProtocol,
          // Include current encryption to avoid losing it
          preferredEncryption: encryption,
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        
        // Commit to global state
        vpnState.updateSettings({ 
          protocol: data.preferredProtocol 
        });
        
        // Success message
        toast({
          title: 'Protocol Updated',
          description: `Protocol changed to ${newProtocol.replace('_', ' ').toUpperCase()}`,
        });
        
        setLastSaved(new Date().toLocaleTimeString());
      } else {
        // API error - revert
        setProtocol(vpnState.protocol || 'openvpn_tcp');
        
        // Show error based on status
        if (response.status === 403) {
          toast({
            title: 'Premium Feature',
            description: 'This protocol requires a premium subscription',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Update Failed',
            description: 'Server rejected protocol change',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Protocol update error:', error);
      
      // Revert on error
      setProtocol(vpnState.protocol || 'openvpn_tcp');
      
      toast({
        title: 'Connection Error',
        description: 'Could not reach server to update protocol',
        variant: 'destructive',
      });
    } finally {
      setSavingProtocol(false);
    }
  };
  
  // Handle encryption change - saves immediately
  const handleEncryptionChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newEncryption = e.target.value;
    
    // Check if this is a premium encryption (ChaCha20)
    const isPremiumEncryption = encryptions.find(opt => opt.value === newEncryption)?.premium;
    
    // Prepare optimistic UI update
    setEncryption(newEncryption);
    setSavingEncryption(true);
    
    try {
      // This uses the general settings endpoint
      const response = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          preferredEncryption: newEncryption,
          // Include current protocol to avoid losing it
          preferredProtocol: protocol,
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        
        // Commit to global state
        vpnState.updateSettings({ 
          encryption: data.preferredEncryption 
        });
        
        // Success message
        toast({
          title: 'Encryption Updated',
          description: `Encryption changed to ${newEncryption.replace('_', ' ').toUpperCase()}`,
        });
        
        setLastSaved(new Date().toLocaleTimeString());
      } else {
        // API error - revert
        setEncryption(vpnState.encryption || 'aes_256_gcm');
        
        // Show error based on status
        if (response.status === 403) {
          toast({
            title: 'Premium Feature',
            description: 'This encryption requires a premium subscription',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Update Failed',
            description: 'Server rejected encryption change',
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      console.error('Encryption update error:', error);
      
      // Revert on error
      setEncryption(vpnState.encryption || 'aes_256_gcm');
      
      toast({
        title: 'Connection Error',
        description: 'Could not reach server to update encryption',
        variant: 'destructive',
      });
    } finally {
      setSavingEncryption(false);
    }
  };
  
  return (
    <div className="space-y-6 bg-gray-900 border border-gray-800 rounded-lg p-6">
      <h2 className="text-xl font-semibold mb-4">Connection Settings</h2>
      
      <div className="space-y-6">
        {/* Protocol Selection */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label htmlFor="protocol" className="text-sm font-medium">
              VPN Protocol
            </label>
            {savingProtocol && (
              <span className="text-xs text-blue-400 flex items-center">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Saving...
              </span>
            )}
          </div>
          
          <select
            id="protocol"
            value={protocol}
            onChange={handleProtocolChange}
            disabled={vpnState.connected || savingProtocol}
            className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-md text-white"
          >
            {protocols.map(option => (
              <option key={option.value} value={option.value}>
                {option.label} {option.premium ? '(Premium)' : ''}
              </option>
            ))}
          </select>
        </div>
        
        {/* Encryption Selection */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label htmlFor="encryption" className="text-sm font-medium">
              Encryption Method
            </label>
            {savingEncryption && (
              <span className="text-xs text-blue-400 flex items-center">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                Saving...
              </span>
            )}
          </div>
          
          <select
            id="encryption"
            value={encryption}
            onChange={handleEncryptionChange}
            disabled={vpnState.connected || savingEncryption}
            className="w-full p-2.5 bg-gray-800 border border-gray-700 rounded-md text-white"
          >
            {encryptions.map(option => (
              <option key={option.value} value={option.value}>
                {option.label} {option.premium ? '(Premium)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
      
      {lastSaved && (
        <div className="pt-2">
          <span className="text-xs text-gray-400">Last saved: {lastSaved}</span>
        </div>
      )}
      
      {vpnState.connected && (
        <p className="text-yellow-500 text-sm mt-4 bg-yellow-950/30 p-3 rounded-md border border-yellow-800/50">
          You must disconnect from the VPN before changing protocol or encryption settings
        </p>
      )}
    </div>
  );
}