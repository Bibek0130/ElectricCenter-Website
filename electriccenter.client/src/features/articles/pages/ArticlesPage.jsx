import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useArticleList } from '../hooks/useArticles.js';
import ArticleCard from '../components/ArticleCard.jsx';
import Button from '../../../components/ui/Button.jsx';
import Card from '../../../components/ui/Card.jsx';
import Modal from '../../../components/ui/Modal.jsx';
import Skeleton from '../../../components/ui/Skeleton.jsx';
import EmptyState from '../../../components/ui/EmptyState.jsx';
import ErrorState from '../../../components/ui/ErrorState.jsx';
import { adminArticlesService } from '../../../services/articlesService.js';
import { useAuth } from '../../auth/useAuth.js';
import { ROLES } from '../../auth/context.js';

function ArticlesPage() {
    // Admin-only management. The server enforces the Admin role on every write and on the admin list;
    // this only decides which controls to show.
    const { hasRole } = useAuth();
    const isAdmin = hasRole(ROLES.Admin);
    const [showDeleted, setShowDeleted] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [busyId, setBusyId] = useState(null);

    const { articles, loading, error, refetch } = useArticleList({ admin: isAdmin, includeDeleted: isAdmin && showDeleted });

    const restore = async (article) => {
        setBusyId(article.id);
        try {
            await adminArticlesService.restore(article.id);
            toast.success(`"${article.title}" restored`);
            refetch();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    const confirmDelete = async () => {
        const article = pendingDelete;
        setBusyId(article.id);
        try {
            await adminArticlesService.remove(article.id);
            setPendingDelete(null);
            refetch();
            toast(
                (t) => (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        "{article.title}" deleted
                        <button
                            type="button"
                            className="link-button"
                            onClick={() => {
                                toast.dismiss(t.id);
                                restore(article);
                            }}
                        >
                            Undo
                        </button>
                    </span>
                ),
                { duration: 6000 }
            );
        } catch (err) {
            toast.error(err.message);
        } finally {
            setBusyId(null);
        }
    };

    return (
        <>
            <section className="products-hero">
                <h1 className="products-hero-title">Articles &amp; Guides</h1>
                <p className="products-hero-subtitle">Practical electrical advice from the team at Panchamukhi Electric Center.</p>
            </section>

            <div className="articles-layout">
                {isAdmin && (
                    <div className="articles-admin-bar">
                        <label className="articles-admin-toggle">
                            <input type="checkbox" checked={showDeleted} onChange={(e) => setShowDeleted(e.target.checked)} />
                            Show deleted articles
                        </label>
                        <Button as={Link} to="/admin/articles/new" size="sm">＋ New article</Button>
                    </div>
                )}

                {loading ? (
                    <div className="articles-grid">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Card key={i} padded={false}>
                                <Skeleton height={180} style={{ borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }} />
                                <div style={{ padding: 'var(--space-4)' }}>
                                    <Skeleton height={10} width="40%" style={{ marginBottom: 10 }} />
                                    <Skeleton height={14} width="90%" style={{ marginBottom: 8 }} />
                                    <Skeleton height={10} width="75%" />
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : error ? (
                    <ErrorState description={error} onRetry={refetch} />
                ) : articles.length === 0 ? (
                    <EmptyState
                        icon="📰"
                        title="No articles yet"
                        description={isAdmin ? 'Write the first one: it can be a draft until you are happy with it.' : 'We are working on some. Please check back soon.'}
                        action={isAdmin ? <Button as={Link} to="/admin/articles/new">＋ New article</Button> : undefined}
                    />
                ) : (
                    <div className="articles-grid">
                        {articles.map((article) => (
                            <ArticleCard
                                key={article.id}
                                article={article}
                                admin={isAdmin ? {
                                    onDelete: () => setPendingDelete(article),
                                    onRestore: () => restore(article),
                                    busy: busyId === article.id,
                                } : undefined}
                            />
                        ))}
                    </div>
                )}
            </div>

            <Modal open={Boolean(pendingDelete)} onClose={() => setPendingDelete(null)} title="Delete this article?" size="sm">
                {pendingDelete && (
                    <>
                        <p style={{ marginBottom: 'var(--space-2)' }}>
                            <strong>{pendingDelete.title}</strong> will no longer be visible on the website.
                        </p>
                        <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
                            Nothing is erased: you can bring it back any time with "Show deleted articles" → Restore.
                        </p>
                        <div className="product-form-actions">
                            <Button variant="secondary" onClick={() => setPendingDelete(null)}>Cancel</Button>
                            <Button onClick={confirmDelete} loading={busyId === pendingDelete.id} disabled={busyId === pendingDelete.id}>
                                Delete article
                            </Button>
                        </div>
                    </>
                )}
            </Modal>
        </>
    );
}

export default ArticlesPage;
