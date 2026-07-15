export const CLUB_ACCENT = '#FF6B35';
export const CLUB_ACCENT_HOVER = '#E55A2B';
export const CLUB_BG = '#0d0d0d';

export const STATUS_LABELS = {
  draft: 'Borrador',
  active: 'Activo',
  closed: 'Cerrado',
};

export const formatClubDate = (value, opts = { dateStyle: 'medium', timeStyle: 'short' }) => {
  if (!value) return null;
  try {
    return new Date(value).toLocaleString('es-ES', opts);
  } catch {
    return value;
  }
};

export const toDatetimeLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const toIsoOrNull = (local) => {
  if (!local) return null;
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
};

export const extractApiError = (err, fallback = 'Algo salió mal.') => {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (typeof data.detail === 'string') return data.detail;
  if (typeof data === 'string') return data;
  const firstKey = Object.keys(data)[0];
  if (firstKey) {
    const val = data[firstKey];
    if (Array.isArray(val)) return `${firstKey}: ${val[0]}`;
    if (typeof val === 'string') return `${firstKey}: ${val}`;
  }
  return fallback;
};
