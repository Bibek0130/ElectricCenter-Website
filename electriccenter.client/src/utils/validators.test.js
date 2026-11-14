import { describe, expect, it } from 'vitest';
import { all, isPhone, minLength, required } from './validators.js';

describe('required', () => {
    const validate = required('Required');

    it('fails on empty, whitespace-only, null and undefined', () => {
        expect(validate('')).toBe('Required');
        expect(validate('   ')).toBe('Required');
        expect(validate(null)).toBe('Required');
        expect(validate(undefined)).toBe('Required');
    });

    it('passes for any non-blank value', () => {
        expect(validate('Kumarigal, Kathmandu')).toBeUndefined();
    });
});

describe('minLength', () => {
    const validate = minLength(15, 'Too short');

    it('fails when trimmed length is below the minimum', () => {
        expect(validate('too short')).toBe('Too short');
        expect(validate('   short   ')).toBe('Too short');
    });

    it('passes when length meets the minimum', () => {
        expect(validate('Living room lights keep flickering')).toBeUndefined();
    });
});

describe('isPhone', () => {
    const validate = isPhone('Invalid phone');

    it('accepts numbers with or without a leading +, with spaces/dashes stripped', () => {
        expect(validate('+9779841445050')).toBeUndefined();
        expect(validate('+977 984 144 5050')).toBeUndefined();
        expect(validate('9841445050')).toBeUndefined();
    });

    it('rejects too-short, too-long, or non-numeric input', () => {
        expect(validate('12345')).toBe('Invalid phone');
        expect(validate('123456789012345678')).toBe('Invalid phone');
        expect(validate('call me maybe')).toBe('Invalid phone');
    });
});

describe('all', () => {
    it('returns the first failing validator\'s message', () => {
        const validate = all(required('Required'), minLength(5, 'Too short'));
        expect(validate('')).toBe('Required');
        expect(validate('hi')).toBe('Too short');
        expect(validate('hello there')).toBeUndefined();
    });
});
