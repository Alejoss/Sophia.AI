/**
 * URL utility functions for content details and navigation
 */

/**
 * Constants for content context types
 */
export const CONTEXT_TYPES = {
  LIBRARY: 'library',
  TOPIC: 'topic',
  PUBLICATION: 'publication',
  KNOWLEDGE_PATH: 'knowledge_path'
};

/**
 * Creates a properly formatted URL for content details with context parameters
 * 
 * @param {string} contentId - The ID of the content
 * @param {string} context - The context type (library, topic, publication, knowledge_path)
 * @param {string|number} contextId - The ID associated with the context
 * @returns {string} The formatted URL
 */
export const createContentDetailUrl = (contentId, context, contextId) => {
  if (!contentId) return '';
  
  let url = `/content/${contentId}/library`;
  
  // Only add query parameters if both context and contextId exist
  if (context && contextId) {
    url += `?context=${context}&id=${contextId}`;
  }
  
  return url;
}; 