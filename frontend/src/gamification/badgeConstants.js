/**
 * Badge Constants
 * Centralized constants for badge colors, sizes, and configuration
 */

export const BADGE_CATEGORY_COLORS = {
  LEARNING: '#4CAF50',
  CONTRIBUTION: '#2196F3',
  RECOGNITION: '#FF9800',
  FOUNDER: '#9C27B0',
  DEFAULT: '#757575',
};

export const BADGE_SIZES = {
  extraTiny: {
    icon: 18,
    fontSize: '0.5rem',
  },
  tiny: {
    icon: 32,
    fontSize: '0.55rem',
  },
  small: {
    icon: 48,
    fontSize: '0.65rem',
  },
  medium: {
    icon: 64,
    fontSize: '0.75rem',
  },
  large: {
    icon: 80,
    fontSize: '0.85rem',
  },
};

export const BADGE_CONTEXT_SIZES = {
  comment: 'extraTiny',
  header: 'tiny',
  profile: 'tiny',
  badgeList: 'small',
  notification: 'small',
  default: 'medium',
};

export const BADGE_THRESHOLDS = {
  COMMENT_HIGHLY_RATED: 5,
  CONTENT_HIGHLY_RATED: 10,
  QUIZ_MASTER_COUNT: 5,
  KNOWLEDGE_SEEKER_NODES: 20,
  COMMUNITY_VOICE_VOTES: 20,
  CONTENT_CREATOR_COUNT: 3,
  CONTENT_CREATOR_MIN_VOTES: 5,
};

export const BADGE_POINTS = {
  FIRST_EXPLORER: 50,
  FIRST_VOICE: 10,
  VALUED_CONTRIBUTOR: 30,
  CONTENT_CURATOR: 40,
  PATH_CREATOR: 60,
  QUIZ_MASTER: 25,
  KNOWLEDGE_SEEKER: 35,
  COMMUNITY_VOICE: 45,
  CREATOR: 50,
  FOUNDING_MEMBER: 100,
};