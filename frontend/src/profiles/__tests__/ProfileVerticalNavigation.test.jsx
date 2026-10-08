import { describe, it, expect } from 'vitest';
import {
  getProfileMenuItems,
  getProfileMenuConfig,
  SHOW_FAVORITE_CRYPTOS_SECTION,
} from '../ProfileVerticalNavigation';
import { mergeMenuConfigs } from '../../utils/menuUtils';

describe('getProfileMenuItems', () => {
  it('hides favorite cryptos while the section is disabled', () => {
    expect(SHOW_FAVORITE_CRYPTOS_SECTION).toBe(false);

    const ownProfileItems = getProfileMenuItems(true);
    const otherProfileItems = getProfileMenuItems(false);

    expect(ownProfileItems.some((item) => item.section === 'cryptos')).toBe(false);
    expect(otherProfileItems.some((item) => item.section === 'cryptos')).toBe(false);
    expect(ownProfileItems.some((item) => item.section === 'tokens')).toBe(true);
  });

  it('also hides favorite cryptos from the mobile header menu config', () => {
    const mobileMenuItems = mergeMenuConfigs([getProfileMenuConfig(true)]);

    expect(mobileMenuItems.some((item) => item.section === 'cryptos')).toBe(false);
    expect(
      mobileMenuItems.some((item) =>
        String(item.label || '').toLowerCase().includes('criptomonedas'),
      ),
    ).toBe(false);
    expect(mobileMenuItems.some((item) => item.section === 'tokens')).toBe(true);
  });
});
