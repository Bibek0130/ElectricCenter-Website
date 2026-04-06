// MainLayout.jsx
// Layout component for the Electric Center client application.
// Provides header, collapsible sidebar navigation and main content area.
//
// Preserves any existing comment blocks as required.

import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import { Col, Row } from 'react-bootstrap'; 

const CustomNav = ({ li }) => {
    return (
        <>
            <Navbar expand="lg" className="bg-body-tertiary">
                <Container>
                    <Navbar.Brand as={NavLink} to="/home">
                        <img
                            width="30"
                            height="30"
                            src="https://img.icons8.com/quill/50/FA5252/light-on.png"
                            alt="light-on"
                            className="d-inline-block align-top me-2"
                        />
                        <b>Panchamukhi Electric Center</b>
                    </Navbar.Brand>

                    <Navbar.Toggle aria-controls="basic-navbar-nav" />

                    <Navbar.Collapse id="basic-navbar-nav">
                        <Nav className="me-auto">
                            {li.map((item, i) => {
                                // Create path based on the second element in your array (e.g., "home", "about")
                                const path = `/${item[1]}`;
                                return (
                                    <Nav.Link
                                        key={i}
                                        as={NavLink} //sends as link
                                        to={path}
                                    >
                                        {item[0]}
                                    </Nav.Link>
                                );
                            })}
                        </Nav>

                        <span className="navbar-text">
                            <img width="20" height="20" src="https://img.icons8.com/sf-black-filled/64/FA5252/phone-disconnected.png" alt="phone-disconnected" />
                            <span className="ms-2">+977 9841445050</span>
                        </span>
                    </Navbar.Collapse>
                </Container>
            </Navbar>

            {/* This is where routed pages (Home, About, etc.) will render */}
            <Container className="mt-4">
                <Outlet />
            </Container>

            {/*Footer page*/}
            <Container className="mt-5 mb-3 text-center">
                <div className="row " style={FooterDivStyle}>
                    <div className="col-lg-3">
                        <span style={footerHeadStyle}>About Us</span>
                            <p className="p-2" style={aboutUsParagraph}>We provide trusted electrical products and services including earthing, lightening, solar, CCTv
                                , and UPS systems. Quality and reliability are at the heart of everything we do. With over 20 years of experience, we are your go-to source for all your electrical needs.
                            </p>
                        
                    </div>

                    <div className="col-lg-3">
                        <span style={footerHeadStyle}>Explore</span>
                        <ul className="list-unstyled" style={exploreListStyle}>
                            <li className="footer-btn-link" style={footerBtnLink}>House Wiring</li>
                        </ul>
                        <ul className="list-unstyled" style={exploreListStyle}>
                            <li className="footer-btn-link" style={footerBtnLink}>Solar</li>
                        </ul>
                        <ul className="list-unstyled" style={exploreListStyle}>
                            <li className="footer-btn-link" style={footerBtnLink }>Repair and Maintaince</li>
                        </ul>
                        <ul className="list-unstyled" style={exploreListStyle}>
                            <li className="footer-btn-link" style={footerBtnLink}>Earthing</li>
                        </ul>
                    </div>

                    <div className="col-lg-3">

                        <Col >
                            <h5 className="" style={footerHeadStyle }>Quick Links</h5>
                            <ul className="list-unstyled">
                                <li>
                                    <a href="/#gallery" className="footer-link" style={footerLink}>
                                        Gallery
                                    </a>
                                </li>
                                <li>
                                    <a href="/consumer-care" className="footer-link" style={footerLink}>
                                        Consumer Care
                                    </a>
                                </li>
                                <li>
                                    <a href="/about" className="footer-link" style={footerLink }>
                                        About Us
                                    </a>
                                </li>

                            </ul>
                        </Col>
                    </div>
                    <hr className="border-secondary" />
                    <Row>
                        <Col className="text-center">
                            <p className="mb-0">
                                © {new Date().getFullYear()} Panchamukhi Electric Center. All rights reserved.
                            </p>
                        </Col>
                    </Row>

                </div>
            </Container>
        </>
    );
};

export default CustomNav;

const footerHeadStyle = {
    fontSize: '18px',
    fontWeight: 'bold'
}
const FooterDivStyle = {
    border: '1px solid #FF5A5A',
    borderRadius: '5px',
    margin:'1% 5% 1% 5%'
}
const aboutUsParagraph = {
    fontWeight: '200',
    fontSize: '14px',
    color: '#555'
}
const exploreListStyle = {
    fontSize: '14px',
    margin: '0',
    padding: '0'
}
    /* Footer Links */
 const footerLink ={
    textDecoration: 'none',
    transition: 'color 0.3s ease'
}



/* Button Links (for scrolling) */
const footerBtnLink ={
    background: 'none',

    cursor: 'pointer',
    //textAlign: 'left',
    transition: 'color 0.3s ease',
    fontSize: '0.85rem'
}

