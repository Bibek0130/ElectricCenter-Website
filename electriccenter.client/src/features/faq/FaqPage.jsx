import { useMemo, useState } from 'react';
import Section from '../../components/layout/Section.jsx';
import Input from '../../components/ui/Input.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';
import { FAQS } from '../../seo/faqs.js';


function generatePanelId(id) { return `faq-panel-${id}`; }
function generateButtonId(id) { return `faq-button-${id}`; }

export default function FaqPage() {
    const [query, setQuery] = useState('');
    const [openId, setOpenId] = useState(null);

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return FAQS;
        return FAQS.filter((f) => f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q));
    }, [query]);

    function toggle(id) {
        setOpenId((prev) => (prev === id ? null : id));
    }

    return (
        <Section eyebrow="Support" title="Frequently Asked Questions" containerClassName="page-container" style={{ maxWidth: 760, margin: '0 auto' }}>
            <div style={{ marginBottom: 'var(--space-6)' }}>
                <label htmlFor="faq-search" className="form-label" style={{ display: 'block', marginBottom: 6 }}>
                    Search FAQs
                </label>
                <Input
                    id="faq-search"
                    type="search"
                    placeholder="Search by keyword…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    aria-label="Search frequently asked questions"
                />
                <p style={{ marginTop: 8, fontSize: 'var(--text-xs)', color: 'var(--color-text-subtle)' }}>
                    Showing {filtered.length} of {FAQS.length}
                </p>
            </div>

            <section aria-live="polite">
                {filtered.length === 0 ? (
                    <EmptyState title="No results found" description="Try a different keyword." />
                ) : (
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                        {filtered.map((item) => {
                            const panelId = generatePanelId(item.id);
                            const buttonId = generateButtonId(item.id);
                            const expanded = openId === item.id;
                            return (
                                <li key={item.id} className="card" style={{ overflow: 'hidden' }}>
                                    <button
                                        id={buttonId}
                                        aria-controls={panelId}
                                        aria-expanded={expanded}
                                        onClick={() => toggle(item.id)}
                                        style={{
                                            width: '100%',
                                            textAlign: 'left',
                                            padding: 'var(--space-4) var(--space-5)',
                                            background: expanded ? 'var(--color-gray-50)' : 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: 'var(--text-base)',
                                        }}
                                    >
                                        <span style={{ fontWeight: 600 }}>{item.question}</span>
                                    </button>
                                    <div
                                        id={panelId}
                                        role="region"
                                        aria-labelledby={buttonId}
                                        hidden={!expanded}
                                        style={{
                                            padding: expanded ? 'var(--space-4) var(--space-5)' : 0,
                                            borderTop: expanded ? '1px solid var(--color-border)' : 'none',
                                            background: 'var(--color-gray-50)',
                                        }}
                                    >
                                        {/* Always rendered, just hidden while closed: the FAQ structured data on this page quotes
                                            these answers, and search engines only trust markup that matches text in the page. */}
                                        <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{item.answer}</p>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}
            </section>
        </Section>
    );
}
