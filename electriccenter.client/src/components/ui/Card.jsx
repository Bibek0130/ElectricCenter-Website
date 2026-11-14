import { cx } from '../../utils/cx.js';

/**
 * @param {{ padded?: boolean, interactive?: boolean, as?: React.ElementType } & Record<string, any>} props
 */
function Card({ padded = true, interactive = false, className, children, as: Component = 'div', ...rest }) {
    return (
        <Component
            className={cx('card', padded && 'card-padded', interactive && 'card-interactive', className)}
            {...rest}
        >
            {children}
        </Component>
    );
}

export default Card;
