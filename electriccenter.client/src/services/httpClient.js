import axios from 'axios';
import { API_BASE_URL, SPA_HEADERS } from './authHttpClient.js';
import { getAccessToken, refreshSession } from '../features/auth/session.js';

/**
 * Shared axios instance for real backend calls. Base URL points at the
 * ASP.NET Core API this SPA is hosted alongside (see vite.config.js proxy
 * / launchSettings for the dev port).
 *
 * Attaches the in-memory access token as a Bearer header. On a 401 it refreshes
 * the session once (via the HttpOnly refresh cookie) and retries the request.
 */
export const httpClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000,
    headers: SPA_HEADERS,
});

httpClient.interceptors.request.use((config) => {
    const token = getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
});

httpClient.interceptors.response.use(undefined, async (error) => {
    const original = error.config;
    const expiredSession = error.response?.status === 401 && getAccessToken();
    if (!expiredSession || !original || original._authRetried) {
        return Promise.reject(error);
    }

    original._authRetried = true;
    const refreshed = await refreshSession();
    return refreshed ? httpClient(original) : Promise.reject(error);
});
