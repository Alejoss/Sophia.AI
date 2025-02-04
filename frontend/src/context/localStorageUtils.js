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

export const setFormType = (formType) => {
  try {
    localStorage.setItem('form_type', formType);
  } catch (error) {
    console.error('Failed to set form type in localStorage:', error);
  }
};

export const setFormData = (formData) => {
  try {
    localStorage.setItem('form_data', JSON.stringify(formData));
  } catch (error) {
    console.error('Failed to set form data in localStorage:', error);
  }
};

export const getFormFromLocalStorage = () => {
  try {
    const formType = localStorage.getItem('form_type');
    const formData = localStorage.getItem('form_data');
    return { "formType": formType, "formData": JSON.parse(formData) };
  } catch (error) {
    console.error('Failed to get form from localStorage:', error);
    return { formType: null, formData: null };
  }
};
