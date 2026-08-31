/** Guest vs authenticated home heroes. Keep preload URLs in index.html in sync. */

export const HOME_HERO_SIZES = '100vw';

export const HOME_HERO_ASSETS = {
  guest: {
    width: 1120,
    height: 1120,
    jpg: '/images/home_hero-1120.jpg',
    webpSrcSet:
      '/images/home_hero-640.webp 640w, /images/home_hero-960.webp 960w, /images/home_hero-1120.webp 1120w',
  },
  authenticated: {
    width: 1120,
    height: 1120,
    jpg: '/images/sobre_nosotros_hero-1120.jpg',
    webpSrcSet:
      '/images/sobre_nosotros_hero-640.webp 640w, /images/sobre_nosotros_hero-960.webp 960w, /images/sobre_nosotros_hero-1120.webp 1120w',
  },
};
