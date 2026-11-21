import { httpClient } from './httpClient.js';
import { callApi } from './apiError.js';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @typedef {Object} Product
 * @property {number} id
 * @property {string} name
 * @property {number} categoryId
 * @property {string} categoryName
 * @property {number|null} price       List price (NPR) before discount. null when the server withholds it
 *                                     ("Show price" setting off and the caller isn't an admin)
 * @property {number} discountPercent  0 whenever the price is withheld
 * @property {number} stock
 * @property {string|null} brand
 * @property {string|null} sku
 * @property {string} shortDescription
 * @property {string|null} description
 * @property {boolean} isFeatured
 * @property {string|null} imageUrl
 * @property {Record<string, string>} specs
 * @property {string} version          Optimistic-concurrency token; send it back on update
 * @property {boolean} isDeleted       Only ever true in the admin "show deleted" view
 */

/** Query-string params the API understands; empty values and the default sort are omitted. */
export function toQueryParams(filters = {}) {
    const params = {};
    if (filters.search?.trim()) params.search = filters.search.trim();
    if (filters.categoryId) params.categoryId = filters.categoryId;
    if (filters.minPrice !== '' && filters.minPrice != null) params.minPrice = filters.minPrice;
    if (filters.maxPrice !== '' && filters.maxPrice != null) params.maxPrice = filters.maxPrice;
    if (filters.sort && filters.sort !== 'default') params.sort = filters.sort;
    if (filters.includeDeleted) params.includeDeleted = true;
    return params;
}

/** Product catalog API. Reads are public; writes require the Admin role (enforced by the server). */
export const productsService = {
    /** @returns {Promise<{ items: Product[], total: number }>} */
    async getProducts(filters = {}) {
        const { data } = await callApi(() => httpClient.get('/products', { params: toQueryParams(filters) }), 'Could not load products.');
        return data;
    },

    /** @returns {Promise<Product>} */
    async getProduct(id) {
        const { data } = await callApi(() => httpClient.get(`/products/${id}`), 'Could not load the product.');
        return data;
    },

    /** @returns {Promise<{ id: number, name: string }[]>} */
    async getCategories() {
        const { data } = await callApi(() => httpClient.get('/categories'), 'Could not load categories.');
        return data;
    },

    /** @returns {Promise<Product>} */
    async createProduct(body) {
        const { data } = await callApi(() => httpClient.post('/products', body), 'Could not create the product.');
        return data;
    },

    /** `body.version` must be the version the admin started editing from (409 if someone else saved first). */
    async updateProduct(id, body) {
        const { data } = await callApi(() => httpClient.put(`/products/${id}`, body), 'Could not save the product.');
        return data;
    },

    /** Soft delete: hidden from customers, kept in the database, restorable. */
    async deleteProduct(id) {
        const { data } = await callApi(() => httpClient.delete(`/products/${id}`), 'Could not delete the product.');
        return data;
    },

    async restoreProduct(id) {
        const { data } = await callApi(() => httpClient.post(`/products/${id}/restore`), 'Could not restore the product.');
        return data;
    },

    /** Orders are still a client-side mock: guest checkout has no backend yet. */
    async placeOrder(orderData) {
        await delay(900);
        return {
            id: Math.floor(Math.random() * 9000 + 1000),
            orderNumber: `EC-${Date.now().toString().slice(-8)}`,
            ...orderData,
            status: 'Confirmed',
        };
    },
};
