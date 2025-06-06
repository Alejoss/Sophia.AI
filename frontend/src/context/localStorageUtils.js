export const getUserFromLocalStorage = () => {
  try {
    const storedUser = localStorage.getItem('user');
    console.log('Getting user from localStorage:', storedUser);
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error('Failed to get user from localStorage:', error);
    return null;
  }
};

export const setUserInLocalStorage = (userData) => {
  try {
    console.log('Setting user in localStorage:', userData);
    localStorage.setItem('user', JSON.stringify(userData));
  } catch (error) {
    console.error('Failed to set user in localStorage:', error);
  }
};

export const removeUserFromLocalStorage = () => {
  try {
    console.log('Removing user from localStorage');
    localStorage.removeItem('user');
  } catch (error) {
    console.error('Failed to remove user from localStorage:', error);
  }
};

export const isAuthenticated = () => {
  try {
    const status = localStorage.getItem('is_authenticated') === 'true';
    console.log('Checking authentication status:', status);
    return status;
  } catch (error) {
    console.error('Failed to check authentication status:', error);
    return false;
  }
};

export const setAuthenticationStatus = (status) => {
  try {
    console.log('Setting authentication status:', status);
    localStorage.setItem('is_authenticated', status ? 'true' : 'false');
  } catch (error) {
    console.error('Failed to set authentication status in localStorage:', error);
  }
};

export const clearUserFromLocalStorage = () => {
  console.log('Clearing user from localStorage');
  localStorage.removeItem('user');
};

export const clearAuthenticationStatus = () => {
  console.log('Clearing authentication status from localStorage');
  localStorage.removeItem('is_authenticated');
};

export const getAccessTokenFromLocalStorage = () => {
  try {
    const token = localStorage.getItem('access_token');
    console.log('Getting access token from localStorage:', token ? 'Token exists' : 'No token');
    return token;
  } catch (error) {
    console.error('Failed to get access token from localStorage:', error);
    return null;
  }
};

export const setAccessTokenInLocalStorage = (token) => {
  try {
    console.log('Setting access token in localStorage:', token ? 'Token exists' : 'No token');
    localStorage.setItem('access_token', token);
  } catch (error) {
    console.error('Failed to set access token in localStorage:', error);
  }
};

export const removeAccessTokenFromLocalStorage = () => {
  try {
    console.log('Removing access token from localStorage');
    localStorage.removeItem('access_token');
  } catch (error) {
    console.error('Failed to remove access token from localStorage:', error);
  }
};
