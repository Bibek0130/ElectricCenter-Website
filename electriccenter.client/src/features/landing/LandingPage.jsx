import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import { useState } from 'react';
import MapSection from '../../components/Maps/MapSection.jsx';
import { COLORS, shopImages } from '../../data/constants.js';
function LandingPage() {

   

    const [current, setCurrent] = useState(0);
    const [animating, setAnimating] = useState(false);
    const goTo = (i) => { setAnimating(true); setTimeout(() => { setCurrent(i); setAnimating(false); }, 300); };

    return (
        <>
           
            <div style={centerContainer}>  
                <section style={{ position: "relative", height: "92vh", minHeight: 520, overflow: "hidden" }}>
                    {/* Image */}
                    <div style={{
                        position: "absolute", inset: 0,
                        backgroundImage: `url(${shopImages[current].url})`,
                        backgroundSize: "cover", backgroundPosition: "center",
                        transition: "opacity 0.4s ease",
                        opacity: animating ? 0 : 1,
                    }} />
                    <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(153,27,27,0.82) 0%, rgba(0,0,0,0.55) 60%, transparent 100%)" }} />

                    {/* Content */}
                    <div style={{ position: "relative", zIndex: 2, height: "100%", display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 7vw", maxWidth: 700 }}>
                        <div style={{ background: COLORS.red, color: COLORS.white, display: "inline-block", padding: "4px 12px", borderRadius: 4, fontSize: 12, fontWeight: 700, letterSpacing: 2, marginBottom: 20, textTransform: "uppercase", fontFamily: "sans-serif" }}>Panchamukhi Electric Center</div>
                        <h1 style={{ color: COLORS.white, fontSize: "clamp(36px, 6vw, 68px)", fontWeight: 800, lineHeight: 1.1, margin: "0 0 20px", fontFamily: "'Georgia', serif", letterSpacing: "-1px" }}>
                            Powering Every<br />
                            <span style={{ color: "#FCA5A5" }}>Connection</span>
                        </h1>
                        <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 18, margin: "0 0 36px", lineHeight: 1.6, fontFamily: "sans-serif", maxWidth: 440 }}>
                            Your complete source for electrical equipment, supplies, and expert services in Nepal.
                        </p>
                        <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                            <a href="/products">
                                <button style={{
                                    background: COLORS.white, color: COLORS.red, border: "none",
                                    padding: "14px 28px", borderRadius: 8, fontSize: 15, fontWeight: 700,
                                    cursor: "pointer", boxShadow: "3px 3px 0 rgba(153,27,27,0.4)", fontFamily: "sans-serif",
                                    transition: "transform 0.15s",
                                }}>Shop Products →</button>
                            </a>

                            <a href="/services">
                                <button style={{
                                    background: "transparent", color: COLORS.white,
                                    border: `2px solid rgba(255,255,255,0.6)`,
                                    padding: "14px 28px", borderRadius: 8, fontSize: 15, fontWeight: 600,
                                    cursor: "pointer", fontFamily: "sans-serif", transition: "all 0.2s",
                                }}>Our Services</button>
                            </a>
                           
                        </div>
                    </div>

                    {/* Caption */}
                    <div style={{ position: "absolute", bottom: 80, right: 40, zIndex: 2, background: "rgba(0,0,0,0.5)", color: COLORS.white, padding: "6px 16px", borderRadius: 20, fontSize: 13, fontFamily: "sans-serif", backdropFilter: "blur(4px)" }}>
                        {shopImages[current].caption}
                    </div>

                    {/* Dots */}
                    <div style={{ position: "absolute", bottom: 28, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 8, zIndex: 2 }}>
                        {shopImages.map((_, i) => (
                            <button key={i} onClick={() => goTo(i)} style={{
                                width: i === current ? 28 : 8, height: 8,
                                borderRadius: 4, background: i === current ? COLORS.white : "rgba(255,255,255,0.4)",
                                border: "none", cursor: "pointer", transition: "all 0.3s", padding: 0,
                            }} />
                        ))}
                    </div>
                </section>

                {/*Why us section*/}
                <section style={{ background: COLORS.white, padding: "48px 24px 64px" }}>
                    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
                        <p style={{ fontSize: 13, fontWeight: 700, letterSpacing: 3, color: COLORS.red, textTransform: "uppercase", fontFamily: "sans-serif", marginBottom: 8, textAlign: "center" }}>WHY CHOOSE US</p>
                        <h2 style={{ fontSize: 32, fontWeight: 700, color: COLORS.gray900, fontFamily: "'Georgia', serif", textAlign: "center", marginBottom: 48 }}>The Electric Center Difference</h2>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 24 }}>
                            {[
                                { icon: "🏆", title: "20+ Years Experience", desc: "Trusted by thousands of customers since 2005" },
                                { icon: "📦", title: "500+ Products", desc: "Largest selection of electrical goods in Kathmandu" },
                                { icon: "🚚", title: "Fast Delivery", desc: "Same-day delivery within Kathmandu valley" },
                                { icon: "💯", title: "Quality Guarantee", desc: "All products certified and warranty backed" },
                            ].map(c => (
                                <div key={c.title} style={{ padding: 24, borderRadius: 12, border: `1px solid ${COLORS.gray200}`, textAlign: "center", transition: "box-shadow 0.2s" }}>
                                    <div style={{ fontSize: 36, marginBottom: 12 }}>{c.icon}</div>
                                    <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.gray900, fontFamily: "'Georgia', serif", marginBottom: 8 }}>{c.title}</div>
                                    <div style={{ fontSize: 14, color: COLORS.gray600, fontFamily: "sans-serif", lineHeight: 1.5 }}>{c.desc}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </section>

                {/* Map Section*/}
                <MapSection />
               
            </div>
           
        </>
    )
}
export default LandingPage;

const centerContainer = {
    //padding: "10% 10% "
    //display: "flex",
    //justifyContent: "center"
}

