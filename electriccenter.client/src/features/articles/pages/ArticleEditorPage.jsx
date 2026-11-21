import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAdminArticle } from '../hooks/useArticles.js';
import { ARTICLE_LIMITS, SEO_GUIDE, seoHints, slugify, toFormValues, toRequestBody, validateArticle } from '../articleForm.js';
import * as markdown from '../markdownEditing.js';
import { adminArticlesService } from '../../../services/articlesService.js';
import { uploadsService, IMAGE_ACCEPT, validateImageFile } from '../../../services/uploadsService.js';
import { useSeo } from '../../../seo/useSeo.js';
import { formatTitle } from '../../../seo/siteSeo.js';
import Button from '../../../components/ui/Button.jsx';
import Badge from '../../../components/ui/Badge.jsx';
import FormField from '../../../components/ui/FormField.jsx';
import Input from '../../../components/ui/Input.jsx';
import Textarea from '../../../components/ui/Textarea.jsx';
import ImageUploadField from '../../../components/ui/ImageUploadField.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import Spinner from '../../../components/ui/Spinner.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import ErrorState from '../../../components/ui/ErrorState.jsx';

const IMPORT_MAX_BYTES = 1024 * 1024;

const TOOLBAR = [
    { id: 'bold', label: 'B', title: 'Bold', edit: markdown.bold, style: { fontWeight: 800 } },
    { id: 'italic', label: 'I', title: 'Italic', edit: markdown.italic, style: { fontStyle: 'italic' } },
    { id: 'h2', label: 'H2', title: 'Section heading', edit: markdown.heading2 },
    { id: 'h3', label: 'H3', title: 'Sub-heading', edit: markdown.heading3 },
    { id: 'ul', label: '• List', title: 'Bulleted list', edit: markdown.bulletList },
    { id: 'ol', label: '1. List', title: 'Numbered list', edit: markdown.numberedList },
    { id: 'quote', label: '❝', title: 'Quote', edit: markdown.quote },
    { id: 'link', label: '🔗 Link', title: 'Link', edit: markdown.link },
];

/** Loads the article (when editing) and hands it to the form. A new article has nothing to load. */
function ArticleEditorPage() {
    const { articleId } = useParams();
    const isEdit = articleId != null;
    const { article, loading, error, notFound, refetch } = useAdminArticle(isEdit ? Number(articleId) : null);
    // After a save the server returns the article with its new version; keep it so the form restarts from it.
    const [saved, setSaved] = useState(null);

    useSeo({ title: isEdit ? 'Edit article' : 'New article', noindex: true });

    if (isEdit && loading) {
        return (
            <div className="article-editor-page">
                <Skeleton height={32} width="40%" style={{ marginBottom: 'var(--space-6)' }} />
                <Skeleton height={300} />
            </div>
        );
    }
    if (isEdit && notFound) {
        return (
            <EmptyState icon="📰" title="Article not found" description="It may have been removed, or the link is incorrect."
                action={<Button as={Link} to="/articles">Back to articles</Button>} />
        );
    }
    if (isEdit && error) return <ErrorState description={error} onRetry={refetch} />;

    const current = saved ?? article;
    return <ArticleEditorForm key={current?.version ?? 'new'} article={current} onSaved={setSaved} />;
}

/** @param {{ article: import('../../../services/articlesService.js').AdminArticle | null, onSaved: (article: object) => void }} props */
function ArticleEditorForm({ article, onSaved }) {
    const isEdit = Boolean(article);
    const navigate = useNavigate();
    const textareaRef = useRef(null);
    const imageInputRef = useRef(null);
    const importInputRef = useRef(null);

    const [initialValues] = useState(() => toFormValues(article));
    const [values, setValues] = useState(initialValues);
    // The address follows the title until the admin edits it by hand. An existing article keeps its address.
    const [slugTouched, setSlugTouched] = useState(isEdit);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(null); // null | 'publish' | 'draft'
    const [submitError, setSubmitError] = useState(null);
    const [conflict, setConflict] = useState(false);
    const [tab, setTab] = useState('write'); // 'write' | 'preview'
    const [preview, setPreview] = useState({ status: 'idle', html: '', error: null });
    const [uploadingImage, setUploadingImage] = useState(false);

    const set = (name, value) => {
        setValues((previous) => {
            const next = { ...previous, [name]: value };
            if (name === 'title' && !slugTouched) next.slug = slugify(value);
            return next;
        });
        setErrors((previous) => (previous[name] ? { ...previous, [name]: undefined } : previous));
    };

    // Typing a long article and then closing the tab or refreshing is the easiest way to lose an afternoon's work, so
    // ask first. (Only for edits not yet saved: saving restarts this form from the saved article, which makes it clean.)
    const dirty = JSON.stringify(values) !== JSON.stringify(initialValues);
    useEffect(() => {
        if (!dirty) return undefined;
        const warn = (e) => {
            e.preventDefault();
            e.returnValue = ''; // some browsers only ask when this is set
        };
        window.addEventListener('beforeunload', warn);
        return () => window.removeEventListener('beforeunload', warn);
    }, [dirty]);

    // The server renders the preview (so it can never differ from the published page). Fetched each time the tab opens;
    // the text can't change while it is open.
    useEffect(() => {
        if (tab !== 'preview') return undefined;
        let cancelled = false;
        setPreview({ status: 'loading', html: '', error: null });
        adminArticlesService
            .preview(values.bodyMarkdown)
            .then((html) => !cancelled && setPreview({ status: 'ready', html, error: null }))
            .catch((err) => !cancelled && setPreview({ status: 'error', html: '', error: err.message }));
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tab]);

    const applyEdit = (transform, ...args) => {
        const element = textareaRef.current;
        if (!element) return;
        const next = transform({ text: values.bodyMarkdown, start: element.selectionStart, end: element.selectionEnd }, ...args);
        set('bodyMarkdown', next.text);
        // Wait for React to put the new text in the box before selecting inside it.
        requestAnimationFrame(() => {
            element.focus();
            element.setSelectionRange(next.start, next.end);
        });
    };

    const handleBodyImage = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        const invalid = validateImageFile(file);
        if (invalid) {
            toast.error(invalid);
            return;
        }
        setUploadingImage(true);
        try {
            const url = await uploadsService.uploadImage(file);
            applyEdit(markdown.image, url);
            toast.success('Image added. Replace "image description" with a short description of the picture.');
        } catch (err) {
            toast.error(err.message);
        } finally {
            setUploadingImage(false);
        }
    };

    const handleImport = async (e) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > IMPORT_MAX_BYTES) {
            toast.error('That file is too large. Markdown files up to 1 MB can be imported.');
            return;
        }
        if (values.bodyMarkdown.trim() && !window.confirm('Replace the current text with the contents of this file?')) return;

        try {
            const { title, body } = markdown.parseMarkdownFile(await file.text());
            set('bodyMarkdown', body);
            if (title && !values.title.trim()) set('title', title);
            toast.success(`Imported ${file.name}`);
        } catch {
            toast.error('Could not read that file.');
        }
    };

    const save = async (publish) => {
        const found = validateArticle(values);
        setErrors(found);
        if (Object.keys(found).length > 0) {
            setSubmitError('Please fix the highlighted fields.');
            return;
        }

        setSaving(publish ? 'publish' : 'draft');
        setSubmitError(null);
        setConflict(false);
        try {
            const body = toRequestBody(values, { isPublished: publish, version: article?.version });
            const result = isEdit ? await adminArticlesService.update(article.id, body) : await adminArticlesService.create(body);
            toast.success(publish ? (article?.isPublished ? 'Changes saved' : 'Published') : 'Saved as a draft');
            if (isEdit) onSaved(result);
            else navigate(`/admin/articles/${result.id}/edit`, { replace: true });
        } catch (err) {
            // Another admin saved this article after it was opened here.
            if (isEdit && err.status === 409 && /changed by someone else/i.test(err.message)) setConflict(true);
            setSubmitError(err.message);
        } finally {
            setSaving(null);
        }
    };

    const hints = seoHints(values);
    const summaryLength = values.summary.trim().length;
    const published = Boolean(article?.isPublished);
    const slugForUrl = values.slug.trim() || '…';

    const field = (name, label, { required = false, hint, multiline = false, ...props } = {}) => (
        <FormField label={label} required={required} error={errors[name]} hint={hint}>
            {(fieldProps) => {
                const Control = multiline ? Textarea : Input;
                return (
                    <Control {...fieldProps} {...props} hasError={Boolean(errors[name])} value={values[name]} onChange={(e) => set(name, e.target.value)} />
                );
            }}
        </FormField>
    );

    return (
        <section className="article-editor-page">
            <Link to="/articles" className="article-editor-back">← Back to articles</Link>
            <div className="article-editor-heading">
                <h1>{isEdit ? 'Edit article' : 'New article'}</h1>
                {isEdit && (published ? <Badge variant="success">Published</Badge> : <Badge variant="warning">Draft</Badge>)}
            </div>

            <form className="article-editor" onSubmit={(e) => e.preventDefault()} noValidate>
                <div className="article-editor-main card card-padded">
                    {field('title', 'Title', { required: true, maxLength: ARTICLE_LIMITS.title, placeholder: 'e.g. How to choose the right MCB for your home' })}

                    {field('slug', 'Web address', {
                        maxLength: ARTICLE_LIMITS.slug,
                        placeholder: 'filled in from the title',
                        onInput: () => setSlugTouched(true),
                        hint: published
                            ? `/articles/${slugForUrl}. Changing the address of a published article breaks links people already have.`
                            : `/articles/${slugForUrl}`,
                    })}

                    {field('summary', 'Summary', {
                        required: true,
                        multiline: true,
                        rows: 3,
                        maxLength: ARTICLE_LIMITS.summary,
                        placeholder: 'One or two sentences. Search engines show this under the title.',
                        hint: `${summaryLength} / ${SEO_GUIDE.summaryMax} characters recommended (limit ${ARTICLE_LIMITS.summary})`,
                    })}

                    <div className="article-editor-body">
                        <div className="article-editor-body-head">
                            <span className="form-label">Article text <span aria-hidden="true">*</span></span>
                            <div role="tablist" aria-label="Editor view" className="article-editor-tabs">
                                <button type="button" role="tab" aria-selected={tab === 'write'} className={tab === 'write' ? 'is-active' : ''} onClick={() => setTab('write')}>Write</button>
                                <button type="button" role="tab" aria-selected={tab === 'preview'} className={tab === 'preview' ? 'is-active' : ''} onClick={() => setTab('preview')}>Preview</button>
                            </div>
                        </div>

                        {tab === 'write' ? (
                            <>
                                <div className="article-editor-toolbar" role="toolbar" aria-label="Formatting">
                                    {TOOLBAR.map((tool) => (
                                        <button key={tool.id} type="button" title={tool.title} aria-label={tool.title} style={tool.style} onClick={() => applyEdit(tool.edit)}>
                                            {tool.label}
                                        </button>
                                    ))}
                                    <button type="button" title="Upload and insert an image" aria-label="Insert image" disabled={uploadingImage} onClick={() => imageInputRef.current?.click()}>
                                        {uploadingImage ? 'Uploading…' : '🖼 Image'}
                                    </button>
                                    <button type="button" title="Load a .md file" aria-label="Import a Markdown file" onClick={() => importInputRef.current?.click()}>
                                        ⬆ Import .md
                                    </button>
                                    <input ref={imageInputRef} type="file" accept={IMAGE_ACCEPT} className="visually-hidden" tabIndex={-1} onChange={handleBodyImage} aria-hidden="true" />
                                    <input ref={importInputRef} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" className="visually-hidden" tabIndex={-1} onChange={handleImport} aria-hidden="true" />
                                </div>
                                <Textarea
                                    ref={textareaRef}
                                    className="article-editor-textarea"
                                    aria-label="Article text (Markdown)"
                                    aria-invalid={Boolean(errors.bodyMarkdown)}
                                    hasError={Boolean(errors.bodyMarkdown)}
                                    value={values.bodyMarkdown}
                                    onChange={(e) => set('bodyMarkdown', e.target.value)}
                                    placeholder={'Write here. Use ## for section headings, **bold**, and - for lists.\n\nThe article title is added above automatically.'}
                                />
                            </>
                        ) : (
                            <div className="article-editor-preview">
                                {preview.status === 'loading' && <Spinner label="Rendering preview…" />}
                                {preview.status === 'error' && <p className="form-error" role="alert">{preview.error}</p>}
                                {preview.status === 'ready' && (preview.html.trim()
                                    ? <div className="prose" dangerouslySetInnerHTML={{ __html: preview.html }} />
                                    : <p className="form-hint">Nothing to preview yet.</p>)}
                            </div>
                        )}

                        {errors.bodyMarkdown && <span className="form-error" role="alert">{errors.bodyMarkdown}</span>}
                        <span className="form-hint">
                            {values.bodyMarkdown.length.toLocaleString()} / {ARTICLE_LIMITS.body.toLocaleString()} characters.
                            Formatting uses Markdown: <code>## Heading</code>, <code>**bold**</code>, <code>[text](https://…)</code>.
                        </span>
                    </div>
                </div>

                <aside className="article-editor-side">
                    <div className="card card-padded">
                        <h2 className="article-editor-side-title">Publish</h2>
                        {submitError && (
                            <p className="form-error" role="alert">
                                {submitError}
                                {conflict && ' Open the article again to load the latest version.'}
                            </p>
                        )}
                        <div className="article-editor-actions">
                            <Button type="button" block loading={saving === 'publish'} disabled={saving !== null} onClick={() => save(true)}>
                                {published ? 'Save changes' : 'Publish'}
                            </Button>
                            <Button type="button" variant="secondary" block loading={saving === 'draft'} disabled={saving !== null} onClick={() => save(false)}>
                                {published ? 'Unpublish (back to draft)' : 'Save draft'}
                            </Button>
                            {published && (
                                <Button as={Link} to={`/articles/${article.slug}`} variant="ghost" block target="_blank" rel="noopener">View on the website ↗</Button>
                            )}
                        </div>
                        <p className="form-hint">
                            {published ? 'This article is live.' : 'Drafts are only visible to admins.'}
                        </p>
                    </div>

                    <div className="card card-padded">
                        <h2 className="article-editor-side-title">Cover image</h2>
                        <ImageUploadField
                            label="Picture"
                            value={values.coverImageUrl}
                            onChange={(url) => set('coverImageUrl', url)}
                            error={errors.coverImageUrl}
                            hint="Optional. Shown on the article, in the list and when the link is shared. JPG, PNG or WebP, up to 5 MB."
                        />
                        {values.coverImageUrl && field('coverImageAlt', 'Describe the image', { maxLength: ARTICLE_LIMITS.imageAlt, hint: 'For screen readers and image search, e.g. "A technician fitting an MCB".' })}
                    </div>

                    <div className="card card-padded">
                        <h2 className="article-editor-side-title">Author</h2>
                        {field('authorName', 'Shown as the byline', { maxLength: ARTICLE_LIMITS.author, placeholder: 'Leave blank to use your own name', hint: 'Leave blank to keep the current author.' })}
                    </div>

                    <div className="card card-padded">
                        <h2 className="article-editor-side-title">In search results</h2>
                        <div className="serp-preview" aria-label="Search result preview">
                            <span className="serp-title">{formatTitle(values.title.trim()) || 'Your title'}</span>
                            <span className="serp-url">/articles/{slugForUrl}</span>
                            <span className="serp-description">{values.summary.trim().slice(0, SEO_GUIDE.summaryMax) || 'Your summary appears here.'}</span>
                        </div>
                        <ul className="seo-hints">
                            {hints.map((hint) => (
                                <li key={hint.id} className={hint.ok ? 'is-ok' : undefined}>
                                    <span aria-hidden="true">{hint.ok ? '✓' : '○'}</span> {hint.text}
                                </li>
                            ))}
                        </ul>
                    </div>
                </aside>
            </form>
        </section>
    );
}

export default ArticleEditorPage;
