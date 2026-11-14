import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../../../components/ui/Button.jsx';
import FormField from '../../../components/ui/FormField.jsx';
import Input from '../../../components/ui/Input.jsx';
import { useFormValidation } from '../../../hooks/useFormValidation.js';
import { useAuth } from '../useAuth.js';
import { cleanOtp, OTP_LENGTH, verifyEmailSchema } from '../authValidation.js';
import { safeRedirectPath } from '../redirect.js';

const INITIAL_VALUES = { code: '' };

/** Re-renders every second until `deadlineMs`, returning the whole seconds left (0 when passed). */
function useSecondsUntil(deadlineMs) {
    const [now, setNow] = useState(() => Date.now());
    const remaining = Math.max(0, Math.ceil((deadlineMs - now) / 1000));
    const counting = remaining > 0;

    useEffect(() => {
        if (!counting) return undefined;
        const id = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(id);
    }, [counting, deadlineMs]);

    return remaining;
}

function formatDuration(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : `${seconds}s`;
}

/**
 * Step 2 of sign-up (and of an unverified account's first login): enter the 6-digit
 * code that was emailed. The challenge arrives in router state from the register or
 * login page; it survives a page reload because it lives in the history entry.
 */
function VerifyEmailPage() {
    const { verifyEmail, resendVerification, status, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const from = safeRedirectPath(location.state?.from);
    const verification = location.state?.verification ?? null;
    const [resending, setResending] = useState(false);

    const resendIn = useSecondsUntil(verification?.resendAtMs ?? 0);
    const expiresIn = useSecondsUntil(verification?.expiresAtMs ?? 0);

    const { values, errors, submitting, submitError, setValue, handleSubmit, reset } = useFormValidation({
        initialValues: INITIAL_VALUES,
        schema: verifyEmailSchema,
        onSubmit: async ({ code }) => {
            const verified = await verifyEmail({ verificationId: verification.verificationId, code: cleanOtp(code) });
            toast.success(`Email verified. Welcome, ${verified.fullName.split(' ')[0]}!`);
        },
    });

    if (status === 'authenticated' && user) return <Navigate to={from} replace />;

    if (!verification) {
        return (
            <section className="auth-page">
                <div className="card card-padded auth-card">
                    <h1 className="auth-title">Nothing to verify</h1>
                    <p className="auth-subtitle">This page is reached after you sign up or log in. Start again to get a verification code.</p>
                    <div className="account-actions">
                        <Button as={Link} to="/register">Create an account</Button>
                        <Button as={Link} to="/login" variant="secondary">Log in</Button>
                    </div>
                </div>
            </section>
        );
    }

    const handleResend = async () => {
        setResending(true);
        try {
            const next = await resendVerification(verification.verificationId);
            // Keep the fresh challenge in the history entry so a reload still has it.
            navigate(location.pathname, { replace: true, state: { ...location.state, verification: next } });
            reset();
            toast.success(`A new code was sent to ${next.email}.`);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setResending(false);
        }
    };

    return (
        <section className="auth-page">
            <div className="card card-padded auth-card">
                <h1 className="auth-title">Check your email</h1>
                <p className="auth-subtitle">
                    We sent a {OTP_LENGTH}-digit code to <strong>{verification.email}</strong>. Enter it below to continue.
                </p>

                <form onSubmit={handleSubmit} noValidate className="auth-form">
                    <FormField
                        label="Verification code"
                        required
                        error={errors.code}
                        hint={expiresIn > 0 ? `The code expires in ${formatDuration(expiresIn)}.` : 'This code has expired. Request a new one below.'}
                    >
                        {(fieldProps) => (
                            <Input
                                {...fieldProps}
                                hasError={Boolean(errors.code)}
                                className="otp-input"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={OTP_LENGTH + 2}
                                placeholder={'•'.repeat(OTP_LENGTH)}
                                value={values.code}
                                onChange={(e) => setValue('code', e.target.value.replace(/[^\d\s-]/g, ''))}
                                autoFocus
                                required
                            />
                        )}
                    </FormField>

                    {submitError && <p className="form-error" role="alert">{submitError}</p>}

                    <Button type="submit" block size="lg" loading={submitting} disabled={submitting}>
                        {submitting ? 'Verifying…' : 'Verify email'}
                    </Button>
                </form>

                <p className="auth-switch">
                    Didn't get it? Check your spam folder, or{' '}
                    <button type="button" className="link-button" onClick={handleResend} disabled={resending || resendIn > 0}>
                        {resending ? 'sending…' : resendIn > 0 ? `resend in ${resendIn}s` : 'send a new code'}
                    </button>
                </p>
                <p className="auth-note">
                    Wrong email? <Link to="/register" state={{ from: location.state?.from }}>Start again</Link>
                </p>
            </div>
        </section>
    );
}

export default VerifyEmailPage;
