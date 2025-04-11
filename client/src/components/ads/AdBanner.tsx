import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { subscriptionTiers, AppSetting } from '@shared/schema';

// Define the SubscriptionResponse type
interface SubscriptionResponse {
  subscription: string;
  expiryDate: string | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
}

type AdBannerProps = {
  adSlot: string;
  format?: 'auto' | 'rectangle' | 'horizontal' | 'vertical';
  className?: string;
}

/**
 * Google AdSense Ad Banner
 * Only displayed for free tier users
 */
export default function AdBanner({ adSlot, format = 'auto', className = '' }: AdBannerProps) {
  const { user } = useAuth();
  const adRef = useRef<HTMLDivElement>(null);
  
  // Query user's subscription status
  const { data: subscription } = useQuery<SubscriptionResponse>({
    queryKey: ['/api/subscription'],
    enabled: !!user,
  });
  
  // Fetch Google AdSense ID from app settings
  const { data: adsenseSetting } = useQuery<AppSetting>({
    queryKey: ['/api/app-settings/google_adsense_id'],
  });
  
  // Only show ads for free tier users if AdSense ID is configured
  const shouldShowAds = 
    (!subscription || subscription.subscription === subscriptionTiers.FREE) && 
    !!adsenseSetting?.value;

  useEffect(() => {
    // Skip for paid users, without AdSense ID, or when component is not mounted
    if (!shouldShowAds || !adRef.current || !adsenseSetting?.value) return;
    
    // Clean up any previous ad instances
    if (adRef.current.innerHTML !== '') {
      adRef.current.innerHTML = '';
    }
    
    try {
      // Create the ad element
      const adElement = document.createElement('ins');
      adElement.className = 'adsbygoogle';
      adElement.style.display = 'block';
      adElement.style.width = '100%';
      adElement.style.height = format === 'auto' ? 'auto' : '100%';
      adElement.setAttribute('data-ad-client', `ca-pub-${adsenseSetting.value}`);
      adElement.setAttribute('data-ad-slot', adSlot);
      adElement.setAttribute('data-ad-format', format);
      adElement.setAttribute('data-full-width-responsive', 'true');
      
      // Add the ad to the DOM
      adRef.current.appendChild(adElement);
      
      // Initialize the ad
      try {
        // @ts-ignore - Google AdSense's push method
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (error) {
        console.error('AdSense error:', error);
      }
    } catch (error) {
      console.error('Failed to create ad:', error);
    }
    
    return () => {
      // Clean up on unmount
      if (adRef.current) {
        adRef.current.innerHTML = '';
      }
    };
  }, [adSlot, format, shouldShowAds, adsenseSetting]);

  // Don't render anything for paid users
  if (!shouldShowAds) return null;

  return (
    <div 
      ref={adRef}
      className={`ad-container bg-gray-800/50 rounded-lg overflow-hidden border border-gray-700 ${className}`}
      style={{ minHeight: '90px' }}
    />
  );
}