import { afterEach, describe, expect, it, vi } from 'vitest';
import { applySeoTags, dropStaleJsonLd, siteBaseUrl } from './useSeo.js';
import { buildSeoTags } from './seoTags.js';

/**
 * Just enough of a document to run the head-updating code without a browser. It understands the one selector shape
 * the app uses: tag[attribute="value"].
 */
function fakeDocument(existing = []) {
    const head = [];
    const create = (tagName) => ({
        tagName,
        attrs: {},
        dataset: {},
        setAttribute(name, value) { this.attrs[name] = value; },
        getAttribute(name) { return this.attrs[name] ?? null; },
        remove() { const index = head.indexOf(this); if (index >= 0) head.splice(index, 1); },
    });
    const matches = (element, selector) => {
        const parts = /^(\w+)\[([\w:-]+)="([^"]*)"\]$/.exec(selector);
        return Boolean(parts) && element.tagName === parts[1] && element.attrs[parts[2]] === parts[3];
    };

    const doc = {
        title: '',
        head: {
            appendChild: (element) => head.push(element),
            querySelector: (selector) => head.find((element) => matches(element, selector)) ?? null,
        },
        createElement: create,
        querySelector: (selector) => doc.head.querySelector(selector),
        getElementById: (id) => head.find((element) => element.attrs.id === id) ?? null,
        all: (selector) => head.filter((element) => matches(element, selector)),
        count: () => head.length,
    };

    for (const [tagName, attrs, dataset] of existing) {
        const element = create(tagName);
        Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, value));
        Object.assign(element.dataset, dataset);
        head.push(element);
    }
    return doc;
}

const BASE = 'https://shop.example';
const attr = (doc, selector, name) => doc.head.querySelector(selector)?.getAttribute(name);

describe('applySeoTags', () => {
    it('sets the title and creates the tags', () => {
        const doc = fakeDocument();
        applySeoTags(doc, buildSeoTags({ title: 'About Us', description: 'Who we are.', path: '/about' }, BASE));

        expect(doc.title).toBe('About Us | Panchamukhi Electric Center');
        expect(attr(doc, 'meta[name="description"]', 'content')).toBe('Who we are.');
        expect(attr(doc, 'link[rel="canonical"]', 'href')).toBe('https://shop.example/about');
        expect(attr(doc, 'meta[property="og:title"]', 'content')).toBe('About Us | Panchamukhi Electric Center');
    });

    it('updates a tag the server already wrote instead of adding a second one', () => {
        const doc = fakeDocument([
            ['meta', { name: 'description', content: 'server wrote this' }],
            ['link', { rel: 'canonical', href: 'https://shop.example/' }],
        ]);
        applySeoTags(doc, buildSeoTags({ title: 'FAQ', description: 'Questions.', path: '/faq' }, BASE));

        expect(doc.all('meta[name="description"]')).toHaveLength(1);
        expect(attr(doc, 'meta[name="description"]', 'content')).toBe('Questions.');
        expect(doc.all('link[rel="canonical"]')).toHaveLength(1);
        expect(attr(doc, 'link[rel="canonical"]', 'href')).toBe('https://shop.example/faq');
    });

    it('removes tags the next page does not use, so an article\'s details never linger on the page after it', () => {
        const doc = fakeDocument();
        applySeoTags(doc, buildSeoTags({
            title: 'Wiring', type: 'article', path: '/articles/wiring', publishedTime: '2026-01-01T00:00:00Z', author: 'Sita Rai',
        }, BASE));
        expect(attr(doc, 'meta[property="article:author"]', 'content')).toBe('Sita Rai');

        applySeoTags(doc, buildSeoTags({ title: 'About Us', path: '/about' }, BASE));

        expect(doc.head.querySelector('meta[property="article:author"]')).toBeNull();
        expect(doc.head.querySelector('meta[property="article:published_time"]')).toBeNull();
        expect(attr(doc, 'meta[property="og:type"]', 'content')).toBe('website');
    });

    it('drops the canonical link when the next page is kept out of the index', () => {
        const doc = fakeDocument();
        applySeoTags(doc, buildSeoTags({ title: 'About Us', path: '/about' }, BASE));
        expect(doc.head.querySelector('link[rel="canonical"]')).not.toBeNull();

        applySeoTags(doc, buildSeoTags({ title: 'Checkout', path: '/products/checkout', noindex: true }, BASE));

        expect(doc.head.querySelector('link[rel="canonical"]')).toBeNull();
        expect(attr(doc, 'meta[name="robots"]', 'content')).toBe('noindex, nofollow');
    });

    it('leaves tags it does not manage alone', () => {
        const doc = fakeDocument([
            ['meta', { name: 'viewport', content: 'width=device-width' }],
            ['meta', { name: 'theme-color', content: '#dc2626' }],
            ['meta', { name: 'site-base-url', content: BASE }],
        ]);
        applySeoTags(doc, buildSeoTags({ title: 'About Us', path: '/about' }, BASE));
        applySeoTags(doc, buildSeoTags({ title: 'FAQ', path: '/faq' }, BASE));

        expect(attr(doc, 'meta[name="viewport"]', 'content')).toBe('width=device-width');
        expect(attr(doc, 'meta[name="theme-color"]', 'content')).toBe('#dc2626');
        expect(attr(doc, 'meta[name="site-base-url"]', 'content')).toBe(BASE);
    });

    it('is idempotent: applying the same page twice changes nothing', () => {
        const doc = fakeDocument();
        const tags = buildSeoTags({ title: 'About Us', description: 'Who we are.', path: '/about' }, BASE);
        applySeoTags(doc, tags);
        const countAfterFirst = doc.count();
        applySeoTags(doc, tags);
        expect(doc.count()).toBe(countAfterFirst);
    });
});

describe('dropStaleJsonLd', () => {
    const jsonLd = (route) => [['script', { id: 'seo-jsonld' }, { route }]];

    it('removes structured data written for a different page', () => {
        const doc = fakeDocument(jsonLd('/faq'));
        dropStaleJsonLd(doc, '/about');
        expect(doc.getElementById('seo-jsonld')).toBeNull();
    });

    it('keeps it while the visitor is still on that page, however the address is spelled', () => {
        const doc = fakeDocument(jsonLd('/faq'));
        dropStaleJsonLd(doc, '/FAQ/');
        expect(doc.getElementById('seo-jsonld')).not.toBeNull();
    });

    it('does nothing when there is none', () => {
        expect(() => dropStaleJsonLd(fakeDocument(), '/about')).not.toThrow();
    });
});

describe('siteBaseUrl', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('uses the address the server wrote into the page, without a trailing slash', () => {
        const doc = fakeDocument([['meta', { name: 'site-base-url', content: 'https://www.example.com/' }]]);
        expect(siteBaseUrl(doc)).toBe('https://www.example.com');
    });

    it('falls back to the address of the page itself', () => {
        vi.stubGlobal('window', { location: { origin: 'https://fallback.example' } });
        expect(siteBaseUrl(fakeDocument())).toBe('https://fallback.example');
    });
});
