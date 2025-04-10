import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useVpnState } from '@/lib/vpn-service.tsx';
import type { VpnServer } from '@shared/schema';

type ServerMapProps = {
  servers: VpnServer[];
  className?: string;
};

export default function ServerMap({ servers, className = '' }: ServerMapProps) {
  const vpnState = useVpnState();
  const [region, setRegion] = useState('all');
  const [filteredServers, setFilteredServers] = useState<VpnServer[]>([]);
  
  // Update the filtered servers based on region selection
  useEffect(() => {
    if (region === 'all') {
      setFilteredServers(servers);
      vpnState.setAvailableServers(servers);
    } else {
      const filtered = servers.filter(server => {
        switch(region) {
          case 'europe':
            return ['UK', 'Germany', 'Netherlands'].includes(server.country);
          case 'america':
            return ['US'].includes(server.country);
          case 'asia':
            return ['Singapore'].includes(server.country);
          case 'africa':
            return ['Nigeria', 'South Africa'].includes(server.country);
          case 'middle_east':
            return ['UAE'].includes(server.country);
          default:
            return true;
        }
      });
      setFilteredServers(filtered);
      vpnState.setAvailableServers(filtered);
    }
  }, [region, servers]);

  // Handle server selection
  const handleServerSelect = (server: VpnServer) => {
    vpnState.selectServer(server);
  };
  
  // Group locations for world map display
  const serverLocations = {
    us: { top: 100, left: 160 },
    us_west: { top: 95, left: 120 },
    uk: { top: 85, left: 280 },
    germany: { top: 90, left: 300 },
    netherlands: { top: 85, left: 290 },
    singapore: { top: 150, left: 450 },
    nigeria: { top: 160, left: 290 },
    south_africa: { top: 190, left: 320 },
    uae: { top: 130, left: 370 }
  };
  
  // Map country to location key
  const getLocationKey = (country: string): keyof typeof serverLocations => {
    switch(country) {
      case 'US': return 'us';
      case 'UK': return 'uk';
      case 'Germany': return 'germany';
      case 'Netherlands': return 'netherlands';
      case 'Singapore': return 'singapore';
      case 'Nigeria': return 'nigeria';
      case 'South Africa': return 'south_africa';
      case 'UAE': return 'uae';
      default: return 'us';
    }
  };

  return (
    <Card className={`border border-gray-800 shadow-lg bg-gray-950 ${className}`}>
      <CardHeader className="border-b border-gray-800 flex justify-between items-center p-5">
        <h3 className="font-medium">Global Server Network</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Server Region:</span>
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
      </CardHeader>
      <CardContent className="p-5">
        <div className="relative h-[240px] bg-gray-900 rounded-lg overflow-hidden">
          {/* World map visualization */}
          {servers.map((server) => {
            const location = serverLocations[getLocationKey(server.country)];
            const isSelected = vpnState.selectedServer?.id === server.id;
            
            return (
              <div 
                key={server.id}
                className={`absolute w-3 h-3 ${
                  isSelected 
                    ? 'w-4 h-4 bg-teal-500 border-2 border-white opacity-100' 
                    : 'bg-green-500 opacity-80'
                } rounded-full cursor-pointer`}
                style={{ top: `${location.top}px`, left: `${location.left}px` }}
                onClick={() => handleServerSelect(server)}
                title={`${server.name} (${server.country})`}
              />
            );
          })}
        </div>
        
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filteredServers.map((server) => (
            <div 
              key={server.id}
              className="flex items-center p-3 bg-gray-800 rounded-lg hover:bg-gray-700 cursor-pointer transition"
              onClick={() => handleServerSelect(server)}
            >
              <div className="flex-shrink-0 mr-3">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
              </div>
              <div className="flex-grow">
                <div className="text-sm font-medium">{server.country}</div>
                <div className="text-xs text-gray-400 flex items-center">
                  <span>{server.latency} ms</span>
                  <span className="mx-1">•</span>
                  <span>{server.load}% load</span>
                </div>
              </div>
              <div>
                <button className="text-teal-400 hover:text-teal-300">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M12 5l7 7-7 7"></path>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
