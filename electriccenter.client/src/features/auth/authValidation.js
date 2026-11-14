import { all, isEmail, isPhone, optional, required } from '../../utils/validators.js';

/** Must match the server's PasswordPolicy. */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Unlike minLength() this does not trim: spaces are valid password characters. */
function passwordRules(value) {
    const password = String(value ?? '');
    if (password.length < PASSWORD_MIN_LENGTH) return `Use at least ${PASSWORD_MIN_LENGTH} characters`;
    if (password.length > PASSWORD_MAX_LENGTH) return `Use at most ${PASSWORD_MAX_LENGTH} characters`;
    if (password.trim() === '') return "Password can't be only spaces";
    return undefined;
}

function matches(field, message) {
    return (value, values) => (value === values[field] ? undefined : message);
}

export const loginSchema = {
    email: all(required('Email is required'), isEmail()),
    password: required('Password is required'),
};

export const registerSchema = {
    fullName: required('Your name is required'),
    email: all(required('Email is required'), isEmail()),
    phone: optional(isPhone('Enter a valid phone number, e.g. +977 98XXXXXXXX')),
    password: passwordRules,
    confirmPassword: matches('password', "Passwords don't match"),
};

export const OTP_LENGTH = 6;

/** Strips spaces/dashes people paste in from the email ("123 456", "123-456"). */
export function cleanOtp(value) {
    return String(value ?? '').replace(/[\s-]/g, '');
}

export const verifyEmailSchema = {
    code: (value) => (new RegExp(`^\\d{${OTP_LENGTH}}$`).test(cleanOtp(value)) ? undefined : `Enter the ${OTP_LENGTH}-digit code from the email`),
};

export const changePasswordSchema = {
    currentPassword: required('Enter your current password'),
    newPassword: all(passwordRules, (value, values) =>
        value && value === values.currentPassword ? 'Choose a password different from the current one' : undefined
    ),
    confirmPassword: matches('newPassword', "Passwords don't match"),
};
