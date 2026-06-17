/**
 * Session-scoped event detail loader. Survives React remounts so a flickering tree
 * cannot spawn dozens of parallel GET /events/:id/ requests.
 */
const sessions = new Map();

const createSession = () => ({
  status: 'idle', // idle | loading | done | error
  data: null,
  error: null,
  promise: null,
});

export const getEventDetailSession = (eventId) => {
  const id = String(eventId);
  if (!sessions.has(id)) {
    sessions.set(id, createSession());
  }
  return sessions.get(id);
};

export const resetEventDetailSession = (eventId) => {
  sessions.delete(String(eventId));
};

export const getEventDetailSessionSnapshot = (eventId) => {
  const session = getEventDetailSession(eventId);
  return {
    status: session.status,
    data: session.data,
    error: session.error,
    promise: session.promise,
  };
};

/**
 * Returns an existing in-flight/done/error promise or starts exactly one new load.
 */
export const loadEventDetailOnce = (eventId, loader) => {
  const session = getEventDetailSession(eventId);

  if (session.status === 'done') {
    return Promise.resolve(session.data);
  }

  if (session.status === 'loading' && session.promise) {
    return session.promise;
  }

  if (session.status === 'error') {
    return Promise.reject(session.error);
  }

  session.status = 'loading';
  session.promise = loader()
    .then((data) => {
      session.status = 'done';
      session.data = data;
      session.error = null;
      return data;
    })
    .catch((error) => {
      session.status = 'error';
      session.error = error;
      session.data = null;
      session.promise = null;
      throw error;
    });

  return session.promise;
};
