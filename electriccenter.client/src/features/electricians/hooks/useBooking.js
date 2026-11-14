import { useCallback, useState } from 'react';
import { bookingService } from '../../../services/bookingService.js';
import { whatsappService } from '../../../services/whatsappService.js';

/**
 * Places a booking for the given electrician and notifies them over
 * WhatsApp (strategy chosen inside whatsappService). Exposes submission
 * status so the booking modal can show a spinner / success / retry state.
 * @param {import('../../../types/models.js').Electrician} electrician
 */
export function useBooking(electrician) {
    const [status, setStatus] = useState('idle'); // idle | submitting | success | error
    const [error, setError] = useState(null);

    const submitBooking = useCallback(
        async (values) => {
            setStatus('submitting');
            setError(null);
            try {
                const booking = await bookingService.createBooking({
                    electricianId: electrician.id,
                    problemDescription: values.problemDescription,
                    location: values.location,
                    phone: values.phone,
                });
                await whatsappService.notifyElectrician(electrician, booking);
                setStatus('success');
                return booking;
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not send your booking. Please try again.');
                setStatus('error');
                return null;
            }
        },
        [electrician]
    );

    const reset = useCallback(() => {
        setStatus('idle');
        setError(null);
    }, []);

    return { submitBooking, status, error, reset };
}
