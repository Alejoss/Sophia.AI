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
    throw new Error('Logout failed');
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
    return response.data;
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

const getNotifications = async () => {
  console.log('getNotifications called');
  try {
    console.log('Making API request to /profiles/notifications/');
    const response = await axiosInstance.get('/profiles/notifications/');
    console.log('Notifications API response:', response.data);
    return response.data.notifications;
  } catch (error) {
    console.error('Error in getNotifications:', error);
    throw error;
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
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  cleanupNotifications
};
