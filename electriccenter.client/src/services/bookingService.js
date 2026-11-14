const STORAGE_KEY = 'ec_bookings';
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function readBookings() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
        return [];
    }
}

/**
 * Mock-backed booking store (persists to localStorage so a booking survives
 * a refresh during development/demo). Swap `createBooking` for a real POST
 * to `/bookings` once a backend endpoint exists — callers (hooks) don't
 * need to change.
 */
export const bookingService = {
    /** @param {import('../types/models.js').BookingRequest} request */
    async createBooking(request) {
        await delay(500);
        /** @type {import('../types/models.js').Booking} */
        const booking = {
            id: `BK-${Date.now().toString(36).toUpperCase()}`,
            ...request,
            createdAt: new Date().toISOString(),
            status: 'pending',
        };
        const bookings = readBookings();
        bookings.push(booking);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(bookings));
        return booking;
    },
};
