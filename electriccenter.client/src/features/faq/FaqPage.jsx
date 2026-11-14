import { useMemo, useState } from 'react';
import Section from '../../components/layout/Section.jsx';
import Input from '../../components/ui/Input.jsx';
import EmptyState from '../../components/ui/EmptyState.jsx';

const FAQS = [
    { id: 'booking', question: 'How do I book an electrician?', answer: 'Go to the Electricians page, pick one based on their specialty, experience and rate, then open their profile and tap "Book". You will get a confirmation and the electrician is notified over WhatsApp.' },
    { id: 'response-time', question: 'How fast can an electrician reach me?', answer: 'Most electricians in Kathmandu valley respond within 1-2 hours for urgent jobs. Response time varies by electrician and current demand, shown on their profile.' },
    { id: 'pricing', question: 'How is pricing determined?', answer: 'Each electrician sets their own rate, shown per hour or per visit on their profile. You will always see the rate before booking; final cost depends on the scope of work.' },
    { id: 'areas', question: 'What areas do you serve?', answer: 'We currently serve Kathmandu valley, including Kumarigal, Kathmandu Metro, Lalitpur, and Bhaktapur. Electrician availability may vary by area.' },
    { id: 'products', question: 'Can I buy parts without booking an electrician?', answer: 'Yes — browse the Products page for circuit breakers, wiring, switches, lighting, tools and solar equipment, with delivery across Nepal.' },
    { id: 'support', question: 'How can I get support?', answer: 'Call or WhatsApp us at +977-9841445050, or visit our store in Kharibot, Kumarigal, Kathmandu during business hours.' },
];

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
                                        {expanded && <p style={{ color: 'var(--color-text-muted)', lineHeight: 1.6 }}>{item.answer}</p>}
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
