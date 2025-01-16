// src/api/eventsApi.ts
import axiosInstance from './axios_config.ts';
import { Event } from '../events/eventTypes';

export const fetchEvents = async (): Promise<Event[]> => {
  const response = await axiosInstance.get<Event[]>('api/events/');
  // TODO asegurarse que el backend tiene api/events
  console.log(response.data)
  return response.data;
};
