import { Link } from 'react-router-dom';
import Badge from '../../../components/ui/Badge.jsx';
import Button from '../../../components/ui/Button.jsx';
import { formatDate } from '../../../utils/format.js';

/**
 * A card in the article list. Real links (not click handlers), so search engines and "open in new tab" both work.
 * @param {{
 *   article: import('../../../services/articlesService.js').ArticleSummary & { id: number, isPublished?: boolean, isDeleted?: boolean },
 *   admin?: { onDelete: () => void, onRestore: () => void, busy?: boolean },
 * }} props
 * `admin` is only passed for users with the Admin role; the API enforces the same rule.
 */
function ArticleCard({ article, admin }) {
    const draft = admin && !article.isPublished;
    const deleted = Boolean(article.isDeleted);
    // A draft or deleted article has no public page, so an admin's click goes to the editor instead.
    const href = draft || deleted ? `/admin/articles/${article.id}/edit` : `/articles/${article.slug}`;
    // A draft has no publish date; show when an admin last touched it instead.
    const date = formatDate(article.publishedAt);
    const edited = draft && !date ? formatDate(article.updatedAt) : '';

    return (
        <article className={`card article-card${deleted ? ' article-card--deleted' : ''}`}>
            <Link to={href} className="article-card-media" tabIndex={-1} aria-hidden="true">
                {article.coverImageUrl ? (
                    <img src={article.coverImageUrl} alt="" loading="lazy" width="640" height="360" />
                ) : (
                    <span>⚡</span>
                )}
            </Link>

            <div className="article-card-body">
                <p className="article-card-meta">
                    {admin && deleted && <Badge variant="neutral">🗑 Deleted</Badge>}
                    {admin && !deleted && (draft ? <Badge variant="warning">Draft</Badge> : <Badge variant="success">Published</Badge>)}
                    {date && <time dateTime={article.publishedAt}>{date}</time>}
                    {edited && <time dateTime={article.updatedAt}>Edited {edited}</time>}
                    <span>{article.readingMinutes} min read</span>
                </p>

                <h2 className="article-card-title">
                    <Link to={href}>{article.title}</Link>
                </h2>
                <p className="article-card-summary">{article.summary}</p>

                {admin && (
                    <div className="article-card-admin">
                        {deleted ? (
                            <Button variant="secondary" size="sm" loading={admin.busy} disabled={admin.busy} onClick={admin.onRestore}>
                                ↺ Restore
                            </Button>
                        ) : (
                            <>
                                <Link to={`/admin/articles/${article.id}/edit`} className="btn btn-ghost btn-sm" aria-label={`Edit ${article.title}`}>
                                    ✎ Edit
                                </Link>
                                <Button variant="ghost" size="sm" className="article-card-delete" onClick={admin.onDelete} aria-label={`Delete ${article.title}`}>
                                    🗑 Delete
                                </Button>
                            </>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
}

export default ArticleCard;
