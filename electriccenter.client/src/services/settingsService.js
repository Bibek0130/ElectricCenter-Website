import { httpClient } from './httpClient.js';
import { callApi } from './apiError.js';

/**
 * @typedef {Object} SiteSettings
 * @property {boolean} showPrice  When false the server withholds product prices and the store hides them.
 */

/** Site-wide switches. Reading is public (the storefront needs it); changing requires the Admin role. */
export const settingsService = {
    /** @returns {Promise<SiteSettings>} */
    async getSettings() {
        const { data } = await callApi(() => httpClient.get('/settings'), 'Could not load the site settings.');
        return data;
    },

    /** @param {SiteSettings} body @returns {Promise<SiteSettings>} */
    async updateSettings(body) {
        const { data } = await callApi(() => httpClient.put('/settings', body), 'Could not save the settings.');
        return data;
    },
};
