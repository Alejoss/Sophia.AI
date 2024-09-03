// src/api/axios.ts
import axios from 'axios';

axios.defaults.withCredentials = true;

const baseURL = 'http://localhost:8000/api';

const axiosInstance = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // Important: This ensures cookies are sent with requests
});

export default axiosInstance;
