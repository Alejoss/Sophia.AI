/**
 * Utility functions for handling file URLs
 */

import { MEDIA_BASE_URL } from '../api/config';

/**
 * Constructs a proper URL for a file
 * @param {string} filePath - The file path from the backend
 * @returns {string} - The complete URL to access the file
 */
export const getFileUrl = (filePath) => {
  if (!filePath) return null;
  
  // If the path already starts with http, return it as is
  if (filePath.startsWith('http')) {
    return filePath;
  }
  
  // Otherwise, prepend the backend URL from config
  return `${MEDIA_BASE_URL}${filePath}`;
};

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