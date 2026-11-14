import { createContext } from 'react';

export const AuthContext = createContext(null);

/** Role names, matching the server's Roles constants. */
export const ROLES = Object.freeze({
    Customer: 'Customer',
    Electrician: 'Electrician',
    Admin: 'Admin',
});
