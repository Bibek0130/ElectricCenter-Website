import { Link } from 'react-router-dom';

const EXPLORE_LINKS = [
    { label: 'Electricians', to: '/electricians' },
    { label: 'Products Catalogue', to: '/products' },
    { label: 'Articles & Guides', to: '/articles' },
    { label: 'Our Services', to: '/services' },
    { label: 'About Us', to: '/about' },
];

const QUICK_LINKS = [
    { label: '⚡ Find an Electrician', to: '/electricians' },
    { label: '📦 Browse Products', to: '/products' },
    { label: '🛠️ Our Services', to: '/services' },
    { label: 'ℹ️ About Us', to: '/about' },
];

function Footer() {
    return (
        <footer className="footer">
            <div className="footer-grid">
                <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-5)' }}>
                        <span className="navbar-brand-icon" aria-hidden="true">⚡</span>
                        <div>
                            <div style={{ fontSize: 'var(--text-base)', fontWeight: 700 }}>Electric Center</div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-400)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Kathmandu, Nepal</div>
                        </div>
                    </div>
                    <p className="footer-about-text">
                        Kathmandu's premier electrical supply store since 1995. We provide quality electrical products, equipment, and professional electrician booking to homes, businesses, and contractors across Nepal.
                    </p>
                    <a href="tel:+9779841445050" className="btn btn-primary btn-sm">📞 +977-9841445050</a>
                </div>

                <div>
                    <h4 className="footer-heading">Explore</h4>
                    <ul className="footer-link-list">
                        {EXPLORE_LINKS.map((l) => (
                            <li key={l.label}><Link to={l.to}><span aria-hidden="true">▸</span> {l.label}</Link></li>
                        ))}
                    </ul>
                </div>

                <div>
                    <h4 className="footer-heading">Quick Links</h4>
                    <ul className="footer-link-list">
                        {QUICK_LINKS.map((l) => (
                            <li key={l.label}><Link to={l.to}>{l.label}</Link></li>
                        ))}
                    </ul>
                    <div className="footer-hours">
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-gray-400)', marginBottom: 4 }}>Business Hours</div>
                        <div>Sun–Fri: 9:00 AM – 7:00 PM<br />Sat: 10:00 AM – 5:00 PM</div>
                    </div>
                </div>
            </div>

            <div className="footer-bottom">
                © {new Date().getFullYear()} Panchamukhi Electric Center, Kharibot, Kumarigal, Kathmandu. All rights reserved.
            </div>
        </footer>
    );
}

export default Footer;
