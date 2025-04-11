import { useEffect, useState } from 'react';
import { Shield, ShieldCheck, ShieldX, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useVpnState } from '@/lib/vpn-service';
import { useToast } from '@/hooks/use-toast';
import { VpnKillSwitchService } from '@/lib/kill-switch-service';

// Component representing the current state of the kill switch protection
export function KillSwitchStatusIndicator() {
  const vpnState = useVpnState();
  const { toast } = useToast();
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Check kill switch status on component mount and when vpnState changes
    const killSwitchService = VpnKillSwitchService.getInstance();
    const updateStatus = () => {
      const status = killSwitchService.isActive();
      setIsActive(status);
    };

    // Update initial status
    updateStatus();

    // Subscribe to kill switch status changes
    const unsubscribe = killSwitchService.subscribe(updateStatus);

    return () => {
      // Clean up subscription
      unsubscribe();
    };
  }, [vpnState.connected, vpnState.killSwitch]);

  // If kill switch is enabled in settings
  const isEnabledInSettings = vpnState.killSwitch;
  
  // Status based on kill switch setting and VPN connection
  let status: 'active' | 'standby' | 'disabled' = 'disabled';
  if (isEnabledInSettings) {
    status = isActive ? 'active' : 'standby';
  }

  return (
    <div className="flex items-center gap-2">
      {status === 'active' && (
        <>
          <ShieldCheck className="h-5 w-5 text-green-500" />
          <span className="text-green-500 font-medium">Kill Switch Active</span>
        </>
      )}
      {status === 'standby' && (
        <>
          <Shield className="h-5 w-5 text-amber-500" />
          <span className="text-amber-500 font-medium">Kill Switch Ready</span>
        </>
      )}
      {status === 'disabled' && (
        <>
          <ShieldX className="h-5 w-5 text-gray-500" />
          <span className="text-gray-500 font-medium">Kill Switch Disabled</span>
        </>
      )}
    </div>
  );
}

// Full kill switch card component with controls and information
export function KillSwitchCard() {
  const vpnState = useVpnState();
  const { toast } = useToast();
  const [isActive, setIsActive] = useState(false);
  const [isActivating, setIsActivating] = useState(false);

  // Activate kill switch manually
  const activateKillSwitch = async () => {
    setIsActivating(true);
    try {
      const killSwitchService = VpnKillSwitchService.getInstance();
      await killSwitchService.activate();
      toast({
        title: "Kill Switch Activated",
        description: "All internet traffic will be blocked until VPN reconnects",
        variant: "default",
      });
      setIsActive(true);
    } catch (error) {
      console.error("Failed to activate kill switch:", error);
      toast({
        title: "Kill Switch Error",
        description: "Failed to activate kill switch protection",
        variant: "destructive",
      });
    } finally {
      setIsActivating(false);
    }
  };

  // Reset kill switch (deactivate)
  const resetKillSwitch = async () => {
    try {
      const killSwitchService = VpnKillSwitchService.getInstance();
      await killSwitchService.deactivate();
      toast({
        title: "Kill Switch Reset",
        description: "Network traffic is now unblocked",
        variant: "default",
      });
    } catch (error) {
      console.error("Failed to reset kill switch:", error);
      toast({
        title: "Kill Switch Error",
        description: "Failed to reset kill switch protection",
        variant: "destructive",
      });
    }
  };

  // Toggle kill switch setting
  const toggleKillSwitch = (enabled: boolean) => {
    vpnState.updateSettings({
      killSwitch: enabled,
    });
    
    toast({
      title: enabled ? "Kill Switch Enabled" : "Kill Switch Disabled",
      description: enabled 
        ? "Protection will activate if VPN connection drops" 
        : "Network protection disabled. Your real IP may be exposed if VPN fails",
      variant: enabled ? "default" : "destructive",
    });
  };

  // Refresh status when VPN state changes
  useEffect(() => {
    const killSwitchService = VpnKillSwitchService.getInstance();
    const updateStatus = () => {
      setIsActive(killSwitchService.isActive());
    };

    // Update initial status
    updateStatus();

    // Subscribe to kill switch status changes
    const unsubscribe = killSwitchService.subscribe(updateStatus);

    return () => {
      unsubscribe();
    };
  }, [vpnState.connected, vpnState.killSwitch]);

  // Determine card style based on status
  const cardBgStyle = isActive 
    ? "border-green-900/50 bg-green-950/30" 
    : vpnState.killSwitch 
      ? "border-amber-900/50 bg-amber-950/20" 
      : "border-gray-800 bg-gray-950";

  return (
    <Card className={`shadow-lg ${cardBgStyle} transition-colors duration-300 relative overflow-hidden`}>
      {/* Status indicator in top-right */}
      <div className="absolute top-3 right-3">
        <KillSwitchStatusIndicator />
      </div>
      
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2">
          <Shield className={`h-6 w-6 ${isActive ? 'text-green-500' : vpnState.killSwitch ? 'text-amber-500' : 'text-gray-500'}`} />
          Kill Switch Protection
        </CardTitle>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Enable Kill Switch</p>
              <p className="text-sm text-gray-400 mt-1">
                Block all internet access if VPN disconnects unexpectedly
              </p>
            </div>
            <Switch 
              checked={vpnState.killSwitch} 
              onCheckedChange={toggleKillSwitch}
              disabled={isActive}
            />
          </div>
          
          {vpnState.killSwitch && (
            <div className="bg-amber-900/20 border border-amber-900/30 rounded-md p-3 text-sm text-amber-200">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  When activated, the kill switch will prevent all internet traffic outside the VPN tunnel. 
                  This ensures your real IP address is never exposed, even if the VPN connection drops.
                </div>
              </div>
            </div>
          )}
          
          {isActive && (
            <div className="bg-green-900/20 border border-green-900/30 rounded-md p-3 text-sm text-green-200">
              <div className="flex gap-2">
                <ShieldCheck className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  Kill switch is <strong>active</strong>. All internet traffic is blocked until the VPN reconnects 
                  or you manually reset the protection.
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      
      <CardFooter className="flex gap-3 justify-end border-t border-gray-800 pt-4">
        {isActive ? (
          <Button 
            variant="destructive" 
            onClick={resetKillSwitch}
          >
            Reset Kill Switch
          </Button>
        ) : vpnState.killSwitch && (
          <Button 
            variant="default" 
            onClick={activateKillSwitch}
            disabled={isActivating}
          >
            {isActivating ? 'Activating...' : 'Activate Now'}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}