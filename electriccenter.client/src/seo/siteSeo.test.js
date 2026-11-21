import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
    BUSINESS, FAQS, NAV_LINKS, PAGES, ROBOTS_NOINDEX, SITE, TEMPLATES,
    electricianSeo, fillTemplate, formatTitle, normalizePath, pageForPath, toServerData,
} from './siteSeo.js';

const indexablePages = Object.entries(PAGES).filter(([, page]) => !page.robots);
const hiddenPages = Object.entries(PAGES).filter(([, page]) => page.robots);

describe('page titles and descriptions', () => {
    it.each(indexablePages)('%s has a title that fits in a search result and a description of a useful length', (path, page) => {
        // Search engines show about 60 characters of a title and about 160 of a description.
        expect(formatTitle(page.title).length, `title of ${path}`).toBeLessThanOrEqual(62);
        expect(page.description?.length ?? 0, `description of ${path}`).toBeGreaterThanOrEqual(70);
        expect(page.description.length, `description of ${path}`).toBeLessThanOrEqual(160);
        expect(page.heading, `heading of ${path}`).toBeTruthy();
    });

    it('gives every indexable page its own title and its own description', () => {
        const titles = indexablePages.map(([, page]) => formatTitle(page.title));
        const descriptions = indexablePages.map(([, page]) => page.description);
        expect(new Set(titles).size).toBe(titles.length);
        expect(new Set(descriptions).size).toBe(descriptions.length);
    });

    it.each(hiddenPages)('%s is kept out of search results', (path, page) => {
        expect(page.robots).toBe(ROBOTS_NOINDEX);
    });

    it('keeps the account, checkout and admin screens out of search results', () => {
        for (const path of ['/login', '/register', '/verify-email', '/account', '/settings', '/products/checkout', '/products/confirmation', '/admin/articles/new']) {
            expect(PAGES[path]?.robots, path).toBe(ROBOTS_NOINDEX);
        }
    });

    it('lets the public pages be indexed', () => {
        for (const path of ['/', '/electricians', '/products', '/articles', '/services', '/about', '/faq']) {
            expect(PAGES[path]?.robots, path).toBeUndefined();
        }
    });
});

describe('every route is known to the server', () => {
    const appSource = readFileSync(new URL('../app/App.jsx', import.meta.url), 'utf8');
    const routePaths = [...appSource.matchAll(/<Route[^>]*\spath="([^"]+)"/g)].map((match) => match[1]);

    // /home only redirects to "/". Routes with a parameter or a wildcard are built from their own data, not listed.
    const redirectsOnly = new Set(['/home']);
    const fixedRoutes = routePaths.filter((path) => !/[:*]/.test(path) && !redirectsOnly.has(path));

    it('finds the routes in App.jsx (so this test cannot pass by matching nothing)', () => {
        expect(routePaths.length).toBeGreaterThan(15);
        expect(fixedRoutes).toContain('/articles');
    });

    it('has an entry in PAGES for every fixed route (a missing one would make the server answer 404 for a real page)', () => {
        const missing = fixedRoutes.filter((path) => !PAGES[normalizePath(path)]);
        expect(missing).toEqual([]);
    });

    it('has a route in App.jsx for every entry in PAGES (an orphan entry would put a dead page in the sitemap)', () => {
        const known = new Set(fixedRoutes.map(normalizePath));
        const orphans = Object.keys(PAGES).filter((path) => !known.has(path));
        expect(orphans).toEqual([]);
    });
});

describe('navigation', () => {
    it('only links to indexable pages that exist', () => {
        for (const link of NAV_LINKS) {
            const page = PAGES[normalizePath(link.to)];
            expect(page, link.to).toBeDefined();
            expect(page.robots, link.to).toBeUndefined();
        }
    });
});

describe('normalizePath', () => {
    it.each([
        ['/', '/'],
        ['', '/'],
        [undefined, '/'],
        ['/About', '/about'],
        ['/about/', '/about'],
        ['/about?x=1#top', '/about'],
        ['//about', '/about'],
        ['/articles/Wiring-Basics/', '/articles/wiring-basics'],
        ['about', '/about'],
    ])('%s -> %s', (input, expected) => {
        expect(normalizePath(input)).toBe(expected);
    });

    it('finds fixed pages whatever the case or trailing slash, and nothing for dynamic ones', () => {
        expect(pageForPath('/FAQ/')?.title).toBe(PAGES['/faq'].title);
        expect(pageForPath('/articles/some-article')).toBeUndefined();
    });
});

describe('formatTitle', () => {
    it('adds the site name to a page title', () => {
        expect(formatTitle('About Us')).toBe(`About Us${SITE.titleSuffix}`);
    });

    it('does not add it twice', () => {
        expect(formatTitle(PAGES['/'].title)).toBe(PAGES['/'].title);
        expect(formatTitle(`News from ${SITE.name}`)).toBe(`News from ${SITE.name}`);
    });

    it('falls back to the site name', () => {
        expect(formatTitle('')).toBe(SITE.name);
        expect(formatTitle(undefined)).toBe(SITE.name);
    });
});

describe('templates', () => {
    it('fills placeholders and leaves unknown ones visible', () => {
        expect(fillTemplate('{a} and {b}', { a: 'one', b: 2 })).toBe('one and 2');
        expect(fillTemplate('{a} {missing}', { a: 'x' })).toBe('x {missing}');
    });

    it('describes an electrician', () => {
        const seo = electricianSeo({ name: 'Ram Thapa', location: 'Kumarigal', yearsExperience: 12 });
        expect(seo.title).toBe('Ram Thapa – Electrician in Kumarigal');
        expect(seo.description).toContain('12 years of experience');
        expect(seo.description).not.toMatch(/\{\w+\}/);
        expect(TEMPLATES.electrician.title).toContain('{name}');
    });
});

describe('business details', () => {
    it('are complete enough for local-business markup', () => {
        expect(BUSINESS.phone).toMatch(/^\+977-\d{10}$/);
        expect(BUSINESS.address.street).toBeTruthy();
        expect(BUSINESS.address.country).toBe('NP');
        expect(BUSINESS.geo.latitude).toBeGreaterThan(27);
        expect(BUSINESS.geo.latitude).toBeLessThan(28);
        expect(BUSINESS.openingHours.length).toBeGreaterThan(0);
        for (const hours of BUSINESS.openingHours) {
            expect(hours.opens).toMatch(/^\d\d:\d\d$/);
            expect(hours.closes).toMatch(/^\d\d:\d\d$/);
            expect(hours.days.length).toBeGreaterThan(0);
        }
    });
});

describe('FAQs', () => {
    it('are present, complete and uniquely identified', () => {
        expect(FAQS.length).toBeGreaterThan(0);
        expect(new Set(FAQS.map((faq) => faq.id)).size).toBe(FAQS.length);
        for (const faq of FAQS) {
            expect(faq.question.trim()).toBeTruthy();
            expect(faq.answer.trim()).toBeTruthy();
        }
    });
});

describe('index.html', () => {
    const html = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');

    it('keeps the markers the server fills in for every page', () => {
        // Remove one and the server falls back to regex surgery on the template (still works, but it's a worse way to find out).
        expect(html).toContain('<!--seo-head-->');
        expect(html).toContain('<!--/seo-head-->');
        expect(html.indexOf('<!--seo-head-->')).toBeLessThan(html.indexOf('<!--/seo-head-->'));
        expect(html).toContain('<div id="root"><!--seo-body--></div>');
    });

    it('has exactly one default title and description, between the head markers', () => {
        const between = html.slice(html.indexOf('<!--seo-head-->'), html.indexOf('<!--/seo-head-->'));
        expect(between.match(/<title>/g)).toHaveLength(1);
        expect(between.match(/<meta name="description"/g)).toHaveLength(1);
        expect(html.match(/<title>/g)).toHaveLength(1);
    });

    it('keeps its explanatory comments inside the replaced region, so they never ship in a page', () => {
        const headStart = html.indexOf('<!--seo-head-->');
        const headEnd = html.indexOf('<!--/seo-head-->');
        const comments = [...html.matchAll(/<!--(?!\/?seo-)[\s\S]*?-->/g)];

        expect(comments.length).toBeGreaterThan(0);
        for (const comment of comments) {
            expect(comment.index, comment[0].slice(0, 40)).toBeGreaterThan(headStart);
            expect(comment.index, comment[0].slice(0, 40)).toBeLessThan(headEnd);
        }
    });

    it('declares the icons and the theme colour the brand images were made for', () => {
        expect(html).toContain('href="/favicon-32.png"');
        expect(html).toContain('href="/favicon-48.png"');
        expect(html).toContain('href="/favicon-192.png"');
        expect(html).toContain('href="/apple-touch-icon.png"');
        expect(html).toContain(`<meta name="theme-color" content="${SITE.themeColor}"`);
    });

    it('has no SVG icon (browsers prefer one, so an old SVG would keep showing the previous logo in the tab)', () => {
        expect(html).not.toMatch(/rel="icon"[^>]*image\/svg/);
        expect(html).not.toContain('favicon.svg');
    });

    it('only points at images that exist in public/ (a missing one is a broken icon or share picture nobody notices)', () => {
        const inPage = [...html.matchAll(/(?:href|src)="(\/[^"]+\.(?:png|jpe?g|svg|ico|webp))"/g)].map((match) => match[1]);
        const referenced = [...new Set([...inPage, SITE.defaultImage, SITE.logo])];

        expect(referenced.length).toBeGreaterThanOrEqual(6);
        for (const file of referenced) expect(existsSync(new URL(`../../public${file}`, import.meta.url)), file).toBe(true);
    });
});

describe('toServerData', () => {
    it('is what the build writes for the server: JSON that survives a round trip', () => {
        const data = toServerData();
        expect(JSON.parse(JSON.stringify(data))).toEqual(data);
        expect(Object.keys(data).sort()).toEqual(['business', 'faqs', 'nav', 'pages', 'site', 'templates']);
    });

    /**
     * Every property path in a value, with array items as "[]" and the keys of the two lookup tables as "*":
     * "site.name", "pages.*.title", "business.openingHours[].days[]", ...
     */
    function propertyPaths(value, prefix = '', paths = new Set()) {
        if (Array.isArray(value)) {
            paths.add(`${prefix}[]`);
            value.forEach((item) => propertyPaths(item, `${prefix}[]`, paths));
        } else if (value && typeof value === 'object') {
            const isLookup = prefix === 'pages' || prefix === 'templates';
            for (const [key, child] of Object.entries(value)) propertyPaths(child, `${prefix}${prefix ? '.' : ''}${isLookup ? '*' : key}`, paths);
        } else {
            paths.add(prefix);
        }
        return paths;
    }

    it('has the same shape as the fixture the server tests run against (regenerate the fixture if this fails)', () => {
        const fixture = JSON.parse(
            readFileSync(new URL('../../../ElectricCenter.Server.Tests/Fixtures/wwwroot/seo-data.json', import.meta.url), 'utf8')
        );

        const real = [...propertyPaths(toServerData())].sort();
        const stale = [...propertyPaths(fixture)].sort();

        // If this fails, a property was added, renamed or removed in siteSeo.js. Update the server's SeoSiteData records to
        // match, then regenerate ElectricCenter.Server.Tests/Fixtures/wwwroot/seo-data.json from toServerData().
        expect(stale).toEqual(real);
    });
});
