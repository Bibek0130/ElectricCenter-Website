import Button from './Button.jsx';

/** @param {{ title?: string, description?: string, onRetry?: () => void }} props */
function ErrorState({ title = 'Something went wrong', description = 'Please try again.', onRetry }) {
    return (
        <div className="state-block" role="alert">
            <div className="state-icon" aria-hidden="true">⚠️</div>
            <p className="state-title">{title}</p>
            <p className="state-description">{description}</p>
            {onRetry && (
                <div className="state-actions">
                    <Button variant="secondary" onClick={onRetry}>Retry</Button>
                </div>
            )}
        </div>
    );
}

export default ErrorState;
