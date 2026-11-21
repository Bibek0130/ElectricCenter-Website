import { useCallback, useEffect, useState } from 'react';
import { adminArticlesService, articlesService } from '../../../services/articlesService.js';

/**
 * Loads one thing and reloads on demand. `load` must be stable (wrap it in useCallback) or this fetches on every render.
 * `loading` is true until the first answer. A 404 isn't an error: it sets `notFound` instead.
 */
function useLoaded(load, initial) {
    const [state, setState] = useState({ data: initial, loading: true, error: null, notFound: false });
    const [reloadToken, setReloadToken] = useState(0);

    useEffect(() => {
        let cancelled = false;
        setState((previous) => ({ ...previous, loading: true, error: null, notFound: false }));
        load()
            .then((data) => {
                if (!cancelled) setState({ data, loading: false, error: null, notFound: false });
            })
            .catch((err) => {
                if (cancelled) return;
                const notFound = err?.status === 404;
                setState({ data: initial, loading: false, error: notFound ? null : err?.message ?? 'Something went wrong.', notFound });
            });
        return () => {
            cancelled = true;
        };
        // `initial` is a constant for the caller; `load` identity is what decides a refetch.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load, reloadToken]);

    const refetch = useCallback(() => setReloadToken((token) => token + 1), []);
    return { ...state, refetch };
}

const NO_ARTICLES = [];

/**
 * The article list. Everyone gets the published ones; with `admin` the list also has drafts (and deleted articles when
 * `includeDeleted` is set), from the admin endpoint. Switching `admin` (e.g. once the session is restored) refetches.
 */
export function useArticleList({ admin = false, includeDeleted = false } = {}) {
    const load = useCallback(
        () => (admin ? adminArticlesService.list({ includeDeleted }) : articlesService.getArticles()).then((result) => result.items),
        [admin, includeDeleted]
    );
    const { data, ...rest } = useLoaded(load, NO_ARTICLES);
    return { articles: data, ...rest };
}

/** One published article by its address. `notFound` is true for an unknown, draft or deleted one. */
export function useArticle(slug) {
    const load = useCallback(() => articlesService.getArticle(slug), [slug]);
    const { data, ...rest } = useLoaded(load, null);
    return { article: data, ...rest };
}

/** Admins: one article for the editor, by id. Pass null to wait (a new article has nothing to load). */
export function useAdminArticle(id) {
    const load = useCallback(() => (id == null ? Promise.resolve(null) : adminArticlesService.get(id)), [id]);
    const { data, ...rest } = useLoaded(load, null);
    return { article: data, ...rest };
}
