import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Button from '../../../components/ui/Button.jsx';
import FormField from '../../../components/ui/FormField.jsx';
import Input from '../../../components/ui/Input.jsx';
import { useFormValidation } from '../../../hooks/useFormValidation.js';
import { useAuth } from '../useAuth.js';
import { PASSWORD_MIN_LENGTH, registerSchema } from '../authValidation.js';
import { safeRedirectPath } from '../redirect.js';

const INITIAL_VALUES = { fullName: '', email: '', phone: '', password: '', confirmPassword: '' };

function RegisterPage() {
    const { register, status, user } = useAuth();
    const location = useLocation();
    const navigate = useNavigate();
    const from = safeRedirectPath(location.state?.from);

    const { values, errors, submitting, submitError, setValue, handleSubmit } = useFormValidation({
        initialValues: INITIAL_VALUES,
        schema: registerSchema,
        onSubmit: async (formValues) => {
            // The account is only created once the emailed code is entered on the next page.
            const verification = await register(formValues);
            toast.success(`We sent a verification code to ${verification.email}.`);
            navigate('/verify-email', { state: { verification, from: location.state?.from } });
        },
    });

    if (status === 'authenticated' && user) return <Navigate to={from} replace />;

    const field = (name, label, props = {}, hint) => (
        <FormField label={label} required={props.required} error={errors[name]} hint={hint}>
            {(fieldProps) => (
                <Input
                    {...fieldProps}
                    {...props}
                    hasError={Boolean(errors[name])}
                    value={values[name]}
                    onChange={(e) => setValue(name, e.target.value)}
                />
            )}
        </FormField>
    );

    return (
        <section className="auth-page">
            <div className="card card-padded auth-card">
                <h1 className="auth-title">Create an account</h1>
                <p className="auth-subtitle">You'll need an account to book an electrician. We'll email you a code to confirm your address.</p>

                <form onSubmit={handleSubmit} noValidate className="auth-form">
                    {field('fullName', 'Full name', { autoComplete: 'name', required: true })}
                    {field('email', 'Email', { type: 'email', autoComplete: 'email', required: true })}
                    {field('phone', 'Phone (optional)', { type: 'tel', autoComplete: 'tel', placeholder: '+977 98XXXXXXXX' }, 'Used to prefill your booking requests.')}
                    {field('password', 'Password', { type: 'password', autoComplete: 'new-password', required: true }, `At least ${PASSWORD_MIN_LENGTH} characters. A short phrase works well.`)}
                    {field('confirmPassword', 'Confirm password', { type: 'password', autoComplete: 'new-password', required: true })}

                    {submitError && <p className="form-error" role="alert">{submitError}</p>}

                    <Button type="submit" block size="lg" loading={submitting} disabled={submitting}>
                        {submitting ? 'Creating account…' : 'Create account'}
                    </Button>
                </form>

                <p className="auth-switch">
                    Already have an account? <Link to="/login" state={location.state}>Log in</Link>
                </p>
            </div>
        </section>
    );
}

export default RegisterPage;
