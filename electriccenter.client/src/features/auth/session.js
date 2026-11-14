import { authHttpClient } from '../../services/authHttpClient.js';

/**
 * Client-side session store.
 *
 * - The access token (JWT, ~15 min) lives only in this module's memory: never in
 *   localStorage, so injected scripts can't lift it from storage.
 * - The refresh token is an HttpOnly cookie the server sets; JS never sees it.
 *   `refreshSession()` trades it for a new access token (on page load and on 401s).
 * - A non-secret localStorage hint remembers "this browser has signed in", so
 *   anonymous visitors don't fire a pointless refresh request on every page load.
 */

/** @typedef {{ id: string, email: string, fullName: string, phone: string|null, roles: string[] }} AuthUser */
/** @typedef {{ status: 'loading'|'authenticated'|'unauthenticated', user: AuthUser|null }} AuthState */

const SESSION_HINT_KEY = 'ec_has_session';
const REFRESH_LOCK = 'ec-auth-refresh';

let accessToken = null;
/** @type {AuthState} */
let state = { status: 'loading', user: null };
const listeners = new Set();
let refreshPromise = null;
let restorePromise = null;

const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('ec-auth') : null;
// Node (tests) keeps the process alive while a channel is open; browsers have no unref.
channel?.unref?.();

function setState(next) {
    state = next;
    listeners.forEach((listener) => listener());
}

function writeSessionHint(present) {
    try {
        if (present) localStorage.setItem(SESSION_HINT_KEY, '1');
        else localStorage.removeItem(SESSION_HINT_KEY);
    } catch {
        // Storage blocked (private mode etc.): we just lose the optimization.
    }
}

function readSessionHint() {
    try {
        return localStorage.getItem(SESSION_HINT_KEY) === '1';
    } catch {
        return true; // can't tell, so try the refresh
    }
}

export function getAccessToken() {
    return accessToken;
}

/** @returns {AuthState} */
export function getAuthState() {
    return state;
}

export function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

/** Stores a session returned by login/register/refresh/change-password. */
export function applySession(data, { broadcast = false } = {}) {
    accessToken = data.accessToken;
    writeSessionHint(true);
    setState({ status: 'authenticated', user: data.user });
    if (broadcast) channel?.postMessage({ type: 'login' });
}

export function clearSession({ broadcast = false } = {}) {
    accessToken = null;
    writeSessionHint(false);
    setState({ status: 'unauthenticated', user: null });
    if (broadcast) channel?.postMessage({ type: 'logout' });
}

function withCrossTabLock(task) {
    // Web Locks serialize refreshes across tabs, so two tabs never present the same
    // refresh cookie at once (which would look like token theft to the server).
    if (typeof navigator !== 'undefined' && navigator.locks?.request) {
        return navigator.locks.request(REFRESH_LOCK, task);
    }
    return task();
}

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers in this tab
 * share one request. Resolves true when a session is active afterwards.
 * @returns {Promise<boolean>}
 */
export function refreshSession() {
    if (!refreshPromise) {
        refreshPromise = withCrossTabLock(async () => {
            try {
                const { data } = await authHttpClient.post('/auth/refresh');
                applySession(data);
                return true;
            } catch {
                clearSession();
                return false;
            }
        }).finally(() => {
            refreshPromise = null;
        });
    }
    return refreshPromise;
}

/** Called once on app start to pick up an existing session from the refresh cookie. */
export function restoreSession() {
    if (!restorePromise) {
        restorePromise = readSessionHint() ? refreshSession() : Promise.resolve((clearSession(), false));
    }
    return restorePromise;
}

channel?.addEventListener('message', (event) => {
    if (event.data?.type === 'logout') clearSession();
    // Another tab signed in (the shared cookie changed): pick up that session here too.
    else if (event.data?.type === 'login') refreshSession();
});

/** Test-only: reset module state between tests. */
export function __resetSessionForTests() {
    accessToken = null;
    state = { status: 'loading', user: null };
    refreshPromise = null;
    restorePromise = null;
    listeners.clear();
}
