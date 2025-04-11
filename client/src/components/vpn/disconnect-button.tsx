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
      
      // Notify parent component (if provided)
      if (onDisconnectStart) {
        onDisconnectStart();
      }
      
      // Call direct disconnect on the API for immediate action
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
          source: 'direct_disconnect_button'
        }),
      });
      
      if (!response.ok) {
        throw new Error(`Failed to disconnect: ${response.status} ${response.statusText}`);
      }
      
      // Also update service state
      await vpnState.disconnect();
      
      // Clear any cached data related to VPN sessions
      queryClient.invalidateQueries({ queryKey: ['/api/sessions/current'] });
      
      // Set disconnect flag on successful disconnect
      sessionStorage.setItem('vpn_disconnected', 'true');
      
      // Notify success
      toast({
        title: 'VPN Disconnected',
        description: 'You have been successfully disconnected from the VPN',
      });
      
      if (onDisconnectComplete) {
        onDisconnectComplete();
      }
    } catch (error) {
      console.error('Failed to disconnect:', error);
      toast({
        title: 'Disconnect Error',
        description: error instanceof Error ? error.message : 'Failed to disconnect from VPN',
        variant: 'destructive',
      });
      
      // Still update local state on failure to improve UI consistency
      vpnState.updateSettings({
        connected: false,
        connectTime: null,
        virtualIp: ''
      });
      
      // Set disconnect flag even on error
      sessionStorage.setItem('vpn_disconnected', 'true');
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