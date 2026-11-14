/** Turns an axios error into an Error with a message that's safe to show the user. */
export function toUserError(err, fallback = 'Something went wrong. Please try again.') {
    if (!err?.response) {
        return new Error(err?.code === 'ECONNABORTED' ? 'The server took too long to respond. Please try again.' : "Can't reach the server. Check your connection and try again.");
    }
    const message = err.response.data?.message;
    if (typeof message === 'string' && message) return withStatus(new Error(message), err.response.status);
    if (err.response.status === 429) return withStatus(new Error('Too many attempts. Please wait a minute and try again.'), 429);
    if (err.response.status === 403) return withStatus(new Error("You don't have permission to do that."), 403);
    return withStatus(new Error(fallback), err.response.status);
}

/** Keeps the HTTP status on the error so callers can react to e.g. a 409 conflict. */
function withStatus(error, status) {
    error.status = status;
    return error;
}

/** Runs an API call and rethrows failures as user-facing errors. */
export async function callApi(request, fallback) {
    try {
        return await request();
    } catch (err) {
        throw toUserError(err, fallback);
    }
}
