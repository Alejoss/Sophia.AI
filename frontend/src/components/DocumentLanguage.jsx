import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { normalizeLanguage } from '../i18n';
import { applyDayjsLocale } from '../utils/dateLocales';

/** Keeps <html lang> and the dayjs locale aligned with the active language. */
const DocumentLanguage = () => {
  const { i18n } = useTranslation();

  useEffect(() => {
    const language = normalizeLanguage(i18n.resolvedLanguage || i18n.language);
    document.documentElement.lang = language;
    applyDayjsLocale(language);
  }, [i18n, i18n.language, i18n.resolvedLanguage]);

  return null;
};

export default DocumentLanguage;
