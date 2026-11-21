/**
 * The FAQ entries. One list feeds the visible FAQ page AND the FAQPage structured data the server puts in the page
 * source, so what search engines read always matches what visitors see (Google ignores FAQ markup that doesn't).
 * Plain data only: this file is also loaded by Node at build time (see vite.config.js), so it must not import JSX or assets.
 */
export const FAQS = Object.freeze([
    { id: 'booking', question: 'How do I book an electrician?', answer: 'Go to the Electricians page, pick one based on their specialty, experience and rate, then open their profile and tap "Book". You will get a confirmation and the electrician is notified over WhatsApp.' },
    { id: 'response-time', question: 'How fast can an electrician reach me?', answer: 'Most electricians in Kathmandu valley respond within 1-2 hours for urgent jobs. Response time varies by electrician and current demand, shown on their profile.' },
    { id: 'pricing', question: 'How is pricing determined?', answer: 'Each electrician sets their own rate, shown per hour or per visit on their profile. You will always see the rate before booking; final cost depends on the scope of work.' },
    { id: 'areas', question: 'What areas do you serve?', answer: 'We currently serve Kathmandu valley, including Kumarigal, Kathmandu Metro, Lalitpur, and Bhaktapur. Electrician availability may vary by area.' },
    { id: 'products', question: 'Can I buy parts without booking an electrician?', answer: 'Yes — browse the Products page for circuit breakers, wiring, switches, lighting, tools and solar equipment, with delivery across Nepal.' },
    { id: 'support', question: 'How can I get support?', answer: 'Call or WhatsApp us at +977-9841445050, or visit our store in Kharibot, Kumarigal, Kathmandu during business hours.' },
]);
