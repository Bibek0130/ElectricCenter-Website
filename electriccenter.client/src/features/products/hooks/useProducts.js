import { useCallback, useEffect, useState } from 'react';
import { productsService } from '../../../services/productsService.js';

/**
 * Fetches products for the given filters (search/categoryId/minPrice/maxPrice/sort),
 * re-running whenever the filters change.
 */
export function useProducts(filters) {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reloadToken, setReloadToken] = useState(0);

    const filterKey = JSON.stringify(filters);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
        productsService
            .getProducts(active)
            .then((result) => {
                if (cancelled) return;
                setProducts(result.items);
            })
            .catch((err) => {
                if (cancelled) return;
                setError(err instanceof Error ? err.message : 'Failed to load products.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterKey, reloadToken]);

    const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

    return { products, loading, error, refetch };
}
