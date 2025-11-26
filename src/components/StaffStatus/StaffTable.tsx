import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Spinner, Alert, Button, Dropdown, Pagination, Form, InputGroup, Modal } from 'react-bootstrap';
import { ThreeDots, PencilSquare, Trash, XCircle } from 'react-bootstrap-icons';

interface StaffTableProps {
    searchTerm: string;
    onToast?: (msg: string, type?: string) => void;
}

export type EmployeeStatus = 'On Shift' | 'Delayed' | 'Shift Ended';

export interface Employee {
    id: string;
    firstName: string;
    lastName: string;
    position: string;
    hourlyRate: number; // USD/hour u otra unidad
    contractDate: string; // ISO string o fecha parseable
    status: EmployeeStatus;
}

interface RawEmployee {
    id?: string | number;
    employeeId?: string | number;
    name?: string; // podría traer nombre completo
    firstName?: string;
    lastName?: string;
    position?: string;
    role?: string; // fallback a position
    hourlyRate?: number;
    rate?: number;
    contractDate?: string;
    hireDate?: string;
    status?: string; // estado textual backend
    shiftStatus?: string; // variación
}

const TOKEN_KEY = 'authToken';
// Asunción de endpoint — si cambia, actualizar aquí
const STAFF_LIST_ENDPOINT = 'http://localhost:5000/kitcheniq/api/v1/admin/staff-list';

const LIGHT_STATUS_COLORS: Record<EmployeeStatus, string> = {
    'On Shift': '#75c39b',      // versión más clara del verde
    'Delayed': '#ffdd63',       // versión más clara del amarillo
    'Shift Ended': '#f28b9b'    // versión más clara del rojo
};

const PAGE_SIZE = 10;
const PAGE_WINDOW = 5; // mostrar solo 5 páginas visibles

const StaffTable: React.FC<StaffTableProps> = ({ searchTerm, onToast }) => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [page, setPage] = useState<number>(1);
    const [goToPage, setGoToPage] = useState<string>('1');

    // Estado para borrar empleado (Danger Zone)
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
    const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
    const [confirmInput, setConfirmInput] = useState<string>('');
    const [deleting, setDeleting] = useState<boolean>(false);

    const authHeaders = (): HeadersInit => {
        const token = localStorage.getItem(TOKEN_KEY);
        const headers: Record<string,string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        return headers;
    };

    const normalizeStatus = (raw?: string): EmployeeStatus => {
        if (!raw) return 'Shift Ended';
        const txt = raw.trim().toLowerCase();
        if (['on', 'onshift', 'on_shift', 'active', 'working'].includes(txt)) return 'On Shift';
        if (['delayed', 'late', 'delay'].includes(txt)) return 'Delayed';
        if (['ended', 'finished', 'off', 'shift_ended', 'offshift'].includes(txt)) return 'Shift Ended';
        return 'Shift Ended';
    };

    const mapRawEmployees = useCallback((arr: RawEmployee[]): Employee[] => {
        return arr.map((raw) => {
            // Intentar separar nombre completo si sólo viene "name"
            let firstName = raw.firstName ?? '';
            let lastName = raw.lastName ?? '';
            if (!firstName && raw.name) {
                const parts = raw.name.split(/\s+/);
                firstName = parts[0] || 'Unknown';
                lastName = parts.slice(1).join(' ') || '';
            }
            const contractDate = raw.contractDate || raw.hireDate || new Date().toISOString();
            const hourlyRate = typeof raw.hourlyRate === 'number' ? raw.hourlyRate : (typeof raw.rate === 'number' ? raw.rate : 0);
            const position = raw.position || raw.role || 'Employee';

            // Forzar ID a string; si no viene, generar una cédula mock de 10 dígitos
            const rawId = (raw as { id?: string | number; employeeId?: string | number }).id ?? (raw as { id?: string | number; employeeId?: string | number }).employeeId;
            const id = rawId != null ? String(rawId) : '';

            return {
                id,
                firstName,
                lastName,
                position,
                hourlyRate,
                contractDate,
                status: normalizeStatus(raw.status || raw.shiftStatus)
            } as Employee;
        });
    }, []);

    const fetchAllEmployees = useCallback(async (): Promise<Employee[]> => {
        const resp = await fetch(STAFF_LIST_ENDPOINT, { headers: authHeaders() });
        if (!resp.ok) {
            throw new Error(resp.status === 401 ? 'Unauthorized' : `Staff request failed (${resp.status})`);
        }
        let data: unknown;
        try { data = await resp.json(); } catch { throw new Error('Invalid staff response'); }
        const extractArray = (src: unknown): RawEmployee[] => {
            if (Array.isArray(src)) return src as RawEmployee[];
            if (typeof src === 'object' && src !== null) {
                const obj = src as Record<string, unknown>;
                for (const k of ['data','employees','staff','staffList']) {
                    const v = obj[k];
                    if (Array.isArray(v)) return v as RawEmployee[];
                }
            }
            return [];
        };
        const rawArr = extractArray(data);
        return mapRawEmployees(rawArr);
    }, [mapRawEmployees]);

    // Carga inicial
    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const list = await fetchAllEmployees();
                if (!mounted) return;
                setEmployees(list);
                try {
                    window.dispatchEvent(new CustomEvent('staff-updated', { detail: { employees: list } }));
                } catch (err) {
                    // ignore dispatch error
                }
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Error loading staff';
                setError(msg);
                onToast?.(msg, 'error');
                const mock: Employee[] = [
                    { id: '1000000001', firstName: 'Ana', lastName: 'García', position: 'Chef', hourlyRate: 15, contractDate: '2025-11-20T09:00:00Z', status: 'On Shift' },
                    { id: '1000000002', firstName: 'Luis', lastName: 'Pérez', position: 'Waiter', hourlyRate: 10, contractDate: '2025-11-22T12:00:00Z', status: 'Delayed' },
                    { id: '1000000003', firstName: 'María', lastName: 'López', position: 'Sous Chef', hourlyRate: 14, contractDate: '2025-11-21T08:30:00Z', status: 'Shift Ended' },
                    { id: '1000000004', firstName: 'Carlos', lastName: 'Santos', position: 'Waiter', hourlyRate: 11, contractDate: '2025-11-19T10:15:00Z', status: 'On Shift' },
                    { id: '1000000005', firstName: 'Lucía', lastName: 'Martínez', position: 'Hostess', hourlyRate: 12, contractDate: '2025-11-23T14:00:00Z', status: 'Delayed' },
                    { id: '1000000006', firstName: 'Jorge', lastName: 'Ruiz', position: 'Chef', hourlyRate: 16, contractDate: '2025-11-20T07:45:00Z', status: 'Shift Ended' },
                    { id: '1000000007', firstName: 'Elena', lastName: 'Hernández', position: 'Waiter', hourlyRate: 10, contractDate: '2025-11-24T13:00:00Z', status: 'On Shift' },
                    { id: '1000000008', firstName: 'Raúl', lastName: 'Castro', position: 'Bartender', hourlyRate: 13, contractDate: '2025-11-21T18:00:00Z', status: 'On Shift' },
                    { id: '1000000009', firstName: 'Sara', lastName: 'Vega', position: 'Dishwasher', hourlyRate: 9, contractDate: '2025-11-22T06:00:00Z', status: 'Delayed' },
                    { id: '1000000010', firstName: 'Pablo', lastName: 'Navarro', position: 'Cook', hourlyRate: 12, contractDate: '2025-11-20T11:20:00Z', status: 'Shift Ended' },
                    { id: '1000000011', firstName: 'Adriana', lastName: 'Morales', position: 'Waiter', hourlyRate: 10, contractDate: '2025-11-19T16:00:00Z', status: 'On Shift' },
                ];
                setEmployees(mock);
                try {
                    window.dispatchEvent(new CustomEvent('staff-updated', { detail: { employees: mock } }));
                } catch (err) {
                    // ignore dispatch error
                }
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [fetchAllEmployees, onToast]);

    // Refresh silencioso cada minuto
    useEffect(() => {
        let mounted = true;
        const intervalId = setInterval(async () => {
            if (!mounted) return;
            try {
                setRefreshing(true);
                const list = await fetchAllEmployees();
                if (!mounted) return;
                setEmployees(list);
            } catch { // eliminado _e para evitar error ESLint
                // Evitar spam de toasts
                if (!error) onToast?.('Error refreshing staff', 'warning');
            } finally {
                if (mounted) setRefreshing(false);
            }
        }, 60000);
        return () => { mounted = false; clearInterval(intervalId); };
    }, [fetchAllEmployees, error, onToast]);

    // Orden + filtrado
    const filteredEmployees = useMemo(() => {
        const sorted = [...employees].sort((a, b) => {
            const da = new Date(a.contractDate).getTime();
            const db = new Date(b.contractDate).getTime();
            return db - da; // más reciente primero
        });
        if (!searchTerm) return sorted;
        const term = searchTerm.toLowerCase();
        return sorted.filter(emp => {
            const idMatch = emp.id.includes(term);
            const nameMatch = `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(term) || emp.firstName.toLowerCase().includes(term) || emp.lastName.toLowerCase().includes(term);
            return idMatch || nameMatch;
        });
    }, [employees, searchTerm]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE)), [filteredEmployees.length]);
    const paginatedEmployees = useMemo(() => {
        const start = (page - 1) * PAGE_SIZE;
        return filteredEmployees.slice(start, start + PAGE_SIZE);
    }, [filteredEmployees, page]);

    // Ajustar página si la búsqueda cambia o se reduce el total
    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [totalPages, page]);

    useEffect(() => {
        // Al cambiar el término de búsqueda, regresar a la página 1
        setPage(1);
    }, [searchTerm]);

    useEffect(() => {
        // sincronizar input con página actual
        setGoToPage(String(page));
    }, [page]);

    const clampPage = (p: number) => Math.min(Math.max(1, p), totalPages);
    const applyGoToPage = () => {
        const num = parseInt(goToPage, 10);
        if (!isNaN(num)) setPage(clampPage(num));
    };

    const pageNumbers = useMemo(() => {
        const currentChunk = Math.floor((page - 1) / PAGE_WINDOW);
        const start = currentChunk * PAGE_WINDOW + 1;
        const end = Math.min(start + PAGE_WINDOW - 1, totalPages);
        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    }, [page, totalPages]);

    const retryLoad = async () => {
        setLoading(true);
        setError(null);
        try {
            const list = await fetchAllEmployees();
            setEmployees(list);
            try {
                window.dispatchEvent(new CustomEvent('staff-updated', { detail: { employees: list } }));
            } catch (err) {
                // ignore dispatch error
            }
            onToast?.('Staff reloaded', 'success');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Error loading staff';
            setError(msg);
            onToast?.(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    const statusDot = (status: EmployeeStatus) => {
        const color = LIGHT_STATUS_COLORS[status];
        return <span style={{ width: 18, height: 18, backgroundColor: color, display: 'inline-block' }} />; // cuadrado sin texto
    };

    const openDeleteModal = (emp: Employee) => {
        setEmployeeToDelete(emp);
        setConfirmInput('');
        setDeleting(false);
        setShowDeleteModal(true);
    };

    const closeDeleteModal = () => {
        if (deleting) return; // evitar cerrar mientras "elimina"
        setShowDeleteModal(false);
        setEmployeeToDelete(null);
        setConfirmInput('');
    };

    const canConfirmDelete = employeeToDelete && confirmInput.trim() === employeeToDelete.id;

    const confirmDelete = async () => {
        if (!employeeToDelete || !canConfirmDelete) return;
        try {
            setDeleting(true);
            // TODO: CALL BACKEND DELETE ENDPOINT HERE
            await fetch(`${STAFF_LIST_ENDPOINT}/delete/${employeeToDelete.id}`, {
                method: 'DELETE',
                headers: authHeaders()
            }).catch(() => {});

            setEmployees(prev => prev.filter(e => e.id !== employeeToDelete.id));
            onToast?.(`Employee ${employeeToDelete.firstName} ${employeeToDelete.lastName} (ID ${employeeToDelete.id}) deleted`, 'success');
            setShowDeleteModal(false);
            setEmployeeToDelete(null);
            setConfirmInput('');
        } catch {
            onToast?.('Could not delete employee', 'error');
        } finally {
            setDeleting(false);
        }
    };

    // Shift change listener (new feature)
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { fromId?: string; toId?: string } | undefined;
            if (!detail) return;
            const { fromId, toId } = detail;
            if (!fromId || !toId || fromId === toId) {
                onToast?.('Invalid shift change', 'warning');
                return;
            }
            setEmployees(prev => {
                let changed = false;
                const updated = prev.map(emp => {
                    if (emp.id === fromId && emp.status !== 'Shift Ended') {
                        changed = true;
                        return { ...emp, status: 'Shift Ended' };
                    }
                    if (emp.id === toId && emp.status !== 'On Shift') {
                        changed = true;
                        return { ...emp, status: 'On Shift' };
                    }
                    return emp;
                });
                if (!changed) onToast?.('No matching employee IDs found for shift change', 'info');
                try {
                    window.dispatchEvent(new CustomEvent('staff-updated', { detail: { employees: updated } }));
                } catch (err) {
                    // ignore dispatch error
                }
                return updated;
            });
        };
        window.addEventListener('shift-change', handler as EventListener);
        return () => window.removeEventListener('shift-change', handler as EventListener);
    }, [onToast]);

    if (loading) {
        return (
            <div className="bg-white rounded shadow-sm">
                <div className="p-5 text-center">
                    <Spinner animation="border" variant="primary" />
                    <div className="mt-2 text-muted">Loading staff...</div>
                </div>
            </div>
        );
    }

    return (
        <div>
            {error && (
                <Alert variant="danger" className="mb-2 d-flex justify-content-between align-items-center">
                    <span>{error}</span>
                    <Button variant="outline-light" size="sm" onClick={retryLoad}>Retry</Button>
                </Alert>
            )}
            {refreshing && (
                <div className="d-flex align-items-center mb-2 small text-muted" style={{gap: '4px'}}>
                    <Spinner animation="border" size="sm" /> <span>Refreshing...</span>
                </div>
            )}
            <Table striped bordered hover responsive className="mt-2">
                <thead>
                <tr>
                    <th style={{width: '90px'}}>ID Number</th>
                    <th>Name(s)</th>
                    <th>Last Name(s)</th>
                    <th>Position</th>
                    <th style={{width: '120px'}}>Hourly Rate</th>
                    <th style={{width: '160px'}}>Contract Date</th>
                    <th style={{width: '140px'}}>Status</th>
                    <th style={{width: '80px'}}>Actions</th>
                </tr>
                </thead>
                <tbody>
                {filteredEmployees.length === 0 ? (
                    <tr>
                        <td colSpan={8} className="text-center text-muted">No employees found.</td>
                    </tr>
                ) : (
                    paginatedEmployees.map(emp => (
                        <tr key={emp.id}>
                            <td>{emp.id}</td>
                            <td>{emp.firstName}</td>
                            <td>{emp.lastName}</td>
                            <td>{emp.position}</td>
                            <td>${emp.hourlyRate.toFixed(2)}</td>
                            <td>{new Date(emp.contractDate).toLocaleDateString()}</td>
                            <td>{statusDot(emp.status)}</td>
                            <td>
                                <Dropdown>
                                    <Dropdown.Toggle variant="outline-secondary" size="sm">
                                        <ThreeDots size={16} />
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu className="dropdown-menu-super" popperConfig={{ strategy: 'fixed' }}>
                                        <Dropdown.Item onClick={() => onToast?.('Edit employee coming soon', 'info')}>
                                            <PencilSquare size={16} className="me-2" /> Edit Employee
                                        </Dropdown.Item>
                                        <Dropdown.Item onClick={() => openDeleteModal(emp)} className="text-danger">
                                            <Trash size={16} className="me-2" /> Delete Employee
                                        </Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                            </td>
                        </tr>
                    ))
                )}
                </tbody>
            </Table>
            {/* Controles de paginación */}
            {filteredEmployees.length > 0 && (
                <div className="d-flex justify-content-between align-items-center mt-2 flex-wrap gap-2">
                    <div className="d-flex align-items-center gap-2">
                        <Form onSubmit={(e) => { e.preventDefault(); applyGoToPage(); }}>
                            <InputGroup size="sm">
                                <InputGroup.Text>Ir a página</InputGroup.Text>
                                <Form.Control
                                    type="number"
                                    min={1}
                                    max={totalPages}
                                    value={goToPage}
                                    onChange={(e) => setGoToPage(e.target.value)}
                                    style={{ maxWidth: 100 }}
                                />
                                <Button variant="outline-secondary" onClick={applyGoToPage}>Ir</Button>
                            </InputGroup>
                        </Form>
                    </div>
                    <Pagination className="mb-0">
                        <Pagination.First disabled={page === 1} onClick={() => setPage(1)} />
                        <Pagination.Prev disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} />
                        {pageNumbers.map(pn => (
                            <Pagination.Item key={pn} active={pn === page} onClick={() => setPage(pn)}>{pn}</Pagination.Item>
                        ))}
                        <Pagination.Next disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} />
                        <Pagination.Last disabled={page === totalPages} onClick={() => setPage(totalPages)} />
                    </Pagination>
                </div>
            )}

            {/* Modal: Delete Employee (Danger Zone) */}
            <Modal show={showDeleteModal} onHide={closeDeleteModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <Trash size={18} className="me-2" /> Delete Employee
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {employeeToDelete ? (
                        <div>
                            <p className="mb-2">You are about to delete the employee:</p>
                            <ul>
                                <li><strong>ID (Cédula):</strong> {employeeToDelete.id}</li>
                                <li><strong>Name:</strong> {employeeToDelete.firstName} {employeeToDelete.lastName}</li>
                                <li><strong>Position:</strong> {employeeToDelete.position}</li>
                            </ul>
                            <Alert variant="warning">
                                This is a permanent action. To confirm, type the employee ID exactly as shown above.
                            </Alert>
                            <Form.Group controlId="confirmDeleteEmp">
                                <Form.Label>Type the ID to confirm</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder={employeeToDelete.id}
                                    value={confirmInput}
                                    onChange={(e) => setConfirmInput(e.target.value)}
                                    autoFocus
                                    disabled={deleting}
                                />
                            </Form.Group>
                            {confirmInput !== '' && !canConfirmDelete && (
                                <div className="text-danger small mt-1">The entered value doesn't match the employee ID.</div>
                            )}
                        </div>
                    ) : (
                        <div className="text-muted">No employee selected.</div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={closeDeleteModal} disabled={deleting}>
                        <XCircle size={16} className="me-1" /> Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmDelete} disabled={!canConfirmDelete || deleting}>
                        <Trash size={16} className="me-1" /> {deleting ? 'Deleting...' : 'Delete'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default StaffTable;
