import { useContext } from 'react';
import { SettingsContext } from './context.js';

/** @returns {{ status: 'loading'|'ready'|'error', showPrice: boolean, reload: () => void, setShowPrice: (next: boolean) => Promise<{ showPrice: boolean }> }} */
export function useSettings() {
    const ctx = useContext(SettingsContext);
    if (!ctx) throw new Error('useSettings must be used within a SettingsProvider');
    return ctx;
}

/** Whether the site-wide "Show price" setting is on. Pair with `isPriceVisible(product, showPrice)` for a product. */
export function useShowPrice() {
    return useSettings().showPrice;
}
