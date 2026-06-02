/**
 * Media URL helper. Backend returns absolute URLs (S3 or origin).
 * Use as-is for absolute; prefix base for relative paths.
 */

import { MEDIA_BASE_URL } from '../api/config';

export function resolveMediaUrl(value) {
  if (value == null || typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  const base = (MEDIA_BASE_URL || '').replace(/\/$/, '') || 'http://localhost:8000';
  return `${base}${s.startsWith('/') ? s : '/' + s}`;
}

/** @deprecated Use resolveMediaUrl */
export const getFileUrl = resolveMediaUrl;

/**
 * URL to open content in a new browser tab: external page URL when present,
 * otherwise the stored file URL (uploaded PDF, video file, etc.).
 */
export function getContentOpenInNewTabUrl(content) {
  if (!content) return null;
  const external = content.url && String(content.url).trim();
  if (external) return resolveMediaUrl(external);
  const fileDetails = content.file_details;
  if (fileDetails?.file || content.has_file_available) {
    return resolveMediaUrl(fileDetails?.url ?? fileDetails?.file);
  }
  return null;
}

/**
 * Formats file size in bytes to human readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} - Formatted file size (e.g., "1.5 MB", "2.3 GB")
 */
export const formatFileSize = (bytes) => {
  if (!bytes || isNaN(bytes)) return 'Unknown size';
  
  const size = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
  
  if (size < 1024) {
    return `${size} bytes`;
  } else if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  } else if (size < 1024 * 1024 * 1024) {
    return `${(size / (1024 * 1024)).toFixed(2)} MB`;
  } else {
    return `${(size / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
}; 