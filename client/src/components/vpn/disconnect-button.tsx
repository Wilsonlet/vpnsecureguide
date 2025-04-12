import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PowerOff } from 'lucide-react';
import { useVpnState } from '@/lib/vpn-service';
import { useToast } from '@/hooks/use-toast';
import { queryClient } from '@/lib/queryClient';

interface DisconnectButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  disabled?: boolean;
  onDisconnectStart?: () => void;
  onDisconnectComplete?: () => void;
}

export default function DisconnectButton({
  variant = 'destructive',
  size = 'sm',
  className = '',
  disabled = false,
  onDisconnectStart,
  onDisconnectComplete,
}: DisconnectButtonProps) {
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const vpnState = useVpnState();
  const { toast } = useToast();
  
  // Always display the disconnect button when requested
  // No condition here to ensure users can always disconnect
  
  const handleDisconnect = async () => {
    if (isDisconnecting) return;
    
    try {
      setIsDisconnecting(true);
      console.log("Force disconnect initiated");
      
      // Notify parent component (if provided)
      if (onDisconnectStart) {
        onDisconnectStart();
      }
      
      // First, update local UI state immediately for responsive feedback
      vpnState.updateSettings({
        connected: false,
        connectTime: null,
        virtualIp: ''
      });
      
      // Set disconnect flag proactively
      sessionStorage.setItem('vpn_disconnected', 'true');
      localStorage.setItem('vpn_force_disconnected', 'true');
      
      // PART 1: Try direct API calls with multiple attempts in parallel
      console.log("Starting parallel disconnect attempts");
      let disconnectSuccess = false;
      
      const attemptDisconnect = async (attempt: number) => {
        try {
          console.log(`Executing disconnect attempt #${attempt}`);
          const response = await fetch('/api/sessions/end', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache',
              'Expires': '0'
            },
            body: JSON.stringify({ 
              abrupt: false,
              force: true,
              source: `direct_disconnect_button_attempt_${attempt}`
            }),
          });
          
          if (response.ok) {
            console.log(`Disconnect attempt #${attempt} succeeded with status ${response.status}`);
            disconnectSuccess = true;
            return true;
          } else {
            console.warn(`Disconnect attempt #${attempt} failed with status ${response.status}`);
            return false;
          }
        } catch (e) {
          console.error(`Disconnect attempt #${attempt} error:`, e);
          return false;
        }
      };
      
      // Try 3 parallel requests
      const disconnectResults = await Promise.allSettled([
        attemptDisconnect(1),
        // Add a slight delay between attempts
        new Promise(r => setTimeout(r, 100)).then(() => attemptDisconnect(2)),
        new Promise(r => setTimeout(r, 200)).then(() => attemptDisconnect(3))
      ]);
      
      // PART 2: Use the VPN service's disconnect method (different implementation path)
      console.log("Calling VPN service disconnect method");
      try {
        await vpnState.disconnect();
        disconnectSuccess = true;
      } catch (vpnError) {
        console.warn("VPN service disconnect failed:", vpnError);
      }
      
      // PART 3: Clear all caches and perform one final disconnect attempt
      console.log("Executing final cleanup steps");
      
      // Clear any cached data related to VPN sessions
      queryClient.invalidateQueries({ queryKey: ['/api/sessions/current'] });
      queryClient.invalidateQueries({ queryKey: ['/api/servers'] });
      queryClient.invalidateQueries({ queryKey: ['/api/vpn/ping'] });
      
      // Clear browser caches for all API endpoints
      try {
        if (window.caches) {
          const cache = await window.caches.open('api-cache');
          const keys = await cache.keys();
          for (const key of keys) {
            if (key.url.includes('/api/sessions') || key.url.includes('/api/vpn')) {
              await cache.delete(key);
            }
          }
        }
      } catch (cacheError) {
        console.warn("Cache clearing error (non-critical):", cacheError);
      }
      
      // One final attempt with force flag
      try {
        const finalResponse = await fetch('/api/sessions/end', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          },
          body: JSON.stringify({ 
            abrupt: false,
            force: true, 
            final: true,
            clearAll: true,
            source: 'final_disconnect_attempt'
          }),
        });
        
        if (finalResponse.ok) {
          disconnectSuccess = true;
          console.log("Final disconnect succeeded");
        }
      } catch (finalError) {
        console.warn("Final disconnect attempt failed:", finalError);
      }
      
      // Notify based on overall success
      if (disconnectSuccess) {
        toast({
          title: 'VPN Disconnected',
          description: 'You have been successfully disconnected from the VPN',
        });
      } else {
        // Even if all attempts failed, we can still update local state
        toast({
          title: 'VPN Disconnected',
          description: 'Disconnected from the VPN on this device',
          variant: 'default',
        });
      }
      
      // PART 4: Final checks and feedback
      
      // Always ensure local state shows disconnected
      vpnState.updateSettings({
        connected: false,
        connectTime: null,
        virtualIp: ''
      });
      
      // Final callback
      if (onDisconnectComplete) {
        onDisconnectComplete();
      }
      
      console.log("Disconnect process completed");
    } catch (error) {
      console.error('Unhandled error during disconnect process:', error);
      toast({
        title: 'VPN Disconnected',
        description: 'Disconnected locally, but there may have been server-side issues',
        variant: 'default',
      });
      
      // Still update local state on failure
      vpnState.updateSettings({
        connected: false,
        connectTime: null,
        virtualIp: ''
      });
      
      // Set disconnect flags even on error
      sessionStorage.setItem('vpn_disconnected', 'true');
      localStorage.setItem('vpn_force_disconnected', 'true');
    } finally {
      setIsDisconnecting(false);
    }
  };
  
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleDisconnect}
      disabled={isDisconnecting || disabled}
    >
      <PowerOff className={`h-4 w-4 mr-2 ${isDisconnecting ? 'animate-pulse' : ''}`} />
      {isDisconnecting ? 'Disconnecting...' : 'Disconnect'}
    </Button>
  );
}