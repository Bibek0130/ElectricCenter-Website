import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { AuthContext } from './context.js';
import { getAuthState, restoreSession, subscribe } from './session.js';
import { authService } from '../../services/authService.js';

/** Exposes the session (from session.js) plus auth actions to the component tree. */
export function AuthProvider({ children }) {
    const state = useSyncExternalStore(subscribe, getAuthState);

    useEffect(() => {
        restoreSession();
    }, []);

    const value = useMemo(
        () => ({
            status: state.status,
            user: state.user,
            isAuthenticated: state.status === 'authenticated',
            hasRole: (role) => Boolean(state.user?.roles.includes(role)),
            hasAnyRole: (roles) => Boolean(state.user && roles.some((role) => state.user.roles.includes(role))),
            login: authService.login,
            register: authService.register,
            verifyEmail: authService.verifyEmail,
            resendVerification: authService.resendVerification,
            logout: authService.logout,
            logoutAllDevices: authService.logoutAllDevices,
            changePassword: authService.changePassword,
        }),
        [state]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
