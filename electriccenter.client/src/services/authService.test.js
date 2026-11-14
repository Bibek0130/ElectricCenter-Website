import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./authHttpClient.js', () => ({
    API_BASE_URL: '/api',
    SPA_HEADERS: { 'X-Requested-With': 'XMLHttpRequest' },
    authHttpClient: { post: vi.fn() },
}));

const { authHttpClient } = await import('./authHttpClient.js');
const session = await import('../features/auth/session.js');
const { authService, EmailVerificationRequiredError, toUserError } = await import('./authService.js');

const USER = { id: 'u1', email: 'new@example.com', fullName: 'New Person', phone: null, roles: ['Customer'] };
const CHALLENGE = { verificationId: 'vid-1', email: 'new@example.com', expiresInSeconds: 600, resendAfterSeconds: 60 };

describe('authService email verification', () => {
    beforeEach(() => {
        session.__resetSessionForTests();
        authHttpClient.post.mockReset();
    });

    it('register returns the OTP challenge with local deadlines and does not sign in', async () => {
        authHttpClient.post.mockResolvedValue({ data: { code: 'verification_sent', verification: CHALLENGE } });
        const before = Date.now();

        const verification = await authService.register({ fullName: 'New Person', email: 'new@example.com', phone: ' ', password: 'long enough' });

        expect(authHttpClient.post).toHaveBeenCalledWith('/auth/register', { fullName: 'New Person', email: 'new@example.com', phone: null, password: 'long enough' });
        expect(verification.verificationId).toBe('vid-1');
        expect(verification.resendAtMs).toBeGreaterThanOrEqual(before + 60_000);
        expect(verification.expiresAtMs).toBeGreaterThanOrEqual(before + 600_000);
        expect(session.getAccessToken()).toBeNull();
    });

    it('login for an unverified account throws EmailVerificationRequiredError carrying the challenge', async () => {
        authHttpClient.post.mockRejectedValue({
            response: { status: 403, data: { code: 'email_not_verified', message: 'Please verify your email first.', verification: CHALLENGE } },
        });

        const error = await authService.login({ email: 'new@example.com', password: 'pw' }).catch((e) => e);

        expect(error).toBeInstanceOf(EmailVerificationRequiredError);
        expect(error.message).toBe('Please verify your email first.');
        expect(error.verification.verificationId).toBe('vid-1');
        expect(typeof error.verification.resendAtMs).toBe('number');
        expect(session.getAccessToken()).toBeNull();
    });

    it('verifyEmail signs the user in', async () => {
        authHttpClient.post.mockResolvedValue({ data: { accessToken: 'jwt', user: USER } });

        const user = await authService.verifyEmail({ verificationId: 'vid-1', code: '123456' });

        expect(authHttpClient.post).toHaveBeenCalledWith('/auth/verify-email', { verificationId: 'vid-1', code: '123456' });
        expect(user).toEqual(USER);
        expect(session.getAuthState()).toEqual({ status: 'authenticated', user: USER });
    });

    it('surfaces the server message for a wrong code', async () => {
        authHttpClient.post.mockRejectedValue({ response: { status: 400, data: { message: 'That code is incorrect. 4 attempts left.' } } });

        await expect(authService.verifyEmail({ verificationId: 'vid-1', code: '000000' })).rejects.toThrow('That code is incorrect. 4 attempts left.');
    });
});

describe('toUserError', () => {
    it('prefers the server message, even for 429 (e.g. a resend cooldown)', () => {
        expect(toUserError({ response: { status: 429, data: { message: 'Please wait 42 seconds before requesting another code.' } } }).message)
            .toBe('Please wait 42 seconds before requesting another code.');
        expect(toUserError({ response: { status: 429, data: {} } }).message).toMatch(/Too many attempts/);
        expect(toUserError({}).message).toMatch(/Can't reach the server/);
    });
});
