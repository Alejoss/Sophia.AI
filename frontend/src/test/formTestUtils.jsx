import React from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthContext } from '../context/AuthContext';

export const mockAuthValue = {
  authState: {
    isAuthenticated: true,
    user: { id: 1, username: 'testuser', email: 'test@example.com' },
  },
  setAuthState: vi.fn(),
  updateAuthState: vi.fn(),
  clearAuthState: vi.fn(),
  user: { id: 1, username: 'testuser', email: 'test@example.com' },
  isAuthenticated: true,
  authInitialized: true,
};

/**
 * Render with Router + AuthContext. Use `auth` to override AuthContext value.
 */
export function renderWithProviders(
  ui,
  {
    route = '/',
    auth = mockAuthValue,
    ...options
  } = {},
) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
    </AuthContext.Provider>,
    options,
  );
}

export function unauthenticatedAuth() {
  return {
    ...mockAuthValue,
    authState: { isAuthenticated: false, user: null },
    user: null,
    isAuthenticated: false,
  };
}
