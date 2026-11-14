import { required } from '../../utils/validators.js';

/** Limits mirror the server's ElectricianRules (the server re-validates everything). */
export const ELECTRICIAN_LIMITS = Object.freeze({
    name: 100,
    location: 100,
    url: 500,
    bio: 2000,
    maxYears: 70,
    maxRate: 1_000_000,
    maxPastWorks: 20,
    pastWorkTitle: 100,
    pastWorkDescription: 500,
});

export const RATE_UNITS = Object.freeze([
    { value: 'service', label: 'per service' },
    { value: 'visit', label: 'per visit' },
    { value: 'hour', label: 'per hour' },
]);

/** Stored values are the server's demand levels; labels are what customers see. */
export const AVAILABILITY_OPTIONS = Object.freeze([
    { value: '', label: 'Not shown' },
    { value: 'Low', label: 'Available now' },
    { value: 'Medium', label: 'Medium demand' },
    { value: 'High', label: 'High demand (busy)' },
]);

const E164 = /^\+[1-9]\d{7,14}$/;
export const normalizePhone = (value) => String(value ?? '').replace(/[\s\-()]/g, '');

const maxLength = (max, label) => (value) => (String(value ?? '').trim().length > max ? `${label} must be at most ${max} characters` : undefined);

function isHttpUrl(value) {
    try {
        const { protocol } = new URL(value);
        return protocol === 'https:' || protocol === 'http:';
    } catch {
        return false;
    }
}

const optionalUrl = (label) => (value) => {
    const url = String(value ?? '').trim();
    if (!url) return undefined;
    return url.length <= ELECTRICIAN_LIMITS.url && isHttpUrl(url) ? undefined : `${label} must be a full http(s) link`;
};

export const EMPTY_PAST_WORK = Object.freeze({ title: '', description: '', image: '', date: '' });

const isBlankWork = (w) => !w.title.trim() && !w.description.trim() && !w.image.trim();

export const electricianSchema = {
    name: (v) => required('Name is required')(v) ?? maxLength(ELECTRICIAN_LIMITS.name, 'Name')(v),
    photo: optionalUrl('Photo URL'),
    location: (v) => required('Location is required')(v) ?? maxLength(ELECTRICIAN_LIMITS.location, 'Location')(v),
    yearsExperience: (v) => {
        if (v === '' || v == null) return 'Years of experience is required';
        const n = Number(v);
        return Number.isInteger(n) && n >= 0 && n <= ELECTRICIAN_LIMITS.maxYears ? undefined : `Enter a whole number from 0 to ${ELECTRICIAN_LIMITS.maxYears}`;
    },
    rateAmount: (v) => {
        if (v === '' || v == null) return 'Rate is required';
        const n = Number(v);
        if (!Number.isFinite(n) || n <= 0) return 'Rate must be greater than 0';
        return n > ELECTRICIAN_LIMITS.maxRate ? `Rate must be at most ${ELECTRICIAN_LIMITS.maxRate.toLocaleString()}` : undefined;
    },
    rateUnit: (v) => (RATE_UNITS.some((u) => u.value === v) ? undefined : 'Choose a rate unit'),
    whatsappNumber: (v) => (E164.test(normalizePhone(v)) ? undefined : 'Include the country code, e.g. +977 9841445050'),
    bio: (v) => required('A short bio is required')(v) ?? maxLength(ELECTRICIAN_LIMITS.bio, 'Bio')(v),
    specialties: (v) => (v?.length ? undefined : 'Choose at least one specialty'),
    pastWorks: (rows) => {
        const filled = (rows ?? []).filter((w) => !isBlankWork(w));
        if (filled.length > ELECTRICIAN_LIMITS.maxPastWorks) return `At most ${ELECTRICIAN_LIMITS.maxPastWorks} past works`;
        if (filled.some((w) => !w.title.trim())) return 'Every past work needs a title';
        if (filled.some((w) => w.title.trim().length > ELECTRICIAN_LIMITS.pastWorkTitle || w.description.trim().length > ELECTRICIAN_LIMITS.pastWorkDescription)) {
            return `Titles up to ${ELECTRICIAN_LIMITS.pastWorkTitle} characters, descriptions up to ${ELECTRICIAN_LIMITS.pastWorkDescription}`;
        }
        if (filled.some((w) => w.image.trim() && !isHttpUrl(w.image.trim()))) return 'Past work images must be full http(s) links';
        const today = new Date().toISOString().slice(0, 10);
        if (filled.some((w) => w.date && w.date > today)) return "Past work dates can't be in the future";
        return undefined;
    },
};

/** Form values (strings; specialties as an array; past works as rows) for a new or existing electrician. */
export function toFormValues(electrician) {
    if (!electrician) {
        return {
            name: '', photo: '', location: '', yearsExperience: '', isContractor: false, rateAmount: '', rateUnit: 'service',
            demand: '', whatsappNumber: '+977 ', bio: '', specialties: [], pastWorks: [{ ...EMPTY_PAST_WORK }],
        };
    }
    const pastWorks = (electrician.pastWorks ?? []).map((w) => ({
        title: w.title ?? '',
        description: w.description ?? '',
        image: w.image ?? '',
        date: w.date ?? '',
    }));
    return {
        name: electrician.name,
        photo: electrician.photo ?? '',
        location: electrician.location,
        yearsExperience: String(electrician.yearsExperience),
        isContractor: Boolean(electrician.isContractor),
        rateAmount: String(electrician.rate.amount),
        rateUnit: electrician.rate.unit,
        demand: electrician.demand ?? '',
        whatsappNumber: electrician.whatsappNumber,
        bio: electrician.bio,
        specialties: [...electrician.specialties],
        pastWorks: pastWorks.length ? pastWorks : [{ ...EMPTY_PAST_WORK }],
    };
}

/** API request body from form values. `version` is included for updates. */
export function toRequestBody(values, version) {
    const text = (v) => (String(v ?? '').trim() ? String(v).trim() : null);
    return {
        name: values.name.trim(),
        photo: text(values.photo),
        location: values.location.trim(),
        yearsExperience: Number(values.yearsExperience),
        isContractor: Boolean(values.isContractor),
        rate: { amount: Number(values.rateAmount), unit: values.rateUnit },
        demand: values.demand || null,
        whatsappNumber: normalizePhone(values.whatsappNumber),
        bio: values.bio.trim(),
        specialties: [...values.specialties],
        pastWorks: values.pastWorks
            .filter((w) => !isBlankWork(w))
            .map((w) => ({ title: w.title.trim(), description: text(w.description), image: text(w.image), date: w.date || null })),
        ...(version ? { version } : {}),
    };
}
