import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import Button from '../../../components/ui/Button.jsx';

function ConfirmationPage() {
    const { state } = useLocation();
    const navigate = useNavigate();
    const order = state?.order;

    if (!order) return <Navigate to="/products" replace />;

    return (
        <div style={{ maxWidth: 520, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
            <div className="card card-padded" style={{ padding: '48px 36px' }}>
                <div
                    style={{ width: 72, height: 72, background: 'var(--color-success-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, margin: '0 auto 20px' }}
                    aria-hidden="true"
                >
                    ✓
                </div>
                <h2 style={{ marginBottom: 8 }}>Order confirmed!</h2>
                <p style={{ color: 'var(--color-text-muted)', marginBottom: 6 }}>Thank you for your purchase.</p>
                <p style={{ color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--text-lg)', marginBottom: 'var(--space-6)' }}>Order #{order.orderNumber}</p>
                <div style={{ background: 'var(--color-gray-50)', borderRadius: 'var(--radius-md)', padding: '16px 20px', marginBottom: 'var(--space-6)', textAlign: 'left' }}>
                    <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', marginBottom: 4 }}>Confirmation sent to</p>
                    <p style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{order.customerEmail}</p>
                </div>
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-subtle)', marginBottom: 'var(--space-8)' }}>
                    We'll notify you when your order is dispatched. Expected delivery: 3–5 business days.
                </p>
                <Button block onClick={() => navigate('/products')}>Continue shopping</Button>
            </div>
        </div>
    );
}

export default ConfirmationPage;
