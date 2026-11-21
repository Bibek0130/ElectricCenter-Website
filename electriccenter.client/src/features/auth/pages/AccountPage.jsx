import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import FormField from '../../../components/ui/FormField.jsx';
import Input from '../../../components/ui/Input.jsx';
import { useFormValidation } from '../../../hooks/useFormValidation.js';
import { useAuth } from '../useAuth.js';
import { changePasswordSchema } from '../authValidation.js';

const PASSWORD_FORM = { currentPassword: '', newPassword: '', confirmPassword: '' };

function ChangePasswordForm() {
    const { changePassword } = useAuth();
    const { values, errors, submitting, submitError, setValue, handleSubmit, reset } = useFormValidation({
        initialValues: PASSWORD_FORM,
        schema: changePasswordSchema,
        onSubmit: async (formValues) => {
            await changePassword(formValues);
            reset();
            toast.success('Password changed. Other devices have been signed out.');
        },
    });

    const field = (name, label, autoComplete) => (
        <FormField label={label} required error={errors[name]}>
            {(fieldProps) => (
                <Input
                    {...fieldProps}
                    hasError={Boolean(errors[name])}
                    type="password"
                    autoComplete={autoComplete}
                    value={values[name]}
                    onChange={(e) => setValue(name, e.target.value)}
                    required
                />
            )}
        </FormField>
    );

    return (
        <form onSubmit={handleSubmit} noValidate className="auth-form">
            {field('currentPassword', 'Current password', 'current-password')}
            {field('newPassword', 'New password', 'new-password')}
            {field('confirmPassword', 'Confirm new password', 'new-password')}
            {submitError && <p className="form-error" role="alert">{submitError}</p>}
            <Button type="submit" loading={submitting} disabled={submitting}>
                {submitting ? 'Saving…' : 'Change password'}
            </Button>
        </form>
    );
}

function AccountPage() {
    const { user, logout, logoutAllDevices } = useAuth();
    const navigate = useNavigate();
    const [signingOutEverywhere, setSigningOutEverywhere] = useState(false);

    const handleLogout = async () => {
        navigate('/', { replace: true });
        await logout();
        toast.success('You have been logged out.');
    };

    const handleLogoutEverywhere = async () => {
        setSigningOutEverywhere(true);
        try {
            await logoutAllDevices();
            navigate('/', { replace: true });
            toast.success('Signed out on all devices.');
        } catch (err) {
            toast.error(err.message);
            setSigningOutEverywhere(false);
        }
    };

    return (
        <section className="account-page">
            <h1 style={{ marginBottom: 'var(--space-6)' }}>My account</h1>

            <div className="account-grid">
                <div className="card card-padded">
                    <h2 className="account-heading">Profile</h2>
                    <dl className="account-details">
                        <dt>Name</dt>
                        <dd>{user.fullName}</dd>
                        <dt>Email</dt>
                        <dd>{user.email}</dd>
                        <dt>Phone</dt>
                        <dd>{user.phone || '—'}</dd>
                        <dt>Roles</dt>
                        <dd style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {user.roles.map((role) => (
                                <Badge key={role} variant="primary">{role}</Badge>
                            ))}
                        </dd>
                    </dl>

                    <div className="account-actions">
                        <Button variant="secondary" onClick={handleLogout}>Log out</Button>
                        <Button variant="ghost" onClick={handleLogoutEverywhere} loading={signingOutEverywhere} disabled={signingOutEverywhere}>
                            Log out of all devices
                        </Button>
                    </div>
                </div>

                <div className="card card-padded">
                    <h2 className="account-heading">Change password</h2>
                    <ChangePasswordForm />
                </div>
            </div>
        </section>
    );
}

export default AccountPage;
