import { useNavigate } from 'react-router-dom';
import Card from '../../../components/ui/Card.jsx';
import Avatar from '../../../components/ui/Avatar.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import DemandBadge from './DemandBadge.jsx';
import { formatCurrency } from '../../../utils/format.js';

/**
 * @param {{
 *   electrician: import('../../../types/models.js').Electrician,
 *   admin?: { onEdit: () => void, onDelete: () => void, onRestore: () => void, busy?: boolean },
 * }} props
 * `admin` is only passed for users with the Admin role; the API enforces the same rule.
 */
function ElectricianCard({ electrician, admin }) {
    const navigate = useNavigate();
    const deleted = electrician.isDeleted;
    const goToProfile = () => navigate(`/electricians/${electrician.id}`);
    const stop = (handler) => (e) => {
        e.stopPropagation();
        handler();
    };

    return (
        <Card
            as="article"
            interactive={!deleted}
            role={deleted ? undefined : 'button'}
            tabIndex={deleted ? undefined : 0}
            onClick={deleted ? undefined : goToProfile}
            onKeyDown={(e) => {
                if (deleted) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    goToProfile();
                }
            }}
            aria-label={deleted ? `${electrician.name} (deleted)` : `View ${electrician.name}'s profile`}
            className={deleted ? 'product-card--deleted' : undefined}
        >
            <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <Avatar src={electrician.photo} alt={electrician.name} size="lg" />
                <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 4 }}>{electrician.name}</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                        {deleted && <Badge variant="neutral">🗑 Deleted</Badge>}
                        {electrician.isContractor && <Badge variant="primary">Contractor</Badge>}
                    </div>
                    <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)', marginTop: 4 }}>
                        {electrician.yearsExperience} yrs experience · {electrician.location}
                    </p>
                </div>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 'var(--space-4)' }}>
                {electrician.specialties.slice(0, 3).map((s) => (
                    <span key={s} className="badge badge-neutral">{s}</span>
                ))}
                {electrician.specialties.length > 3 && (
                    <span className="badge badge-neutral">+{electrician.specialties.length - 3} more</span>
                )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                    <span className="product-price">{formatCurrency(electrician.rate.amount)}</span>
                    <span style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}> /{electrician.rate.unit}</span>
                </div>
                {!deleted && electrician.demand && <DemandBadge demand={electrician.demand} />}
            </div>

            {admin && (
                <div className="product-card-admin">
                    {deleted ? (
                        <Button variant="secondary" size="sm" block loading={admin.busy} disabled={admin.busy} onClick={stop(admin.onRestore)}>
                            ↺ Restore
                        </Button>
                    ) : (
                        <>
                            <Button variant="ghost" size="sm" onClick={stop(admin.onEdit)} aria-label={`Edit ${electrician.name}`}>✎ Edit</Button>
                            <Button variant="ghost" size="sm" onClick={stop(admin.onDelete)} aria-label={`Delete ${electrician.name}`} className="product-card-delete">🗑 Delete</Button>
                        </>
                    )}
                </div>
            )}
        </Card>
    );
}

export default ElectricianCard;
