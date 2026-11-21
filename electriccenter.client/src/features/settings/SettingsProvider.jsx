import { useCallback, useEffect, useMemo, useState } from 'react';
import { SettingsContext } from './context.js';
import { settingsService } from '../../services/settingsService.js';

/**
 * Loads the site-wide settings once and shares them with the whole app.
 *
 * `showPrice` is only ever `true` when the server said so. While the settings are loading, or if they
 * can't be read, it is `false`, so prices never flash up and then disappear.
 */
export function SettingsProvider({ children }) {
    const [state, setState] = useState({ status: 'loading', showPrice: null });
    const [reloadToken, setReloadToken] = useState(0);

    useEffect(() => {
        let cancelled = false;
        settingsService
            .getSettings()
            .then((settings) => {
                if (!cancelled) setState({ status: 'ready', showPrice: settings.showPrice });
            })
            .catch(() => {
                if (!cancelled) setState({ status: 'error', showPrice: null });
            });
        return () => {
            cancelled = true;
        };
    }, [reloadToken]);

    const reload = useCallback(() => {
        setState({ status: 'loading', showPrice: null });
        setReloadToken((t) => t + 1);
    }, []);

    // Admin only (the server enforces it). Rejects on failure so the caller can show the error;
    // the shown value only changes once the server has confirmed the new one.
    const setShowPrice = useCallback(async (next) => {
        const saved = await settingsService.updateSettings({ showPrice: next });
        setState({ status: 'ready', showPrice: saved.showPrice });
        return saved;
    }, []);

    const value = useMemo(
        () => ({ status: state.status, showPrice: state.showPrice === true, reload, setShowPrice }),
        [state, reload, setShowPrice]
    );

    return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
