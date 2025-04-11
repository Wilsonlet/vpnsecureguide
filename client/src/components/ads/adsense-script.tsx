/**
 * Loads the Google AdSense script
 * 
 * This should be called once in your app's initialization
 * It adds the AdSense script to the document head
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