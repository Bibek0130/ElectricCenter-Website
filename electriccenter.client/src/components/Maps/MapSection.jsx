// For docs on map functionality: https://visgl.github.io/react-google-maps/docs/get-started
import { APIProvider, Map } from '@vis.gl/react-google-maps';
import PoiMarkers from './PoiMarkers.jsx';
import Section from '../layout/Section.jsx';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const locations = [{ key: 'Panchamukhi Electric Store', location: { lat: 27.714095182563064, lng: 85.35454232486178 } }];

const STORE_DETAILS = [
    { icon: '📍', label: 'Address', val: 'Panchamukhi Hanuman Mandir, Kharibot, Kumarigal, Kathmandu, Nepal' },
    { icon: '⏰', label: 'Hours', val: 'Sun–Fri: 9am–7pm\nSat: 10am–5pm' },
    { icon: '📞', label: 'Phone', val: '+977-9841445050' },
];

function MapSection() {
    return (
        <Section eyebrow="Find us" title="Visit Our Store" style={{ background: 'var(--color-gray-50)' }}>
            <div className="grid-responsive" style={{ gridTemplateColumns: '1fr 320px', alignItems: 'start' }}>
                <div style={{ borderRadius: 'var(--radius-lg)', overflow: 'hidden', border: '1px solid var(--color-border)', boxShadow: 'var(--shadow-md)', aspectRatio: '16/7' }}>
                    {API_KEY ? (
                        <APIProvider apiKey={API_KEY}>
                            <Map
                                style={{ width: '100%', height: '100%' }}
                                defaultZoom={17}
                                defaultCenter={{ lat: 27.71409596508506, lng: 85.35457786413149 }}
                                gestureHandling="greedy"
                                disableDefaultUI
                                mapId="DEMO_MAP_ID"
                            >
                                <PoiMarkers pois={locations} />
                            </Map>
                        </APIProvider>
                    ) : (
                        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-gray-100)', color: 'var(--color-text-subtle)', fontSize: 'var(--text-sm)' }}>
                            Map unavailable — set VITE_GOOGLE_MAPS_API_KEY to enable.
                        </div>
                    )}
                </div>
                <div className="card card-padded">
                    <h3 style={{ color: 'var(--color-primary)', marginBottom: 'var(--space-5)' }}>Electric Center</h3>
                    {STORE_DETAILS.map((item) => (
                        <div key={item.label} style={{ display: 'flex', gap: 12, marginBottom: 'var(--space-4)' }}>
                            <span style={{ fontSize: 18 }} aria-hidden="true">{item.icon}</span>
                            <div>
                                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--color-text-subtle)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{item.label}</div>
                                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-gray-700)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{item.val}</div>
                            </div>
                        </div>
                    ))}
                    <a href="https://maps.google.com" target="_blank" rel="noreferrer" className="btn btn-primary btn-block">
                        Get directions →
                    </a>
                </div>
            </div>
        </Section>
    );
}

export default MapSection;
