import { describe, expect, it } from 'vitest';
import { ARTICLE_LIMITS, SLUG_PATTERN, slugify, seoHints, toFormValues, toRequestBody, validateArticle } from './articleForm.js';

const valid = () => ({
    title: 'Choosing an MCB',
    slug: '',
    summary: 'How to pick the right miniature circuit breaker for your home.',
    bodyMarkdown: '## Rating\n\nPick 16A for lighting.',
    coverImageUrl: '',
    coverImageAlt: '',
    authorName: '',
});

describe('slugify (must agree with ArticleRules.Slugify on the server)', () => {
    it.each([
        ['Why Surge Protectors Matter in Kathmandu', 'why-surge-protectors-matter-in-kathmandu'],
        ['  Hello,   World!!  ', 'hello-world'],
        ['Café Électrique', 'cafe-electrique'],
        ['MCB vs. RCCB: 5 Differences', 'mcb-vs-rccb-5-differences'],
        ['---', ''],
        ['', ''],
        [undefined, ''],
        ['विद्युत सुरक्षा', ''], // nothing in Devanagari survives; the server supplies a fallback
    ])('%s -> %s', (title, expected) => {
        expect(slugify(title)).toBe(expected);
    });

    it('cuts a long title at a word boundary', () => {
        const slug = slugify(Array(20).fill('electrical').join(' '));
        expect(slug.length).toBeLessThanOrEqual(ARTICLE_LIMITS.slug);
        expect(slug).toMatch(SLUG_PATTERN);
        expect(slug.endsWith('electrical')).toBe(true);
    });

    it('always produces something the slug rule accepts, or nothing', () => {
        for (const title of ['A', 'a--b', '  x  y  ', '100% Pure!', 'Ünïcödé Tïtle']) {
            const slug = slugify(title);
            expect(slug === '' || SLUG_PATTERN.test(slug), title).toBe(true);
        }
    });
});

describe('SLUG_PATTERN', () => {
    it.each([
        ['wiring-basics', true],
        ['a', true],
        ['2024-guide', true],
        ['Wiring-Basics', false],
        ['wiring--basics', false],
        ['-wiring', false],
        ['wiring-', false],
        ['wiring basics', false],
        ['wiring_basics', false],
        ['', false],
    ])('%j -> %s', (slug, ok) => {
        expect(SLUG_PATTERN.test(slug)).toBe(ok);
    });
});

describe('validateArticle', () => {
    it('accepts a complete article', () => {
        expect(validateArticle(valid())).toEqual({});
    });

    it('needs a title, a summary and the text', () => {
        const errors = validateArticle({ ...valid(), title: ' ', summary: '', bodyMarkdown: '  ' });
        expect(Object.keys(errors).sort()).toEqual(['bodyMarkdown', 'summary', 'title']);
    });

    it('enforces the length limits', () => {
        expect(validateArticle({ ...valid(), title: 'x'.repeat(ARTICLE_LIMITS.title + 1) }).title).toMatch(/at most/);
        expect(validateArticle({ ...valid(), summary: 'x'.repeat(ARTICLE_LIMITS.summary + 1) }).summary).toMatch(/at most/);
        expect(validateArticle({ ...valid(), bodyMarkdown: 'x'.repeat(ARTICLE_LIMITS.body + 1) }).bodyMarkdown).toMatch(/at most/);
        expect(validateArticle({ ...valid(), coverImageAlt: 'x'.repeat(ARTICLE_LIMITS.imageAlt + 1) }).coverImageAlt).toMatch(/at most/);
        expect(validateArticle({ ...valid(), authorName: 'x'.repeat(ARTICLE_LIMITS.author + 1) }).authorName).toMatch(/at most/);
    });

    it('accepts a blank address (the server makes one) and rejects a malformed one', () => {
        expect(validateArticle({ ...valid(), slug: '' }).slug).toBeUndefined();
        expect(validateArticle({ ...valid(), slug: 'good-address' }).slug).toBeUndefined();
        expect(validateArticle({ ...valid(), slug: 'Bad Address' }).slug).toBeTruthy();
        expect(validateArticle({ ...valid(), slug: 'x'.repeat(ARTICLE_LIMITS.slug + 1) }).slug).toBeTruthy();
    });

    it('wants an https cover image, or none', () => {
        expect(validateArticle({ ...valid(), coverImageUrl: '' }).coverImageUrl).toBeUndefined();
        expect(validateArticle({ ...valid(), coverImageUrl: 'https://res.cloudinary.com/demo/a.jpg' }).coverImageUrl).toBeUndefined();
        expect(validateArticle({ ...valid(), coverImageUrl: 'http://example.com/a.jpg' }).coverImageUrl).toBeTruthy();
        expect(validateArticle({ ...valid(), coverImageUrl: 'not a url' }).coverImageUrl).toBeTruthy();
        expect(validateArticle({ ...valid(), coverImageUrl: 'javascript:alert(1)' }).coverImageUrl).toBeTruthy();
    });
});

describe('toRequestBody', () => {
    it('trims, turns blanks into null and sends the publish state', () => {
        const body = toRequestBody({ ...valid(), title: '  Title  ', slug: '  ', authorName: '' }, { isPublished: true });
        expect(body).toMatchObject({ title: 'Title', slug: null, coverImageUrl: null, coverImageAlt: null, authorName: null, isPublished: true });
        expect(body).not.toHaveProperty('version');
    });

    it('includes the version when editing, so a concurrent edit is detected', () => {
        expect(toRequestBody(valid(), { isPublished: false, version: 'abc-123' })).toMatchObject({ isPublished: false, version: 'abc-123' });
    });
});

describe('toFormValues', () => {
    it('is empty for a new article', () => {
        expect(toFormValues(null)).toEqual({ title: '', slug: '', summary: '', bodyMarkdown: '', coverImageUrl: '', coverImageAlt: '', authorName: '' });
    });

    it('copies an existing article, with nulls as empty strings', () => {
        const values = toFormValues({
            title: 'T', slug: 's', summary: 'Sum', bodyMarkdown: 'Body', coverImageUrl: null, coverImageAlt: null, authorName: 'Sita',
        });
        expect(values).toEqual({ title: 'T', slug: 's', summary: 'Sum', bodyMarkdown: 'Body', coverImageUrl: '', coverImageAlt: '', authorName: 'Sita' });
    });
});

describe('seoHints', () => {
    const hint = (values, id) => seoHints(values).find((h) => h.id === id);

    it('flags a title that will be cut off in search results', () => {
        expect(hint({ ...valid(), title: 'x'.repeat(61) }, 'title').ok).toBe(false);
        expect(hint({ ...valid(), title: 'x'.repeat(60) }, 'title').ok).toBe(true);
    });

    it('asks for a summary that fits under the title', () => {
        expect(hint({ ...valid(), summary: 'too short' }, 'summary').ok).toBe(false);
        expect(hint({ ...valid(), summary: 'x'.repeat(100) }, 'summary').ok).toBe(true);
        expect(hint({ ...valid(), summary: 'x'.repeat(200) }, 'summary').ok).toBe(false);
    });

    it('notes short articles and a missing cover image, without blocking anything', () => {
        expect(hint({ ...valid(), bodyMarkdown: 'few words' }, 'length').ok).toBe(false);
        expect(hint({ ...valid(), bodyMarkdown: Array(300).fill('word').join(' ') }, 'length').ok).toBe(true);
        expect(hint(valid(), 'cover').ok).toBe(false);
        expect(hint({ ...valid(), coverImageUrl: 'https://x.example/a.jpg' }, 'cover').ok).toBe(true);
    });
});
