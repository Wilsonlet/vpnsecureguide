import { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Sidebar from '@/components/layout/sidebar';
import MobileNav from '@/components/layout/mobile-nav';
import Header from '@/components/layout/header';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useVpnState } from '@/lib/vpn-service';
import { Badge } from '@/components/ui/badge';
import { 
  Laptop, Smartphone, Shield, Download, Code, Key, Check, 
  Clock, Info, Star, ArrowRight, Apple, Globe,
  FileDown, Server, Settings
} from 'lucide-react';
import { 
  FaWindows, FaApple, FaLinux, FaAndroid, FaAppStore
} from 'react-icons/fa';

// Client download item component
interface ClientDownloadProps {
  title: string;
  version: string;
  description: string;
  icon: React.ReactNode;
  downloadUrl: string;
  releaseDate: string;
  size: string;
  isNew?: boolean;
  isPremium?: boolean;
  features: string[];
}

function ClientDownload({
  title,
  version,
  description,
  icon,
  downloadUrl,
  releaseDate,
  size,
  isNew = false,
  isPremium = false,
  features
}: ClientDownloadProps) {
  const { user } = useAuth();
  const isPremiumUser = user?.subscription === 'premium';
  const isDownloadable = !isPremium || isPremiumUser;

  return (
    <Card className="overflow-hidden border border-gray-800 bg-gray-950">
      <CardHeader className="bg-gray-900 pb-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center">
            <div className="w-12 h-12 flex items-center justify-center text-3xl text-primary mr-3">
              {icon}
            </div>
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                {title}
                {isNew && (
                  <Badge variant="default" className="bg-green-600 hover:bg-green-700">New</Badge>
                )}
                {isPremium && (
                  <Badge variant="default" className="bg-amber-600 hover:bg-amber-700">Premium</Badge>
                )}
              </CardTitle>
              <CardDescription className="mt-1">
                Version {version} • Released {releaseDate} • {size}
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4 pb-2">
        <p className="text-sm text-gray-300 mb-4">{description}</p>
        <div className="grid grid-cols-1 gap-1 mb-4">
          {features.map((feature, index) => (
            <div key={index} className="flex items-start">
              <Check className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
              <span className="text-sm text-gray-300">{feature}</span>
            </div>
          ))}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pt-2 pb-4 border-t border-gray-800">
        {isDownloadable ? (
          <Button 
            className="w-full flex items-center justify-center"
            onClick={() => window.open(downloadUrl, '_blank')}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        ) : (
          <Button 
            className="w-full flex items-center justify-center bg-amber-600 hover:bg-amber-700"
            disabled
          >
            <Shield className="h-4 w-4 mr-2" />
            Premium Only
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// Config Generator component
function ConfigGenerator() {
  const { user } = useAuth();
  const vpnState = useVpnState();
  const [platform, setPlatform] = useState('windows');
  const [protocol, setProtocol] = useState('wireguard');
  const [config, setConfig] = useState('');

  // Function to simulate generating configs
  const generateConfig = () => {
    // In a real implementation, this would make an API call to generate the config
    const username = user?.username || 'user';
    const serverIp = vpnState.selectedServer?.ip || '198.51.100.1';
    const selectedProtocol = protocol;
    
    let configText = '';
    if (protocol === 'wireguard') {
      configText = `[Interface]
PrivateKey = PLACEHOLDER_PRIVATE_KEY
Address = 10.0.0.2/32
DNS = 8.8.8.8, 8.8.4.4

[Peer]
PublicKey = PLACEHOLDER_SERVER_PUBLIC_KEY
AllowedIPs = 0.0.0.0/0
Endpoint = ${serverIp}:51820
PersistentKeepalive = 25`;
    } else if (protocol === 'openvpn') {
      configText = `client
dev tun
proto udp
remote ${serverIp} 1194
resolv-retry infinite
nobind
persist-key
persist-tun
remote-cert-tls server
verify-x509-name server_PLACEHOLDER name
auth SHA256
auth-nocache
cipher AES-128-GCM
tls-client
tls-version-min 1.2
tls-cipher TLS-ECDHE-RSA-WITH-AES-128-GCM-SHA256
ignore-unknown-option block-outside-dns
setenv opt block-outside-dns
verb 3
<ca>
PLACEHOLDER_CA_CERTIFICATE
</ca>
<cert>
PLACEHOLDER_CLIENT_CERTIFICATE
</cert>
<key>
PLACEHOLDER_CLIENT_PRIVATE_KEY
</key>`;
    }
    
    setConfig(configText);
  };

  return (
    <Card className="border border-gray-800 bg-gray-950">
      <CardHeader className="bg-gray-900">
        <CardTitle className="text-xl flex items-center">
          <Code className="h-5 w-5 mr-2" />
          Configuration Generator
        </CardTitle>
        <CardDescription>
          Generate custom configuration files for your devices
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="grid gap-6">
          <div>
            <h4 className="text-sm font-medium mb-3">Select Platform</h4>
            <div className="grid grid-cols-5 gap-2">
              <Button 
                variant={platform === 'windows' ? 'default' : 'outline'} 
                className="flex flex-col items-center py-3" 
                onClick={() => setPlatform('windows')}
              >
                <FaWindows className="h-6 w-6 mb-1" />
                <span className="text-xs">Windows</span>
              </Button>
              <Button 
                variant={platform === 'macos' ? 'default' : 'outline'} 
                className="flex flex-col items-center py-3" 
                onClick={() => setPlatform('macos')}
              >
                <FaApple className="h-6 w-6 mb-1" />
                <span className="text-xs">macOS</span>
              </Button>
              <Button 
                variant={platform === 'linux' ? 'default' : 'outline'} 
                className="flex flex-col items-center py-3" 
                onClick={() => setPlatform('linux')}
              >
                <FaLinux className="h-6 w-6 mb-1" />
                <span className="text-xs">Linux</span>
              </Button>
              <Button 
                variant={platform === 'android' ? 'default' : 'outline'} 
                className="flex flex-col items-center py-3" 
                onClick={() => setPlatform('android')}
              >
                <FaAndroid className="h-6 w-6 mb-1" />
                <span className="text-xs">Android</span>
              </Button>
              <Button 
                variant={platform === 'ios' ? 'default' : 'outline'} 
                className="flex flex-col items-center py-3" 
                onClick={() => setPlatform('ios')}
              >
                <FaAppStore className="h-6 w-6 mb-1" />
                <span className="text-xs">iOS</span>
              </Button>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-medium mb-3">Select Protocol</h4>
            <div className="grid grid-cols-3 gap-2">
              <Button 
                variant={protocol === 'wireguard' ? 'default' : 'outline'} 
                className="flex items-center justify-center" 
                onClick={() => setProtocol('wireguard')}
              >
                <Shield className="h-4 w-4 mr-2" />
                WireGuard
              </Button>
              <Button 
                variant={protocol === 'openvpn' ? 'default' : 'outline'} 
                className="flex items-center justify-center" 
                onClick={() => setProtocol('openvpn')}
              >
                <Globe className="h-4 w-4 mr-2" />
                OpenVPN
              </Button>
              <Button 
                variant={protocol === 'ikev2' ? 'default' : 'outline'} 
                className="flex items-center justify-center" 
                onClick={() => setProtocol('ikev2')}
              >
                <Key className="h-4 w-4 mr-2" />
                IKEv2/IPSec
              </Button>
            </div>
          </div>
          
          <div className="flex justify-center mt-2">
            <Button 
              className="px-8"
              onClick={generateConfig}
              disabled={!vpnState.selectedServer}
            >
              {vpnState.selectedServer ? 'Generate Config' : 'Select a server first'}
            </Button>
          </div>
          
          {config && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium">Configuration</h4>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => {
                    const blob = new Blob([config], { type: 'text/plain' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `config-${protocol}-${platform}.conf`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }}
                >
                  <FileDown className="h-4 w-4 mr-1" />
                  Download
                </Button>
              </div>
              <div className="bg-black rounded-md p-4 overflow-auto max-h-60">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap">{config}</pre>
              </div>
              <div className="flex items-center mt-3 p-3 bg-blue-900/30 rounded-md border border-blue-800">
                <Info className="h-5 w-5 text-blue-500 mr-2 flex-shrink-0" />
                <p className="text-xs text-blue-200">
                  This is a sample configuration. In a production environment, this would contain secure, 
                  user-specific credentials generated on-demand.
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Setup Instructions component
function SetupInstructions({ platform }: { platform: string }) {
  const instructions: Record<string, { steps: string[], imageUrl?: string }> = {
    windows: {
      steps: [
        "Download and install the Windows client from the downloads section.",
        "Run the installer and follow the on-screen instructions.",
        "After installation, launch the application.",
        "Log in with your credentials or import a configuration file.",
        "Select a server and connect to the VPN.",
        "Verify your connection by checking your IP address has changed."
      ],
      imageUrl: "/assets/windows-client-preview.png"
    },
    macos: {
      steps: [
        "Download the macOS client from the downloads section.",
        "Open the .dmg file and drag the application to your Applications folder.",
        "Launch the application from your Applications folder.",
        "If prompted about security, go to System Preferences > Security & Privacy to allow the app.",
        "Log in with your credentials or import a configuration file.",
        "Select a server and connect to the VPN."
      ],
      imageUrl: "/assets/macos-client-preview.png"
    },
    linux: {
      steps: [
        "Download the appropriate Linux package for your distribution.",
        "For Debian/Ubuntu, install with: sudo dpkg -i secure-vpn.deb",
        "For RPM-based distributions: sudo rpm -i secure-vpn.rpm",
        "For Arch Linux: yay -S secure-vpn",
        "Launch the application from your application menu or terminal.",
        "Log in with your credentials or import the configuration file."
      ],
      imageUrl: "/assets/linux-client-preview.png"
    },
    android: {
      steps: [
        "Download the Android app from the Google Play Store or directly from the downloads section.",
        "Install the application and open it.",
        "Log in with your credentials or scan the QR code from your account page.",
        "Grant any required permissions when prompted.",
        "Select a server and connect to the VPN.",
        "Optional: Configure the app to automatically connect on untrusted networks."
      ],
      imageUrl: "/assets/android-client-preview.png"
    },
    ios: {
      steps: [
        "Download the iOS app from the App Store or directly from the downloads section.",
        "Install the application and open it.",
        "Log in with your credentials or scan the QR code from your account page.",
        "Follow the prompts to add a VPN configuration to your device.",
        "Select a server and connect to the VPN.",
        "Optional: Enable the 'Connect on Demand' feature for automatic connection."
      ],
      imageUrl: "/assets/ios-client-preview.png"
    }
  };

  const { steps, imageUrl } = instructions[platform] || instructions.windows;

  return (
    <Card className="border border-gray-800 bg-gray-950">
      <CardHeader className="bg-gray-900">
        <CardTitle className="text-xl flex items-center">
          <Settings className="h-5 w-5 mr-2" />
          Setup Instructions
        </CardTitle>
        <CardDescription>
          Follow these steps to set up the VPN client on your device
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-6">
          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={index} className="flex items-start">
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary flex items-center justify-center mr-3 mt-0.5">
                  <span className="text-sm font-medium text-white">{index + 1}</span>
                </div>
                <p className="text-sm text-gray-300">{step}</p>
              </div>
            ))}
          </div>
          
          {imageUrl && (
            <div className="mt-6 rounded-lg border border-gray-800 p-4 bg-gray-900 flex justify-center">
              <div className="flex flex-col items-center">
                <p className="text-xs text-gray-400 mb-2">Client Preview</p>
                <div className="h-36 w-64 bg-gray-800 rounded-md flex items-center justify-center">
                  <Server className="h-12 w-12 text-gray-600" />
                </div>
                <p className="text-xs text-gray-500 mt-2">Image placeholder - actual client interface shown in production</p>
              </div>
            </div>
          )}
          
          <div className="flex items-center p-3 bg-yellow-900/30 rounded-md border border-yellow-800 mt-6">
            <Info className="h-5 w-5 text-yellow-500 mr-2 flex-shrink-0" />
            <p className="text-xs text-yellow-200">
              For additional help or troubleshooting, please visit our support page or contact our customer service team.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ClientsPage() {
  const { user } = useAuth();
  const [platform, setPlatform] = useState('windows');
  
  // Desktop clients data
  const desktopClients = [
    {
      title: "Windows Client",
      version: "2.8.3",
      description: "Our full-featured Windows VPN client with intuitive interface and advanced security features.",
      icon: <FaWindows className="text-primary" />,
      downloadUrl: "#windows-client",
      releaseDate: "April 5, 2025",
      size: "18.7 MB",
      isNew: true,
      isPremium: false,
      features: [
        "WireGuard, OpenVPN, and IKEv2 protocols",
        "Kill switch and DNS leak protection",
        "Split tunneling capabilities",
        "Dark and light theme options",
        "Auto-connect on startup"
      ]
    },
    {
      title: "macOS Client",
      version: "2.7.5",
      description: "Native macOS application with Apple Silicon and Intel support for maximum performance.",
      icon: <FaApple className="text-primary" />,
      downloadUrl: "#macos-client",
      releaseDate: "March 28, 2025",
      size: "24.3 MB",
      isNew: false,
      isPremium: false,
      features: [
        "Native Apple Silicon and Intel support",
        "WireGuard and OpenVPN protocols",
        "Full kill switch implementation",
        "Split tunneling for selected apps",
        "Menu bar quick access"
      ]
    },
    {
      title: "Linux Client",
      version: "2.6.1",
      description: "Open-source Linux client with support for major distributions and advanced customization.",
      icon: <FaLinux className="text-primary" />,
      downloadUrl: "#linux-client",
      releaseDate: "March 15, 2025",
      size: "12.6 MB",
      isNew: false,
      isPremium: false,
      features: [
        "Debian, Ubuntu, Fedora, and Arch packages",
        "Command-line interface option",
        "WireGuard and OpenVPN support",
        "NetShield ad and malware blocking",
        "Custom connection scripts"
      ]
    },
  ];
  
  // Mobile clients data
  const mobileClients = [
    {
      title: "Android Client",
      version: "3.1.0",
      description: "Feature-rich Android VPN with advanced security, battery optimization, and easy server switching.",
      icon: <FaAndroid className="text-primary" />,
      downloadUrl: "#android-client",
      releaseDate: "April 8, 2025",
      size: "22.4 MB",
      isNew: true,
      isPremium: false,
      features: [
        "Background battery optimization",
        "WireGuard and OpenVPN protocols",
        "Split tunneling by app",
        "Automatic connection on untrusted networks",
        "Dark mode and Material You theming"
      ]
    },
    {
      title: "iOS Client",
      version: "3.0.2",
      description: "Sleek, privacy-focused iOS app with iCloud sync, On-Demand VPN, and easy widget access.",
      icon: <FaAppStore className="text-primary" />,
      downloadUrl: "#ios-client",
      releaseDate: "March 30, 2025",
      size: "28.1 MB",
      isNew: false,
      isPremium: false,
      features: [
        "On-Demand VPN connection",
        "iCloud sync across devices",
        "WireGuard and IKEv2 protocols",
        "Home screen widget",
        "Shortcuts app integration"
      ]
    },
    {
      title: "Premium Mobile Suite",
      version: "3.2.5",
      description: "Enhanced mobile client with military-grade security features, double VPN, and obfuscated servers.",
      icon: <Shield className="text-primary" />,
      downloadUrl: "#premium-mobile",
      releaseDate: "April 10, 2025",
      size: "32.7 MB",
      isNew: true,
      isPremium: true,
      features: [
        "Double VPN connections",
        "Obfuscated servers for restrictive networks",
        "Secure core routing",
        "Ad and malware blocking",
        "Priority server access"
      ]
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar for desktop */}
      <Sidebar />
      
      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
        {/* Top header */}
        <Header username={user?.username || ''} />
        
        {/* Client downloads content */}
        <div className="p-4 md:p-6 space-y-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-bold tracking-tight">VPN Client Apps</h2>
            <p className="text-gray-400">
              Download and set up our secure VPN clients across all your devices
            </p>
          </div>
          
          <Tabs defaultValue="downloads" className="w-full space-y-6">
            <TabsList className="grid grid-cols-3 w-full md:w-auto">
              <TabsTrigger value="downloads" className="flex items-center">
                <Download className="h-4 w-4 mr-2" />
                Downloads
              </TabsTrigger>
              <TabsTrigger value="config" className="flex items-center">
                <Code className="h-4 w-4 mr-2" />
                Configuration
              </TabsTrigger>
              <TabsTrigger value="setup" className="flex items-center">
                <Settings className="h-4 w-4 mr-2" />
                Setup Guide
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="downloads" className="space-y-6">
              <div>
                <h3 className="text-lg font-medium mb-4 flex items-center">
                  <Laptop className="h-5 w-5 mr-2" />
                  Desktop Clients
                </h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {desktopClients.map((client, index) => (
                    <ClientDownload key={index} {...client} />
                  ))}
                </div>
              </div>
              
              <div className="pt-2">
                <h3 className="text-lg font-medium mb-4 flex items-center">
                  <Smartphone className="h-5 w-5 mr-2" />
                  Mobile Clients
                </h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {mobileClients.map((client, index) => (
                    <ClientDownload key={index} {...client} />
                  ))}
                </div>
              </div>
            </TabsContent>
            
            <TabsContent value="config">
              <ConfigGenerator />
            </TabsContent>
            
            <TabsContent value="setup" className="space-y-6">
              <div className="mb-6">
                <h3 className="text-lg font-medium mb-4">Choose Your Platform</h3>
                <div className="grid grid-cols-5 gap-4">
                  <Button 
                    variant={platform === 'windows' ? 'default' : 'outline'} 
                    className="flex flex-col items-center py-4" 
                    onClick={() => setPlatform('windows')}
                  >
                    <FaWindows className="h-8 w-8 mb-2" />
                    <span>Windows</span>
                  </Button>
                  <Button 
                    variant={platform === 'macos' ? 'default' : 'outline'} 
                    className="flex flex-col items-center py-4" 
                    onClick={() => setPlatform('macos')}
                  >
                    <FaApple className="h-8 w-8 mb-2" />
                    <span>macOS</span>
                  </Button>
                  <Button 
                    variant={platform === 'linux' ? 'default' : 'outline'} 
                    className="flex flex-col items-center py-4" 
                    onClick={() => setPlatform('linux')}
                  >
                    <FaLinux className="h-8 w-8 mb-2" />
                    <span>Linux</span>
                  </Button>
                  <Button 
                    variant={platform === 'android' ? 'default' : 'outline'} 
                    className="flex flex-col items-center py-4" 
                    onClick={() => setPlatform('android')}
                  >
                    <FaAndroid className="h-8 w-8 mb-2" />
                    <span>Android</span>
                  </Button>
                  <Button 
                    variant={platform === 'ios' ? 'default' : 'outline'} 
                    className="flex flex-col items-center py-4" 
                    onClick={() => setPlatform('ios')}
                  >
                    <FaAppStore className="h-8 w-8 mb-2" />
                    <span>iOS</span>
                  </Button>
                </div>
              </div>
              
              <SetupInstructions platform={platform} />
            </TabsContent>
          </Tabs>
          
          <div className="grid gap-6 md:grid-cols-2 mt-6">
            <Card className="bg-gray-900 border border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Star className="h-5 w-5 text-yellow-500 mr-2" />
                  Premium Features
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-300 mb-4">
                  Upgrade to Premium for advanced security features including:
                </p>
                <ul className="space-y-2">
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                    <span className="text-sm">Double VPN for enhanced privacy</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                    <span className="text-sm">Obfuscated servers to bypass network restrictions</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                    <span className="text-sm">Priority access to high-speed servers</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-4 w-4 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
                    <span className="text-sm">Advanced threat protection and ad blocking</span>
                  </li>
                </ul>
              </CardContent>
              <CardFooter>
                <Button className="w-full">
                  Upgrade to Premium
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
            
            <Card className="bg-gray-900 border border-gray-800">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="h-5 w-5 text-blue-500 mr-2" />
                  Latest Updates
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-300 mb-4">
                  Recent enhancements to our VPN clients:
                </p>
                <div className="space-y-4">
                  <div className="border-l-2 border-primary pl-4 pb-4">
                    <h4 className="text-sm font-medium">Windows Client v2.8.3</h4>
                    <p className="text-xs text-gray-400 mt-1">Released April 5, 2025</p>
                    <p className="text-sm mt-2">Added support for split tunneling by IP ranges and improved connection stability.</p>
                  </div>
                  <div className="border-l-2 border-primary pl-4 pb-4">
                    <h4 className="text-sm font-medium">Android Client v3.1.0</h4>
                    <p className="text-xs text-gray-400 mt-1">Released April 8, 2025</p>
                    <p className="text-sm mt-2">Introduced new Material You theming and optimized battery usage.</p>
                  </div>
                  <div className="border-l-2 border-primary pl-4">
                    <h4 className="text-sm font-medium">All Platforms</h4>
                    <p className="text-xs text-gray-400 mt-1">Released March 25, 2025</p>
                    <p className="text-sm mt-2">Improved server connection times and added Double VPN support for Premium users.</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  View All Release Notes
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      </main>
      
      {/* Mobile navigation */}
      <MobileNav />
    </div>
  );
}