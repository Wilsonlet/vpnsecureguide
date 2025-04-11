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
  const { data: adsenseSetting } = useQuery<AppSetting>({
    queryKey: ['/api/app-settings/google_adsense_id'],
  });

  useEffect(() => {
    if (!adsenseSetting?.value) return;
    
    loadAdSenseScript(adsenseSetting.value);
  }, [adsenseSetting]);

  return null; // This component doesn't render anything
}

/**
 * Utility function to load the AdSense script
 */
export function loadAdSenseScript(adsenseId: string) {
  if (typeof window !== 'undefined' && !document.getElementById('google-adsense-script')) {
    // Set up adsense global variable
    window.adsbygoogle = window.adsbygoogle || [];
    
    // Create the script element
    const script = document.createElement('script');
    script.id = 'google-adsense-script';
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-${adsenseId}`;
    
    // Append to document head
    document.head.appendChild(script);
    
    return true;
  }
  
  return false;
}

// Add to window global type
declare global {
  interface Window {
    adsbygoogle: any[];
  }
}