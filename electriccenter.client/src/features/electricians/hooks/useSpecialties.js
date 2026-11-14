import { useCallback, useEffect, useState } from 'react';
import { electriciansService } from '../../../services/electriciansService.js';

/**
 * The fixed specialty catalog from the API (filter pills and the admin form).
 * Exposes `error` and `reload` so the form can say why the list is empty instead of
 * silently showing no checkboxes.
 */
export function useSpecialties() {
    const [specialties, setSpecialties] = useState([]);
    const [error, setError] = useState(null);
    const [reloadToken, setReloadToken] = useState(0);

    useEffect(() => {
        let cancelled = false;
        electriciansService
            .getSpecialties()
            .then((result) => {
                if (cancelled) return;
                setSpecialties(result);
                setError(null);
            })
            .catch((err) => {
                if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load specialties.');
            });
        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    const reload = useCallback(() => setReloadToken((t) => t + 1), []);

    return { specialties, error, reload };
}
