// src/api/axiosConfig.ts
import axios from 'axios';

const baseURL = 'http://localhost:8000/api';

// Create a single axios instance
const axiosInstance = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true
});

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

    console.log(`Request made to URL: ${baseURL}${config.url}`);
    return config;
  },
  function (error) {
    return Promise.reject(error);
  }
);

// Add response interceptor for handling 401s
axiosInstance.interceptors.response.use(
  response => response,
  error => {
    console.error('Request failed:', error.response?.data || error.message);
    
    if (error.response?.status === 401 && !window.location.pathname.includes('/profiles/login')) {
      console.log("UNAUTHORIZED: Redirecting to login page");
      window.location.href = '/profiles/login';
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;
