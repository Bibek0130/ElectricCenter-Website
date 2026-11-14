import { cx } from '../../utils/cx.js';

/**
 * @param {{ value: number, reviewCount?: number, size?: number } & Record<string, any>} props
 */
function Rating({ value, reviewCount, size = 14, className, ...rest }) {
    const rounded = Math.round(value);
    return (
        <span
            className={cx('rating', className)}
            role="img"
            aria-label={`Rated ${value.toFixed(1)} out of 5${reviewCount != null ? ` from ${reviewCount} reviews` : ''}`}
            {...rest}
        >
            {[1, 2, 3, 4, 5].map((star) => (
                <svg
                    key={star}
                    width={size}
                    height={size}
                    viewBox="0 0 24 24"
                    fill={star <= rounded ? 'currentColor' : 'none'}
                    stroke="currentColor"
                    strokeWidth="2"
                    className={cx('rating-star', star <= rounded && 'is-filled')}
                    aria-hidden="true"
                >
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
            ))}
            <span className="rating-value">{value.toFixed(1)}</span>
            {reviewCount != null && <span className="rating-count">({reviewCount})</span>}
        </span>
    );
}

export default Rating;
