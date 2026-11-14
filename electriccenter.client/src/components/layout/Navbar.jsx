import { NavLink } from 'react-router-dom';
import { useDisclosure } from '../../hooks/useDisclosure.js';
import { useAuth } from '../../features/auth/useAuth.js';

const NAV_LINKS = [
    { label: 'Home', to: '/home' },
    { label: 'Electricians', to: '/electricians' },
    { label: 'Products', to: '/products' },
    { label: 'Services', to: '/services' },
    { label: 'About Us', to: '/about' },
    { label: 'FAQ', to: '/faq' },
];

function Navbar() {
    const mobileMenu = useDisclosure(false);
    const { status, user } = useAuth();

    return (
        <header className="navbar">
            <div className="navbar-inner">
                <NavLink to="/home" className="navbar-brand" onClick={mobileMenu.close}>
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
                            className={({ isActive }) => `navbar-link${isActive ? ' is-active' : ''}`}
                            onClick={mobileMenu.close}
                        >
                            {link.label}
                        </NavLink>
                    ))}

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
                    <span aria-hidden="true">📞</span> +977-9841445050
                </a>
            </div>
        </header>
    );
}

export default Navbar;
