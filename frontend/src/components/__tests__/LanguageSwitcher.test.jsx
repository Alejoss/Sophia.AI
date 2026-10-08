import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { I18nextProvider } from 'react-i18next';
import i18n, { LANGUAGE_STORAGE_KEY, normalizeLanguage } from '../../i18n';
import DocumentLanguage from '../DocumentLanguage';
import LanguageSwitcher from '../LanguageSwitcher';

describe('LanguageSwitcher', () => {
  it('switches between Spanish and English and stores the choice', async () => {
    const user = userEvent.setup();
    await i18n.changeLanguage('es');
    localStorage.removeItem(LANGUAGE_STORAGE_KEY);

    render(
      <I18nextProvider i18n={i18n}>
        <DocumentLanguage />
        <LanguageSwitcher />
      </I18nextProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'English' }));

    expect(i18n.resolvedLanguage).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(screen.getByRole('group', { name: 'Language' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Spanish' }));

    expect(i18n.resolvedLanguage).toBe('es');
    expect(document.documentElement.lang).toBe('es');
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('es');
    expect(screen.getByRole('group', { name: 'Idioma' })).toBeInTheDocument();
  });

  it('starts in Spanish unless a saved choice says English', () => {
    expect(i18n.options.detection.order).toEqual(['localStorage']);
    expect(i18n.options.fallbackLng).toEqual(['es']);
    expect(normalizeLanguage(undefined)).toBe('es');
    expect(normalizeLanguage('en-US')).toBe('en');
    expect(normalizeLanguage('fr')).toBe('es');
  });

  it('falls back to Spanish when an English string is missing', async () => {
    i18n.addResource('es', 'common', 'fallbackProbe', 'solo español');
    await i18n.changeLanguage('en');

    expect(i18n.t('fallbackProbe')).toBe('solo español');
  });
});
