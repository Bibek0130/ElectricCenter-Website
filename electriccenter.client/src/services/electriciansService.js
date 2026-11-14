import { httpClient } from './httpClient.js';
import { callApi } from './apiError.js';

/** Query-string params the API understands; empty values and the default sort are omitted. */
export function toElectricianQueryParams(filters = {}) {
    const params = {};
    if (filters.search?.trim()) params.search = filters.search.trim();
    if (filters.specialty) params.specialty = filters.specialty;
    if (filters.sort && filters.sort !== 'default') params.sort = filters.sort;
    if (filters.includeDeleted) params.includeDeleted = true;
    return params;
}

/** Electrician directory API. Reads are public; writes require the Admin role (enforced by the server). */
export const electriciansService = {
    /** @returns {Promise<{ items: import('../types/models.js').Electrician[], total: number }>} */
    async getElectricians(filters = {}) {
        const { data } = await callApi(() => httpClient.get('/electricians', { params: toElectricianQueryParams(filters) }), 'Could not load electricians.');
        return data;
    },

    /** Resolves to `null` when there is no (visible) electrician with that id. */
    async getElectrician(id) {
        try {
            const { data } = await httpClient.get(`/electricians/${id}`);
            return data;
        } catch (err) {
            if (err?.response?.status === 404) return null;
            return callApi(() => Promise.reject(err), 'Could not load the electrician.');
        }
    },

    /** @returns {Promise<string[]>} the fixed specialty catalog, in display order */
    async getSpecialties() {
        const { data } = await callApi(() => httpClient.get('/electricians/specialties'), 'Could not load specialties.');
        return data;
    },

    async createElectrician(body) {
        const { data } = await callApi(() => httpClient.post('/electricians', body), 'Could not add the electrician.');
        return data;
    },

    /** `body.version` must be the version the admin started editing from (409 if someone else saved first). */
    async updateElectrician(id, body) {
        const { data } = await callApi(() => httpClient.put(`/electricians/${id}`, body), 'Could not save the electrician.');
        return data;
    },

    /** Soft delete: hidden from customers, kept in the database, restorable. */
    async deleteElectrician(id) {
        const { data } = await callApi(() => httpClient.delete(`/electricians/${id}`), 'Could not delete the electrician.');
        return data;
    },

    async restoreElectrician(id) {
        const { data } = await callApi(() => httpClient.post(`/electricians/${id}/restore`), 'Could not restore the electrician.');
        return data;
    },
};
