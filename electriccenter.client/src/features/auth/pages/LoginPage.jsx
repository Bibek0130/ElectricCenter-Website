import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { EmailVerificationRequiredError } from '../../../services/authService.js';
import Button from '../../../components/ui/Button.jsx';
import FormField from '../../../components/ui/FormField.jsx';
import Input from '../../../components/ui/Input.jsx';
import { useFormValidation } from '../../../hooks/useFormValidation.js';
import { useAuth } from '../useAuth.js';
import { loginSchema } from '../authValidation.js';
import { safeRedirectPath } from '../redirect.js';

const INITIAL_VALUES = { email: '', password: '' };

function LoginPage() {
    const { login, status, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const from = safeRedirectPath(location.state?.from);

    const { values, errors, submitting, submitError, setValue, handleSubmit } = useFormValidation({
        initialValues: INITIAL_VALUES,
        schema: loginSchema,
        onSubmit: async (formValues) => {
            try {
                const signedIn = await login(formValues);
                toast.success(`Welcome back, ${signedIn.fullName.split(' ')[0]}!`);
            } catch (err) {
                if (!(err instanceof EmailVerificationRequiredError)) throw err;
                // Right password, but the email was never verified (e.g. an account the admin created).
                toast(err.message, { icon: '✉️' });
                navigate('/verify-email', { state: { verification: err.verification, from: location.state?.from } });
            }
        },
    });

    // Already signed in (or just signed in): go where the user was headed.
    if (status === 'authenticated' && user) return <Navigate to={from} replace />;

    return (
        <section className="auth-page">
            <div className="card card-padded auth-card">
                <h1 className="auth-title">Log in</h1>
                <p className="auth-subtitle">
                    {location.state?.from ? 'Log in to continue.' : 'Welcome back to Panchamukhi Electric Center.'}
                </p>

                <form onSubmit={handleSubmit} noValidate className="auth-form">
                    <FormField label="Email" required error={errors.email}>
                        {(fieldProps) => (
                            <Input
                                {...fieldProps}
                                hasError={Boolean(errors.email)}
                                type="email"
                                autoComplete="email"
                                value={values.email}
                                onChange={(e) => setValue('email', e.target.value)}
                                required
                            />
                        )}
                    </FormField>

                    <FormField label="Password" required error={errors.password}>
                        {(fieldProps) => (
                            <Input
                                {...fieldProps}
                                hasError={Boolean(errors.password)}
                                type="password"
                                autoComplete="current-password"
                                value={values.password}
                                onChange={(e) => setValue('password', e.target.value)}
                                required
                            />
                        )}
                    </FormField>

                    {submitError && <p className="form-error" role="alert">{submitError}</p>}

                    <Button type="submit" block size="lg" loading={submitting} disabled={submitting}>
                        {submitting ? 'Logging in…' : 'Log in'}
                    </Button>
                </form>

                <p className="auth-switch">
                    New here? <Link to="/register" state={location.state}>Create an account</Link>
                </p>
                <p className="auth-note">Electricians: your account is set up by the Electric Center. Ask the admin if you don't have one.</p>
            </div>
        </section>
    );
}

export default LoginPage;
