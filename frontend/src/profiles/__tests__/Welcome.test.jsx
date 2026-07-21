import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import Welcome from '../Welcome';
import { AuthContext } from '../../context/AuthContext';
import { checkAuth } from '../../api/profilesApi.js';

vi.mock('../../api/profilesApi.js', () => ({
  checkAuth: vi.fn(),
}));

vi.mock('../../context/localStorageUtils.js', () => ({
  setUserInLocalStorage: vi.fn(),
  setAuthenticationStatus: vi.fn(),
  clearUserFromLocalStorage: vi.fn(),
  clearAuthenticationStatus: vi.fn(),
}));

const renderWelcome = (authContextValue, initialEntry = '/welcome') =>
  render(
    <AuthContext.Provider value={authContextValue}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/welcome" element={<Welcome />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

describe('Welcome', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows success flow when backend auth is valid', async () => {
    checkAuth.mockResolvedValue({
      isAuthenticated: true,
      user: { username: 'alejandro', id: 7, is_staff: false },
    });
    const setAuthState = vi.fn();

    renderWelcome(
      {
        authState: { isAuthenticated: false, user: null },
        setAuthState,
      },
      {
        pathname: '/welcome',
        state: { user: { username: 'alejandro', id: 7 } },
      },
    );

    expect(await screen.findByText(/¡Bienvenido, alejandro!/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Tu cuenta está activa y ya has iniciado sesión/i),
    ).toBeInTheDocument();
    expect(setAuthState).toHaveBeenCalled();
  });

  it('shows fallback action when auth verification fails', async () => {
    checkAuth.mockResolvedValue({ isAuthenticated: false, user: null });

    renderWelcome({
      authState: { isAuthenticated: false, user: null },
      setAuthState: vi.fn(),
    });

    expect(
      await screen.findByText(/La verificación de sesión falló/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Ir a iniciar sesión/i })).toHaveAttribute(
      'href',
      '/profiles/login',
    );
  });
});
