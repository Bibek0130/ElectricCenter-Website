import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

/**
 * Sent on every API call. The server requires it on the cookie-authenticated
 * /auth endpoints as a CSRF guard (a cross-site form can't set custom headers).
 */
export const SPA_HEADERS = { 'X-Requested-With': 'XMLHttpRequest' };

/**
 * Plain axios instance for the /auth endpoints (login, register, refresh, logout).
 * Deliberately has no interceptors, so a failing refresh can't trigger another refresh.
 * The refresh token travels only as an HttpOnly cookie the browser attaches itself.
 */
export const authHttpClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: SPA_HEADERS,
});
