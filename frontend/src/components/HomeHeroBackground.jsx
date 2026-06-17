import React from 'react';

/**
 * LCP-friendly hero image (replaces CSS background-image for faster paint).
 */
const HomeHeroBackground = ({ src, alt = '', objectPosition = 'center' }) => (
  <img
    src={src}
    alt={alt}
    className="home-hero-background"
    decoding="async"
    fetchPriority="high"
    style={{ objectPosition }}
  />
);

export default HomeHeroBackground;
