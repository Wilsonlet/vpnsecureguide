import { useEffect } from 'react';
import Sidebar from '@/components/layout/sidebar';
import MobileNav from '@/components/layout/mobile-nav';
import Header from '@/components/layout/header';
import ConnectionStatusCard from '@/components/vpn/connection-status-card';
import ServerMap from '@/components/vpn/server-map';
import SecuritySettingsCard from '@/components/vpn/security-settings-card';
import UsageStatsCard from '@/components/vpn/usage-stats-card';
import SmartModeCard from '@/components/vpn/smart-mode-card';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { VpnServer, VpnUserSettings } from '@shared/schema';
import { useVpnState } from '@/lib/vpn-service.tsx';

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

  // Fetch current VPN session
  const { data: currentSession, isLoading: isSessionLoading } = useQuery({
    queryKey: ['/api/sessions/current'],
    retry: false,
  });

  // Fetch usage statistics
  const { data: usageStats } = useQuery({
    queryKey: ['/api/usage', { period: '7days' }],
  });

  // Initialize VPN state from server data on first load
  useEffect(() => {
    if (settings && !isSessionLoading) {
      vpnState.updateSettings({
        killSwitch: settings.killSwitch,
        dnsLeakProtection: settings.dnsLeakProtection,
        doubleVpn: settings.doubleVpn,
        obfuscation: settings.obfuscation,
        protocol: settings.preferredProtocol,
        encryption: settings.preferredEncryption
      });
    }

    if (currentSession) {
      const server = servers.find(s => s.id === currentSession.serverId);
      if (server) {
        vpnState.connect({
          serverId: server.id,
          protocol: currentSession.protocol,
          encryption: currentSession.encryption,
          server
        });
      }
    }
  }, [settings, currentSession, servers, isSessionLoading]);

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
        </div>
      </main>
      
      {/* Mobile navigation */}
      <MobileNav />
    </div>
  );
}
