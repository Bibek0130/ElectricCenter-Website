/**
 * JSDoc-only type definitions for the app's core data models (this project
 * does not use TypeScript, so these give editors type-checking/autocomplete
 * without a build-step change).
 */

/**
 * @typedef {Object} PastWork
 * @property {string} title
 * @property {string} description
 * @property {string} image
 * @property {string} date - ISO date string
 */

/**
 * @typedef {Object} Electrician
 * @property {number} id
 * @property {string} name
 * @property {string|null} [photo] - optional; the UI falls back to initials
 * @property {string[]} specialties
 * @property {boolean} [isContractor] - also takes on contracting projects
 * @property {{ amount: number, unit: 'hour'|'visit'|'service' }} rate
 * @property {'High'|'Medium'|'Low'|null} [demand] - optional; badge hidden when absent
 * @property {number} yearsExperience
 * @property {string} location
 * @property {string} whatsappNumber - E.164 international format, e.g. "+9779841445050"
 * @property {string} bio
 * @property {PastWork[]} pastWorks
 * @property {string} version - optimistic-concurrency token; send it back when updating
 * @property {boolean} isDeleted - only ever true in the admin "show deleted" view
 */

/**
 * @typedef {Object} BookingRequest
 * @property {number} electricianId
 * @property {string} problemDescription
 * @property {string} location
 * @property {string} phone
 */

/**
 * @typedef {Object} Booking
 * @property {string} id
 * @property {number} electricianId
 * @property {string} problemDescription
 * @property {string} location
 * @property {string} phone
 * @property {string} createdAt - ISO date string
 * @property {'pending'|'notified'} status
 */

export {};
