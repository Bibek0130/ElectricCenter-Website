import { useId } from 'react';

/**
 * Lays out a label, an input/textarea (via render prop), a hint and an
 * error message with the right aria wiring already in place.
 * @param {{
 *   label: string,
 *   hint?: string,
 *   error?: string,
 *   required?: boolean,
 *   children: (fieldProps: { id: string, 'aria-invalid': boolean, 'aria-describedby'?: string }) => React.ReactNode,
 * }} props
 */
function FormField({ label, hint, error, required = false, children }) {
    const id = useId();
    const hintId = hint ? `${id}-hint` : undefined;
    const errorId = error ? `${id}-error` : undefined;
    const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

    return (
        <div className="form-field">
            <label className="form-label" htmlFor={id}>
                {label} {required && <span aria-hidden="true">*</span>}
            </label>
            {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}
            {hint && !error && (
                <span className="form-hint" id={hintId}>
                    {hint}
                </span>
            )}
            {error && (
                <span className="form-error" id={errorId} role="alert">
                    {error}
                </span>
            )}
        </div>
    );
}

export default FormField;
