import { cx } from '../../utils/cx.js';

/** @param {{ as?: React.ElementType } & Record<string, any>} props */
function PageContainer({ as: Component = 'div', className, children, ...rest }) {
    return (
        <Component className={cx('page-container', className)} {...rest}>
            {children}
        </Component>
    );
}

export default PageContainer;
