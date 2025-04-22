// src/api/profilesAPI.js
import axiosInstance from './axiosConfig.js';
import Cookies from "js-cookie";

const checkAuth = async () => {
  try {
    const response = await axiosInstance.get('/profiles/check_auth/');
    console.log("Check Auth response:")
    console.log(response);
    if(response.status === 200) {
      return response.data.is_authenticated === true;
    } else if (response.status === 401) {
      return false;
    } else {
      throw new Error('Unexpected response status');
    }
  } catch(error) {
    // TODO: Handle error, if the server is down, we should show a message to the user
    console.error('Error:', error);
    throw error;
  }
}

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
  } catch (error) {
    console.error('Failed to logout:', error);
    throw new Error('Logout failed');
  }
};

const apiLogin = async ({ username, password }) => {
  try {
    const response = await axiosInstance.post('/profiles/login/', { username, password });
    return response.data; // Ensure this returns the user data
  } catch (error) {
    throw error;
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

export { getUserProfile, apiLogout, setCsrfToken, apiLogin, checkAuth, getProfileById, updateProfile };
