import { useCallback, useEffect, useState, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import ToggleSwitch from '@/components/common/toggle-switch';
import { useVpnState } from '@/lib/vpn-service.tsx';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, ShieldCheck } from 'lucide-react';
import DisconnectButton from './disconnect-button';

export default function ConnectionStatusCard() {
  const vpnState = useVpnState();
  const { toast } = useToast();
  const [connectionTime, setConnectionTime] = useState('00:00:00');
  const [forceConnected, setForceConnected] = useState(false);
  
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
                
                // Force connection state - this is critical
                setForceConnected(true);
                
                // Force update VPN connected state with all data
                vpnState.updateSettings({
                  connected: true,
                  connectTime: new Date(sessionData.startTime),
                  virtualIp: sessionData.virtualIp || "10.78.102.138",
                  protocol: sessionData.protocol || "wireguard",
                  encryption: sessionData.encryption || "aes_256_gcm",
                  selectedServer: activeServer
                });
              }
            } else {
              // No active session found, ensure disconnected state
              vpnState.updateSettings({
                connected: false,
                connectTime: null
              });
              setForceConnected(false);
              
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
            setForceConnected(false);
            
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
    
    // Initial check
    checkCurrentSession();
    
    // Set up polling to check for session status regularly
    const interval = setInterval(checkCurrentSession, 5000);
    
    return () => {
      clearInterval(interval);
    };
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
    // Prevent multiple clicks
    if (isChangingIp) return;
    
    // Set changing IP state immediately for UI feedback
    setIsChangingIp(true);
    
    try {
      console.log("Change IP button clicked");
      
      // First check if we're actually connected
      if (!vpnState.connected && !forceConnected) {
        toast({
          title: "Not Connected",
          description: "You must be connected to change your IP address",
          variant: "default"
        });
        return;
      }
      
      // Load latest servers if not loaded yet
      if (!vpnState.selectedServer) {
        const serversRes = await apiRequest('GET', '/api/servers');
        if (serversRes.ok) {
          const servers = await serversRes.json();
          if (Array.isArray(servers) && servers.length > 0) {
            vpnState.setAvailableServers(servers);
            vpnState.selectServer(servers[0]);
          }
        }
      }
      
      // Use the VPN service's changeIp method
      const result = await vpnState.changeIp();
      
      // Check if this is a cooldown or in-progress response
      if (result && typeof result === 'object' && 'success' in result && !result.success) {
        // Already displayed toast messages in vpn-service.tsx
        console.log("IP change delayed or blocked:", result.error);
        return;
      }
      
      // This is a normal session data response
      const newSessionData = result;
      
      // Force UI update to show connected state
      setForceConnected(true);
      
      // Show success message
      toast({
        title: "IP Changed Successfully",
        description: `Your virtual IP address is now ${newSessionData.virtualIp}`,
      });
      
      // Refresh current session data in all components
      queryClient.invalidateQueries({ queryKey: ['/api/sessions/current'] });
    } catch (error) {
      console.error('IP change error:', error);
      
      // Verify current state after error
      try {
        const verifyRes = await apiRequest('GET', '/api/sessions/current');
        const isStillConnected = verifyRes.ok && verifyRes.status !== 204;
        const verifyData = isStillConnected ? await verifyRes.json() : null;
        
        if (isStillConnected && verifyData && !verifyData.endTime) {
          // We're still connected, update UI state to match reality
          setForceConnected(true);
          vpnState.updateSettings({
            connected: true,
            connectTime: new Date(verifyData.startTime),
            virtualIp: verifyData.virtualIp
          });
        } else {
          // We're actually disconnected
          setForceConnected(false);
          vpnState.updateSettings({
            connected: false,
            connectTime: null
          });
        }
      } catch (verifyError) {
        console.error("Error verifying connection state:", verifyError);
      }
      
      // Show error message
      toast({
        title: "IP Change Failed",
        description: error instanceof Error ? error.message : 'Failed to change IP address',
        variant: "destructive"
      });
    } finally {
      setIsChangingIp(false);
    }
  };
  
  // Add cooldown for toggle to prevent rapid state changes
  const [isToggling, setIsToggling] = useState(false);
  const lastToggleTime = useRef(0);
  const connectionInProgress = useRef(false);
  
  // Main function to handle VPN connection toggle with debounce
  const handleConnectionToggle = async (checked: boolean) => {
    console.log("Toggle clicked with value:", checked);
    
    // Force the toggle button to stay in its current state until we process
    // the toggle action - this prevents UI inconsistencies
    if (!checked) {
      // For disconnection, we keep checked state until we complete disconnection
      setForceConnected(true);
    }
    
    // Prevent multiple concurrent connection attempts
    if (connectionInProgress.current) {
      console.log("Connection operation already in progress, ignoring");
      toast({
        title: "Connection in progress",
        description: "Please wait while the current operation completes",
        variant: "default"
      });
      
      // Reset forced state if we're aborting
      if (!checked) {
        setForceConnected(vpnState.connected);
      }
      return;
    }
    
    // Implement a cooldown to prevent rapid toggling
    const now = Date.now();
    const timeSinceLastToggle = now - lastToggleTime.current;
    const cooldownPeriod = 5000; // 5 second cooldown
    
    if (timeSinceLastToggle < cooldownPeriod) {
      const remainingSeconds = Math.ceil((cooldownPeriod - timeSinceLastToggle) / 1000);
      console.log(`Toggle cooldown in effect, please wait ${remainingSeconds} seconds`);
      
      toast({
        title: "Connection cooldown",
        description: `Please wait ${remainingSeconds} seconds before toggling again`,
        variant: "default"
      });
      
      // Reset forced state if we're aborting
      if (!checked) {
        setForceConnected(vpnState.connected);
      }
      return;
    }
    
    // Set loading state immediately
    setIsToggling(true);
    connectionInProgress.current = true;
    lastToggleTime.current = now;
    
    try {
      if (checked) {
        console.log("Attempting to connect to VPN...");
        
        // Make sure we have servers data
        const serversRes = await apiRequest('GET', '/api/servers');
        if (!serversRes.ok) {
          throw new Error("Failed to load servers. Please refresh and try again.");
        }
        
        const servers = await serversRes.json();
        if (!Array.isArray(servers) || servers.length === 0) {
          throw new Error("No VPN servers available. Please try again later.");
        }
        
        // Update available servers
        vpnState.setAvailableServers(servers);
        
        // Make sure we have a server selected
        let serverToUse = vpnState.selectedServer;
        if (!serverToUse && servers.length > 0) {
          serverToUse = servers[0];
          if (serverToUse) {
            vpnState.selectServer(serverToUse);
          }
        }
        
        if (!serverToUse) {
          throw new Error("Could not select a server. Please refresh and try again.");
        }
        
        // Start the connection process
        console.log("Connecting to server:", serverToUse.name);
        
        // End any existing sessions first (just in case)
        try {
          await apiRequest('POST', '/api/sessions/end', {});
          console.log("Cleared any existing sessions");
        } catch (endError) {
          console.warn("Couldn't end existing sessions (might not exist):", endError);
        }
        
        // Update UI state immediately for feedback
        setForceConnected(true);
        
        // Start a new session with explicit server selection for accuracy
        console.log(`Explicitly sending server ID: ${serverToUse.id} (${serverToUse.name}) for connection`);
        
        const startRes = await apiRequest('POST', '/api/sessions/start', {
          serverId: serverToUse.id,
          protocol: vpnState.protocol || 'wireguard',
          encryption: vpnState.encryption || 'aes_256_gcm',
          serverName: serverToUse.name, // Send server name for validation
          requestedServerRegion: serverToUse.region // For additional validation
        });
        
        if (!startRes.ok) {
          const errorText = await startRes.text();
          console.error("Connection failed:", errorText);
          throw new Error("Failed to connect to VPN server");
        }
        
        // Get the session data
        const sessionData = await startRes.json();
        console.log("Connected successfully:", sessionData);
        
        // Verify that we're connected to the server we selected
        if (sessionData.serverId && sessionData.serverId !== serverToUse.id) {
          console.warn(`Server mismatch detected! Requested: ${serverToUse.id} (${serverToUse.name}), Connected to: ${sessionData.serverId}`);
          
          // Try to find the actual server in our list
          const actualServer = vpnState.availableServers.find(s => s.id === sessionData.serverId);
          
          if (actualServer) {
            // Update the selected server to match reality
            vpnState.selectServer(actualServer);
            serverToUse = actualServer;
            
            toast({
              title: 'Server Reassignment',
              description: `Connected to ${actualServer.name} instead of requested server. UI updated to match.`,
              variant: 'default'
            });
          }
        }
        
        // Update the VPN state
        vpnState.updateSettings({
          connected: true,
          connectTime: new Date(sessionData.startTime),
          virtualIp: sessionData.virtualIp,
          protocol: sessionData.protocol || vpnState.protocol || 'wireguard',
          encryption: sessionData.encryption || vpnState.encryption || 'aes_256_gcm',
          selectedServer: serverToUse
        });
        
        // Show success message
        toast({
          title: 'Connected',
          description: `Successfully connected to ${serverToUse.name} (${serverToUse.country})`,
        });
        
        // Refresh session data
        queryClient.invalidateQueries({ queryKey: ['/api/sessions/current'] });
      } else {
        console.log("Disconnecting from VPN...");
        
        // Set UI flags first to prevent race conditions
        setIsToggling(true);
        
        // Update UI state immediately for feedback
        setForceConnected(false);
        vpnState.updateSettings({
          connected: false,
          connectTime: null,
          virtualIp: ''
        });
        
        // Use the DisconnectButton component's more reliable disconnect method
        // We'll defer to the force disconnect implementation for a more effective disconnect
        
        // First set session disconnect flags
        sessionStorage.setItem('vpn_disconnected', 'true');
        localStorage.setItem('vpn_force_disconnected', 'true');
        
        // Run multiple parallel disconnect attempts for increased reliability
        let disconnectSuccess = false;
        
        console.log("Starting parallel disconnect attempts");
        
        // Create a function for a single disconnect attempt
        const disconnectAttempt = async (method: string, attempt: number) => {
          try {
            console.log(`[${method}] Disconnect attempt ${attempt}`);
            
            if (method === 'service') {
              await vpnState.disconnect();
              return true;
            } else if (method === 'api') {
              const res = await apiRequest('POST', '/api/sessions/end', {
                force: true,
                abrupt: false,
                source: `connection_toggle_${method}_${attempt}`
              });
              return res.ok;
            } else if (method === 'fetch') {
              const res = await fetch('/api/sessions/end', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Cache-Control': 'no-cache, no-store, must-revalidate',
                },
                body: JSON.stringify({
                  force: true,
                  abrupt: false,
                  source: `connection_toggle_${method}_${attempt}`
                })
              });
              return res.ok;
            }
            return false;
          } catch (error) {
            console.warn(`[${method}] Disconnect attempt ${attempt} failed:`, error);
            return false;
          }
        };
        
        // Try multiple disconnect methods in parallel
        const results = await Promise.allSettled([
          disconnectAttempt('service', 1),
          disconnectAttempt('api', 1),
          disconnectAttempt('fetch', 1),
          // Add small delay between attempts
          new Promise(r => setTimeout(r, 200)).then(() => disconnectAttempt('api', 2)),
          new Promise(r => setTimeout(r, 400)).then(() => disconnectAttempt('fetch', 2))
        ]);
        
        // Check if any attempt succeeded
        disconnectSuccess = results.some(r => r.status === 'fulfilled' && r.value === true);
        
        console.log(`Parallel disconnect attempts ${disconnectSuccess ? 'succeeded' : 'failed'}`);
        
        // One final attempt as fallback
        if (!disconnectSuccess) {
          try {
            await fetch('/api/sessions/end', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ abrupt: false }), // explicitly mark as controlled disconnect
            });
            console.log("Successfully ended session with direct fetch");
          } catch (fetchError) {
            console.warn("Failed to end session with direct fetch", fetchError);
          }
        }
        
        // Add redundant call after a short delay
        setTimeout(async () => {
          try {
            await fetch('/api/sessions/end', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ abrupt: false }),
            });
            console.log("Successfully ended session in delayed call");
          } catch (e) {
            console.warn("Failed to end session in delayed call", e);
          }
        }, 1000);
        
        // Force UI updates with redundant calls to ensure state is consistent
        vpnState.updateSettings({
          connected: false,
          connectTime: null,
          virtualIp: ''
        });
        
        setForceConnected(false);
        
        console.log("Disconnected from UI perspective");
        
        // Show success message
        toast({
          title: 'Disconnected',
          description: 'VPN connection terminated',
        });
        
        // Refresh session data
        queryClient.invalidateQueries({ queryKey: ['/api/sessions/current'] });
      }
    } catch (error) {
      console.error("Connection error:", error);
      
      // Revert UI state
      setForceConnected(false);
      vpnState.updateSettings({ 
        connected: false,
        connectTime: null 
      });
      
      // Show error message
      toast({
        title: 'Connection Error',
        description: error instanceof Error ? error.message : 'Failed to manage VPN connection',
        variant: 'destructive'
      });
    } finally {
      setIsToggling(false);
      // Reset connection in progress flag only after everything is complete
      setTimeout(() => {
        connectionInProgress.current = false;
      }, 500);
    }
  };

  return (
    <Card className="border border-blue-900/50 shadow-xl bg-gradient-to-br from-gray-950 to-blue-950 backdrop-blur-sm">
      <CardContent className="p-6 md:p-8 relative overflow-hidden">
        {/* Futuristic background elements */}
        <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none"></div>
        <div className="absolute -right-24 -top-24 w-48 h-48 rounded-full bg-blue-500/10 blur-3xl pointer-events-none"></div>
        <div className="absolute -left-24 -bottom-24 w-48 h-48 rounded-full bg-cyan-500/10 blur-3xl pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div className="space-y-1 md:space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${vpnState.connected || forceConnected ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50 animate-pulse' : 'bg-red-500'}`}></div>
              <h3 className="text-sm font-medium text-blue-300 tracking-wide">STATUS</h3>
            </div>
            <div className="md:mt-1">
              <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                {vpnState.connected || forceConnected ? 'Connected' : 'Disconnected'}
              </h2>
              {/* Tunnel verification status indicator */}
              {(vpnState.connected || forceConnected) && (
                <div className="flex items-center mt-1 space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    vpnState.tunnelVerified
                      ? (vpnState.tunnelActive ? 'bg-green-500' : 'bg-red-500') 
                      : 'bg-yellow-500'
                  }`} />
                  <span className="text-xs text-gray-300">
                    {vpnState.tunnelVerified
                      ? (vpnState.tunnelActive ? 'Tunnel Verified' : 'Tunnel Not Active') 
                      : 'Verifying Tunnel...'}
                  </span>
                </div>
              )}
              <p className="text-gray-400 mt-1 flex items-center gap-2">
                <span className="font-mono">{connectionTime}</span>
                {(vpnState.connected || forceConnected) && (
                  <>
                    <span>•</span>
                    <span className="font-mono text-cyan-400">
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
              <span className="text-blue-300">Your IP:</span>
              <div className="flex items-center gap-2">
                <span className="font-mono bg-black/30 border border-blue-900/50 py-1 px-3 rounded-lg text-cyan-300 shadow-inner backdrop-blur-sm">
                  {(vpnState.connected || forceConnected) ? vpnState.virtualIp : '198.51.100.0'}
                </span>
                {(vpnState.connected || forceConnected) && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleChangeIp}
                    disabled={isChangingIp || isToggling}
                    className="h-8 bg-black/30 border border-blue-500/50 hover:bg-blue-900/30 hover:border-blue-400 transition-all"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isChangingIp ? 'animate-spin text-cyan-400' : 'text-blue-300'}`} />
                    <span className={isChangingIp ? 'text-cyan-400' : 'text-blue-300'}>Change IP</span>
                  </Button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* Always show BOTH connect and disconnect buttons, but style them differently based on state */}
              <Button 
                onClick={() => {
                  // Clear disconnected flag when connecting
                  sessionStorage.removeItem('vpn_disconnected');
                  handleConnectionToggle(true);
                }}
                disabled={isToggling || (vpnState.connected || forceConnected)}
                variant="outline" 
                size="sm"
                className={`${(vpnState.connected || forceConnected) ? 
                  'bg-gray-700/50 text-gray-400 cursor-not-allowed' : 
                  'bg-gradient-to-r from-blue-600 to-cyan-400 text-white font-medium'} px-4 h-9`}
              >
                {isToggling ? 'Connecting...' : 'Connect'}
              </Button>
              
              <DisconnectButton
                onDisconnectStart={() => {
                  setIsToggling(true);
                  // Update UI immediately for better responsiveness
                  setForceConnected(false);
                  vpnState.updateSettings({
                    connected: false,
                    connectTime: null,
                    virtualIp: ''
                  });
                }}
                onDisconnectComplete={() => {
                  // Ensure we are disconnected
                  setIsToggling(false);
                  setForceConnected(false);
                  queryClient.invalidateQueries({ queryKey: ['/api/sessions/current'] });
                }}
                // Disable if we're already disconnected
                disabled={!(vpnState.connected || forceConnected)}
                // Visually dim the button if disconnected
                variant={!(vpnState.connected || forceConnected) ? "ghost" : "destructive"}
                className={!(vpnState.connected || forceConnected) ? "text-gray-400" : ""}
              />
            </div>
          </div>
        </div>
        
        <div className="mt-8 relative z-10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium mb-3 text-blue-300 tracking-wide">NETWORK NODES</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.location.href = '/servers'}
              className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              View All
            </Button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {vpnState.availableServers.slice(0, 8).map(server => (
              <button
                key={server.id}
                onClick={async () => {
                  // Check if we're toggling - prevent multiple operations
                  if (connectionInProgress.current || isToggling) {
                    console.log("Connection operation already in progress, ignoring server change");
                    toast({
                      title: "Connection in progress",
                      description: "Please wait while the current operation completes",
                      variant: "default"
                    });
                    return;
                  }
                  
                  // Implement a cooldown to prevent rapid server changes
                  const now = Date.now();
                  const timeSinceLastToggle = now - lastToggleTime.current;
                  const cooldownPeriod = 5000; // 5 second cooldown
                  
                  if (timeSinceLastToggle < cooldownPeriod) {
                    const remainingSeconds = Math.ceil((cooldownPeriod - timeSinceLastToggle) / 1000);
                    console.log(`Server change cooldown in effect, please wait ${remainingSeconds} seconds`);
                    
                    toast({
                      title: "Connection cooldown",
                      description: `Please wait ${remainingSeconds} seconds before changing servers`,
                      variant: "default"
                    });
                    return;
                  }
                  
                  if (vpnState.connected || forceConnected) {
                    // Update UI immediately for better UX
                    const previousServer = vpnState.selectedServer;
                    
                    // Set state for in-progress operation
                    connectionInProgress.current = true;
                    lastToggleTime.current = now;
                    setIsToggling(true);
                    
                    // Save the server
                    vpnState.selectServer(server);
                    
                    try {
                      console.log("Changing server to:", server.name);
                      
                      // End current session
                      const endRes = await apiRequest('POST', '/api/sessions/end');
                      if (!endRes.ok) {
                        console.warn("Warning: Failed to end previous session. Will attempt to continue anyway.");
                      }
                      
                      // Wait a bit before starting new session
                      await new Promise(resolve => setTimeout(resolve, 300));
                      
                      // Start new session with selected server
                      const startRes = await apiRequest('POST', '/api/sessions/start', {
                        serverId: server.id,
                        protocol: vpnState.protocol || 'wireguard',
                        encryption: vpnState.encryption || 'aes_256_gcm'
                      });
                      
                      if (!startRes.ok) {
                        // Check if this is a rate limiting response
                        if (startRes.status === 429) {
                          try {
                            const errorData = await startRes.json();
                            toast({
                              title: "Connection limit reached",
                              description: errorData.message || "Please wait before connecting again",
                              variant: "default"
                            });
                            
                            // Restore previous server selection
                            vpnState.selectServer(previousServer);
                            return;
                          } catch (parseError) {
                            // If we can't parse the JSON, fallback to generic error handling
                            const errorText = await startRes.text();
                            console.error("Failed to start new session:", errorText);
                            throw new Error("Failed to connect to selected server");
                          }
                        } else {
                          const errorText = await startRes.text();
                          console.error("Failed to start new session:", errorText);
                          throw new Error("Failed to connect to selected server");
                        }
                      }
                      
                      const sessionData = await startRes.json();
                      console.log("New session started:", sessionData);
                      
                      // Update VPN state with all session details
                      vpnState.updateSettings({
                        connected: true,
                        connectTime: new Date(sessionData.startTime),
                        virtualIp: sessionData.virtualIp,
                        protocol: sessionData.protocol || vpnState.protocol,
                        encryption: sessionData.encryption || vpnState.encryption,
                        selectedServer: server
                      });
                      
                      // Update UI state
                      setForceConnected(true);
                      
                      toast({
                        title: 'Server Changed',
                        description: `Connected to ${server.name} (${server.country})`,
                      });
                      
                      // Refresh current session data
                      queryClient.invalidateQueries({ queryKey: ['/api/sessions/current'] });
                    } catch (error) {
                      console.error("Server change error:", error);
                      
                      // Revert to previous server on error
                      if (previousServer) {
                        vpnState.selectServer(previousServer);
                      }
                      
                      toast({
                        title: 'Server Change Failed',
                        description: error instanceof Error ? error.message : 'Failed to change server',
                        variant: 'destructive'
                      });
                    } finally {
                      // Clean up connection state
                      setIsToggling(false);
                      setTimeout(() => {
                        connectionInProgress.current = false;
                      }, 500);
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
                className={`relative overflow-hidden flex flex-col items-start rounded-lg p-3 text-left transition-colors hover:bg-blue-900/30 group ${
                  vpnState.selectedServer?.id === server.id
                    ? 'bg-black/40 border border-blue-500/50 shadow-lg shadow-blue-500/10'
                    : 'bg-black/20 border border-blue-800/30 hover:border-blue-600/50'
                }`}
              >
                {/* Futuristic hover effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                
                <div className="text-sm font-medium mb-1 text-blue-100">{server.country}</div>
                <div className="text-xs text-gray-400 mb-2">{server.name}</div>
                <div className="flex items-center gap-2 justify-between w-full">
                  <span className="text-xs bg-black/30 border border-blue-900/20 rounded-md px-2 py-0.5 text-blue-300">
                    {server.latency} ms
                  </span>
                  <span className={`text-xs rounded-md px-2 py-0.5 ${
                    (server.load || 0) < 30 
                      ? 'bg-emerald-900/20 text-emerald-400 border border-emerald-500/20' 
                      : (server.load || 0) < 70 
                        ? 'bg-amber-900/20 text-amber-400 border border-amber-500/20' 
                        : 'bg-red-900/20 text-red-400 border border-red-500/20'
                  }`}>
                    {server.load}%
                  </span>
                </div>
              </button>
            ))}
          </div>
          
          {(vpnState.connected || forceConnected) && vpnState.selectedServer && (
            <div className="mt-6 p-4 bg-black/30 border border-blue-900/30 rounded-lg backdrop-blur-sm relative overflow-hidden">
              {/* Background glow effect */}
              <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/0 via-blue-500/10 to-blue-500/0 blur opacity-30"></div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-blue-300">ACTIVE CONNECTION</div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        // Show checking toast
                        toast({
                          title: "Checking Connection",
                          description: "Verifying your VPN tunnel is properly secure...",
                          variant: "default",
                        });

                        // Call the verify tunnel function
                        const tunnelActive = await vpnState.verifyTunnelStatus();
                        
                        // Display result
                        toast({
                          title: tunnelActive ? "Tunnel Verified" : "Security Issue",
                          description: tunnelActive 
                            ? "Your VPN connection is secure and working properly"
                            : "Your connection appears active but the tunnel is not working. Your traffic may not be secure!",
                          variant: tunnelActive ? "default" : "destructive",
                        });
                      } catch (error) {
                        console.error("Error verifying tunnel:", error);
                        toast({
                          title: "Verification Failed",
                          description: "Could not verify VPN tunnel status",
                          variant: "destructive",
                        });
                      }
                    }}
                    disabled={!vpnState.connected}
                    className="bg-black/30 border border-blue-500/50 hover:bg-blue-900/30 hover:border-blue-400 transition-all text-xs"
                  >
                    <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-blue-300" />
                    <span className="text-blue-300">Verify Security</span>
                  </Button>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <div className="text-xs text-gray-400">Location</div>
                    <div className="font-medium text-sm text-blue-100">{vpnState.selectedServer.country}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-400">Server</div>
                    <div className="font-medium text-sm text-blue-100">{vpnState.selectedServer.name}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-400">Protocol</div>
                    <div className="font-medium text-sm text-cyan-400">{
                      vpnState.protocol === 'openvpn_tcp' 
                        ? 'OpenVPN (TCP)' 
                        : vpnState.protocol === 'openvpn_udp' 
                          ? 'OpenVPN (UDP)' 
                          : vpnState.protocol === 'wireguard' 
                            ? 'WireGuard' 
                            : vpnState.protocol === 'shadowsocks'
                              ? 'Shadowsocks'
                              : 'IKEv2/IPSec'
                    }</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-400">Encryption</div>
                    <div className="font-medium text-sm text-cyan-400">{
                      vpnState.encryption === 'aes_256_gcm' 
                        ? 'AES-256-GCM'
                        : vpnState.encryption === 'chacha20_poly1305' 
                          ? 'ChaCha20-Poly1305'
                          : vpnState.encryption
                    }</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}