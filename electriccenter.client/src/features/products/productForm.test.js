import { describe, expect, it } from 'vitest';
import { productSchema, toFormValues, toRequestBody } from './productForm.js';
import { toQueryParams } from '../../services/productsService.js';

function validate(values) {
    return Object.fromEntries(
        Object.keys(productSchema)
            .map((field) => [field, productSchema[field](values[field], values)])
            .filter(([, message]) => message)
    );
}

const PRODUCT = {
    id: 7,
    name: 'Schneider 63A MCB',
    categoryId: 1,
    price: 2850,
    discountPercent: 10,
    stock: 45,
    brand: 'Schneider',
    sku: 'SCH-63A',
    shortDescription: 'Reliable protection',
    description: null,
    isFeatured: true,
    imageUrl: null,
    specs: { 'Ampere Rating': '63A', Poles: '2' },
    version: 'v-1',
};

describe('product form', () => {
    it('a blank new-product form reports the required fields', () => {
        const errors = validate(toFormValues());
        expect(Object.keys(errors).sort()).toEqual(['categoryId', 'name', 'price', 'shortDescription']);
    });

    it('an existing product round-trips through the form into the same request body', () => {
        const values = toFormValues(PRODUCT);
        expect(validate(values)).toEqual({});

        expect(toRequestBody(values, PRODUCT.version)).toEqual({
            name: 'Schneider 63A MCB',
            categoryId: 1,
            price: 2850,
            discountPercent: 10,
            stock: 45,
            brand: 'Schneider',
            sku: 'SCH-63A',
            shortDescription: 'Reliable protection',
            description: null,
            isFeatured: true,
            imageUrl: null,
            specs: { 'Ampere Rating': '63A', Poles: '2' },
            version: 'v-1',
        });
    });

    it('a create body carries no version and drops empty spec rows', () => {
        const values = { ...toFormValues(PRODUCT), specs: [{ key: ' Rating ', value: ' 16A ' }, { key: '', value: '' }] };
        const body = toRequestBody(values);
        expect(body.version).toBeUndefined();
        expect(body.specs).toEqual({ Rating: '16A' });
    });

    it.each([
        ['price', '0', /greater than 0/],
        ['price', '-3', /greater than 0/],
        ['discountPercent', '95', /between 0 and 90/],
        ['discountPercent', '5.5', /whole number/],
        ['stock', '-1', /between 0/],
        ['sku', 'has space', /Letters, numbers/],
        ['imageUrl', 'javascript:alert(1)', /http/],
        ['imageUrl', 'not a url', /http/],
    ])('rejects %s = %s', (field, value, message) => {
        const errors = validate({ ...toFormValues(PRODUCT), [field]: value });
        expect(errors[field]).toMatch(message);
    });

    it('rejects duplicate or nameless specifications', () => {
        const base = toFormValues(PRODUCT);
        expect(validate({ ...base, specs: [{ key: 'Poles', value: '2' }, { key: 'poles', value: '3' }] }).specs).toMatch(/only appear once/);
        expect(validate({ ...base, specs: [{ key: '', value: '63A' }] }).specs).toMatch(/needs a name/);
    });
});

describe('toQueryParams', () => {
    it('omits empty filters and the default sort', () => {
        expect(toQueryParams({ search: '  ', categoryId: '', minPrice: '', maxPrice: '', sort: 'default', includeDeleted: false })).toEqual({});
    });

    it('passes the active filters through', () => {
        expect(toQueryParams({ search: ' mcb ', categoryId: 2, minPrice: '100', maxPrice: 0, sort: 'price_asc', includeDeleted: true })).toEqual({
            search: 'mcb',
            categoryId: 2,
            minPrice: '100',
            maxPrice: 0,
            sort: 'price_asc',
            includeDeleted: true,
        });
    });
});
