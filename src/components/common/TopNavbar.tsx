import React from 'react';
import { Navbar, Container, Nav } from 'react-bootstrap';
import { BoxArrowRight } from 'react-bootstrap-icons';
import logo from '../../../../kitcheniq-ui-refactor/src/assets/LogoKitchenIQ.png';

const TopNavbar = () => {
    const fechaActual = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const handleLogout = () => {
        console.log('Cerrando sesión...');
    };

    return (
        <Navbar expand="lg" className="py-2" style={{ backgroundColor: '#B1E5FF' }}>
            <Container fluid>
                <div className="ms-4">
                    <Navbar.Brand href="/">
                        <img
                            src={logo}
                            width="80"
                            height="40"
                            className="d-inline-block align-top me-2"
                            alt="KitchenIQ Logo"
                        />
                    </Navbar.Brand>
                </div>
                <Nav className="ms-auto d-flex align-items-center">
                    <Nav.Item className="text-dark me-3">
                        {fechaActual}
                    </Nav.Item>
                    <Nav.Link onClick={handleLogout} className="text-dark">
                        <BoxArrowRight size={24} />
                    </Nav.Link>
                </Nav>
            </Container>
        </Navbar>
    );
};

export default TopNavbar;