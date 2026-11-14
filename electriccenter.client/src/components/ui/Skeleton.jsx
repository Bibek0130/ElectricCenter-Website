import { cx } from '../../utils/cx.js';

/** @param {{ width?: string|number, height?: string|number } & Record<string, any>} props */
function Skeleton({ width = '100%', height = 16, className, style, ...rest }) {
    return (
        <span
            className={cx('skeleton', className)}
            style={{ display: 'block', width, height, ...style }}
            aria-hidden="true"
            {...rest}
        />
    );
}

export default Skeleton;
