import { httpClient } from './httpClient.js';
import { callApi } from './apiError.js';

/** Must match the server's ImageRules. */
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Returns an error message, or undefined when the file can be uploaded. (The server re-checks the real contents.) */
export function validateImageFile(file) {
    if (!file) return 'Choose an image to upload.';
    if (!ALLOWED_TYPES.has(file.type)) return 'Use a JPG, PNG or WebP image.';
    if (file.size > IMAGE_MAX_BYTES) return `That image is too large. The limit is ${IMAGE_MAX_BYTES / (1024 * 1024)} MB.`;
    if (file.size === 0) return 'That file is empty.';
    return undefined;
}

/** Image upload API (admin only). The file goes to Cloudinary via the server; only the returned URL is stored. */
export const uploadsService = {
    /**
     * @param {File} file
     * @param {(percent: number) => void} [onProgress]
     * @returns {Promise<string>} the hosted https image URL
     */
    async uploadImage(file, onProgress) {
        const invalid = validateImageFile(file);
        if (invalid) throw new Error(invalid);

        const form = new FormData();
        form.append('file', file);
        const { data } = await callApi(
            () => httpClient.post('/uploads/image', form, {
                timeout: 60_000, // photos on a slow connection take longer than the default 10 s
                headers: { 'Content-Type': undefined }, // let the browser set the multipart boundary
                onUploadProgress: (e) => e.total && onProgress?.(Math.round((e.loaded / e.total) * 100)),
            }),
            'Could not upload the image.'
        );
        return data.url;
    },
};
