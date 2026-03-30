function landingPage() {

    return (
        <>
           
            <div className="container" style={centerContainer}>
                <div className="row">
                    <h1>OVER 20 YEARS EXPERIENCE</h1>
                </div>

                <div className="row">
                    <p>
                        Lorem ipsum dolor sit amet, consectetuer adipiscing elit. Aenean commodo ligula eget dolor. Aenean massa. Cum sociis natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus. Donec quam felis, ultricies nec, pellentesque eu, pretium quis, sem. Nulla consequat massa quis enim. Donec pede justo, fringilla vel, aliquet nec, vulputate
                    </p>
                </div>

                <div className="row align-items-center">
                    
                        <div className="col p-2 text-lg-end text-md-end">
                            <div>
                            <button className="btn btn-lg btn-danger " >Services</button>
                            </div>

                        </div>
                        <div className="col p-2 text-lg-start text-md-start">
                            <div>
                                <button className="btn btn-lg btn-dark">Product</button>
                            </div>

                        </div>
                    
                </div>
               
            </div>
           
        </>
    )
}
export default landingPage;

const centerContainer = {
    padding: "10% 10% "
    //display: "flex",
    //justifyContent: "center"
}

