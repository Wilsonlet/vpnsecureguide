/**
 * NetworkErrorHandler Component
 * 
 * This component adds global event listeners to catch and suppress network-related errors,
 * particularly those that occur during VPN service operations.
 * 
 * It helps prevent unhandled promise rejections from appearing in the console
 * when network operations fail due to intermittent connectivity issues.
 */

import { useEffect } from 'react';

export const NetworkErrorHandler = () => {
  useEffect(() => {
    // Function to suppress unhandled promise rejections related to network errors
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Check if this is a network error or API call error we want to suppress
      const errorMessage = event.reason?.message || '';
      const isNetworkError = 
        errorMessage.includes('NetworkError') || 
        errorMessage.includes('network error') ||
        errorMessage.includes('Failed to fetch') || 
        errorMessage.includes('fetch failed') ||
        errorMessage.includes('/api/');
      
      if (isNetworkError) {
        // Log for debugging but prevent the error from propagating to console as an unhandled rejection
        console.warn('Suppressed unhandled rejection for network error:', event.reason);
        
        // Prevent the error from appearing in the console as an unhandled rejection
        event.preventDefault();
        event.stopPropagation();
      }
    };
    
    // Function to handle general errors (fallback for older browsers)
    const handleError = (event: ErrorEvent) => {
      const errorMessage = event.error?.message || event.message || '';
      
      if (errorMessage.includes('NetworkError') || 
          errorMessage.includes('Failed to fetch') ||
          errorMessage.includes('/api/')) {
        console.warn('Suppressed error event:', errorMessage);
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
      
      return false;
    };
    
    // Add event listeners
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);
    
    // Clean up listeners when component unmounts
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);
  
  // This component doesn't render anything
  return null;
};

export default NetworkErrorHandler;