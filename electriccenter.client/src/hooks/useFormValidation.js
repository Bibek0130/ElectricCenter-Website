import { useCallback, useState } from 'react';

/**
 * @typedef {Object.<string, (value: any, values: Object) => string|undefined>} ValidationSchema
 */

/**
 * Minimal controlled-form helper: tracks values + field errors and runs a
 * validation schema (field name -> validator returning an error string or
 * undefined) on change/submit.
 * @param {{ initialValues: Object, schema: ValidationSchema, onSubmit: (values: Object) => Promise<void>|void }} config
 */
export function useFormValidation({ initialValues, schema, onSubmit }) {
    const [values, setValues] = useState(initialValues);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState(null);

    const setValue = useCallback((name, value) => {
        setValues((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
    }, []);

    const validate = useCallback(
        (candidateValues) => {
            const nextErrors = {};
            for (const field of Object.keys(schema)) {
                const message = schema[field](candidateValues[field], candidateValues);
                if (message) nextErrors[field] = message;
            }
            setErrors(nextErrors);
            return nextErrors;
        },
        [schema]
    );

    const handleSubmit = useCallback(
        async (e) => {
            e?.preventDefault?.();
            const nextErrors = validate(values);
            if (Object.keys(nextErrors).length > 0) return;

            setSubmitting(true);
            setSubmitError(null);
            try {
                await onSubmit(values);
            } catch (err) {
                setSubmitError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
            } finally {
                setSubmitting(false);
            }
        },
        [onSubmit, validate, values]
    );

    const reset = useCallback(() => {
        setValues(initialValues);
        setErrors({});
        setSubmitError(null);
    }, [initialValues]);

    return { values, errors, submitting, submitError, setValue, handleSubmit, reset };
}
