export const getUserFromLocalStorage = () => {
  try {
    const storedUser = localStorage.getItem('user');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch (error) {
    console.error('Failed to get user from localStorage:', error);
    return null;
  }
};

export const setUserInLocalStorage = (userData) => {
  try {
    localStorage.setItem('user', JSON.stringify(userData));
  } catch (error) {
    console.error('Failed to set user in localStorage:', error);
  }
};

export const removeUserFromLocalStorage = () => {
  try {
    localStorage.removeItem('user');
  } catch (error) {
    console.error('Failed to remove user from localStorage:', error);
  }
};

export const isAuthenticated = () => {
  try {
    return localStorage.getItem('is_authenticated') === 'true';
  } catch (error) {
    console.error('Failed to check authentication status:', error);
    return false;
  }
};

export const setAuthenticationStatus = (status) => {
  try {
    localStorage.setItem('is_authenticated', status ? 'true' : 'false');
  } catch (error) {
    console.error('Failed to set authentication status in localStorage:', error);
  }
};

export const clearUserFromLocalStorage = () => {
  localStorage.removeItem('user');
};

export const clearAuthenticationStatus = () => {
  localStorage.removeItem('is_authenticated');
};
