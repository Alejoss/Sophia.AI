// src/api/eventsApi.js
import axiosInstance from './axiosConfig.js';

export const fetchEvents = async () => {
  try {
    const response = await axiosInstance.get('/events/');
    return response.data;
  } catch (error) {
    console.error('Error fetching events:', error);
    if (error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

export const createEvent = async (eventData) => {
  try {
    const response = await axiosInstance.post('/events/', eventData);
    return response.data;
  } catch (error) {
    console.error('Error creating event:', error);
    if (error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

export const fetchEventById = async (eventId) => {
  try {
    const response = await axiosInstance.get(`/events/${eventId}/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching event:', error);
    if (error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

export const updateEvent = async (eventId, eventData) => {
  try {
    const response = await axiosInstance.put(`/events/${eventId}/`, eventData);
    return response.data;
  } catch (error) {
    console.error('Error updating event:', error);
    if (error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

export const deleteEvent = async (eventId) => {
  try {
    await axiosInstance.delete(`/events/${eventId}/`);
  } catch (error) {
    console.error('Error deleting event:', error);
    if (error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

// Event Registration API functions
export const registerForEvent = async (eventId) => {
  try {
    const response = await axiosInstance.post(`/events/${eventId}/register/`);
    return response.data;
  } catch (error) {
    console.error('Error registering for event:', error);
    if (error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

export const cancelEventRegistration = async (eventId) => {
  try {
    const response = await axiosInstance.delete(`/events/${eventId}/register/`);
    return response.data;
  } catch (error) {
    console.error('Error cancelling event registration:', error);
    if (error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

export const getEventParticipants = async (eventId) => {
  try {
    const response = await axiosInstance.get(`/events/${eventId}/participants/`);
    return response.data;
  } catch (error) {
    console.error('Error fetching event participants:', error);
    if (error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

export const getUserEventRegistrations = async () => {
  try {
    const response = await axiosInstance.get('/events/my-registrations/');
    return response.data;
  } catch (error) {
    console.error('Error fetching user event registrations:', error);
    if (error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

export const getUserCreatedEvents = async () => {
  try {
    const response = await axiosInstance.get('/events/my-events/');
    return response.data;
  } catch (error) {
    console.error('Error fetching user created events:', error);
    if (error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

// For visitors to view other users' events - using the same endpoint with user parameter
export const getUserEventRegistrationsById = async (userId) => {
  try {
    // For now, return empty array since registrations are private
    return [];
  } catch (error) {
    console.error('Error fetching user event registrations by ID:', error);
    if (error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

export const getUserCreatedEventsById = async (userId) => {
  try {
    // Use the events endpoint with owner filter
    const response = await axiosInstance.get(`/events/?owner=${userId}`);
    console.log('Events by owner response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching user created events by ID:', error);
    if (error.response) {
      throw error.response.data;
    }
    throw error;
  }
};

export const updateParticipantStatus = async (eventId, registrationId, action) => {
  try {
    const response = await axiosInstance.patch(`/events/${eventId}/participants/${registrationId}/status/`, {
      action: action
    });
    return response.data;
  } catch (error) {
    console.error('Error updating participant status:', error);
    if (error.response) {
      throw error.response.data;
    }
    throw error;
  }
};
