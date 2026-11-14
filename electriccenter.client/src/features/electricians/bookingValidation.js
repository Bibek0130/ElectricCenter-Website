import { all, isPhone, minLength, required } from '../../utils/validators.js';

/** Nepal's country code, prefilled into the booking form's phone field. Change here if this deploys to another country. */
export const DEFAULT_COUNTRY_CODE = '+977';

/** Validation schema for the booking modal's form, shared with its tests. */
export const bookingSchema = {
    problemDescription: all(required('Please describe the problem'), minLength(15, 'Please add a bit more detail (at least 15 characters)')),
    location: required('Please add your location or address'),
    phone: all(required('A phone number is required'), isPhone('Enter a valid phone number')),
};
