import { useTranslation } from 'react-i18next';
import { getDateFnsLocale, getDayjsLocale, getIntlLocale } from '../utils/dateLocales';

export function useDateLocales() {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage || i18n.language;

  return {
    language,
    dateFns: getDateFnsLocale(language),
    dayjs: getDayjsLocale(language),
    intl: getIntlLocale(language),
  };
}
