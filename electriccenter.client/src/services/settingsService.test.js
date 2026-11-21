import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./httpClient.js', () => ({ httpClient: { get: vi.fn(), put: vi.fn() } }));

const { httpClient } = await import('./httpClient.js');
const { settingsService } = await import('./settingsService.js');

describe('settingsService', () => {
    beforeEach(() => {
        httpClient.get.mockReset();
        httpClient.put.mockReset();
    });

    it('reads the settings from GET /settings', async () => {
        httpClient.get.mockResolvedValue({ data: { showPrice: false } });

        await expect(settingsService.getSettings()).resolves.toEqual({ showPrice: false });
        expect(httpClient.get).toHaveBeenCalledWith('/settings');
    });

    it('saves the settings with PUT /settings and returns what the server stored', async () => {
        httpClient.put.mockResolvedValue({ data: { showPrice: false } });

        await expect(settingsService.updateSettings({ showPrice: false })).resolves.toEqual({ showPrice: false });
        expect(httpClient.put).toHaveBeenCalledWith('/settings', { showPrice: false });
    });

    it('surfaces the server message when saving is refused', async () => {
        httpClient.put.mockRejectedValue({ response: { status: 403, data: { message: 'Admins only.' } } });

        await expect(settingsService.updateSettings({ showPrice: true })).rejects.toThrow('Admins only.');
    });

    it('gives a friendly message when the server cannot be reached', async () => {
        httpClient.get.mockRejectedValue({ code: 'ERR_NETWORK' });

        await expect(settingsService.getSettings()).rejects.toThrow(/Can't reach the server/);
    });
});
