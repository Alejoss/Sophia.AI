import React from 'react';
import { HOME_HERO_ASSETS, HOME_HERO_SIZES } from '../images/homeHeroAssets';

/**
 * LCP-friendly hero: WebP srcset, reserved dimensions, high fetch priority.
 * decoding=sync so the LCP image is not deprioritized behind the JS bundle.
 */
const HomeHeroBackground = ({
  variant = 'guest',
  alt = '',
  objectPosition = 'center',
}) => {
  const asset = HOME_HERO_ASSETS[variant] || HOME_HERO_ASSETS.guest;

  return (
    <picture className="home-hero-background">
      <source type="image/webp" srcSet={asset.webpSrcSet} sizes={HOME_HERO_SIZES} />
      <img
        src={asset.jpg}
        alt={alt}
        width={asset.width}
        height={asset.height}
        sizes={HOME_HERO_SIZES}
        decoding="sync"
        fetchpriority="high"
        style={{ objectPosition }}
      />
    </picture>
  );
};

export default HomeHeroBackground;
