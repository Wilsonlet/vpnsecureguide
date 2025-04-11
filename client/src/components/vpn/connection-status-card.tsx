import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ToggleSwitch from '@/components/common/toggle-switch';
import { useVpnState } from '@/lib/vpn-service.tsx';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';

export default function ConnectionStatusCard() {
  const vpnState = useVpnState();
  const { toast } = useToast();
  const [connectionTime, setConnectionTime] = useState('00:00:00');
  
  // Start a timer to track connection time
  useEffect(() => {
    let timer: NodeJS.Timeout;
    
    if (vpnState.connected) {
      const startTime = vpnState.connectTime || new Date();
      
      const updateTimer = () => {
        const now = new Date();
        const diffInSeconds = Math.floor((now.getTime() - startTime.getTime()) / 1000);
        
        const hours = Math.floor(diffInSeconds / 3600);
        const minutes = Math.floor((diffInSeconds % 3600) / 60);
        const seconds = diffInSeconds % 60;
        
        const timeString = [
          hours.toString().padStart(2, '0'),
          minutes.toString().padStart(2, '0'),
          seconds.toString().padStart(2, '0')
        ].join(':');
        
        setConnectionTime(timeString);
      };
      
      // Update immediately and then every second
      updateTimer();
      timer = setInterval(updateTimer, 1000);
    } else {
      setConnectionTime('00:00:00');
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [vpnState.connected, vpnState.connectTime]);
  
  // Handle connection toggle
  const handleConnectionToggle = async (checked: boolean) => {
    try {
      if (checked) {
        // First, make sure we have servers data
        if (!vpnState.availableServers || vpnState.availableServers.length === 0) {
          // Try to fetch servers if they're not available
          try {
            const res = await apiRequest('GET', '/api/servers');
            if (res.ok) {
              const serversData = await res.json();
              if (Array.isArray(serversData) && serversData.length > 0) {
                vpnState.setAvailableServers(serversData);
                // Auto-select the first server
                vpnState.selectServer(serversData[0]);
                // Wait for state update
                await new Promise(resolve => setTimeout(resolve, 100));
              } else {
                throw new Error("No servers available from API");
              }
            } else {
              throw new Error("Failed to fetch VPN servers");
            }
          } catch (error) {
            console.error("Server fetch error:", error);
            toast({
              title: 'Server Error',
              description: 'Unable to fetch available VPN servers. Please refresh and try again.',
              variant: 'destructive'
            });
            return;
          }
        }
        
        // If no server is selected, use the first available one
        if (!vpnState.selectedServer && vpnState.availableServers.length > 0) {
          const firstServer = vpnState.availableServers[0];
          vpnState.selectServer(firstServer);
          
          // Give a small delay to ensure the state update has completed
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Double-check we have a server or pick one from available servers
        const serverToUse = vpnState.selectedServer || 
                          (vpnState.availableServers.length > 0 ? vpnState.availableServers[0] : null);
        
        // Start a VPN session on the backend
        if (serverToUse) {
          console.log("Starting VPN session with:", {
            serverId: serverToUse.id,
            protocol: vpnState.protocol,
            encryption: vpnState.encryption
          });
          
          const res = await apiRequest('POST', '/api/sessions/start', {
            serverId: serverToUse.id,
            protocol: vpnState.protocol,
            encryption: vpnState.encryption
          });
          
          if (res.ok) {
            const sessionData = await res.json();
            console.log("Session started:", sessionData);
            
            // Update VPN state with virtual IP from response
            vpnState.connect({
              serverId: serverToUse.id,
              protocol: vpnState.protocol,
              encryption: vpnState.encryption,
              server: serverToUse
            });
            
            // Set virtual IP if available
            if (sessionData.virtualIp) {
              vpnState.updateSettings({
                virtualIp: sessionData.virtualIp
              });
            }
            
            toast({
              title: 'Connected',
              description: `Successfully connected to ${serverToUse.name} (${serverToUse.country})`,
            });
            
            // Refresh current session data
            queryClient.invalidateQueries({ queryKey: ['/api/sessions/current'] });
          } else {
            console.error("Failed to start session:", await res.text());
            throw new Error("Failed to start VPN session");
          }
        } else {
          toast({
            title: 'Connection Error',
            description: 'No VPN servers available. Please refresh and try again.',
            variant: 'destructive'
          });
          return;
        }
      } else {
        // End the current VPN session
        const res = await apiRequest('POST', '/api/sessions/end');
        
        if (res.ok) {
          vpnState.disconnect();
          toast({
            title: 'Disconnected',
            description: 'VPN connection terminated successfully',
          });
          
          // Refresh current session data
          queryClient.invalidateQueries({ queryKey: ['/api/sessions/current'] });
        } else {
          console.error("Failed to end session:", await res.text());
          throw new Error("Failed to end VPN session");
        }
      }
    } catch (error) {
      console.error("Connection error:", error);
      toast({
        title: 'Connection Error',
        description: error instanceof Error ? error.message : 'Failed to manage VPN connection',
        variant: 'destructive'
      });
    }
  };

  return (
    <Card className="border border-gray-800 shadow-lg bg-gray-950">
      <CardContent className="p-6 md:p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-1 md:space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${vpnState.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <h3 className="text-sm font-medium text-gray-400">STATUS</h3>
            </div>
            <div className="md:mt-1">
              <h2 className="text-xl md:text-2xl font-bold">
                {vpnState.connected ? 'Connected' : 'Disconnected'}
              </h2>
              <p className="text-gray-400 mt-1 flex items-center gap-2">
                <span>{connectionTime}</span>
                {vpnState.connected && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-teal-400">
                      {vpnState.protocol === 'openvpn_tcp' 
                        ? 'OpenVPN (TCP)' 
                        : vpnState.protocol === 'openvpn_udp' 
                          ? 'OpenVPN (UDP)' 
                          : vpnState.protocol === 'wireguard' 
                            ? 'WireGuard' 
                            : vpnState.protocol === 'shadowsocks'
                              ? 'Shadowsocks'
                              : 'IKEv2/IPSec'}
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          
          <div className="flex flex-col md:items-end gap-2 md:gap-3">
            <div className="flex items-center gap-3">
              <span className="text-gray-400">Your IP:</span>
              <span className="font-mono bg-gray-800 py-1 px-3 rounded-lg text-teal-300">
                {vpnState.connected ? vpnState.virtualIp : '198.51.100.0'}
              </span>
            </div>
            <div>
              <ToggleSwitch 
                checked={vpnState.connected} 
                onChange={handleConnectionToggle} 
              />
            </div>
          </div>
        </div>
        
        {vpnState.connected && vpnState.selectedServer && (
          <div className="mt-8 flex gap-4 md:gap-6 flex-wrap">
            <div className="bg-gray-800 rounded-lg py-3 px-4 min-w-[130px] flex-1">
              <div className="text-sm text-gray-400 mb-1">Location</div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{vpnState.selectedServer.country}</span>
              </div>
            </div>
            
            <div className="bg-gray-800 rounded-lg py-3 px-4 min-w-[130px] flex-1">
              <div className="text-sm text-gray-400 mb-1">Server</div>
              <div className="font-medium">{vpnState.selectedServer.name}</div>
            </div>
            
            <div className="bg-gray-800 rounded-lg py-3 px-4 min-w-[130px] flex-1">
              <div className="text-sm text-gray-400 mb-1">Latency</div>
              <div className="font-medium text-green-500">{vpnState.selectedServer.latency} ms</div>
            </div>
            
            <div className="bg-gray-800 rounded-lg py-3 px-4 min-w-[130px] flex-1">
              <div className="text-sm text-gray-400 mb-1">Load</div>
              <div className="font-medium">{vpnState.selectedServer.load}%</div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
