import { describe, expect, it } from 'vitest';
import { buildBookingMessage, buildWhatsAppLink } from './whatsappService.js';

const electrician = {
    id: 1,
    name: 'Ramesh Shrestha',
    whatsappNumber: '+977 984-144-5050',
};

const booking = {
    phone: '+9779800000000',
    location: 'Kumarigal, Kathmandu',
    problemDescription: 'Living room lights keep flickering.',
    createdAt: '2026-06-15T10:30:00.000Z',
};

describe('buildBookingMessage', () => {
    it('includes the electrician name, customer phone, location and problem', () => {
        const message = buildBookingMessage(electrician, booking);
        expect(message).toContain('Ramesh Shrestha');
        expect(message).toContain(booking.phone);
        expect(message).toContain(booking.location);
        expect(message).toContain(booking.problemDescription);
    });
});

describe('buildWhatsAppLink', () => {
    it('strips everything but digits (keeping a leading +) from the phone number', () => {
        const link = buildWhatsAppLink(electrician, booking);
        expect(link).toMatch(/^https:\/\/wa\.me\/\+9779841445050\?text=/);
    });

    it('URL-encodes the message body', () => {
        const link = buildWhatsAppLink(electrician, booking);
        const [, query] = link.split('?text=');
        expect(decodeURIComponent(query)).toContain(booking.problemDescription);
    });
});
