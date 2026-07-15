import axiosInstance from './axiosConfig';

const appendIfPresent = (formData, key, value) => {
  if (value === undefined || value === null || value === '') return;
  formData.append(key, value);
};

/** Prefer JSON; use FormData only when uploading a cover image. */
const toRequestBody = (payload) => {
  const hasFile = payload?.cover_image instanceof File;
  if (!hasFile) {
    const body = { ...payload };
    delete body.cover_image;
    Object.keys(body).forEach((key) => {
      if (body[key] === undefined || body[key] === '') {
        delete body[key];
      }
    });
    return body;
  }
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value instanceof File) {
      formData.append(key, value);
    } else {
      appendIfPresent(formData, key, value);
    }
  });
  return formData;
};

const bookClubsApi = {
  listClubs: async () => {
    const response = await axiosInstance.get('/book_clubs/');
    return response.data;
  },

  getClub: async (slug) => {
    const response = await axiosInstance.get(`/book_clubs/${slug}/`);
    return response.data;
  },

  createClub: async (payload) => {
    const data = toRequestBody(payload);
    // Let axiosConfig set Content-Type (JSON or multipart boundary)
    const response = await axiosInstance.post('/book_clubs/', data);
    return response.data;
  },

  updateClub: async (slug, payload) => {
    const data = toRequestBody(payload);
    const response = await axiosInstance.patch(`/book_clubs/${slug}/`, data);
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
