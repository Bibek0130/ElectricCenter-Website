/** Basic international-friendly phone check: optional leading +, 7-15 digits. */
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;

export function required(message = 'This field is required') {
    return (value) => (value == null || String(value).trim() === '' ? message : undefined);
}

export function minLength(min, message = `Must be at least ${min} characters`) {
    return (value) => (String(value || '').trim().length < min ? message : undefined);
}

export function isPhone(message = 'Enter a valid phone number') {
    return (value) => (PHONE_PATTERN.test(String(value || '').replace(/[\s-]/g, '')) ? undefined : message);
}

/** Pragmatic email shape check; the server does the authoritative validation. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isEmail(message = 'Enter a valid email address') {
    return (value) => (EMAIL_PATTERN.test(String(value || '').trim()) ? undefined : message);
}

/** Runs `validator` only when the field has a value, so optional fields can be left blank. */
export function optional(validator) {
    return (value, values) => (value == null || String(value).trim() === '' ? undefined : validator(value, values));
}

/** Combines validators for a single field; returns the first failure. */
export function all(...validators) {
    return (value, values) => {
        for (const validate of validators) {
            const message = validate(value, values);
            if (message) return message;
        }
        return undefined;
    };
}
