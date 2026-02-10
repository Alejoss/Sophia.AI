// Use API origin for local media when available; S3 URLs are returned absolute from backend
const apiUrl = typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL;
const origin = apiUrl ? apiUrl.replace(/\/api\/?$/, '') : '';
export const MEDIA_BASE_URL = origin || 'http://localhost:8000'; 