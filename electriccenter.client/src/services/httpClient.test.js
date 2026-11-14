import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./authHttpClient.js', () => ({
    API_BASE_URL: '/api',
    SPA_HEADERS: { 'X-Requested-With': 'XMLHttpRequest' },
    authHttpClient: { post: vi.fn() },
}));

const { authHttpClient } = await import('./authHttpClient.js');
const session = await import('../features/auth/session.js');
const { httpClient } = await import('./httpClient.js');

const USER = { id: 'u1', email: 'a@example.com', fullName: 'A User', phone: null, roles: ['Customer'] };

/** Fake transport: records the Authorization header of each attempt and replies from a script. */
function scriptedAdapter(replies) {
    const seenAuthHeaders = [];
    const adapter = async (config) => {
        seenAuthHeaders.push(config.headers.Authorization ?? null);
        const status = replies.shift();
        const response = { status, data: { status }, headers: {}, config, statusText: String(status) };
        if (status >= 400) {
            const error = new Error(`HTTP ${status}`);
            error.config = config;
            error.response = response;
            throw error;
        }
        return response;
    };
    return { adapter, seenAuthHeaders };
}

describe('httpClient auth interceptors', () => {
    beforeEach(() => {
        session.__resetSessionForTests();
        authHttpClient.post.mockReset();
    });

    it('sends the SPA header and the in-memory access token', async () => {
        session.applySession({ accessToken: 'jwt-1', user: USER });
        const { adapter, seenAuthHeaders } = scriptedAdapter([200]);

        const response = await httpClient.get('/anything', { adapter });

        expect(seenAuthHeaders).toEqual(['Bearer jwt-1']);
        expect(response.config.headers['X-Requested-With']).toBe('XMLHttpRequest');
    });

    it('refreshes once on 401 and retries with the new token', async () => {
        session.applySession({ accessToken: 'expired', user: USER });
        authHttpClient.post.mockResolvedValue({ data: { accessToken: 'fresh', user: USER } });
        const { adapter, seenAuthHeaders } = scriptedAdapter([401, 200]);

        const response = await httpClient.get('/protected', { adapter });

        expect(response.status).toBe(200);
        expect(authHttpClient.post).toHaveBeenCalledTimes(1);
        expect(seenAuthHeaders).toEqual(['Bearer expired', 'Bearer fresh']);
    });

    it('gives up (and signs out) when the refresh fails', async () => {
        session.applySession({ accessToken: 'expired', user: USER });
        authHttpClient.post.mockRejectedValue({ response: { status: 401 } });
        const { adapter } = scriptedAdapter([401]);

        await expect(httpClient.get('/protected', { adapter })).rejects.toMatchObject({ response: { status: 401 } });
        expect(session.getAuthState().status).toBe('unauthenticated');
    });

    it('does not loop when the retried request is still unauthorized', async () => {
        session.applySession({ accessToken: 'expired', user: USER });
        authHttpClient.post.mockResolvedValue({ data: { accessToken: 'fresh', user: USER } });
        const { adapter } = scriptedAdapter([401, 401]);

        await expect(httpClient.get('/protected', { adapter })).rejects.toMatchObject({ response: { status: 401 } });
        expect(authHttpClient.post).toHaveBeenCalledTimes(1);
    });

    it('does not try to refresh for anonymous requests', async () => {
        const { adapter } = scriptedAdapter([401]);

        await expect(httpClient.get('/protected', { adapter })).rejects.toMatchObject({ response: { status: 401 } });
        expect(authHttpClient.post).not.toHaveBeenCalled();
    });
});
