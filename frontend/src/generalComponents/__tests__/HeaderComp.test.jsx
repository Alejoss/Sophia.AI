import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import HeaderComp from '../HeaderComp';
import { renderWithProviders, unauthenticatedAuth } from '../../test/formTestUtils';

vi.mock('../../context/ThemeContext.jsx', () => ({
  useThemeMode: () => ({ mode: 'light', toggleMode: vi.fn() }),
}));

vi.mock('../../context/NotificationsContext.jsx', () => ({
  useNotifications: () => ({ unreadCount: 0 }),
}));

describe('HeaderComp account menu', () => {
  it('places Mensajes directly under Mi biblioteca', async () => {
    const user = userEvent.setup();
    renderWithProviders(<HeaderComp />);

    await user.click(screen.getByRole('button', { name: /testuser/i }));

    const items = screen.getAllByRole('menuitem').map((item) => item.textContent);
    const libraryIndex = items.indexOf('Mi Biblioteca');
    expect(libraryIndex).toBeGreaterThanOrEqual(0);
    expect(items[libraryIndex + 1]).toBe('Mensajes');
    expect(screen.getByRole('menuitem', { name: 'Mensajes' })).toHaveAttribute('href', '/messages');
  });

  it('lists Mensajes under Mi biblioteca in the mobile menu', async () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));

    const user = userEvent.setup();
    renderWithProviders(<HeaderComp />);

    await user.click(screen.getByRole('button', { name: 'Abrir menú' }));

    const links = screen.getAllByRole('link').map((link) => ({
      text: link.textContent,
      href: link.getAttribute('href'),
    }));
    const libraryIndex = links.findIndex((link) => link.text === 'Mi Biblioteca');
    expect(libraryIndex).toBeGreaterThanOrEqual(0);
    expect(links[libraryIndex + 1]).toEqual({ text: 'Mensajes', href: '/messages' });
  });

  it('omits the inbox link for a signed-out visitor', () => {
    renderWithProviders(<HeaderComp />, { auth: unauthenticatedAuth() });

    expect(screen.queryByRole('link', { name: 'Mensajes' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /testuser/i })).not.toBeInTheDocument();
  });
});
