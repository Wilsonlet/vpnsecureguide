import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats bytes into a human-readable string with appropriate units
 * @param bytes The number of bytes to format
 * @param decimals The number of decimal places to include
 * @returns A human-readable string representation of the byte size
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

/**
 * Formats a duration in milliseconds to a human-readable hh:mm:ss format
 * @param durationMs The duration in milliseconds
 * @returns A formatted string in hh:mm:ss format
 */
export function formatDuration(durationMs: number): string {
  if (durationMs <= 0) return '00:00:00';
  
  // Convert to seconds
  let seconds = Math.floor(durationMs / 1000);
  
  // Calculate hours, minutes, and remaining seconds
  const hours = Math.floor(seconds / 3600);
  seconds %= 3600;
  const minutes = Math.floor(seconds / 60);
  seconds %= 60;
  
  // Format with leading zeros
  const hoursStr = String(hours).padStart(2, '0');
  const minutesStr = String(minutes).padStart(2, '0');
  const secondsStr = String(seconds).padStart(2, '0');
  
  return `${hoursStr}:${minutesStr}:${secondsStr}`;
}
