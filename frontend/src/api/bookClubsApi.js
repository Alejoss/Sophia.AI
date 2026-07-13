import axiosInstance from './axiosConfig';

const bookClubsApi = {
  listClubs: async () => {
    const response = await axiosInstance.get('/book_clubs/');
    return response.data;
  },

  getClub: async (slug) => {
    const response = await axiosInstance.get(`/book_clubs/${slug}/`);
    return response.data;
  },

  joinClub: async (slug) => {
    const response = await axiosInstance.post(`/book_clubs/${slug}/join/`);
    return response.data;
  },

  getHub: async (slug) => {
    const response = await axiosInstance.get(`/book_clubs/${slug}/hub/`);
    return response.data;
  },

  listEvents: async (slug) => {
    const response = await axiosInstance.get(`/book_clubs/${slug}/events/`);
    return response.data;
  },

  linkEvent: async (slug, eventId) => {
    const response = await axiosInstance.post(`/book_clubs/${slug}/events/`, {
      event_id: eventId,
    });
    return response.data;
  },

  listDiscussionQuestions: async (slug, status) => {
    const params = status ? { status } : undefined;
    const response = await axiosInstance.get(`/book_clubs/${slug}/discussion-questions/`, {
      params,
    });
    return response.data;
  },

  getDiscussionQuestion: async (slug, questionId) => {
    const response = await axiosInstance.get(
      `/book_clubs/${slug}/discussion-questions/${questionId}/`
    );
    return response.data;
  },

  createDiscussionQuestion: async (slug, payload) => {
    const response = await axiosInstance.post(
      `/book_clubs/${slug}/discussion-questions/`,
      payload
    );
    return response.data;
  },

  updateDiscussionQuestion: async (slug, questionId, payload) => {
    const response = await axiosInstance.patch(
      `/book_clubs/${slug}/discussion-questions/${questionId}/`,
      payload
    );
    return response.data;
  },
};

export default bookClubsApi;
