import { ReactNode } from 'react';
import Footer from './footer';
import { MobileConnectionStatus } from '@/components/vpn/mobile-connection-status';

interface LayoutProps {
  children: ReactNode;
  hideFooter?: boolean;
}

export function Layout({ children, hideFooter = false }: LayoutProps) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Mobile Connection Status Indicator - will only show on mobile devices */}
      <MobileConnectionStatus />
      
      <div className="flex-grow">
        {children}
      </div>
      {!hideFooter && <Footer />}
    </div>
  );
}

export default Layout;