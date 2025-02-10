// src/api/axiosConfig.ts
import axios from 'axios';
// import Cookies from 'js-cookie';


const baseURL = 'http://localhost:8000/api';


const axiosInstance = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Important: This ensures cookies are sent with requests
});

// Add a request interceptor
axiosInstance.interceptors.request.use(
  function (config) {
    // Get CSRF token from cookie
    const csrfToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('csrftoken='))
      ?.split('=')[1];

    if (csrfToken) {
      config.headers['X-CSRFToken'] = csrfToken;
    }

    // For file uploads, let the browser set the correct Content-Type
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

// Add a response interceptor for error handling
axiosInstance.interceptors.response.use(
  response => response,
  error => {
    console.error('Request failed:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

export default axiosInstance;
