/** Limits mirror the server's ArticleRules (the server re-validates everything). */
export const ARTICLE_LIMITS = Object.freeze({
    title: 110,
    slug: 80,
    summary: 300,
    body: 50_000,
    imageUrl: 500,
    imageAlt: 150,
    author: 80,
});

/** What search engines show, roughly. Not rules: the form only nudges. */
export const SEO_GUIDE = Object.freeze({
    titleMax: 60,
    summaryMin: 70,
    summaryMax: 160,
});

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * "Why Surge Protectors Matter in Kathmandu!" -> "why-surge-protectors-matter-in-kathmandu".
 * Same rules as the server's ArticleRules.Slugify: accents are stripped, and anything that isn't a-z or 0-9
 * (Devanagari included) becomes a separator, so an all-Nepali title gives "" and the server picks a fallback.
 */
export function slugify(text) {
    const slug = String(text ?? '')
        .normalize('NFKD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    if (slug.length <= ARTICLE_LIMITS.slug) return slug;

    // Cut at a word boundary when there is one, so the slug doesn't end mid-word.
    const cut = slug.slice(0, ARTICLE_LIMITS.slug);
    const lastHyphen = cut.lastIndexOf('-');
    return (lastHyphen > ARTICLE_LIMITS.slug / 2 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/g, '');
}

const trimmed = (value) => String(value ?? '').trim();

/** Form values (all strings) for a new article, or for the one being edited. */
export function toFormValues(article) {
    if (!article) {
        return { title: '', slug: '', summary: '', bodyMarkdown: '', coverImageUrl: '', coverImageAlt: '', authorName: '' };
    }
    return {
        title: article.title,
        slug: article.slug,
        summary: article.summary,
        bodyMarkdown: article.bodyMarkdown,
        coverImageUrl: article.coverImageUrl ?? '',
        coverImageAlt: article.coverImageAlt ?? '',
        authorName: article.authorName ?? '',
    };
}

/** Field -> message for everything wrong with the form; empty when it can be saved. */
export function validateArticle(values) {
    const errors = {};
    const title = trimmed(values.title);
    if (!title) errors.title = 'A title is required';
    else if (title.length > ARTICLE_LIMITS.title) errors.title = `Title must be at most ${ARTICLE_LIMITS.title} characters`;

    const slug = trimmed(values.slug);
    if (slug && (slug.length > ARTICLE_LIMITS.slug || !SLUG_PATTERN.test(slug))) {
        errors.slug = 'Use lowercase letters, numbers and single hyphens only';
    }

    const summary = trimmed(values.summary);
    if (!summary) errors.summary = 'A summary is required: search engines show it under the title';
    else if (summary.length > ARTICLE_LIMITS.summary) errors.summary = `Summary must be at most ${ARTICLE_LIMITS.summary} characters`;

    const body = trimmed(values.bodyMarkdown);
    if (!body) errors.bodyMarkdown = 'The article text is required';
    else if (body.length > ARTICLE_LIMITS.body) errors.bodyMarkdown = `The article text must be at most ${ARTICLE_LIMITS.body.toLocaleString()} characters`;

    const cover = trimmed(values.coverImageUrl);
    if (cover) {
        try {
            if (new URL(cover).protocol !== 'https:' || cover.length > ARTICLE_LIMITS.imageUrl) throw new Error('not https');
        } catch {
            errors.coverImageUrl = 'Use a full https link (uploading the image gives you one)';
        }
    }
    if (trimmed(values.coverImageAlt).length > ARTICLE_LIMITS.imageAlt) {
        errors.coverImageAlt = `Description must be at most ${ARTICLE_LIMITS.imageAlt} characters`;
    }
    if (trimmed(values.authorName).length > ARTICLE_LIMITS.author) errors.authorName = `Author must be at most ${ARTICLE_LIMITS.author} characters`;

    return errors;
}

/** The API request body. `version` is sent when editing so a concurrent edit by another admin is detected. */
export function toRequestBody(values, { isPublished, version } = {}) {
    const text = (value) => (trimmed(value) ? trimmed(value) : null);
    return {
        title: trimmed(values.title),
        slug: text(values.slug),
        summary: trimmed(values.summary),
        bodyMarkdown: trimmed(values.bodyMarkdown),
        coverImageUrl: text(values.coverImageUrl),
        coverImageAlt: text(values.coverImageAlt),
        authorName: text(values.authorName),
        isPublished: Boolean(isPublished),
        ...(version ? { version } : {}),
    };
}

/**
 * Gentle advice while writing, never a blocker. Each hint is { ok, text }.
 * @returns {{ id: string, ok: boolean, text: string }[]}
 */
export function seoHints(values) {
    const title = trimmed(values.title);
    const summary = trimmed(values.summary);
    const words = trimmed(values.bodyMarkdown).split(/\s+/).filter(Boolean).length;

    return [
        {
            id: 'title',
            ok: title.length > 0 && title.length <= SEO_GUIDE.titleMax,
            text: title.length > SEO_GUIDE.titleMax
                ? `The title is ${title.length} characters. Search results usually cut it off after about ${SEO_GUIDE.titleMax}.`
                : `Keep the title under ${SEO_GUIDE.titleMax} characters so it isn't cut off in search results.`,
        },
        {
            id: 'summary',
            ok: summary.length >= SEO_GUIDE.summaryMin && summary.length <= SEO_GUIDE.summaryMax,
            text: `A summary of ${SEO_GUIDE.summaryMin}–${SEO_GUIDE.summaryMax} characters fits the space under the title in search results (now ${summary.length}).`,
        },
        {
            id: 'length',
            ok: words >= 300,
            text: `Articles of 300 words or more tend to rank better than very short ones (now ${words}).`,
        },
        {
            id: 'cover',
            ok: Boolean(trimmed(values.coverImageUrl)),
            text: 'A cover image gives the article a picture when it is shared on WhatsApp or Facebook.',
        },
    ];
}
