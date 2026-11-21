import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./httpClient.js', () => ({
    httpClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

const { httpClient } = await import('./httpClient.js');
const { adminArticlesService, articlesService } = await import('./articlesService.js');

describe('articlesService (public)', () => {
    beforeEach(() => Object.values(httpClient).forEach((mock) => mock.mockReset()));

    it('lists published articles', async () => {
        httpClient.get.mockResolvedValue({ data: { items: [{ id: 1 }], total: 1 } });

        await expect(articlesService.getArticles()).resolves.toEqual({ items: [{ id: 1 }], total: 1 });
        expect(httpClient.get).toHaveBeenCalledWith('/articles');
    });

    it('fetches one article by its address, encoding it', async () => {
        httpClient.get.mockResolvedValue({ data: { slug: 'a b' } });

        await articlesService.getArticle('a b/c');

        expect(httpClient.get).toHaveBeenCalledWith('/articles/a%20b%2Fc');
    });

    it('keeps the 404 status on the error so the page can say "not found"', async () => {
        httpClient.get.mockRejectedValue({ response: { status: 404, data: { message: 'Article not found.' } } });

        await expect(articlesService.getArticle('nope')).rejects.toMatchObject({ message: 'Article not found.', status: 404 });
    });
});

describe('adminArticlesService', () => {
    beforeEach(() => Object.values(httpClient).forEach((mock) => mock.mockReset()));

    it('lists with or without deleted articles', async () => {
        httpClient.get.mockResolvedValue({ data: { items: [], total: 0 } });

        await adminArticlesService.list();
        await adminArticlesService.list({ includeDeleted: true });

        expect(httpClient.get).toHaveBeenNthCalledWith(1, '/admin/articles', { params: {} });
        expect(httpClient.get).toHaveBeenNthCalledWith(2, '/admin/articles', { params: { includeDeleted: true } });
    });

    it('creates, updates, deletes and restores through the admin endpoints', async () => {
        httpClient.post.mockResolvedValue({ data: { id: 5 } });
        httpClient.put.mockResolvedValue({ data: { id: 5 } });
        httpClient.delete.mockResolvedValue({ data: { id: 5, isDeleted: true } });

        await adminArticlesService.create({ title: 'T' });
        await adminArticlesService.update(5, { title: 'T2', version: 'v1' });
        await adminArticlesService.remove(5);
        await adminArticlesService.restore(5);

        expect(httpClient.post).toHaveBeenNthCalledWith(1, '/admin/articles', { title: 'T' });
        expect(httpClient.put).toHaveBeenCalledWith('/admin/articles/5', { title: 'T2', version: 'v1' });
        expect(httpClient.delete).toHaveBeenCalledWith('/admin/articles/5');
        expect(httpClient.post).toHaveBeenNthCalledWith(2, '/admin/articles/5/restore');
    });

    it('asks the server to render a preview and returns the HTML', async () => {
        httpClient.post.mockResolvedValue({ data: { html: '<h2>Hi</h2>' } });

        await expect(adminArticlesService.preview('## Hi')).resolves.toBe('<h2>Hi</h2>');
        expect(httpClient.post).toHaveBeenCalledWith('/admin/articles/preview', { markdown: '## Hi' });
    });

    it('keeps the 409 status so the editor can explain a conflict', async () => {
        httpClient.put.mockRejectedValue({ response: { status: 409, data: { message: 'This article was changed by someone else since you opened it.' } } });

        await expect(adminArticlesService.update(1, {})).rejects.toMatchObject({ status: 409 });
    });
});
