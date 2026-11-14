import { useState } from 'react';
import Modal from '../../../components/ui/Modal.jsx';
import Button from '../../../components/ui/Button.jsx';
import FormField from '../../../components/ui/FormField.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import { useFormValidation } from '../../../hooks/useFormValidation.js';
import { productsService } from '../../../services/productsService.js';
import { discountedPrice, formatCurrency } from '../../../utils/format.js';
import { EMPTY_SPEC_ROW, PRODUCT_LIMITS, productSchema, toFormValues, toRequestBody } from '../productForm.js';

/**
 * Admin-only create/edit form. Pass `product` to edit (its `version` is sent back so a
 * concurrent edit by another admin is detected), or omit it to create.
 * @param {{ product?: import('../../../services/productsService.js').Product, categories: { id: number, name: string }[], onClose: () => void, onSaved: (product: object, created: boolean) => void }} props
 */
function ProductFormModal({ product, categories, onClose, onSaved }) {
    const isEdit = Boolean(product);
    const [initialValues] = useState(() => toFormValues(product));
    const [conflict, setConflict] = useState(false);

    const { values, errors, submitting, submitError, setValue, handleSubmit } = useFormValidation({
        initialValues,
        schema: productSchema,
        onSubmit: async (formValues) => {
            setConflict(false);
            try {
                const saved = isEdit
                    ? await productsService.updateProduct(product.id, toRequestBody(formValues, product.version))
                    : await productsService.createProduct(toRequestBody(formValues));
                onSaved(saved, !isEdit);
            } catch (err) {
                // Another admin saved this product after it was opened here.
                if (isEdit && err.status === 409 && /changed by someone else/i.test(err.message)) setConflict(true);
                throw err;
            }
        },
    });

    const setSpec = (index, field, value) =>
        setValue('specs', values.specs.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    const addSpec = () => setValue('specs', [...values.specs, { ...EMPTY_SPEC_ROW }]);
    const removeSpec = (index) => {
        const next = values.specs.filter((_, i) => i !== index);
        setValue('specs', next.length ? next : [{ ...EMPTY_SPEC_ROW }]);
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

    const price = Number(values.price);
    const discount = Number(values.discountPercent || 0);
    const showSellingPrice = price > 0 && discount > 0 && discount <= PRODUCT_LIMITS.maxDiscount;

    return (
        <Modal open onClose={onClose} title={isEdit ? `Edit "${product.name}"` : 'Add a product'} size="lg">
            <form onSubmit={handleSubmit} noValidate className="product-form">
                <div className="product-form-grid">
                    <div className="product-form-span">{text('name', 'Product name', { required: true, maxLength: PRODUCT_LIMITS.name, placeholder: 'e.g. Schneider 63A Double Pole MCB' })}</div>

                    <FormField label="Category" required error={errors.categoryId}>
                        {(fieldProps) => (
                            <select
                                {...fieldProps}
                                className={`input${errors.categoryId ? ' has-error' : ''}`}
                                value={values.categoryId}
                                onChange={(e) => setValue('categoryId', e.target.value)}
                            >
                                <option value="">Choose…</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        )}
                    </FormField>
                    {text('brand', 'Brand', { maxLength: PRODUCT_LIMITS.brand, placeholder: 'e.g. Schneider Electric' })}

                    {text('price', 'Price (Rs)', { required: true, type: 'number', min: 0, step: '0.01', inputMode: 'decimal' })}
                    {text('discountPercent', 'Discount (%)', {
                        type: 'number', min: 0, max: PRODUCT_LIMITS.maxDiscount, step: 1, inputMode: 'numeric',
                        hint: showSellingPrice ? `Customers pay ${formatCurrency(discountedPrice({ price, discountPercent: discount }))}` : '0 for no discount',
                    })}

                    {text('stock', 'Stock (units)', { required: true, type: 'number', min: 0, step: 1, inputMode: 'numeric', hint: '0 shows the product as sold out' })}
                    {text('sku', 'SKU', { maxLength: PRODUCT_LIMITS.sku, placeholder: 'e.g. SCH-63A-DP', hint: 'Optional. Must be unique.' })}

                    <div className="product-form-span">
                        {text('shortDescription', 'Short description', { required: true, maxLength: PRODUCT_LIMITS.shortDescription, hint: 'Shown on the product card.' })}
                    </div>

                    <div className="product-form-span">
                        <FormField label="Full description" error={errors.description}>
                            {(fieldProps) => (
                                <Textarea
                                    {...fieldProps}
                                    hasError={Boolean(errors.description)}
                                    rows={4}
                                    maxLength={PRODUCT_LIMITS.description}
                                    value={values.description}
                                    onChange={(e) => setValue('description', e.target.value)}
                                />
                            )}
                        </FormField>
                    </div>

                    <div className="product-form-span">
                        {text('imageUrl', 'Image URL', { type: 'url', placeholder: 'https://…/photo.jpg', hint: 'Optional. A direct link to a product photo.' })}
                        {values.imageUrl && !errors.imageUrl && /^https?:\/\//i.test(values.imageUrl.trim()) && (
                            <img className="product-form-preview" src={values.imageUrl.trim()} alt="Preview" onError={(e) => { e.currentTarget.hidden = true; }} onLoad={(e) => { e.currentTarget.hidden = false; }} />
                        )}
                    </div>

                    <label className="product-form-span product-form-checkbox">
                        <input type="checkbox" checked={values.isFeatured} onChange={(e) => setValue('isFeatured', e.target.checked)} />
                        Featured product
                    </label>
                </div>

                <fieldset className="product-form-specs">
                    <legend className="form-label">Specifications</legend>
                    {values.specs.map((row, index) => (
                        <div key={index} className="product-form-spec-row">
                            <Input aria-label={`Specification ${index + 1} name`} placeholder="Name, e.g. Ampere Rating" value={row.key} maxLength={PRODUCT_LIMITS.specKey} onChange={(e) => setSpec(index, 'key', e.target.value)} />
                            <Input aria-label={`Specification ${index + 1} value`} placeholder="Value, e.g. 63A" value={row.value} maxLength={PRODUCT_LIMITS.specValue} onChange={(e) => setSpec(index, 'value', e.target.value)} />
                            <Button type="button" variant="ghost" size="sm" aria-label={`Remove specification ${index + 1}`} onClick={() => removeSpec(index)}>✕</Button>
                        </div>
                    ))}
                    {errors.specs && <span className="form-error" role="alert">{errors.specs}</span>}
                    {values.specs.length < PRODUCT_LIMITS.maxSpecs && (
                        <Button type="button" variant="secondary" size="sm" onClick={addSpec}>+ Add specification</Button>
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
                        {submitting ? 'Saving…' : isEdit ? 'Save changes' : 'Create product'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

export default ProductFormModal;
