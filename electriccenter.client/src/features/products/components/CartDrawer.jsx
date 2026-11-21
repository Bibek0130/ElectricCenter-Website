import { useNavigate } from 'react-router-dom';
import { useCart } from '../cart/useCart.js';
import Button from '../../../components/ui/Button.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import { formatCurrency } from '../../../utils/format.js';
import { useShowPrice } from '../../settings/useSettings.js';

const FREE_SHIPPING_THRESHOLD = 5000;
const SHIPPING_COST = 150;

/** @param {{ open: boolean, onClose: () => void }} props */
function CartDrawer({ open, onClose }) {
    const { items, subtotal, priced, count, setItemQty, removeItem } = useCart();
    // No prices, totals, shipping or free-shipping nudge while prices are hidden (or an item has none).
    const showPrices = useShowPrice() && priced;
    const navigate = useNavigate();
    const shippingFree = subtotal >= FREE_SHIPPING_THRESHOLD;
    const total = subtotal + (shippingFree ? 0 : SHIPPING_COST);

    return (
        <>
            {open && <div className="cart-drawer-overlay" onClick={onClose} />}
            <aside
                className={`cart-drawer${open ? ' is-open' : ''}`}
                aria-hidden={!open}
                aria-label="Shopping cart"
            >
                <div className="cart-drawer-header">
                    <div>
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)', fontWeight: 700 }}>Cart</span>
                        <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginLeft: 8 }}>
                            {count} item{count !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <button type="button" className="modal-close" onClick={onClose} aria-label="Close cart">✕</button>
                </div>

                <div className="cart-drawer-items">
                    {items.length === 0 ? (
                        <EmptyState icon="🛒" title="Your cart is empty" />
                    ) : (
                        items.map((item) => (
                            <div key={item.id} className="cart-item">
                                <div className="cart-item-thumb" aria-hidden="true">⚡</div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <p style={{ fontSize: 'var(--text-sm)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</p>
                                    {showPrices && (
                                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', margin: '2px 0 8px' }}>{formatCurrency(item.unitPrice)} each</p>
                                    )}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: showPrices ? undefined : 8 }}>
                                        <div className="qty-stepper" style={{ transform: 'scale(0.85)', transformOrigin: 'left' }}>
                                            <button type="button" onClick={() => setItemQty(item.id, item.qty - 1)} aria-label={`Decrease quantity of ${item.name}`}>−</button>
                                            <span>{item.qty}</span>
                                            <button type="button" onClick={() => setItemQty(item.id, item.qty + 1)} aria-label={`Increase quantity of ${item.name}`}>+</button>
                                        </div>
                                        {showPrices && (
                                            <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: 'var(--text-sm)' }}>{formatCurrency(item.unitPrice * item.qty)}</span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => removeItem(item.id)}
                                            aria-label={`Remove ${item.name} from cart`}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5, fontSize: 15, marginLeft: showPrices ? undefined : 'auto' }}
                                        >
                                            🗑
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {items.length > 0 && (
                    <div className="cart-drawer-footer">
                        {showPrices && (
                            <>
                                {!shippingFree && (
                                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', textAlign: 'center', marginBottom: 10 }}>
                                        Add {formatCurrency(FREE_SHIPPING_THRESHOLD - subtotal)} more for free shipping!
                                    </p>
                                )}
                                <div className="cart-summary-row">
                                    <span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span>
                                    <span style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="cart-summary-row">
                                    <span style={{ color: 'var(--color-text-muted)' }}>Shipping</span>
                                    <span style={{ fontWeight: 600, color: shippingFree ? 'var(--color-success-600)' : undefined }}>
                                        {shippingFree ? 'Free' : formatCurrency(SHIPPING_COST)}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', margin: '12px 0 16px' }}>
                                    <span style={{ fontWeight: 700 }}>Total</span>
                                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-xl)', fontWeight: 800 }}>{formatCurrency(total)}</span>
                                </div>
                            </>
                        )}
                        <Button
                            block
                            onClick={() => {
                                onClose();
                                navigate('/products/checkout');
                            }}
                        >
                            Proceed to checkout →
                        </Button>
                    </div>
                )}
            </aside>
        </>
    );
}

export default CartDrawer;
