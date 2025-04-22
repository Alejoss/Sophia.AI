/**
 * Utility functions for handling file URLs
 */

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
  
  // Otherwise, prepend the backend URL
  // TODO: This should use an environment variable instead of hardcoding
  return `http://localhost:8000${filePath}`;
}; 