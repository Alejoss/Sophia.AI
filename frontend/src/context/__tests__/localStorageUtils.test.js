import { beforeEach, describe, expect, it } from 'vitest';
import {
  readPersistedSession,
  setAccessTokenInLocalStorage,
  setAuthenticationStatus,
  setUserInLocalStorage,
} from '../localStorageUtils';

describe('readPersistedSession', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns a guest session when storage is empty', () => {
    expect(readPersistedSession()).toEqual({ isAuthenticated: false, user: null });
  });

  it('hydrates a full logged-in session', () => {
    const user = { id: 7, username: 'alice' };
    setAccessTokenInLocalStorage('token-abc');
    setAuthenticationStatus(true);
    setUserInLocalStorage(user);

    expect(readPersistedSession()).toEqual({ isAuthenticated: true, user });
  });

  it('ignores leftover username after logout (no token/flag)', () => {
    setUserInLocalStorage({ username: 'alice' });

    expect(readPersistedSession()).toEqual({ isAuthenticated: false, user: null });
  });

  it('ignores flag without access token', () => {
    setAuthenticationStatus(true);
    setUserInLocalStorage({ id: 7, username: 'alice' });

    expect(readPersistedSession()).toEqual({ isAuthenticated: false, user: null });
  });
});
