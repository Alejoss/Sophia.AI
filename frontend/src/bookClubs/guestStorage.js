const guestKey = (slug) => `bookclub_guest:${slug}`;

export const getGuestSession = (slug) => {
  try {
    const raw = localStorage.getItem(guestKey(slug));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return null;
    return { token: parsed.token, email: parsed.email || '' };
  } catch {
    return null;
  }
};

export const setGuestSession = (slug, { token, email }) => {
  localStorage.setItem(guestKey(slug), JSON.stringify({ token, email }));
};

export const clearGuestSession = (slug) => {
  localStorage.removeItem(guestKey(slug));
};

export const guestCompleteAccountUrl = (slug, token) => {
  const next = encodeURIComponent(`/club-de-lectura/${slug}`);
  const t = encodeURIComponent(token);
  return `/profiles/completar-cuenta?token=${t}&next=${next}`;
};
