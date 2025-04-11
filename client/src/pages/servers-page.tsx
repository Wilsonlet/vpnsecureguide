import { useState } from 'react';
import Sidebar from '@/components/layout/sidebar';
import MobileNav from '@/components/layout/mobile-nav';
import Header from '@/components/layout/header';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { VpnServer } from '@shared/schema';
import { useVpnState } from '@/lib/vpn-service.tsx';
import { Search, Filter, Activity, BarChart3, Globe, Shield } from 'lucide-react';

export default function ServersPage() {
  const { user } = useAuth();
  const vpnState = useVpnState();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [region, setRegion] = useState('all');
  
  // Fetch VPN server list
  const { data: servers = [], isLoading } = useQuery<VpnServer[]>({
    queryKey: ['/api/servers'],
  });
  
  // Filter and sort servers
  const filteredServers = servers.filter(server => {
    // Search filter
    const matchesSearch = search === '' || 
      server.name.toLowerCase().includes(search.toLowerCase()) ||
      server.country.toLowerCase().includes(search.toLowerCase());
    
    // Region filter
    let matchesRegion = true;
    if (region !== 'all') {
      switch(region) {
        case 'europe':
          matchesRegion = ['UK', 'Germany', 'Netherlands'].includes(server.country);
          break;
        case 'america':
          matchesRegion = ['US'].includes(server.country);
          break;
        case 'asia':
          matchesRegion = ['Singapore'].includes(server.country);
          break;
        case 'africa':
          matchesRegion = ['Nigeria', 'South Africa'].includes(server.country);
          break;
        case 'middle_east':
          matchesRegion = ['UAE'].includes(server.country);
          break;
      }
    }
    
    return matchesSearch && matchesRegion;
  }).sort((a, b) => {
    // Sort servers
    switch(sortBy) {
      case 'name':
        return a.name.localeCompare(b.name);
      case 'country':
        return a.country.localeCompare(b.country);
      case 'latency':
        return (a.latency ?? 999) - (b.latency ?? 999);
      case 'load':
        return (a.load ?? 100) - (b.load ?? 100);
      default:
        return 0;
    }
  });
  
  // Handle server selection
  const handleServerSelect = (server: VpnServer) => {
    vpnState.selectServer(server);
  };
  
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
                <span className="text-sm text-gray-400">Region:</span>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 w-[140px]">
                    <SelectValue placeholder="All Regions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    <SelectItem value="europe">Europe</SelectItem>
                    <SelectItem value="america">North America</SelectItem>
                    <SelectItem value="asia">Asia</SelectItem>
                    <SelectItem value="africa">Africa</SelectItem>
                    <SelectItem value="middle_east">Middle East</SelectItem>
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
                    <SelectItem value="latency">Latency</SelectItem>
                    <SelectItem value="load">Server Load</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
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
              <div className="grid grid-cols-1 divide-y divide-gray-800">
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
                  filteredServers.map((server) => {
                    const isSelected = vpnState.selectedServer?.id === server.id;
                    
                    return (
                      <div 
                        key={server.id} 
                        className={`flex items-center p-4 hover:bg-gray-900 transition cursor-pointer ${isSelected ? 'bg-gray-900' : ''}`}
                        onClick={() => handleServerSelect(server)}
                      >
                        <div className="w-10 h-10 rounded-full bg-gray-800 flex items-center justify-center flex-shrink-0 mr-4">
                          <Globe className="h-5 w-5 text-primary" />
                        </div>
                        
                        <div className="flex-grow mr-4">
                          <div className="flex items-center">
                            <h4 className="font-medium">{server.name}</h4>
                            {isSelected && (
                              <span className="ml-2 text-xs bg-primary px-2 py-0.5 rounded-full text-white">Selected</span>
                            )}
                            {server.premium && user?.subscription !== 'premium' && (
                              <span className="ml-2 text-xs bg-amber-600 px-2 py-0.5 rounded-full text-white">Premium</span>
                            )}
                          </div>
                          <div className="text-sm text-gray-400">{server.country}</div>
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
                        
                        <div className="ml-4">
                          {server.premium && (
                            <div className="flex items-center text-xs text-gray-400">
                              <Shield className="h-3 w-3 mr-1" />
                              <span>Premium</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
          
          <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
            <div className="text-sm text-gray-400">
              <strong className="text-white">Note:</strong> Servers marked with 'Premium' are available exclusively to premium subscribers. Upgrade your subscription to access all servers and features.
            </div>
          </div>
        </div>
      </main>
      
      {/* Mobile navigation */}
      <MobileNav />
    </div>
  );
}