// src/api/axios_config.ts
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
    console.log(`Request made to URL: ${config.url}`);
    return config;
  },
  function (error) {
    return Promise.reject(error);
  }
);

export default axiosInstance;
