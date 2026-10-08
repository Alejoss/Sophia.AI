import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import i18n, { LANGUAGE_STORAGE_KEY } from '../i18n';

beforeEach(async () => {
  await i18n.changeLanguage('es');
  localStorage.removeItem(LANGUAGE_STORAGE_KEY);
  document.documentElement.lang = 'es';
});

afterEach(() => {
  cleanup();
});

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

// jsdom does not implement scrollIntoView; RHF invalid handlers often call it
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = vi.fn();
}
