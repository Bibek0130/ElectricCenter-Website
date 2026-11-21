import { describe, expect, it } from 'vitest';
import { discountedPrice, formatDate, isPriceVisible } from './format.js';

describe('discountedPrice', () => {
    it('applies the discount percentage', () => {
        expect(discountedPrice({ price: 1000, discountPercent: 10 })).toBe(900);
    });

    it('returns the list price when there is no discount', () => {
        expect(discountedPrice({ price: 1000, discountPercent: 0 })).toBe(1000);
    });

    it('returns null, not NaN or 0, when the server withheld the price', () => {
        expect(discountedPrice({ price: null, discountPercent: 0 })).toBeNull();
        expect(discountedPrice({ price: null, discountPercent: 10 })).toBeNull();
        expect(discountedPrice({ discountPercent: 0 })).toBeNull();
    });
});

describe('isPriceVisible', () => {
    it('shows the price only when the setting is on and the product has a price', () => {
        expect(isPriceVisible({ price: 1000 }, true)).toBe(true);
    });

    it('hides a price that is present when the setting is off (e.g. an admin response)', () => {
        expect(isPriceVisible({ price: 1000 }, false)).toBe(false);
    });

    it('hides the price while the setting is unknown (still loading, or failed to load)', () => {
        expect(isPriceVisible({ price: 1000 }, null)).toBe(false);
        expect(isPriceVisible({ price: 1000 }, undefined)).toBe(false);
    });

    it('hides a missing price even when the setting is on', () => {
        expect(isPriceVisible({ price: null }, true)).toBe(false);
        expect(isPriceVisible({}, true)).toBe(false);
    });

    it('treats a price of 0 as a real price, not a missing one', () => {
        expect(isPriceVisible({ price: 0 }, true)).toBe(true);
    });
});

describe('formatDate', () => {
    it('writes the day, month name and year', () => {
        // Midday UTC, so every time zone from -11 to +11 sees the same calendar day.
        expect(formatDate('2026-11-21T12:00:00Z')).toBe('21 November 2026');
    });

    it('returns nothing for something that is not a date', () => {
        expect(formatDate('')).toBe('');
        expect(formatDate('not a date')).toBe('');
        expect(formatDate(undefined)).toBe('');
    });

    it('returns nothing for null, not the 1970 epoch (a draft has no publish date)', () => {
        expect(formatDate(null)).toBe('');
    });
});
