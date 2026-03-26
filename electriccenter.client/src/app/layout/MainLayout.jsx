// MainLayout.jsx
// Layout component for the Electric Center client application.
// Provides header, collapsible sidebar navigation and main content area.
//
// Preserves any existing comment blocks as required.

import React, { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';

function CustomNav() {
    return (
        <>
        <Navbar className="bg-body-tertiary">
        <Container>
          <Navbar.Brand href="#home">
          <img width="50" height="50" src="https://img.icons8.com/quill/50/FA5252/light-on.png" alt="light-on"/>
           <b>Panchamukhi Electric Center </b>
          </Navbar.Brand>

          <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto " >
            <Nav.Link href="#home">Home</Nav.Link>
            <Nav.Link href="#services">Services</Nav.Link>
            <Nav.Link href="#FAQ">Common Electrical Problem</Nav.Link>
          </Nav>
          <span>
            <img width="30" height="30" src="https://img.icons8.com/sf-black-filled/64/FA5252/phone-disconnected.png" alt="phone-disconnected"/> +977 9841445050      
          </span>
        </Navbar.Collapse>
        </Container>
      </Navbar>
        </>
    )
}
export default CustomNav;

