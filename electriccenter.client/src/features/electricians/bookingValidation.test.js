import { describe, expect, it } from 'vitest';
import { bookingSchema } from './bookingValidation.js';

function validateAll(values) {
    const errors = {};
    for (const field of Object.keys(bookingSchema)) {
        const message = bookingSchema[field](values[field], values);
        if (message) errors[field] = message;
    }
    return errors;
}

describe('booking form validation schema', () => {
    it('rejects an empty submission with one error per field', () => {
        const errors = validateAll({ problemDescription: '', location: '', phone: '' });
        expect(errors.problemDescription).toBeTruthy();
        expect(errors.location).toBeTruthy();
        expect(errors.phone).toBeTruthy();
    });

    it('rejects a problem description that is too short', () => {
        const errors = validateAll({ problemDescription: 'lights broke', location: 'Kumarigal', phone: '+9779841445050' });
        expect(errors.problemDescription).toMatch(/at least 15 characters/);
    });

    it('rejects an invalid phone number', () => {
        const errors = validateAll({
            problemDescription: 'Living room lights keep flickering all night.',
            location: 'Kumarigal, Kathmandu',
            phone: 'not a phone',
        });
        expect(errors.phone).toBeTruthy();
    });

    it('passes for a fully valid booking', () => {
        const errors = validateAll({
            problemDescription: 'Living room lights keep flickering and one socket stopped working.',
            location: 'Kumarigal, Kathmandu',
            phone: '+977 9841445050',
        });
        expect(errors).toEqual({});
    });
});
