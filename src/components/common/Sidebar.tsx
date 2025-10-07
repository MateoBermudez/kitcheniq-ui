import {type JSX, useState} from 'react';
import { Nav, Modal } from 'react-bootstrap';
import {
    House,
    ClipboardCheck,
    Box,
    Journal,
    Truck,
    People,
    CashCoin,
    BarChart,
    Receipt,
    FileEarmarkBarGraph,
    PersonCircle
} from 'react-bootstrap-icons';
import { Link } from 'react-router-dom';
import perfilImage from '../../assets/profilepic.jpg';

type SidebarProps = {
    activeSection: string;
    onSectionChange: (section: string) => void;
    userName?: string;
    userType?: string;
};

type NavItem = {
    key: string;
    route: string;
    icon: JSX.Element;
    label: string;
    active?: boolean;
};

const Sidebar = ({ activeSection, onSectionChange, userName, userType }: SidebarProps) => {
    const [showImageModal, setShowImageModal] = useState(false);

    // Function to format the user type (default fallback EMPLOYEE)
    const formatUserType = (type?: string) => {
        if (!type) return 'EMPLOYEE';
        return type.toUpperCase();
    };

    // Function to get a display user name (default fallback USER123)
    const getDisplayName = (name?: string) => {
        if (!name) return 'USER123';
        return name;
    };

    const controlItems: NavItem[] = [
        { key: 'home', route: '/home', icon: <House size={18} />, label: 'Home' },
        { key: 'orders', route: '/orders', icon: <ClipboardCheck size={18} />, label: 'Orders' },
        { key: 'inventory', route: '/inventory', icon: <Box size={18} />, label: 'Inventory' },
        { key: 'menu', route: '/menu', icon: <Journal size={18} />, label: 'Menu' },
        { key: 'supplier', route: '/supplier', icon: <Truck size={18} />, label: 'Suppliers' },
        { key: 'staff', route: '/staff', icon: <People size={18} />, label: 'Staff' },
    ];

    const financeItems: NavItem[] = [
        { key: 'cash', route: '/cash', icon: <CashCoin size={18} />, label: 'Cash Register' },
        { key: 'sales', route: '/sales', icon: <BarChart size={18} />, label: 'Sales' },
        { key: 'expenses', route: '/expenses', icon: <Receipt size={18} />, label: 'Expenses' },
        { key: 'reports', route: '/reports', icon: <FileEarmarkBarGraph size={18} />, label: 'Reports' },
    ];

    const renderNavItems = (items: NavItem[]) => {
        return items.map((item: NavItem) => (
            <Nav.Link
                as={Link}
                to={item.route}
                key={item.key}
                className={`d-flex align-items-center py-2 px-3 text-dark ${
                    activeSection === item.key || item.active ? 'rounded' : ''
                }`}
                onClick={() => onSectionChange && onSectionChange(item.key)}
                style={{
                    cursor: 'pointer',
                    backgroundColor: (activeSection === item.key || item.active) ? '#86e5ff' : 'transparent',
                    textDecoration: 'none'
                }}
            >
                <span className="me-2">{item.icon}</span>
                {item.label}
            </Nav.Link>
        ));
    };

    return (
        <div className="border-end d-flex flex-column"
             style={{
                 width: '250px',
                 backgroundColor: '#C5EFFFFF',
                 height: '100vh',
                 position: 'sticky',
                 top: 0,
                 overflowY: 'auto'
             }}>
            <div className="p-4 border-bottom rounded-bottom-4" style={{backgroundColor: '#86e5ff'}}>
                <div className="d-flex align-items-center py-2">
                    <div className="rounded-circle d-flex align-items-center justify-content-center me-3"
                         style={{ width: '50px', height: '50px', overflow: 'hidden', cursor: 'pointer' }}
                         onClick={() => setShowImageModal(true)}>
                        <img
                            src={perfilImage}
                            alt="Profile"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </div>
                    <div>
                        <small className="text-muted">{getDisplayName(userName)}</small>
                        <div className="fw-bold">{formatUserType(userType)}</div>
                    </div>
                </div>
            </div>

            <Modal
                show={showImageModal}
                onHide={() => setShowImageModal(false)}
                centered
                size="sm"
            >
                <Modal.Header closeButton>
                    <Modal.Title>
                        <PersonCircle size={24} className="me-2 text-dark" />
                        PROFILE PICTURE
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="text-center p-0">
                    <img
                        src={perfilImage}
                        alt="Enlarged profile"
                        style={{ width: '100%', height: 'auto', maxHeight: '70vh' }}
                    />
                </Modal.Body>
            </Modal>

            <Nav className="flex-column p-2">
                <div className="text-uppercase fw-bold text-dark small ms-2 mt-3 mb-2 rounded-heading">Control</div>
                {renderNavItems(controlItems)}

                <div className="text-uppercase fw-bold text-dark small ms-2 mt-4 mb-2">Finance</div>
                {renderNavItems(financeItems)}
            </Nav>
        </div>
    );
};

export default Sidebar;
