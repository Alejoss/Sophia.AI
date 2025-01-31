
export const getUserFromLocalStorage = () => {
  const storedUser = localStorage.getItem('user');
  return storedUser ? JSON.parse(storedUser) : null;
};

export const setUserInLocalStorage = (userData) => {
  localStorage.setItem('user', JSON.stringify(userData));
};

export const removeUserFromLocalStorage = () => {
  localStorage.removeItem('user');
};

export const isAuthenticated = () => {
  return localStorage.getItem('is_authenticated') === 'true';
};

export const setAuthenticationStatus = (status) => {
  localStorage.setItem('is_authenticated', status ? 'true' : 'false');
};

export const setFormType = (formType) => {
  localStorage.setItem('form_type', formType);
}
