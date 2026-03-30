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
                                        as={NavLink}
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
        </>
    );
};

export default CustomNav;