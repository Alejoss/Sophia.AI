// src/api/profilesAPI.js
import axiosInstance from './axiosConfig.js';
import Cookies from "js-cookie";
import { getUserFromLocalStorage } from '../context/localStorageUtils';

const checkAuth = async () => {
  try {
    // Get the stored token
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      // Set the token in axios headers
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
    }

    const response = await axiosInstance.get('/profiles/check_auth/');
    
    if (response.status === 200) {
      return response.data.is_authenticated === true;
    }
    return false;
  } catch(error) {
    return false;
  }
};

const getUserProfile = async () => {
  try {
    const response = await axiosInstance.get('/profiles/user_profile/');
    return response.data;
  } catch (error) {
    return null;
  }
}

const getProfileById = async (profileId) => {
  try {
    const response = await axiosInstance.get(`/profiles/${profileId}/`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

const updateProfile = async (formData) => {
  try {
    const response = await axiosInstance.put('/profiles/user_profile/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  } catch (error) {
    throw error;
  }
};

const apiLogout = async () => {
  try {
    const response = await axiosInstance.post('/profiles/logout/');
    
    // Clear axios headers after successful logout
    delete axiosInstance.defaults.headers.common['Authorization'];
    
    return response;
  } catch (error) {
    // Even if the API call fails, clear the headers
    delete axiosInstance.defaults.headers.common['Authorization'];
    throw new Error('Error al cerrar sesión');
  }
};

const apiLogin = async ({ username, password }) => {
  try {
    const response = await axiosInstance.post('/profiles/login/', { username, password });
    
    // Make sure we have an access token
    if (response.data.access_token) {
      // Set the token in the axios instance
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
      
      // Set the token in AuthContext using the new approach
      if (window.authContext) {
        const { access_token, ...userData } = response.data;
        window.authContext.updateAuthState(userData, access_token);
      }
    }
    
    return response;
  } catch (error) {
    throw error;
  }
};

const apiRegister = async (userData) => {
  try {
    const response = await axiosInstance.post('/profiles/register/', userData);
    
    // Make sure we have an access token
    if (response.data.access_token) {
      // Set the token in the axios instance
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
      
      // Set the token in AuthContext using the new approach
      if (window.authContext) {
        const { access_token, ...userData } = response.data;
        window.authContext.updateAuthState(userData, access_token);
      }
    }
    
    return response;
  } catch (error) {
    throw error;
  }
};

async function setCsrfToken() {
  try {
    const response = await axiosInstance.get(`/profiles/get_csrf_token/`);
    const csrftoken = Cookies.get('csrftoken');
    if (csrftoken) {
      axiosInstance.defaults.headers.common['X-CSRFToken'] = csrftoken;
    }
  } catch (error) {
    // Error initializing CSRF token
  }
}

const refreshToken = async () => {
  try {
    const response = await axiosInstance.post('/profiles/refresh_token/');
    return response.data;
  } catch (error) {
    throw error;
  }
};

const socialLogin = async (credential) => {
  try {
    const response = await axiosInstance.post(
      '/rest-auth/google/login/',
      { access_token: credential }
    );
    return response.data;
  } catch (error) {
    throw error;
  }
};

const getNotifications = async (showAll = false) => {
  console.log('getNotifications called');
  try {
    console.log('Making API request to /profiles/notifications/');
    const url = showAll ? '/profiles/notifications/?show_all=true' : '/profiles/notifications/';
    const response = await axiosInstance.get(url);
    console.log('Notifications API response:', response.data);
    return response.data.notifications;
  } catch (error) {
    console.error('Error in getNotifications:', error);
    throw error;
  }
};

const getUnreadNotificationsCount = async () => {
  try {
    const response = await axiosInstance.get('/profiles/notifications/unread-count/');
    return response.data.unread_count;
  } catch (error) {
    console.error('Error in getUnreadNotificationsCount:', error);
    return 0;
  }
};

const markNotificationAsRead = async (notificationId) => {
  console.log('markNotificationAsRead called for ID:', notificationId);
  try {
    console.log('Making API request to mark notification as read');
    const response = await axiosInstance.post(`/profiles/notifications/${notificationId}/mark-as-read/`);
    console.log('Mark as read API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in markNotificationAsRead:', error);
    throw error;
  }
};

const deleteNotification = async (notificationId) => {
  console.log('deleteNotification called for ID:', notificationId);
  try {
    console.log('Making API request to delete notification');
    const response = await axiosInstance.delete(`/profiles/notifications/${notificationId}/delete/`);
    console.log('Delete notification API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in deleteNotification:', error);
    throw error;
  }
};

const cleanupNotifications = async () => {
  console.log('cleanupNotifications called');
  try {
    console.log('Making API request to cleanup notifications');
    const response = await axiosInstance.delete('/profiles/notifications/cleanup/');
    console.log('Cleanup notifications API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in cleanupNotifications:', error);
    throw error;
  }
};

const markAllNotificationsAsRead = async () => {
  console.log('markAllNotificationsAsRead called');
  try {
    console.log('Making API request to mark all notifications as read');
    const response = await axiosInstance.post('/profiles/notifications/mark-all-as-read/');
    console.log('Mark all as read API response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error in markAllNotificationsAsRead:', error);
    throw error;
  }
};

// Cryptocurrency API functions
const getCryptocurrencies = async () => {
  try {
    const response = await axiosInstance.get('/profiles/cryptocurrencies/');
    return response.data;
  } catch (error) {
    console.error('Error fetching cryptocurrencies:', error);
    throw error;
  }
};

const getUserAcceptedCryptos = async (userId = null) => {
  try {
    const url = userId ? `/profiles/accepted-cryptos/${userId}/` : '/profiles/accepted-cryptos/';
    const response = await axiosInstance.get(url);
    return response.data;
  } catch (error) {
    console.error('Error fetching accepted cryptocurrencies:', error);
    throw error;
  }
};

const addAcceptedCrypto = async (cryptoId, address) => {
  try {
    const response = await axiosInstance.post('/profiles/accepted-cryptos/', {
      crypto_id: cryptoId,
      address: address
    });
    return response.data;
  } catch (error) {
    console.error('Error adding accepted cryptocurrency:', error);
    throw error;
  }
};

const deleteAcceptedCrypto = async (cryptoId) => {
  try {
    const response = await axiosInstance.delete(`/profiles/accepted-cryptos/delete/${cryptoId}/`);
    return response.data;
  } catch (error) {
    console.error('Error deleting accepted cryptocurrency:', error);
    throw error;
  }
};

const submitSuggestion = async (message) => {
  try {
    const response = await axiosInstance.post('/profiles/suggestions/', {
      message: message
    });
    return response.data;
  } catch (error) {
    console.error('Error submitting suggestion:', error);
    throw error;
  }
};

const changePassword = async (oldPassword, newPassword, confirmPassword) => {
  try {
    const response = await axiosInstance.post('/profiles/change-password/', {
      old_password: oldPassword,
      new_password: newPassword,
      confirm_password: confirmPassword
    });
    return response.data;
  } catch (error) {
    console.error('Error changing password:', error);
    throw error;
  }
};

export { 
  getUserProfile, 
  apiLogout, 
  setCsrfToken, 
  apiLogin, 
  checkAuth, 
  getProfileById, 
  updateProfile, 
  apiRegister, 
  refreshToken,
  socialLogin,
  getNotifications,
  getUnreadNotificationsCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  cleanupNotifications,
  getCryptocurrencies,
  getUserAcceptedCryptos,
  addAcceptedCrypto,
  deleteAcceptedCrypto,
  submitSuggestion,
  changePassword
};
