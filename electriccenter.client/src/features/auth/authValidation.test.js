import { describe, expect, it } from 'vitest';
import { changePasswordSchema, cleanOtp, loginSchema, registerSchema, verifyEmailSchema } from './authValidation.js';
import { safeRedirectPath } from './redirect.js';

function validate(schema, values) {
    return Object.fromEntries(
        Object.keys(schema)
            .map((field) => [field, schema[field](values[field], values)])
            .filter(([, message]) => message)
    );
}

describe('auth validation', () => {
    it('requires a well-formed email and a password to log in', () => {
        expect(validate(loginSchema, { email: 'nope', password: '' })).toEqual({
            email: 'Enter a valid email address',
            password: 'Password is required',
        });
        expect(validate(loginSchema, { email: 'a@example.com', password: 'x' })).toEqual({});
    });

    it('validates registration: name, password length, matching confirmation, optional phone', () => {
        const valid = { fullName: 'Udhav', email: 'u@example.com', phone: '', password: 'long enough', confirmPassword: 'long enough' };
        expect(validate(registerSchema, valid)).toEqual({});

        const errors = validate(registerSchema, { ...valid, fullName: ' ', phone: 'abc', password: 'short', confirmPassword: 'other' });
        expect(Object.keys(errors).sort()).toEqual(['confirmPassword', 'fullName', 'password', 'phone']);
    });

    it('counts spaces in passwords instead of trimming them', () => {
        const values = { fullName: 'A', email: 'a@example.com', password: ' a b c d ', confirmPassword: ' a b c d ' };
        expect(validate(registerSchema, values)).toEqual({});
        expect(validate(registerSchema, { ...values, password: '        ', confirmPassword: '        ' }).password).toBeDefined();
    });

    it('requires the new password to differ from the current one', () => {
        const errors = validate(changePasswordSchema, { currentPassword: 'same password', newPassword: 'same password', confirmPassword: 'same password' });
        expect(errors.newPassword).toMatch(/different/);
    });
});

describe('verification code', () => {
    it.each([
        ['123456', true],
        ['123 456', true],
        ['123-456', true],
        ['12345', false],
        ['1234567', false],
        ['12a456', false],
        ['', false],
    ])('"%s" valid=%s', (code, valid) => {
        expect(verifyEmailSchema.code(code) === undefined).toBe(valid);
    });

    it('cleans pasted codes', () => {
        expect(cleanOtp(' 123-456 ')).toBe('123456');
    });
});

describe('safeRedirectPath', () => {
    it.each([
        ['/electricians/1', '/electricians/1'],
        ['/account?tab=security', '/account?tab=security'],
        ['https://evil.example', '/account'],
        ['//evil.example', '/account'],
        ['/\\evil.example', '/account'],
        ['/login', '/account'],
        [undefined, '/account'],
    ])('%s -> %s', (input, expected) => {
        expect(safeRedirectPath(input)).toBe(expected);
    });
});
