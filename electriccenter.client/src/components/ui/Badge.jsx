import { cx } from '../../utils/cx.js';

/**
 * @param {{ variant?: 'neutral'|'primary'|'success'|'warning'|'error' } & Record<string, any>} props
 */
function Badge({ variant = 'neutral', className, children, ...rest }) {
    return (
        <span className={cx('badge', `badge-${variant}`, className)} {...rest}>
            {children}
        </span>
    );
}

export default Badge;
