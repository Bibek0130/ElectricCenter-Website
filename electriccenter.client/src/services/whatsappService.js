import { httpClient } from './httpClient.js';
import { toWhatsAppNumber } from '../utils/format.js';

/**
 * Two notification strategies, selected via VITE_WHATSAPP_STRATEGY:
 *  - "click-to-chat" (default, no backend needed): opens a wa.me deep link
 *    prefilled with the booking details, sent from the *customer's* WhatsApp.
 *  - "cloud-api": calls a server-side endpoint that sends a template message
 *    via the WhatsApp Business Cloud API, so the electrician is notified
 *    automatically without the customer's device. Falls back to
 *    click-to-chat if that call fails or the backend isn't configured.
 */
const STRATEGY = import.meta.env.VITE_WHATSAPP_STRATEGY === 'cloud-api' ? 'cloud-api' : 'click-to-chat';

/** Builds the human-readable booking message sent to the electrician. */
export function buildBookingMessage(electrician, booking) {
    const when = new Date(booking.createdAt || Date.now()).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

    return [
        `New booking request via Panchamukhi Electric Center`,
        ``,
        `Electrician: ${electrician.name}`,
        `Customer phone: ${booking.phone}`,
        `Location: ${booking.location}`,
        `Problem: ${booking.problemDescription}`,
        `Requested: ${when}`,
    ].join('\n');
}

/** Builds a wa.me click-to-chat link prefilled with the booking message. */
export function buildWhatsAppLink(electrician, booking) {
    const number = toWhatsAppNumber(electrician.whatsappNumber);
    const text = encodeURIComponent(buildBookingMessage(electrician, booking));
    return `https://wa.me/${number}?text=${text}`;
}

async function notifyViaCloudApi(electrician, booking) {
    // Only the electrician's id is sent: the server looks up the number to message,
    // so this endpoint can't be used to send WhatsApp messages to arbitrary numbers.
    await httpClient.post('/whatsapp/notify', {
        electricianId: electrician.id,
        booking: {
            customerPhone: booking.phone,
            location: booking.location,
            problem: booking.problemDescription,
        },
    });
}

export const whatsappService = {
    /**
     * @param {import('../types/models.js').Electrician} electrician
     * @param {import('../types/models.js').Booking} booking
     * @returns {Promise<{ channel: 'cloud-api' | 'click-to-chat', link?: string }>}
     */
    async notifyElectrician(electrician, booking) {
        if (STRATEGY === 'cloud-api') {
            try {
                await notifyViaCloudApi(electrician, booking);
                return { channel: 'cloud-api' };
            } catch {
                // WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID missing or the call failed —
                // fall back to click-to-chat so the booking still reaches the electrician.
            }
        }

        const link = buildWhatsAppLink(electrician, booking);
        window.open(link, '_blank', 'noopener,noreferrer');
        return { channel: 'click-to-chat', link };
    },
};
