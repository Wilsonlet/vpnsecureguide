import { useEffect } from 'react';

/**
 * AdFallbackHandler - Component to provide graceful fallbacks for ad loading failures
 * 
 * This component helps in two ways:
 * 1. Intercepts ad loading failures and prevents console errors
 * 2. Provides fallback content for ad placeholders when ads fail to load
 * 
 * This helps maintain a clean UI and console when ads can't load due to:
 * - Ad blockers
 * - Network issues
 * - Invalid ad configurations
 * - Slow loading times
 */
export function AdFallbackHandler() {
  useEffect(() => {
    // Track ad loading success/failure
    const adLoadingStatus = new Map<string, boolean>();
    
    // Function to handle fallbacks for ad failures
    const handleAdFailure = (adContainerId: string) => {
      const adContainer = document.getElementById(adContainerId);
      if (!adContainer) return;
      
      // If the ad container is empty or has error class, apply fallback
      if (adContainer.children.length === 0 || 
          adContainer.classList.contains('ad-load-error')) {
        
        // First mark this container as failed if not already tracked
        if (!adLoadingStatus.has(adContainerId)) {
          adLoadingStatus.set(adContainerId, false);
          
          // Add error class to container
          adContainer.classList.add('ad-load-error');
          
          // Determine ad size based on container size or data attribute
          const containerWidth = adContainer.clientWidth;
          const containerHeight = adContainer.clientHeight;
          
          // Clear any existing content
          adContainer.innerHTML = '';
          
          // Create a clean fallback element
          const fallback = document.createElement('div');
          fallback.className = 'ad-fallback';
          fallback.style.width = '100%';
          fallback.style.height = '100%';
          fallback.style.display = 'flex';
          fallback.style.alignItems = 'center';
          fallback.style.justifyContent = 'center';
          fallback.style.background = '#f8f9fa';
          fallback.style.color = '#718096';
          fallback.style.fontSize = '0.875rem';
          fallback.style.borderRadius = '4px';
          fallback.style.padding = '0.5rem';
          
          // Don't display any message for ad placeholder - keep it clean
          // This makes it appear as just empty space rather than drawing attention to ad failure
          
          // Add the fallback to the container
          adContainer.appendChild(fallback);
        }
      } else {
        // Ad loaded successfully
        adLoadingStatus.set(adContainerId, true);
      }
    };
    
    // Function to check all ad containers on the page
    const checkAllAdContainers = () => {
      // Common ad container selectors
      const adSelectors = [
        '.ad-container', 
        '.ad-placeholder',
        '.ad-slot',
        '#ad-top', 
        '#ad-sidebar',
        '[data-ad-slot]',
        '[data-ad-client]',
        '.adsbygoogle'
      ];
      
      // Find all ad containers
      const adContainers = document.querySelectorAll(adSelectors.join(','));
      
      // Check each container
      adContainers.forEach((container) => {
        const id = container.id || `ad-container-${Math.random().toString(36).substring(2, 9)}`;
        if (!container.id) {
          container.id = id;
        }
        
        // Handle any failures
        handleAdFailure(id);
      });
    };
    
    // Check ad containers after page load and periodically
    window.addEventListener('load', () => {
      // Initial check after load
      setTimeout(checkAllAdContainers, 1000);
      
      // Follow-up checks for late-loading ads
      setTimeout(checkAllAdContainers, 3000);
      setTimeout(checkAllAdContainers, 5000);
    });
    
    // Create MutationObserver to detect dynamically added ad containers
    const observer = new MutationObserver((mutations) => {
      let adElementAdded = false;
      
      // Check if any mutations added ad elements
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((node) => {
            if (node instanceof HTMLElement) {
              if (
                node.classList.contains('ad-container') ||
                node.classList.contains('adsbygoogle') ||
                node.hasAttribute('data-ad-slot') ||
                node.id?.includes('ad-')
              ) {
                adElementAdded = true;
              }
              
              // Also check children of added node
              const adElements = node.querySelectorAll('.ad-container, .adsbygoogle, [data-ad-slot]');
              if (adElements.length > 0) {
                adElementAdded = true;
              }
            }
          });
        }
      });
      
      // If ad elements were added, check them after a short delay
      if (adElementAdded) {
        setTimeout(checkAllAdContainers, 500);
      }
    });
    
    // Begin observing the document body
    observer.observe(document.body, { childList: true, subtree: true });
    
    // Handle failed ad loading errors specifically
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : '';
      
      if (url.includes('ads') || url.includes('adservice') || url.includes('pagead')) {
        // Return a silent promise for ad-related fetches that might fail
        return originalFetch.apply(this, [input, init])
          .catch(error => {
            // Silently catch ad loading errors
            console.log('Ad resource failed to load:', url);
            return new Response(JSON.stringify({ success: false }), {
              status: 200,
              headers: { 'Content-Type': 'application/json' }
            });
          });
      }
      
      // Normal fetch for everything else
      return originalFetch.apply(this, [input, init]);
    };
    
    // Clean up
    return () => {
      observer.disconnect();
      window.fetch = originalFetch;
    };
  }, []);
  
  // This component doesn't render anything visible
  return null;
}

export default AdFallbackHandler;