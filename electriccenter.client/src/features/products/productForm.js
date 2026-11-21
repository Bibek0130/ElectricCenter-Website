import { required } from '../../utils/validators.js';

/** Limits mirror the server's ProductRules (the server re-validates everything). */
export const PRODUCT_LIMITS = Object.freeze({
    name: 150,
    brand: 100,
    sku: 64,
    shortDescription: 200,
    description: 4000,
    imageUrl: 500,
    maxSpecs: 20,
    specKey: 50,
    specValue: 200,
    maxPrice: 10_000_000,
    maxDiscount: 90,
    maxStock: 1_000_000,
});

const SKU_PATTERN = /^[A-Za-z0-9._-]+$/;

const maxLength = (max, label) => (value) => (String(value ?? '').trim().length > max ? `${label} must be at most ${max} characters` : undefined);

function numberIn(min, max, { integer = false, label, optional = false }) {
    return (value) => {
        if (value === '' || value == null) return optional ? undefined : `${label} is required`;
        const n = Number(value);
        if (!Number.isFinite(n)) return `${label} must be a number`;
        if (integer && !Number.isInteger(n)) return `${label} must be a whole number`;
        if (n < min || n > max) return `${label} must be between ${min.toLocaleString()} and ${max.toLocaleString()}`;
        return undefined;
    };
}

export const productSchema = {
    name: (v) => required('Product name is required')(v) ?? maxLength(PRODUCT_LIMITS.name, 'Name')(v),
    categoryId: required('Choose a category'),
    price: (v) => (v !== '' && Number(v) <= 0 ? 'Price must be greater than 0' : numberIn(0.01, PRODUCT_LIMITS.maxPrice, { label: 'Price' })(v)),
    discountPercent: numberIn(0, PRODUCT_LIMITS.maxDiscount, { integer: true, label: 'Discount', optional: true }),
    stock: numberIn(0, PRODUCT_LIMITS.maxStock, { integer: true, label: 'Stock' }),
    brand: maxLength(PRODUCT_LIMITS.brand, 'Brand'),
    sku: (v) => {
        const sku = String(v ?? '').trim();
        if (!sku) return undefined;
        if (sku.length > PRODUCT_LIMITS.sku || !SKU_PATTERN.test(sku)) return "Letters, numbers, '.', '-' and '_' only";
        return undefined;
    },
    shortDescription: (v) => required('A short description is required')(v) ?? maxLength(PRODUCT_LIMITS.shortDescription, 'Short description')(v),
    description: maxLength(PRODUCT_LIMITS.description, 'Description'),
    imageUrl: (v) => {
        const url = String(v ?? '').trim();
        if (!url) return undefined;
        if (url.length > PRODUCT_LIMITS.imageUrl) return 'Image URL is too long';
        try {
            const { protocol } = new URL(url);
            return protocol === 'https:' || protocol === 'http:' ? undefined : 'Use a full http(s) link';
        } catch {
            return 'Use a full http(s) link, e.g. https://…/photo.jpg';
        }
    },
    specs: (rows) => {
        const filled = (rows ?? []).filter((r) => r.key.trim() || r.value.trim());
        if (filled.length > PRODUCT_LIMITS.maxSpecs) return `At most ${PRODUCT_LIMITS.maxSpecs} specifications`;
        if (filled.some((r) => !r.key.trim())) return 'Every specification needs a name';
        if (filled.some((r) => r.key.trim().length > PRODUCT_LIMITS.specKey || r.value.trim().length > PRODUCT_LIMITS.specValue)) {
            return `Names up to ${PRODUCT_LIMITS.specKey} characters, values up to ${PRODUCT_LIMITS.specValue}`;
        }
        const keys = filled.map((r) => r.key.trim().toLowerCase());
        if (new Set(keys).size !== keys.length) return 'Each specification name can only appear once';
        return undefined;
    },
};

export const EMPTY_SPEC_ROW = Object.freeze({ key: '', value: '' });

/** Form values (all strings, specs as rows) for a new product or one being edited. */
export function toFormValues(product) {
    if (!product) {
        return {
            name: '', categoryId: '', price: '', discountPercent: '0', stock: '0', brand: '', sku: '',
            shortDescription: '', description: '', isFeatured: false, imageUrl: '', specs: [{ ...EMPTY_SPEC_ROW }],
        };
    }
    const specs = Object.entries(product.specs ?? {}).map(([key, value]) => ({ key, value }));
    return {
        name: product.name,
        categoryId: String(product.categoryId),
        // Admins always receive the price; guard anyway so a missing one shows an empty field, not the text "null".
        price: product.price == null ? '' : String(product.price),
        discountPercent: String(product.discountPercent ?? 0),
        stock: String(product.stock),
        brand: product.brand ?? '',
        sku: product.sku ?? '',
        shortDescription: product.shortDescription,
        description: product.description ?? '',
        isFeatured: Boolean(product.isFeatured),
        imageUrl: product.imageUrl ?? '',
        specs: specs.length ? specs : [{ ...EMPTY_SPEC_ROW }],
    };
}

/** API request body from form values. `version` is included for updates. */
export function toRequestBody(values, version) {
    const text = (v) => (String(v ?? '').trim() ? String(v).trim() : null);
    return {
        name: values.name.trim(),
        categoryId: Number(values.categoryId),
        price: Number(values.price),
        discountPercent: values.discountPercent === '' ? 0 : Number(values.discountPercent),
        stock: Number(values.stock),
        brand: text(values.brand),
        sku: text(values.sku),
        shortDescription: values.shortDescription.trim(),
        description: text(values.description),
        isFeatured: Boolean(values.isFeatured),
        imageUrl: text(values.imageUrl),
        specs: Object.fromEntries(values.specs.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value.trim()])),
        ...(version ? { version } : {}),
    };
}
