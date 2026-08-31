import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import HomeHeroBackground from '../HomeHeroBackground';
import { HOME_HERO_ASSETS } from '../../images/homeHeroAssets';

describe('HomeHeroBackground', () => {
  it('renders a WebP picture with reserved dimensions for the guest hero', () => {
    const { container } = render(<HomeHeroBackground variant="guest" />);
    const source = container.querySelector('source');
    const img = container.querySelector('img');

    expect(source).toHaveAttribute('type', 'image/webp');
    expect(source).toHaveAttribute('srcset', HOME_HERO_ASSETS.guest.webpSrcSet);
    expect(img).toHaveAttribute('src', HOME_HERO_ASSETS.guest.jpg);
    expect(img).toHaveAttribute('width', '1120');
    expect(img).toHaveAttribute('height', '1120');
    expect(img).toHaveAttribute('fetchpriority', 'high');
    expect(img).toHaveAttribute('decoding', 'sync');
  });

  it('uses the authenticated hero assets', () => {
    const { container } = render(
      <HomeHeroBackground variant="authenticated" objectPosition="top center" />,
    );
    const img = container.querySelector('img');

    expect(container.querySelector('source')).toHaveAttribute(
      'srcset',
      HOME_HERO_ASSETS.authenticated.webpSrcSet,
    );
    expect(img).toHaveAttribute('src', HOME_HERO_ASSETS.authenticated.jpg);
    expect(img).toHaveStyle({ objectPosition: 'top center' });
  });
});
