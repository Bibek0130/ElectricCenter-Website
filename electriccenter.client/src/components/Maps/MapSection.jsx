import { COLORS } from '../../data/constants.js';
//for docs on map functionality on react : https://visgl.github.io/react-google-maps/docs/get-started
import { APIProvider, Map, AdvancedMarker, Pin } from '@vis.gl/react-google-maps';
import PoiMarkers from './PoiMarkers.jsx';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const locations = [{ key: 'Panchamukhi Electric Store', location: { lat: 27.714095182563064, lng: 85.35454232486178 } }];
function MapSection() {
    return (
        <section style={{ background: COLORS.gray50, padding: "64px 24px" }}>
            <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                <div style={{ textAlign: "center", marginBottom: 40 }}>
                    <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: 3, color: COLORS.red, textTransform: "uppercase", fontFamily: "sans-serif", marginBottom: 8 }}>FIND US</p>
                    <h2 style={{ fontSize: 32, fontWeight: 700, color: COLORS.gray900, fontFamily: "'Georgia', serif", margin: 0 }}>Visit Our Store</h2>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 32, alignItems: "start" }}>
                    <div style={{ borderRadius: 16, overflow: "hidden", border: `2px solid ${COLORS.gray200}`, boxShadow: `6px 6px 0 ${COLORS.redLight}`, aspectRatio: "16/7" }}>
                        <APIProvider apiKey={API_KEY}>
                            <Map
                                style={{ width: '100vw', height: '50vh' }}
                                // defaultCenter={{ lat: 22.54992, lng: 0 }}
                                defaultZoom={20}
                                defaultCenter={{ lat: 27.71409596508506, lng: 85.35457786413149 }}
                                gestureHandling='greedy'
                                disableDefaultUI
                                mapId={'DEMO_MAP_ID'}
                            >
                                <PoiMarkers pois={locations} />
                            </Map>
                        </APIProvider>
                    </div>
                    <div style={{ background: COLORS.white, borderRadius: 16, padding: 28, border: `1px solid ${COLORS.gray200}`, boxShadow: `4px 4px 0 ${COLORS.redLight}` }}>
                        <h3 style={{ fontSize: 20, fontWeight: 700, color: COLORS.red, fontFamily: "'Georgia', serif", marginTop: 0, marginBottom: 20 }}>Electric Center</h3>
                        {[
                            { icon: "📍", label: "Address", val: "Panchamukhi Hanuman Mandir, Kharibot, Kumarigal, Kathmandu, Nepal" },
                            { icon: "⏰", label: "Hours", val: "Sun–Sat: 8am–9pm\nSat: 10am–9pm" },
                            { icon: "📞", label: "Phone", val: "+977-9841445050" },
                        ].map(item => (
                            <div key={item.label} style={{ display: "flex", gap: 12, marginBottom: 18 }}>
                                <span style={{ fontSize: 18, marginTop: 2 }}>{item.icon}</span>
                                <div>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: COLORS.gray400, letterSpacing: 1, textTransform: "uppercase", fontFamily: "sans-serif" }}>{item.label}</div>
                                    <div style={{ fontSize: 14, color: COLORS.gray700, fontFamily: "sans-serif", lineHeight: 1.5, whiteSpace: "pre-line" }}>{item.val}</div>
                                </div>
                            </div>
                        ))}
                        <a href="https://maps.google.com" target="_blank" rel="noreferrer" style={{
                            display: "block", background: COLORS.red, color: COLORS.white,
                            textAlign: "center", padding: "12px 0", borderRadius: 8,
                            textDecoration: "none", fontSize: 14, fontWeight: 700,
                            fontFamily: "sans-serif", marginTop: 4,
                            boxShadow: `3px 3px 0 ${COLORS.redDark}`,
                        }}>Get Directions →</a>
                    </div>
                </div>
            </div>
        </section>
    );
}
export default MapSection;