import { Link, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { 
  LayoutDashboard, 
  Map, 
  Settings, 
  User, 
  HeadphonesIcon,
  Shield,
  CreditCard,
  Lock
} from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  
  const isActive = (path: string) => location === path;
  
  return (
    <aside className="hidden md:flex md:flex-col w-64 bg-gray-900 border-r border-gray-800">
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary-700">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">SecureVPN</h1>
        </div>
      </div>
      
      <nav className="flex-grow p-5 space-y-1">
        <Link to="/">
          <div className={`flex items-center px-4 py-3 rounded-lg ${
            isActive('/') 
              ? 'bg-primary-900 text-white' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          } transition-colors cursor-pointer`}>
            <LayoutDashboard className="mr-3 h-5 w-5" />
            <span>Dashboard</span>
          </div>
        </Link>
        <Link to="/servers">
          <div className={`flex items-center px-4 py-3 rounded-lg ${
            isActive('/servers') 
              ? 'bg-primary-900 text-white' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          } transition-colors cursor-pointer`}>
            <Map className="mr-3 h-5 w-5" />
            <span>Servers</span>
          </div>
        </Link>
        <Link to="/settings">
          <div className={`flex items-center px-4 py-3 rounded-lg ${
            isActive('/settings') 
              ? 'bg-primary-900 text-white' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          } transition-colors cursor-pointer`}>
            <Settings className="mr-3 h-5 w-5" />
            <span>Settings</span>
          </div>
        </Link>
        <Link to="/settings-standalone">
          <div className={`flex items-center px-4 py-3 rounded-lg ${
            isActive('/settings-standalone') 
              ? 'bg-primary-900 text-white' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          } transition-colors cursor-pointer`}>
            <Settings className="mr-3 h-5 w-5" />
            <span>Simple Settings</span>
          </div>
        </Link>
        <Link to="/account">
          <div className={`flex items-center px-4 py-3 rounded-lg ${
            isActive('/account') 
              ? 'bg-primary-900 text-white' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          } transition-colors cursor-pointer`}>
            <User className="mr-3 h-5 w-5" />
            <span>Account</span>
          </div>
        </Link>
        <Link to="/subscription">
          <div className={`flex items-center px-4 py-3 rounded-lg ${
            isActive('/subscription') 
              ? 'bg-primary-900 text-white' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          } transition-colors cursor-pointer`}>
            <CreditCard className="mr-3 h-5 w-5" />
            <span>Subscription</span>
          </div>
        </Link>
        <Link to="/support">
          <div className={`flex items-center px-4 py-3 rounded-lg ${
            isActive('/support') 
              ? 'bg-primary-900 text-white' 
              : 'text-gray-400 hover:bg-gray-800 hover:text-white'
          } transition-colors cursor-pointer`}>
            <HeadphonesIcon className="mr-3 h-5 w-5" />
            <span>Support</span>
          </div>
        </Link>
        
        {/* Admin link - only visible to admin user */}
        {user?.id === 1 && (
          <Link to="/admin">
            <div className={`flex items-center px-4 py-3 rounded-lg ${
              isActive('/admin') 
                ? 'bg-primary-900 text-white' 
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'
            } transition-colors cursor-pointer`}>
              <Lock className="mr-3 h-5 w-5" />
              <span>Admin Panel</span>
            </div>
          </Link>
        )}
      </nav>
      
      <div className="p-5 border-t border-gray-800">
        <div className="p-4 rounded-lg bg-gray-800">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Your Plan</span>
            <span className={`px-2 py-1 text-xs rounded-full text-white ${
              user?.subscription === 'ultimate' ? 'bg-purple-700' :
              user?.subscription === 'premium' ? 'bg-indigo-700' :
              user?.subscription === 'basic' ? 'bg-blue-700' : 
              'bg-gray-700'
            }`}>
              {user?.subscription ? user.subscription.charAt(0).toUpperCase() + user.subscription.slice(1) : 'Free'}
            </span>
          </div>
          <div className="mb-2">
            <div className="flex justify-between items-center mb-1 text-sm">
              <span>Bandwidth Usage</span>
              <span>65%</span>
            </div>
            <Progress value={65} className="h-2" />
          </div>
          <Link to="/subscription">
            <Button 
              variant="default" 
              className="w-full mt-2 py-2 px-4 bg-primary-700 hover:bg-primary-800 text-white text-sm rounded-lg"
            >
              Upgrade Plan
            </Button>
          </Link>
        </div>
      </div>
    </aside>
  );
}
