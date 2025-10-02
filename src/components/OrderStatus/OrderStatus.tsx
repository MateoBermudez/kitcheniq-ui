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
import {createOrder, type OrderData} from '../../service/api';
import OrderNotifications from "./OrderNotifications.tsx";

interface MenuItem {
    id: number;
    name: string;
    price: number;
    type: string;
}

interface OrderItem {
    item: MenuItem;
    quantity: number;
}

interface NewOrder {
    tableNumber: string;
    selectedItems: OrderItem[];
    notes: string;
}

interface OrderStatusProps {
    onToast: (msg: string, type?: string) => void;
}

// Actualizado con nuevos precios base
// Productos base:
// Hamburger: 8.5, French Fries: 3.25, Drink: 2.0
// Combos se calculan como suma directa (sin descuento de momento)
const menuItems: MenuItem[] = [
    { id: 1, name: "Hamburger", price: 8.5, type: "PRODUCT" },
    { id: 2, name: "French Fries", price: 3.25, type: "PRODUCT" },
    { id: 3, name: "Drink", price: 2.0, type: "PRODUCT" },
    { id: 4, name: "Hamburger + French Fries", price: 8.5 + 3.25, type: "COMBO" },            // 11.75
    { id: 5, name: "Hamburger + Drink", price: 8.5 + 2.0, type: "COMBO" },                    // 10.5
    { id: 6, name: "2 Hamburgers + 2 French Fries + 2 Drinks", price: 2*8.5 + 2*3.25 + 2*2.0, type: "COMBO" } // 27.5
];

const OrderStatus: React.FC<OrderStatusProps> = ({ onToast }) => {
    const [searchTerm] = useState<string>('');
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
    const [newOrder, setNewOrder] = useState<NewOrder>({
        tableNumber: '',
        selectedItems: [],
        notes: ''
    });

    useEffect(() => {
        const intervalId = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);

        return () => clearInterval(intervalId);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewOrder({
            ...newOrder,
            [name]: value
        });
    };

    const handleItemSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedItemId = parseInt(e.target.value);
        if (selectedItemId) {
            const selectedItem = menuItems.find(item => item.id === selectedItemId);
            if (!selectedItem) return;
            const existingItemIndex = newOrder.selectedItems.findIndex(
                orderItem => orderItem.item.id === selectedItemId
            );

            if (existingItemIndex >= 0) {
                const updatedItems = [...newOrder.selectedItems];
                updatedItems[existingItemIndex].quantity += 1;
                setNewOrder({
                    ...newOrder,
                    selectedItems: updatedItems
                });
            } else {
                setNewOrder({
                    ...newOrder,
                    selectedItems: [...newOrder.selectedItems, {
                        item: selectedItem,
                        quantity: 1
                    }]
                });
            }
        }
        e.target.value = "";
    };

    const handleRemoveItem = (index: number) => {
        const updatedItems = [...newOrder.selectedItems];
        updatedItems.splice(index, 1);
        setNewOrder({
            ...newOrder,
            selectedItems: updatedItems
        });
    };

    const handleQuantityChange = (index: number, quantity: string) => {
        const updatedItems = [...newOrder.selectedItems];
        updatedItems[index].quantity = Math.max(1, parseInt(quantity) || 1);
        setNewOrder({
            ...newOrder,
            selectedItems: updatedItems
        });
    };
    const incrementItem = (index: number) => {
        const updated = [...newOrder.selectedItems];
        updated[index].quantity += 1;
        setNewOrder({ ...newOrder, selectedItems: updated });
    };
    const decrementItem = (index: number) => {
        const updated = [...newOrder.selectedItems];
        updated[index].quantity = Math.max(1, updated[index].quantity - 1);
        setNewOrder({ ...newOrder, selectedItems: updated });
    };

    const calculateTotal = () => {
        return newOrder.selectedItems.reduce((total, orderItem) =>
            total + (orderItem.item.price * orderItem.quantity), 0
        );
    };

    const generateOrderDetails = () => {
        let details = `Table ${newOrder.tableNumber}`;
        if (newOrder.notes.trim()) {
            details += `\nNotes: ${newOrder.notes}`;
        }
        return details;
    };

    const handleCreateOrder = () => {
        if (!newOrder.tableNumber) {
            onToast('Table number is required', 'error');
            return;
        }

        if (newOrder.selectedItems.length === 0) {
            onToast('Must select at least one product or combo', 'error');
            return;
        }

        const orderDetails: string = generateOrderDetails();

        const components: {id: number; type: string}[] = newOrder.selectedItems.flatMap(orderItem => {
            const componentsArray = [] as {id: number; type: string}[];
            for (let i = 0; i < orderItem.quantity; i++) {
                componentsArray.push({
                    id: orderItem.item.id,
                    type: orderItem.item.type === "COMBO" ? "COMBO" : "PRODUCT"
                });
            }
            return componentsArray;
        });

        const currentDateTime = new Date();
        const localTime = currentDateTime.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const orderData = {
            details: orderDetails,
            components: components,
            deliveryTime: null,
            requestingClient: '', // Enviamos vacío ya que no se requiere
            table: newOrder.tableNumber,
            id: null,
            requestTime: null,
        } as OrderData;

        console.log('Sending order (no customer name):', orderData);

        createOrder(orderData)
            .then(response => {
                const data = response.data || {};
                const orderId = data.id;
                // Guardar notas localmente para specialized search
                try {
                    const notesRaw = localStorage.getItem('order_notes');
                    const notesMap = notesRaw ? JSON.parse(notesRaw) : {};
                    if (orderId != null && newOrder.notes.trim()) {
                        notesMap[orderId] = newOrder.notes.trim();
                        localStorage.setItem('order_notes', JSON.stringify(notesMap));
                    }
                } catch (e) {
                    console.warn('No se pudieron guardar las notas localmente', e);
                }
                // Llamada en formato esperado por OrderTable
                if (orderId != null) {
                    (window as Window).updateOrderTable?.({
                        data: { id: orderId },
                        requestTime: localTime,
                        tableNumber: newOrder.tableNumber
                    });
                }
                onToast(`Order #${data.id} created at ${localTime} for a total of $${data.price}`,'success');
                setNewOrder({
                    tableNumber: '',
                    selectedItems: [],
                    notes: ''
                });
            })
            .catch(error => {
                console.error('Error creating order:', error);
                const errorMessage = error.response?.data?.message || error.message || 'Could not create order. Please try again.';
                onToast(errorMessage, 'error');
            })
            .finally(() => {
                setShowCreateModal(false);
            });
    };

    return (
        <div className="d-flex flex-column" style={{backgroundColor: 'white'}}>
            <Container fluid className="py-4">
                <div className="p-3 border rounded-4 shadow mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 className="mb-1 rounded-heading">ORDER STATUS</h2>
                            <small className="text-muted">
                                <Clock size={14} className="me-1" />
                                {currentTime.toLocaleTimeString()}
                            </small>
                        </div>
                        <Button
                            variant="primary"
                            onClick={() => setShowCreateModal(true)}
                            className="d-flex align-items-center"
                            style={{ backgroundColor: '#86e5ff', borderColor: '#86e5ff', color: '#000' }}
                        >
                            <PlusCircle size={18} className="me-2" />
                            Create Order
                        </Button>
                    </div>

                    <OrderTable
                        searchTerm={searchTerm}
                        onToast={onToast}
                    />
                </div>

                {/* Bottom section with search and notifications */}
                <Row>
                    <Col md={6}>
                        <div className="p-3 border rounded-4 shadow h-100">
                            <OrderSearch onSearch={() => {}} />
                        </div>
                    </Col>
                    <Col md={6}>
                        <div className="p-3 border rounded-4 shadow h-100">
                            <OrderNotifications />
                        </div>
                    </Col>
                </Row>
            </Container>

            {/* Modal for creating order */}
            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="xl" centered className="create-order-modal">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <Cart size={20} className="me-2" />
                        CREATE NEW ORDER
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-3 pb-4">
                    <Form>
                        <Row className="g-4">
                            <Col lg={7} className="order-form-left">
                                <Row className="mb-3">
                                    <Col md={6}>
                                        <Form.Group controlId="tableNumber" className="mb-3">
                                            <Form.Label className="fw-semibold small text-uppercase">
                                                <TableIcon size={14} className="me-1" /> Table Number *
                                            </Form.Label>
                                            <Form.Control
                                                type="number"
                                                name="tableNumber"
                                                value={newOrder.tableNumber}
                                                onChange={handleInputChange}
                                                placeholder="e.g. 12"
                                                min="1"
                                                required
                                                className="shadow-sm"
                                            />
                                        </Form.Group>
                                    </Col>
                                    <Col md={6}>
                                        <Form.Group controlId="quickAdd" className="mb-3">
                                            <Form.Label className="fw-semibold small text-uppercase d-flex align-items-center">
                                                <BoxSeam size={14} className="me-1" /> Quick Add
                                            </Form.Label>
                                            <div className="d-flex gap-2 flex-wrap">
                                                {menuItems.filter(m => m.type === 'PRODUCT').map(p => (
                                                    <Button key={p.id} variant="outline-primary" size="sm" className="product-chip" style={{borderColor:'#86e5ff', color:'#001f45'}} onClick={() => {
                                                        handleItemSelect({ target: { value: String(p.id) } } as any);
                                                    }}>{p.name} <span className="text-muted">${p.price.toFixed(2)}</span></Button>
                                                ))}
                                            </div>
                                        </Form.Group>
                                    </Col>
                                </Row>
                                <Form.Group controlId="selectItem" className="mb-3">
                                    <Form.Label className="fw-semibold small text-uppercase d-flex align-items-center">
                                        <BoxSeam size={14} className="me-1" /> Products & Combos *
                                    </Form.Label>
                                    <Form.Select onChange={handleItemSelect} defaultValue="" className="shadow-sm">
                                        <option value="">Select product or combo</option>
                                        <optgroup label="Products">
                                            {menuItems.filter(i => i.type === 'PRODUCT').map(i => (
                                                <option key={i.id} value={i.id}>{i.name} - ${i.price.toFixed(2)}</option>
                                            ))}
                                        </optgroup>
                                        <optgroup label="Combos">
                                            {menuItems.filter(i => i.type === 'COMBO').map(i => (
                                                <option key={i.id} value={i.id}>{i.name} - ${i.price.toFixed(2)}</option>
                                            ))}
                                        </optgroup>
                                    </Form.Select>
                                </Form.Group>
                                <div className="order-items-wrapper border rounded-3 p-3 bg-light-subtle" style={{minHeight:'210px'}}>
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
                                                        <div className="d-flex align-items-center fw-semibold">
                                                            {orderItem.item.name}
                                                            {orderItem.item.type === 'COMBO' && <span className="badge bg-success ms-2">Combo</span>}
                                                        </div>
                                                        <small className="text-muted">${orderItem.item.price.toFixed(2)} each</small>
                                                    </div>
                                                    <div className="d-flex align-items-center gap-1 me-3 quantity-box">
                                                        <Button variant="light" size="sm" disabled={orderItem.quantity === 1} onClick={() => decrementItem(index)} className="px-2 border">-</Button>
                                                        <Form.Control value={orderItem.quantity} onChange={(e)=>handleQuantityChange(index,e.target.value)} type="number" min={1} className="text-center px-1" style={{width:'56px'}} />
                                                        <Button variant="light" size="sm" onClick={() => incrementItem(index)} className="px-2 border">+</Button>
                                                    </div>
                                                    <div className="text-end me-3 fw-semibold small">${(orderItem.item.price * orderItem.quantity).toFixed(2)}</div>
                                                    <Button variant="outline-danger" size="sm" onClick={() => handleRemoveItem(index)}>
                                                        <Trash size={14} />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <Form.Group controlId="notes" className="mt-4">
                                    <Form.Label className="fw-semibold small text-uppercase d-flex align-items-center">
                                        <CardText size={14} className="me-1" /> Notes
                                    </Form.Label>
                                    <Form.Control
                                        as="textarea"
                                        rows={3}
                                        name="notes"
                                        value={newOrder.notes}
                                        onChange={handleInputChange}
                                        placeholder="Special instructions for the order (optional)"
                                        className="shadow-sm"
                                    />
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
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <span className="fw-semibold">Items</span>
                                            <span>{newOrder.selectedItems.reduce((s,i)=> s + i.quantity, 0)}</span>
                                        </div>
                                        <div className="d-flex justify-content-between align-items-center mb-2">
                                            <span className="fw-semibold">Subtotal</span>
                                            <span>${calculateTotal().toFixed(2)}</span>
                                        </div>
                                        <div className="d-flex justify-content-between align-items-center mb-3">
                                            <span className="fw-semibold">Total</span>
                                            <span className="fs-5 text-primary fw-bold">${calculateTotal().toFixed(2)}</span>
                                        </div>
                                        <div className="d-grid gap-2">
                                            <Button
                                                variant="primary"
                                                onClick={handleCreateOrder}
                                                style={{ backgroundColor: '#86e5ff', borderColor: '#86e5ff', color: '#000' }}
                                                disabled={!newOrder.tableNumber || newOrder.selectedItems.length === 0}
                                            >
                                                <CheckCircle size={16} className="me-2" />
                                                Create Order - ${calculateTotal().toFixed(2)}
                                            </Button>
                                            <Button variant="outline-secondary" onClick={() => setShowCreateModal(false)}>
                                                <XCircle size={16} className="me-2" /> Cancel
                                            </Button>
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
