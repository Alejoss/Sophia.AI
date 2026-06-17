// src/api/axiosConfig.ts
import axios from 'axios';

// Relative /api avoids cross-origin when users open www vs apex (same nginx serves both).
const baseURL = import.meta.env.VITE_API_URL || '/api';

let refreshInFlight = null;

// Create a single axios instance with basic configuration
const axiosInstance = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true,
  timeout: 30000 // 30 second timeout
});

const refreshAccessToken = () => {
  if (!refreshInFlight) {
    refreshInFlight = axiosInstance
      .post('/profiles/refresh_token/')
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
};

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
    const accessToken = localStorage.getItem('access_token');

    // Don't retry if:
    // 1. It's not a 401 error
    // 2. The request has already been retried
    // 3. The request is for the refresh token endpoint
    // 4. The request is for the logout endpoint
    // 5. (check_auth is not excluded: a stale Bearer must refresh so startup auth can recover.)
    if (error.response?.status !== 401 || 
        !accessToken ||
        originalRequest._retry || 
        originalRequest.url === '/profiles/refresh_token/' ||
        originalRequest.url === '/profiles/logout/') {
      return Promise.reject(error);
    }

    // Mark request as retried
    originalRequest._retry = true;

    try {
      const response = await refreshAccessToken();
      const { access_token } = response.data;

      // Store new token in localStorage
      localStorage.setItem('access_token', access_token);

      // Retry the original request with new token
      originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      // If refresh fails, don't automatically clear auth state or redirect
      // This prevents hard page refresh that breaks React Router state
      // AuthContext clears local session on this event. Navigation is left to callers —
      // see utils/authErrorHandler.js and hooks/useAuthErrorHandler.js.
      window.dispatchEvent(new CustomEvent('auth:token_refresh_failed', { 
        detail: { 
          reason: 'token_refresh_failed',
          originalError: error,
          refreshError: refreshError
        } 
      }));
      
      // Return the original 401 so API layers can rethrow as ApiError and components
      // can call handleAuthError() with the appropriate strategy.
      return Promise.reject(error);
    }
  }
);

export default axiosInstance;
