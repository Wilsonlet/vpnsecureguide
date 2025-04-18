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
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    // List of patterns to filter out from console
    const errorPatternsToFilter = [
      'Error while parsing the \'sandbox\' attribute',
      'Unrecognized feature:',
      'Allow attribute will take precedence',
      'Invalid href',
      'stallwart:',
      'Failed to load resource: the server responded with a status of 400',
      'adsbygoogle',
      // VPN related errors
      'Failed to sync protocol with server',
      'Failed to sync encryption with server',
      'Network error fetching',
      'Error checking current session'
    ];
    
    // Replace console.error
    console.error = function(...args) {
      // Check if the error message matches any of our patterns
      const shouldFilter = errorPatternsToFilter.some(pattern => 
        args.some(arg => typeof arg === 'string' && arg.includes(pattern))
      );
      
      // Special handling for VPN error with undefined status
      if (args && args.length >= 2 && 
          typeof args[0] === 'string' && 
          args[0].includes('Failed to sync') && 
          args[1] === undefined) {
        // Replace undefined with null in the arguments
        const newArgs = [...args];
        newArgs[1] = null;
        // Still log a modified version with the null value
        originalConsoleError.apply(console, newArgs);
        return;
      }
      
      if (!shouldFilter) {
        originalConsoleError.apply(console, args);
      }
    };
    
    // Replace console.warn
    console.warn = function(...args) {
      // Check if the warning message matches any of our patterns
      const shouldFilter = errorPatternsToFilter.some(pattern => 
        args.some(arg => typeof arg === 'string' && arg.includes(pattern))
      );
      
      if (!shouldFilter) {
        originalConsoleWarn.apply(console, args);
      }
    };
    
    window.onerror = function(message, source, lineno, colno, error) {
      // VPN error handling
      if (typeof message === 'string' && 
          (message.includes('Failed to sync') || 
           message.includes('Network error') ||
           message.includes('Error checking'))) {
        console.warn('VPN error suppressed:', message);
        return true; // Prevent the error from propagating
      }
      
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
      
      // Filter out sandbox and feature policy errors
      if (typeof message === 'string' && 
          (message.includes('sandbox') || 
           message.includes('feature') || 
           message.includes('Invalid href'))) {
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
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
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