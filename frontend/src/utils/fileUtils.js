/**
 * Utility functions for handling file URLs
 * Media files (images, video, audio) are served from S3 or local storage.
 * NEVER construct URLs with content_details – that path is for API only.
 */

import { MEDIA_BASE_URL } from '../api/config';

/**
 * Returns a valid media URL. Absolute URLs (S3, etc.) are returned as-is.
 * Relative paths are prefixed with origin only. Never uses API paths.
 * Rejects URLs that incorrectly contain content_details (API path, not media).
 * Fixes malformed backend URLs: .../https/academiablockchain.s3... -> https://academiablockchain.s3...
 */
export function resolveMediaUrl(value) {
  if (value == null || typeof value !== 'string') return null;
  const s = value.trim();
  if (!s) return null;
  if (s.startsWith('http://') || s.startsWith('https://')) {
    if (s.includes('content_details')) {
      const s3Match = s.match(/\/https\/([^/]+\.s3\.[^/]+\.amazonaws\.com\/.+)$/);
      if (s3Match) return `https://${s3Match[1]}`;
      return null;
    }
    return s;
  }
  if (s.includes('content_details')) return null;
  const base = (MEDIA_BASE_URL || '').replace(/\/$/, '') || 'http://localhost:8000';
  const path = s.startsWith('/') ? s : `/${s}`;
  return `${base}${path}`;
}

/** @deprecated Use resolveMediaUrl */
export const getFileUrl = resolveMediaUrl;

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