import React, { useEffect, useState } from 'react';
import { Container, Row, Col, Button, Modal, Form } from 'react-bootstrap';
import { Clock, PersonPlus, Person, PersonBadge, Calendar, CashCoin, CheckCircle, XCircle } from 'react-bootstrap-icons';
import StaffTable from './StaffTable';
import StaffSearch from './StaffSearch';
import StaffNotifications from './StaffNotifications';
import { createEmployee, type EmployeeTypeCode } from '../../service/api';

interface StaffStatusProps {
    onToast?: (msg: string, type?: string) => void;
}

interface NewEmployee {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    hourlyRate: string;
    contractDate: string;
}

// Estados posibles: "On Shift" (verde), "Delayed" (amarillo), "Shift Ended" (rojo)
const StaffStatus: React.FC<StaffStatusProps> = ({ onToast }) => {
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newEmployee, setNewEmployee] = useState<NewEmployee>({
        id: '',
        firstName: '',
        lastName: '',
        position: '',
        hourlyRate: '',
        contractDate: new Date().toISOString().split('T')[0]
    });
    const [showShiftModal, setShowShiftModal] = useState(false);
    const [shiftForm, setShiftForm] = useState({ fromId: '', toId: '' });

    useEffect(() => {
        const intervalId = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(intervalId);
    }, []);

    // Helpers to update form state in a typed way (avoid any)
    const updateNewEmployeeField = (name: keyof NewEmployee, value: string) => {
        setNewEmployee(prev => ({ ...prev, [name]: value }));
    };
    const updateShiftField = (name: 'fromId' | 'toId', value: string) => {
        setShiftForm(prev => ({ ...prev, [name]: value }));
    };

    const ALLOWED_POSITIONS: Array<'Admin' | 'Chef' | 'Waiter'> = ['Admin', 'Chef', 'Waiter'];
    const isAllowedPosition = (position: string): boolean => {
        const p = position.trim();
        return ALLOWED_POSITIONS.includes(p as 'Admin' | 'Chef' | 'Waiter');
    };

    const toEmployeeType = (position: string): EmployeeTypeCode => {
        const p = position.trim().toUpperCase();
        if (p === 'ADMIN' || p === 'CHEF' || p === 'WAITER') return p as EmployeeTypeCode;
        return 'ADMIN';
    };

    const handleCreateEmployee = async () => {
        // Validación básica
        if (!newEmployee.id.trim()) { onToast?.('Employee ID is required', 'error'); return; }
        if (!newEmployee.firstName.trim()) { onToast?.('First name is required', 'error'); return; }
        if (!newEmployee.lastName.trim()) { onToast?.('Last name is required', 'error'); return; }
        if (!newEmployee.position.trim() || !isAllowedPosition(newEmployee.position)) {
            onToast?.('Position must be Admin, Chef, or Waiter', 'error'); return;
        }
        const rate = parseFloat(newEmployee.hourlyRate);
        if (!newEmployee.hourlyRate.trim() || isNaN(rate) || rate <= 0) {
            onToast?.('Hourly rate must be greater than 0', 'error'); return;
        }

        try {
            const payload = {
                id: newEmployee.id.trim(),
                password: newEmployee.id.trim(), // initial password = ID (can be changed later)
                name: newEmployee.firstName.trim(),
                lastName: newEmployee.lastName.trim(),
                type: toEmployeeType(newEmployee.position),
                hourlyRate: rate
            } as const;
            await createEmployee(payload);

            // Persist contract date locally (not sent to backend)
            try {
                const key = 'staffContractMap';
                const raw = localStorage.getItem(key);
                const map = raw ? JSON.parse(raw) as Record<string,string> : {};
                map[payload.id] = newEmployee.contractDate; // keep YYYY-MM-DD
                localStorage.setItem(key, JSON.stringify(map));
            } catch { /* ignore */ }

            onToast?.(`Employee ${payload.name} ${payload.lastName} created successfully!`, 'success');

            // Reset form and close
            setNewEmployee({
                id: '', firstName: '', lastName: '', position: '', hourlyRate: '',
                contractDate: new Date().toISOString().split('T')[0]
            });
            setShowCreateModal(false);

            // notify table to reload from backend
            try { window.dispatchEvent(new CustomEvent('staff-reload')); } catch { /* ignore */ }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Could not create employee';
            onToast?.(msg, 'error');
        }
    };

    const isShiftDisabled = !shiftForm.fromId.trim() || !shiftForm.toId.trim() || shiftForm.fromId.trim() === shiftForm.toId.trim();
    const handleShiftChange = () => {
        if (isShiftDisabled) return;
        const fromId = shiftForm.fromId.trim();
        const toId = shiftForm.toId.trim();
        try {
            window.dispatchEvent(new CustomEvent('shift-change', { detail: { fromId, toId } }));
            onToast?.(`Shift change applied: out ${fromId}, in ${toId}`, 'success');
        } catch {
            onToast?.('Could not apply shift change', 'error');
        }
        setShiftForm({ fromId: '', toId: '' });
        setShowShiftModal(false);
    };

    const isCreateDisabled = !newEmployee.id.trim() || !newEmployee.firstName.trim() ||
                            !newEmployee.lastName.trim() || !newEmployee.position.trim() ||
                            !newEmployee.hourlyRate.trim() || isNaN(parseFloat(newEmployee.hourlyRate));

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
                            <div className="d-flex gap-2 mb-3 flex-wrap justify-content-end">
                                <Button
                                    variant="primary"
                                    onClick={() => setShowCreateModal(true)}
                                    className="d-flex align-items-center"
                                    style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}
                                >
                                    <PersonPlus size={18} className="me-2" />Create Employee
                                </Button>
                                <Button
                                    variant="primary"
                                    onClick={() => setShowShiftModal(true)}
                                    className="d-flex align-items-center"
                                    style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}
                                >
                                    Shift Change
                                </Button>
                            </div>
                            {/* Indicadores debajo del botón alineados en fila */}
                            <div className="text-end w-100">
                                <h6 className="mb-2">Status Indicators</h6>
                                <div className="d-flex flex-row flex-wrap justify-content-end align-items-center" style={{ gap: '1.25rem' }}>
                                    <div className="d-flex align-items-center gap-2">
                                        <span style={{ width: 18, height: 18, backgroundColor: '#75c39b', display: 'inline-block', borderRadius: '50%' }} />
                                        <span className="small">On Shift</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        <span style={{ width: 18, height: 18, backgroundColor: '#ffdd63', display: 'inline-block', borderRadius: '50%' }} />
                                        <span className="small">Delayed</span>
                                    </div>
                                    <div className="d-flex align-items-center gap-2">
                                        <span style={{ width: 18, height: 18, backgroundColor: '#f28b9b', display: 'inline-block', borderRadius: '50%' }} />
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
                        <div className="p-3 border rounded-4 shadow h-100">
                            <StaffNotifications />
                        </div>
                    </Col>
                </Row>
            </Container>

            {/* Modal de creación de empleado */}
            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg" centered className="create-employee-modal">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <PersonPlus size={20} className="me-2" />
                        CREATE NEW EMPLOYEE
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-3 pb-4">
                    <Form>
                        <Row className="g-4">
                            <Col md={6}>
                                <Form.Group controlId="employeeId" className="mb-3">
                                    <Form.Label className="fw-semibold small text-uppercase">
                                        <PersonBadge size={14} className="me-1" /> Employee ID *
                                    </Form.Label>
                                    <Form.Control
                                         type="text"
                                         name="id"
                                         value={newEmployee.id}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateNewEmployeeField('id', e.currentTarget.value)}
                                         placeholder="e.g. 1000000012"
                                         required
                                         className="shadow-sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group controlId="position" className="mb-3">
                                    <Form.Label className="fw-semibold small text-uppercase">
                                        <Person size={14} className="me-1" /> Position *
                                    </Form.Label>
                                    <Form.Select
                                         name="position"
                                         value={newEmployee.position}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateNewEmployeeField('position', e.currentTarget.value)}
                                         required
                                         className="shadow-sm"
                                    >
                                        <option value="">Select a position</option>
                                        <option value="Admin">Admin</option>
                                        <option value="Chef">Chef</option>
                                        <option value="Waiter">Waiter</option>
                                    </Form.Select>
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group controlId="firstName" className="mb-3">
                                    <Form.Label className="fw-semibold small text-uppercase">
                                        <Person size={14} className="me-1" /> Name (s) *
                                    </Form.Label>
                                    <Form.Control
                                         type="text"
                                         name="firstName"
                                         value={newEmployee.firstName}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateNewEmployeeField('firstName', e.currentTarget.value)}
                                         placeholder="Enter first name"
                                         required
                                         className="shadow-sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group controlId="lastName" className="mb-3">
                                    <Form.Label className="fw-semibold small text-uppercase">
                                        <Person size={14} className="me-1" /> Last Name (s) *
                                    </Form.Label>
                                    <Form.Control
                                         type="text"
                                         name="lastName"
                                         value={newEmployee.lastName}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateNewEmployeeField('lastName', e.currentTarget.value)}
                                         placeholder="Enter last name"
                                         required
                                         className="shadow-sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group controlId="hourlyRate" className="mb-3">
                                    <Form.Label className="fw-semibold small text-uppercase">
                                        <CashCoin size={14} className="me-1" /> Hourly Rate (USD) *
                                    </Form.Label>
                                    <Form.Control
                                         type="number"
                                         name="hourlyRate"
                                         value={newEmployee.hourlyRate}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateNewEmployeeField('hourlyRate', e.currentTarget.value)}
                                         placeholder="e.g. 15.00"
                                         min="0.01"
                                         step="0.01"
                                         required
                                         className="shadow-sm"
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group controlId="contractDate" className="mb-3">
                                    <Form.Label className="fw-semibold small text-uppercase">
                                        <Calendar size={14} className="me-1" /> Contract Date *
                                    </Form.Label>
                                    <Form.Control
                                         type="date"
                                         name="contractDate"
                                         value={newEmployee.contractDate}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateNewEmployeeField('contractDate', e.currentTarget.value)}
                                         required
                                         className="shadow-sm"
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <div className="border-top pt-4 mt-3">
                            {isCreateDisabled && (
                                <div className="alert alert-warning py-2 small mb-3">
                                    Please fill in all required fields correctly.
                                </div>
                            )}
                            <div className="d-grid gap-2">
                                <Button
                                    variant="primary"
                                    onClick={handleCreateEmployee}
                                    style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}
                                    disabled={isCreateDisabled}
                                >
                                    <CheckCircle size={16} className="me-2" />
                                    Create Employee
                                </Button>
                                <Button
                                    variant="outline-secondary"
                                    onClick={() => setShowCreateModal(false)}
                                >
                                    <XCircle size={16} className="me-2" />
                                    Cancel
                                </Button>
                            </div>
                        </div>
                    </Form>
                </Modal.Body>
            </Modal>

            {/* Shift change modal */}
            <Modal show={showShiftModal} onHide={() => setShowShiftModal(false)} centered size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>Shift Change</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3" controlId="fromId">
                            <Form.Label className="fw-semibold small text-uppercase">Outgoing Employee (ID) *</Form.Label>
                            <Form.Control
                                 type="text"
                                 name="fromId"
                                 value={shiftForm.fromId}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateShiftField('fromId', e.currentTarget.value)}
                                 placeholder="ID of employee ending shift"
                                 className="shadow-sm"
                             />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="toId">
                            <Form.Label className="fw-semibold small text-uppercase">Incoming Employee (ID) *</Form.Label>
                            <Form.Control
                                 type="text"
                                 name="toId"
                                 value={shiftForm.toId}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateShiftField('toId', e.currentTarget.value)}
                                 placeholder="ID of employee starting shift"
                                 className="shadow-sm"
                             />
                        </Form.Group>
                        {isShiftDisabled && (
                            <div className="alert alert-warning py-2 small">IDs are required and must be different.</div>
                        )}
                    </Form>
                </Modal.Body>
                <Modal.Footer className="d-flex flex-column">
                    <div className="w-100 d-grid gap-2">
                        <Button
                            variant="success"
                            onClick={handleShiftChange}
                            disabled={isShiftDisabled}
                            style={{ backgroundColor: '#75c39b', borderColor: '#75c39b', color: '#032f1f' }}
                        >
                            Apply Change
                        </Button>
                        <Button variant="outline-secondary" onClick={() => setShowShiftModal(false)}>
                            <XCircle size={16} className="me-2" />Cancel
                        </Button>
                    </div>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default StaffStatus;
