import { useState } from 'react';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import FormField from '../../../components/ui/FormField.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import { useFormValidation } from '../../../hooks/useFormValidation.js';
import { electriciansService } from '../../../services/electriciansService.js';
import { AVAILABILITY_OPTIONS, ELECTRICIAN_LIMITS, EMPTY_PAST_WORK, RATE_UNITS, electricianSchema, toFormValues, toRequestBody } from '../electricianForm.js';

/**
 * Admin-only create/edit form. Pass `electrician` to edit (its `version` is sent back so a
 * concurrent edit by another admin is detected), or omit it to create.
 * @param {{ electrician?: object, specialties: string[], specialtiesError?: string|null, onRetrySpecialties?: () => void, onClose: () => void, onSaved: (electrician: object, created: boolean) => void }} props
 */
function ElectricianFormModal({ electrician, specialties, specialtiesError, onRetrySpecialties, onClose, onSaved }) {
    const isEdit = Boolean(electrician);
    const [initialValues] = useState(() => toFormValues(electrician));
    const [conflict, setConflict] = useState(false);

    const { values, errors, submitting, submitError, setValue, handleSubmit } = useFormValidation({
        initialValues,
        schema: electricianSchema,
        onSubmit: async (formValues) => {
            setConflict(false);
            try {
                const saved = isEdit
                    ? await electriciansService.updateElectrician(electrician.id, toRequestBody(formValues, electrician.version))
                    : await electriciansService.createElectrician(toRequestBody(formValues));
                onSaved(saved, !isEdit);
            } catch (err) {
                if (isEdit && err.status === 409) setConflict(true);
                throw err;
            }
        },
    });

    const toggleSpecialty = (specialty) =>
        setValue('specialties', values.specialties.includes(specialty)
            ? values.specialties.filter((s) => s !== specialty)
            : specialties.filter((s) => s === specialty || values.specialties.includes(s))); // keep catalog order

    const setWork = (index, field, value) =>
        setValue('pastWorks', values.pastWorks.map((w, i) => (i === index ? { ...w, [field]: value } : w)));
    const addWork = () => setValue('pastWorks', [...values.pastWorks, { ...EMPTY_PAST_WORK }]);
    const removeWork = (index) => {
        const next = values.pastWorks.filter((_, i) => i !== index);
        setValue('pastWorks', next.length ? next : [{ ...EMPTY_PAST_WORK }]);
    };

    const text = (name, label, { required = false, hint, ...props } = {}) => (
        <FormField label={label} required={required} error={errors[name]} hint={hint}>
            {(fieldProps) => (
                <Input
                    {...fieldProps}
                    {...props}
                    hasError={Boolean(errors[name])}
                    value={values[name]}
                    onChange={(e) => setValue(name, e.target.value)}
                />
            )}
        </FormField>
    );

    const select = (name, label, options, { required = false, hint } = {}) => (
        <FormField label={label} required={required} error={errors[name]} hint={hint}>
            {(fieldProps) => (
                <select {...fieldProps} className={`input${errors[name] ? ' has-error' : ''}`} value={values[name]} onChange={(e) => setValue(name, e.target.value)}>
                    {options.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                </select>
            )}
        </FormField>
    );

    const today = new Date().toISOString().slice(0, 10);

    return (
        <Modal open onClose={onClose} title={isEdit ? `Edit ${electrician.name}` : 'Add an electrician'} size="lg">
            <form onSubmit={handleSubmit} noValidate className="product-form">
                <div className="product-form-grid">
                    {text('name', 'Full name', { required: true, maxLength: ELECTRICIAN_LIMITS.name, autoComplete: 'off' })}
                    {text('location', 'Location', { required: true, maxLength: ELECTRICIAN_LIMITS.location, placeholder: 'e.g. Kumarigal, Kathmandu' })}

                    {text('yearsExperience', 'Years of experience', { required: true, type: 'number', min: 0, max: ELECTRICIAN_LIMITS.maxYears, step: 1, inputMode: 'numeric' })}
                    {text('whatsappNumber', 'WhatsApp number', { required: true, type: 'tel', hint: 'Booking requests are sent here. Include the country code.' })}

                    {text('rateAmount', 'Rate (Rs)', { required: true, type: 'number', min: 0, step: '0.01', inputMode: 'decimal' })}
                    {select('rateUnit', 'Charged', RATE_UNITS, { required: true })}

                    {select('demand', 'Availability badge', AVAILABILITY_OPTIONS, { hint: 'Optional. Shown on the card and profile.' })}
                    <label className="product-form-checkbox" style={{ alignSelf: 'end', paddingBottom: 'var(--space-3)' }}>
                        <input type="checkbox" checked={values.isContractor} onChange={(e) => setValue('isContractor', e.target.checked)} />
                        Also takes contracting projects
                    </label>

                    <div className="product-form-span">
                        {text('photo', 'Photo URL', { type: 'url', placeholder: 'https://…/photo.jpg', hint: 'Optional. Initials are shown without a photo.' })}
                    </div>

                    <div className="product-form-span">
                        <FormField label="Bio" required error={errors.bio}>
                            {(fieldProps) => (
                                <Textarea {...fieldProps} hasError={Boolean(errors.bio)} rows={4} maxLength={ELECTRICIAN_LIMITS.bio} value={values.bio} onChange={(e) => setValue('bio', e.target.value)} />
                            )}
                        </FormField>
                    </div>
                </div>

                <fieldset className="product-form-specs">
                    <legend className="form-label">Specialties <span aria-hidden="true">*</span></legend>
                    {specialties.length === 0 && (
                        <p className="form-error" role="alert">
                            {specialtiesError
                                ? `Couldn't load the specialty list: ${specialtiesError}`
                                : 'Loading specialties…'}{' '}
                            {specialtiesError && onRetrySpecialties && (
                                <button type="button" className="link-button" onClick={onRetrySpecialties}>Retry</button>
                            )}
                        </p>
                    )}
                    <div className="electrician-form-specialties">
                        {specialties.map((specialty) => (
                            <label key={specialty} className="product-form-checkbox">
                                <input type="checkbox" checked={values.specialties.includes(specialty)} onChange={() => toggleSpecialty(specialty)} />
                                {specialty}
                            </label>
                        ))}
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }} hidden={specialties.length === 0}>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setValue('specialties', [...specialties])}>Select all</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setValue('specialties', [])}>Clear</Button>
                    </div>
                    {errors.specialties && <span className="form-error" role="alert">{errors.specialties}</span>}
                </fieldset>

                <fieldset className="product-form-specs">
                    <legend className="form-label">Past work</legend>
                    {values.pastWorks.map((work, index) => (
                        <div key={index} className="electrician-form-work">
                            <Input aria-label={`Past work ${index + 1} title`} placeholder="Title, e.g. Full home rewiring" maxLength={ELECTRICIAN_LIMITS.pastWorkTitle} value={work.title} onChange={(e) => setWork(index, 'title', e.target.value)} />
                            <Input aria-label={`Past work ${index + 1} date`} type="date" max={today} value={work.date} onChange={(e) => setWork(index, 'date', e.target.value)} />
                            <Input aria-label={`Past work ${index + 1} image URL`} type="url" placeholder="Image URL (optional)" value={work.image} onChange={(e) => setWork(index, 'image', e.target.value)} />
                            <Input aria-label={`Past work ${index + 1} description`} placeholder="Short description (optional)" maxLength={ELECTRICIAN_LIMITS.pastWorkDescription} value={work.description} onChange={(e) => setWork(index, 'description', e.target.value)} />
                            <Button type="button" variant="ghost" size="sm" aria-label={`Remove past work ${index + 1}`} onClick={() => removeWork(index)}>✕</Button>
                        </div>
                    ))}
                    {errors.pastWorks && <span className="form-error" role="alert">{errors.pastWorks}</span>}
                    {values.pastWorks.length < ELECTRICIAN_LIMITS.maxPastWorks && (
                        <Button type="button" variant="secondary" size="sm" onClick={addWork}>+ Add past work</Button>
                    )}
                </fieldset>

                {submitError && (
                    <p className="form-error" role="alert">
                        {submitError}
                        {conflict && ' Close this form to load the latest version.'}
                    </p>
                )}

                <div className="product-form-actions">
                    <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button type="submit" loading={submitting} disabled={submitting}>
                        {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Add electrician'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

export default ElectricianFormModal;
