import { useEffect, useState, useCallback } from 'react';
import { electriciansService } from '../../../services/electriciansService.js';

/** Fetches a single electrician by id. `electrician` is `null` once loaded if no match was found. */
export function useElectrician(id) {
    const [electrician, setElectrician] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [reloadToken, setReloadToken] = useState(0);

    useEffect(() => {
        let cancelled = false;
        // Reset to a loading state for the new id/reloadToken before the fetch starts.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        setError(null);

        electriciansService
            .getElectrician(id)
            .then((result) => {
                if (!cancelled) setElectrician(result);
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load electrician.');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, [id, reloadToken]);

    const refetch = useCallback(() => setReloadToken((t) => t + 1), []);

    return { electrician, loading, error, refetch };
}
