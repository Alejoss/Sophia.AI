import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from '../AuthContext';
import { checkAuth } from '../../api/profilesApi';

vi.mock('../../api/profilesApi', () => ({
  checkAuth: vi.fn(),
  getUserProfile: vi.fn(),
}));

function AuthProbe() {
  const { authState, authInitialized } = useAuth();
  return (
    <>
      <div data-testid="authenticated">{String(authState.isAuthenticated)}</div>
      <div data-testid="username">{authState.user?.username || 'none'}</div>
      <div data-testid="initialized">{String(authInitialized)}</div>
    </>
  );
}

describe('AuthProvider persisted session', () => {
  let resolveCheckAuth;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    resolveCheckAuth = null;
    checkAuth.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCheckAuth = resolve;
        }),
    );
  });

  afterEach(async () => {
    await act(async () => {
      if (resolveCheckAuth) {
        resolveCheckAuth({ isAuthenticated: false, user: null });
        resolveCheckAuth = null;
      }
    });
    localStorage.clear();
  });

  it('paints a logged-in user from localStorage before checkAuth resolves', () => {
    localStorage.setItem('access_token', 'token-abc');
    localStorage.setItem('is_authenticated', 'true');
    localStorage.setItem('user', JSON.stringify({ id: 7, username: 'alice' }));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');
    expect(screen.getByTestId('username')).toHaveTextContent('alice');
    expect(screen.getByTestId('initialized')).toHaveTextContent('false');
  });

  it('paints a guest when localStorage has no session', () => {
    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
    expect(screen.getByTestId('username')).toHaveTextContent('none');
  });

  it('clears optimistic session when checkAuth says logged out', async () => {
    localStorage.setItem('access_token', 'stale-token');
    localStorage.setItem('is_authenticated', 'true');
    localStorage.setItem('user', JSON.stringify({ id: 7, username: 'alice' }));
    checkAuth.mockResolvedValue({ isAuthenticated: false, user: null });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>,
    );

    expect(screen.getByTestId('authenticated')).toHaveTextContent('true');

    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('false');
      expect(screen.getByTestId('initialized')).toHaveTextContent('true');
    });
  });
});
