// src/api/axiosConfig.ts
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL;

// Create a single axios instance with basic configuration
const axiosInstance = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
});

// Request interceptor to add access token to requests
axiosInstance.interceptors.request.use(
  (config) => {
    // Get token from localStorage
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // Add CSRF token if available
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];

    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }

    // Handle FormData content type
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor to handle authentication and token refresh
 */
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Don't retry if:
    // 1. It's not a 401 error
    // 2. The request has already been retried
    // 3. The request is for the refresh token endpoint
    // 4. The request is for the logout endpoint
    if (error.response?.status !== 401 || 
        originalRequest._retry || 
        originalRequest.url === '/profiles/refresh_token/' ||
        originalRequest.url === '/profiles/logout/') {
      return Promise.reject(error);
    }

    // Mark request as retried
    originalRequest._retry = true;

    try {
      // Try to refresh the token
      const response = await axiosInstance.post('/profiles/refresh_token/');
      const { access_token } = response.data;

      // Store new token in localStorage
      localStorage.setItem('access_token', access_token);

      // Retry the original request with new token
      originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      // If refresh fails, clear auth and redirect to login
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      localStorage.setItem('is_authenticated', 'false');
      
      window.location.href = '/profiles/login';
      return Promise.reject(refreshError);
    }
  }
);

export default axiosInstance;
