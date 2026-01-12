import { describe, it, expect } from 'vitest';
import { getBadgeIconPath, getBadgeIconMap } from '../badgeIconMap';

describe('badgeIconMap', () => {
  describe('getBadgeIconPath', () => {
    it('returns correct icon path for known badge codes', () => {
      expect(getBadgeIconPath('first_comment')).toBe('/images/badge_sky_blue.png');
      expect(getBadgeIconPath('knowledge_seeker')).toBe('/images/badge_red_strong.png');
      expect(getBadgeIconPath('quiz_master')).toBe('/images/badge_blue.png');
    });

    it('returns default icon for unknown badge codes', () => {
      expect(getBadgeIconPath('unknown_badge')).toBe('/images/badge_sky_blue.png');
    });

    it('returns default icon for null/undefined badge codes', () => {
      expect(getBadgeIconPath(null)).toBe('/images/badge_sky_blue.png');
      expect(getBadgeIconPath(undefined)).toBe('/images/badge_sky_blue.png');
      expect(getBadgeIconPath('')).toBe('/images/badge_sky_blue.png');
    });

    it('returns correct icon for all CONTRIBUTION badges', () => {
      expect(getBadgeIconPath('first_comment')).toBe('/images/badge_sky_blue.png');
      expect(getBadgeIconPath('first_knowledge_path_created')).toBe('/images/badge_purple.png');
      expect(getBadgeIconPath('content_creator')).toBe('/images/badge_red.png');
      expect(getBadgeIconPath('topic_curator')).toBe('/images/badge_green.png');
    });

    it('returns correct icon for all LEARNING badges', () => {
      expect(getBadgeIconPath('first_knowledge_path_completed')).toBe('/images/badge_yellow.png');
      expect(getBadgeIconPath('quiz_master')).toBe('/images/badge_blue.png');
      expect(getBadgeIconPath('knowledge_seeker')).toBe('/images/badge_red_strong.png');
    });

    it('returns correct icon for all RECOGNITION badges', () => {
      expect(getBadgeIconPath('first_highly_rated_comment')).toBe('/images/badge_blue_shine.png');
      expect(getBadgeIconPath('first_highly_rated_content')).toBe('/images/badge_grey.png');
      expect(getBadgeIconPath('community_voice')).toBe('/images/badge_purple_shine.png');
      expect(getBadgeIconPath('topic_architect')).toBe('/images/badge_orange.png');
    });
  });

  describe('getBadgeIconMap', () => {
    it('returns a copy of the badge icon map', () => {
      const map1 = getBadgeIconMap();
      const map2 = getBadgeIconMap();
      
      expect(map1).toEqual(map2);
      expect(map1).not.toBe(map2); // Should be different objects
    });

    it('contains all expected badge codes', () => {
      const map = getBadgeIconMap();
      
      expect(map).toHaveProperty('first_comment');
      expect(map).toHaveProperty('knowledge_seeker');
      expect(map).toHaveProperty('quiz_master');
      expect(map).toHaveProperty('topic_curator');
      expect(map).toHaveProperty('topic_architect');
    });
  });
});
