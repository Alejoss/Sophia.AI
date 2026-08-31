export const getUserFromLocalStorage = () => {
  try {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    return null;
  }
};

export const setUserInLocalStorage = (userData) => {
  try {
    localStorage.setItem('user', JSON.stringify(userData));
  } catch (error) {
    // Failed to set user in localStorage
  }
};

export const removeUserFromLocalStorage = () => {
  try {
    localStorage.removeItem('user');
  } catch (error) {
    // Failed to remove user from localStorage
  }
};

export const isAuthenticated = () => {
  try {
    return localStorage.getItem('is_authenticated') === 'true';
  } catch (error) {
    return false;
  }
};

export const setAuthenticationStatus = (status) => {
  try {
    localStorage.setItem('is_authenticated', status ? 'true' : 'false');
  } catch (error) {
    // Failed to set authentication status
  }
};

export const clearUserFromLocalStorage = () => {
  localStorage.removeItem('user');
};

export const clearAuthenticationStatus = () => {
  localStorage.removeItem('is_authenticated');
};

export const getAccessTokenFromLocalStorage = () => {
  try {
    return localStorage.getItem('access_token');
  } catch (error) {
    return null;
  }
};

export const setAccessTokenInLocalStorage = (token) => {
  try {
    localStorage.setItem('access_token', token);
  } catch (error) {
    // Failed to set access token
  }
};

export const removeAccessTokenFromLocalStorage = () => {
  try {
    localStorage.removeItem('access_token');
  } catch (error) {
    // Failed to remove access token
  }
};

/**
 * Synchronous snapshot of a logged-in session for the first React paint.
 * After logout we keep `{ username }` in localStorage, so token + flag + user
 * must all be present — otherwise the guest landing flashes then swaps.
 */
export const readPersistedSession = () => {
  try {
    const hasToken = Boolean(getAccessTokenFromLocalStorage());
    const flagged = isAuthenticated();
    const user = getUserFromLocalStorage();
    const hasUser = Boolean(user && (user.username || user.id != null));
    if (hasToken && flagged && hasUser) {
      return { isAuthenticated: true, user };
    }
  } catch {
    // localStorage unavailable (privacy mode, SSR tests, etc.)
  }
  return { isAuthenticated: false, user: null };
};
