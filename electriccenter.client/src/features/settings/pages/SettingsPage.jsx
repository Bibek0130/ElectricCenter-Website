import { useState } from 'react';
import toast from 'react-hot-toast';
import { useSettings } from '../useSettings.js';
import Spinner from '../../../components/ui/Spinner.jsx';
import ErrorState from '../../../components/ui/ErrorState.jsx';

/** Admin-only (the route is guarded by ProtectedRoute, and the API enforces the role on every change). */
function SettingsPage() {
    const { status, showPrice, setShowPrice, reload } = useSettings();
    const [saving, setSaving] = useState(false);

    const toggleShowPrice = async () => {
        const next = !showPrice;
        setSaving(true);
        try {
            await setShowPrice(next);
            toast.success(next ? 'Prices are now shown to customers.' : 'Prices are now hidden from customers.');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className="settings-page">
            <h1 className="settings-title">Settings</h1>
            <p className="settings-intro">Site-wide options. Only administrators can see and change these.</p>

            {status === 'error' ? (
                <ErrorState title="Couldn't load the settings" description="Check your connection and try again." onRetry={reload} />
            ) : (
                <div className="card card-padded">
                    <div className="settings-row">
                        <div className="settings-row-text">
                            <h2 id="setting-show-price-label" className="settings-row-title">Show prices</h2>
                            <p id="setting-show-price-hint" className="settings-row-hint">
                                When on, product prices are shown to everyone. When off, the server stops sending prices to customers and
                                visitors, and the store hides prices, discounts, the price filter and price sorting. Admins can still see and
                                edit prices in the product editor.
                            </p>
                        </div>

                        {status === 'loading' ? (
                            <Spinner size="sm" label="Loading settings…" />
                        ) : (
                            <button
                                type="button"
                                role="switch"
                                aria-checked={showPrice}
                                aria-labelledby="setting-show-price-label"
                                aria-describedby="setting-show-price-hint"
                                className={`switch${showPrice ? ' is-on' : ''}`}
                                onClick={toggleShowPrice}
                                disabled={saving}
                            >
                                <span className="switch-thumb" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}

export default SettingsPage;
