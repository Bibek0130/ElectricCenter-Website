import { useState } from 'react';
import toast from 'react-hot-toast';
import { useElectricians } from '../hooks/useElectricians.js';
import { useSpecialties } from '../hooks/useSpecialties.js';
import ElectricianCard from '../components/ElectricianCard.jsx';
import ElectricianFormModal from '../components/ElectricianFormModal.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import ErrorState from '../../../components/ui/ErrorState.jsx';
import { electriciansService } from '../../../services/electriciansService.js';
import { useAuth } from '../../auth/useAuth.js';
import { ROLES } from '../../auth/context.js';

const INITIAL_FILTERS = { search: '', specialty: '', sort: 'default', includeDeleted: false };

const SORT_OPTIONS = [
    ['default', 'Recommended'],
    ['availability', 'Available first'],
    ['experience', 'Most experienced'],
    ['price_asc', 'Rate: Low → High'],
    ['price_desc', 'Rate: High → Low'],
];

function ElectriciansPage() {
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const { specialties, error: specialtiesError, reload: reloadSpecialties } = useSpecialties();

    // Admin-only directory management. The server enforces the Admin role on every write;
    // this only decides which controls to show.
    const { hasRole } = useAuth();
    const isAdmin = hasRole(ROLES.Admin);
    const [editor, setEditor] = useState(null); // null | { electrician?: Electrician }
    const [pendingDelete, setPendingDelete] = useState(null);
    const [busyId, setBusyId] = useState(null);

    // Only an admin can ask for deleted electricians; drop the flag if the role goes away (e.g. logout).
    const effectiveFilters = isAdmin ? filters : { ...filters, includeDeleted: false };
    const { electricians, loading, error, refetch } = useElectricians(effectiveFilters);

    const handleSaved = (saved, created) => {
        setEditor(null);
        toast.success(created ? `${saved.name} added to the directory` : `${saved.name} saved`);
        refetch();
    };

    const restore = async (electrician) => {
        setBusyId(electrician.id);
        try {
            await electriciansService.restoreElectrician(electrician.id);
            toast.success(`${electrician.name} restored`);
            refetch();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const confirmDelete = async () => {
        const electrician = pendingDelete;
        setBusyId(electrician.id);
        try {
            await electriciansService.deleteElectrician(electrician.id);
            setPendingDelete(null);
            refetch();
            toast(
                (t) => (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        {electrician.name} deleted
                        <button
                            type="button"
                            className="link-button"
                            onClick={() => {
                                toast.dismiss(t.id);
                                restore(electrician);
                            }}
                        >
                            Undo
                        </button>
                    </span>
                ),
                { duration: 6000 }
            );
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <>
            <section className="products-hero">
                <h1 className="products-hero-title">⚡ Find an Electrician</h1>
                <p className="products-hero-subtitle">Trusted electricians across Kathmandu valley. Book in minutes.</p>
                <form className="products-search" role="search" onSubmit={(e) => e.preventDefault()}>
                    <label htmlFor="electrician-search" className="visually-hidden">Search electricians</label>
                    <input
                        id="electrician-search"
                        value={filters.search}
                        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                        placeholder="Search by name, specialty or location…"
                    />
                    <button type="submit" aria-label="Search">🔍</button>
                </form>
            </section>

            {specialties.length > 0 && (
                <nav className="category-pills" aria-label="Filter by specialty">
                    <div className="category-pills-inner">
                        <button type="button" className={`pill${!filters.specialty ? ' is-active' : ''}`} onClick={() => setFilters((f) => ({ ...f, specialty: '' }))}>
                            All specialties
                        </button>
                        {specialties.map((s) => (
                            <button
                                key={s}
                                type="button"
                                className={`pill${filters.specialty === s ? ' is-active' : ''}`}
                                onClick={() => setFilters((f) => ({ ...f, specialty: f.specialty === s ? '' : s }))}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </nav>
            )}

            <div className="products-layout">
                <aside className="filters-panel">
                    <Card>
                        <div className="filters-panel-header">
                            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'var(--text-lg)' }}>Sort</span>
                            <button
                                type="button"
                                onClick={() => setFilters(INITIAL_FILTERS)}
                                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--text-xs)', cursor: 'pointer' }}
                            >
                                Reset all
                            </button>
                        </div>
                        <div className="filter-section">
                            {SORT_OPTIONS.map(([value, label]) => (
                                <label key={value} className="filter-sort-option">
                                    <input
                                        type="radio"
                                        name="electrician-sort"
                                        checked={filters.sort === value}
                                        onChange={() => setFilters((f) => ({ ...f, sort: value }))}
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>

                        {isAdmin && (
                            <div className="filter-section">
                                <p className="filter-section-title">Admin</p>
                                <label className="filter-sort-option">
                                    <input
                                        type="checkbox"
                                        checked={filters.includeDeleted}
                                        onChange={(e) => setFilters((f) => ({ ...f, includeDeleted: e.target.checked }))}
                                    />
                                    Show deleted electricians
                                </label>
                            </div>
                        )}
                    </Card>
                </aside>

                <div>
                    {(isAdmin || (!loading && !error)) && (
                        <div className="results-header">
                            {!loading && !error && (
                                <p className="results-count">{electricians.length} electrician{electricians.length !== 1 ? 's' : ''} found</p>
                            )}
                            {isAdmin && (
                                <Button size="sm" className="results-header-action" onClick={() => setEditor({})}>＋ Add electrician</Button>
                            )}
                        </div>
                    )}

                    {loading ? (
                        <div className="grid-responsive">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <Card key={i}>
                                    <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                                        <Skeleton height={96} width={96} style={{ borderRadius: '50%' }} />
                                        <div style={{ flex: 1 }}>
                                            <Skeleton height={14} width="70%" style={{ marginBottom: 8 }} />
                                            <Skeleton height={10} width="50%" style={{ marginBottom: 8 }} />
                                            <Skeleton height={10} width="40%" />
                                        </div>
                                    </div>
                                    <Skeleton height={10} width="90%" />
                                </Card>
                            ))}
                        </div>
                    ) : error ? (
                        <ErrorState description={error} onRetry={refetch} />
                    ) : electricians.length === 0 ? (
                        <EmptyState
                            title="No electricians found"
                            description={isAdmin ? 'Try a different search, or add an electrician.' : 'Try a different search or specialty.'}
                            action={isAdmin ? <Button onClick={() => setEditor({})}>＋ Add electrician</Button> : undefined}
                        />
                    ) : (
                        <div className="grid-responsive">
                            {electricians.map((electrician) => (
                                <ElectricianCard
                                    key={electrician.id}
                                    electrician={electrician}
                                    admin={isAdmin ? {
                                        onEdit: () => setEditor({ electrician }),
                                        onDelete: () => setPendingDelete(electrician),
                                        onRestore: () => restore(electrician),
                                        busy: busyId === electrician.id,
                                    } : undefined}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {editor && (
                <ElectricianFormModal
                    // Remount per electrician so the form starts from that electrician's current values.
                    key={editor.electrician ? `edit-${editor.electrician.id}-${editor.electrician.version}` : 'new'}
                    electrician={editor.electrician}
                    specialties={specialties}
                    specialtiesError={specialtiesError}
                    onRetrySpecialties={reloadSpecialties}
                    onClose={() => {
                        setEditor(null);
                        refetch(); // pick up changes from other admins, e.g. after a version conflict
                    }}
                    onSaved={handleSaved}
                />
            )}

            <Modal open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} title="Delete this electrician?" size="sm">
                {pendingDelete && (
                    <>
                        <p style={{ marginBottom: 'var(--space-2)' }}>
                            <strong>{pendingDelete.name}</strong> will be hidden from the directory and can't be booked.
                        </p>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
                            Nothing is erased: you can bring them back any time with "Show deleted electricians" → Restore.
                        </p>
                        <div className="product-form-actions">
                            <Button variant="secondary" onClick={() => setPendingDelete(null)}>Cancel</Button>
                            <Button onClick={confirmDelete} loading={busyId === pendingDelete.id} disabled={busyId === pendingDelete.id}>
                                Delete electrician
                            </Button>
                        </div>
                    </>
                )}
            </Modal>
        </>
    );
}

export default ElectriciansPage;
