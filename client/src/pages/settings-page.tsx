import { useEffect, useState } from 'react';
import Sidebar from '@/components/layout/sidebar';
import MobileNav from '@/components/layout/mobile-nav';
import Header from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';
import { useVpnState } from '@/lib/vpn-service.tsx';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { VpnUserSettings, VpnServer } from '@shared/schema';

export default function SettingsPage() {
  const { user } = useAuth();
  const vpnState = useVpnState();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoadingServers, setIsLoadingServers] = useState(false);
  
  // Fetch user VPN settings
  const { data: settings } = useQuery<VpnUserSettings>({
    queryKey: ['/api/settings'],
  });
  
  // Fetch available servers
  const { data: servers = [] } = useQuery<VpnServer[]>({
    queryKey: ['/api/servers'],
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
  
  // Load servers into VPN state
  useEffect(() => {
    if (servers.length > 0 && (!vpnState.availableServers || vpnState.availableServers.length === 0)) {
      vpnState.setAvailableServers(servers);
    }
  }, [servers, vpnState]);
  
  // Function to handle server selection
  const handleSelectServer = (server: VpnServer) => {
    vpnState.selectServer(server);
    toast({
      title: 'Server Selected',
      description: `${server.name} (${server.country}) will be used for your next connection`,
    });
  };
  
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
                        checked={vpnState.autoConnect || false} 
                        onCheckedChange={(checked) => vpnState.updateSettings({ autoConnect: checked })} 
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Quick Connect</h4>
                        <p className="text-sm text-gray-400 mt-1">Choose preferred server for one-click connect</p>
                      </div>
                      <Select 
                        value={vpnState.quickConnectType || 'fastest'} 
                        onValueChange={(value) => vpnState.updateSettings({ quickConnectType: value })}
                      >
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
                        checked={vpnState.startWithSystem || false} 
                        onCheckedChange={(checked) => vpnState.updateSettings({ startWithSystem: checked })} 
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="connection">
              <Card className="border border-gray-800 shadow-lg bg-gray-950 mb-6">
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
              
              {/* Server Selection Card */}
              <Card className="border border-gray-800 shadow-lg bg-gray-950">
                <CardHeader className="border-b border-gray-800">
                  <h3 className="text-lg font-medium">Server Selection</h3>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="mb-4">
                    <p className="text-sm text-gray-400">
                      Choose a preferred server for your VPN connection. This server will be used for your next connection.
                    </p>
                  </div>
                  
                  {/* Current Server */}
                  {vpnState.selectedServer && (
                    <div className="mb-6 p-4 border border-gray-800 rounded-lg bg-gray-900">
                      <h4 className="text-sm font-medium text-gray-400 mb-2">CURRENT SERVER</h4>
                      <div className="flex items-center">
                        <div className="flex-1">
                          <p className="font-medium">{vpnState.selectedServer.name}</p>
                          <p className="text-sm text-gray-400">{vpnState.selectedServer.country}</p>
                        </div>
                        <div className="flex gap-2">
                          <div className="text-xs bg-gray-800 rounded px-2 py-1">
                            {vpnState.selectedServer.latency} ms
                          </div>
                          <div className="text-xs bg-gray-800 rounded px-2 py-1">
                            {vpnState.selectedServer.load}% load
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Server List */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-medium">Available Servers</h4>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                        onClick={() => {
                          setIsLoadingServers(true);
                          queryClient.invalidateQueries({ queryKey: ['/api/servers'] })
                            .then(() => {
                              toast({
                                title: 'Servers Refreshed',
                                description: 'The server list has been updated with the latest data',
                              });
                            })
                            .finally(() => {
                              setIsLoadingServers(false);
                            });
                        }}
                        disabled={isLoadingServers}
                      >
                        {isLoadingServers ? 'Refreshing...' : 'Refresh'}
                      </Button>
                    </div>
                    
                    <div className="max-h-[350px] overflow-y-auto pr-2 -mr-2 space-y-2">
                      {servers.length > 0 ? servers.map(server => (
                        <div 
                          key={server.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            vpnState.selectedServer?.id === server.id
                              ? 'bg-primary/10 border-primary/30'
                              : 'bg-gray-800 border-gray-700 hover:bg-gray-700'
                          }`}
                          onClick={() => handleSelectServer(server)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">{server.name}</p>
                              <p className="text-sm text-gray-400">{server.country}, {server.city}</p>
                            </div>
                            <div className="flex gap-2">
                              {server.premium && (
                                <span className="px-2 py-1 text-xs rounded bg-amber-900/30 text-amber-400 border border-amber-900">
                                  Premium
                                </span>
                              )}
                              <div className="text-sm bg-gray-700 rounded px-2">
                                {server.latency} ms
                              </div>
                              <div className={`text-sm rounded px-2 ${
                                (server.load || 0) < 30 
                                  ? 'bg-green-900/30 text-green-400' 
                                  : (server.load || 0) < 70 
                                    ? 'bg-amber-900/30 text-amber-400' 
                                    : 'bg-red-900/30 text-red-400'
                              }`}>
                                {server.load}%
                              </div>
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="text-center p-8 text-gray-400">
                          {isLoadingServers 
                            ? 'Loading servers...' 
                            : 'No servers available. Try refreshing the list.'}
                        </div>
                      )}
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
                        checked={vpnState.splitTunneling || false} 
                        onCheckedChange={(checked) => vpnState.updateSettings({ splitTunneling: checked })} 
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Custom DNS</h4>
                        <p className="text-sm text-gray-400 mt-1">Use a specific DNS server with your VPN connection</p>
                      </div>
                      <Switch 
                        checked={vpnState.customDns || false} 
                        onCheckedChange={(checked) => vpnState.updateSettings({ customDns: checked })} 
                      />
                    </div>
                    
                    {vpnState.customDns && (
                      <div className="mt-3 ml-6">
                        <div className="flex flex-col space-y-2">
                          <Label htmlFor="customDns">DNS Server</Label>
                          <Input
                            id="customDns"
                            placeholder="e.g., 1.1.1.1"
                            className="bg-gray-800 border-gray-700 w-full max-w-xs"
                            value={vpnState.customDnsServer || '1.1.1.1'}
                            onChange={(e) => vpnState.updateSettings({ customDnsServer: e.target.value })}
                          />
                          <p className="text-xs text-gray-400">Enter the IP address of your preferred DNS server</p>
                        </div>
                      </div>
                    )}
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