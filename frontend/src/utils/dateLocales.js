import { enUS, es } from 'date-fns/locale';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import 'dayjs/locale/es';
import { normalizeLanguage } from '../i18n';

export function getDateFnsLocale(language) {
  return normalizeLanguage(language) === 'en' ? enUS : es;
}

/** Dayjs locale name (`en` or `es`) for MUI date pickers. */
export function getDayjsLocale(language) {
  return normalizeLanguage(language) === 'en' ? 'en' : 'es';
}

export function getIntlLocale(language) {
  return normalizeLanguage(language) === 'en' ? 'en-US' : 'es-ES';
}

export function applyDayjsLocale(language) {
  dayjs.locale(getDayjsLocale(language));
}
