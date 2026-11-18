import { useEffect, useId, useRef, useState } from 'react';
import Button from './Button.jsx';
import { IMAGE_ACCEPT, IMAGE_MAX_BYTES, uploadsService, validateImageFile } from '../../services/uploadsService.js';

/**
 * Pick an image, upload it (to Cloudinary via the server) and report the hosted URL.
 * The URL is what the form saves with the product / electrician.
 * @param {{
 *   label?: string, value: string, onChange: (url: string) => void, hint?: string,
 *   compact?: boolean, shape?: 'square'|'round', error?: string,
 * }} props
 */
function ImageUploadField({ label = 'Photo', value, onChange, hint, compact = false, shape = 'square', error }) {
    const inputId = useId();
    const inputRef = useRef(null);
    const mounted = useRef(true);
    const [progress, setProgress] = useState(null); // null = idle, 0-100 while uploading
    const [uploadError, setUploadError] = useState(null);
    const uploading = progress !== null;

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const handleFile = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // allow picking the same file again after an error
        if (!file) return;

        const invalid = validateImageFile(file);
        if (invalid) {
            setUploadError(invalid);
            return;
        }

        setUploadError(null);
        setProgress(0);
        try {
            const url = await uploadsService.uploadImage(file, (p) => mounted.current && setProgress(p));
            if (mounted.current) onChange(url);
        } catch (err) {
            if (mounted.current) setUploadError(err.message);
        } finally {
            if (mounted.current) setProgress(null);
        }
    };

    const message = uploadError || error;

    return (
        <div className={`image-upload${compact ? ' image-upload--compact' : ''}`}>
            {!compact && <span className="form-label">{label}</span>}
            <div className="image-upload-row">
                <div className={`image-upload-preview${shape === 'round' ? ' is-round' : ''}`}>
                    {value ? (
                        <img src={value} alt="" onError={(e) => { e.currentTarget.hidden = true; }} onLoad={(e) => { e.currentTarget.hidden = false; }} />
                    ) : (
                        <span aria-hidden="true">🖼</span>
                    )}
                </div>

                <div className="image-upload-actions">
                    <input
                        id={inputId}
                        ref={inputRef}
                        type="file"
                        accept={IMAGE_ACCEPT}
                        className="visually-hidden"
                        onChange={handleFile}
                        disabled={uploading}
                        aria-label={`${label}: choose an image file`}
                    />
                    <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                        <Button type="button" variant="secondary" size="sm" loading={uploading} disabled={uploading} onClick={() => inputRef.current?.click()}>
                            {uploading ? `Uploading… ${progress}%` : value ? 'Replace image' : 'Choose image'}
                        </Button>
                        {value && !uploading && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => { setUploadError(null); onChange(''); }}>
                                Remove
                            </Button>
                        )}
                    </div>
                    {!message && !compact && (
                        <span className="form-hint">{hint ?? `JPG, PNG or WebP, up to ${IMAGE_MAX_BYTES / (1024 * 1024)} MB.`}</span>
                    )}
                    {message && <span className="form-error" role="alert">{message}</span>}
                </div>
            </div>
        </div>
    );
}

export default ImageUploadField;
