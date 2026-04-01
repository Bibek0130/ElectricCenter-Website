import Card from "react-bootstrap/Card";
import './service.css';
function ServicePage() {
    return (
      <>
            <div className="container backgroundColor">
          <div className="row">
              <h2>Services</h2>
          </div>

          <div className="row">

            {/*  Repair Services*/}
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

              {/* Wiring Services*/}
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

              {/* Home Delivery Services*/}
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
} 

export default ServicePage;