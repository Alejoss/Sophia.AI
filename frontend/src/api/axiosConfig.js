// src/api/axiosConfig.ts
import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL;

// Create a single axios instance with basic configuration
const axiosInstance = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true,
  timeout: 30000 // 30 second timeout
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
    // 5. The request is for the check_auth endpoint (to avoid infinite loops)
    if (error.response?.status !== 401 || 
        originalRequest._retry || 
        originalRequest.url === '/profiles/refresh_token/' ||
        originalRequest.url === '/profiles/logout/' ||
        originalRequest.url === '/profiles/check_auth/') {
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
      // If refresh fails, don't automatically clear auth state or redirect
      // This prevents hard page refresh that breaks React Router state
      // Components will receive the 401 error and can handle it appropriately
      
      // Dispatch a custom event that components can listen to if needed
      // This allows for graceful handling without hard page refresh
      window.dispatchEvent(new CustomEvent('auth:token_refresh_failed', { 
        detail: { 
          reason: 'token_refresh_failed',
          originalError: error,
          refreshError: refreshError
        } 
      }));
      
      // Return the original 401 error so components can handle it
      // Components can check error.response?.status === 401 and decide what to do
      // They might want to verify auth status with checkAuth() or show appropriate UI
      return Promise.reject(error);
    }
  }
);

export default axiosInstance;
