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
  
  // Fetch servers data when component mounts
  useEffect(() => {
    const loadServersIfNeeded = async () => {
      if (!vpnState.availableServers || vpnState.availableServers.length === 0) {
        try {
          const res = await apiRequest('GET', '/api/servers');
          if (res.ok) {
            const serversData = await res.json();
            if (Array.isArray(serversData) && serversData.length > 0) {
              console.log("Preloaded servers:", serversData);
              vpnState.setAvailableServers(serversData);
              
              // If no server selected, select the first one
              if (!vpnState.selectedServer) {
                vpnState.selectServer(serversData[0]);
              }
            }
          }
        } catch (error) {
          console.error("Failed to preload servers:", error);
        }
      }
    };
    
    loadServersIfNeeded();
  }, []);

  // Check current session status from API when component mounts
  useEffect(() => {
    const checkCurrentSession = async () => {
      try {
        // First get available servers to ensure we have them
        const serversRes = await apiRequest('GET', '/api/servers');
        if (!serversRes.ok) {
          throw new Error("Failed to fetch server list");
        }
        
        const serversData = await serversRes.json();
        if (Array.isArray(serversData) && serversData.length > 0) {
          // Update available servers
          vpnState.setAvailableServers(serversData);
          
          // Now check for active session
          const sessionRes = await apiRequest('GET', '/api/sessions/current');
          
          if (sessionRes.ok) {
            const sessionData = await sessionRes.json();
            
            if (sessionData && sessionData.id && !sessionData.endTime) {
              console.log("Found active session:", sessionData);
              
              // Find server in our list
              const activeServer = serversData.find((s) => s.id === sessionData.serverId);
              
              if (activeServer) {
                console.log("Syncing with active server:", activeServer);
                
                // Force update VPN connected state
                vpnState.updateSettings({
                  connected: true,
                  connectTime: new Date(sessionData.startTime),
                  virtualIp: sessionData.virtualIp,
                  protocol: sessionData.protocol,
                  encryption: sessionData.encryption,
                  selectedServer: activeServer
                });
              }
            } else {
              // No active session found, ensure disconnected state
              vpnState.updateSettings({
                connected: false,
                connectTime: null
              });
              
              // Select first server for future connections
              if (!vpnState.selectedServer && serversData.length > 0) {
                vpnState.selectServer(serversData[0]);
              }
            }
          } else if (sessionRes.status === 404 || sessionRes.status === 204) {
            // No active session
            vpnState.updateSettings({
              connected: false,
              connectTime: null
            });
            
            // Select first server for future connections
            if (!vpnState.selectedServer && serversData.length > 0) {
              vpnState.selectServer(serversData[0]);
            }
          }
        }
      } catch (error) {
        console.error("Error checking current session:", error);
      }
    };
    
    checkCurrentSession();
  }, []);

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
  
  // Function to change IP address
  const [isChangingIp, setIsChangingIp] = useState(false);
  
  const handleChangeIp = async () => {
    // Check if we're connected
    if (!vpnState.connected) {
      toast({
        title: "Not Connected",
        description: "You must be connected to a VPN server to change your IP.",
        variant: "destructive"
      });
      return;
    }
    
    // Make sure we have a server selected
    if (!vpnState.selectedServer) {
      // Fetch servers if needed
      if (!vpnState.availableServers || vpnState.availableServers.length === 0) {
        try {
          const serversRes = await apiRequest('GET', '/api/servers');
          if (!serversRes.ok) {
            throw new Error("Failed to fetch server data");
          }
          
          const servers = await serversRes.json();
          if (!Array.isArray(servers) || servers.length === 0) {
            throw new Error("No VPN servers available");
          }
          
          // Update available servers
          vpnState.setAvailableServers(servers);
          
          // Select the first server
          vpnState.selectServer(servers[0]);
          
          // Give time for state update
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error("Server fetch error:", error);
          toast({
            title: "Server Error",
            description: error instanceof Error ? error.message : "Failed to fetch server information",
            variant: "destructive"
          });
          return;
        }
      } else if (vpnState.availableServers.length > 0) {
        // Select the first available server
        vpnState.selectServer(vpnState.availableServers[0]);
        
        // Give time for state update
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        toast({
          title: "No Servers Available",
          description: "Unable to find any VPN servers. Please try again later.",
          variant: "destructive"
        });
        return;
      }
    }
    
    setIsChangingIp(true);
    
    try {
      // Check once more that we have a server
      if (!vpnState.selectedServer) {
        throw new Error("No server selected");
      }
      
      // End current session and start a new one with the same server
      await apiRequest('POST', '/api/sessions/end', {});
      
      // Double check that the selected server is properly set with an ID
      const serverId = vpnState.selectedServer.id;
      if (!serverId) {
        throw new Error("Invalid server ID");
      }
      
      console.log("Changing IP with server:", vpnState.selectedServer);
      
      const res = await apiRequest('POST', '/api/sessions/start', {
        serverId: serverId,
        protocol: vpnState.protocol,
        encryption: vpnState.encryption
      });
      
      if (!res.ok) {
        throw new Error('Failed to change IP address');
      }
      
      const sessionData = await res.json();
      console.log('Session restarted with new IP:', sessionData);
      
      // Update the IP in the state
      vpnState.updateSettings({
        virtualIp: sessionData.virtualIp || `10.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        connectTime: new Date()
      });
      
      toast({
        title: "IP Changed",
        description: "Your virtual IP address has been successfully updated.",
      });
      
      // Refresh current session data
      queryClient.invalidateQueries({ queryKey: ['/api/sessions/current'] });
    } catch (error) {
      console.error('IP change error:', error);
      toast({
        title: "IP Change Failed",
        description: error instanceof Error ? error.message : 'Failed to change IP address',
        variant: "destructive"
      });
    } finally {
      setIsChangingIp(false);
    }
  };
  
  // Handle connection toggle
  const handleConnectionToggle = async (checked: boolean) => {
    try {
      if (checked) {
        // First update local state to give immediate feedback
        vpnState.updateSettings({
          connected: true,
          connectTime: new Date()
        });
        
        // Make sure we have servers data
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
              } else {
                throw new Error("No servers available from API");
              }
            } else {
              throw new Error("Failed to fetch VPN servers");
            }
          } catch (error) {
            // Revert state on error
            vpnState.updateSettings({
              connected: false,
              connectTime: null
            });
            
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
            
            // Update VPN state with all session data
            vpnState.updateSettings({
              connected: true,
              connectTime: new Date(sessionData.startTime),
              virtualIp: sessionData.virtualIp,
              protocol: sessionData.protocol,
              encryption: sessionData.encryption,
              selectedServer: serverToUse
            });
            
            toast({
              title: 'Connected',
              description: `Successfully connected to ${serverToUse.name} (${serverToUse.country})`,
            });
            
            // Refresh current session data
            queryClient.invalidateQueries({ queryKey: ['/api/sessions/current'] });
          } else {
            // Revert state on error
            vpnState.updateSettings({
              connected: false,
              connectTime: null
            });
            
            console.error("Failed to start session:", await res.text());
            throw new Error("Failed to start VPN session");
          }
        } else {
          // Revert state on error
          vpnState.updateSettings({
            connected: false,
            connectTime: null
          });
          
          toast({
            title: 'Connection Error',
            description: 'No VPN servers available. Please refresh and try again.',
            variant: 'destructive'
          });
          return;
        }
      } else {
        // Update local state immediately for better UX
        vpnState.updateSettings({
          connected: false,
          connectTime: null
        });
        
        // End the current VPN session
        const res = await apiRequest('POST', '/api/sessions/end');
        
        if (res.ok) {
          toast({
            title: 'Disconnected',
            description: 'VPN connection terminated successfully',
          });
          
          // Refresh current session data
          queryClient.invalidateQueries({ queryKey: ['/api/sessions/current'] });
        } else {
          console.error("Failed to end session:", await res.text());
          
          // If the session didn't actually end, do a full check
          const sessionCheck = await apiRequest('GET', '/api/sessions/current');
          if (sessionCheck.ok) {
            const activeSession = await sessionCheck.json();
            
            // If there's still an active session, revert UI state
            if (activeSession && activeSession.id && !activeSession.endTime) {
              vpnState.updateSettings({
                connected: true,
                connectTime: new Date(activeSession.startTime)
              });
              throw new Error("Failed to end VPN session");
            }
          }
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
              <div className="flex items-center gap-2">
                <span className="font-mono bg-gray-800 py-1 px-3 rounded-lg text-teal-300">
                  {vpnState.connected ? vpnState.virtualIp : '198.51.100.0'}
                </span>
                {vpnState.connected && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleChangeIp}
                    disabled={isChangingIp}
                    className="h-8 bg-gray-800 border-gray-700 hover:bg-gray-700"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isChangingIp ? 'animate-spin' : ''}`} />
                    Change IP
                  </Button>
                )}
              </div>
            </div>
            <div>
              <ToggleSwitch 
                checked={vpnState.connected} 
                onChange={handleConnectionToggle} 
              />
            </div>
          </div>
        </div>
        
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium mb-3">Quick Server Selection</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = '/servers'}
              className="text-xs text-primary hover:text-primary/80"
            >
              View All
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {vpnState.availableServers.slice(0, 8).map(server => (
              <button
                key={server.id}
                onClick={async () => {
                  if (vpnState.connected) {
                    // Update UI immediately for better UX
                    const previousServer = vpnState.selectedServer;
                    vpnState.selectServer(server);
                    
                    try {
                      // End current session
                      await apiRequest('POST', '/api/sessions/end');
                      
                      // Start new session with selected server
                      const res = await apiRequest('POST', '/api/sessions/start', {
                        serverId: server.id,
                        protocol: vpnState.protocol,
                        encryption: vpnState.encryption
                      });
                      
                      if (res.ok) {
                        const sessionData = await res.json();
                        
                        // Update VPN state with all session details
                        vpnState.updateSettings({
                          connected: true,
                          connectTime: new Date(sessionData.startTime),
                          virtualIp: sessionData.virtualIp,
                          protocol: sessionData.protocol,
                          encryption: sessionData.encryption,
                          selectedServer: server
                        });
                        
                        toast({
                          title: 'Server Changed',
                          description: `Connected to ${server.name} (${server.country})`,
                        });
                        
                        // Refresh current session data
                        queryClient.invalidateQueries({ queryKey: ['/api/sessions/current'] });
                      } else {
                        // Revert to previous server on error
                        if (previousServer) {
                          vpnState.selectServer(previousServer);
                        }
                        
                        throw new Error("Failed to change server");
                      }
                    } catch (error) {
                      console.error("Server change error:", error);
                      toast({
                        title: 'Server Change Failed',
                        description: error instanceof Error ? error.message : 'Failed to change server',
                        variant: 'destructive'
                      });
                    }
                  } else {
                    // Just select the server for when the user connects
                    vpnState.selectServer(server);
                    toast({
                      title: 'Server Selected',
                      description: `${server.name} will be used when you connect`,
                    });
                  }
                }}
                className={`flex flex-col items-start rounded-lg p-3 text-left transition-colors hover:bg-gray-700/50 ${
                  vpnState.selectedServer?.id === server.id
                    ? 'bg-gray-700 border border-primary/30'
                    : 'bg-gray-800 border border-transparent'
                }`}
              >
                <div className="text-sm font-medium mb-1">{server.country}</div>
                <div className="text-xs text-gray-400 mb-2">{server.name}</div>
                <div className="flex items-center gap-2 justify-between w-full">
                  <span className="text-xs bg-gray-700/50 rounded px-2 py-0.5">
                    {server.latency} ms
                  </span>
                  <span className={`text-xs rounded px-2 py-0.5 ${
                    (server.load || 0) < 30 
                      ? 'bg-green-900/30 text-green-400' 
                      : (server.load || 0) < 70 
                        ? 'bg-amber-900/30 text-amber-400' 
                        : 'bg-red-900/30 text-red-400'
                  }`}>
                    {server.load}%
                  </span>
                </div>
              </button>
            ))}
          </div>
          
          {vpnState.connected && vpnState.selectedServer && (
            <div className="mt-4 p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
              <div className="text-sm font-medium mb-2">Active Connection</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-xs text-gray-400">Location</div>
                  <div className="font-medium text-sm">{vpnState.selectedServer.country}</div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-400">Server</div>
                  <div className="font-medium text-sm">{vpnState.selectedServer.name}</div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-400">Latency</div>
                  <div className="font-medium text-sm text-green-500">{vpnState.selectedServer.latency} ms</div>
                </div>
                
                <div>
                  <div className="text-xs text-gray-400">Load</div>
                  <div className="font-medium text-sm">{vpnState.selectedServer.load}%</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
