import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ProfileVerticalNavigation, {
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

describe('ProfileVerticalNavigation messages link', () => {
  it('links to the inbox at the bottom of the own-profile sidebar', () => {
    render(
      <MemoryRouter>
        <ProfileVerticalNavigation isOwnProfile />
      </MemoryRouter>,
    );

    const messages = screen.getByRole('link', { name: 'Mensajes' });
    expect(messages).toHaveAttribute('href', '/messages');

    const links = screen.getAllByRole('link');
    expect(links[links.length - 1]).toBe(messages);
  });

  it('hides the inbox link when viewing another profile', () => {
    render(
      <MemoryRouter>
        <ProfileVerticalNavigation isOwnProfile={false} userId={4} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole('link', { name: 'Mensajes' })).not.toBeInTheDocument();
  });
});
