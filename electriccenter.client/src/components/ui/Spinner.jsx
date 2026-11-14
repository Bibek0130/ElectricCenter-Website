import { cx } from '../../utils/cx.js';

/** @param {{ size?: 'sm'|'md'|'lg', label?: string } & Record<string, any>} props */
function Spinner({ size = 'md', label = 'Loading…', className, ...rest }) {
    return (
        <span
            className={cx('spinner', `spinner-${size}`, className)}
            role="status"
            aria-label={label}
            {...rest}
        />
    );
}

export default Spinner;
