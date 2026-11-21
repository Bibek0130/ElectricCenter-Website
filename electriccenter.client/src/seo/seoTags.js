import { ROBOTS_INDEX, ROBOTS_NOINDEX, SITE, formatTitle } from './siteSeo.js';

/**
 * @typedef {Object} SeoSpec What a page tells search engines and link previews.
 * @property {string} title              The page's own title. The site name is appended unless it's already in it.
 * @property {string} [description]      The snippet under the title in search results. Defaults to the site's.
 * @property {string} [path]             The page's canonical path, e.g. "/articles/wiring-basics".
 * @property {boolean} [noindex]         Keep this page out of search results.
 * @property {string} [image]            Picture for link previews: an absolute URL, or a path on this site.
 * @property {string} [imageAlt]
 * @property {'website'|'article'|'profile'} [type]
 * @property {string} [publishedTime]    ISO 8601 (articles).
 * @property {string} [modifiedTime]
 * @property {string} [author]
 */

/**
 * Every head tag the app manages, as CSS selectors. Tags in this list that a page doesn't need are removed when
 * navigating to it, so one page's article:author (say) never lingers on the next. Keep in step with buildSeoTags.
 */
export const MANAGED_SELECTORS = Object.freeze([
    'meta[name="description"]',
    'meta[name="robots"]',
    'link[rel="canonical"]',
    'meta[property="og:site_name"]',
    'meta[property="og:locale"]',
    'meta[property="og:type"]',
    'meta[property="og:title"]',
    'meta[property="og:description"]',
    'meta[property="og:url"]',
    'meta[property="og:image"]',
    'meta[property="og:image:alt"]',
    'meta[property="og:image:width"]',
    'meta[property="og:image:height"]',
    'meta[name="twitter:card"]',
    'meta[name="twitter:title"]',
    'meta[name="twitter:description"]',
    'meta[name="twitter:image"]',
    'meta[property="article:published_time"]',
    'meta[property="article:modified_time"]',
    'meta[property="article:author"]',
]);

/** "/x" -> "https://site.example/x". Already-absolute URLs are returned as they are. */
export function absoluteUrl(baseUrl, urlOrPath) {
    if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
    return `${String(baseUrl).replace(/\/+$/, '')}${urlOrPath.startsWith('/') ? '' : '/'}${urlOrPath}`;
}

/**
 * The page title and the tags to put in <head> for a page. Pure: it doesn't touch the document.
 * @param {SeoSpec} spec
 * @param {string} baseUrl The site's public origin, e.g. "https://electriccenter.example".
 * @returns {{ title: string, tags: { selector: string, element: 'meta'|'link', attrs: Record<string, string> }[] }}
 */
export function buildSeoTags(spec, baseUrl) {
    const title = formatTitle(spec.title);
    const description = spec.description || SITE.defaultDescription;
    const indexable = !spec.noindex;
    const hasOwnImage = Boolean(spec.image);
    const image = absoluteUrl(baseUrl, spec.image || SITE.defaultImage);
    const imageAlt = hasOwnImage ? spec.imageAlt || spec.title : SITE.defaultImageAlt;
    const url = spec.path == null ? null : absoluteUrl(baseUrl, spec.path);
    const type = spec.type ?? 'website';

    const tags = [];
    const meta = (attribute, name, content) => {
        if (content) tags.push({ selector: `meta[${attribute}="${name}"]`, element: 'meta', attrs: { [attribute]: name, content } });
    };

    meta('name', 'description', description);
    meta('name', 'robots', indexable ? ROBOTS_INDEX : ROBOTS_NOINDEX);
    // A page that is kept out of the index has no business claiming a canonical address.
    if (indexable && url) tags.push({ selector: 'link[rel="canonical"]', element: 'link', attrs: { rel: 'canonical', href: url } });

    meta('property', 'og:site_name', SITE.name);
    meta('property', 'og:locale', SITE.locale);
    meta('property', 'og:type', type);
    meta('property', 'og:title', title);
    meta('property', 'og:description', description);
    if (url) meta('property', 'og:url', url);
    meta('property', 'og:image', image);
    meta('property', 'og:image:alt', imageAlt);
    if (!hasOwnImage) {
        // Only the site image's size is known. With it, Facebook can draw the large card the first time a link is shared.
        meta('property', 'og:image:width', String(SITE.defaultImageWidth));
        meta('property', 'og:image:height', String(SITE.defaultImageHeight));
    }

    meta('name', 'twitter:card', 'summary_large_image');
    meta('name', 'twitter:title', title);
    meta('name', 'twitter:description', description);
    meta('name', 'twitter:image', image);

    if (type === 'article') {
        meta('property', 'article:published_time', spec.publishedTime);
        meta('property', 'article:modified_time', spec.modifiedTime);
        meta('property', 'article:author', spec.author);
    }

    return { title, tags };
}
