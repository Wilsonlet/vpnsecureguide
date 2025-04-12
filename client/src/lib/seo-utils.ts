/**
 * SEO Utility Functions
 * 
 * This file contains utility functions for SEO optimization
 */

/**
 * Generate a slug from a text string
 * 
 * @param text The text to convert to a slug
 * @returns A URL-friendly slug
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

/**
 * Format a date for SEO purposes (ISO format)
 * 
 * @param date The date to format
 * @returns ISO formatted date string
 */
export function formatSeoDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Generate structured data for JSON-LD
 * 
 * @param type The schema.org type
 * @param data The structured data
 * @returns JSON-LD formatted string
 */
export function generateStructuredData(type: string, data: Record<string, any>): string {
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': type,
    ...data
  };
  
  return JSON.stringify(structuredData);
}

/**
 * Create canonical URL
 * 
 * @param path The path relative to domain
 * @returns Full canonical URL
 */
export function getCanonicalUrl(path: string): string {
  // Use a production domain if available, fallback to development
  const baseDomain = 'https://securevpn.replit.app';
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${baseDomain}${cleanPath}`;
}

/**
 * Generate meta description with appropriate length
 * 
 * @param text The full description text
 * @param maxLength Maximum character length (default: 155)
 * @returns Truncated description with ellipsis if needed
 */
export function truncateDescription(text: string, maxLength: number = 155): string {
  if (text.length <= maxLength) return text;
  
  // Find the last space before the maxLength
  const lastSpace = text.substring(0, maxLength).lastIndexOf(' ');
  
  // If no space found, just cut at maxLength
  const truncatePoint = lastSpace > 0 ? lastSpace : maxLength;
  
  return `${text.substring(0, truncatePoint)}...`;
}

/**
 * Generate page title with brand
 * 
 * @param pageTitle The page-specific title
 * @param includeDefault Whether to include the brand name
 * @returns Formatted page title
 */
export function formatPageTitle(pageTitle: string, includeDefault: boolean = true): string {
  const brand = 'SecureVPN';
  
  if (!includeDefault) return pageTitle;
  
  return pageTitle.includes(brand) ? pageTitle : `${pageTitle} - ${brand}`;
}