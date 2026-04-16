import { COLORS } from "../../data/constants.js";
function Footer() {
    return (
        <footer style={{ background: COLORS.gray900, color: COLORS.white, paddingTop: 64 }}>
            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px 48px", display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 48 }}>
                {/* Col 1 — About */}
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
                        <div style={{ width: 36, height: 36, background: COLORS.red, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <span style={{ fontSize: 18 }}>⚡</span>
                        </div>
                        <div>
                            <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.white, lineHeight: 1 }}>ELECTRIC CENTER</div>
                            <div style={{ fontSize: 10, color: COLORS.gray400, letterSpacing: 2, textTransform: "uppercase" }}>Kathmandu, Nepal</div>
                        </div>
                    </div>
                    <p style={{ fontSize: 14, color: COLORS.gray400, lineHeight: 1.7, fontFamily: "sans-serif", marginBottom: 20 }}>
                        Kathmandu's premier electrical supply store since 1995. We provide quality electrical products, equipment, and professional services to homes, businesses, and contractors across Nepal.
                    </p>
                    <a href="https://www.whatsapp.com" style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        background: COLORS.red, color: COLORS.white, padding: "10px 16px",
                        borderRadius: 8, textDecoration: "none", fontSize: 14,
                        fontWeight: 700, fontFamily: "sans-serif",
                    }}>📞 +977-9841445050</a>
                </div>

                {/* Col 2 — Explore */}
                <div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: COLORS.white, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "sans-serif", marginTop: 0, marginBottom: 20, paddingBottom: 10, borderBottom: `1px solid rgba(255,255,255,0.1)` }}>Explore</h4>
                    {[{ label: "About Us", url: "/about" },
                        { label: "Our Services", url: "/services" },
                        { label: "Products Catalogue", url: "/products" },
                        { label: "Testimonials", url: "/home" }].map(l => (
                            <div key={l.label} style={{ marginBottom: 10 }}>
                                <a href={l.url} style={{textDecoration: "none"} }>
                                    <span style={{
                                        fontSize: 14, color: COLORS.gray400, cursor: "pointer",
                                        fontFamily: "sans-serif", transition: "color 0.2s",
                                        display: "flex", alignItems: "center", gap: 6,
                                    }}>
                                        <span style={{ color: COLORS.red, fontSize: 10 }}>▸</span> {l.label}
                                    </span>
                                </a>
                           
                        </div>
                    ))}
                </div>

                {/* Col 3 — Quick Links */}
                <div>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: COLORS.white, letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "sans-serif", marginTop: 0, marginBottom: 20, paddingBottom: 10, borderBottom: `1px solid rgba(255,255,255,0.1)` }}>Quick Links</h4>
                    {[
                        { label: "📦 Browse All Products", page: "/products" },
                        { label: "🛠️ Our Services", page: "/services" },
                        { label: "📞 Contact Us", page: "/contact" },
                        { label: "🏠 Home", page: "/home" },
                        { label: "ℹ️ About Us", page: "/about" },
                    ].map(l => (
                        <div key={l.label} style={{ marginBottom: 10 }}>
                            <a href={l.page} style={{textDecoration: "none"} }>
                                <span  style={{
                                    fontSize: 14, color: COLORS.gray400, cursor: "pointer",
                                    fontFamily: "sans-serif",
                                }}>{l.label}</span>
                            </a>
                        </div>
                    ))}
                    <div style={{ marginTop: 24, padding: 16, background: "rgba(220,38,38,0.12)", borderRadius: 8, border: `1px solid rgba(220,38,38,0.25)` }}>
                        <div style={{ fontSize: 12, color: COLORS.gray400, fontFamily: "sans-serif", marginBottom: 4 }}>Business Hours</div>
                        <div style={{ fontSize: 13, color: COLORS.white, fontFamily: "sans-serif", lineHeight: 1.6 }}>Sun–Fri: 9:00 AM – 7:00 PM<br />Sat: 10:00 AM – 5:00 PM</div>
                    </div>
                </div>
            </div>

            {/* Bottom bar */}
            <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", padding: "20px 24px", textAlign: "center" }}>
                <p style={{ margin: 0, fontSize: 13, color: COLORS.gray400, fontFamily: "sans-serif" }}>
                    © 2026 Panchamukhi Electric Center, Kharibot, Kumarigal, Kathmandu. All rights reserved. &nbsp;|&nbsp;
                </p>
            </div>
        </footer>
    );
}

export default Footer;