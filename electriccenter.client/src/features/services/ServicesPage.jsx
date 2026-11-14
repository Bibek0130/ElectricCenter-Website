import Card from '../../components/ui/Card.jsx';
import Section from '../../components/layout/Section.jsx';
import { services } from '../../data/content.js';

function ServicesPage() {
    return (
        <div>
            <div className="products-hero">
                <p className="section-eyebrow" style={{ color: 'var(--color-primary-200)' }}>What we do</p>
                <h1 className="products-hero-title">Our Services</h1>
                <p className="products-hero-subtitle">Professional electrical services for every project</p>
            </div>

            <Section>
                <div className="grid-responsive" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                    {services.map((s) => (
                        <Card key={s.title} style={{ display: 'flex', flexDirection: 'column', borderLeft: '4px solid var(--color-primary)' }}>
                            <div style={{ fontSize: 40, marginBottom: 'var(--space-4)' }} aria-hidden="true">{s.icon}</div>
                            <h3 style={{ marginBottom: 'var(--space-3)' }}>{s.title}</h3>
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', lineHeight: 1.6, marginBottom: 'var(--space-5)', flex: 1 }}>{s.desc}</p>
                            <a href="tel:+9779841445050" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                                📞 Get a quote →
                            </a>
                        </Card>
                    ))}
                </div>

                <div style={{ marginTop: 'var(--space-16)', background: 'linear-gradient(135deg, var(--color-primary-900), var(--color-primary-700))', borderRadius: 'var(--radius-xl)', padding: 'var(--space-10)', textAlign: 'center' }}>
                    <h2 style={{ color: 'var(--color-white)', marginBottom: 'var(--space-3)' }}>Ready to start your project?</h2>
                    <p style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 'var(--space-6)' }}>Call us or book a vetted electrician for a free consultation and quote.</p>
                    <a href="tel:+9779841445050" className="btn btn-lg" style={{ background: 'var(--color-white)', color: 'var(--color-primary)' }}>
                        📞 +977-9841445050
                    </a>
                </div>
            </Section>
        </div>
    );
}

export default ServicesPage;
