/**
 * Everything search engines and link previews are told about the site, in one place.
 *
 * - The browser reads it to keep the tab title, description and canonical link right as visitors navigate.
 * - The build copies it to `seo-data.json` (see vite.config.js) and the server reads THAT to write the same tags,
 *   the sitemap and the structured data into the page source, before any JavaScript runs. So a new page's SEO is
 *   written once, here, and both sides agree.
 *
 * Plain data and pure functions only: this file is also imported by Node during the build, so it must not
 * import JSX, CSS or images.
 */
import { FAQS } from './faqs.js';

export { FAQS };

export const ROBOTS_INDEX = 'index, follow, max-image-preview:large';
export const ROBOTS_NOINDEX = 'noindex, nofollow';

export const SITE = Object.freeze({
    name: 'Panchamukhi Electric Center',
    /** Appended to a page's own title. Home already carries the name, so it isn't added twice. */
    titleSuffix: ' | Panchamukhi Electric Center',
    locale: 'en_NP',
    language: 'en',
    defaultDescription: 'Panchamukhi Electric Center — electrical products, wiring supplies and vetted electrician booking in Kathmandu, Nepal.',
    /** The image link previews (WhatsApp, Facebook, X) show when a page has no picture of its own. 1200×630. */
    defaultImage: '/og-default.jpg',
    defaultImageAlt: 'Panchamukhi Electric Center — electrical supplies and electricians in Kathmandu',
    defaultImageWidth: 1200,
    defaultImageHeight: 630,
    logo: '/logo-512.png',
    themeColor: '#dc2626',
});

/** The shop's details. Keep in step with the footer, the map section and the FAQ answers. */
export const BUSINESS = Object.freeze({
    name: SITE.name,
    description: 'Electrical products, wiring supplies and licensed electricians in Kathmandu, Nepal, serving homes, businesses and contractors since 1995.',
    foundingYear: 1995,
    phone: '+977-9841445050',
    address: Object.freeze({
        street: 'Panchamukhi Hanuman Mandir, Kharibot, Kumarigal',
        locality: 'Kathmandu',
        region: 'Bagmati',
        country: 'NP',
    }),
    geo: Object.freeze({ latitude: 27.714095, longitude: 85.354542 }),
    openingHours: Object.freeze([
        Object.freeze({ days: Object.freeze(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']), opens: '09:00', closes: '19:00' }),
        Object.freeze({ days: Object.freeze(['Saturday']), opens: '10:00', closes: '17:00' }),
    ]),
    areaServed: Object.freeze(['Kathmandu', 'Lalitpur', 'Bhaktapur']),
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=27.714095,85.354542',
});

/** The main navigation. The navbar renders it, and the server writes it into the no-JavaScript fallback so crawlers can follow it. */
export const NAV_LINKS = Object.freeze([
    Object.freeze({ label: 'Home', to: '/' }),
    Object.freeze({ label: 'Electricians', to: '/electricians' }),
    Object.freeze({ label: 'Products', to: '/products' }),
    Object.freeze({ label: 'Articles', to: '/articles' }),
    Object.freeze({ label: 'Services', to: '/services' }),
    Object.freeze({ label: 'About Us', to: '/about' }),
    Object.freeze({ label: 'FAQ', to: '/faq' }),
]);

/**
 * The pages with a fixed address, keyed by path.
 * - title: the page's own title; the site name is appended (see formatTitle).
 * - description: the snippet search engines show. Aim for 70–160 characters.
 * - heading: the page's visible <h1>, repeated in the no-JavaScript fallback.
 * - robots: set to ROBOTS_NOINDEX for pages that must stay out of search results (log in, checkout, admin, ...).
 *   Pages without it are indexable and are listed in the sitemap.
 * - schema: structured data to add ('business', 'website', 'faq').
 *
 * Every <Route> in App.jsx must have an entry here, or the server answers it with a 404 status
 * (a test fails if one is missing). Pages with a dynamic address (/articles/:slug, /electricians/:id)
 * are built from their own data instead.
 */
export const PAGES = Object.freeze({
    '/': {
        title: 'Panchamukhi Electric Center | Electrical Supplies, Kathmandu',
        description: 'Panchamukhi Electric Center — electrical products, wiring supplies and vetted electrician booking in Kathmandu, Nepal. Visit our Kharibot shop or order online.',
        heading: 'Powering Every Connection',
        schema: ['business', 'website'],
    },
    '/electricians': {
        title: 'Electricians in Kathmandu',
        description: 'Find vetted electricians across Kathmandu valley. Compare specialties, experience and rates, then book online and get a WhatsApp confirmation.',
        heading: 'Find an Electrician',
    },
    '/products': {
        title: 'Electrical Products & Supplies',
        description: 'Shop circuit breakers, wiring, switches, lighting, tools and solar equipment from top brands, with delivery across Nepal.',
        heading: 'Electrical Products',
    },
    '/articles': {
        title: 'Electrical Tips & Guides',
        description: 'Practical electrical advice from Panchamukhi Electric Center: choosing the right products, wiring safety and keeping your home powered in Nepal.',
        heading: 'Articles & Guides',
    },
    '/services': {
        title: 'Electrical Services',
        description: 'Electrical installation, maintenance and repair, consultation and design, and bulk supply for homes, offices and contractors in Kathmandu.',
        heading: 'Our Services',
    },
    '/about': {
        title: 'About Us',
        description: 'Panchamukhi Electric Center has supplied Kathmandu with electrical products and vetted electricians since 1995, from a small shop in Kumarigal.',
        heading: 'About Us',
    },
    '/faq': {
        title: 'Frequently Asked Questions',
        description: 'Answers about booking an electrician, response times, pricing, service areas, buying parts and getting support from Panchamukhi Electric Center.',
        heading: 'Frequently Asked Questions',
        schema: ['faq'],
    },

    // Not for search results: accounts, checkout and admin screens.
    '/login': { title: 'Log in', robots: ROBOTS_NOINDEX },
    '/register': { title: 'Create an account', robots: ROBOTS_NOINDEX },
    '/verify-email': { title: 'Verify your email', robots: ROBOTS_NOINDEX },
    '/account': { title: 'My account', robots: ROBOTS_NOINDEX },
    '/settings': { title: 'Settings', robots: ROBOTS_NOINDEX },
    '/products/checkout': { title: 'Checkout', robots: ROBOTS_NOINDEX },
    '/products/confirmation': { title: 'Order confirmed', robots: ROBOTS_NOINDEX },
    '/admin/articles/new': { title: 'New article', robots: ROBOTS_NOINDEX },
});

/** Placeholders are written {like_this}. */
export const TEMPLATES = Object.freeze({
    electrician: {
        title: '{name} – Electrician in {location}',
        description: '{name} is a vetted electrician in {location} with {years} years of experience. See specialties and rates, then book online with Panchamukhi Electric Center.',
    },
});

/** "/About/" -> "/about"; "/" stays "/". Lowercased because routes are case-insensitive. Query and hash are dropped. */
export function normalizePath(path) {
    const clean = String(path ?? '').split(/[?#]/)[0].trim().toLowerCase().replace(/\/{2,}/g, '/');
    if (!clean || clean === '/') return '/';
    const withSlash = clean.startsWith('/') ? clean : `/${clean}`;
    return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') || '/' : withSlash;
}

/** The fixed-address page entry for a path, or undefined for dynamic and unknown routes. */
export function pageForPath(path) {
    return PAGES[normalizePath(path)];
}

/** Adds the site name to a page title unless it's already there. */
export function formatTitle(title) {
    if (!title) return SITE.name;
    return title.includes(SITE.name) ? title : `${title}${SITE.titleSuffix}`;
}

/** fillTemplate('{name} in {place}', { name: 'Ram', place: 'Kathmandu' }) -> 'Ram in Kathmandu' */
export function fillTemplate(template, values) {
    return template.replace(/\{(\w+)\}/g, (match, key) => (values[key] == null ? match : String(values[key])));
}

/** The title and description for an electrician's profile page. */
export function electricianSeo(electrician) {
    const values = { name: electrician.name, location: electrician.location, years: electrician.yearsExperience };
    return {
        title: fillTemplate(TEMPLATES.electrician.title, values),
        description: fillTemplate(TEMPLATES.electrician.description, values),
    };
}

/** What the build hands to the server. The shape is mirrored by the server's SeoSiteData. */
export function toServerData() {
    return {
        site: SITE,
        business: BUSINESS,
        nav: NAV_LINKS,
        pages: PAGES,
        templates: TEMPLATES,
        faqs: FAQS,
    };
}
