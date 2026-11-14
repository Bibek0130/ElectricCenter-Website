import { useEffect, useState } from 'react';
import { productsService } from '../../../services/productsService.js';

export function useCategories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        productsService
            .getCategories()
            .then((result) => {
                if (!cancelled) setCategories(result);
            })
            .catch(() => {
                // Category pills just stay empty; the products request reports the outage.
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return { categories, loading };
}
