/**
 * Badge Icon Mapping
 * Maps badge codes to their corresponding PNG icon files
 * 
 * This ensures badges always display the correct icon even if
 * the icon hasn't been uploaded to the database yet.
 */

const BADGE_ICON_MAP = {
  // CONTRIBUTION Badges
  'first_comment': 'badge_sky_blue.png',
  'first_knowledge_path_created': 'badge_purple.png',
  'content_creator': 'badge_red.png',
  'topic_curator': 'badge_green.png',
  
  // LEARNING Badges
  'first_knowledge_path_completed': 'badge_yellow.png',
  'quiz_master': 'badge_blue.png',
  'knowledge_seeker': 'badge_red_strong.png',
  
  // RECOGNITION Badges
  'first_highly_rated_comment': 'badge_blue_shine.png',
  'first_highly_rated_content': 'badge_grey.png',
  'community_voice': 'badge_purple_shine.png',
  'topic_architect': 'badge_orange.png',
};

/**
 * Get the icon path for a badge based on its code
 * 
 * @param {string} badgeCode - The badge code (e.g., 'first_comment')
 * @returns {string} - The path to the icon file (e.g., '/images/badge_sky_blue.png')
 */
export const getBadgeIconPath = (badgeCode) => {
  if (!badgeCode) {
    return '/images/badge_sky_blue.png'; // Default fallback
  }
  
  const iconFileName = BADGE_ICON_MAP[badgeCode];
  
  if (iconFileName) {
    return `/images/${iconFileName}`;
  }
  
  // Fallback to default if badge code not found in map
  return '/images/badge_sky_blue.png';
};

/**
 * Get all badge icon mappings (for debugging or admin purposes)
 * 
 * @returns {Object} - The complete badge icon map
 */
export const getBadgeIconMap = () => {
  return { ...BADGE_ICON_MAP };
};

export default {
  getBadgeIconPath,
  getBadgeIconMap,
};
