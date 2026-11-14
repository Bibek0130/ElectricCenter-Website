import Badge from '../../../components/ui/Badge.jsx';

const DEMAND_CONFIG = {
    High: { variant: 'error', label: '🔥 High demand' },
    Medium: { variant: 'warning', label: 'Medium demand' },
    Low: { variant: 'success', label: 'Available now' },
};

/** @param {{ demand: 'High'|'Medium'|'Low' }} props */
function DemandBadge({ demand }) {
    const config = DEMAND_CONFIG[demand] || DEMAND_CONFIG.Medium;
    return <Badge variant={config.variant}>{config.label}</Badge>;
}

export default DemandBadge;
