import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Spinner, Alert, Button, Dropdown, Pagination, Form, InputGroup, Modal } from 'react-bootstrap';
import { ThreeDots, PencilSquare, Trash, XCircle, CheckCircle } from 'react-bootstrap-icons';
import { editEmployee, type EmployeeEditRequest, type EmployeeTypeCode } from '../../service/api';

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
    employeeType?: string; // soporte para EmployeeDTO
}

const TOKEN_KEY = 'authToken';
// Asunción de endpoint — si cambia, actualizar aquí
const STAFF_LIST_ENDPOINT = 'https://kitcheniq-api.onrender.com/kitcheniq/api/v1/admin/employees-list';

const LIGHT_STATUS_COLORS: Record<EmployeeStatus, string> = {
    'On Shift': '#75c39b',      // versión más clara del verde
    'Delayed': '#ffdd63',       // versión más clara del amarillo
    'Shift Ended': '#f28b9b'    // versión más clara del rojo
};

const PAGE_SIZE = 10;
const PAGE_WINDOW = 5; // mostrar solo 5 páginas visibles

const EMPLOYEE_TYPE_TO_POSITION: Record<string,string> = {
    'ADMIN': 'Admin',
    'CHEF': 'Chef',
    'WAITER': 'Waiter'
};

const LS_STAFF_STATUS_KEY = 'staffStatusMap';
const LS_CONTRACT_KEY = 'staffContractMap';

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

    // Edit mode state
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ name: string; lastName: string; position: string; hourlyRate: string }>({ name: '', lastName: '', position: '', hourlyRate: '' });
    const [showEditModal, setShowEditModal] = useState<boolean>(false);
    const [savingEdit, setSavingEdit] = useState<boolean>(false);

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
        return arr.map((raw, idx) => {
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

            // Forzar ID a string; si no viene, generar una cédula fallback estable usando timestamp+index
            const rawId = (raw as { id?: string | number; employeeId?: string | number }).id ?? (raw as { id?: string | number; employeeId?: string | number }).employeeId;
            const id = rawId != null ? String(rawId) : `local-${Date.now()}-${idx}`;

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
        const controller = new AbortController();
        const TIMEOUT_MS = 10000; // 10s timeout
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const resp = await fetch(STAFF_LIST_ENDPOINT, { headers: authHeaders(), signal: controller.signal });
            clearTimeout(timeoutId);

            if (!resp.ok) {
                // intentar leer body para diagnóstico
                let bodyText = '';
                try { bodyText = await resp.text(); } catch (e) { bodyText = `<unreadable body: ${String(e)}>`; }
                const errMsg = resp.status === 401 ? 'Unauthorized' : `Staff request failed (${resp.status})${bodyText ? ': ' + bodyText : ''}`;
                throw new Error(errMsg);
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

            // Detectar si todos los elementos parecen EmployeeDTO (id, name, employeeType)
            const looksLikeEmployeeDTO = (o: RawEmployee): boolean => {
                return !!o && typeof o === 'object' && 'id' in o && 'name' in o && 'employeeType' in o;
            };

            if (rawArr.length > 0 && rawArr.every(looksLikeEmployeeDTO)) {
                return rawArr.map((dto, idx) => {
                    const id = dto.id != null ? String(dto.id) : `local-${Date.now()}-${idx}`;
                    const fullName = (dto.name || '').trim();
                    const [firstNameRaw, ...rest] = fullName.split(/\s+/);
                    const firstName = firstNameRaw || 'Unknown';
                    // Prefer backend lastName field; fallback to derived remainder
                    const lastName = (dto.lastName ?? '').trim() || rest.join(' ');
                    const employeeTypeRaw = (dto.employeeType || '').toUpperCase();
                    const position = EMPLOYEE_TYPE_TO_POSITION[employeeTypeRaw] || (employeeTypeRaw ? employeeTypeRaw.charAt(0) + employeeTypeRaw.slice(1).toLowerCase() : 'Employee');
                    const hourlyRate = typeof dto.hourlyRate === 'number' ? dto.hourlyRate : 0;
                    return {
                        id,
                        firstName,
                        lastName,
                        position,
                        hourlyRate,
                        contractDate: new Date().toISOString(),
                        status: 'Shift Ended' as EmployeeStatus
                    } as Employee;
                });
            }

            return mapRawEmployees(rawArr);
        } catch (err) {
            if (err && (err as Error).name === 'AbortError') {
                throw new Error('Request timed out while fetching staff');
            }
            throw err;
        } finally {
            clearTimeout(timeoutId);
        }
    }, [mapRawEmployees]);

    // LocalStorage helpers for status persistence
    const loadStatusMap = useCallback((): Record<string, EmployeeStatus> => {
        try {
            const raw = localStorage.getItem(LS_STAFF_STATUS_KEY);
            if (!raw) return {};
            const obj = JSON.parse(raw) as Record<string, string>;
            const map: Record<string, EmployeeStatus> = {};
            Object.entries(obj).forEach(([id, st]) => {
                const s = (st || '').toLowerCase();
                if (s === 'on shift') map[id] = 'On Shift';
                else if (s === 'delayed') map[id] = 'Delayed';
                else if (s === 'shift ended') map[id] = 'Shift Ended';
            });
            return map;
        } catch {
            return {};
        }
    }, []);

    const saveStatusMap = useCallback((map: Record<string, EmployeeStatus>) => {
        try { localStorage.setItem(LS_STAFF_STATUS_KEY, JSON.stringify(map)); } catch { /* ignore */ }
    }, []);

    const applyStoredStatuses = useCallback((list: Employee[]): Employee[] => {
        const map = loadStatusMap();
        if (!map || Object.keys(map).length === 0) return list;
        return list.map(emp => (map[emp.id] ? { ...emp, status: map[emp.id] } : emp));
    }, [loadStatusMap]);

    const applyStoredContracts = useCallback((list: Employee[]): Employee[] => {
        try {
            const raw = localStorage.getItem(LS_CONTRACT_KEY);
            if (!raw) return list;
            const map = JSON.parse(raw) as Record<string,string>;
            // Keep plain 'YYYY-MM-DD' string to avoid timezone shifts
            return list.map(emp => (map[emp.id] ? { ...emp, contractDate: map[emp.id] } : emp));
        } catch {
            return list;
        }
    }, []);

    // Helper: set list and broadcast 'staff-updated' (apply LS overrides)
    const setListAndBroadcast = useCallback((list: Employee[]) => {
        const withStatus = applyStoredStatuses(list);
        const applied = applyStoredContracts(withStatus);
        setEmployees(applied);
        try {
            window.dispatchEvent(new CustomEvent('staff-updated', { detail: { employees: applied } }));
        } catch {
            // ignore
        }
    }, [applyStoredStatuses, applyStoredContracts]);

    // Carga inicial
    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const list = await fetchAllEmployees();
                if (!mounted) return;
                setListAndBroadcast(list);
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Error loading staff';
                setError(msg);
                onToast?.(msg, 'error');
                // No mock fallback: keep list empty until backend works
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [fetchAllEmployees, onToast, setListAndBroadcast]);

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
        const term = searchTerm.trim().toLowerCase(); // normalizar término
        return sorted.filter(emp => {
            // Hacer búsqueda de ID case-insensitive
            const idMatch = emp.id.toLowerCase().includes(term);
            // Normalizar nombres para búsqueda (case-insensitive)
            const fullNameLower = `${emp.firstName} ${emp.lastName}`.toLowerCase();
            const nameMatch = fullNameLower.includes(term) || emp.firstName.toLowerCase().includes(term) || emp.lastName.toLowerCase().includes(term);
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
        let mounted = true;
        // Sincronizar con cambios externos en el listado de empleados
        const staffUpdatedHandler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { employees?: Employee[] } | undefined;
            if (!detail || !detail.employees) return;
            mounted && setEmployees(detail.employees);
        };
        window.addEventListener('staff-updated', staffUpdatedHandler as EventListener);
        return () => { mounted = false; window.removeEventListener('staff-updated', staffUpdatedHandler as EventListener); };
    }, []);

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

    const retryLoad = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const list = await fetchAllEmployees();
            setListAndBroadcast(list);
            onToast?.('Staff reloaded', 'success');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Error loading staff';
            setError(msg);
            onToast?.(msg, 'error');
        } finally {
            setLoading(false);
        }
    }, [fetchAllEmployees, setListAndBroadcast, onToast]);

    const formatContractDate = (value: string): string => {
        if (!value) return 'N/A';
        const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(value);
        if (m) {
            const y = parseInt(m[1], 10);
            const mo = parseInt(m[2], 10) - 1; // zero-based
            const d = parseInt(m[3], 10);
            const dt = new Date(y, mo, d); // local time
            return dt.toLocaleDateString();
        }
        try {
            const dt = new Date(value);
            return isNaN(dt.getTime()) ? 'N/A' : dt.toLocaleDateString();
        } catch {
            return 'N/A';
        }
    };

    // Circular, clickable status indicator used in table rows
    const nextStatus = (s: EmployeeStatus): EmployeeStatus => {
        if (s === 'On Shift') return 'Shift Ended';
        if (s === 'Shift Ended') return 'Delayed';
        return 'On Shift';
    };

    const toggleStatus = (empId: string) => {
        setEmployees((prev: Employee[]): Employee[] => {
             const updated: Employee[] = prev.map(emp => {
                 if (emp.id !== empId) return emp;
                 const ns: EmployeeStatus = nextStatus(emp.status);
                 return { ...emp, status: ns };
             });
             try {
                 const map = loadStatusMap();
                 const changed = updated.find(e => e.id === empId);
                 if (changed) {
                    map[empId] = changed.status as EmployeeStatus;
                     saveStatusMap(map);
                 }
             } catch { /* ignore */ }
             try { window.dispatchEvent(new CustomEvent('staff-updated', { detail: { employees: updated } })); } catch { /* noop */ }
             return updated;
         });
    };

    const statusButton = (emp: Employee) => {
        const color = LIGHT_STATUS_COLORS[emp.status];
        return (
            <button
                type="button"
                onClick={() => toggleStatus(emp.id)}
                title={`Status: ${emp.status} — click to change`}
                aria-label={`Change status for ${emp.firstName} ${emp.lastName}`}
                style={{
                    width: 20,
                    height: 20,
                    backgroundColor: color,
                    display: 'inline-block',
                    borderRadius: '50%',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.08)'
                }}
            />
        );
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
            const response = await fetch(`https://kitcheniq-api.onrender.com/kitcheniq/api/v1/admin/delete-employee?employeeId=${employeeToDelete.id}`, {
                method: 'POST',
                headers: authHeaders()
            });
            if (!response.ok) {
                onToast?.(`Delete failed (${response.status})`, 'error');
                return;
            }

            setEmployees(prev => prev.filter(e => e.id !== employeeToDelete.id));
            // clean status in LS
            const map = loadStatusMap();
            if (map[employeeToDelete.id]) {
                delete map[employeeToDelete.id];
                saveStatusMap(map);
            }
            // clean contract in LS
            try {
                const raw = localStorage.getItem(LS_CONTRACT_KEY);
                if (raw) {
                    const cMap = JSON.parse(raw) as Record<string,string>;
                    if (cMap[employeeToDelete.id]) {
                        delete cMap[employeeToDelete.id];
                        localStorage.setItem(LS_CONTRACT_KEY, JSON.stringify(cMap));
                    }
                }
            } catch { /* ignore */ }

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

    // Status change listener (new feature)
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail as { fromId?: string; toId?: string } | undefined;
            if (!detail) return;
            const { fromId, toId } = detail;
            if (!fromId || !toId || fromId === toId) {
                onToast?.('Invalid shift change', 'warning');
                return;
            }
            setEmployees((prev: Employee[]): Employee[] => {
                let changed = false;
                const updated: Employee[] = prev.map(emp => {
                    if (emp.id === fromId && emp.status !== 'Shift Ended') {
                        changed = true;
                        return { ...emp, status: 'Shift Ended' as EmployeeStatus };
                    }
                    if (emp.id === toId && emp.status !== 'On Shift') {
                        changed = true;
                        return { ...emp, status: 'On Shift' as EmployeeStatus };
                    }
                    return emp;
                });
                // persist to LS
                const map = loadStatusMap();
                map[fromId] = 'Shift Ended';
                map[toId] = 'On Shift';
                saveStatusMap(map);
                if (!changed) onToast?.('No matching employee IDs found for shift change', 'info');
                try { window.dispatchEvent(new CustomEvent('staff-updated', { detail: { employees: updated } })); } catch { /* noop */ }
                return updated;
            });
        };
        window.addEventListener('shift-change', handler as EventListener);
        return () => window.removeEventListener('shift-change', handler as EventListener);
    }, [onToast, loadStatusMap, saveStatusMap]);

    useEffect(() => {
        const reloadHandler = () => { retryLoad(); };
        window.addEventListener('staff-reload', reloadHandler as EventListener);
        return () => window.removeEventListener('staff-reload', reloadHandler as EventListener);
    }, [retryLoad]);

    // Edit employee feature
    const POSITIONS: Array<'Admin'|'Chef'|'Waiter'> = ['Admin','Chef','Waiter'];
    const isAllowedPosition = (position: string): boolean => {
        const p = position.trim();
        return POSITIONS.includes(p as 'Admin'|'Chef'|'Waiter');
    };
    const toEmployeeType = (position: string): EmployeeTypeCode => {
        const p = position.trim().toUpperCase();
        if (p === 'ADMIN' || p === 'CHEF' || p === 'WAITER') return p as EmployeeTypeCode;
        return 'ADMIN';
    };

    const openEditModal = (emp: Employee) => {
        if (editingId && editingId !== emp.id) {
            onToast?.('You can only edit one employee at a time', 'warning');
            return;
        }
        setEditingId(emp.id);
        setEditForm({ name: emp.firstName, lastName: emp.lastName, position: emp.position, hourlyRate: String(emp.hourlyRate || '') });
        setShowEditModal(true);
    };

    const closeEditModal = () => {
        if (savingEdit) return;
        setShowEditModal(false);
        setEditingId(null);
        setEditForm({ name: '', lastName: '', position: '', hourlyRate: '' });
    };

    const onEditInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target as HTMLInputElement | HTMLSelectElement;
        const name = target.name as 'name' | 'lastName' | 'position' | 'hourlyRate';
        const value = target.value;
        setEditForm(prev => ({ ...prev, [name]: value }));
    };

    const canSave = useMemo(() => {
         if (!editingId) return false;
         if (!editForm.name.trim()) return false;
         if (!editForm.lastName.trim()) return false;
         if (!editForm.position.trim() || !isAllowedPosition(editForm.position)) return false;
         const rate = parseFloat(editForm.hourlyRate);
         if (isNaN(rate) || rate <= 0) return false;
         return true;
    }, [editingId, editForm, isAllowedPosition]);

    const saveEdit = async () => {
        if (!editingId || !canSave) return;
        try {
            setSavingEdit(true);
            const payload: EmployeeEditRequest = {
                name: editForm.name.trim(),
                lastName: editForm.lastName.trim(),
                employeeType: toEmployeeType(editForm.position),
                hourlyRate: parseFloat(editForm.hourlyRate)
            };
            await editEmployee(editingId, payload);
            // Update local table
            setEmployees(prev => prev.map(e => (
                e.id === editingId
                    ? { ...e, firstName: payload.name, lastName: payload.lastName, position: editForm.position, hourlyRate: payload.hourlyRate }
                    : e
            )));
            onToast?.('Employee updated successfully', 'success');
            // Emit role update if current user edited themselves
            try {
                const storedUser = localStorage.getItem('userData');
                if (storedUser) {
                    const u = JSON.parse(storedUser) as { id?: string; userId?: string };
                    const currentId = u.id || u.userId;
                    if (currentId && currentId === editingId) {
                        window.dispatchEvent(new CustomEvent('user-role-updated', { detail: { id: currentId, newType: payload.employeeType } }));
                        // also update localStorage type uppercase
                        localStorage.setItem('userData', JSON.stringify({ ...u, type: payload.employeeType }));
                    }
                }
            } catch { /* ignore */ }
            setShowEditModal(false);
            setEditingId(null);
            setEditForm({ name: '', lastName: '', position: '', hourlyRate: '' });
            // Optionally broadcast
            try { window.dispatchEvent(new CustomEvent('staff-updated', { detail: { employees } })); } catch { /* ignore */ }
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Could not update employee';
            onToast?.(msg, 'error');
        } finally {
            setSavingEdit(false);
        }
    };

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
                    <div style={{display: 'flex', gap: 8, alignItems: 'center'}}>
                        <span>{error}</span>
                    </div>
                    <div style={{display: 'flex', gap: 8}}>
                        <Button variant="outline-light" size="sm" onClick={retryLoad}>Retry</Button>
                    </div>
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
                            <td>{formatContractDate(emp.contractDate)}</td>
                            <td>{statusButton(emp)}</td>
                            <td>
                                <Dropdown>
                                    <Dropdown.Toggle variant="outline-secondary" size="sm">
                                        <ThreeDots size={16} />
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu className="dropdown-menu-super" popperConfig={{ strategy: 'fixed' }}>
                                        <Dropdown.Item onClick={() => openEditModal(emp)}>
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

            {/* Modal: Edit Employee */}
            <Modal show={showEditModal} onHide={closeEditModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <PencilSquare size={18} className="me-2" /> Edit Employee
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {editingId ? (
                        <div>
                            {/* Read-only context fields */}
                            <div className="d-flex flex-column gap-2 mb-3">
                                <div className="d-flex justify-content-between">
                                    <div className="text-muted">ID Number</div>
                                    <div className="fw-semibold">{editingId}</div>
                                </div>
                                <div className="d-flex justify-content-between">
                                    <div className="text-muted">Contract Date</div>
                                    <div className="fw-semibold">{formatContractDate((employees.find(e => e.id === editingId)?.contractDate) || '')}</div>
                                </div>
                            </div>
                            <Form>
                                <Form.Group className="mb-3" controlId="editName">
                                    <Form.Label>Name(s)</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="name"
                                        value={editForm.name}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEditInputChange(e)}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3" controlId="editLastName">
                                    <Form.Label>Last Name(s)</Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="lastName"
                                        value={editForm.lastName}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEditInputChange(e)}
                                    />
                                </Form.Group>
                                <Form.Group className="mb-3" controlId="editPosition">
                                    <Form.Label>Position</Form.Label>
                                    <Form.Select
                                        name="position"
                                        value={editForm.position}
                                        onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onEditInputChange(e)}
                                    >
                                         <option value="Admin">Admin</option>
                                         <option value="Chef">Chef</option>
                                         <option value="Waiter">Waiter</option>
                                     </Form.Select>
                                 </Form.Group>
                                <Form.Group className="mb-3" controlId="editHourlyRate">
                                    <Form.Label>Hourly Rate</Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="hourlyRate"
                                        value={editForm.hourlyRate}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => onEditInputChange(e)}
                                        min={0.01}
                                        step={0.01}
                                    />
                                </Form.Group>
                                <div className="small text-muted">ID Number and Contract Date cannot be edited.</div>
                            </Form>
                        </div>
                    ) : (
                        <div className="text-muted">No employee selected.</div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={closeEditModal} disabled={savingEdit}>
                        <XCircle size={16} className="me-1" /> Cancel
                    </Button>
                    <Button variant="primary" onClick={saveEdit} disabled={!canSave || savingEdit} style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}>
                        <CheckCircle size={16} className="me-1" /> {savingEdit ? 'Saving...' : 'Save'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default StaffTable;
