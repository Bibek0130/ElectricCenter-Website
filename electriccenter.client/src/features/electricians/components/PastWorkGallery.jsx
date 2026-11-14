import { useState } from 'react';
import Modal from '../../../components/ui/Modal.jsx';

/** @param {{ pastWorks: import('../../../types/models.js').PastWork[] }} props */
function PastWorkGallery({ pastWorks }) {
    const [activeIndex, setActiveIndex] = useState(null);
    const active = activeIndex != null ? pastWorks[activeIndex] : null;

    if (!pastWorks || pastWorks.length === 0) {
        return <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)' }}>No past work photos yet.</p>;
    }

    return (
        <>
            <div className="grid-responsive" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
                {pastWorks.map((work, index) => (
                    <button
                        key={work.title + work.date}
                        type="button"
                        onClick={() => setActiveIndex(index)}
                        className="card"
                        style={{ padding: 0, overflow: 'hidden', textAlign: 'left', cursor: 'pointer', border: '1px solid var(--color-border)' }}
                        aria-label={`View larger image: ${work.title}`}
                    >
                        <img src={work.image} alt={work.title} style={{ width: '100%', height: 150, objectFit: 'cover' }} loading="lazy" />
                        <div style={{ padding: 'var(--space-3) var(--space-4)' }}>
                            <p style={{ fontWeight: 700, fontSize: 'var(--text-sm)', marginBottom: 2 }}>{work.title}</p>
                            <p style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                                {new Date(work.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                            </p>
                        </div>
                    </button>
                ))}
            </div>

            <Modal open={active != null} onClose={() => setActiveIndex(null)} title={active?.title} size="lg">
                {active && (
                    <>
                        <img src={active.image} alt={active.title} style={{ width: '100%', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-4)' }} />
                        <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{active.description}</p>
                    </>
                )}
            </Modal>
        </>
    );
}

export default PastWorkGallery;
