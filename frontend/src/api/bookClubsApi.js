import axiosInstance from './axiosConfig';

const CLEARABLE_STRING_FIELDS = new Set(['telegram_group_url', 'description']);

/** Prefer JSON; use FormData only when uploading a cover image. */
const toRequestBody = (payload) => {
  const hasFile = payload?.cover_image instanceof File;
  if (!hasFile) {
    const body = { ...payload };
    // Drop undefined only. Keep null / '' so admins can clear fields
    // (Telegram, dates, cover, topic). Empty strings only for clearable fields.
    Object.keys(body).forEach((key) => {
      if (body[key] === undefined) {
        delete body[key];
      } else if (body[key] === '' && !CLEARABLE_STRING_FIELDS.has(key)) {
        delete body[key];
      }
    });
    return body;
  }
  const formData = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) return;
    if (value instanceof File) {
      formData.append(key, value);
    } else if (value === null || (value === '' && CLEARABLE_STRING_FIELDS.has(key))) {
      // Empty string clears nullable / clearable fields in multipart.
      formData.append(key, '');
    } else if (value !== '') {
      formData.append(key, value);
    }
  });
  return formData;
};

const guestHeaders = (guestToken) =>
  guestToken ? { 'X-Book-Club-Guest': guestToken } : undefined;

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

  getMemberIntroduction: async (slug) => {
    const response = await axiosInstance.get(
      `/book_clubs/${slug}/membership/introduction/`
    );
    return response.data;
  },

  updateMemberIntroduction: async (slug, payload) => {
    const response = await axiosInstance.patch(
      `/book_clubs/${slug}/membership/introduction/`,
      payload
    );
    return response.data;
  },

  listMembers: async (slug, { includeAll = false } = {}) => {
    const response = await axiosInstance.get(`/book_clubs/${slug}/members/`, {
      params: includeAll ? { include_all: 1 } : undefined,
    });
    return response.data;
  },

  requestGuestAccess: async (slug, email) => {
    const response = await axiosInstance.post(`/book_clubs/${slug}/guest-access/`, { email });
    return response.data;
  },

  getInvitePreview: async (token) => {
    const response = await axiosInstance.get('/book_clubs/invite-preview/', {
      params: { token },
    });
    return response.data;
  },

  getHub: async (slug, { guestToken } = {}) => {
    const response = await axiosInstance.get(`/book_clubs/${slug}/hub/`, {
      headers: guestHeaders(guestToken),
    });
    return response.data;
  },

  listEvents: async (slug, { guestToken } = {}) => {
    const response = await axiosInstance.get(`/book_clubs/${slug}/events/`, {
      headers: guestHeaders(guestToken),
    });
    return response.data;
  },

  linkEvent: async (slug, eventId) => {
    const response = await axiosInstance.post(`/book_clubs/${slug}/events/`, {
      event_id: eventId,
    });
    return response.data;
  },

  unlinkEvent: async (slug, linkId) => {
    await axiosInstance.delete(`/book_clubs/${slug}/events/${linkId}/`);
  },

  listDiscussionQuestions: async (slug, status, { guestToken } = {}) => {
    const params = status ? { status } : undefined;
    const response = await axiosInstance.get(`/book_clubs/${slug}/discussion-questions/`, {
      params,
      headers: guestHeaders(guestToken),
    });
    return response.data;
  },

  getDiscussionQuestion: async (slug, questionId, { guestToken } = {}) => {
    const response = await axiosInstance.get(
      `/book_clubs/${slug}/discussion-questions/${questionId}/`,
      { headers: guestHeaders(guestToken) }
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

  deleteDiscussionQuestion: async (slug, questionId) => {
    await axiosInstance.delete(`/book_clubs/${slug}/discussion-questions/${questionId}/`);
  },
};

export default bookClubsApi;
