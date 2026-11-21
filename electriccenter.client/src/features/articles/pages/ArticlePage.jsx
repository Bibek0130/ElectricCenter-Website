import { Link, useParams } from 'react-router-dom';
import { useArticle } from '../hooks/useArticles.js';
import { useSeo } from '../../../seo/useSeo.js';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import ErrorState from '../../../components/ui/ErrorState.jsx';
import Button from '../../../components/ui/Button.jsx';
import { formatDate } from '../../../utils/format.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function ArticlePage() {
    const { slug } = useParams();
    const { article, loading, error, notFound, refetch } = useArticle(slug);

    // Until the article arrives, leave the title the server wrote alone: replacing it with a placeholder would show a
    // wrong title to anyone (or any crawler) that looks too early.
    useSeo(
        article
            ? {
                title: article.title,
                description: article.summary,
                path: `/articles/${article.slug}`,
                image: article.coverImageUrl ?? undefined,
                imageAlt: article.coverImageAlt || article.title,
                type: 'article',
                publishedTime: article.publishedAt,
                modifiedTime: article.updatedAt,
                author: article.authorName,
            }
            : notFound ? { title: 'Article not found', noindex: true } : null
    );

    if (loading) {
        return (
            <div className="article-page">
                <Skeleton height={14} width="40%" style={{ marginBottom: 'var(--space-5)' }} />
                <Skeleton height={36} width="90%" style={{ marginBottom: 'var(--space-3)' }} />
                <Skeleton height={14} width="50%" style={{ marginBottom: 'var(--space-6)' }} />
                <Skeleton height={320} style={{ marginBottom: 'var(--space-6)' }} />
                <Skeleton height={14} style={{ marginBottom: 10 }} />
                <Skeleton height={14} style={{ marginBottom: 10 }} />
                <Skeleton height={14} width="80%" />
            </div>
        );
    }

    if (notFound) {
        return (
            <EmptyState
                icon="📰"
                title="Article not found"
                description="It may have been unpublished, or the link is incorrect."
                action={<Button as={Link} to="/articles">Browse all articles</Button>}
            />
        );
    }

    if (error) return <ErrorState description={error} onRetry={refetch} />;

    const published = formatDate(article.publishedAt);
    const updated = new Date(article.updatedAt).getTime() - new Date(article.publishedAt).getTime() > DAY_MS ? formatDate(article.updatedAt) : '';

    return (
        <article className="article-page">
            <nav className="breadcrumbs" aria-label="Breadcrumb">
                <Link to="/">Home</Link>
                <span aria-hidden="true">›</span>
                <Link to="/articles">Articles</Link>
                <span aria-hidden="true">›</span>
                <span aria-current="page">{article.title}</span>
            </nav>

            <header className="article-header">
                <h1 className="article-title">{article.title}</h1>
                <p className="article-byline">
                    By <strong>{article.authorName}</strong>
                    <span aria-hidden="true"> · </span>
                    <time dateTime={article.publishedAt}>{published}</time>
                    <span aria-hidden="true"> · </span>
                    {article.readingMinutes} min read
                    {updated && <span className="article-updated"> (updated {updated})</span>}
                </p>
            </header>

            {article.coverImageUrl && (
                <img
                    className="article-cover"
                    src={article.coverImageUrl}
                    alt={article.coverImageAlt || article.title}
                    width="1200"
                    height="675"
                    fetchPriority="high"
                />
            )}

            {/* The server renders the Markdown and makes the HTML safe (raw HTML escaped, links and images vetted). */}
            <div className="prose" dangerouslySetInnerHTML={{ __html: article.bodyHtml }} />

            <aside className="article-cta card card-padded">
                <h2 className="article-cta-title">Need a hand with your wiring?</h2>
                <p>Browse electrical products from top brands, or book a vetted electrician in Kathmandu valley.</p>
                <div className="article-cta-actions">
                    <Button as={Link} to="/products">Shop products</Button>
                    <Button as={Link} to="/electricians" variant="secondary">Book an electrician</Button>
                    <Button as={Link} to="/articles" variant="ghost">← More articles</Button>
                </div>
            </aside>
        </article>
    );
}

export default ArticlePage;
