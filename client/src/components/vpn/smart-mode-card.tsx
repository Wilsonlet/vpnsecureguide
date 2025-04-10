import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ToggleSwitch from '@/components/common/toggle-switch';
import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

type AppItem = {
  id: number;
  name: string;
  type: string;
  icon: string;
  enabled: boolean;
};

export default function SmartModeCard() {
  const [smartModeEnabled, setSmartModeEnabled] = useState(true);
  const [tunnelMode, setTunnelMode] = useState('include');
  
  // Sample apps for split tunneling
  const [apps, setApps] = useState<AppItem[]>([
    { id: 1, name: 'Google Chrome', type: 'Web Browser', icon: 'chrome', enabled: true },
    { id: 2, name: 'Firefox', type: 'Web Browser', icon: 'firefox', enabled: false },
    { id: 3, name: 'Terminal', type: 'System', icon: 'terminal', enabled: true },
    { id: 4, name: 'Mail', type: 'Email Client', icon: 'mail', enabled: true },
    { id: 5, name: 'Spotify', type: 'Music Streaming', icon: 'spotify', enabled: false }
  ]);
  
  const toggleSmartMode = (checked: boolean) => {
    setSmartModeEnabled(checked);
  };
  
  const toggleApp = (id: number, checked: boolean) => {
    setApps(apps.map(app => 
      app.id === id ? { ...app, enabled: checked } : app
    ));
  };
  
  // Get the appropriate icon for each app
  const getAppIcon = (icon: string) => {
    switch (icon) {
      case 'chrome':
        return <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0 18c4.411 0 8-3.589 8-8s-3.589-8-8-8-8 3.589-8 8 3.589 8 8 8z"/><path d="M12 8c2.205 0 4 1.795 4 4s-1.795 4-4 4-4-1.795-4-4 1.795-4 4-4zm0 6c1.103 0 2-.897 2-2s-.897-2-2-2-2 .897-2 2 .897 2 2 2z"/></svg>;
      case 'firefox':
        return <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2c5.514 0 10 4.486 10 10s-4.486 10-10 10-10-4.486-10-10 4.486-10 10-10zm0 18c4.411 0 8-3.589 8-8s-3.589-8-8-8-8 3.589-8 8 3.589 8 8 8z"/></svg>;
      case 'terminal':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>;
      case 'mail':
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>;
      case 'spotify':
        return <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.161.235-.486.306-.735.159-2.028-1.24-4.586-1.522-7.6-.832-.257.059-.517-.098-.576-.352-.059-.257.097-.517.352-.576 3.285-.745 6.109-.42 8.395.967.249.152.321.476.164.734zm1.228-2.722c-.197.306-.607.396-.913.198-2.32-1.427-5.86-1.842-8.6-1.008-.335.102-.692-.084-.793-.42-.102-.334.083-.691.419-.793 3.131-.95 7.03-.477 9.69 1.109.307.198.396.608.197.914zm.105-2.834c-2.784-1.653-7.373-1.805-10.025-.99-.421.13-.868-.103-.997-.523-.129-.421.103-.867.523-.997 3.069-.931 8.17-.752 11.393 1.155.367.219.488.688.271 1.055-.218.366-.687.487-1.055.27.01 0 .01.01-.11.03z"/></svg>;
      default:
        return <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>;
    }
  };

  return (
    <Card className="border border-gray-800 shadow-lg bg-gray-950">
      <CardHeader className="border-b border-gray-800 flex justify-between items-center p-5">
        <h3 className="font-medium">Smart Mode & Apps</h3>
        <div>
          <ToggleSwitch checked={smartModeEnabled} onChange={toggleSmartMode} />
        </div>
      </CardHeader>
      <CardContent className="p-5">
        <p className="text-gray-400 text-sm mb-4">
          Choose which apps and websites use the VPN connection.
        </p>
        
        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium">Split Tunneling</h4>
            <Select value={tunnelMode} onValueChange={setTunnelMode}>
              <SelectTrigger className="bg-gray-800 border-gray-700 w-[140px] text-xs">
                <SelectValue placeholder="Select Mode" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="include">Include Mode</SelectItem>
                <SelectItem value="exclude">Exclude Mode</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-gray-400 mb-4">
            {tunnelMode === 'include' 
              ? 'Only selected applications will use the VPN connection.' 
              : 'Selected applications will bypass the VPN connection.'}
          </p>
          
          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
            {apps.map(app => (
              <div key={app.id} className="flex items-center justify-between px-3 py-2 bg-gray-800 rounded-lg">
                <div className="flex items-center">
                  <div className="mr-3 text-xl">{getAppIcon(app.icon)}</div>
                  <div>
                    <h5 className="font-medium">{app.name}</h5>
                    <p className="text-xs text-gray-400">{app.type}</p>
                  </div>
                </div>
                <ToggleSwitch checked={app.enabled} onChange={(checked) => toggleApp(app.id, checked)} />
              </div>
            ))}
          </div>
          
          <Button 
            className="mt-4 w-full bg-gray-800 hover:bg-gray-700 text-white gap-2"
            variant="outline"
            onClick={() => {/* Add application functionality */}}
          >
            <PlusCircle className="w-4 h-4" />
            <span>Add Application</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
