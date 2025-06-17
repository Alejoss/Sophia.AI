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
