import Card from '../../../components/ui/Card.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import { discountedPrice, formatCurrency } from '../../../utils/format.js';

/** Product photo when one is set, otherwise the ⚡ placeholder the catalog has always used. */
export function ProductImage({ product }) {
    if (product.imageUrl) {
        return <img className="product-media-img" src={product.imageUrl} alt={product.name} loading="lazy" />;
    }
    return <span aria-hidden="true">⚡</span>;
}

/**
 * @param {{
 *   product: import('../../../services/productsService.js').Product,
 *   onView: () => void,
 *   onAdd: () => void,
 *   admin?: { onEdit: () => void, onDelete: () => void, onRestore: () => void, busy?: boolean },
 * }} props
 * `admin` is only passed for users with the Admin role; the API enforces the same rule.
 */
function ProductCard({ product, onView, onAdd, admin }) {
    const price = discountedPrice(product);
    const hasDiscount = product.discountPercent > 0;
    const outOfStock = product.stock === 0;
    const deleted = product.isDeleted;
    const stop = (handler) => (e) => {
        e.stopPropagation();
        handler();
    };

    return (
        <Card
            as="article"
            padded={false}
            interactive={!deleted}
            role={deleted ? undefined : 'button'}
            tabIndex={deleted ? undefined : 0}
            onClick={deleted ? undefined : onView}
            onKeyDown={(e) => {
                if (deleted) return;
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onView();
                }
            }}
            aria-label={deleted ? `${product.name} (deleted)` : `View details for ${product.name}`}
            className={deleted ? 'product-card--deleted' : undefined}
        >
            <div className="product-card-media">
                {deleted && <Badge variant="neutral" className="product-card-badge">🗑 Deleted</Badge>}
                {!deleted && hasDiscount && (
                    <Badge variant="error" className="product-card-badge">−{product.discountPercent}%</Badge>
                )}
                {!deleted && product.isFeatured && !hasDiscount && (
                    <Badge variant="primary" className="product-card-badge">★ Featured</Badge>
                )}
                {!deleted && outOfStock && (
                    <Badge variant="neutral" className="product-card-badge product-card-badge--stock">Sold out</Badge>
                )}
                <ProductImage product={product} />
            </div>

            <div className="product-card-body">
                <p className="product-card-category">{product.categoryName}</p>
                <h3 className="product-card-title">{product.name}</h3>
                <p className="product-card-desc">{product.shortDescription}</p>

                <div className="product-price-row">
                    <span className="product-price">{formatCurrency(price)}</span>
                    {hasDiscount && <span className="product-price-original">{formatCurrency(product.price)}</span>}
                </div>

                {deleted ? (
                    <Button variant="secondary" size="sm" block loading={admin?.busy} disabled={admin?.busy} onClick={stop(admin.onRestore)}>
                        ↺ Restore
                    </Button>
                ) : (
                    <Button
                        variant={outOfStock ? 'secondary' : 'primary'}
                        size="sm"
                        block
                        disabled={outOfStock}
                        onClick={stop(onAdd)}
                    >
                        {outOfStock ? 'Out of stock' : '+ Add to cart'}
                    </Button>
                )}

                {admin && !deleted && (
                    <div className="product-card-admin">
                        <Button variant="ghost" size="sm" onClick={stop(admin.onEdit)} aria-label={`Edit ${product.name}`}>✎ Edit</Button>
                        <Button variant="ghost" size="sm" onClick={stop(admin.onDelete)} aria-label={`Delete ${product.name}`} className="product-card-delete">🗑 Delete</Button>
                    </div>
                )}
            </div>
        </Card>
    );
}

export default ProductCard;
