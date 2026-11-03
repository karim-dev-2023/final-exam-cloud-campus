// REACT_APP_API_URL is the backend origin, without /api.
const backendUrl = process.env.REACT_APP_API_URL ||
  (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5000');

if (!backendUrl.trim()) {
  throw new Error('REACT_APP_API_URL must be set for production builds.');
}

export const API_BASE_URL = `${backendUrl.trim().replace(/\/+$/, '')}/api`;
