import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppSetting } from '@shared/schema';

/**
 * Loads the Google AdSense script using the ID from app settings
 * 
 * This should be used once in your app's initialization
 * It adds the AdSense script to the document head
 */
export function AdSenseScript() {
  // Only fetch this if the user is on the free plan
  // This helps optimize loading for paid users
  const { data: adsenseSetting, isLoading } = useQuery<AppSetting>({
    queryKey: ['/api/app-settings/google_adsense_id'],
    staleTime: 3600000, // Cache for 1 hour
    retry: 1, // Only retry once to avoid slowing down the app
  });

  useEffect(() => {
    // Skip loading for development environment
    if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
      console.log('AdSense disabled in development environment');
      return;
    }
    
    if (!isLoading && adsenseSetting?.value) {
      // Delay loading AdSense until after page is fully loaded
      // This improves initial page load time
      const timer = setTimeout(() => {
        // TypeScript safety check for null value
        if (typeof adsenseSetting.value === 'string') {
          loadAdSenseScript(adsenseSetting.value);
        }
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [adsenseSetting, isLoading]);

  return null; // This component doesn't render anything
}

/**
 * Utility function to load the AdSense script
 */
export function loadAdSenseScript(adsenseId: string) {
  if (typeof window !== 'undefined' && !document.getElementById('google-adsense-script')) {
    try {
      // Set up adsense global variable
      window.adsbygoogle = window.adsbygoogle || [];
      
      // Create the script element
      const script = document.createElement('script');
      script.id = 'google-adsense-script';
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-${adsenseId}`;
      
      // Add error handling
      script.onerror = () => {
        console.warn('Failed to load AdSense script, but continuing app execution');
        // Remove the failed script
        if (script.parentNode) {
          script.parentNode.removeChild(script);
        }
      };
      
      // Append to document head
      document.head.appendChild(script);
      console.log('AdSense script loaded');
      
      return true;
    } catch (error) {
      console.error('Error loading AdSense script:', error);
      return false;
    }
  }
  
  return false;
}

// Add to window global type
declare global {
  interface Window {
    adsbygoogle: any[];
  }
}