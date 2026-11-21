import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useProducts } from '../hooks/useProducts.js';
import { useCategories } from '../hooks/useCategories.js';
import { useCart } from '../cart/useCart.js';
import { useDisclosure } from '../../../hooks/useDisclosure.js';
import ProductCard from '../components/ProductCard.jsx';
import ProductModal from '../components/ProductModal.jsx';
import CartDrawer from '../components/CartDrawer.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import ErrorState from '../../../components/ui/ErrorState.jsx';
import Card from '../../../components/ui/Card.jsx';
import Button from '../../../components/ui/Button.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import ProductFormModal from '../components/ProductFormModal.jsx';
import { productsService } from '../../../services/productsService.js';
import { useAuth } from '../../auth/useAuth.js';
import { ROLES } from '../../auth/context.js';
import { useSettings } from '../../settings/useSettings.js';

const INITIAL_FILTERS = { search: '', categoryId: '', minPrice: '', maxPrice: '', sort: 'default', includeDeleted: false };

function ProductsPage() {
    const [filters, setFilters] = useState(INITIAL_FILTERS);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const { categories } = useCategories();
    const { addItem } = useCart();
    const cartDrawer = useDisclosure(false);

    // Admin-only catalog management. The server enforces the Admin role on every write;
    // this only decides which controls to show.
    const { hasRole } = useAuth();
    const isAdmin = hasRole(ROLES.Admin);
    const [editor, setEditor] = useState(null); // null | { product?: Product }
    const [pendingDelete, setPendingDelete] = useState(null);
    const [busyId, setBusyId] = useState(null);

    // While prices are hidden there is nothing to filter or sort by price on: the controls are hidden below and
    // the price filters/sorts are never sent (the server ignores them for non-admins too).
    const { showPrice, status: settingsStatus } = useSettings();
    const priceRules = showPrice
        ? filters
        : { ...filters, minPrice: '', maxPrice: '', sort: filters.sort.startsWith('price_') ? 'default' : filters.sort };

    // Only an admin can ask for deleted products; drop the flag if the role goes away (e.g. logout).
    const effectiveFilters = isAdmin ? priceRules : { ...priceRules, includeDeleted: false };
    const { products, loading, error, refetch } = useProducts(effectiveFilters);

    const handleSaved = (saved, created) => {
        setEditor(null);
        toast.success(created ? `"${saved.name}" added to the catalog` : `"${saved.name}" saved`);
        refetch();
    };

    const restore = async (product) => {
        setBusyId(product.id);
        try {
            await productsService.restoreProduct(product.id);
            toast.success(`"${product.name}" restored`);
            refetch();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const confirmDelete = async () => {
        const product = pendingDelete;
        setBusyId(product.id);
        try {
            await productsService.deleteProduct(product.id);
            setPendingDelete(null);
            refetch();
            toast(
                (t) => (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        "{product.name}" deleted
                        <button
                            type="button"
                            className="link-button"
                            onClick={() => {
                                toast.dismiss(t.id);
                                restore(product);
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

    const handleAddToCart = (product, qty = 1) => {
        addItem(product, qty);
        toast.success(`${product.name} added to cart`);
        cartDrawer.open();
    };

    return (
        <>
            <CartDrawer open={cartDrawer.isOpen} onClose={cartDrawer.close} />

            <section className="products-hero">
                <h1 className="products-hero-title">⚡ Electrical Products</h1>
                <p className="products-hero-subtitle">Premium components from top brands. Fast delivery across Nepal.</p>
                <form
                    className="products-search"
                    role="search"
                    onSubmit={(e) => e.preventDefault()}
                >
                    <label htmlFor="product-search" className="visually-hidden">Search products</label>
                    <input
                        id="product-search"
                        value={filters.search}
                        onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                        placeholder="Search products, brands, SKUs…"
                    />
                    <button type="submit" aria-label="Search">🔍</button>
                </form>
            </section>

            <nav className="category-pills" aria-label="Filter by category">
                <div className="category-pills-inner">
                    <button type="button" className={`pill${!filters.categoryId ? ' is-active' : ''}`} onClick={() => setFilters((f) => ({ ...f, categoryId: '' }))}>
                        All
                    </button>
                    {categories.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            className={`pill${filters.categoryId === c.id ? ' is-active' : ''}`}
                            onClick={() => setFilters((f) => ({ ...f, categoryId: f.categoryId === c.id ? '' : c.id }))}
                        >
                            {c.name}
                        </button>
                    ))}
                </div>
            </nav>

            {isAdmin && settingsStatus === 'ready' && !showPrice && (
                <p className="price-hidden-note" role="status">
                    Prices are hidden from customers. You still see them in the editor. Change this in <Link to="/settings">Settings</Link>.
                </p>
            )}

            <div className="products-layout">
                <aside className="filters-panel">
                    <Card>
                        <div className="filters-panel-header">
                            <span style={{ fontFamily: 'var(--font-heading)', fontWeight: 700, fontSize: 'var(--text-lg)' }}>Filters</span>
                            <button
                                type="button"
                                onClick={() => setFilters(INITIAL_FILTERS)}
                                style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontWeight: 700, fontSize: 'var(--text-xs)', cursor: 'pointer' }}
                            >
                                Reset all
                            </button>
                        </div>

                        {showPrice && (
                            <div className="filter-section">
                                <p className="filter-section-title">Price range (Rs)</p>
                                <div className="filter-price-row">
                                    <input
                                        className="input"
                                        type="number"
                                        placeholder="Min"
                                        value={filters.minPrice}
                                        onChange={(e) => setFilters((f) => ({ ...f, minPrice: e.target.value }))}
                                    />
                                    <input
                                        className="input"
                                        type="number"
                                        placeholder="Max"
                                        value={filters.maxPrice}
                                        onChange={(e) => setFilters((f) => ({ ...f, maxPrice: e.target.value }))}
                                    />
                                </div>
                            </div>
                        )}

                        {isAdmin && (
                            <div className="filter-section">
                                <p className="filter-section-title">Admin</p>
                                <label className="filter-sort-option">
                                    <input
                                        type="checkbox"
                                        checked={filters.includeDeleted}
                                        onChange={(e) => setFilters((f) => ({ ...f, includeDeleted: e.target.checked }))}
                                    />
                                    Show deleted products
                                </label>
                            </div>
                        )}

                        <div className="filter-section">
                            <p className="filter-section-title">Sort by</p>
                            {[
                                ['default', 'Newest'],
                                ['price_asc', 'Price: Low → High'],
                                ['price_desc', 'Price: High → Low'],
                                ['name', 'Name A→Z'],
                            ].filter(([value]) => showPrice || !value.startsWith('price_')).map(([value, label]) => (
                                <label key={value} className="filter-sort-option">
                                    <input
                                        type="radio"
                                        name="sort"
                                        checked={priceRules.sort === value}
                                        onChange={() => setFilters((f) => ({ ...f, sort: value }))}
                                    />
                                    {label}
                                </label>
                            ))}
                        </div>
                    </Card>
                </aside>

                <div>
                    {(isAdmin || (!loading && !error)) && (
                        <div className="results-header">
                            {!loading && !error && (
                                <p className="results-count">{products.length} product{products.length !== 1 ? 's' : ''} found</p>
                            )}
                            {isAdmin && (
                                <Button size="sm" className="results-header-action" onClick={() => setEditor({})}>＋ Add product</Button>
                            )}
                        </div>
                    )}

                    {loading ? (
                        <div className="grid-responsive">
                            {Array.from({ length: 8 }).map((_, i) => (
                                <Card key={i} padded={false}>
                                    <Skeleton height={175} style={{ borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }} />
                                    <div style={{ padding: 'var(--space-4)' }}>
                                        <Skeleton height={10} width="60%" style={{ marginBottom: 8 }} />
                                        <Skeleton height={10} width="90%" style={{ marginBottom: 8 }} />
                                        <Skeleton height={10} width="40%" />
                                    </div>
                                </Card>
                            ))}
                        </div>
                    ) : error ? (
                        <ErrorState description={error} onRetry={refetch} />
                    ) : products.length === 0 ? (
                        <EmptyState
                            title="No products found"
                            description={isAdmin ? 'Try adjusting your filters, or add a product.' : 'Try adjusting your search or filters.'}
                            action={isAdmin ? <Button onClick={() => setEditor({})}>＋ Add product</Button> : undefined}
                        />
                    ) : (
                        <div className="grid-responsive">
                            {products.map((product) => (
                                <ProductCard
                                    key={product.id}
                                    product={product}
                                    onView={() => setSelectedProduct(product)}
                                    onAdd={() => handleAddToCart(product)}
                                    admin={isAdmin ? {
                                        onEdit: () => setEditor({ product }),
                                        onDelete: () => setPendingDelete(product),
                                        onRestore: () => restore(product),
                                        busy: busyId === product.id,
                                    } : undefined}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {editor && (
                <ProductFormModal
                    // Remount per product so the form starts from that product's current values.
                    key={editor.product ? `edit-${editor.product.id}-${editor.product.version}` : 'new'}
                    product={editor.product}
                    categories={categories}
                    onClose={() => {
                        setEditor(null);
                        refetch(); // pick up changes from other admins, e.g. after a version conflict
                    }}
                    onSaved={handleSaved}
                />
            )}

            <Modal open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} title="Delete this product?" size="sm">
                {pendingDelete && (
                    <>
                        <p style={{ marginBottom: 'var(--space-2)' }}>
                            <strong>{pendingDelete.name}</strong> will be hidden from the catalog.
                        </p>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
                            Nothing is erased: you can bring it back any time with "Show deleted products" → Restore.
                        </p>
                        <div className="product-form-actions">
                            <Button variant="secondary" onClick={() => setPendingDelete(null)}>Cancel</Button>
                            <Button onClick={confirmDelete} loading={busyId === pendingDelete.id} disabled={busyId === pendingDelete.id}>
                                Delete product
                            </Button>
                        </div>
                    </>
                )}
            </Modal>

            {selectedProduct && (
                <ProductModal
                    product={selectedProduct}
                    onClose={() => setSelectedProduct(null)}
                    onAdd={(qty) => {
                        handleAddToCart(selectedProduct, qty);
                        setSelectedProduct(null);
                    }}
                />
            )}
        </>
    );
}

export default ProductsPage;
