import { useEffect, useState, useCallback } from 'react';
import { electriciansService } from '../../../services/electriciansService.js';

/** Fetches electricians for the given filters (search/specialty/sort), re-running when they change. */
export function useElectricians(filters) {
    const [electricians, setElectricians] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reloadToken, setReloadToken] = useState(0);

    const filterKey = JSON.stringify(filters);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);

        const active = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
        electriciansService
            .getElectricians(active)
            .then((result) => {
                if (!cancelled) setElectricians(result.items);
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load electricians.');
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

    return { electricians, loading, error, refetch };
}
