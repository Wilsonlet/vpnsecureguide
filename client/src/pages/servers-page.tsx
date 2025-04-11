import { useState, useMemo } from 'react';
import Sidebar from '@/components/layout/sidebar';
import MobileNav from '@/components/layout/mobile-nav';
import Header from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { VpnServer, ServerRegion, serverRegions } from '@shared/schema';
import { useVpnState } from '@/lib/vpn-service.tsx';
import { 
  Search, Filter, Activity, BarChart3, Globe, Shield, 
  Lock, Unlock, Map, Zap, CheckCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

type RegionTabsProps = {
  activeRegion: string;
  onRegionChange: (region: string) => void;
  regionCounts: Record<string, number>;
};

function RegionTabs({ activeRegion, onRegionChange, regionCounts }: RegionTabsProps) {
  return (
    <TabsList className="grid grid-cols-3 md:grid-cols-6 bg-gray-900 border border-gray-800 p-1">
      <TabsTrigger 
        value="all" 
        className={activeRegion === 'all' ? 'data-[state=active]:bg-gray-800' : ''}
        onClick={() => onRegionChange('all')}
      >
        All ({Object.values(regionCounts).reduce((a, b) => a + b, 0)})
      </TabsTrigger>
      <TabsTrigger 
        value="europe" 
        className={activeRegion === 'europe' ? 'data-[state=active]:bg-gray-800' : ''}
        onClick={() => onRegionChange('europe')}
      >
        Europe ({regionCounts[serverRegions.EUROPE] || 0})
      </TabsTrigger>
      <TabsTrigger 
        value="north_america" 
        className={activeRegion === 'north_america' ? 'data-[state=active]:bg-gray-800' : ''}
        onClick={() => onRegionChange('north_america')}
      >
        N. America ({regionCounts[serverRegions.NORTH_AMERICA] || 0})
      </TabsTrigger>
      <TabsTrigger 
        value="asia_pacific" 
        className={activeRegion === 'asia_pacific' ? 'data-[state=active]:bg-gray-800' : ''}
        onClick={() => onRegionChange('asia_pacific')}
      >
        Asia ({regionCounts[serverRegions.ASIA_PACIFIC] || 0})
      </TabsTrigger>
      <TabsTrigger 
        value="africa" 
        className={activeRegion === 'africa' ? 'data-[state=active]:bg-gray-800' : ''}
        onClick={() => onRegionChange('africa')}
      >
        Africa ({regionCounts[serverRegions.AFRICA] || 0})
      </TabsTrigger>
      <TabsTrigger 
        value="middle_east" 
        className={activeRegion === 'middle_east' ? 'data-[state=active]:bg-gray-800' : ''}
        onClick={() => onRegionChange('middle_east')}
      >
        Middle East ({regionCounts[serverRegions.MIDDLE_EAST] || 0})
      </TabsTrigger>
    </TabsList>
  );
}

type ServerItemProps = {
  server: VpnServer;
  isSelected: boolean;
  isPremiumUser: boolean;
  onSelect: (server: VpnServer) => void;
};

function ServerItem({ server, isSelected, isPremiumUser, onSelect }: ServerItemProps) {
  return (
    <div 
      className={cn(
        "flex items-center p-4 hover:bg-gray-900 transition cursor-pointer",
        isSelected ? "bg-gray-900" : "",
        server.premium && !isPremiumUser ? "opacity-70" : ""
      )}
      onClick={() => onSelect(server)}
    >
      <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 mr-4">
        <Globe className="h-5 w-5 text-primary" />
      </div>
      
      <div className="flex-grow mr-4">
        <div className="flex items-center flex-wrap gap-1">
          <h4 className="font-medium">{server.name}</h4>
          {isSelected && (
            <span className="text-xs bg-primary px-2 py-0.5 rounded-full text-white">
              Selected
            </span>
          )}
          {server.premium && (
            <span className="text-xs bg-amber-600 px-2 py-0.5 rounded-full text-white">
              Premium
            </span>
          )}
          {server.obfuscated && (
            <span className="text-xs bg-purple-600 px-2 py-0.5 rounded-full text-white">
              Obfuscated
            </span>
          )}
          {server.double_hop && (
            <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full text-white">
              Double-Hop
            </span>
          )}
        </div>
        <div className="text-sm text-gray-400 mt-1">
          {server.city}, {server.country} ({server.region})
        </div>
      </div>
      
      <div className="flex items-center gap-6">
        <div className="flex flex-col items-center">
          <div className="flex items-center text-sm">
            <Activity className="h-4 w-4 mr-1 text-gray-400" />
            <span className={server.latency && server.latency < 100 ? 'text-green-500' : 'text-gray-400'}>
              {server.latency} ms
            </span>
          </div>
          <span className="text-xs text-gray-500">Latency</span>
        </div>
        
        <div className="flex flex-col items-center">
          <div className="flex items-center text-sm">
            <BarChart3 className="h-4 w-4 mr-1 text-gray-400" />
            <span className={server.load && server.load < 50 ? 'text-green-500' : server.load && server.load < 80 ? 'text-yellow-500' : 'text-red-500'}>
              {server.load}%
            </span>
          </div>
          <span className="text-xs text-gray-500">Load</span>
        </div>
      </div>
      
      <div className="ml-4 hidden md:block">
        {server.premium && !isPremiumUser ? (
          <div className="flex items-center text-xs text-amber-500">
            <Lock className="h-3 w-3 mr-1" />
            <span>Premium Only</span>
          </div>
        ) : (
          <div className="flex items-center text-xs text-green-500">
            <Unlock className="h-3 w-3 mr-1" />
            <span>Available</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ServersPage() {
  const { user } = useAuth();
  const vpnState = useVpnState();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [activeRegion, setActiveRegion] = useState('all');
  const [serverType, setServerType] = useState('all');
  
  // Fetch VPN server list grouped by regions
  const { data: regionsData = [], isLoading: isRegionsLoading } = useQuery({
    queryKey: ['/api/servers/regions'],
  });
  
  // Fetch all servers for filtering
  const { data: allServers = [], isLoading: isServersLoading } = useQuery<VpnServer[]>({
    queryKey: ['/api/servers'],
  });
  
  // Calculate region counts
  const regionCounts = useMemo(() => {
    return allServers.reduce((counts, server) => {
      counts[server.region] = (counts[server.region] || 0) + 1;
      return counts;
    }, {} as Record<string, number>);
  }, [allServers]);
  
  // Filter and sort servers
  const filteredServers = useMemo(() => {
    return allServers.filter(server => {
      // Search filter
      const matchesSearch = search === '' || 
        server.name.toLowerCase().includes(search.toLowerCase()) ||
        server.country.toLowerCase().includes(search.toLowerCase()) ||
        server.city.toLowerCase().includes(search.toLowerCase());
      
      // Region filter
      let matchesRegion = true;
      if (activeRegion !== 'all') {
        switch(activeRegion) {
          case 'europe':
            matchesRegion = server.region === serverRegions.EUROPE;
            break;
          case 'north_america':
            matchesRegion = server.region === serverRegions.NORTH_AMERICA;
            break;
          case 'asia_pacific':
            matchesRegion = server.region === serverRegions.ASIA_PACIFIC;
            break;
          case 'africa':
            matchesRegion = server.region === serverRegions.AFRICA;
            break;
          case 'middle_east':
            matchesRegion = server.region === serverRegions.MIDDLE_EAST;
            break;
        }
      }
      
      // Server type filter
      let matchesType = true;
      if (serverType !== 'all') {
        switch(serverType) {
          case 'standard':
            matchesType = !server.premium && !server.obfuscated && !server.double_hop;
            break;
          case 'premium':
            matchesType = server.premium;
            break;
          case 'obfuscated':
            matchesType = server.obfuscated;
            break;
          case 'double_hop':
            matchesType = server.double_hop;
            break;
        }
      }
      
      return matchesSearch && matchesRegion && matchesType;
    }).sort((a, b) => {
      // Sort servers
      switch(sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'country':
          return a.country.localeCompare(b.country);
        case 'region':
          return a.region.localeCompare(b.region);
        case 'latency':
          return (a.latency ?? 999) - (b.latency ?? 999);
        case 'load':
          return (a.load ?? 100) - (b.load ?? 100);
        default:
          return 0;
      }
    });
  }, [allServers, search, activeRegion, serverType, sortBy]);
  
  // Group servers by region for the UI
  const serversByRegion = useMemo(() => {
    return filteredServers.reduce((acc, server) => {
      if (!acc[server.region]) {
        acc[server.region] = [];
      }
      acc[server.region].push(server);
      return acc;
    }, {} as Record<string, VpnServer[]>);
  }, [filteredServers]);
  
  // Handle server selection
  const handleServerSelect = (server: VpnServer) => {
    // Don't allow premium server selection for non-premium users
    if (server.premium && user?.subscription !== 'premium') {
      return;
    }
    vpnState.selectServer(server);
  };
  
  // Check if user is premium
  const isPremiumUser = user?.subscription === 'premium';
  
  const isLoading = isRegionsLoading || isServersLoading;
  
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar for desktop */}
      <Sidebar />
      
      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {/* Top header */}
        <Header username={user?.username || ''} />
        
        {/* Servers content */}
        <div className="p-4 md:p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <Input 
                type="text" 
                placeholder="Search servers..." 
                className="pl-10 bg-gray-800 border-gray-700 w-full md:w-80"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2">
                <Filter size={16} className="text-gray-400" />
                <span className="text-sm text-gray-400">Type:</span>
                <Select value={serverType} onValueChange={setServerType}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 w-[140px]">
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="premium">Premium</SelectItem>
                    <SelectItem value="obfuscated">Obfuscated</SelectItem>
                    <SelectItem value="double_hop">Double-Hop</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex items-center gap-2">
                <BarChart3 size={16} className="text-gray-400" />
                <span className="text-sm text-gray-400">Sort by:</span>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 w-[140px]">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">Name</SelectItem>
                    <SelectItem value="country">Country</SelectItem>
                    <SelectItem value="region">Region</SelectItem>
                    <SelectItem value="latency">Latency</SelectItem>
                    <SelectItem value="load">Server Load</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          
          <Tabs defaultValue="all" value={activeRegion} onValueChange={setActiveRegion} className="w-full">
            <div className="mb-4 overflow-x-auto">
              <RegionTabs 
                activeRegion={activeRegion} 
                onRegionChange={setActiveRegion} 
                regionCounts={regionCounts}
              />
            </div>
            
            <Card className="border border-gray-800 shadow-lg bg-gray-950">
              <CardHeader className="border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium">Server Network</h3>
                  <div className="text-sm text-gray-400">
                    {filteredServers.length} servers available
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : filteredServers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Globe className="h-12 w-12 text-gray-500 mb-3" />
                    <h3 className="text-xl font-medium mb-1">No servers found</h3>
                    <p className="text-gray-400 max-w-md">
                      Try adjusting your search filters or try again later.
                    </p>
                  </div>
                ) : (
                  <div>
                    {activeRegion === 'all' ? (
                      // Show servers grouped by region when "All" is selected
                      Object.entries(serversByRegion).sort().map(([region, regionServers]) => (
                        <div key={region} className="mb-2">
                          <div className="bg-gray-900 p-3 font-medium text-white flex items-center">
                            <Map className="mr-2 h-5 w-5 text-primary" />
                            {region} ({regionServers.length})
                          </div>
                          <div className="grid grid-cols-1 divide-y divide-gray-800">
                            {regionServers.map((server) => (
                              <ServerItem 
                                key={server.id}
                                server={server} 
                                isSelected={vpnState.selectedServer?.id === server.id}
                                isPremiumUser={isPremiumUser}
                                onSelect={handleServerSelect}
                              />
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      // Show flat list of servers when a specific region is selected
                      <div className="grid grid-cols-1 divide-y divide-gray-800">
                        {filteredServers.map((server) => (
                          <ServerItem 
                            key={server.id}
                            server={server} 
                            isSelected={vpnState.selectedServer?.id === server.id}
                            isPremiumUser={isPremiumUser}
                            onSelect={handleServerSelect}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </Tabs>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <Shield className="h-5 w-5 text-amber-500" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-white">Premium Servers</h4>
                  <p className="mt-1 text-xs text-gray-400">
                    Premium servers offer higher speeds, less congestion, and are available exclusively to premium subscribers.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <Zap className="h-5 w-5 text-purple-500" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-white">Obfuscated Servers</h4>
                  <p className="mt-1 text-xs text-gray-400">
                    Bypass network restrictions by disguising your VPN traffic as regular HTTPS traffic. Ideal for restrictive networks.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
              <div className="flex items-start">
                <div className="flex-shrink-0 mt-1">
                  <CheckCircle className="h-5 w-5 text-blue-500" />
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-white">Double-Hop Servers</h4>
                  <p className="mt-1 text-xs text-gray-400">
                    Route your traffic through two VPN servers for an additional layer of security and privacy.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      {/* Mobile navigation */}
      <MobileNav />
    </div>
  );
}