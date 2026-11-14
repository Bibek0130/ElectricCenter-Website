import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/authHttpClient.js', () => ({
    API_BASE_URL: '/api',
    SPA_HEADERS: { 'X-Requested-With': 'XMLHttpRequest' },
    authHttpClient: { post: vi.fn() },
}));

const { authHttpClient } = await import('../../services/authHttpClient.js');
const session = await import('./session.js');

const USER = { id: 'u1', email: 'a@example.com', fullName: 'A User', phone: null, roles: ['Customer'] };

function memoryStorage(initial = {}) {
    const data = { ...initial };
    return {
        getItem: (key) => (key in data ? data[key] : null),
        setItem: (key, value) => {
            data[key] = String(value);
        },
        removeItem: (key) => {
            delete data[key];
        },
        data,
    };
}

describe('session', () => {
    beforeEach(() => {
        session.__resetSessionForTests();
        authHttpClient.post.mockReset();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('stores the access token in memory and marks the user authenticated', () => {
        const storage = memoryStorage();
        vi.stubGlobal('localStorage', storage);

        session.applySession({ accessToken: 'jwt-1', user: USER });

        expect(session.getAccessToken()).toBe('jwt-1');
        expect(session.getAuthState()).toEqual({ status: 'authenticated', user: USER });
        // Only a non-secret hint goes to storage, never the token.
        expect(Object.values(storage.data)).not.toContain('jwt-1');
    });

    it('shares one refresh request between concurrent callers', async () => {
        let resolve;
        authHttpClient.post.mockReturnValue(new Promise((r) => (resolve = r)));

        const first = session.refreshSession();
        const second = session.refreshSession();
        resolve({ data: { accessToken: 'jwt-2', user: USER } });

        await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
        expect(authHttpClient.post).toHaveBeenCalledTimes(1);
        expect(authHttpClient.post).toHaveBeenCalledWith('/auth/refresh');
        expect(session.getAccessToken()).toBe('jwt-2');
    });

    it('clears the session when the refresh is rejected', async () => {
        session.applySession({ accessToken: 'old', user: USER });
        authHttpClient.post.mockRejectedValue({ response: { status: 401 } });

        await expect(session.refreshSession()).resolves.toBe(false);

        expect(session.getAccessToken()).toBeNull();
        expect(session.getAuthState().status).toBe('unauthenticated');
    });

    it('skips the refresh call on start-up when this browser has never signed in', async () => {
        vi.stubGlobal('localStorage', memoryStorage());

        await expect(session.restoreSession()).resolves.toBe(false);

        expect(authHttpClient.post).not.toHaveBeenCalled();
        expect(session.getAuthState().status).toBe('unauthenticated');
    });

    it('restores the session on start-up when this browser has signed in before', async () => {
        vi.stubGlobal('localStorage', memoryStorage({ ec_has_session: '1' }));
        authHttpClient.post.mockResolvedValue({ data: { accessToken: 'jwt-3', user: USER } });

        await expect(session.restoreSession()).resolves.toBe(true);

        expect(session.getAuthState()).toEqual({ status: 'authenticated', user: USER });
    });

    it('notifies subscribers on every change', () => {
        const listener = vi.fn();
        const unsubscribe = session.subscribe(listener);

        session.applySession({ accessToken: 'x', user: USER });
        session.clearSession();
        unsubscribe();
        session.applySession({ accessToken: 'y', user: USER });

        expect(listener).toHaveBeenCalledTimes(2);
    });
});
