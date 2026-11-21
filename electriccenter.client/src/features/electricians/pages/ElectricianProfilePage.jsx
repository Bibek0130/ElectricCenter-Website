import { useParams, useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../../auth/useAuth.js';
import { loginRedirectState } from '../../auth/redirect.js';
import { useElectrician } from '../hooks/useElectrician.js';
import { useDisclosure } from '../../../hooks/useDisclosure.js';
import Avatar from '../../../components/ui/Avatar.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import ErrorState from '../../../components/ui/ErrorState.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import DemandBadge from '../components/DemandBadge.jsx';
import PastWorkGallery from '../components/PastWorkGallery.jsx';
import BookingModal from '../components/BookingModal.jsx';
import { formatCurrency } from '../../../utils/format.js';
import { useSeo } from '../../../seo/useSeo.js';
import { electricianSeo } from '../../../seo/siteSeo.js';

function ElectricianProfilePage() {
    const { electricianId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated } = useAuth();
    const { electrician, loading, error, refetch } = useElectrician(electricianId);
    const bookingModal = useDisclosure(false);

    // Leave the server-written tags alone until the profile loads. A deleted profile (only admins can open one) is kept out of search.
    useSeo(
        electrician
            ? {
                ...electricianSeo(electrician),
                path: `/electricians/${electrician.id}`,
                noindex: Boolean(electrician.isDeleted),
                image: electrician.photo?.startsWith('https://') ? electrician.photo : undefined,
                imageAlt: electrician.name,
            }
            : null
    );

    // Booking requires an account: send guests to log in, then bring them back here.
    const requestBooking = () => {
        if (electrician?.isDeleted) return;
        if (isAuthenticated) {
            bookingModal.open();
            return;
        }
        toast('Please log in to book an electrician.', { icon: '🔒' });
        navigate('/login', { state: loginRedirectState(location) });
    };

    if (loading) {
        return (
            <div className="electrician-profile-layout">
                <div>
                    <Skeleton height={200} style={{ marginBottom: 'var(--space-5)' }} />
                    <Skeleton height={16} width="60%" style={{ marginBottom: 10 }} />
                    <Skeleton height={16} width="90%" />
                </div>
                <Skeleton height={220} />
            </div>
        );
    }

    if (error) {
        return <ErrorState description={error} onRetry={refetch} />;
    }

    if (!electrician) {
        return (
            <div className="electrician-not-found">
                <EmptyState
                    icon="🔌"
                    title="Electrician not found"
                    description="This profile may have been removed or the link is incorrect."
                    action={<Button onClick={() => navigate('/electricians')}>Browse electricians</Button>}
                />
            </div>
        );
    }

    const rateLabel = `${formatCurrency(electrician.rate.amount)} / ${electrician.rate.unit}`;

    return (
        <>
            {electrician.isDeleted && (
                <p className="electrician-deleted-banner" role="status">
                    🗑 This electrician is deleted and hidden from customers. Only admins can see this page. Restore them from the Electricians page.
                </p>
            )}

            <section className="electrician-profile-hero">
                <div className="electrician-profile-header">
                    <Avatar src={electrician.photo} alt={electrician.name} size="lg" style={{ width: 96, height: 96 }} />
                    <div>
                        <h1 style={{ color: 'var(--color-white)', marginBottom: 6 }}>{electrician.name}</h1>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 8 }}>
                            {electrician.isContractor && <Badge variant="primary">Contractor</Badge>}
                            {electrician.demand && <DemandBadge demand={electrician.demand} />}
                        </div>
                        <p style={{ color: 'var(--color-primary-200)', fontSize: 'var(--text-sm)' }}>
                            {electrician.yearsExperience} years experience · 📍 {electrician.location}
                        </p>
                    </div>
                </div>
            </section>

            <div className="electrician-profile-layout">
                <div>
                    <h2 style={{ marginBottom: 'var(--space-3)' }}>About</h2>
                    <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.7, marginBottom: 'var(--space-2)' }}>{electrician.bio}</p>
                    <div className="electrician-specialty-list">
                        {electrician.specialties.map((s) => (
                            <span key={s} className="badge badge-primary">{s}</span>
                        ))}
                    </div>

                    <h2 style={{ marginBottom: 'var(--space-4)' }}>Past work</h2>
                    <PastWorkGallery pastWorks={electrician.pastWorks} />
                </div>

                <aside className="electrician-side-panel">
                    <div className="card card-padded">
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>Rate</p>
                        <p className="product-price product-price--lg" style={{ marginBottom: 'var(--space-5)' }}>{rateLabel}</p>
                        <Button block size="lg" onClick={requestBooking}>Book {electrician.name.split(' ')[0]}</Button>
                        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', textAlign: 'center', marginTop: 'var(--space-3)' }}>
                            {isAuthenticated ? "You'll confirm the job details before it's sent." : "You'll need to log in to book."}
                        </p>
                    </div>
                </aside>
            </div>

            <div className="electrician-bottom-bar">
                <div>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>Rate</p>
                    <p className="product-price">{rateLabel}</p>
                </div>
                <Button size="lg" onClick={requestBooking}>Book now</Button>
            </div>

            {isAuthenticated && <BookingModal open={bookingModal.isOpen} onClose={bookingModal.close} electrician={electrician} />}
        </>
    );
}

export default ElectricianProfilePage;
