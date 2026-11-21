import { useState } from 'react';
import Modal from '../../../components/ui/Modal.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import { discountedPrice, formatCurrency, isPriceVisible } from '../../../utils/format.js';
import { useShowPrice } from '../../settings/useSettings.js';
import { ProductImage } from './ProductCard.jsx';

/** @param {{ product: import('../../../types/models.js'), onClose: () => void, onAdd: (qty: number) => void }} props */
function ProductModal({ product, onClose, onAdd }) {
    const [qty, setQty] = useState(1);
    // Same rule as the product card: no price, discount or savings unless the setting is on AND the product has a price.
    const priceVisible = isPriceVisible(product, useShowPrice());
    const price = discountedPrice(product);
    const hasDiscount = priceVisible && product.discountPercent > 0;
    const savings = hasDiscount ? (product.price - price) * qty : 0;

    return (
        <Modal open onClose={onClose} size="lg">
            <div className="product-modal-grid">
                <div className="product-modal-media">
                    <ProductImage product={product} />
                    {hasDiscount && (
                        <Badge variant="error" className="product-card-badge">Save {product.discountPercent}%</Badge>
                    )}
                </div>

                <div style={{ padding: 'var(--space-6)' }}>
                    <p className="product-card-category">{product.categoryName}</p>
                    <h2 style={{ margin: '6px 0 8px', fontSize: 'var(--text-2xl)' }}>{product.name}</h2>
                    {product.brand && (
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                            Brand: <strong>{product.brand}</strong>
                        </p>
                    )}
                    {product.sku && (
                        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 'var(--space-3)' }}>
                            SKU: <code>{product.sku}</code>
                        </p>
                    )}
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-600)', lineHeight: 1.7, marginBottom: 'var(--space-4)' }}>
                        {product.description}
                    </p>

                    {priceVisible && (
                        <div className="product-price-row">
                            <span className="product-price product-price--lg">{formatCurrency(price)}</span>
                            {hasDiscount && <span className="product-price-original">{formatCurrency(product.price)}</span>}
                        </div>
                    )}
                    {hasDiscount && <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-error-600)', fontWeight: 700, marginBottom: 'var(--space-3)' }}>You save {formatCurrency(savings)}</p>}

                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, marginBottom: 'var(--space-4)', color: product.stock > 0 ? 'var(--color-success-600)' : 'var(--color-error-600)' }}>
                        {product.stock > 10 ? `In stock (${product.stock} units)` : product.stock > 0 ? `Only ${product.stock} left` : 'Out of stock'}
                    </p>

                    {product.specs && Object.keys(product.specs).length > 0 && (
                        <div style={{ background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-5)' }}>
                            <p className="filter-section-title">Specifications</p>
                            <table className="product-spec-table">
                                <tbody>
                                    {Object.entries(product.specs).map(([key, value]) => (
                                        <tr key={key}>
                                            <td>{key}</td>
                                            <td>{value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                        <div className="qty-stepper">
                            <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">−</button>
                            <span>{qty}</span>
                            <button type="button" onClick={() => setQty((q) => Math.min(product.stock, q + 1))} aria-label="Increase quantity">+</button>
                        </div>
                        <Button disabled={product.stock === 0} onClick={() => onAdd(qty)} style={{ flex: 1 }}>
                            🛒 Add to cart
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}

export default ProductModal;
