import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Loader2, Shield, Eye, EyeOff, Lock, WifiOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ObfuscationMethod = {
  id: string;
  name: string;
  description: string;
  compatibleProtocols: string[];
  premium: boolean;
};

// Map of obfuscation method IDs to display information
const OBFUSCATION_METHODS: Record<string, Omit<ObfuscationMethod, 'id'>> = {
  none: {
    name: "None",
    description: "No traffic obfuscation",
    compatibleProtocols: ['openvpn_tcp', 'openvpn_udp', 'wireguard', 'shadowsocks', 'ikev2'],
    premium: false
  },
  stunnel: {
    name: "Stunnel (SSL/TLS)",
    description: "Wraps VPN traffic in SSL/TLS encryption to look like HTTPS traffic",
    compatibleProtocols: ['openvpn_tcp', 'wireguard'],
    premium: true
  },
  obfs4: {
    name: "OBFS4",
    description: "Advanced obfuscation protocol that transforms traffic to resist DPI",
    compatibleProtocols: ['openvpn_tcp', 'openvpn_udp'],
    premium: true
  },
  shadowsocks: {
    name: "Shadowsocks",
    description: "Protocol designed to bypass firewalls, traffic looks random",
    compatibleProtocols: ['shadowsocks'],
    premium: true
  },
  cloak: {
    name: "Cloak",
    description: "Advanced plugin to bypass sophisticated DPI systems",
    compatibleProtocols: ['shadowsocks'],
    premium: true
  },
  sni: {
    name: "SNI Cloaking",
    description: "Uses legitimate domain names to disguise VPN traffic",
    compatibleProtocols: ['openvpn_tcp', 'ikev2'],
    premium: true
  },
  v2ray: {
    name: "V2Ray",
    description: "Multi-protocol proxy tool that supports various obfuscation methods",
    compatibleProtocols: ['shadowsocks'],
    premium: true
  },
  websocket: {
    name: "WebSocket",
    description: "Encapsulates VPN traffic in WebSocket connections to bypass restrictions",
    compatibleProtocols: ['wireguard', 'shadowsocks'],
    premium: true
  }
};

interface ObfuscationSettingsProps {
  userSettings: any;
  updateSettings: (settings: any) => Promise<void>;
  hasAccess: boolean;
  currentProtocol: string;
}

export function ObfuscationSettings({ 
  userSettings, 
  updateSettings, 
  hasAccess, 
  currentProtocol 
}: ObfuscationSettingsProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [availableMethods, setAvailableMethods] = useState<string[]>([]);
  const [selectedMethod, setSelectedMethod] = useState<string>('none');
  const [isEnabled, setIsEnabled] = useState(!!userSettings?.obfuscation);
  const [antiCensorshipEnabled, setAntiCensorshipEnabled] = useState(!!userSettings?.antiCensorship);
  
  // Fetch available obfuscation methods for the current protocol
  useEffect(() => {
    if (!currentProtocol) return;
    
    const fetchMethods = async () => {
      try {
        const response = await apiRequest('GET', `/api/obfuscation/methods/${currentProtocol}`);
        const data = await response.json();
        setAvailableMethods(data.methods || []);
      } catch (error) {
        console.error('Error fetching obfuscation methods:', error);
        setAvailableMethods([]);
      }
    };
    
    fetchMethods();
  }, [currentProtocol]);
  
  // Update settings when the switch is toggled
  const handleToggleObfuscation = async (checked: boolean) => {
    setLoading(true);
    
    try {
      await updateSettings({
        ...userSettings,
        obfuscation: checked
      });
      
      setIsEnabled(checked);
      
      toast({
        title: checked ? 'Obfuscation Enabled' : 'Obfuscation Disabled',
        description: checked 
          ? 'Your VPN traffic will now be obfuscated to bypass restrictions' 
          : 'Standard VPN traffic will be used',
        variant: checked ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error updating obfuscation settings:', error);
      toast({
        title: 'Failed to update settings',
        description: 'There was an error updating your obfuscation settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Update settings when anti-censorship is toggled
  const handleToggleAntiCensorship = async (checked: boolean) => {
    setLoading(true);
    
    try {
      await updateSettings({
        ...userSettings,
        antiCensorship: checked
      });
      
      setAntiCensorshipEnabled(checked);
      
      toast({
        title: checked ? 'Anti-Censorship Enabled' : 'Anti-Censorship Disabled',
        description: checked 
          ? 'Additional measures will be used to bypass censorship in restricted regions' 
          : 'Standard obfuscation will be used without anti-censorship features',
        variant: checked ? 'default' : 'destructive',
      });
    } catch (error) {
      console.error('Error updating anti-censorship settings:', error);
      toast({
        title: 'Failed to update settings',
        description: 'There was an error updating your anti-censorship settings',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Change the obfuscation method
  const handleMethodChange = async (value: string) => {
    setSelectedMethod(value);
    
    // Here you could implement a call to update the preferred obfuscation method
    // in the user settings, if you want to store it persistently
  };
  
  // Generate list of available methods for the select dropdown
  const methodOptions = availableMethods
    .filter(method => OBFUSCATION_METHODS[method])
    .map(method => {
      const methodInfo = OBFUSCATION_METHODS[method];
      const isPremium = methodInfo.premium;
      const isCompatible = methodInfo.compatibleProtocols.includes(currentProtocol);
      
      return {
        id: method,
        name: methodInfo.name,
        description: methodInfo.description,
        disabled: (isPremium && !hasAccess) || !isCompatible
      };
    });
  
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-blue-500" />
          Obfuscation & Anti-Censorship
        </CardTitle>
        <CardDescription>
          Mask your VPN traffic to bypass deep packet inspection and avoid detection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="obfuscation" className="text-base">Enable Obfuscation</Label>
            <p className="text-sm text-muted-foreground">
              Hide VPN traffic patterns from ISPs and firewalls
            </p>
          </div>
          <div className="flex items-center">
            {!hasAccess && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge className="mr-2 bg-amber-600" variant="secondary">
                      Premium
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Requires Premium or Ultimate subscription</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <Switch
              id="obfuscation"
              checked={isEnabled}
              onCheckedChange={handleToggleObfuscation}
              disabled={loading || !hasAccess}
            />
          </div>
        </div>
        
        {/* Obfuscation Method Selector - only show when obfuscation is enabled */}
        {isEnabled && (
          <div className="space-y-2 pt-2">
            <Label htmlFor="obfuscation-method">Obfuscation Method</Label>
            <Select 
              value={selectedMethod} 
              onValueChange={handleMethodChange}
              disabled={loading || !hasAccess}
            >
              <SelectTrigger id="obfuscation-method" className="w-full">
                <SelectValue placeholder="Select obfuscation method" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {methodOptions.map((option) => (
                    <SelectItem 
                      key={option.id} 
                      value={option.id}
                      disabled={option.disabled}
                    >
                      <div className="flex flex-col">
                        <span>{option.name}</span>
                        <span className="text-xs text-muted-foreground truncate max-w-[250px]">
                          {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Different methods work better in different network environments
            </p>
          </div>
        )}
        
        {/* Anti-Censorship Toggle - only show if obfuscation is enabled */}
        {isEnabled && hasAccess && (
          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5">
              <Label htmlFor="anti-censorship" className="text-base">Anti-Censorship Mode</Label>
              <p className="text-sm text-muted-foreground">
                Additional measures for highly-restricted regions
              </p>
            </div>
            <Switch
              id="anti-censorship"
              checked={antiCensorshipEnabled}
              onCheckedChange={handleToggleAntiCensorship}
              disabled={loading || !hasAccess}
            />
          </div>
        )}
        
        {/* Premium feature message */}
        {!hasAccess && (
          <div className="mt-4 p-3 bg-muted rounded-lg flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            <p className="text-sm text-muted-foreground">
              Obfuscation is available with Premium and Ultimate subscriptions.
              <a href="/subscription" className="text-blue-500 ml-1 hover:underline">
                Upgrade your plan
              </a>
            </p>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        {isEnabled && hasAccess ? (
          <div className="text-sm text-green-600 flex items-center gap-1">
            <Shield className="h-4 w-4" />
            <span>Traffic obfuscation active</span>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <WifiOff className="h-4 w-4" />
            <span>Traffic obfuscation inactive</span>
          </div>
        )}
        
        {loading && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Updating...</span>
          </div>
        )}
      </CardFooter>
    </Card>
  );
}