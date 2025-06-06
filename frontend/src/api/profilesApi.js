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
    console.log('Auth check response:', response.data);
    
    if (response.status === 200) {
      return response.data.is_authenticated === true;
    }
    return false;
  } catch(error) {
    console.error('Auth check error:', error);
    return false;
  }
};

const getUserProfile = async () => {
  try {
    console.log('getUserProfile: Making API call to fetch user profile');
    const response = await axiosInstance.get('/profiles/user_profile/');
    console.log('getUserProfile: API response received', response.data);
    return response.data; // Assuming the API returns the profile directly
  } catch (error) {
    console.error('getUserProfile: Failed to fetch user profile:', error);
    return null; // Simply return null on error
  }
}

const getProfileById = async (profileId) => {
  try {
    console.log(`getProfileById: Making API call to fetch profile ${profileId}`);
    const response = await axiosInstance.get(`/profiles/${profileId}/`);
    console.log('getProfileById: API response received', response.data);
    return response.data;
  } catch (error) {
    console.error('getProfileById: Failed to fetch profile:', error);
    throw error;
  }
};

const updateProfile = async (formData) => {
  try {
    console.log('updateProfile: Making API call to update profile');
    const response = await axiosInstance.put('/profiles/user_profile/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    console.log('updateProfile: API response received', response.data);
    return response.data;
  } catch (error) {
    console.error('updateProfile: Failed to update profile:', error);
    throw error;
  }
};

const apiLogout = async () => {
  try {
    console.log('Making API call to logout...');
    const response = await axiosInstance.post('/profiles/logout/');
    console.log('Logout API response:', response);
    
    // Clear axios headers after successful logout
    delete axiosInstance.defaults.headers.common['Authorization'];
    
    return response;
  } catch (error) {
    console.error('Failed to logout:', error);
    // Even if the API call fails, clear the headers
    delete axiosInstance.defaults.headers.common['Authorization'];
    throw new Error('Logout failed');
  }
};

const apiLogin = async ({ username, password }) => {
  try {
    const response = await axiosInstance.post('/profiles/login/', { username, password });
    console.log('Login API response:', response); // Debug log
    
    // Make sure we have an access token
    if (response.data.access_token) {
      // Set the token in the axios instance
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${response.data.access_token}`;
      
      // Set the token in AuthContext
      if (window.authContext) {
        console.log('Setting token in AuthContext');
        window.authContext.setAccessToken(response.data.access_token);
      } else {
        console.error('AuthContext not available');
      }
    }
    
    return response; // Return the full response
  } catch (error) {
    console.error('Login API error:', error);
    throw error;
  }
};

const apiRegister = async (userData) => {
  try {
    const response = await axiosInstance.post('/profiles/register/', userData);
    return response.data; // Or response if you need status for 201 check elsewhere
  } catch (error) {
    console.error('Registration API error:', error.response || error);
    throw error; // Re-throw to be handled by the calling component
  }
};

async function setCsrfToken() {
  try {
    const response = await axiosInstance.get(`/profiles/get_csrf_token/`);
    console.log('Response from CSRF token endpoint:', response.data);
    const csrftoken = Cookies.get('csrftoken');
    console.log('CSRF token retrieved from cookies:', csrftoken);
    if (csrftoken) {
      axiosInstance.defaults.headers.common['X-CSRFToken'] = csrftoken;
      console.log('CSRF token set in axios instance');
      console.log('CSRF just set:', axiosInstance.defaults.headers.common['X-CSRFToken']);
    } else {
      console.error('No CSRF token found in cookies');
    }
  } catch (error) {
    console.error('Error initializing CSRF token:', error);
  }
}

const refreshToken = async () => {
  try {
    const response = await axiosInstance.post('/profiles/refresh_token/');
    return response.data;
  } catch (error) {
    console.error('Token refresh failed:', error);
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
    console.error('Social login failed:', error);
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
  socialLogin
};
