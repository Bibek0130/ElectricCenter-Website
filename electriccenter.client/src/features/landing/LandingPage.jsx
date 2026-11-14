import { useState } from 'react';
import { Link } from 'react-router-dom';
import MapSection from '../../components/Maps/MapSection.jsx';
import Section from '../../components/layout/Section.jsx';
import Card from '../../components/ui/Card.jsx';
import { shopImages, whyChooseUs } from '../../data/content.js';

function LandingPage() {
    const [current, setCurrent] = useState(0);
    const [animating, setAnimating] = useState(false);

    const goTo = (i) => {
        setAnimating(true);
        setTimeout(() => {
            setCurrent(i);
            setAnimating(false);
        }, 300);
    };

    return (
        <>
            <section style={{ position: 'relative', height: '88vh', minHeight: 520, overflow: 'hidden' }}>
                <div
                    style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url(${shopImages[current].url})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        transition: `opacity ${animating ? '0ms' : '400ms'} ease`,
                        opacity: animating ? 0 : 1,
                    }}
                />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(127,29,29,0.85) 0%, rgba(0,0,0,0.55) 60%, transparent 100%)' }} />

                <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '0 7vw', maxWidth: 700 }}>
                    <span className="badge badge-primary" style={{ background: 'var(--color-primary)', color: 'var(--color-white)', width: 'fit-content', marginBottom: 'var(--space-5)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                        Panchamukhi Electric Center
                    </span>
                    <h1 style={{ color: 'var(--color-white)', fontSize: 'clamp(36px, 6vw, 68px)', marginBottom: 'var(--space-5)' }}>
                        Powering Every<br />
                        <span style={{ color: 'var(--color-primary-300)' }}>Connection</span>
                    </h1>
                    <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-8)', maxWidth: 440, lineHeight: 1.6 }}>
                        Your complete source for electrical equipment, supplies, licensed electricians, and expert services in Nepal.
                    </p>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
                        <Link to="/electricians" className="btn btn-primary btn-lg" style={{ background: 'var(--color-white)', color: 'var(--color-primary)' }}>
                            Book an Electrician →
                        </Link>
                        <Link to="/products" className="btn btn-lg" style={{ background: 'transparent', color: 'var(--color-white)', border: '2px solid rgba(255,255,255,0.6)' }}>
                            Shop Products
                        </Link>
                    </div>
                </div>

                <div style={{ position: 'absolute', bottom: 80, right: 40, zIndex: 2, background: 'rgba(0,0,0,0.5)', color: 'var(--color-white)', padding: '6px 16px', borderRadius: 'var(--radius-full)', fontSize: 'var(--text-sm)', backdropFilter: 'blur(4px)' }}>
                    {shopImages[current].caption}
                </div>

                <div style={{ position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, zIndex: 2 }}>
                    {shopImages.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => goTo(i)}
                            aria-label={`Show slide ${i + 1}`}
                            aria-current={i === current}
                            style={{
                                width: i === current ? 28 : 8,
                                height: 8,
                                borderRadius: 4,
                                background: i === current ? 'var(--color-white)' : 'rgba(255,255,255,0.4)',
                                border: 'none',
                                cursor: 'pointer',
                                transition: 'all var(--transition-slow)',
                                padding: 0,
                            }}
                        />
                    ))}
                </div>
            </section>

            <Section eyebrow="Why choose us" title="The Electric Center Difference">
                <div className="grid-responsive">
                    {whyChooseUs.map((c) => (
                        <Card key={c.title} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: 36, marginBottom: 'var(--space-3)' }} aria-hidden="true">{c.icon}</div>
                            <h3 style={{ marginBottom: 'var(--space-2)' }}>{c.title}</h3>
                            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{c.desc}</p>
                        </Card>
                    ))}
                </div>
            </Section>

            <MapSection />
        </>
    );
}

export default LandingPage;
