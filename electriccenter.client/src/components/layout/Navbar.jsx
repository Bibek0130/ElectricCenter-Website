import { NavLink } from 'react-router-dom';
import { useDisclosure } from '../../hooks/useDisclosure.js';
import { useAuth } from '../../features/auth/useAuth.js';
import { ROLES } from '../../features/auth/context.js';
import { NAV_LINKS } from '../../seo/siteSeo.js';

function Navbar() {
    const mobileMenu = useDisclosure(false);
    const { status, user, hasRole } = useAuth();

    return (
        <header className={`navbar${hasRole(ROLES.Admin) ? ' navbar--admin' : ''}`}>
            <div className="navbar-inner">
                <NavLink to="/" className="navbar-brand" onClick={mobileMenu.close}>
                    <span className="navbar-brand-icon" aria-hidden="true">⚡</span>
                    Panchamukhi Electric Center
                </NavLink>

                <button
                    type="button"
                    className="btn btn-ghost btn-icon navbar-toggle"
                    aria-expanded={mobileMenu.isOpen}
                    aria-controls="navbar-links"
                    aria-label="Toggle navigation menu"
                    onClick={mobileMenu.toggle}
                >
                    {mobileMenu.isOpen ? '✕' : '☰'}
                </button>

                <nav id="navbar-links" className={`navbar-links${mobileMenu.isOpen ? ' is-open' : ''}`} aria-label="Main">
                    {NAV_LINKS.map((link) => (
                        <NavLink
                            key={link.to}
                            to={link.to}
                            end={link.to === '/'}
                            className={({ isActive }) => `navbar-link${isActive ? ' is-active' : ''}`}
                            onClick={mobileMenu.close}
                        >
                            {link.label}
                        </NavLink>
                    ))}

                    {hasRole(ROLES.Admin) && (
                        <NavLink
                            to="/settings"
                            className={({ isActive }) => `navbar-link${isActive ? ' is-active' : ''}`}
                            onClick={mobileMenu.close}
                        >
                            ⚙ Settings
                        </NavLink>
                    )}

                    {status !== 'loading' && (
                        <NavLink
                            to={user ? '/account' : '/login'}
                            className={({ isActive }) => `navbar-link navbar-link--auth${isActive ? ' is-active' : ''}`}
                            onClick={mobileMenu.close}
                        >
                            {user ? `👤 ${user.fullName.split(' ')[0]}` : 'Log in'}
                        </NavLink>
                    )}
                </nav>

                <a href="tel:+9779841445050" className="navbar-phone">
                    <span aria-hidden="true">📞</span> <span className="navbar-phone-number">+977-9841445050</span>
                </a>
            </div>
        </header>
    );
}

export default Navbar;
