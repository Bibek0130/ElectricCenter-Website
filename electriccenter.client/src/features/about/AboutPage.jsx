import { COLORS } from "../../data/constants"; 


function AboutPage() {
    return (
        <div style={{ paddingTop: 0 }}>
            <div style={{ background: `linear-gradient(135deg, ${COLORS.redDark} 0%, ${COLORS.red} 100%)`, padding: "56px 24px 48px", textAlign: "center" }}>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", fontFamily: "sans-serif", marginBottom: 12 }}>WHO WE ARE</p>
                <h1 style={{ color: COLORS.white, fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 700, fontFamily: "'Georgia', serif", margin: "0 0 12px" }}>About Us</h1>
            </div>

            <div style={{ maxWidth: 900, margin: "0 auto", padding: "56px 24px 80px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center", marginBottom: 64 }}>
                    <div>
                        <h2 style={{ fontSize: 28, fontWeight: 700, color: COLORS.gray900, fontFamily: "'Georgia', serif", marginTop: 0, marginBottom: 16 }}>Nepal's Trusted Electrical Supplier</h2>
                        <p style={{ fontSize: 15, color: COLORS.gray600, fontFamily: "sans-serif", lineHeight: 1.8, marginBottom: 16 }}>
                            Electric Center has been serving Kathmandu and Nepal since 1995. From a small shop in Kumarigal, we've grown into one of the valley's largest electrical supply stores.
                        </p>
                        <p style={{ fontSize: 15, color: COLORS.gray600, fontFamily: "sans-serif", lineHeight: 1.8 }}>
                            We carry everything from basic wiring materials to industrial equipment, and our expert team is always ready to help you find the right solution for your project.
                        </p>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                        {[
                            { num: "30+", label: "Years in Business" },
                            { num: "500+", label: "Products" },
                            { num: "10,000+", label: "Happy Customers" },
                            { num: "50+", label: "Expert Staff" },
                        ].map(s => (
                            <div key={s.label} style={{ background: COLORS.redLight, borderRadius: 12, padding: 20, textAlign: "center" }}>
                                <div style={{ fontSize: 28, fontWeight: 800, color: COLORS.red, fontFamily: "'Georgia', serif" }}>{s.num}</div>
                                <div style={{ fontSize: 12, color: COLORS.gray600, fontFamily: "sans-serif", marginTop: 4 }}>{s.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ background: COLORS.gray50, borderRadius: 16, padding: 32, borderLeft: `4px solid ${COLORS.red}` }}>
                    <h3 style={{ fontSize: 20, fontWeight: 700, color: COLORS.gray900, fontFamily: "'Georgia', serif", marginTop: 0, marginBottom: 12 }}>Our Mission</h3>
                    <p style={{ fontSize: 15, color: COLORS.gray600, fontFamily: "sans-serif", lineHeight: 1.8, margin: 0 }}>
                        To be Nepal's most reliable electrical supplier — offering quality products, expert advice, and professional services at fair prices, helping build a safer and more connected Nepal.
                    </p>
                </div>
            </div>
        </div>
    );
}
export default AboutPage;