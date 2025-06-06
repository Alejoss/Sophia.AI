// src/api/axiosConfig.ts
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const baseURL = import.meta.env.VITE_API_URL;

// Initialize with stored token if available
const storedToken = localStorage.getItem('access_token');
const initialHeaders = {
  'Content-Type': 'application/json'
};

if (storedToken) {
  initialHeaders['Authorization'] = `Bearer ${storedToken}`;
}

// Create a single axios instance
const axiosInstance = axios.create({
  baseURL: baseURL,
  headers: initialHeaders,
  withCredentials: true
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
// Queue to store requests that need to be retried
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Add the request interceptor for CSRF
axiosInstance.interceptors.request.use(
  function (config) {
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];

    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    return config;
  },
  function (error) {
    return Promise.reject(error);
  }
);

// Request interceptor to add access token to requests
axiosInstance.interceptors.request.use(
  (config) => {
    if (window.authContext) {
      const token = window.authContext.getAccessToken();
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
      }
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
    if (error.response?.status !== 401 || 
        originalRequest._retry || 
        originalRequest.url === '/profiles/refresh_token/') {
      return Promise.reject(error);
    }

    // Mark request as retried
    originalRequest._retry = true;

    try {
      // Try to refresh the token
      const response = await axiosInstance.post('/profiles/refresh_token/');
      const { access_token } = response.data;

      // Update auth context with new token
      if (window.authContext) {
        window.authContext.setAccessToken(access_token);
      }

      // Retry the original request with new token
      originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      // If refresh fails, clear auth and redirect to login
      if (window.authContext) {
        window.authContext.setAuthState({
          isAuthenticated: false,
          user: null
        });
        window.authContext.clearAccessToken();
      }
      
      window.location.href = '/profiles/login';
      return Promise.reject(refreshError);
    }
  }
);

export default axiosInstance;
