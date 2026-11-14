import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../useAuth.js';
import { loginRedirectState } from '../redirect.js';
import Spinner from '../../../components/ui/Spinner.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';

/**
 * Renders its children (or nested routes) only for signed-in users, optionally
 * restricted to users holding at least one of `roles`. Anonymous visitors are sent
 * to /login and brought back afterwards.
 *
 * This is a UX guard only — the API enforces the same rules on every request.
 * @param {{ roles?: string[], children?: React.ReactNode }} props
 */
function ProtectedRoute({ roles, children }) {
    const { status, hasAnyRole } = useAuth();
    const location = useLocation();

    if (status === 'loading') {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-16) 0' }}>
                <Spinner />
            </div>
        );
    }

    if (status !== 'authenticated') {
        return <Navigate to="/login" replace state={loginRedirectState(location)} />;
    }

    if (roles?.length && !hasAnyRole(roles)) {
        return (
            <div style={{ padding: 'var(--space-16) var(--space-5)' }}>
                <EmptyState icon="🔒" title="You don't have access to this page" description="Ask an administrator if you think you should." />
            </div>
        );
    }

    return children ?? <Outlet />;
}

export default ProtectedRoute;
