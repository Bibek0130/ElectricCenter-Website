import { Link } from 'react-router-dom';
import EmptyState from '../../components/ui/EmptyState.jsx';
import Button from '../../components/ui/Button.jsx';
import { useSeo } from '../../seo/useSeo.js';

/**
 * Shown for any address that isn't a page. The server answers these with a 404 status, so search engines drop them;
 * this is what people see (it used to silently send everyone to the home page, which hid mistyped links).
 */
function NotFoundPage() {
    useSeo({ title: 'Page not found', noindex: true });

    return (
        <EmptyState
            icon="🔌"
            title="Page not found"
            description="That page doesn't exist, or it has moved."
            action={<Button as={Link} to="/">Go to the home page</Button>}
        />
    );
}

export default NotFoundPage;
