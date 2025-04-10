import { Bell, Shield, User, CreditCard, HelpCircle, LogOut, Settings, Lock } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Link, useLocation } from 'wouter';

type HeaderProps = {
  username: string;
};

export default function Header({ username }: HeaderProps) {
  const { logoutMutation, user } = useAuth();
  const [location] = useLocation();
  
  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  // Determine current page title
  let pageTitle = "Dashboard";
  if (location.startsWith("/servers")) pageTitle = "VPN Servers";
  if (location.startsWith("/settings")) pageTitle = "VPN Settings";
  if (location.startsWith("/account")) pageTitle = "Account";
  if (location.startsWith("/subscription")) pageTitle = "Subscription Plans";
  if (location.startsWith("/support")) pageTitle = "Support";
  if (location.startsWith("/admin")) pageTitle = "Admin Panel";
  
  return (
    <header className="sticky top-0 z-10 bg-gray-900 border-b border-gray-800 px-4 md:px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center md:hidden">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-700">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-lg font-bold text-white">SecureVPN</h1>
          </div>
        </div>
        <div className="hidden md:block">
          <h2 className="text-xl font-semibold">{pageTitle}</h2>
        </div>
        <div className="flex items-center space-x-4">
          <div className="hidden sm:block">
            <Button variant="outline" size="sm" className="bg-primary-900 border-primary-700 text-white hover:bg-primary-800">
              {user?.subscription === 'premium' ? 'Premium' : 'Free'} Plan
            </Button>
          </div>
          <div className="relative">
            <Button variant="ghost" size="icon" className="rounded-full">
              <Bell className="h-5 w-5 text-gray-400" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-yellow-500 rounded-full"></span>
            </Button>
          </div>
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="flex items-center space-x-2">
                  <div className="w-9 h-9 rounded-full bg-primary-700 flex items-center justify-center text-white font-medium">
                    {username.substring(0, 2).toUpperCase()}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-sm font-medium">
                  <div className="text-primary">{username}</div>
                  <div className="text-xs text-muted-foreground">{user?.email || "No email set"}</div>
                </div>
                <DropdownMenuSeparator />
                <Link href="/account">
                  <DropdownMenuItem className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    <span>Account Settings</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/subscription">
                  <DropdownMenuItem className="cursor-pointer">
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Subscription</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/settings">
                  <DropdownMenuItem className="cursor-pointer">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>VPN Settings</span>
                  </DropdownMenuItem>
                </Link>
                <Link href="/support">
                  <DropdownMenuItem className="cursor-pointer">
                    <HelpCircle className="mr-2 h-4 w-4" />
                    <span>Help & Support</span>
                  </DropdownMenuItem>
                </Link>
                
                {user?.id === 1 && (
                  <>
                    <DropdownMenuSeparator />
                    <Link href="/admin">
                      <DropdownMenuItem className="cursor-pointer">
                        <Lock className="mr-2 h-4 w-4" />
                        <span>Admin Panel</span>
                      </DropdownMenuItem>
                    </Link>
                  </>
                )}
                
                <DropdownMenuSeparator />
                <DropdownMenuItem className="cursor-pointer" onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
