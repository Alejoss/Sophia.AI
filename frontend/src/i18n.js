import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

export const SUPPORTED_LANGUAGES = ['es', 'en'];
export const LANGUAGE_STORAGE_KEY = 'acbc.lang';

/**
 * A saved choice of English stays English. Anything else, including a
 * missing or regional tag, is Spanish.
 */
export function normalizeLanguage(lng) {
  if (!lng) return 'es';
  const base = String(lng).toLowerCase().split('-')[0];
  return base === 'en' ? 'en' : 'es';
}

const localeModules = import.meta.glob('./locales/*/*.json', { eager: true });

function buildResources() {
  const resources = {};
  for (const [path, mod] of Object.entries(localeModules)) {
    const match = path.match(/\/([^/]+)\/([^/]+)\.json$/);
    if (!match) continue;
    const [, lng, ns] = match;
    if (!resources[lng]) resources[lng] = {};
    resources[lng][ns] = mod.default ?? mod;
  }
  return resources;
}

const resources = buildResources();
const namespaces = Object.keys(resources.es || resources.en || { common: {} });
const isTest = import.meta.env.MODE === 'test';

i18n.use(LanguageDetector).use(initReactI18next).init({
  resources,
  lng: isTest ? 'es' : undefined,
  fallbackLng: 'es',
  supportedLngs: SUPPORTED_LANGUAGES,
  nonExplicitSupportedLngs: true,
  load: 'languageOnly',
  ns: namespaces,
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
  returnEmptyString: false,
  // Catalogs are bundled, so init can finish before the first render.
  initImmediate: false,
  react: { useSuspense: false },
  detection: {
    // First visit stays Spanish. A later ES/EN choice is read back from this key.
    order: ['localStorage'],
    lookupLocalStorage: LANGUAGE_STORAGE_KEY,
    caches: ['localStorage'],
    convertDetectedLanguage: normalizeLanguage,
  },
});

export default i18n;
