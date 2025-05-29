import axiosInstance from './axiosConfig';

// List all threads for the current user
export const fetchThreads = () => {
  return axiosInstance.get('/messages/threads/');
};

// Get or create a thread with a specific user
export const fetchOrCreateThread = (userId) => {
  return axiosInstance.get(`/messages/threads/${userId}/`);
};

// List all messages in a thread
export const fetchMessages = (threadId) => {
  return axiosInstance.get(`/messages/threads/${threadId}/messages/`);
};

// Send a message in a thread
export const sendMessage = (threadId, text) => {
  return axiosInstance.post(`/messages/threads/${threadId}/messages/`, { text });
};

// Delete a message (soft delete)
export const deleteMessage = (messageId) => {
  return axiosInstance.post(`/messages/messages/${messageId}/delete/`);
};
