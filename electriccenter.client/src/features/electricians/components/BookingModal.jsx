import { useState } from 'react';
import Modal from '../../../components/ui/Modal.jsx';
import { useAuth } from '../../auth/useAuth.js';
import Button from '../../../components/ui/Button.jsx';
import FormField from '../../../components/ui/FormField.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import { useFormValidation } from '../../../hooks/useFormValidation.js';
import { useBooking } from '../hooks/useBooking.js';
import { bookingSchema, DEFAULT_COUNTRY_CODE } from '../bookingValidation.js';

/** @param {{ open: boolean, onClose: () => void, electrician: import('../../../types/models.js').Electrician }} props */
function BookingModal({ open, onClose, electrician }) {
    const { user } = useAuth();
    const { submitBooking, status, error, reset } = useBooking(electrician);
    const [initialValues] = useState(() => ({
        problemDescription: '',
        location: '',
        // Prefill from the signed-in user's account when they gave a phone number.
        phone: user?.phone || DEFAULT_COUNTRY_CODE + ' ',
    }));
    const { values, errors, submitting, setValue, handleSubmit, reset: resetForm } = useFormValidation({
        initialValues,
        schema: bookingSchema,
        onSubmit: submitBooking,
    });

    const handleClose = () => {
        onClose();
        // Give the close animation a moment before wiping state.
        setTimeout(() => {
            reset();
            resetForm();
        }, 200);
    };

    if (status === 'success') {
        return (
            <Modal open={open} onClose={handleClose} title="Booking sent!" size="sm">
                <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
                    <div style={{ fontSize: 40, marginBottom: 'var(--space-3)' }} aria-hidden="true">✅</div>
                    <p style={{ marginBottom: 'var(--space-2)' }}>
                        <strong>{electrician.name}</strong> has been notified over WhatsApp with your job details.
                    </p>
                    <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
                        They typically respond within a couple of hours. You can also message them directly if you don't hear back.
                    </p>
                    <Button block onClick={handleClose}>Done</Button>
                </div>
            </Modal>
        );
    }

    return (
        <Modal open={open} onClose={handleClose} title={`Book ${electrician.name}`} size="sm">
            <form onSubmit={handleSubmit} noValidate>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
                    <FormField label="Problem description" required error={errors.problemDescription} hint="What's going on? The more detail, the better the quote.">
                        {(fieldProps) => (
                            <Textarea
                                {...fieldProps}
                                hasError={Boolean(errors.problemDescription)}
                                value={values.problemDescription}
                                onChange={(e) => setValue('problemDescription', e.target.value)}
                                placeholder="e.g. Living room lights keep flickering and one socket stopped working"
                                rows={4}
                                required
                            />
                        )}
                    </FormField>

                    <FormField label="Location / address" required error={errors.location}>
                        {(fieldProps) => (
                            <Input
                                {...fieldProps}
                                hasError={Boolean(errors.location)}
                                value={values.location}
                                onChange={(e) => setValue('location', e.target.value)}
                                placeholder="e.g. Kumarigal, Kathmandu"
                                required
                            />
                        )}
                    </FormField>

                    <FormField label="Phone number" required error={errors.phone} hint={`Include country code, e.g. ${DEFAULT_COUNTRY_CODE} 98XXXXXXXX`}>
                        {(fieldProps) => (
                            <Input
                                {...fieldProps}
                                hasError={Boolean(errors.phone)}
                                type="tel"
                                value={values.phone}
                                onChange={(e) => setValue('phone', e.target.value)}
                                required
                            />
                        )}
                    </FormField>

                    {status === 'error' && (
                        <p className="form-error" role="alert">{error}</p>
                    )}

                    <Button type="submit" block loading={submitting} disabled={submitting}>
                        {status === 'error' ? 'Retry booking' : submitting ? 'Sending…' : 'Send booking request'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

export default BookingModal;
