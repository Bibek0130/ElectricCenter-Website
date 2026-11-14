import { cx } from '../../utils/cx.js';

/** @param {{ hasError?: boolean } & Record<string, any>} props */
function Textarea({ hasError = false, className, ...rest }) {
    return <textarea className={cx('textarea', hasError && 'has-error', className)} {...rest} />;
}

export default Textarea;
