import { cx } from '../../utils/cx.js';

/**
 * @param {{
 *   variant?: 'primary'|'secondary'|'ghost',
 *   size?: 'sm'|'md'|'lg',
 *   block?: boolean,
 *   loading?: boolean,
 *   as?: React.ElementType,
 * } & Record<string, any>} props
 */
function Button({
    variant = 'primary',
    size = 'md',
    block = false,
    loading = false,
    disabled = false,
    className,
    children,
    as: Component = 'button',
    ...rest
}) {
    return (
        <Component
            className={cx('btn', `btn-${variant}`, `btn-${size}`, block && 'btn-block', className)}
            disabled={Component === 'button' ? disabled || loading : undefined}
            aria-disabled={Component !== 'button' ? disabled || loading : undefined}
            aria-busy={loading || undefined}
            {...rest}
        >
            {loading && <span className="btn-spinner" aria-hidden="true" />}
            {children}
        </Component>
    );
}

export default Button;
