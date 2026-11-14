/** @param {{ icon?: string, title: string, description?: string, action?: React.ReactNode }} props */
function EmptyState({ icon = '🔍', title, description, action }) {
    return (
        <div className="state-block">
            <div className="state-icon" aria-hidden="true">{icon}</div>
            <p className="state-title">{title}</p>
            {description && <p className="state-description">{description}</p>}
            {action && <div className="state-actions">{action}</div>}
        </div>
    );
}

export default EmptyState;
