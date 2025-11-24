import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Button } from 'react-bootstrap';
import { Clock, PersonPlus } from 'react-bootstrap-icons';
import StaffTable from './StaffTable';
import StaffSearch from './StaffSearch';

interface StaffStatusProps {
    onToast?: (msg: string, type?: string) => void;
}

// Estados posibles: "On Shift" (verde), "Delayed" (amarillo), "Shift Ended" (rojo)
const StaffStatus: React.FC<StaffStatusProps> = ({ onToast }) => {
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState<string>('');

    useEffect(() => {
        const intervalId = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(intervalId);
    }, []);

    const handleCreateEmployee = () => {
        onToast?.('Functionality to create a new employee is not implemented yet.', 'info');
    };

    return (
        <div className="d-flex flex-column" style={{ backgroundColor: 'white' }}>
            <Container fluid className="py-4">
                <div className="p-3 border rounded-4 shadow mb-4">
                    <div className="d-flex justify-content-between align-items-start mb-4 flex-wrap">
                        {/* Bloque izquierdo: título + reloj */}
                        <div className="mb-3 mb-sm-0">
                            <h2 className="mb-1 rounded-heading">STAFF</h2>
                            <small className="text-muted d-block">
                                <Clock size={14} className="me-1" />
                                {currentTime.toLocaleTimeString()}
                            </small>
                        </div>
                        {/* Bloque derecho: botón + indicadores */}
                        <div className="d-flex flex-column align-items-end" style={{ minWidth: '220px' }}>
                            <Button
                                variant="primary"
                                onClick={handleCreateEmployee}
                                className="d-flex align-items-center mb-3"
                                style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}
                            >
                                <PersonPlus size={18} className="me-2" />
                                Create Employee
                            </Button>
                            {/* Indicadores debajo del botón alineados en fila */}
                            <div className="text-end w-100">
                                <h6 className="mb-2">Status Indicators</h6>
                                <div className="d-flex flex-row flex-wrap justify-content-end align-items-center" style={{ gap: '1.25rem' }}>
                                    <div className="d-flex align-items-center gap-2">
                                        <span style={{ width: 18, height: 18, backgroundColor: '#75c39b', display: 'inline-block' }} />
                                        <span className="small">On Shift</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        <span style={{ width: 18, height: 18, backgroundColor: '#ffdd63', display: 'inline-block' }} />
                                        <span className="small">Delayed</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        <span style={{ width: 18, height: 18, backgroundColor: '#f28b9b', display: 'inline-block' }} />
                                        <span className="small">Shift Ended</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tabla de empleados */}
                    <StaffTable searchTerm={searchTerm} onToast={onToast || (() => {})} />
                </div>
                <Row>
                    <Col md={6}>
                        <div className="p-3 border rounded-4 shadow h-100">
                            <StaffSearch onSearchTermChange={setSearchTerm} />
                        </div>
                    </Col>
                    <Col md={6}>
                        <div className="p-3 border rounded-4 shadow h-100 text-muted d-flex align-items-center justify-content-center">
                            <span>Staff notifications component coming soon...</span>
                        </div>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default StaffStatus;
