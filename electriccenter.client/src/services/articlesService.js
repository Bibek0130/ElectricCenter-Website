import { httpClient } from './httpClient.js';
import { callApi } from './apiError.js';

/**
 * @typedef {Object} ArticleSummary A card in the list.
 * @property {number} id
 * @property {string} title
 * @property {string} slug            The article's address: /articles/{slug}
 * @property {string} summary
 * @property {string|null} coverImageUrl
 * @property {string|null} coverImageAlt
 * @property {string} authorName
 * @property {string} publishedAt     ISO 8601
 * @property {number} readingMinutes
 */

/**
 * @typedef {ArticleSummary & { bodyHtml: string, updatedAt: string }} Article
 * A published article. `bodyHtml` was rendered (and made safe) by the server, so it can be shown as-is.
 */

/**
 * @typedef {Object} AdminArticle What the editor works with.
 * @property {number} id
 * @property {string} title
 * @property {string} slug
 * @property {string} summary
 * @property {string} bodyMarkdown
 * @property {string|null} coverImageUrl
 * @property {string|null} coverImageAlt
 * @property {string} authorName
 * @property {boolean} isPublished
 * @property {string|null} publishedAt
 * @property {string} version         Send it back when saving; a 409 means someone else saved first.
 * @property {boolean} isDeleted
 */

/** The public side: published articles only. */
export const articlesService = {
    /** @returns {Promise<{ items: ArticleSummary[], total: number }>} */
    async getArticles() {
        const { data } = await callApi(() => httpClient.get('/articles'), 'Could not load the articles.');
        return data;
    },

    /** Rejects with an error whose `status` is 404 when there's no such published article. @returns {Promise<Article>} */
    async getArticle(slug) {
        const { data } = await callApi(() => httpClient.get(`/articles/${encodeURIComponent(slug)}`), 'Could not load the article.');
        return data;
    },
};

/** Writing and managing articles. The server requires the Admin role for every call here. */
export const adminArticlesService = {
    /** Drafts included; deleted ones only with `includeDeleted`. @returns {Promise<{ items: (ArticleSummary & { isPublished: boolean, isDeleted: boolean })[], total: number }>} */
    async list({ includeDeleted = false } = {}) {
        const { data } = await callApi(
            () => httpClient.get('/admin/articles', { params: includeDeleted ? { includeDeleted: true } : {} }),
            'Could not load the articles.'
        );
        return data;
    },

    /** @returns {Promise<AdminArticle>} */
    async get(id) {
        const { data } = await callApi(() => httpClient.get(`/admin/articles/${id}`), 'Could not load the article.');
        return data;
    },

    /** @returns {Promise<AdminArticle>} */
    async create(body) {
        const { data } = await callApi(() => httpClient.post('/admin/articles', body), 'Could not save the article.');
        return data;
    },

    /** `body.version` must be the version the admin started editing from. @returns {Promise<AdminArticle>} */
    async update(id, body) {
        const { data } = await callApi(() => httpClient.put(`/admin/articles/${id}`, body), 'Could not save the article.');
        return data;
    },

    /** Soft delete: hidden from the public, kept in the database, restorable. @returns {Promise<AdminArticle>} */
    async remove(id) {
        const { data } = await callApi(() => httpClient.delete(`/admin/articles/${id}`), 'Could not delete the article.');
        return data;
    },

    /** @returns {Promise<AdminArticle>} */
    async restore(id) {
        const { data } = await callApi(() => httpClient.post(`/admin/articles/${id}/restore`), 'Could not restore the article.');
        return data;
    },

    /** The server's own rendering of Markdown, exactly as readers will get it. @returns {Promise<string>} HTML */
    async preview(markdown) {
        const { data } = await callApi(() => httpClient.post('/admin/articles/preview', { markdown }), 'Could not preview the article.');
        return data.html;
    },
};
