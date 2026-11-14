import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCart } from '../cart/useCart.js';
import { productsService } from '../../../services/productsService.js';
import Button from '../../../components/ui/Button.jsx';
import Input from '../../../components/ui/Input.jsx';
import FormField from '../../../components/ui/FormField.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import { formatCurrency } from '../../../utils/format.js';

const STEPS = ['Review Cart', 'Shipping', 'Payment'];
const SHIPPING_COST = 150;
const FREE_SHIPPING_THRESHOLD = 5000;

function CheckoutPage() {
    const { items, subtotal, clear } = useCart();
    const navigate = useNavigate();
    const [step, setStep] = useState(0);
    const [placing, setPlacing] = useState(false);

    const [customer, setCustomer] = useState({ name: '', email: '', phone: '' });
    const [address, setAddress] = useState({ addressLine1: '', addressLine2: '', city: '', state: '', postalCode: '' });
    const [payment, setPayment] = useState({ method: 'card', cardNumber: '', expiry: '', cvv: '', upiId: '' });

    const shippingCost = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
    const total = subtotal + shippingCost;

    if (items.length === 0) {
        return (
            <EmptyState
                icon="🛒"
                title="Your cart is empty"
                action={<Button onClick={() => navigate('/products')}>Browse products</Button>}
            />
        );
    }

    const placeOrder = async () => {
        setPlacing(true);
        try {
            const result = await productsService.placeOrder({
                items: items.map((i) => ({ productId: i.id, productName: i.name, quantity: i.qty, unitPrice: i.unitPrice })),
                customerName: customer.name,
                customerEmail: customer.email,
                customerPhone: customer.phone,
                shippingAddress: address,
                paymentMethod: payment.method,
                subtotal,
                shippingCost,
                total,
            });
            clear();
            navigate('/products/confirmation', { state: { order: result } });
        } catch {
            toast.error('Failed to place order. Please try again.');
        } finally {
            setPlacing(false);
        }
    };

    return (
        <div className="checkout-layout">
            <div className="checkout-steps">
                {STEPS.map((label, i) => (
                    <div key={label} className="checkout-step">
                        <span className={`checkout-step-dot${i === step ? ' is-active' : ''}${i < step ? ' is-done' : ''}`}>
                            {i < step ? '✓' : i + 1}
                        </span>
                        <span style={{ fontSize: 'var(--text-sm)', fontWeight: i === step ? 700 : 400, color: i === step ? 'var(--color-gray-900)' : 'var(--color-text-subtle)' }}>{label}</span>
                        {i < STEPS.length - 1 && <span className={`checkout-step-connector${i < step ? ' is-done' : ''}`} />}
                    </div>
                ))}
            </div>

            <div className="checkout-grid">
                <div className="card card-padded">
                    {step === 0 && (
                        <>
                            <h2 style={{ marginBottom: 'var(--space-5)' }}>Review your items</h2>
                            {items.map((item) => (
                                <div key={item.id} style={{ display: 'flex', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--color-gray-100)' }}>
                                    <div className="cart-item-thumb" style={{ width: 64, height: 64, fontSize: 28 }} aria-hidden="true">⚡</div>
                                    <div style={{ flex: 1 }}>
                                        <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{item.name}</p>
                                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>Qty: {item.qty} × {formatCurrency(item.unitPrice)}</p>
                                    </div>
                                    <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-lg)', fontWeight: 800 }}>{formatCurrency(item.unitPrice * item.qty)}</span>
                                </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--space-5)' }}>
                                <Button variant="secondary" onClick={() => navigate('/products')}>← Keep shopping</Button>
                                <Button onClick={() => setStep(1)}>Continue to shipping →</Button>
                            </div>
                        </>
                    )}

                    {step === 1 && (
                        <>
                            <h2 style={{ marginBottom: 'var(--space-5)' }}>Shipping details</h2>
                            <div className="checkout-form-grid">
                                <FormField label="Full name" required>{(p) => <Input {...p} value={customer.name} onChange={(e) => setCustomer((c) => ({ ...c, name: e.target.value }))} />}</FormField>
                                <FormField label="Email" required>{(p) => <Input {...p} type="email" value={customer.email} onChange={(e) => setCustomer((c) => ({ ...c, email: e.target.value }))} />}</FormField>
                                <FormField label="Phone">{(p) => <Input {...p} value={customer.phone} onChange={(e) => setCustomer((c) => ({ ...c, phone: e.target.value }))} />}</FormField>
                                <div className="form-field--span2">
                                    <FormField label="Delivery address" required>{(p) => <Input {...p} value={address.addressLine1} onChange={(e) => setAddress((a) => ({ ...a, addressLine1: e.target.value }))} />}</FormField>
                                </div>
                                <div className="form-field--span2">
                                    <FormField label="Area / landmark">{(p) => <Input {...p} value={address.addressLine2} onChange={(e) => setAddress((a) => ({ ...a, addressLine2: e.target.value }))} />}</FormField>
                                </div>
                                <FormField label="City" required>{(p) => <Input {...p} value={address.city} onChange={(e) => setAddress((a) => ({ ...a, city: e.target.value }))} />}</FormField>
                                <FormField label="State" required>{(p) => <Input {...p} value={address.state} onChange={(e) => setAddress((a) => ({ ...a, state: e.target.value }))} />}</FormField>
                                <FormField label="Postal code" required>{(p) => <Input {...p} value={address.postalCode} onChange={(e) => setAddress((a) => ({ ...a, postalCode: e.target.value }))} />}</FormField>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                                <Button variant="secondary" onClick={() => setStep(0)}>← Back</Button>
                                <Button
                                    onClick={() => {
                                        if (!customer.name || !customer.email || !address.addressLine1 || !address.city) {
                                            toast.error('Please fill required fields');
                                            return;
                                        }
                                        setStep(2);
                                    }}
                                >
                                    Continue to payment →
                                </Button>
                            </div>
                        </>
                    )}

                    {step === 2 && (
                        <>
                            <h2 style={{ marginBottom: 'var(--space-5)' }}>Payment method</h2>
                            <div className="payment-method-row">
                                {[['card', '💳 Card'], ['upi', '📱 UPI'], ['netbanking', '🏦 Net banking'], ['cod', '💵 Cash on delivery']].map(([val, label]) => (
                                    <button
                                        key={val}
                                        type="button"
                                        className={`payment-method-option${payment.method === val ? ' is-active' : ''}`}
                                        onClick={() => setPayment((p) => ({ ...p, method: val }))}
                                    >
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {payment.method === 'card' && (
                                <div className="checkout-form-grid">
                                    <div className="form-field--span2">
                                        <FormField label="Card number">{(p) => <Input {...p} placeholder="1234 5678 9012 3456" value={payment.cardNumber} onChange={(e) => setPayment((v) => ({ ...v, cardNumber: e.target.value }))} />}</FormField>
                                    </div>
                                    <FormField label="Expiry (MM/YY)">{(p) => <Input {...p} placeholder="12/26" value={payment.expiry} onChange={(e) => setPayment((v) => ({ ...v, expiry: e.target.value }))} />}</FormField>
                                    <FormField label="CVV">{(p) => <Input {...p} placeholder="•••" value={payment.cvv} onChange={(e) => setPayment((v) => ({ ...v, cvv: e.target.value }))} />}</FormField>
                                    <div className="form-field--span2" style={{ background: 'var(--color-success-bg)', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', padding: '10px 14px', fontSize: 'var(--text-sm)', color: 'var(--color-success-600)' }}>
                                        🔒 Mock payment — no real charges made. All data is client-side only.
                                    </div>
                                </div>
                            )}
                            {payment.method === 'upi' && (
                                <FormField label="UPI ID">{(p) => <Input {...p} placeholder="yourname@upi" value={payment.upiId} onChange={(e) => setPayment((v) => ({ ...v, upiId: e.target.value }))} />}</FormField>
                            )}
                            {payment.method === 'netbanking' && (
                                <p style={{ background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', padding: '14px 16px', fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                                    You'll be redirected to your bank's payment portal after confirming the order.
                                </p>
                            )}
                            {payment.method === 'cod' && (
                                <p style={{ background: 'var(--color-warning-bg)', borderRadius: 'var(--radius-md)', padding: '14px 16px', fontSize: 'var(--text-sm)', color: 'var(--color-warning-600)' }}>
                                    💵 Pay <strong>{formatCurrency(total)}</strong> when your order arrives.
                                </p>
                            )}

                            <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-6)' }}>
                                <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
                                <Button onClick={placeOrder} loading={placing} style={{ flex: 1 }}>
                                    {placing ? 'Placing order…' : `Place order · ${formatCurrency(total)}`}
                                </Button>
                            </div>
                        </>
                    )}
                </div>

                <div className="card card-padded order-summary-card">
                    <h3 style={{ marginBottom: 'var(--space-4)', paddingBottom: 'var(--space-3)', borderBottom: '2px solid var(--color-primary)' }}>Order summary</h3>
                    {items.map((item) => (
                        <div key={item.id} className="cart-summary-row">
                            <span style={{ color: 'var(--color-text-muted)', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name} ×{item.qty}</span>
                            <span style={{ fontWeight: 600 }}>{formatCurrency(item.unitPrice * item.qty)}</span>
                        </div>
                    ))}
                    <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid var(--color-gray-100)' }} />
                    <div className="cart-summary-row"><span style={{ color: 'var(--color-text-muted)' }}>Subtotal</span><span style={{ fontWeight: 600 }}>{formatCurrency(subtotal)}</span></div>
                    <div className="cart-summary-row">
                        <span style={{ color: 'var(--color-text-muted)' }}>Shipping</span>
                        <span style={{ fontWeight: 600, color: shippingCost === 0 ? 'var(--color-success-600)' : undefined }}>{shippingCost === 0 ? 'Free' : formatCurrency(shippingCost)}</span>
                    </div>
                    <hr style={{ margin: '12px 0', border: 'none', borderTop: '1px solid var(--color-gray-100)' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ fontWeight: 700 }}>Total</span>
                        <span style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-primary)' }}>{formatCurrency(total)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default CheckoutPage;
