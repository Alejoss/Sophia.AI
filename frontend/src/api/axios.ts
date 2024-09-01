// src/api/axios.ts
import axios from 'axios';

axios.defaults.withCredentials = true;

const baseURL = 'http://localhost:8000/api';

let accessToken: string | null = null;

// Function to set the access token in memory
export const setAccessToken = (token: string) => {
  accessToken = token;
};

const axiosInstance = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Axios request interceptor to add the Authorization header
axiosInstance.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers['Authorization'] = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default axiosInstance;
