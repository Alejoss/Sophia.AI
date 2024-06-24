// src/api/eventsApi.ts
import axiosInstance from './axios';
import { Event } from '../features/events/eventTypes';

export const fetchEvents = async (): Promise<Event[]> => {
  const response = await axiosInstance.get<Event[]>('');
  console.log(response.data)
  return response.data;
};
