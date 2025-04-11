import { useEffect } from 'react';

/**
 * This component handles 3rd party script errors in the console 
 * by intercepting known error messages and providing custom error handlers
 */
export function ScriptErrorHandler() {
  useEffect(() => {
    // Create a custom error handler
    const originalConsoleError = console.error;
    const originalConsoleWarn = console.warn;
    
    // List of patterns to filter out from console
    const errorPatternsToFilter = [
      'Error while parsing the \'sandbox\' attribute',
      'Unrecognized feature:',
      'Allow attribute will take precedence',
      'Invalid href',
      'stallwart:',
      'Failed to load resource: the server responded with a status of 400'
    ];
    
    // Replace console.error
    console.error = function(...args) {
      // Check if the error message matches any of our patterns
      const shouldFilter = errorPatternsToFilter.some(pattern => 
        args.some(arg => typeof arg === 'string' && arg.includes(pattern))
      );
      
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
    
    // Clean up by restoring original console methods
    return () => {
      console.error = originalConsoleError;
      console.warn = originalConsoleWarn;
    };
  }, []);
  
  return null; // This component doesn't render anything
}

export default ScriptErrorHandler;