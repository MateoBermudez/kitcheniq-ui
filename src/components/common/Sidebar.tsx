import React from 'react';
import { useState } from 'react';
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
import perfilImage from '../../assets/profilepic.jpg';

const Sidebar = ({ activeSection, onSectionChange }) => {
    const [showImageModal, setShowImageModal] = useState(false);

    const controlItems = [
        { key: 'Home', icon: <House size={18} />, label: 'Home' },
        { key: 'pedidos', icon: <ClipboardCheck size={18} />, label: 'Pedidos' },
        { key: 'Inventario', icon: <Box size={18} />, label: 'Inventario' },
        { key: 'Carta', icon: <Journal size={18} />, label: 'Carta' },
        { key: 'Proveedores', icon: <Truck size={18} />, label: 'Proveedores' },
        { key: 'Personal', icon: <People size={18} />, label: 'Personal' },
    ];

    const finanzasItems = [
        { key: 'Caja', icon: <CashCoin size={18} />, label: 'Caja' },
        { key: 'Ventas', icon: <BarChart size={18} />, label: 'Ventas' },
        { key: 'Gastos', icon: <Receipt size={18} />, label: 'Gastos' },
        { key: 'Reportes', icon: <FileEarmarkBarGraph size={18} />, label: 'Reportes' },
    ];

    const renderNavItems = (items) => {
        return items.map((item) => (
            <Nav.Link
                key={item.key}
                className={`d-flex align-items-center py-2 px-3 text-dark ${
                    activeSection === item.key || item.active ? 'rounded' : ''
                }`}
                onClick={() => onSectionChange && onSectionChange(item.key)}
                style={{
                    cursor: 'pointer',
                    backgroundColor: (activeSection === item.key || item.active) ? '#B1E5FF' : 'transparent'
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
                 backgroundColor: '#E3F2FD',
                 height: '100vh',
                 position: 'sticky',
                 top: 0,
                 overflowY: 'auto'
             }}>
            <div className="p-4 border-bottom rounded-bottom-4" style={{backgroundColor: '#B1E5FF'}}>
                <div className="d-flex align-items-center py-2">
                    <div className="rounded-circle d-flex align-items-center justify-content-center me-3"
                         style={{ width: '50px', height: '50px', overflow: 'hidden', cursor: 'pointer' }}
                         onClick={() => setShowImageModal(true)}>
                        <img
                            src={perfilImage}
                            alt="Perfil"
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                    </div>
                    <div>
                        <small className="text-muted">DANIELOIDE2</small>
                        <div className="fw-bold">Administrador</div>
                    </div>
                </div>
            </div>

            <Modal
                show={showImageModal}
                onHide={() => setShowImageModal(false)}
                centered
                size="md"
            >
                <Modal.Header closeButton>
                    <Modal.Title>
                        <PersonCircle size={24} className="me-2 text-dark rounded-heading" />
                        FOTO DE PERFIL
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="text-center p-0">
                    <img
                        src={perfilImage}
                        alt="Perfil ampliado"
                        style={{ width: '100%', height: 'auto', maxHeight: '70vh' }}
                    />
                </Modal.Body>
            </Modal>

            <Nav className="flex-column p-2">
                <div className="text-uppercase fw-bold text-dark small ms-2 mt-3 mb-2 rounded-heading">Control</div>
                {renderNavItems(controlItems)}

                <div className="text-uppercase fw-bold text-dark small ms-2 mt-4 mb-2 rounded-heading">Finanzas</div>
                {renderNavItems(finanzasItems)}
            </Nav>
        </div>
    );
};

export default Sidebar;