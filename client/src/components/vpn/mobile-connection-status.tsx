import { useVpnState } from "@/lib/vpn-service";
import { Shield, ShieldCheck, ShieldOff, Signal } from "lucide-react";
import { formatDuration } from "@/lib/utils";
import { useEffect, useState } from "react";

/**
 * Mobile-friendly connection status indicator component
 * Appears as a floating bar at the top of the screen on mobile devices
 */
export function MobileConnectionStatus() {
  const vpnState = useVpnState();
  const [connectionTime, setConnectionTime] = useState('00:00:00');
  const [displayStatus, setDisplayStatus] = useState(false);

  // Update connection time display if connected
  useEffect(() => {
    if (!vpnState.connected || !vpnState.connectTime) {
      setConnectionTime('00:00:00');
      return;
    }

    const updateConnectionTime = () => {
      if (!vpnState.connectTime) return;
      
      const connectTime = new Date(vpnState.connectTime);
      const now = new Date();
      const durationMs = now.getTime() - connectTime.getTime();
      setConnectionTime(formatDuration(durationMs));
    };

    // Update immediately
    updateConnectionTime();
    
    // Then update every second
    const interval = setInterval(updateConnectionTime, 1000);
    return () => clearInterval(interval);
  }, [vpnState.connected, vpnState.connectTime]);

  // Control visibility - show when connected, or briefly when disconnecting
  useEffect(() => {
    if (vpnState.connected) {
      setDisplayStatus(true);
    } else {
      // If disconnected, show briefly then hide
      if (displayStatus) {
        const timer = setTimeout(() => {
          setDisplayStatus(false);
        }, 5000);
        return () => clearTimeout(timer);
      }
    }
  }, [vpnState.connected, displayStatus]);

  const renderIcon = () => {
    if (vpnState.connected) {
      return (
        <div className="flex items-center justify-center h-7 w-7 bg-green-500/20 rounded-full">
          <Signal className="h-4 w-4 text-green-400" />
        </div>
      );
    }
    return (
      <div className="flex items-center justify-center h-7 w-7 bg-red-500/20 rounded-full">
        <ShieldOff className="h-4 w-4 text-red-400" />
      </div>
    );
  };

  if (!displayStatus && !vpnState.connected) {
    return null;
  }

  return (
    <div className={`fixed top-0 inset-x-0 z-50 md:hidden transition-all duration-300 ${vpnState.connected ? 'translate-y-0' : 'translate-y-0'} shadow-md`}>
      <div className={`flex items-center px-4 py-2 ${vpnState.connected ? 'bg-gradient-to-r from-green-900/80 to-green-800/80 backdrop-blur-md' : 'bg-gradient-to-r from-red-900/80 to-red-800/80 backdrop-blur-md'}`}>
        {renderIcon()}
        
        <div className="ml-3 flex-1">
          <div className="flex items-center justify-between">
            <span className={`text-sm font-medium ${vpnState.connected ? 'text-green-300' : 'text-red-300'}`}>
              {vpnState.connected ? 'VPN Connected' : 'VPN Disconnected'}
            </span>
            {vpnState.connected && (
              <span className="text-xs font-mono text-green-300">
                {connectionTime}
              </span>
            )}
          </div>
          
          <div className="flex items-center text-xs mt-0.5">
            <span className={`${vpnState.connected ? 'text-green-200/80' : 'text-red-200/80'}`}>
              {vpnState.connected 
                ? `${vpnState.virtualIp || '10.x.x.x'} • ${vpnState.protocol?.toUpperCase() || 'WireGuard'}`
                : 'Your connection is not protected'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}