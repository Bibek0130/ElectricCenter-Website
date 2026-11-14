import { cx } from '../../utils/cx.js';

/** @param {{ hasError?: boolean } & Record<string, any>} props */
function Input({ hasError = false, className, ...rest }) {
    return <input className={cx('input', hasError && 'has-error', className)} {...rest} />;
}

export default Input;
