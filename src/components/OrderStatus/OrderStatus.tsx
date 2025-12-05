import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Modal, Form } from 'react-bootstrap';
import {
    PlusCircle,
    Cart,
    Table as TableIcon,
    CardText,
    CurrencyDollar,
    Trash,
    CheckCircle,
    XCircle,
    Clock,
    BoxSeam
} from 'react-bootstrap-icons';
import OrderTable from './OrderTable';
import OrderSearch from './OrderSearch';
import { createOrder, type OrderData } from '../../service/api';
import OrderNotifications from './OrderNotifications';

interface MenuItem { id: number; name: string; price: number; type: string; }
interface OrderItem { item: MenuItem; quantity: number; }
interface NewOrder { tableNumber: string; selectedItems: OrderItem[]; notes: string; }
interface OrderStatusProps { onToast: (msg: string, type?: string) => void; }

// Menu items (base products + combos)
const menuItems: MenuItem[] = [
    { id: 1, name: 'Hamburger', price: 8.5, type: 'PRODUCT' },
    { id: 2, name: 'French Fries', price: 3.25, type: 'PRODUCT' },
    { id: 3, name: 'Drink', price: 2.0, type: 'PRODUCT' },
    { id: 4, name: 'Hamburger + French Fries', price: 8.5 + 3.25, type: 'COMBO' },
    { id: 5, name: 'Hamburger + Drink', price: 8.5 + 2.0, type: 'COMBO' },
    { id: 6, name: '2 Hamburgers + 2 French Fries + 2 Drinks', price: (2 * 8.5) + (2 * 3.25) + (2 * 2.0), type: 'COMBO' }
];

// Combo breakdown to product components (used to expand combos into individual product quantities)
const comboComponents: Record<number, { productId: number; quantity: number }[]> = {
    4: [ { productId: 1, quantity: 1 }, { productId: 2, quantity: 1 } ],
    5: [ { productId: 1, quantity: 1 }, { productId: 3, quantity: 1 } ],
    6: [ { productId: 1, quantity: 2 }, { productId: 2, quantity: 2 }, { productId: 3, quantity: 2 } ]
};

declare global {
    interface Window {
        updateOrderTable?: (payload: { data: { id: number }, requestTime: string, tableNumber: string }) => void;
    }
}

const OrderStatus: React.FC<OrderStatusProps> = ({ onToast }) => {
    const [searchTerm] = useState('');
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newOrder, setNewOrder] = useState<NewOrder>({ tableNumber: '', selectedItems: [], notes: '' });

    useEffect(() => {
        const intervalId = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(intervalId);
    }, []);

    // Add product (or expand combo) by id
    const addItemById = (id: number) => {
        const selectedItem = menuItems.find(m => m.id === id);
        if (!selectedItem) return;
        if (selectedItem.type === 'COMBO') {
            const parts = comboComponents[selectedItem.id];
            if (parts) {
                setNewOrder(o => {
                    const updated = [...o.selectedItems];
                    parts.forEach(part => {
                        const product = menuItems.find(m => m.id === part.productId && m.type === 'PRODUCT');
                        if (!product) return;
                        const idx = updated.findIndex(u => u.item.id === product.id);
                        if (idx >= 0) updated[idx].quantity += part.quantity; else updated.push({ item: product, quantity: part.quantity });
                    });
                    return { ...o, selectedItems: updated };
                });
                return;
            }
        }
        setNewOrder(o => {
            const idx = o.selectedItems.findIndex(it => it.item.id === id);
            if (idx >= 0) { const upd = [...o.selectedItems]; upd[idx].quantity += 1; return { ...o, selectedItems: upd }; }
            return { ...o, selectedItems: [...o.selectedItems, { item: selectedItem, quantity: 1 }] };
        });
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewOrder(o => ({ ...o, [name]: value }));
    };

    const handleItemSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = parseInt(e.target.value, 10);
        if (!isNaN(val)) addItemById(val);
        e.target.value = '';
    };

    const handleRemoveItem = (index: number) => {
        setNewOrder(o => ({ ...o, selectedItems: o.selectedItems.filter((_, i) => i !== index) }));
    };

    const handleQuantityChange = (index: number, quantity: string) => {
        const q = Math.max(1, parseInt(quantity, 10) || 1);
        setNewOrder(o => ({
            ...o,
            selectedItems: o.selectedItems.map((it, i) => i === index ? { ...it, quantity: q } : it)
        }));
    };

    const incrementItem = (index: number) => setNewOrder(o => ({
        ...o,
        selectedItems: o.selectedItems.map((it, i) => i === index ? { ...it, quantity: it.quantity + 1 } : it)
    }));

    const decrementItem = (index: number) => setNewOrder(o => ({
        ...o,
        selectedItems: o.selectedItems.map((it, i) => i === index ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it)
    }));

    const calculateTotal = () => newOrder.selectedItems.reduce((t, oi) => t + (oi.item.price * oi.quantity), 0);

    const generateOrderDetails = () => {
        let details = `Table ${newOrder.tableNumber}`;
        if (newOrder.notes.trim()) details += `\nNotes: ${newOrder.notes.trim()}`;
        return details;
    };

    const handleCreateOrder = () => {
        if (newOrder.tableNumber.trim() === '') { onToast('Table number is required', 'error'); return; }
        if (newOrder.selectedItems.length === 0) { onToast('Must select at least one product or combo', 'error'); return; }

        const components = newOrder.selectedItems.flatMap(orderItem =>
            Array.from({ length: orderItem.quantity }, () => ({ id: orderItem.item.id, type: orderItem.item.type === 'COMBO' ? 'COMBO' : 'PRODUCT' }))
        );

        const localTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

        const orderData: OrderData = {
            details: generateOrderDetails(),
            components,
            deliveryTime: null,
            requestingClient: '',
            table: newOrder.tableNumber,
            id: null,
            requestTime: null
        } as OrderData;

        createOrder(orderData)
            .then(resp => {
                const data = resp.data || {};
                const orderId = data.id;
                if (orderId != null) {
                    // Persist notes locally so specialized search can display them
                    try {
                        const raw = localStorage.getItem('order_notes');
                        const notesMap = raw ? JSON.parse(raw) as Record<string,string> : {};
                        if (newOrder.notes && newOrder.notes.trim()) {
                            notesMap[String(orderId)] = newOrder.notes.trim();
                            localStorage.setItem('order_notes', JSON.stringify(notesMap));
                        }
                    } catch (err) {
                        // If parsing/storage fails, log to console (non-fatal)
                        console.warn('Could not persist order note locally', err);
                    }
                    window.updateOrderTable?.({ data: { id: orderId }, requestTime: localTime, tableNumber: newOrder.tableNumber });
                    try {
                        window.dispatchEvent(new CustomEvent('order-created', { detail: { id: orderId, code: `ORD-${orderId}`, table: newOrder.tableNumber, timestamp: Date.now() } }));
                    } catch (err) {
                        console.warn('Could not dispatch order-created event', err);
                    }
                }
                onToast(`Order #${data.id} created at ${localTime} for a total of $${data.price}`, 'success');
                setNewOrder({ tableNumber: '', selectedItems: [], notes: '' });
            })
            .catch((err: unknown) => {
                const msg = err instanceof Error ? err.message : 'Could not create order';
                onToast(msg, 'error');
            })
            .finally(() => setShowCreateModal(false));
    };

    const total = calculateTotal();
    const isCreateDisabled = newOrder.tableNumber.trim() === '' || newOrder.selectedItems.length === 0;

    return (
        <div className="d-flex flex-column" style={{ backgroundColor: 'white' }}>
            <Container fluid className="py-4">
                <div className="p-3 border rounded-4 shadow mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 className="mb-1 rounded-heading">ORDER STATUS</h2>
                            <small className="text-muted"><Clock size={14} className="me-1" />{currentTime.toLocaleTimeString()}</small>
                        </div>
                        <Button variant="primary" onClick={() => setShowCreateModal(true)} className="d-flex align-items-center" style={{ backgroundColor: '#86e5ff', borderColor: '#86e5ff', color: '#000' }}>
                            <PlusCircle size={18} className="me-2" />Create Order
                        </Button>
                    </div>
                    <OrderTable searchTerm={searchTerm} onToast={onToast} />
                </div>
                <Row>
                    <Col md={6}><div className="p-3 border rounded-4 shadow h-100" style={{ minHeight: 0 }}><OrderSearch onSearch={() => {}} /></div></Col>
                    <Col md={6}><div className="p-3 border rounded-4 shadow h-100" style={{ minHeight: 0 }}><OrderNotifications /></div></Col>
                </Row>
            </Container>

            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="xl" centered className="create-order-modal">
                <Modal.Header closeButton><Modal.Title><Cart size={20} className="me-2" />CREATE NEW ORDER</Modal.Title></Modal.Header>
                <Modal.Body className="pt-3 pb-4">
                    <Form>
                        <Row className="g-4">
                            <Col lg={7} className="order-form-left">
                                <Row className="mb-3">
                                    <Col md={6}>
                                        <Form.Group controlId="tableNumber" className="mb-3">
                                            <Form.Label className="fw-semibold small text-uppercase"><TableIcon size={14} className="me-1" /> Table Number *</Form.Label>
                                            <Form.Control type="number" name="tableNumber" value={newOrder.tableNumber} onChange={handleInputChange} placeholder="e.g. 12 (0 = Takeout)" min={0} required className="shadow-sm" />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group controlId="quickAdd" className="mb-3">
                                            <Form.Label className="fw-semibold small text-uppercase d-flex align-items-center"><BoxSeam size={14} className="me-1" /> Quick Add</Form.Label>
                                            <div className="d-flex gap-2 flex-wrap">
                                                {menuItems.filter(m => m.type === 'PRODUCT').map(p => (
                                                    <Button key={p.id} variant="outline-primary" size="sm" className="product-chip" style={{ borderColor: '#86e5ff', color: '#001f45' }} onClick={() => addItemById(p.id)}>{p.name} <span className="text-muted">${p.price.toFixed(2)}</span></Button>
                                                ))}
                                            </div>
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Form.Group controlId="selectItem" className="mb-3">
                                    <Form.Label className="fw-semibold small text-uppercase d-flex align-items-center"><BoxSeam size={14} className="me-1" /> Products & Combos *</Form.Label>
                                    <Form.Select onChange={handleItemSelect} defaultValue="" className="shadow-sm">
                                        <option value="">Select product or combo</option>
                                        <optgroup label="Products">
                                            {menuItems.filter(i => i.type === 'PRODUCT').map(i => <option key={i.id} value={i.id}>{i.name} - ${i.price.toFixed(2)}</option>)}
                                        </optgroup>
                                        <optgroup label="Combos">
                                            {menuItems.filter(i => i.type === 'COMBO').map(i => <option key={i.id} value={i.id}>{i.name} - ${i.price.toFixed(2)}</option>)}
                                        </optgroup>
                                    </Form.Select>
                                </Form.Group>
                                <div className="order-items-wrapper border rounded-3 p-3 bg-light-subtle" style={{ minHeight: '210px' }}>
                                    {newOrder.selectedItems.length === 0 && (
                                        <div className="text-center text-muted py-4">
                                            <Cart size={28} className="mb-2 opacity-75" />
                                            <div className="fw-semibold">No products or combos selected</div>
                                            <small>Select or quick-add items to build the order</small>
                                        </div>
                                    )}
                                    {newOrder.selectedItems.length > 0 && (
                                        <div className="order-items-scroll">
                                            {newOrder.selectedItems.map((orderItem, index) => (
                                                <div key={index} className="d-flex align-items-center py-2 order-line-item border-bottom">
                                                    <div className="flex-grow-1">
                                                        <div>
                                                            <div className="d-flex align-items-center fw-semibold">{orderItem.item.name}</div>
                                                            <small className="text-muted">${orderItem.item.price.toFixed(2)} each</small>
                                                        </div>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1 me-3 quantity-box">
                                                        <Button variant="light" size="sm" disabled={orderItem.quantity === 1} onClick={() => decrementItem(index)} className="px-2 border">-</Button>
                                                        <Form.Control value={orderItem.quantity} onChange={e => handleQuantityChange(index, e.target.value)} type="number" min={1} className="text-center px-1" style={{ width: '56px' }} />
                                                        <Button variant="light" size="sm" onClick={() => incrementItem(index)} className="px-2 border">+</Button>
                                                    </div>
                                                    <div className="text-end me-3 fw-semibold small">${(orderItem.item.price * orderItem.quantity).toFixed(2)}</div>
                                                    <Button variant="outline-danger" size="sm" onClick={() => handleRemoveItem(index)}><Trash size={14} /></Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <Form.Group controlId="notes" className="mt-4">
                                    <Form.Label className="fw-semibold small text-uppercase d-flex align-items-center"><CardText size={14} className="me-1" /> Notes</Form.Label>
                                    <Form.Control as="textarea" rows={3} name="notes" value={newOrder.notes} onChange={handleInputChange} placeholder="Special instructions for the order (optional)" className="shadow-sm" />
                                </Form.Group>
                            </Col>
                            <Col lg={5} className="d-flex flex-column">
                                <div className="h-100 d-flex flex-column summary-card border rounded-3 p-3 shadow-sm bg-white position-relative">
                                    <h6 className="fw-bold mb-3 d-flex align-items-center"><CurrencyDollar size={16} className="me-2" /> Order Summary</h6>
                                    <div className="flex-grow-1 mb-3 small">
                                        {newOrder.selectedItems.length === 0 && <div className="text-muted fst-italic">No items yet</div>}
                                        {newOrder.selectedItems.length > 0 && (
                                            <div className="summary-lines">
                                                {newOrder.selectedItems.map((it, i) => (
                                                    <div key={i} className="d-flex justify-content-between border-bottom py-1">
                                                        <span>{it.quantity} x {it.item.name}</span>
                                                        <span>${(it.item.price * it.quantity).toFixed(2)}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="border-top pt-3">
                                        <div className="d-flex justify-content-between align-items-center mb-2"><span className="fw-semibold">Items</span><span>{newOrder.selectedItems.reduce((s, i) => s + i.quantity, 0)}</span></div>
                                        <div className="d-flex justify-content-between align-items-center mb-2"><span className="fw-semibold">Subtotal</span><span>${total.toFixed(2)}</span></div>
                                        <div className="d-flex justify-content-between align-items-center mb-3"><span className="fw-semibold">Total</span><span className="fs-5 text-primary fw-bold">${total.toFixed(2)}</span></div>
                                        {isCreateDisabled && (
                                          <div className="alert alert-warning py-2 small mb-3">
                                            {newOrder.selectedItems.length === 0 ? 'Add at least one product.' : 'Enter a table number (use 0 for Takeout).'}
                                          </div>
                                        )}
                                        <div className="d-grid gap-2">
                                            <Button variant="primary" onClick={handleCreateOrder} style={{ backgroundColor: '#86e5ff', borderColor: '#86e5ff', color: '#000' }} disabled={isCreateDisabled}>
                                                <CheckCircle size={16} className="me-2" />Create Order - ${total.toFixed(2)}
                                            </Button>
                                            <Button variant="outline-secondary" onClick={() => setShowCreateModal(false)}><XCircle size={16} className="me-2" />Cancel</Button>
                                        </div>
                                    </div>
                                </div>
                            </Col>
                        </Row>
                    </Form>
                </Modal.Body>
            </Modal>
        </div>
    );
};

export default OrderStatus;

