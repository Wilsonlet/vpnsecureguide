import { useEffect } from 'react';
import Sidebar from '@/components/layout/sidebar';
import MobileNav from '@/components/layout/mobile-nav';
import Header from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useVpnState } from '@/lib/vpn-service.tsx';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { VpnUserSettings } from '@shared/schema';

export default function SettingsPage() {
  const { user } = useAuth();
  const vpnState = useVpnState();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Fetch user VPN settings
  const { data: settings } = useQuery<VpnUserSettings>({
    queryKey: ['/api/settings'],
  });
  
  // Initialize VPN state from server data on first load
  useEffect(() => {
    if (settings) {
      vpnState.updateSettings({
        killSwitch: settings.killSwitch ?? false,
        dnsLeakProtection: settings.dnsLeakProtection ?? false,
        doubleVpn: settings.doubleVpn ?? false,
        obfuscation: settings.obfuscation ?? false,
        protocol: settings.preferredProtocol ?? "openvpn_tcp",
        encryption: settings.preferredEncryption ?? "aes-256-gcm"
      });
    }
  }, [settings, vpnState]);
  
  // Save settings to the server
  const handleSaveSettings = async () => {
    try {
      const res = await apiRequest('POST', '/api/settings', {
        killSwitch: vpnState.killSwitch,
        dnsLeakProtection: vpnState.dnsLeakProtection,
        doubleVpn: vpnState.doubleVpn,
        obfuscation: vpnState.obfuscation,
        preferredProtocol: vpnState.protocol,
        preferredEncryption: vpnState.encryption
      });
      
      if (res.ok) {
        toast({
          title: 'Settings Saved',
          description: 'Your VPN settings have been updated successfully.',
        });
        
        // Refresh settings data
        queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Settings error:', error);
      toast({
        title: 'Settings Error',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive'
      });
    }
  };
  
  // Handle toggle switches
  const handleToggle = (setting: keyof VpnUserSettings, value: boolean) => {
    vpnState.updateSettings({
      [setting]: value
    } as any);
  };
  
  // Handle protocol selection
  const handleProtocolChange = (value: string) => {
    vpnState.updateSettings({
      protocol: value
    });
  };
  
  // Handle encryption selection
  const handleEncryptionChange = (value: string) => {
    vpnState.updateSettings({
      encryption: value
    });
  };
  
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar for desktop */}
      <Sidebar />
      
      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {/* Top header */}
        <Header username={user?.username || ''} />
        
        {/* Settings content */}
        <div className="p-4 md:p-6 space-y-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid grid-cols-3 mb-8">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="connection">Connection</TabsTrigger>
              <TabsTrigger value="advanced">Advanced</TabsTrigger>
            </TabsList>
            
            <TabsContent value="general">
              <Card className="border border-gray-800 shadow-lg bg-gray-950">
                <CardHeader className="border-b border-gray-800">
                  <h3 className="text-lg font-medium">General Settings</h3>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Auto-Connect on Startup</h4>
                        <p className="text-sm text-gray-400 mt-1">Automatically connect to VPN when application starts</p>
                      </div>
                      <Switch 
                        checked={false} 
                        onCheckedChange={() => {}} 
                        disabled={user?.subscription === 'free'}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Quick Connect</h4>
                        <p className="text-sm text-gray-400 mt-1">Choose preferred server for one-click connect</p>
                      </div>
                      <Select disabled={user?.subscription === 'free'}>
                        <SelectTrigger className="w-[180px] bg-gray-800 border-gray-700">
                          <SelectValue placeholder="Fastest server" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fastest">Fastest server</SelectItem>
                          <SelectItem value="nearest">Nearest server</SelectItem>
                          <SelectItem value="random">Random server</SelectItem>
                          <SelectItem value="last">Last used server</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Start with Windows</h4>
                        <p className="text-sm text-gray-400 mt-1">Launch application when Windows starts</p>
                      </div>
                      <Switch 
                        checked={false} 
                        onCheckedChange={() => {}} 
                        disabled={user?.subscription === 'free'}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="connection">
              <Card className="border border-gray-800 shadow-lg bg-gray-950">
                <CardHeader className="border-b border-gray-800">
                  <h3 className="text-lg font-medium">Connection Settings</h3>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-8">
                    <div className="flex flex-col space-y-3">
                      <Label htmlFor="protocol">Preferred Protocol</Label>
                      <Select value={vpnState.protocol} onValueChange={handleProtocolChange}>
                        <SelectTrigger className="w-full bg-gray-800 border-gray-700">
                          <SelectValue placeholder="Select protocol" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openvpn_tcp">OpenVPN (TCP)</SelectItem>
                          <SelectItem value="openvpn_udp">OpenVPN (UDP)</SelectItem>
                          <SelectItem value="wireguard">WireGuard</SelectItem>
                          <SelectItem value="ikev2">IKEv2/IPSec</SelectItem>
                          <SelectItem value="shadowsocks" disabled={user?.subscription === 'free'}>Shadowsocks</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-400">TCP is more reliable, UDP is faster but may be blocked in some networks.</p>
                    </div>
                    
                    <div className="flex flex-col space-y-3">
                      <Label htmlFor="encryption">Encryption Level</Label>
                      <Select value={vpnState.encryption} onValueChange={handleEncryptionChange}>
                        <SelectTrigger className="w-full bg-gray-800 border-gray-700">
                          <SelectValue placeholder="Select encryption" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="aes-256-gcm">AES-256-GCM</SelectItem>
                          <SelectItem value="chacha20-poly1305">ChaCha20-Poly1305</SelectItem>
                          <SelectItem value="aes-128-gcm">AES-128-GCM</SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-400">AES-256-GCM offers military-grade encryption. ChaCha20 can be faster on mobile devices.</p>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Internet Kill Switch</h4>
                        <p className="text-sm text-gray-400 mt-1">Block all internet traffic if VPN disconnects</p>
                      </div>
                      <Switch 
                        checked={vpnState.killSwitch} 
                        onCheckedChange={(checked) => handleToggle('killSwitch', checked)} 
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">DNS Leak Protection</h4>
                        <p className="text-sm text-gray-400 mt-1">Ensure DNS requests go through the VPN tunnel</p>
                      </div>
                      <Switch 
                        checked={vpnState.dnsLeakProtection} 
                        onCheckedChange={(checked) => handleToggle('dnsLeakProtection', checked)} 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="advanced">
              <Card className="border border-gray-800 shadow-lg bg-gray-950">
                <CardHeader className="border-b border-gray-800">
                  <h3 className="text-lg font-medium">Advanced Security</h3>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Double VPN</h4>
                        <p className="text-sm text-gray-400 mt-1">Route traffic through two VPN servers for additional security</p>
                      </div>
                      <Switch 
                        checked={vpnState.doubleVpn} 
                        onCheckedChange={(checked) => handleToggle('doubleVpn', checked)} 
                        disabled={user?.subscription === 'free'}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Obfuscation</h4>
                        <p className="text-sm text-gray-400 mt-1">Disguise VPN traffic to bypass network restrictions</p>
                      </div>
                      <Switch 
                        checked={vpnState.obfuscation} 
                        onCheckedChange={(checked) => handleToggle('obfuscation', checked)} 
                        disabled={user?.subscription === 'free'}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Split Tunneling</h4>
                        <p className="text-sm text-gray-400 mt-1">Choose which apps use the VPN connection</p>
                      </div>
                      <Switch 
                        checked={false} 
                        onCheckedChange={() => {}} 
                        disabled={user?.subscription === 'free'}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Custom DNS</h4>
                        <p className="text-sm text-gray-400 mt-1">Use a specific DNS server with your VPN connection</p>
                      </div>
                      <Switch 
                        checked={false} 
                        onCheckedChange={() => {}} 
                        disabled={user?.subscription === 'free'}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          <div className="flex justify-end">
            <button 
              className="px-6 py-2 bg-primary text-white rounded-md font-medium hover:bg-primary/90"
              onClick={handleSaveSettings}
            >
              Save Settings
            </button>
          </div>
        </div>
      </main>
      
      {/* Mobile navigation */}
      <MobileNav />
    </div>
  );
}