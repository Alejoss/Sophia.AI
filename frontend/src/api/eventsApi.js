// src/api/eventsApi.js
import axiosInstance from './axios_config.js';

export const fetchEvents = async () => {
  const response = await axiosInstance.get('api/events/');
  console.log(response.data);
  return response.data;
};
