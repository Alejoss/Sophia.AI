// src/api/axiosConfig.ts
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const baseURL = import.meta.env.VITE_API_URL;

// Create a single axios instance
const axiosInstance = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json'
  },
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
      console.log('CSRF token added to request:', config.url);
    }

    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
    }

    console.log(`Request made to URL: ${baseURL}${config.url}`);
    return config;
  },
  function (error) {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Request interceptor to add access token to requests
axiosInstance.interceptors.request.use(
  (config) => {
    if (window.authContext) {
      const token = window.authContext.getAccessToken();
      console.log('Access token from context:', token ? 'Present' : 'Not present');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
        console.log('Authorization header added to request:', config.url);
      }
    } else {
      console.log('No auth context found for request:', config.url);
    }
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  (response) => {
    console.log('Response received:', {
      url: response.config.url,
      status: response.status,
      statusText: response.statusText
    });
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    console.log('Response error:', {
      url: originalRequest.url,
      status: error.response?.status,
      statusText: error.response?.statusText
    });

    if (error.response?.status !== 401 || originalRequest._retry) {
      console.log('Not a 401 or already retried, rejecting');
      return Promise.reject(error);
    }

    if (isRefreshing) {
      console.log('Token refresh in progress, queueing request');
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then((token) => {
          console.log('Request queued, retrying with new token');
          originalRequest.headers['Authorization'] = `Bearer ${token}`;
          return axiosInstance(originalRequest);
        })
        .catch((err) => {
          console.error('Queued request failed:', err);
          return Promise.reject(err);
        });
    }

    originalRequest._retry = true;
    isRefreshing = true;
    console.log('Starting token refresh process');

    try {
      console.log('Calling refresh token endpoint');
      const response = await axiosInstance.post('/profiles/refresh_token/');
      console.log('Refresh token response received');
      const { access_token } = response.data;

      if (window.authContext) {
        console.log('Updating access token in context');
        window.authContext.setAccessToken(access_token);
      }

      originalRequest.headers['Authorization'] = `Bearer ${access_token}`;
      console.log('Updated request headers with new token');

      processQueue(null, access_token);
      console.log('Processed queued requests');

      console.log('Retrying original request');
      return axiosInstance(originalRequest);
    } catch (refreshError) {
      console.error('Token refresh failed:', refreshError);
      processQueue(refreshError, null);
      
      if (window.authContext) {
        console.log('Clearing auth state and redirecting to login');
        window.authContext.setAuthState({
          isAuthenticated: false,
          user: null
        });
        window.authContext.clearAccessToken();
      }
      
      window.location.href = '/profiles/login';
      
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  }
);

export default axiosInstance;
