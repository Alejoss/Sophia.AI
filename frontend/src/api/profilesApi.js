// src/api/profilesAPI.js
import axiosInstance from './axios_config.js';
import Cookies from "js-cookie";

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

const logout = async () => {
  try {
    await axiosInstance.post('/profiles/logout/');
  } catch (error) {
    console.error('Failed to logout:', error);
    throw new Error('Logout failed'); // Throw an error for logout failure
  }
}

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

export { getUserProfile, logout, setCsrfToken };
