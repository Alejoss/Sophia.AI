// src/api/eventsApi.js
import axios from 'axios';
import axiosInstance from './axiosConfig.js';
import { rethrowAxiosError } from '../utils/authErrorHandler.js';

const fail = (error, message) => {
  console.error(message, error);
  rethrowAxiosError(error, message);
};

/** In-flight + short-lived cache so detail pages cannot hammer the API on effect loops. */
const eventDetailInflight = new Map();
const eventDetailCache = new Map();

export const invalidateEventDetailCache = (eventId) => {
  if (eventId == null) {
    eventDetailCache.clear();
    return;
  }
  eventDetailCache.delete(String(eventId));
};

/** Synchronous cache read — lets detail pages render without resetting to loading. */
export const peekEventDetailCache = (eventId) =>
  eventDetailCache.get(String(eventId)) ?? null;

export const fetchEvents = async () => {
  try {
    const response = await axiosInstance.get('/events/');
    return response.data;
  } catch (error) {
    fail(error, 'Error fetching events');
  }
};

export const createEvent = async (eventData) => {
  try {
    const response = await axiosInstance.post('/events/', eventData);
    return response.data;
  } catch (error) {
    fail(error, 'Error creating event');
  }
};

export const fetchEventById = async (
  eventId,
  { bypassCache = false, signal } = {},
) => {
  const id = String(eventId);

  if (!bypassCache && eventDetailCache.has(id)) {
    return eventDetailCache.get(id);
  }

  if (eventDetailInflight.has(id)) {
    return eventDetailInflight.get(id);
  }

  const request = (async () => {
    try {
      const response = await axiosInstance.get(`/events/${id}/`, { signal });
      eventDetailCache.set(id, response.data);
      return response.data;
    } catch (error) {
      if (axios.isCancel(error) || error?.code === 'ERR_CANCELED') {
        throw error;
      }
      fail(error, 'Error fetching event');
    } finally {
      eventDetailInflight.delete(id);
    }
  })();

  eventDetailInflight.set(id, request);
  return request;
};

export const updateEvent = async (eventId, eventData) => {
  try {
    const response = await axiosInstance.put(`/events/${eventId}/`, eventData);
    invalidateEventDetailCache(eventId);
    return response.data;
  } catch (error) {
    fail(error, 'Error updating event');
  }
};

export const deleteEvent = async (eventId) => {
  try {
    await axiosInstance.delete(`/events/${eventId}/`);
    invalidateEventDetailCache(eventId);
  } catch (error) {
    fail(error, 'Error deleting event');
  }
};

// Event Registration API functions
export const registerForEvent = async (eventId) => {
  try {
    const response = await axiosInstance.post(`/events/${eventId}/register/`);
    return response.data;
  } catch (error) {
    fail(error, 'Error registering for event');
  }
};

export const cancelEventRegistration = async (eventId) => {
  try {
    const response = await axiosInstance.delete(`/events/${eventId}/register/`);
    return response.data;
  } catch (error) {
    fail(error, 'Error cancelling event registration');
  }
};

export const getEventParticipants = async (eventId) => {
  try {
    const response = await axiosInstance.get(`/events/${eventId}/participants/`);
    return response.data;
  } catch (error) {
    fail(error, 'Error fetching event participants');
  }
};

export const getUserEventRegistrations = async () => {
  try {
    const response = await axiosInstance.get('/events/my-registrations/');
    return response.data;
  } catch (error) {
    fail(error, 'Error fetching user event registrations');
  }
};

export const getUserCreatedEvents = async () => {
  try {
    const response = await axiosInstance.get('/events/my-events/');
    return response.data;
  } catch (error) {
    fail(error, 'Error fetching user created events');
  }
};

// For visitors to view other users' events - using the same endpoint with user parameter
export const getUserEventRegistrationsById = async (userId) => {
  try {
    // For now, return empty array since registrations are private
    return [];
  } catch (error) {
    fail(error, 'Error fetching user event registrations by ID');
  }
};

export const getUserCreatedEventsById = async (userId) => {
  try {
    // Use the events endpoint with owner filter
    const response = await axiosInstance.get(`/events/?owner=${userId}`);
    console.log('Events by owner response:', response.data);
    return response.data;
  } catch (error) {
    fail(error, 'Error fetching user created events by ID');
  }
};

export const updateParticipantStatus = async (eventId, registrationId, action) => {
  try {
    const response = await axiosInstance.patch(`/events/${eventId}/participants/${registrationId}/status/`, {
      action: action
    });
    return response.data;
  } catch (error) {
    fail(error, 'Error updating participant status');
  }
};
