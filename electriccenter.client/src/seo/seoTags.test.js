import { describe, expect, it } from 'vitest';
import { MANAGED_SELECTORS, absoluteUrl, buildSeoTags } from './seoTags.js';
import { ROBOTS_INDEX, ROBOTS_NOINDEX, SITE } from './siteSeo.js';

const BASE = 'https://shop.example';
const byName = (tags, selector) => tags.find((tag) => tag.selector === selector)?.attrs;
const content = (tags, selector) => byName(tags, selector)?.content;

describe('absoluteUrl', () => {
    it.each([
        ['/x', 'https://shop.example/x'],
        ['x', 'https://shop.example/x'],
        ['https://cdn.example/a.jpg', 'https://cdn.example/a.jpg'],
        ['http://cdn.example/a.jpg', 'http://cdn.example/a.jpg'],
    ])('%s -> %s', (input, expected) => {
        expect(absoluteUrl(BASE, input)).toBe(expected);
    });

    it('does not double a trailing slash on the base', () => {
        expect(absoluteUrl('https://shop.example/', '/x')).toBe('https://shop.example/x');
    });
});

describe('buildSeoTags', () => {
    const page = buildSeoTags({ title: 'About Us', description: 'Who we are.', path: '/about' }, BASE);

    it('titles the page with the site name', () => {
        expect(page.title).toBe(`About Us${SITE.titleSuffix}`);
        expect(content(page.tags, 'meta[property="og:title"]')).toBe(page.title);
        expect(content(page.tags, 'meta[name="twitter:title"]')).toBe(page.title);
    });

    it('describes the page for search results and link previews', () => {
        expect(content(page.tags, 'meta[name="description"]')).toBe('Who we are.');
        expect(content(page.tags, 'meta[property="og:description"]')).toBe('Who we are.');
        expect(content(page.tags, 'meta[name="twitter:description"]')).toBe('Who we are.');
    });

    it('points search engines at the one canonical address', () => {
        expect(byName(page.tags, 'link[rel="canonical"]')).toEqual({ rel: 'canonical', href: 'https://shop.example/about' });
        expect(content(page.tags, 'meta[property="og:url"]')).toBe('https://shop.example/about');
        expect(content(page.tags, 'meta[name="robots"]')).toBe(ROBOTS_INDEX);
    });

    it('falls back to the site description and the site image, with the image size for the large card', () => {
        const bare = buildSeoTags({ title: 'Anything' }, BASE);
        expect(content(bare.tags, 'meta[name="description"]')).toBe(SITE.defaultDescription);
        expect(content(bare.tags, 'meta[property="og:image"]')).toBe(`${BASE}${SITE.defaultImage}`);
        expect(content(bare.tags, 'meta[property="og:image:alt"]')).toBe(SITE.defaultImageAlt);
        expect(content(bare.tags, 'meta[property="og:image:width"]')).toBe(String(SITE.defaultImageWidth));
        expect(content(bare.tags, 'meta[property="og:image:height"]')).toBe(String(SITE.defaultImageHeight));
        expect(content(bare.tags, 'meta[name="twitter:card"]')).toBe('summary_large_image');
    });

    it('uses the page\'s own image when it has one (and does not claim the site image\'s size for it)', () => {
        const own = buildSeoTags({ title: 'Wiring', image: 'https://cdn.example/wiring.jpg', imageAlt: 'A wiring diagram' }, BASE);
        expect(content(own.tags, 'meta[property="og:image"]')).toBe('https://cdn.example/wiring.jpg');
        expect(content(own.tags, 'meta[name="twitter:image"]')).toBe('https://cdn.example/wiring.jpg');
        expect(content(own.tags, 'meta[property="og:image:alt"]')).toBe('A wiring diagram');
        expect(byName(own.tags, 'meta[property="og:image:width"]')).toBeUndefined();
    });

    it('describes the image with the title when no description was given', () => {
        const own = buildSeoTags({ title: 'Wiring', image: '/img/x.jpg' }, BASE);
        expect(content(own.tags, 'meta[property="og:image:alt"]')).toBe('Wiring');
        expect(content(own.tags, 'meta[property="og:image"]')).toBe(`${BASE}/img/x.jpg`);
    });

    it('keeps a noindex page out of results and gives it no canonical address', () => {
        const hidden = buildSeoTags({ title: 'Checkout', path: '/products/checkout', noindex: true }, BASE);
        expect(content(hidden.tags, 'meta[name="robots"]')).toBe(ROBOTS_NOINDEX);
        expect(byName(hidden.tags, 'link[rel="canonical"]')).toBeUndefined();
    });

    it('adds the publication details for an article, and only for an article', () => {
        const article = buildSeoTags({
            title: 'Wiring', type: 'article', path: '/articles/wiring',
            publishedTime: '2026-01-02T03:04:05Z', modifiedTime: '2026-02-03T00:00:00Z', author: 'Sita Rai',
        }, BASE);
        expect(content(article.tags, 'meta[property="og:type"]')).toBe('article');
        expect(content(article.tags, 'meta[property="article:published_time"]')).toBe('2026-01-02T03:04:05Z');
        expect(content(article.tags, 'meta[property="article:modified_time"]')).toBe('2026-02-03T00:00:00Z');
        expect(content(article.tags, 'meta[property="article:author"]')).toBe('Sita Rai');

        expect(byName(page.tags, 'meta[property="article:author"]')).toBeUndefined();
        expect(content(page.tags, 'meta[property="og:type"]')).toBe('website');
    });

    it('only ever emits tags the app knows how to clean up again', () => {
        const maximal = buildSeoTags({
            title: 'T', description: 'D', path: '/p', type: 'article', image: '/i.jpg', imageAlt: 'A',
            publishedTime: 'x', modifiedTime: 'y', author: 'Z',
        }, BASE);
        const everything = new Set([...maximal.tags, ...page.tags, ...buildSeoTags({ title: 'T', noindex: true }, BASE).tags].map((tag) => tag.selector));
        for (const selector of everything) expect(MANAGED_SELECTORS, selector).toContain(selector);
    });

    it('can emit every managed tag (so the list has no dead entries)', () => {
        const maximalDefaultImage = buildSeoTags({
            title: 'T', description: 'D', path: '/p', type: 'article', publishedTime: 'x', modifiedTime: 'y', author: 'Z',
        }, BASE);
        const maximalOwnImage = buildSeoTags({ title: 'T', path: '/p', image: '/i.jpg' }, BASE);
        const emitted = new Set([...maximalDefaultImage.tags, ...maximalOwnImage.tags].map((tag) => tag.selector));
        expect([...MANAGED_SELECTORS].filter((selector) => !emitted.has(selector))).toEqual([]);
    });
});
