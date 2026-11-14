// FAQ page component
// File: FAQ page.jsx
// Purpose: Renders a searchable, accessible FAQ accordion for the ElectricCenter client app.

import React, { useState, useMemo } from "react";

/* Sample FAQ data - replace or extend with real content as needed */
const FAQS = [
  {
    id: "install",
    question: "How do I install the ElectricCenter app?",
    answer:
      "Download the installer from the official site, run the setup and follow the on-screen instructions. Administrator privileges may be required on some systems.",
  },
  {
    id: "pricing",
    question: "What pricing plans are available?",
    answer:
      "We offer multiple plans tailored to different needs: Free, Pro, and Enterprise. See the pricing page for current details and feature comparisons.",
  },
  {
    id: "support",
    question: "How can I get support?",
    answer:
      "Open a ticket via the support portal or email support@electriccenter.example. For urgent issues, use the phone number listed on the contact page.",
  },
  {
    id: "integration",
    question: "Does ElectricCenter integrate with other tools?",
    answer:
      "Yes — ElectricCenter provides APIs and pre-built connectors for popular platforms. Check the integrations section in the docs for specifics.",
  },
];

function generatePanelId(faqId) {
  return `faq-panel-${faqId}`;
}

function generateButtonId(faqId) {
  return `faq-button-${faqId}`;
}

export default function FAQPage() {
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQS;
    return FAQS.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q)
    );
  }, [query]);

  function toggle(id) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <main aria-labelledby="faq-heading" style={{ padding:"1% 10% 1% 10%", maxWidth: 1200 }}>
      <h1 id="faq-heading">Frequently Asked Questions</h1>

      {/* Search box */}
      <div style={{ margin: "12px 0 20px 0" }}>
        <label htmlFor="faq-search" style={{ display: "block", marginBottom: 6 }}>
          Search FAQs
        </label>
        <input
          id="faq-search"
          type="search"
          placeholder="Search by keyword..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 10px",
            fontSize: 16,
            boxSizing: "border-box",
          }}
          aria-label="Search frequently asked questions"
        />
        <div style={{ marginTop: 8, fontSize: 13, color: "#666" }}>
          Showing {filtered.length} of {FAQS.length}
        </div>
      </div>

      {/* Accordion list */}
      <section aria-live="polite">
        {filtered.length === 0 ? (
          <p>No results found.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {filtered.map((item) => {
              const panelId = generatePanelId(item.id);
              const buttonId = generateButtonId(item.id);
              const expanded = openId === item.id;
              return (
                <li key={item.id} style={{ marginBottom: 8 }}>
                  <div
                    style={{
                      border: "1px solid #ddd",
                      borderRadius: 6,
                      overflow: "hidden",
                    }}
                  >
                    <button
                      id={buttonId}
                      aria-controls={panelId}
                      aria-expanded={expanded}
                      onClick={() => toggle(item.id)}
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "12px 16px",
                        background: expanded ? "#f7f7f7" : "#fff",
                        border: "none",
                        cursor: "pointer",
                        fontSize: 16,
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
                        padding: expanded ? "12px 16px" : 0,
                        borderTop: "1px solid #eee",
                        background: "#fafafa",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {expanded && <p style={{ margin: 0 }}>{item.answer}</p>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
          </section>
    </main>
  );
}