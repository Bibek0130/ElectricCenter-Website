/**
 * Only allow same-app paths as post-login destinations ("/account", "/electricians/1?x=y"),
 * never absolute or protocol-relative URLs ("https://evil.example", "//evil.example").
 * @param {unknown} candidate
 * @param {string} [fallback]
 */
export function safeRedirectPath(candidate, fallback = '/account') {
    if (typeof candidate !== 'string') return fallback;
    if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.startsWith('/\\')) return fallback;
    if (candidate.startsWith('/login') || candidate.startsWith('/register')) return fallback;
    return candidate;
}

/** The location state to pass when sending someone to /login so they come back afterwards. */
export function loginRedirectState(location) {
    return { from: `${location.pathname}${location.search ?? ''}` };
}
