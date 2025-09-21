import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Modal, Form } from 'react-bootstrap';
import {
    PlusCircle,
    Cart,
    PersonFill,
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

interface Order {
    data: OrderData;
    requestTime: string;
    requestingClient: string;
    table: string;
}

declare global {
    interface Window {
        updateOrderTable?: (order: Order) => void;
    }
}

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
    customerName: string;
    tableNumber: string;
    selectedItems: OrderItem[];
    notes: string;
}

interface OrderStatusProps {
    onToast: (msg: string, type?: string) => void;
}

const menuItems: MenuItem[] = [
    { id: 1, name: "Hamburger", price: 10.0, type: "PRODUCT" },
    { id: 2, name: "French Fries", price: 5.0, type: "PRODUCT" },
    { id: 3, name: "Drink", price: 2.0, type: "PRODUCT" },
    { id: 4, name: "Hamburger + French Fries", price: 15.0, type: "COMBO" },
    { id: 5, name: "Hamburger + Drink", price: 12.0, type: "COMBO" },
    { id: 6, name: "2 Hamburgers + 2 French Fries + 2 Drinks", price: 34.0, type: "COMBO" }
];

const OrderStatus: React.FC<OrderStatusProps> = ({ onToast }) => {
    const [searchTerm] = useState<string>('');
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
    const [newOrder, setNewOrder] = useState<NewOrder>({
        customerName: '',
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

    const calculateTotal = () => {
        return newOrder.selectedItems.reduce((total, orderItem) =>
            total + (orderItem.item.price * orderItem.quantity), 0
        );
    };

    const generateOrderDetails = () => {
        let details = `Table ${newOrder.tableNumber}\nCustomer Name: ${newOrder.customerName}`;
        if (newOrder.notes.trim()) {
            details += `\nNotes: ${newOrder.notes}`;
        }
        return details;
    };

    const handleCreateOrder = () => {
        if (!newOrder.customerName.trim()) {
            onToast('Customer name is required', 'error');
            return;
        }

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
            const componentsArray = [];
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
            requestingClient: newOrder.customerName,
            table: newOrder.tableNumber,
            id: null,
            requestTime: null,
        };

        console.log('Sending order:', orderData);

        createOrder(orderData)
            .then(response => {
                const data = response.data || {};
                const orderWithLocalTime = {
                    ...data,
                    requestTime: localTime,
                    requestingClient: newOrder.customerName,
                    table: newOrder.tableNumber
                };

                (window as Window).updateOrderTable?.(orderWithLocalTime);

                onToast(`Order #${data.id} created at ${localTime} for a total of $${data.price}`, 'success');

                setNewOrder({
                    customerName: '',
                    tableNumber: '',
                    selectedItems: [],
                    notes: ''
                });
            })
            .catch(error => {
                console.error('Error creating order:', error);
                const errorMessage = error.response?.data?.message ||
                    error.message ||
                    'Could not create order. Please try again.';
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
                            style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}
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
                            {/* <OrderNotifications onToast={onToast} /> */}
                        </div>
                    </Col>
                </Row>
            </Container>

            {/* Modal for creating order */}
            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <Cart size={20} className="me-2" />
                        CREATE NEW ORDER
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group controlId="customerName">
                                    <Form.Label>
                                        <PersonFill size={16} className="me-1" />
                                        Requesting Customer *
                                    </Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="customerName"
                                        value={newOrder.customerName}
                                        onChange={handleInputChange}
                                        placeholder="Customer name"
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group controlId="tableNumber">
                                    <Form.Label>
                                        <TableIcon size={16} className="me-1" />
                                        Table Number *
                                    </Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="tableNumber"
                                        value={newOrder.tableNumber}
                                        onChange={handleInputChange}
                                        placeholder="# Table"
                                        min="1"
                                        required
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Form.Group className="mb-3" controlId="orderItems">
                            <Form.Label>
                                <BoxSeam size={16} className="me-1" />
                                Products and Combos *
                            </Form.Label>
                            <div className="d-flex mb-2">
                                <Form.Select
                                    onChange={handleItemSelect}
                                    className="me-2"
                                    defaultValue=""
                                >
                                    <option value="">Select product or combo</option>
                                    <optgroup label="PRODUCTS">
                                        {menuItems.filter(item => item.type === "PRODUCT").map(item => (
                                            <option key={item.id} value={item.id}>
                                                {item.name} - ${item.price.toFixed(1)}
                                            </option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="COMBOS">
                                        {menuItems.filter(item => item.type === "COMBO").map(item => (
                                            <option key={item.id} value={item.id}>
                                                {item.name} - ${item.price.toFixed(1)}
                                            </option>
                                        ))}
                                    </optgroup>
                                </Form.Select>
                            </div>

                            <div className="border rounded p-2" style={{minHeight: '150px'}}>
                                {newOrder.selectedItems.length > 0 ? (
                                    <>
                                        <div className="mb-2">
                                            {newOrder.selectedItems.map((orderItem, index) => (
                                                <div key={index} className="d-flex justify-content-between align-items-center border-bottom py-2">
                                                    <div className="flex-grow-1">
                                                        <div className="d-flex align-items-center">
                                                            <strong>{orderItem.item.name}</strong>
                                                            {orderItem.item.type === "COMBO" && (
                                                                <span className="badge bg-success ms-2">Combo</span>
                                                            )}
                                                        </div>
                                                        <small className="text-muted">
                                                            <CurrencyDollar size={12} />
                                                            {orderItem.item.price.toFixed(1)} each
                                                        </small>
                                                    </div>
                                                    <div className="d-flex align-items-center">
                                                        <Form.Control
                                                            type="number"
                                                            value={orderItem.quantity}
                                                            onChange={(e) => handleQuantityChange(index, e.target.value)}
                                                            min="1"
                                                            style={{ width: '70px' }}
                                                            className="me-2"
                                                        />
                                                        <span className="me-2 fw-bold">
                                                            <CurrencyDollar size={14} />
                                                            {(orderItem.item.price * orderItem.quantity).toFixed(1)}
                                                        </span>
                                                        <Button
                                                            variant="outline-danger"
                                                            size="sm"
                                                            onClick={() => handleRemoveItem(index)}
                                                        >
                                                            <Trash size={14} />
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <div className="text-end border-top pt-2">
                                            <h5 className="mb-0">
                                                Total: <span className="text-primary">
                                                    <CurrencyDollar size={18} />
                                                {calculateTotal().toFixed(1)}
                                                </span>
                                            </h5>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-center text-muted p-3">
                                        <Cart size={24} className="mb-2" />
                                        <div>No products or combos selected</div>
                                    </div>
                                )}
                            </div>
                        </Form.Group>

                        <Form.Group className="mb-3" controlId="notes">
                            <Form.Label>
                                <CardText size={16} className="me-1" />
                                Notes
                            </Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                name="notes"
                                value={newOrder.notes}
                                onChange={handleInputChange}
                                placeholder="Special instructions for the order"
                            />
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
                        onClick={handleCreateOrder}
                        style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}
                        disabled={!newOrder.customerName || !newOrder.tableNumber || newOrder.selectedItems.length === 0}
                    >
                        <CheckCircle size={16} className="me-1" />
                        Create Order - <CurrencyDollar size={16} />{calculateTotal().toFixed(1)}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default OrderStatus;
