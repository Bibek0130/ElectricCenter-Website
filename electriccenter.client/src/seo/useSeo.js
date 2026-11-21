import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MANAGED_SELECTORS, buildSeoTags } from './seoTags.js';
import { PAGES, ROBOTS_NOINDEX, normalizePath } from './siteSeo.js';

/** The server writes the site's public address into the page; use it so tags set here match the ones it wrote. */
export function siteBaseUrl(doc = document) {
    const fromServer = doc.querySelector('meta[name="site-base-url"]')?.getAttribute('content');
    return String(fromServer || window.location.origin).replace(/\/+$/, '');
}

/** Writes the title and head tags into the document, creating, updating or removing them as needed. */
export function applySeoTags(doc, { title, tags }) {
    doc.title = title;

    const wanted = new Set();
    for (const tag of tags) {
        wanted.add(tag.selector);
        let element = doc.head.querySelector(tag.selector);
        if (!element) {
            element = doc.createElement(tag.element);
            doc.head.appendChild(element);
        }
        for (const [name, value] of Object.entries(tag.attrs)) element.setAttribute(name, value);
    }

    for (const selector of MANAGED_SELECTORS) {
        if (!wanted.has(selector)) doc.head.querySelector(selector)?.remove();
    }
}

/**
 * The server puts structured data (business details, FAQ, article...) in the page it returns, tagged with the route
 * it belongs to. Once the visitor navigates elsewhere that data describes the wrong page, so drop it.
 * (Crawlers load each URL fresh and get the right data from the server; this only keeps a long-lived tab honest.)
 */
export function dropStaleJsonLd(doc, pathname) {
    const script = doc.getElementById('seo-jsonld');
    if (script && script.dataset.route !== normalizePath(pathname)) script.remove();
}

/**
 * Sets the page's title, description, canonical link and social-preview tags. Pass `null` to leave them alone
 * (e.g. while the page's data is still loading, so the server-written tags aren't replaced by a placeholder).
 * @param {import('./seoTags.js').SeoSpec | null} spec
 */
export function useSeo(spec) {
    const key = spec ? JSON.stringify(spec) : '';

    useEffect(() => {
        if (!spec) return;
        applySeoTags(document, buildSeoTags(spec, siteBaseUrl(document)));
        dropStaleJsonLd(document, window.location.pathname);
        // `key` stands in for `spec`, which is a new object on every render.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);
}

/**
 * The default for every page with a fixed address: look it up in PAGES. Called once, from the layout.
 * Pages with a dynamic address (an article, an electrician) are not in PAGES and call useSeo with their own data.
 */
export function useRouteSeo() {
    const { pathname } = useLocation();
    const path = normalizePath(pathname);
    const page = PAGES[path];

    useSeo(page ? { title: page.title, description: page.description, path, noindex: page.robots === ROBOTS_NOINDEX } : null);
}
