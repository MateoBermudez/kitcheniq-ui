import React, { useState, useEffect, useMemo } from 'react';
import { Container, Row, Col, Button, Modal, Form, Table, Spinner } from 'react-bootstrap';
import {
    PlusCircle,
    BoxSeam,
    Clock,
    XCircle,
    CheckCircle,
    Plus,
    Check2Circle,
    Trash
} from 'react-bootstrap-icons';
import InventoryTable from './InventoryTable';
import InventorySearch from './InventorySearch';
import InventoryNotifications from "./InventoryNotifications.tsx";

export interface InventoryItem {
    id: number | null;
    name: string;
    description: string;
    category: string;
    baseQuantity: number;
    stockQuantity: number;
}

interface InventoryStatusProps {
    onToast: (msg: string, type?: string) => void;
}

// Dynamic supplier DTO
interface Supplier {
    id: string;
    name: string;
    contactInfo?: string;
}

interface ProductOption {
    id: number;
    name: string;
    price: number;
    supplier: string;
}
// Tipo flexible para items del supplier que pueden venir con distintos nombres de campos
interface RawSupplierItem {
    id?: unknown;
    itemId?: unknown;
    name?: unknown;
    itemName?: unknown;
    price?: unknown;
    unitPrice?: unknown;
    cost?: unknown;
    supplier?: unknown;
}

interface OrderItemDraft {
    productId: number;
    productName: string;
    quantity: number;
    unitPrice: number; // fetched after confirming item
}

interface PurchaseOrderItemBody {
    orderId: number;
    itemName: string;
    itemId: number;
    quantity: number;
    unitPrice: number; // ahora obligatorio
    subTotal?: number;
}

interface PurchaseOrderItemDTO {
    orderId?: number; // podría venir en cada item si el backend lo incluye
    itemName: string;
    itemId: number;
    quantity: number;
    unitPrice?: number;
    subTotal?: number;
}

interface PurchaseOrderDTO {
    orderId: number;
    supplierId: string;
    status: string;
    totalAmount: number;
    items: PurchaseOrderItemDTO[];
    orderDate?: string;
    updateDate?: string;
}

const AUTH_TOKEN_KEY = 'authToken';
// REMOVED INVENTORY_LIST_ENDPOINT (ya no se usa para el modal de orden de compra)
const ADMIN_BASE = 'https://kitcheniq-api.onrender.com/kitcheniq/api/v1/admin';
const SUPPLIER_LIST_ENDPOINT = `${ADMIN_BASE}/supplier-list`;
const SUPPLIER_ITEMS_ENDPOINT = `${ADMIN_BASE}/supplier-inventory-items`;

// Helper para extraer arreglos de respuestas flexibles (array directo o { data: [...] })
function extractArrayPayload(raw: unknown): unknown[] {
    if (Array.isArray(raw)) return raw;
    if (raw && typeof raw === 'object' && 'data' in raw) {
        const maybe = (raw as { data: unknown }).data;
        if (Array.isArray(maybe)) return maybe;
    }
    return [];
}

const InventoryStatus: React.FC<InventoryStatusProps> = ({ onToast }) => {
    const [searchTerm] = useState<string>('');
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    // Create Supplier Order modal states
    const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
    const [step, setStep] = useState<'supplier' | 'items'>('supplier');

    // Supplier selection
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loadingSuppliers, setLoadingSuppliers] = useState<boolean>(false);

    // Product selection
    const [products, setProducts] = useState<ProductOption[]>([]);
    const [loadingProducts, setLoadingProducts] = useState<boolean>(false);
    const [currentProductId, setCurrentProductId] = useState<number | null>(null);
    const [currentQuantity, setCurrentQuantity] = useState<number>(1);
    const [confirmingItem, setConfirmingItem] = useState<boolean>(false);
    const [orderId, setOrderId] = useState<number | null>(null); // nuevo estado para orderId

    // Items for the order
    const [orderItems, setOrderItems] = useState<OrderItemDraft[]>([]);
    // El total ahora se calcula únicamente con los items locales pendientes
    const orderTotal = useMemo(() => orderItems.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0), [orderItems]);

    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId) || null;

    // Generic helpers
    const buildHeaders = (): HeadersInit => {
        const token = localStorage.getItem(AUTH_TOKEN_KEY);
        const base: Record<string,string> = { 'Content-Type': 'application/json' };
        if (token) base.Authorization = `Bearer ${token}`;
        return base;
    };

    // Fetch suppliers list
    const fetchSuppliers = async (): Promise<Supplier[]> => {
        setLoadingSuppliers(true);
        try {
            const resp = await fetch(SUPPLIER_LIST_ENDPOINT, { headers: buildHeaders() });
            if (!resp.ok) {
                onToast(`Supplier list failed (${resp.status})`, 'error');
                return [];
            }
            const data: unknown = await resp.json().catch(() => ({}));
            const arr = extractArrayPayload(data);
            return arr.map((s, idx): Supplier => {
                const o = (typeof s === 'object' && s !== null) ? s as Record<string, unknown> : {};
                return {
                    id: String(o.id ?? `SUP${idx + 1}`),
                    name: String(o.name ?? `Supplier ${idx + 1}`),
                    contactInfo: o.contactInfo ? String(o.contactInfo) : undefined
                };
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Error obteniendo suppliers';
            onToast(msg, 'error');
            return [];
        } finally {
            setLoadingSuppliers(false);
        }
    };

    // Fetch items for a supplier (InventoryItemDTO)
    const fetchSupplierItems = async (supplierId: string): Promise<ProductOption[]> => {
        setLoadingProducts(true);
        try {
            const url = `${SUPPLIER_ITEMS_ENDPOINT}?supplierId=${encodeURIComponent(supplierId)}`;
            const resp = await fetch(url, { headers: buildHeaders() });
            if (!resp.ok) {
                onToast(`Supplier items failed (${resp.status})`, 'error');
                return [];
            }
            const data: unknown = await resp.json().catch(() => ({}));
            const arr = extractArrayPayload(data);
            return arr.map((p, idx): ProductOption => {
                const o: RawSupplierItem = (typeof p === 'object' && p !== null) ? p as RawSupplierItem : {};
                const idRaw = o.id ?? o.itemId ?? idx + 1;
                const nameRaw = o.name ?? o.itemName ?? `Product ${idx + 1}`;
                const priceRaw = o.price ?? o.unitPrice ?? o.cost ?? 0;
                const supplierRaw = o.supplier ?? supplierId;
                return {
                    id: Number(idRaw),
                    name: String(nameRaw),
                    price: Number(priceRaw),
                    supplier: String(supplierRaw)
                };
            });
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Error obteniendo productos del supplier';
            onToast(msg, 'error');
            return [];
        } finally {
            setLoadingProducts(false);
        }
    };

    // Inicializar orden de compra (purchase order)
    const initializePurchaseOrder = async (supplierId: string): Promise<PurchaseOrderDTO> => {
        const body = { id: supplierId };
        const resp = await fetch(`${ADMIN_BASE}/initialize-purchase-order`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify(body)
        });
        if (!resp.ok) throw new Error(`Initialize failed (${resp.status})`);
        const data = await resp.json().catch(() => ({}));
        return data as PurchaseOrderDTO;
    };

    // Agregar item a la orden
    const addItemToPurchaseOrder = async (params: { orderId: number; itemId: number; itemName: string; quantity: number }): Promise<PurchaseOrderDTO> => {
        const unitPriceRaw = products.find(p => p.id === params.itemId)?.price ?? 0;
        const unitPrice = Number(unitPriceRaw);
        const subTotal = parseFloat((unitPrice * params.quantity).toFixed(2));
        const body: PurchaseOrderItemBody = {
            orderId: params.orderId,
            itemName: params.itemName,
            itemId: params.itemId,
            quantity: params.quantity,
            unitPrice,
            subTotal
        };
        const resp = await fetch(`${ADMIN_BASE}/add-items-to-order`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify(body)
        });
        if (!resp.ok) throw new Error(`Add item failed (${resp.status})`);
        const data = await resp.json().catch(() => ({}));
        return data as PurchaseOrderDTO;
    };

    const eliminateItemFromPurchaseOrder = async (params: { orderId: number; itemId: number; itemName: string; quantity: number; unitPrice: number }): Promise<PurchaseOrderDTO> => {
        const subTotal = parseFloat((params.unitPrice * params.quantity).toFixed(2));
        const body: PurchaseOrderItemDTO = {
            orderId: params.orderId,
            itemName: params.itemName,
            itemId: params.itemId,
            quantity: params.quantity,
            unitPrice: params.unitPrice,
            subTotal
        };
        const resp = await fetch(`${ADMIN_BASE}/eliminate-items-from-order`, {
            method: 'POST',
            headers: buildHeaders(),
            body: JSON.stringify(body)
        });
        if (!resp.ok) throw new Error(`Eliminate item failed (${resp.status})`);
        const data = await resp.json().catch(() => ({}));
        return data as PurchaseOrderDTO;
    };

    // Finalizar orden
    const finalizePurchaseOrder = async (ordId: number): Promise<PurchaseOrderDTO> => {
        const resp = await fetch(`${ADMIN_BASE}/finalize-purchase-order?orderId=${ordId}`, {
            method: 'POST',
            headers: buildHeaders()
        });
        if (!resp.ok) throw new Error(`Finalize failed (${resp.status})`);
        const data = await resp.json().catch(() => ({}));
        return data as PurchaseOrderDTO;
    };

    // Cancelar orden
    const cancelPurchaseOrder = async (ordId: number) => {
        const resp = await fetch(`${ADMIN_BASE}/cancel-purchase-order?orderId=${ordId}&status=CANCEL`, {
            method: 'POST',
            headers: buildHeaders()
        });
        if (!resp.ok && resp.status !== 404) throw new Error(`Cancel failed (${resp.status})`);
        return resp.ok ? resp.json().catch(() => ({})) : null;
    };

    // Clock
    useEffect(() => {
        const intervalId = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(intervalId);
    }, []);

    // Modal open handler
    const openCreateOrderModal = async () => {
        setStep('supplier');
        setSelectedSupplierId(null); // ya no es estático
        setOrderItems([]);
        setCurrentProductId(null);
        setCurrentQuantity(1);
        setOrderId(null);
        setProducts([]);
        setShowCreateModal(true);
        const list = await fetchSuppliers();
        setSuppliers(list);
        if (list.length === 0) onToast('No hay suppliers disponibles', 'warning');
    };

    // Step transitions
    const continueToItems = async () => {
        if (!selectedSupplierId) return;
        try {
            // Inicializar orden primero
            const po = await initializePurchaseOrder(selectedSupplierId);
            setOrderId(po.orderId);
            setOrderItems([]);
            onToast(`Orden inicializada #${po.orderId}`, 'success');
            // Traer productos para ese supplier
            const prods = await fetchSupplierItems(selectedSupplierId);
            setProducts(prods);
            if (prods.length === 0) onToast('El supplier no tiene productos disponibles', 'info');
            setStep('items');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Error inicializando orden';
            onToast(msg, 'error');
        }
    };

    const cancelOrderCreation = async () => {
        if (orderId) {
            try {
                await cancelPurchaseOrder(orderId);
                onToast(`Orden #${orderId} cancelada`, 'info');
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Error cancelando orden';
                onToast(msg, 'error');
            }
        } else {
            onToast('No hay orden para cancelar', 'warning');
        }
        setShowCreateModal(false);
        setStep('supplier');
        setSelectedSupplierId(null);
        setOrderItems([]);
        setCurrentProductId(null);
        setCurrentQuantity(1);
        setOrderId(null);
        setProducts([]);
    };

    // Item confirmation
    const confirmCurrentItem = async () => {
        if (!currentProductId) { onToast('Select a product', 'error'); return; }
        if (currentQuantity <= 0) { onToast('Quantity must be greater than 0', 'error'); return; }
        if (!orderId) { onToast('La orden aún no está inicializada', 'error'); return; }
        try {
            setConfirmingItem(true);
            const productName = products.find(p => p.id === currentProductId)?.name || `Product ${currentProductId}`;
            const updatedPO = await addItemToPurchaseOrder({ orderId, itemId: currentProductId, itemName: productName, quantity: currentQuantity });
            const mapped: OrderItemDraft[] = (updatedPO.items || []).map(it => ({
                productId: it.itemId,
                productName: it.itemName,
                quantity: it.quantity,
                unitPrice: it.unitPrice || 0
            }));
            setOrderItems(mapped);
            setCurrentProductId(null);
            setCurrentQuantity(1);
            onToast(`Agregado ${productName} x${currentQuantity}`, 'success');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Could not confirm item';
            onToast(msg, 'error');
        } finally {
            setConfirmingItem(false);
        }
    };

    const removeItem = async (idx: number) => {
        if (orderId == null) { onToast('La orden no está inicializada', 'error'); return; }
        const target = orderItems[idx];
        if (!target) return;
        try {
            const updatedPO = await eliminateItemFromPurchaseOrder({
                orderId,
                itemId: target.productId,
                itemName: target.productName,
                quantity: target.quantity,
                unitPrice: target.unitPrice
            });
            const mapped: OrderItemDraft[] = (updatedPO.items || []).map(it => ({
                productId: it.itemId,
                productName: it.itemName,
                quantity: it.quantity,
                unitPrice: it.unitPrice || 0
            }));
            setOrderItems(mapped);
            onToast(`Eliminado ${target.productName}`, 'info');
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Error eliminando item';
            onToast(msg, 'error');
        }
    };

    // Final submission
    const finishOrder = async () => {
        if (!selectedSupplierId) { onToast('Supplier is required', 'error'); return; }
        if (!orderId) { onToast('La orden aún no está inicializada', 'error'); return; }
        if (orderItems.length === 0) { onToast('Add at least one item', 'error'); return; }
        try {
            const finalized = await finalizePurchaseOrder(orderId);
            const finalTotal = finalized.totalAmount ?? orderTotal;
            onToast(`Orden #${orderId} finalizada (Total: $${finalTotal.toFixed(2)})`, 'success');
            setShowCreateModal(false);
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Could not finalize order';
            onToast(msg, 'error');
        } finally {
            setStep('supplier');
            setSelectedSupplierId(null);
            setOrderItems([]);
            setCurrentProductId(null);
            setCurrentQuantity(1);
            setOrderId(null);
            setProducts([]);
        }
    };

    return (
        <div className="d-flex flex-column" style={{backgroundColor: 'white'}}>
            <Container fluid className="py-4">
                <div className="p-3 border rounded-4 shadow mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 className="mb-1 rounded-heading">INVENTORY</h2>
                            <small className="text-muted">
                                <Clock size={14} className="me-1" />
                                {currentTime.toLocaleTimeString()}
                            </small>
                        </div>
                        <Button
                            variant="primary"
                            onClick={openCreateOrderModal}
                            className="d-flex align-items-center"
                            style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}
                        >
                            <PlusCircle size={18} className="me-2" />
                            Create Order Supplier
                        </Button>
                    </div>
                    <InventoryTable
                        searchTerm={searchTerm}
                        onToast={onToast}
                    />
                </div>
                <Row>
                    <Col md={6}>
                        <div className="p-3 border rounded-4 shadow h-100">
                            <InventorySearch onSearch={() => {}} />
                        </div>
                    </Col>
                    <Col md={6}>
                        <div className="p-3 border rounded-4 shadow h-100">
                            <InventoryNotifications />
                        </div>
                    </Col>
                </Row>
            </Container>

            {/* Create Supplier Order Modal */}
            <Modal
                show={showCreateModal}
                onHide={step === 'supplier' ? () => setShowCreateModal(false) : undefined}
                size="lg"
                backdrop={step === 'supplier' ? true : 'static'}
                keyboard={step === 'supplier'}
                centered
            >
                <Modal.Header closeButton={step === 'supplier'}>
                    <Modal.Title>
                        <BoxSeam size={20} className="me-2" />
                        CREATE NEW ORDER SUPPLIER
                    </Modal.Title>
                </Modal.Header>

                {/* Step: Supplier selection */}
                {step === 'supplier' && (
                    <>
                        <Modal.Body>
                            <Form>
                                <Form.Group controlId="supplierSelect">
                                    <Form.Label>Supplier *</Form.Label>
                                    <div className="d-flex align-items-center gap-2">
                                        <Form.Select
                                            value={selectedSupplierId ?? ''}
                                            onChange={(e) => setSelectedSupplierId(e.target.value || null)}
                                            disabled={loadingSuppliers}
                                        >
                                            <option value="">Select a supplier</option>
                                            {suppliers.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </Form.Select>
                                        {loadingSuppliers && <Spinner animation="border" size="sm" />}
                                    </div>
                                    <Form.Text className="text-muted">Seleccione un supplier para continuar.</Form.Text>
                                </Form.Group>
                            </Form>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                                <XCircle size={16} className="me-1" />
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={continueToItems}
                                disabled={!selectedSupplierId}
                                style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}
                            >
                                <CheckCircle size={16} className="me-1" />
                                Continue
                            </Button>
                        </Modal.Footer>
                    </>
                )}

                {/* Step: Add items */}
                {step === 'items' && (
                    <>
                        <Modal.Body>
                            <div className="mb-3">
                                <div className="text-muted small mb-2">Supplier: <strong>{selectedSupplier ? selectedSupplier.name : 'N/A'}</strong></div>
                                <Form>
                                    <Row className="g-2 align-items-end">
                                        <Col md={8}>
                                            <Form.Group controlId="productSelect">
                                                <Form.Label>Product *</Form.Label>
                                                <div className="d-flex align-items-center gap-2">
                                                    <Form.Select
                                                        value={currentProductId ?? ''}
                                                        onChange={(e) => setCurrentProductId(e.target.value ? Number(e.target.value) : null)}
                                                        disabled={loadingProducts || confirmingItem}
                                                    >
                                                        <option value="">Select a product</option>
                                                        {products.map(p => (
                                                            <option key={p.id} value={p.id}>{p.name}</option>
                                                        ))}
                                                    </Form.Select>
                                                    {loadingProducts && <Spinner animation="border" size="sm" />}
                                                </div>
                                            </Form.Group>
                                        </Col>
                                        <Col md={4}>
                                            <Form.Group controlId="quantityInput">
                                                <Form.Label>Quantity *</Form.Label>
                                                <Form.Control
                                                    type="number"
                                                    min={1}
                                                    value={currentQuantity}
                                                    onChange={(e) => setCurrentQuantity(Math.max(1, Number(e.target.value || 1)))}
                                                    disabled={confirmingItem}
                                                />
                                            </Form.Group>
                                        </Col>
                                    </Row>
                                    <div className="mt-3 d-flex justify-content-end">
                                        <Button
                                            variant="outline-primary"
                                            onClick={confirmCurrentItem}
                                            disabled={!currentProductId || currentQuantity <= 0 || confirmingItem}
                                        >
                                            <Plus size={16} className="me-1" /> Confirm item
                                        </Button>
                                    </div>
                                </Form>
                            </div>

                            <div className="mt-2">
                                <h6 className="mb-2">Items</h6>
                                <Table size="sm" bordered responsive>
                                    <thead>
                                    <tr>
                                        <th>Product</th>
                                        <th style={{ width: '120px' }}>Quantity</th>
                                        <th style={{ width: '140px' }}>Unit Price</th>
                                        <th style={{ width: '140px' }}>Total</th>
                                        <th style={{ width: '60px' }}></th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {orderItems.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="text-center text-muted">No items added yet.</td>
                                        </tr>
                                    ) : orderItems.map((it, idx) => (
                                        <tr key={`${it.productId}-${idx}`}>
                                            <td>{it.productName}</td>
                                            <td>{it.quantity}</td>
                                            <td>${it.unitPrice.toFixed(2)}</td>
                                            <td>${(it.unitPrice * it.quantity).toFixed(2)}</td>
                                            <td className="text-center">
                                                <Button variant="outline-danger" size="sm" onClick={() => removeItem(idx)}>
                                                    <Trash size={14} />
                                                </Button>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </Table>
                                <div className="d-flex justify-content-end">
                                    <div className="fw-bold">Order total: ${orderTotal.toFixed(2)} {orderId && <span className="ms-3 text-muted">#Orden: {orderId}</span>}</div>
                                </div>
                            </div>
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="secondary" onClick={cancelOrderCreation}>
                                <XCircle size={16} className="me-1" />
                                Cancel
                            </Button>
                            <Button
                                variant="primary"
                                onClick={finishOrder}
                                disabled={!selectedSupplierId || orderItems.length === 0 || !orderId}
                                style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}
                            >
                                <Check2Circle size={16} className="me-1" /> Finish Order
                            </Button>
                        </Modal.Footer>
                    </>
                )}
            </Modal>
        </div>
    );
};

export default InventoryStatus;

