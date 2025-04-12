/**
 * SEO Head Component
 * 
 * This component dynamically updates meta tags for each page to optimize for search engines.
 * It should be included on each page with appropriate props.
 */
import { useEffect } from 'react';

interface SeoHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'article';
  twitterCard?: 'summary' | 'summary_large_image';
}

export default function SeoHead({
  title = 'SecureVPN - Military-Grade Encryption & Global Network',
  description = 'SecureVPN offers military-grade encryption, global servers, and unbeatable privacy features. Protect your online activity with our advanced VPN technology.',
  keywords = 'VPN, secure VPN, military-grade encryption, privacy, online security, anonymous browsing, public wifi protection',
  canonicalUrl = 'https://securevpn.replit.app/',
  ogImage = 'https://securevpn.replit.app/og-image.jpg',
  ogType = 'website',
  twitterCard = 'summary_large_image',
}: SeoHeadProps) {
  
  useEffect(() => {
    // Update document title
    document.title = title;
    
    // Update meta tags
    const metaTags = {
      description,
      keywords,
      'og:title': title,
      'og:description': description,
      'og:type': ogType,
      'og:url': canonicalUrl,
      'og:image': ogImage,
      'twitter:card': twitterCard,
      'twitter:title': title,
      'twitter:description': description,
      'twitter:url': canonicalUrl,
      'twitter:image': ogImage,
    };
    
    // Update or create meta tags
    Object.entries(metaTags).forEach(([name, content]) => {
      let meta: HTMLMetaElement | null;
      
      // Handle Open Graph tags differently
      if (name.startsWith('og:')) {
        meta = document.querySelector(`meta[property="${name}"]`);
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('property', name);
          document.head.appendChild(meta);
        }
      } else if (name.startsWith('twitter:')) {
        meta = document.querySelector(`meta[name="${name}"]`);
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', name);
          document.head.appendChild(meta);
        }
      } else {
        meta = document.querySelector(`meta[name="${name}"]`);
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', name);
          document.head.appendChild(meta);
        }
      }
      
      // Set content attribute
      meta.setAttribute('content', content);
    });
    
    // Update canonical link
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);
    
    // Clean up function
    return () => {
      // We don't remove SEO tags on cleanup as this could cause flickering
      // and negatively impact SEO. The next page will update them.
    };
  }, [
    title,
    description, 
    keywords, 
    canonicalUrl, 
    ogImage, 
    ogType, 
    twitterCard
  ]);
  
  // This component doesn't render anything visible
  return null;
}