import { Link, useLocation } from 'wouter';
import { LayoutDashboard, Map, Settings, User } from 'lucide-react';

export default function MobileNav() {
  const [location] = useLocation();
  
  const isActive = (path: string) => location === path;
  
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 z-10">
      <div className="flex justify-around p-3">
        <Link href="/">
          <a className="flex flex-col items-center text-center">
            <LayoutDashboard className={`h-6 w-6 ${isActive('/') ? 'text-primary-500' : 'text-gray-400'}`} />
            <span className={`text-xs mt-1 ${isActive('/') ? 'text-primary-500' : 'text-gray-400'}`}>Dashboard</span>
          </a>
        </Link>
        <Link href="/servers">
          <a className="flex flex-col items-center text-center">
            <Map className={`h-6 w-6 ${isActive('/servers') ? 'text-primary-500' : 'text-gray-400'}`} />
            <span className={`text-xs mt-1 ${isActive('/servers') ? 'text-primary-500' : 'text-gray-400'}`}>Servers</span>
          </a>
        </Link>
        <Link href="/settings">
          <a className="flex flex-col items-center text-center">
            <Settings className={`h-6 w-6 ${isActive('/settings') ? 'text-primary-500' : 'text-gray-400'}`} />
            <span className={`text-xs mt-1 ${isActive('/settings') ? 'text-primary-500' : 'text-gray-400'}`}>Settings</span>
          </a>
        </Link>
        <Link href="/account">
          <a className="flex flex-col items-center text-center">
            <User className={`h-6 w-6 ${isActive('/account') ? 'text-primary-500' : 'text-gray-400'}`} />
            <span className={`text-xs mt-1 ${isActive('/account') ? 'text-primary-500' : 'text-gray-400'}`}>Account</span>
          </a>
        </Link>
      </div>
    </div>
  );
}
