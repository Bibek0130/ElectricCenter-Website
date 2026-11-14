import { describe, expect, it } from 'vitest';
import { electricianSchema, normalizePhone, toFormValues, toRequestBody } from './electricianForm.js';
import { toElectricianQueryParams } from '../../services/electriciansService.js';

function validate(values) {
    return Object.fromEntries(
        Object.keys(electricianSchema)
            .map((field) => [field, electricianSchema[field](values[field], values)])
            .filter(([, message]) => message)
    );
}

const UDHAV = {
    id: 1,
    name: 'Udhav Mainali',
    photo: null,
    location: 'Kumarigal, Kathmandu',
    yearsExperience: 20,
    isContractor: true,
    rate: { amount: 1000, unit: 'service' },
    demand: null,
    whatsappNumber: '+9779841445050',
    bio: 'Electrician and contractor.',
    specialties: ['House Wiring', 'Panel Upgrades'],
    pastWorks: [{ title: 'Rewiring', description: null, image: null, date: '2025-06-12' }],
    version: 'v-1',
};

describe('electrician form', () => {
    it('a blank form reports the required fields', () => {
        const errors = validate(toFormValues());
        expect(Object.keys(errors).sort()).toEqual(['bio', 'location', 'name', 'rateAmount', 'specialties', 'whatsappNumber', 'yearsExperience']);
    });

    it('an existing electrician round-trips through the form into the same request body', () => {
        const values = toFormValues(UDHAV);
        expect(validate(values)).toEqual({});
        expect(toRequestBody(values, UDHAV.version)).toEqual({
            name: 'Udhav Mainali',
            photo: null,
            location: 'Kumarigal, Kathmandu',
            yearsExperience: 20,
            isContractor: true,
            rate: { amount: 1000, unit: 'service' },
            demand: null,
            whatsappNumber: '+9779841445050',
            bio: 'Electrician and contractor.',
            specialties: ['House Wiring', 'Panel Upgrades'],
            pastWorks: [{ title: 'Rewiring', description: null, image: null, date: '2025-06-12' }],
            version: 'v-1',
        });
    });

    it('normalizes the WhatsApp number and drops empty past-work rows', () => {
        const values = { ...toFormValues(UDHAV), whatsappNumber: '+977 984-144-5050', pastWorks: [{ title: '', description: '', image: '', date: '' }] };
        const body = toRequestBody(values);
        expect(body.whatsappNumber).toBe('+9779841445050');
        expect(body.pastWorks).toEqual([]);
        expect(body.version).toBeUndefined();
    });

    it.each([
        ['whatsappNumber', '9841445050', /country code/],
        ['yearsExperience', '2.5', /whole number/],
        ['yearsExperience', '90', /0 to 70/],
        ['rateAmount', '0', /greater than 0/],
        ['photo', 'not a url', /http/],
        ['specialties', [], /at least one/],
    ])('rejects %s = %s', (field, value, message) => {
        expect(validate({ ...toFormValues(UDHAV), [field]: value })[field]).toMatch(message);
    });

    it('rejects past work without a title or dated in the future', () => {
        const base = toFormValues(UDHAV);
        expect(validate({ ...base, pastWorks: [{ title: '', description: 'x', image: '', date: '' }] }).pastWorks).toMatch(/needs a title/);
        expect(validate({ ...base, pastWorks: [{ title: 'Job', description: '', image: '', date: '2999-01-01' }] }).pastWorks).toMatch(/future/);
    });

    it('normalizePhone strips spaces, dashes and brackets', () => {
        expect(normalizePhone(' +977 (984) 144-5050 ')).toBe('+9779841445050');
    });
});

describe('toElectricianQueryParams', () => {
    it('omits defaults and passes active filters', () => {
        expect(toElectricianQueryParams({ search: ' ', specialty: '', sort: 'default', includeDeleted: false })).toEqual({});
        expect(toElectricianQueryParams({ search: ' udhav ', specialty: 'Smart Home', sort: 'availability', includeDeleted: true }))
            .toEqual({ search: 'udhav', specialty: 'Smart Home', sort: 'availability', includeDeleted: true });
    });
});
