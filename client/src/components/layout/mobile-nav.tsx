import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Map, Settings, User, CreditCard, Shield } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export default function MobileNav() {
  const [location] = useLocation();
  const { user } = useAuth();
  
  const isActive = (path: string) => location === path;
  
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-10">
      <div className="flex justify-around p-3">
        <Link href="/">
          <div className="flex flex-col items-center text-center cursor-pointer">
            <LayoutDashboard className={`h-6 w-6 ${isActive('/') ? 'text-primary-500' : 'text-gray-400'}`} />
            <span className={`text-xs mt-1 ${isActive('/') ? 'text-primary-500' : 'text-gray-400'}`}>Dashboard</span>
          </div>
        </Link>
        <Link href="/servers">
          <div className="flex flex-col items-center text-center cursor-pointer">
            <Map className={`h-6 w-6 ${isActive('/servers') ? 'text-primary-500' : 'text-gray-400'}`} />
            <span className={`text-xs mt-1 ${isActive('/servers') ? 'text-primary-500' : 'text-gray-400'}`}>Servers</span>
          </div>
        </Link>
        <Link href="/subscription">
          <div className="flex flex-col items-center text-center cursor-pointer">
            <CreditCard className={`h-6 w-6 ${isActive('/subscription') ? 'text-primary-500' : 'text-gray-400'}`} />
            <span className={`text-xs mt-1 ${isActive('/subscription') ? 'text-primary-500' : 'text-gray-400'}`}>Plans</span>
          </div>
        </Link>
        <Link href="/settings">
          <div className="flex flex-col items-center text-center cursor-pointer">
            <Settings className={`h-6 w-6 ${isActive('/settings') ? 'text-primary-500' : 'text-gray-400'}`} />
            <span className={`text-xs mt-1 ${isActive('/settings') ? 'text-primary-500' : 'text-gray-400'}`}>Settings</span>
          </div>
        </Link>
        <Link href="/account">
          <div className="flex flex-col items-center text-center cursor-pointer">
            <User className={`h-6 w-6 ${isActive('/account') ? 'text-primary-500' : 'text-gray-400'}`} />
            <span className={`text-xs mt-1 ${isActive('/account') ? 'text-primary-500' : 'text-gray-400'}`}>Account</span>
          </div>
        </Link>
      </div>
    </div>
  );
}
