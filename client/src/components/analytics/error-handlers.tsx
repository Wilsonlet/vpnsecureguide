import { useEffect } from 'react';

/**
 * ThirdPartyErrorHandler component
 * 
 * This component prevents third-party script errors from causing issues with the app
 * It intercepts errors from common third-party scripts and prevents them from breaking the app
 */
export function ThirdPartyErrorHandler() {
  useEffect(() => {
    // Create a global error handler for third-party script errors
    const originalOnError = window.onerror;
    
    window.onerror = function(message, source, lineno, colno, error) {
      // TikTok Pixel error handling
      if (typeof message === 'string' && message.includes('TikTok Pixel')) {
        console.warn('TikTok Pixel error suppressed:', message);
        return true; // Prevent the error from propagating
      }
      
      // Stripe error handling
      if (source?.includes('stripe') || (typeof message === 'string' && message.includes('stripe'))) {
        console.warn('Stripe error suppressed:', message);
        return true;
      }
      
      // Other third-party script errors
      if (source && !source.includes(window.location.origin)) {
        const isCommonThirdParty = [
          'google', 'facebook', 'meta', 'analytics', 'tracking', 
          'ads', 'pixel', 'gtm', 'tag-manager', 'cdn'
        ].some(keyword => source.toLowerCase().includes(keyword));
        
        if (isCommonThirdParty) {
          console.warn('Third-party script error suppressed:', { message, source });
          return true;
        }
      }
      
      // Call the original error handler for other errors
      if (originalOnError) {
        return originalOnError(message, source, lineno, colno, error);
      }
      
      return false; // Let default handling occur for other errors
    };
    
    // Clean up
    return () => {
      window.onerror = originalOnError;
    };
  }, []);
  
  return null; // This component doesn't render anything
}

/**
 * Corrects invalid URLs in the application
 * Prevents errors due to repeated forward slashes
 */
export function UrlErrorHandler() {
  useEffect(() => {
    // Patch any URL normalization issues
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    
    // Function to normalize URLs
    const normalizeUrl = (url: string | URL | null | undefined): string => {
      if (!url) return '';
      
      // Convert URL object to string if needed
      const urlStr = url.toString();
      
      // Replace repeated slashes with a single slash, preserving protocol slashes
      return urlStr.replace(/(https?:\/\/)|(\/\/+)/g, (match) => {
        return match === '//' || match.includes('://') ? match : '/';
      });
    };
    
    // Override pushState to normalize URLs
    history.pushState = function(...args) {
      if (typeof args[2] === 'string') {
        args[2] = normalizeUrl(args[2]);
      }
      return originalPushState.apply(this, args);
    };
    
    // Override replaceState to normalize URLs
    history.replaceState = function(...args) {
      if (typeof args[2] === 'string') {
        args[2] = normalizeUrl(args[2]);
      }
      return originalReplaceState.apply(this, args);
    };
    
    // Clean up
    return () => {
      history.pushState = originalPushState;
      history.replaceState = originalReplaceState;
    };
  }, []);
  
  return null;
}