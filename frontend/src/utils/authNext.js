/**
 * Resolve post-auth redirect: ?next=… query or location.state.from.
 * Only allow relative same-origin paths (open-redirect safe).
 */
export const getAuthNextPath = (searchParams, locationState) => {
  const fromQuery = searchParams?.get?.('next');
  const fromState = locationState?.from?.pathname
    ? `${locationState.from.pathname}${locationState.from.search || ''}`
    : null;
  const raw = fromQuery || fromState;
  if (!raw || typeof raw !== 'string') return null;
  if (!raw.startsWith('/') || raw.startsWith('//')) return null;
  return raw;
};
