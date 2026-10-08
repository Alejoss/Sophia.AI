import { describe, it, expect } from 'vitest';
import {
  getProfileMenuItems,
  SHOW_FAVORITE_CRYPTOS_SECTION,
} from '../ProfileVerticalNavigation';

describe('getProfileMenuItems', () => {
  it('hides favorite cryptos while the section is disabled', () => {
    expect(SHOW_FAVORITE_CRYPTOS_SECTION).toBe(false);

    const ownProfileItems = getProfileMenuItems(true);
    const otherProfileItems = getProfileMenuItems(false);

    expect(ownProfileItems.some((item) => item.section === 'cryptos')).toBe(false);
    expect(otherProfileItems.some((item) => item.section === 'cryptos')).toBe(false);
    expect(ownProfileItems.some((item) => item.section === 'tokens')).toBe(true);
  });
});
