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

export const TOPIC_TABS = {
  CONTENT: 'content',
  TIMELINE: 'timeline',
  COMMENTS: 'comments',
};

const VALID_TOPIC_TABS = new Set(Object.values(TOPIC_TABS));

export const normalizeTopicTab = (tab) => {
  if (tab && VALID_TOPIC_TABS.has(tab)) return tab;
  return TOPIC_TABS.CONTENT;
};

export const getTopicDetailPath = (topicId, tab = TOPIC_TABS.CONTENT) => {
  const normalized = normalizeTopicTab(tab);
  if (normalized === TOPIC_TABS.CONTENT) return `/content/topics/${topicId}`;
  return `/content/topics/${topicId}?tab=${normalized}`;
};

export const getTopicContentPath = (contentId, topicId, tab = TOPIC_TABS.CONTENT) => {
  const base = `/content/${contentId}/topic/${topicId}`;
  const normalized = normalizeTopicTab(tab);
  if (normalized === TOPIC_TABS.CONTENT) return base;
  return `${base}?tab=${normalized}`;
};