import { cx } from '../../utils/cx.js';

/**
 * @param {{ src?: string, alt: string, size?: 'sm'|'md'|'lg' } & Record<string, any>} props
 */
function Avatar({ src, alt, size = 'md', className, ...rest }) {
    const initials = alt
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    if (!src) {
        return (
            <span
                className={cx('avatar', `avatar-${size}`, className)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--color-gray-500)' }}
                role="img"
                aria-label={alt}
                {...rest}
            >
                {initials}
            </span>
        );
    }

    return <img className={cx('avatar', `avatar-${size}`, className)} src={src} alt={alt} {...rest} />;
}

export default Avatar;
