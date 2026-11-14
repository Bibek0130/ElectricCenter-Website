import Card from "react-bootstrap/Card";
import { COLORS, services } from "../../../data/constants"; 
import './service.css';

function ServicePage() {
    return (
        <div style={{ paddingTop: 0 }}>
            <div style={{ background: `linear-gradient(135deg, ${COLORS.redDark} 0%, ${COLORS.red} 100%)`, padding: "56px 24px 48px", textAlign: "center" }}>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: 3, color: "rgba(255,255,255,0.6)", textTransform: "uppercase", fontFamily: "sans-serif", marginBottom: 12 }}>WHAT WE DO</p>
                <h1 style={{ color: COLORS.white, fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 700, fontFamily: "'Georgia', serif", margin: "0 0 12px" }}>Our Services</h1>
                <p style={{ color: "rgba(255,255,255,0.8)", fontSize: 16, fontFamily: "sans-serif", margin: 0 }}>Professional electrical services for every project</p>
            </div>

            <div style={{ maxWidth: 1100, margin: "0 auto", padding: "56px 24px 80px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
                    {services.map((s, i) => (
                        <div key={i} style={{
                            background: COLORS.white, borderRadius: 16, border: `1px solid ${COLORS.gray200}`,
                            padding: 28, display: "flex", flexDirection: "column",
                            boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
                            borderLeft: `4px solid ${s.color}`,
                        }}>
                            <div style={{ fontSize: 40, marginBottom: 16 }}>{s.icon}</div>
                            <h3 style={{ fontSize: 18, fontWeight: 700, color: COLORS.gray900, fontFamily: "'Georgia', serif", margin: "0 0 10px" }}>{s.title}</h3>
                            <p style={{ fontSize: 14, color: COLORS.gray600, fontFamily: "sans-serif", lineHeight: 1.6, margin: "0 0 20px", flex: 1 }}>{s.desc}</p>
                            <a href="tel:+977-9841445050" style={{
                                display: "inline-flex", alignItems: "center", gap: 6,
                                color: COLORS.red, fontSize: 13, fontWeight: 700,
                                fontFamily: "sans-serif", textDecoration: "none",
                            }}>📞 Get a Quote →</a>
                        </div>
                    ))}
                </div>

                {/* CTA */}
                <div style={{ marginTop: 64, background: `linear-gradient(135deg, ${COLORS.redDark}, ${COLORS.red})`, borderRadius: 20, padding: "48px 40px", textAlign: "center" }}>
                    <h2 style={{ color: COLORS.white, fontSize: 28, fontWeight: 700, fontFamily: "'Georgia', serif", marginTop: 0, marginBottom: 12 }}>Ready to Start Your Project?</h2>
                    <p style={{ color: "rgba(255,255,255,0.8)", fontFamily: "sans-serif", margin: "0 0 28px" }}>Call us or visit our store for a free consultation and quote.</p>
                    <a href="https://www.whatsapp.com" style={{
                        background: COLORS.white, color: COLORS.red,
                        padding: "14px 32px", borderRadius: 8, textDecoration: "none",
                        fontSize: 16, fontWeight: 700, fontFamily: "sans-serif",
                        display: "inline-block", boxShadow: "3px 3px 0 rgba(0,0,0,0.15)",
                    }}>📞 +977-9841445050</a>
                </div>
            </div>
        </div>
    );
}
/*function ServicePage() {
    return (
      <>
            <div className="container backgroundColor">
          <div className="row">
              <h2>Services</h2>
          </div>

          <div className="row">

            {*//*  Repair Services*//*}
              <div className="col-lg col-md-4">
                  <Card style={{ width: "20rem" }}>
                      <Card.Img variant="top" src="repair.jpeg" />
                      <Card.Body>
                                <Card.Title className="card-title">Need a repair??</Card.Title>
                          <Card.Text>
                              Contact our professional electricians for all your electrical repair needs. We offer fast and reliable service to get your home or business back up and running in no time.
                          </Card.Text>
                          <a href="#" className="btn btn-primary m-2">Reach Electrician</a>
                      </Card.Body>
                  </Card>
              </div>

              {*//* Wiring Services*//*}
              <div className="col-lg col-md-4">
                  <Card style={{ width: "20rem" }}>
                      <Card.Img variant="top" src="wiring.jpg" width="20rem" height="180 rem" />
                      <Card.Body>
                          <Card.Title className="card-title">Need Wiring?</Card.Title>
                          <Card.Text>
                              Contact our professional electricians for all your electrical repair needs. We offer fast and reliable service to get your home or business back up and running in no time.
                          </Card.Text>
                          <a href="#" className="btn btn-primary m-2">Reach Electrician</a>
                      </Card.Body>
                  </Card>
              </div>

              {*//* Home Delivery Services*//*}
              <div className="col-lg col-md-4">
                  <Card style={{ width: "20rem" }}>
                      <Card.Img variant="top" src="homedelivery.jpg" width="20rem" height="180 rem" />
                      <Card.Body>
                         <Card.Title className="card-title">Home Delivery</Card.Title>
                          <Card.Text>
                              Contact our professional electricians for all your electrical repair needs. We offer fast and reliable service to get your home or business back up and running in no time.
                          </Card.Text>
                          <a href="/products" className="btn btn-primary m-2">Order </a>
                      </Card.Body>
                  </Card>
              </div>

              

          </div>
            </div>
        </>
  );
} */

export default ServicePage;