// Use API origin for local media when available; S3 URLs are returned absolute from backend
const apiUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL;
const originFromEnv = apiUrl && /^https?:\/\//i.test(apiUrl) ? apiUrl.replace(/\/api\/?$/, '') : '';
const originFromBrowser =
  typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
export const MEDIA_BASE_URL = originFromEnv || originFromBrowser || 'http://localhost:8000'; 