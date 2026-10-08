import { ToggleButton, ToggleButtonGroup } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '../i18n';

const LABELS = { es: 'ES', en: 'EN' };

const LanguageSwitcher = ({ sx }) => {
  const { i18n, t } = useTranslation('common');
  const value = (i18n.resolvedLanguage || i18n.language || 'es').startsWith('en') ? 'en' : 'es';

  const handleChange = (_event, next) => {
    if (next) {
      i18n.changeLanguage(next);
    }
  };

  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={handleChange}
      aria-label={t('language.switch')}
      sx={sx}
    >
      {SUPPORTED_LANGUAGES.map((lng) => (
        <ToggleButton key={lng} value={lng} aria-label={t(`language.${lng}`)}>
          {LABELS[lng]}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
};

export default LanguageSwitcher;
