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
import OrderNotifications from './OrderNotifications';
import { createOrder } from '../../service/api';

const menuItems = [
    { id: 1, nombre: "Hamburguesa", precio: 10.0, tipo: "PRODUCTO" },
    { id: 2, nombre: "Papas a la Francesa", precio: 5.0, tipo: "PRODUCTO" },
    { id: 3, nombre: "Bebida", precio: 2.0, tipo: "PRODUCTO" },
    { id: 4, nombre: "Hamburguesa + Papas a la Francesa", precio: 15.0, tipo: "COMBO" },
    { id: 5, nombre: "Hamburguesa + Bebida", precio: 12.0, tipo: "COMBO" },
    { id: 6, nombre: "2 Hamburguesas + 2 Papas a la Francesa + 2 Bebidas", precio: 34.0, tipo: "COMBO" }
];

const OrderStatus = ({ onToast }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [currentTime, setCurrentTime] = useState(new Date());
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newOrder, setNewOrder] = useState({
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

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setNewOrder({
            ...newOrder,
            [name]: value
        });
    };

    const handleItemSelect = (e) => {
        const selectedItemId = parseInt(e.target.value);
        if (selectedItemId) {
            const selectedItem = menuItems.find(item => item.id === selectedItemId);

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

    const handleRemoveItem = (index) => {
        const updatedItems = [...newOrder.selectedItems];
        updatedItems.splice(index, 1);
        setNewOrder({
            ...newOrder,
            selectedItems: updatedItems
        });
    };

    const handleQuantityChange = (index, quantity) => {
        const updatedItems = [...newOrder.selectedItems];
        updatedItems[index].quantity = Math.max(1, parseInt(quantity) || 1);
        setNewOrder({
            ...newOrder,
            selectedItems: updatedItems
        });
    };

    const calculateTotal = () => {
        return newOrder.selectedItems.reduce((total, orderItem) =>
            total + (orderItem.item.precio * orderItem.quantity), 0
        );
    };

    const generateOrderDetails = () => {
        let details = `Mesa ${newOrder.tableNumber}\nNombre Cliente: ${newOrder.customerName}`;
        if (newOrder.notes.trim()) {
            details += `\nObservaciones: ${newOrder.notes}`;
        }
        return details;
    };

    const generateItemsList = () => {
        const itemsList = [];

        newOrder.selectedItems.forEach(orderItem => {
            const { item, quantity } = orderItem;
            const itemTotal = item.precio * quantity;

            if (quantity === 1) {
                const itemString = item.tipo === "COMBO"
                    ? `${item.nombre} - $${itemTotal.toFixed(1)} (Combo)`
                    : `${item.nombre} - $${itemTotal.toFixed(1)}`;
                itemsList.push(itemString);
            } else {
                const itemString = item.tipo === "COMBO"
                    ? `${quantity}x ${item.nombre} - $${itemTotal.toFixed(1)} (Combo)`
                    : `${quantity}x ${item.nombre} - $${itemTotal.toFixed(1)}`;
                itemsList.push(itemString);
            }
        });

        return itemsList;
    };

    const handleCreateOrder = () => {
        if (!newOrder.customerName.trim()) {
            onToast && onToast({
                title: 'Error de validación',
                message: 'El nombre del cliente es requerido',
                type: 'error'
            });
            return;
        }

        if (!newOrder.tableNumber) {
            onToast && onToast({
                title: 'Error de validación',
                message: 'El número de mesa es requerido',
                type: 'error'
            });
            return;
        }

        if (newOrder.selectedItems.length === 0) {
            onToast && onToast({
                title: 'Error de validación',
                message: 'Debe seleccionar al menos un producto o combo',
                type: 'error'
            });
            return;
        }

        const orderDetails = generateOrderDetails();

        const components = newOrder.selectedItems.flatMap(orderItem => {
            const componentsArray = [];
            for (let i = 0; i < orderItem.quantity; i++) {
                componentsArray.push({
                    id: orderItem.item.id,
                    type: orderItem.item.tipo === "COMBO" ? "COMBO" : "PRODUCT"
                });
            }
            return componentsArray;
        });

        const currentDateTime = new Date();
        const horaLocal = currentDateTime.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        const orderData = {
            details: orderDetails,
            components: components,
            horaEntrega: null, // Inicialmente null, se establecerá cuando cambie a entregado
            clienteSolicitante: newOrder.customerName,
            mesa: newOrder.tableNumber
        };

        console.log('Enviando pedido:', orderData);

        createOrder(orderData)
            .then(response => {
                const orderConHoraLocal = {
                    ...response,
                    horasolicitud: horaLocal,
                    clienteSolicitante: newOrder.customerName,
                    mesa: newOrder.tableNumber
                };

                if (window.updateOrderTable) {
                    window.updateOrderTable(orderConHoraLocal);
                }

                onToast && onToast({
                    title: 'Pedido creado',
                    message: `Pedido #${response.id} creado a las ${horaLocal} por un total de $${response.price}`,
                    type: 'success'
                });

                setNewOrder({
                    customerName: '',
                    tableNumber: '',
                    selectedItems: [],
                    notes: ''
                });
            })
            .catch(error => {
                console.error('Error al crear pedido:', error);

                const errorMessage = error.response?.data?.message ||
                    error.message ||
                    'No se pudo crear el pedido. Inténtalo de nuevo.';

                onToast && onToast({
                    title: 'Error al crear pedido',
                    message: errorMessage,
                    type: 'error'
                });
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
                            <h2 className="mb-1">ESTADO DE PEDIDOS</h2>
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
                            Crear Pedido
                        </Button>
                    </div>

                    <OrderTable
                        searchTerm={searchTerm}
                        onToast={onToast}
                    />
                </div>

                {/* Sección inferior con búsqueda y notificaciones */}
                <Row>
                    <Col md={6}>
                        <div className="p-3 border rounded-4 shadow h-100">
                            <OrderSearch onSearch={setSearchTerm} />
                        </div>
                    </Col>
                    <Col md={6}>
                        <div className="p-3 border rounded-4 shadow h-100">
                            <OrderNotifications onToast={onToast} />
                        </div>
                    </Col>
                </Row>
            </Container>

            {/* Modal para crear pedido */}
            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <Cart size={20} className="me-2" />
                        CREAR NUEVO PEDIDO
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Row className="mb-3">
                            <Col md={6}>
                                <Form.Group controlId="customerName">
                                    <Form.Label>
                                        <PersonFill size={16} className="me-1" />
                                        Cliente Solicitante *
                                    </Form.Label>
                                    <Form.Control
                                        type="text"
                                        name="customerName"
                                        value={newOrder.customerName}
                                        onChange={handleInputChange}
                                        placeholder="Nombre del cliente"
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group controlId="tableNumber">
                                    <Form.Label>
                                        <TableIcon size={16} className="me-1" />
                                        Número de Mesa *
                                    </Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="tableNumber"
                                        value={newOrder.tableNumber}
                                        onChange={handleInputChange}
                                        placeholder="# Mesa"
                                        min="1"
                                        required
                                    />
                                </Form.Group>
                            </Col>
                        </Row>

                        <Form.Group className="mb-3" controlId="orderItems">
                            <Form.Label>
                                <BoxSeam size={16} className="me-1" />
                                Productos y Combos *
                            </Form.Label>
                            <div className="d-flex mb-2">
                                <Form.Select
                                    onChange={handleItemSelect}
                                    className="me-2"
                                    defaultValue=""
                                >
                                    <option value="">Seleccionar producto o combo</option>
                                    <optgroup label="PRODUCTOS">
                                        {menuItems.filter(item => item.tipo === "PRODUCTO").map(item => (
                                            <option key={item.id} value={item.id}>
                                                {item.nombre} - ${item.precio.toFixed(1)}
                                            </option>
                                        ))}
                                    </optgroup>
                                    <optgroup label="COMBOS">
                                        {menuItems.filter(item => item.tipo === "COMBO").map(item => (
                                            <option key={item.id} value={item.id}>
                                                {item.nombre} - ${item.precio.toFixed(1)}
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
                                                            <strong>{orderItem.item.nombre}</strong>
                                                            {orderItem.item.tipo === "COMBO" && (
                                                                <span className="badge bg-success ms-2">Combo</span>
                                                            )}
                                                        </div>
                                                        <small className="text-muted">
                                                            <CurrencyDollar size={12} />
                                                            {orderItem.item.precio.toFixed(1)} c/u
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
                                                            {(orderItem.item.precio * orderItem.quantity).toFixed(1)}
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
                                        <div>No hay productos o combos seleccionados</div>
                                    </div>
                                )}
                            </div>
                        </Form.Group>

                        <Form.Group className="mb-3" controlId="notes">
                            <Form.Label>
                                <CardText size={16} className="me-1" />
                                Observaciones
                            </Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                name="notes"
                                value={newOrder.notes}
                                onChange={handleInputChange}
                                placeholder="Instrucciones especiales para el pedido"
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                        <XCircle size={16} className="me-1" />
                        Cancelar
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleCreateOrder}
                        style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}
                        disabled={!newOrder.customerName || !newOrder.tableNumber || newOrder.selectedItems.length === 0}
                    >
                        <CheckCircle size={16} className="me-1" />
                        Crear Pedido - <CurrencyDollar size={16} />{calculateTotal().toFixed(1)}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default OrderStatus;