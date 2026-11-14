import { authHttpClient } from './authHttpClient.js';
import { httpClient } from './httpClient.js';
import { applySession, clearSession } from '../features/auth/session.js';
import { callApi, toUserError } from './apiError.js';

/**
 * @typedef {{ verificationId: string, email: string, expiresInSeconds: number, resendAfterSeconds: number, expiresAtMs: number, resendAtMs: number }} Verification
 */

/**
 * Converts the server's relative timings into local deadlines, so countdowns work
 * even when this device's clock disagrees with the server's.
 * @returns {Verification}
 */
function withLocalDeadlines(verification) {
    const now = Date.now();
    return {
        ...verification,
        expiresAtMs: now + verification.expiresInSeconds * 1000,
        resendAtMs: now + verification.resendAfterSeconds * 1000,
    };
}

/** Thrown by login() when the password was right but the email still has to be verified with an OTP. */
export class EmailVerificationRequiredError extends Error {
    /** @param {string} message @param {Verification} verification */
    constructor(message, verification) {
        super(message);
        this.name = 'EmailVerificationRequiredError';
        this.verification = verification;
    }
}

export { toUserError };

const call = callApi;

export const authService = {
    /**
     * Signs in. Throws EmailVerificationRequiredError (with the OTP challenge) for an
     * account whose email hasn't been verified yet; a code has already been emailed.
     * @param {{ email: string, password: string }} values
     */
    async login({ email, password }) {
        let data;
        try {
            ({ data } = await authHttpClient.post('/auth/login', { email, password }));
        } catch (err) {
            const body = err?.response?.data;
            if (err?.response?.status === 403 && body?.code === 'email_not_verified' && body.verification) {
                throw new EmailVerificationRequiredError(body.message, withLocalDeadlines(body.verification));
            }
            throw toUserError(err, 'Could not log in.');
        }
        applySession(data, { broadcast: true });
        return data.user;
    },

    /**
     * Starts sign-up. No account or session exists yet: the server emails a 6-digit code,
     * and the returned challenge is passed to verifyEmail().
     * @param {{ fullName: string, email: string, phone?: string, password: string }} values
     * @returns {Promise<Verification>}
     */
    async register({ fullName, email, phone, password }) {
        const { data } = await call(
            () => authHttpClient.post('/auth/register', { fullName, email, phone: phone?.trim() || null, password }),
            'Could not create your account.'
        );
        return withLocalDeadlines(data.verification);
    },

    /**
     * Completes sign-up (or a first login) with the emailed code and signs the user in.
     * @param {{ verificationId: string, code: string }} values
     */
    async verifyEmail({ verificationId, code }) {
        const { data } = await call(() => authHttpClient.post('/auth/verify-email', { verificationId, code }), 'Could not verify the code.');
        applySession(data, { broadcast: true });
        return data.user;
    },

    /** @param {string} verificationId @returns {Promise<Verification>} */
    async resendVerification(verificationId) {
        const { data } = await call(() => authHttpClient.post('/auth/resend-verification', { verificationId }), 'Could not send a new code.');
        return withLocalDeadlines(data);
    },

    async logout() {
        try {
            await authHttpClient.post('/auth/logout');
        } catch {
            // Even if the server call fails, forget the session locally.
        } finally {
            clearSession({ broadcast: true });
        }
    },

    async logoutAllDevices() {
        await call(() => httpClient.post('/auth/logout-all'), 'Could not sign out other devices.');
        clearSession({ broadcast: true });
    },

    /** @param {{ currentPassword: string, newPassword: string }} values */
    async changePassword({ currentPassword, newPassword }) {
        const { data } = await call(() => httpClient.post('/auth/change-password', { currentPassword, newPassword }), 'Could not change your password.');
        // The server signed out every other session and issued this one a fresh token.
        applySession(data, { broadcast: true });
        return data.user;
    },
};
