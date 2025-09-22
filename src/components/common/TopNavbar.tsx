import { Navbar, Container, Nav } from 'react-bootstrap';
import { BoxArrowRight } from 'react-bootstrap-icons';
import logo from '../../assets/letras.png';

interface TopNavbarProps {
    onLogout?: () => void;
}

const TopNavbar: React.FC<TopNavbarProps> = ({ onLogout }) => {
    const actualDate = new Date().toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });

    const handleLogout = () => {
        console.log('Cerrando sesión...');
        if (onLogout) {
            onLogout();
        }
    };

    return (
        <Navbar expand="lg" className="py-2" style={{ backgroundColor: '#B1E5FF' }}>
            <Container fluid>
                <div className="ms-2">
                    <Navbar.Brand href="/">
                        <img
                            src={logo}
                            className="d-inline-block align-top me-2"
                            alt="KitchenIQ Logo"
                            style={{
                                height: '40px',
                                maxWidth: '120px',
                                objectFit: 'contain'
                            }}
                        />
                    </Navbar.Brand>
                </div>
                <Nav className="ms-auto d-flex align-items-center">
                    <Nav.Item className="text-dark me-3">
                        {actualDate}
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