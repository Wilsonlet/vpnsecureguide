import { useEffect, useState } from 'react';
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
import { Loader2 } from 'lucide-react';

// Define types for dashboard prefetch data
interface DashboardPrefetchData {
  currentSession: CurrentSessionWithVirtualIp | null;
  servers: VpnServer[];
  settings: VpnUserSettings;
  subscription: {
    subscription: string;
    expiryDate: string | null;
    stripeCustomerId?: string;
    stripeSubscriptionId?: string;
  };
  usageStats: {
    totalUploaded: number;
    totalDownloaded: number;
    totalData: number;
    dailyData: { date: string; uploaded: number; downloaded: number; }[];
  };
  limits: {
    dataUsed: number;
    dataLimit: number;
    timeUsedToday: number;
    timeLimit: number;
    isDataLimitReached: boolean;
    isTimeLimitReached: boolean;
  };
  killSwitchStatus: {
    active: boolean;
  };
  timestamp: number;
}

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

// Loading skeleton component
const DashboardSkeleton = () => (
  <div className="flex flex-col gap-4 p-4 md:p-6 animate-pulse">
    <div className="h-48 bg-muted rounded-lg"></div>
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="h-80 bg-muted rounded-lg lg:col-span-2"></div>
      <div className="h-80 bg-muted rounded-lg"></div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="h-60 bg-muted rounded-lg"></div>
      <div className="h-60 bg-muted rounded-lg"></div>
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const vpnState = useVpnState();
  const [isLoading, setIsLoading] = useState(true);

  // Use prefetch endpoint to optimize loading performance by combining multiple API calls
  const { data: dashboardData, isLoading: isDashboardLoading } = useQuery<DashboardPrefetchData>({
    queryKey: ['/api/dashboard/prefetch'],
    retry: false,
  });

  // Extract data from the prefetch response
  const currentSession = dashboardData?.currentSession;
  const servers = dashboardData?.servers || [];
  const settings = dashboardData?.settings;
  const usageStats = dashboardData?.usageStats;
  const isSessionLoading = isDashboardLoading;

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



  // Update loading state when data arrives
  useEffect(() => {
    if (dashboardData && !isDashboardLoading) {
      setIsLoading(false);
    }
  }, [dashboardData, isDashboardLoading]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar for desktop */}
      <Sidebar />
      
      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {/* Top header */}
        <Header username={user?.username || ''} />
        
        {/* Show loading skeleton when data is loading */}
        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          /* Dashboard content */
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
            {dashboardData?.subscription.subscription === 'free' && (
              <AdBanner 
                adSlot="1234567890" 
                format="horizontal" 
                className="mt-6" 
              />
            )}
          </div>
        )}
      </main>
      
      {/* Mobile navigation */}
      <MobileNav />
    </div>
  );
}
