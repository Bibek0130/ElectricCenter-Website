import Section from '../../components/layout/Section.jsx';

const STATS = [
    { num: '30+', label: 'Years in Business' },
    { num: '500+', label: 'Products' },
    { num: '10,000+', label: 'Happy Customers' },
    { num: '50+', label: 'Expert Staff' },
];

function AboutPage() {
    return (
        <div>
            <div className="products-hero">
                <p className="section-eyebrow" style={{ color: 'var(--color-primary-200)' }}>Who we are</p>
                <h1 className="products-hero-title">About Us</h1>
            </div>

            <Section>
                <div className="grid-responsive" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 'var(--space-16)' }}>
                    <div>
                        <h2 style={{ marginBottom: 'var(--space-4)' }}>Nepal's Trusted Electrical Supplier</h2>
                        <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.8, marginBottom: 'var(--space-4)' }}>
                            Electric Center has been serving Kathmandu and Nepal since 1995. From a small shop in Kumarigal, we've grown into one of the valley's largest electrical supply stores.
                        </p>
                        <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
                            We carry everything from basic wiring materials to industrial equipment, connect customers with vetted electricians, and our expert team is always ready to help you find the right solution for your project.
                        </p>
                    </div>
                    <div className="grid-responsive" style={{ gridTemplateColumns: '1fr 1fr' }}>
                        {STATS.map((s) => (
                            <div key={s.label} style={{ background: 'var(--color-primary-50)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-5)', textAlign: 'center' }}>
                                <div style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--text-2xl)', fontWeight: 800, color: 'var(--color-primary)' }}>{s.num}</div>
                                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)', marginTop: 4 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ background: 'var(--color-gray-50)', borderRadius: 'var(--radius-lg)', padding: 'var(--space-8)', borderLeft: '4px solid var(--color-primary)' }}>
                    <h3 style={{ marginBottom: 'var(--space-3)' }}>Our Mission</h3>
                    <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.8 }}>
                        To be Nepal's most reliable electrical partner — offering quality products, trusted electricians, expert advice, and professional services at fair prices, helping build a safer and more connected Nepal.
                    </p>
                </div>
            </Section>
        </div>
    );
}

export default AboutPage;
