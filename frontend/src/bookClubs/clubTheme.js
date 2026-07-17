export const CLUB_ACCENT = '#FF6B35';
export const CLUB_ACCENT_HOVER = '#E55A2B';
export const CLUB_BG = '#0d0d0d';

/** Shared TextField styles for club dark surfaces (readable labels + orange focus). */
export const CLUB_TEXT_FIELD_SX = {
  '& .MuiOutlinedInput-root': {
    bgcolor: 'rgba(255,255,255,0.06)',
    color: '#fff',
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(255,255,255,0.28)',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgba(255,255,255,0.45)',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: CLUB_ACCENT,
      borderWidth: 1,
    },
  },
  '& .MuiInputLabel-root': {
    color: 'rgba(255,255,255,0.65)',
  },
  '& .MuiInputLabel-root.Mui-focused': {
    color: CLUB_ACCENT,
  },
  // Cover the border behind the floating label so it never strikes through the text.
  '& .MuiInputLabel-root.MuiInputLabel-shrink': {
    backgroundColor: CLUB_BG,
    paddingInline: '6px',
    marginLeft: '-4px',
  },
  '& .MuiFormHelperText-root': {
    color: 'rgba(255,255,255,0.5)',
  },
  '& .MuiFormHelperText-root.Mui-error': {
    color: '#ef9a9a',
  },
  '& .MuiInputBase-input::placeholder': {
    color: 'rgba(255,255,255,0.4)',
    opacity: 1,
  },
};
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

/** Format an ISO datetime for <input type="datetime-local" /> (local wall time). */
export const toDatetimeLocal = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Parse datetime-local value (YYYY-MM-DDTHH:mm) as local time → ISO UTC string.
 * Avoid `new Date(string)` quirks across browsers.
 */
export const toIsoOrNull = (local) => {
  if (!local || typeof local !== 'string') return null;
  const match = local.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/
  );
  if (!match) {
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const [, y, mo, day, h, mi, s] = match;
  const d = new Date(
    Number(y),
    Number(mo) - 1,
    Number(day),
    Number(h),
    Number(mi),
    Number(s || 0)
  );
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

/** Short date range for hub header, e.g. "16 jul – 14 sep 2026". */
export const formatClubDateRange = (startsAt, endsAt) => {
  if (!startsAt && !endsAt) return null;
  const opts = { day: 'numeric', month: 'short', year: 'numeric' };
  const start = startsAt ? formatClubDate(startsAt, opts) : null;
  const end = endsAt ? formatClubDate(endsAt, opts) : null;
  if (start && end) return `${start} – ${end}`;
  if (start) return `Desde ${start}`;
  return `Hasta ${end}`;
};

/** Normalize Telegram invite/group links to a full https URL. */
export const normalizeTelegramUrl = (raw) => {
  const value = (raw || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^(t\.me|telegram\.me)\//i.test(value)) return `https://${value}`;
  if (value.startsWith('@')) return `https://t.me/${value.slice(1)}`;
  if (/^[A-Za-z0-9_]{3,}$/.test(value)) return `https://t.me/${value}`;
  return value;
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
