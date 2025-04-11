import { useEffect } from 'react';
import Sidebar from '@/components/layout/sidebar';
import MobileNav from '@/components/layout/mobile-nav';
import Header from '@/components/layout/header';
import ConnectionStatusCard from '@/components/vpn/connection-status-card';
import ServerMap from '@/components/vpn/server-map';
import SecuritySettingsCard from '@/components/vpn/security-settings-card';
import UsageStatsCard from '@/components/vpn/usage-stats-card';
import SmartModeCard from '@/components/vpn/smart-mode-card';
import { KillSwitchCard } from '@/components/vpn/kill-switch';
import AdBanner from '@/components/ads/AdBanner';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { VpnServer, VpnUserSettings, subscriptionTiers } from '@shared/schema';
import { useVpnState } from '@/lib/vpn-service';

export default function Dashboard() {
  const { user } = useAuth();
  const vpnState = useVpnState();

  // Fetch VPN server list
  const { data: servers = [] } = useQuery<VpnServer[]>({
    queryKey: ['/api/servers'],
  });

  // Fetch user VPN settings
  const { data: settings } = useQuery<VpnUserSettings>({
    queryKey: ['/api/settings'],
  });

  // Define type for current session with virtual IP
  type CurrentSessionWithVirtualIp = {
    id: number;
    userId: number;
    serverId: number;
    protocol: string;
    encryption: string;
    startTime: string;
    endTime: string | null;
    dataUploaded: number;
    dataDownloaded: number;
    virtualIp: string;
  };

  // Fetch current VPN session
  const { data: currentSession, isLoading: isSessionLoading } = useQuery<CurrentSessionWithVirtualIp>({
    queryKey: ['/api/sessions/current'],
    retry: false,
  });

  // Fetch usage statistics
  const { data: usageStats } = useQuery<{
    totalUploaded: number;
    totalDownloaded: number;
    totalData: number;
    dailyData: { date: string; uploaded: number; downloaded: number; }[];
  }>({
    queryKey: ['/api/usage', { period: '7days' }],
  });

  // Initialize VPN state from server data on first load
  useEffect(() => {
    if (settings && !isSessionLoading) {
      vpnState.updateSettings({
        killSwitch: settings.killSwitch ?? false,
        dnsLeakProtection: settings.dnsLeakProtection ?? false,
        doubleVpn: settings.doubleVpn ?? false,
        obfuscation: settings.obfuscation ?? false,
        protocol: settings.preferredProtocol ?? "openvpn",
        encryption: settings.preferredEncryption ?? "aes-256-gcm"
      });
    }

    // First check if VPN is really disconnected (for UI consistency)
    const disconnectFlag = sessionStorage.getItem('vpn_disconnected');
    if (disconnectFlag === 'true') {
      console.log("User previously disconnected VPN, not auto-connecting");
      
      // Update VPN state to be disconnected regardless of session
      vpnState.updateSettings({
        connected: false,
        connectTime: null,
        virtualIp: ''
      });
      
      return;
    }

    // Only try to connect if there's a valid session and the user hasn't manually disconnected
    if (currentSession && !vpnState.connected) {
      const server = servers.find(s => s.id === currentSession.serverId);
      if (server) {
        // Call connect and properly handle the response including cooldown errors
        vpnState.connect({
          serverId: server.id,
          protocol: currentSession.protocol,
          encryption: currentSession.encryption,
          server
        }).then(response => {
          // Check if response indicates a cooldown or other error
          if (response && typeof response === 'object' && 'success' in response && !response.success) {
            // This is a cooldown or in-progress response, we don't need to do anything
            // Toast notifications are already displayed by the vpn-service component
            console.log("VPN connection delayed:", response.error);
          }
          
          // Set the virtual IP if available
          if (currentSession.virtualIp) {
            vpnState.updateSettings({
              virtualIp: currentSession.virtualIp
            });
          }
        }).catch(error => {
          console.error("Error restoring VPN session:", error);
          // Force disconnected state to ensure UI is consistent
          vpnState.updateSettings({
            connected: false,
            connectTime: null,
            virtualIp: ''
          });
        });
      }
    }
  }, [settings, currentSession, servers, isSessionLoading, vpnState]);



  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar for desktop */}
      <Sidebar />
      
      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {/* Top header */}
        <Header username={user?.username || ''} />
        
        {/* Dashboard content */}
        <div className="p-4 md:p-6 space-y-6">
          {/* Connection Status Card */}
          <ConnectionStatusCard />
          
          {/* Server Selection Map */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Server Map */}
            <ServerMap servers={servers} className="lg:col-span-2" />
            
            {/* Protocol & Security Settings */}
            <SecuritySettingsCard />
          </div>
          
          {/* Usage Stats & Apps */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Usage Statistics */}
            <UsageStatsCard usageStats={usageStats} />
            
            {/* Smart Mode & Split Tunneling */}
            <SmartModeCard />
          </div>
          
          {/* Kill Switch */}
          <div className="mt-6">
            <KillSwitchCard />
          </div>
          
          {/* AdSense Banner for Free Users */}
          <AdBanner 
            adSlot="1234567890" 
            format="horizontal" 
            className="mt-6" 
          />
        </div>
      </main>
      
      {/* Mobile navigation */}
      <MobileNav />
    </div>
  );
}
