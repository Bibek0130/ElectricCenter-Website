import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./httpClient.js', () => ({ httpClient: { post: vi.fn() } }));

const { httpClient } = await import('./httpClient.js');
const { IMAGE_MAX_BYTES, uploadsService, validateImageFile } = await import('./uploadsService.js');

const file = (type = 'image/jpeg', size = 1000, name = 'photo.jpg') => ({ type, size, name });

describe('validateImageFile', () => {
    it.each([
        [file('image/jpeg'), undefined],
        [file('image/png'), undefined],
        [file('image/webp'), undefined],
        [file('image/gif'), /JPG, PNG or WebP/],
        [file('image/svg+xml'), /JPG, PNG or WebP/],
        [file('application/pdf'), /JPG, PNG or WebP/],
        [file('image/jpeg', IMAGE_MAX_BYTES + 1), /too large/],
        [file('image/jpeg', 0), /empty/],
        [undefined, /Choose an image/],
    ])('%j', (candidate, expected) => {
        const result = validateImageFile(candidate);
        if (expected === undefined) expect(result).toBeUndefined();
        else expect(result).toMatch(expected);
    });
});

describe('uploadsService.uploadImage', () => {
    beforeEach(() => {
        httpClient.post.mockReset();
    });

    it('posts the file as multipart form data and returns the hosted URL', async () => {
        httpClient.post.mockResolvedValue({ data: { url: 'https://res.cloudinary.com/demo/image/upload/v1/a.jpg' } });
        const upload = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' });

        const url = await uploadsService.uploadImage(upload);

        expect(url).toBe('https://res.cloudinary.com/demo/image/upload/v1/a.jpg');
        const [path, body, config] = httpClient.post.mock.calls[0];
        expect(path).toBe('/uploads/image');
        expect(body).toBeInstanceOf(FormData);
        expect(body.get('file')).toBeInstanceOf(File);
        expect(config.timeout).toBeGreaterThan(10_000);
    });

    it('reports upload progress as a percentage', async () => {
        httpClient.post.mockImplementation(async (_path, _body, config) => {
            config.onUploadProgress({ loaded: 50, total: 200 });
            return { data: { url: 'https://x/y.jpg' } };
        });
        const onProgress = vi.fn();

        await uploadsService.uploadImage(new File(['x'], 'a.jpg', { type: 'image/jpeg' }), onProgress);

        expect(onProgress).toHaveBeenCalledWith(25);
    });

    it('rejects an invalid file without calling the server', async () => {
        await expect(uploadsService.uploadImage(new File(['x'], 'a.gif', { type: 'image/gif' }))).rejects.toThrow(/JPG, PNG or WebP/);
        expect(httpClient.post).not.toHaveBeenCalled();
    });

    it('surfaces the server message (e.g. Cloudinary not configured)', async () => {
        httpClient.post.mockRejectedValue({ response: { status: 503, data: { message: "Image uploads aren't set up yet. Ask the site owner to configure Cloudinary." } } });

        await expect(uploadsService.uploadImage(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).rejects.toThrow(/configure Cloudinary/);
    });
});
