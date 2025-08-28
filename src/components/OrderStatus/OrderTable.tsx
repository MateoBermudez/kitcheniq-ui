import React, { useState, useEffect, useCallback } from 'react';
import { Table, Badge, Button, Dropdown, Spinner, Alert, Modal } from 'react-bootstrap';
import {
    ArrowClockwise,
    ThreeDots,
    HourglassSplit,
    CheckCircle,
    Box,
    XCircle,
    Clipboard,
    Trash
} from 'react-bootstrap-icons';
import { getAllOrders, updateOrderStatus, deleteOrder } from '../../service/api';

declare global {
    interface Window {
        updateOrderTable?: (newOrder: any) => void;
    }
}

const OrderTable = ({ searchTerm, onToast }) => {
    const [orders, setOrders] = useState([]);
    const [updatingOrder, setUpdatingOrder] = useState(null);
    const [deletingOrder, setDeletingOrder] = useState(null);
    const [isHovered, setIsHovered] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState(null);
    const [localOrderTimes, setLocalOrderTimes] = useState(() => {
        const saved = localStorage.getItem('orderCreationTimes');
        return saved ? JSON.parse(saved) : {};
    });
    const [localDeliveryTimes, setLocalDeliveryTimes] = useState(() => {
        const saved = localStorage.getItem('orderDeliveryTimes');
        return saved ? JSON.parse(saved) : {};
    });

    useEffect(() => {
        window.updateOrderTable = (newOrder) => {
            const newTimes = {
                ...localOrderTimes,
                [newOrder.id]: newOrder.horasolicitud
            };
            setLocalOrderTimes(newTimes);
            localStorage.setItem('orderCreationTimes', JSON.stringify(newTimes));

            loadOrders();
        };

        return () => {
            delete window.updateOrderTable;
        };
    }, [localOrderTimes]);

    const mapOrderData = useCallback((backendOrder) => {
        const safeOrder = backendOrder || {};

        const orderId = safeOrder.id || safeOrder._id;
        const horasolicitud = localOrderTimes[orderId] || 'N/A';
        const horaEntrega = localDeliveryTimes[orderId] || null;

        return {
            id: orderId || Math.random().toString(36).substr(2, 9),
            codigo: safeOrder.codigo || `ORD-${orderId || 'XXX'}`,
            clienteSolicitante: safeOrder.clienteSolicitante ||
                safeOrder.customer ||
                safeOrder.client ||
                extractClientFromDetails(safeOrder.details) ||
                'Cliente',
            mesa: safeOrder.mesa ||
                safeOrder.table ||
                safeOrder.tableNumber ||
                extractTableFromBill(safeOrder.bill) ||
                'N/A',
            estado: mapStatusToSpanish(safeOrder.status || safeOrder.estado || 'PENDING'),
            horasolicitud: horasolicitud,
            horaEntrega: horaEntrega,
            items: safeOrder.items || safeOrder.orderItems || [],
            details: safeOrder.details || safeOrder.description || '',
            bill: safeOrder.bill || safeOrder.total || '',
            originalStatus: safeOrder.status || safeOrder.estado || 'PENDING'
        };
    }, [localOrderTimes, localDeliveryTimes]);

    const extractClientFromDetails = useCallback((details) => {
        if (!details || typeof details !== 'string') return null;

        const clientMatch = details.match(/cliente:?\s*([^,\n]+)/i);
        if (clientMatch) return clientMatch[1]?.trim();

        return details.length > 20 ? details.substring(0, 20) + '...' : details;
    }, []);

    const extractTableFromBill = useCallback((bill) => {
        if (!bill || typeof bill !== 'string') return null;

        const tableMatch = bill.match(/mesa\s*(\d+)/i) || bill.match(/table\s*(\d+)/i);
        if (tableMatch) return tableMatch[1];
        return null;
    }, []);

    const mapStatusToSpanish = useCallback((status) => {
        if (!status) return 'Pendiente';

        const statusMap = {
            'PENDING': 'Pendiente',
            'READY': 'Listo',
            'DELIVERED': 'Entregado',
            'CANCELLED': 'Cancelado',
            'PREPARING': 'Pendiente',
            'COMPLETED': 'Entregado',
            'IN_PROGRESS': 'Pendiente'
        };
        return statusMap[status.toString().toUpperCase()] || status || 'Pendiente';
    }, []);

    const mapStatusToEnglish = useCallback((spanishStatus) => {
        const statusMap = {
            'Pendiente': 'PENDING',
            'Listo': 'READY',
            'Entregado': 'DELIVERED',
            'Cancelado': 'CANCELLED'
        };
        return statusMap[spanishStatus] || spanishStatus;
    }, []);

    const loadOrders = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const ordersData = await getAllOrders();

            if (!ordersData) {
                throw new Error('No se recibieron datos del servidor');
            }

            let processedOrders = [];

            if (Array.isArray(ordersData)) {
                processedOrders = ordersData;
            } else if (ordersData.data && Array.isArray(ordersData.data)) {
                processedOrders = ordersData.data;
            } else if (ordersData.orders && Array.isArray(ordersData.orders)) {
                processedOrders = ordersData.orders;
            } else if (ordersData.content && Array.isArray(ordersData.content)) {
                processedOrders = ordersData.content;
            } else if (ordersData.result && Array.isArray(ordersData.result)) {
                processedOrders = ordersData.result;
            } else if (ordersData.items && Array.isArray(ordersData.items)) {
                processedOrders = ordersData.items;
            } else if (typeof ordersData === 'object') {
                const values = Object.values(ordersData);
                if (values.length > 0 && values.every(item =>
                    typeof item === 'object' &&
                    item !== null &&
                    (item.id || item._id || item.codigo)
                )) {
                    processedOrders = values;
                } else {
                    if (ordersData.id || ordersData._id || ordersData.codigo) {
                        processedOrders = [ordersData];
                    }
                }
            }

            console.log('Pedidos procesados:', processedOrders);

            if (processedOrders.length === 0) {
                processedOrders = [];
            }

            const mappedOrders = processedOrders.map(order => mapOrderData(order));
            setOrders(mappedOrders);

        } catch (err) {

            let errorMessage = 'Error al cargar los pedidos';

            if (err.name === 'TypeError' && err.message.includes('fetch')) {
                errorMessage = 'No se puede conectar con el servidor. Verifica que esté funcionando en http://localhost:8080';
            } else if (err.message.includes('500')) {
                errorMessage = 'Error interno del servidor. Revisa los logs del backend.';
            } else if (err.message.includes('404')) {
                errorMessage = 'Endpoint no encontrado. Verifica la URL de la API.';
            } else if (err.message.includes('CORS')) {
                errorMessage = 'Error de CORS. Configura el servidor para permitir requests desde el frontend.';
            } else {
                errorMessage = err.message || errorMessage;
            }

            setError(errorMessage);
            onToast && onToast(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    }, [mapOrderData, onToast]);

    useEffect(() => {
        loadOrders();
    }, [loadOrders]);

    const handleRefresh = async () => {
        try {
            setRefreshing(true);
            await loadOrders();
            onToast && onToast('Pedidos actualizados correctamente', 'success');
        } catch (err) {
            console.error('Error refreshing orders:', err);
            onToast && onToast('Error al actualizar los pedidos', 'error');
        } finally {
            setRefreshing(false);
        }
    };

    const filteredOrders = React.useMemo(() => {
        let filtered = searchTerm
            ? orders.filter(order =>
                order.codigo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.clienteSolicitante?.toLowerCase().includes(searchTerm.toLowerCase())
            )
            : [...orders];

        filtered.sort((a, b) => {
            if (a.estado === 'Listo' && b.estado !== 'Listo') return -1;
            if (a.estado !== 'Listo' && b.estado === 'Listo') return 1;
            if (a.estado === 'Entregado' && b.estado !== 'Entregado') return 1;
            if (a.estado !== 'Entregado' && b.estado === 'Entregado') return -1;
            return 0;
        });

        return filtered;
    }, [orders, searchTerm]);

    const getBadgeStyle = useCallback((estado) => {
        switch (estado?.toLowerCase()) {
            case 'pendiente':
                return {
                    backgroundColor: '#feffd4',
                    border: '1px solid #c2c838',
                    color: '#000000'
                };
            case 'listo':
                return {
                    backgroundColor: '#D1FFD7',
                    border: '1px solid #A3C6B0',
                    color: '#000000'
                };
            case 'entregado':
                return {
                    backgroundColor: '#a7cdff',
                    border: '1px solid #7BB3FFFF',
                    color: '#000000'
                };
            case 'cancelado':
                return {
                    backgroundColor: '#F8D7DA',
                    border: '1px solid #EA868F',
                    color: '#000000'
                };
            default:
                return {
                    backgroundColor: '#E9ECEF',
                    border: '1px solid #CED4DA',
                    color: '#000000'
                };
        }
    }, []);

    const handleStatusChange = async (codigo, nuevoEstado) => {
        try {
            setUpdatingOrder(codigo);

            const order = orders.find(o => o.codigo === codigo);
            if (!order) {
                throw new Error('Pedido no encontrado');
            }

            const backendStatus = mapStatusToEnglish(nuevoEstado);

            let updateData = {
                status: backendStatus
            };

            let horaEntregaActual = null;
            if (nuevoEstado === 'Entregado') {
                horaEntregaActual = new Date().toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });

                const newDeliveryTimes = {
                    ...localDeliveryTimes,
                    [order.id]: horaEntregaActual
                };
                setLocalDeliveryTimes(newDeliveryTimes);
                localStorage.setItem('orderDeliveryTimes', JSON.stringify(newDeliveryTimes));
            }

            await updateOrderStatus(order.id, backendStatus);

            setOrders(prevOrders =>
                prevOrders.map(o =>
                    o.codigo === codigo
                        ? {
                            ...o,
                            estado: nuevoEstado,
                            originalStatus: backendStatus,
                            horaEntrega: nuevoEstado === 'Entregado' ? horaEntregaActual : o.horaEntrega
                        }
                        : o
                )
            );

            onToast && onToast(`Pedido ${codigo} actualizado a ${nuevoEstado}`, 'success');
        } catch (err) {
            console.error('Error updating order status:', err);
            const errorMessage = err.message || `Error al actualizar el pedido ${codigo}`;
            onToast && onToast(errorMessage, 'error');
        } finally {
            setUpdatingOrder(null);
        }
    };

    const handleDeleteClick = (order) => {
        setOrderToDelete(order);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!orderToDelete) return;

        try {
            setDeletingOrder(orderToDelete.codigo);
            setShowDeleteModal(false);

            await deleteOrder(orderToDelete.id);

            setOrders(prevOrders =>
                prevOrders.filter(o => o.codigo !== orderToDelete.codigo)
            );

            const newTimes = { ...localOrderTimes };
            delete newTimes[orderToDelete.id];
            setLocalOrderTimes(newTimes);
            localStorage.setItem('orderCreationTimes', JSON.stringify(newTimes));

            const newDeliveryTimes = { ...localDeliveryTimes };
            delete newDeliveryTimes[orderToDelete.id];
            setLocalDeliveryTimes(newDeliveryTimes);
            localStorage.setItem('orderDeliveryTimes', JSON.stringify(newDeliveryTimes));

            onToast && onToast(`Pedido ${orderToDelete.codigo} eliminado correctamente`, 'success');
        } catch (err) {
            console.error('Error deleting order:', err);
            const errorMessage = err.message || `Error al eliminar el pedido ${orderToDelete.codigo}`;
            onToast && onToast(errorMessage, 'error');
        } finally {
            setDeletingOrder(null);
            setOrderToDelete(null);
        }
    };

    const cancelDelete = () => {
        setShowDeleteModal(false);
        setOrderToDelete(null);
    };

    const buttonStyle = {
        backgroundColor: isHovered ? '#B1E5FF' : 'transparent',
        color: isHovered ? '#001f45' : '#60a5ff',
        borderColor: '#B1E5FF',
        transition: 'all 0.3s ease'
    };

    if (loading) {
        return (
            <div className="bg-white rounded shadow-sm">
                <div className="p-5 text-center">
                    <Spinner animation="border" variant="primary" />
                    <div className="mt-2 text-muted">Cargando pedidos...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded shadow-sm">
                <div className="p-3">
                    <Alert variant="danger" className="mb-3">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>Error:</strong> {error}
                                <br />
                                <small className="text-muted">
                                    Verifica que el servidor esté funcionando correctamente
                                </small>
                            </div>
                            <Button variant="outline-danger" size="sm" onClick={loadOrders}>
                                <ArrowClockwise size={16} className="me-1" /> Reintentar
                            </Button>
                        </div>
                    </Alert>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white rounded">
                <div className="p-3 border-bottom bg-white">
                    <div className="d-flex justify-content-between align-items-center">
                        <h6 className="mb-0 text-muted">
                            Total de pedidos: <span className="text-dark">{filteredOrders.length}</span>
                        </h6>
                        <Button
                            style={buttonStyle}
                            size="sm"
                            disabled={refreshing}
                            onClick={handleRefresh}
                            onMouseEnter={() => setIsHovered(true)}
                            onMouseLeave={() => setIsHovered(false)}
                        >
                            {refreshing ? (
                                <>
                                    <Spinner as="span" animation="border" size="sm" className="me-1" />
                                    Actualizando...
                                </>
                            ) : (
                                <>
                                    <ArrowClockwise size={16} className="me-1" /> Actualizar
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    <Table responsive hover className="mb-0">
                        <thead className="sticky-top">
                        <tr>
                            <th>Código</th>
                            <th>Cliente</th>
                            <th>Mesa</th>
                            <th>Estado</th>
                            <th>Hora Solicitud</th>
                            <th>Hora Entrega</th>
                            <th>Acciones</th>
                        </tr>
                        </thead>
                        <tbody>
                        {filteredOrders.map((order, index) => (
                            <tr key={order.codigo || order.id || index}>
                                <td>
                                    <strong className="text-black">{order.codigo || 'N/A'}</strong>
                                </td>
                                <td>
                                    <div>{order.clienteSolicitante}</div>
                                </td>
                                <td>
                                    <Badge bg="light" text="dark">
                                        {order.mesa && order.mesa !== 'N/A' ? `Mesa ${order.mesa}` : 'Para llevar'}
                                    </Badge>
                                </td>
                                <td>
                                    <span
                                        className="badge"
                                        style={getBadgeStyle(order.estado)}
                                    >
                                        {order.estado || 'N/A'}
                                    </span>
                                </td>
                                <td>
                                    <small className="text-muted">{order.horasolicitud || 'N/A'}</small>
                                </td>
                                <td>
                                    <small className="text-muted">{order.horaEntrega || '--:--'}</small>
                                </td>
                                <td>
                                    <Dropdown>
                                        <Dropdown.Toggle
                                            variant="outline-secondary"
                                            size="sm"
                                            disabled={updatingOrder === order.codigo || deletingOrder === order.codigo}
                                        >
                                            {(updatingOrder === order.codigo || deletingOrder === order.codigo) ?
                                                <HourglassSplit size={16} /> :
                                                <ThreeDots size={16} />}
                                        </Dropdown.Toggle>
                                        <Dropdown.Menu>
                                            <Dropdown.Item
                                                onClick={() => handleStatusChange(order.codigo, 'Pendiente')}
                                                disabled={order.estado === 'Pendiente'}
                                            >
                                                <HourglassSplit size={16} className="me-2" /> Marcar como Pendiente
                                            </Dropdown.Item>
                                            <Dropdown.Item
                                                onClick={() => handleStatusChange(order.codigo, 'Listo')}
                                                disabled={order.estado === 'Listo'}
                                            >
                                                <CheckCircle size={16} className="me-2" /> Marcar como Listo
                                            </Dropdown.Item>
                                            <Dropdown.Item
                                                onClick={() => handleStatusChange(order.codigo, 'Entregado')}
                                                disabled={order.estado === 'Entregado'}
                                            >
                                                <Box size={16} className="me-2" /> Marcar como Entregado
                                            </Dropdown.Item>
                                            <Dropdown.Divider />
                                            <Dropdown.Item
                                                onClick={() => handleStatusChange(order.codigo, 'Cancelado')}
                                                className="text-warning"
                                                disabled={order.estado === 'Cancelado'}
                                            >
                                                <XCircle size={16} className="me-2" /> Cancelar Pedido
                                            </Dropdown.Item>
                                            <Dropdown.Item
                                                onClick={() => handleDeleteClick(order)}
                                                className="text-danger"
                                                disabled={deletingOrder === order.codigo}
                                            >
                                                <Trash size={16} className="me-2" /> Eliminar Pedido
                                            </Dropdown.Item>
                                        </Dropdown.Menu>
                                    </Dropdown>
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </Table>
                </div>

                {filteredOrders.length === 0 && !loading && (
                    <div className="text-center py-5 text-muted">
                        <div className="mb-2">
                            <Clipboard size={24} />
                        </div>
                        <div>No se encontraron pedidos</div>
                        {orders.length > 0 && (
                            <small>
                                Hay {orders.length} pedidos en total, pero ninguno coincide con el filtro actual
                            </small>
                        )}
                    </div>
                )}
            </div>

            {/* Modal de confirmación para eliminar */}
            <Modal show={showDeleteModal} onHide={cancelDelete} centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <Trash size={20} className="me-2 text-danger" />
                        CONFIRMAR ELIMINACION
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="text-center">
                        <div className="mb-3">
                            <Trash size={48} className="text-danger" />
                        </div>
                        <h5>¿Estás seguro de que deseas eliminar este pedido?</h5>
                        {orderToDelete && (
                            <div className="mt-3 p-3 bg-light rounded">
                                <strong>Código:</strong> {orderToDelete.codigo}<br />
                                <strong>Cliente:</strong> {orderToDelete.clienteSolicitante}<br />
                                <strong>Estado:</strong> {orderToDelete.estado}
                            </div>
                        )}
                        <div className="mt-3 text-muted">
                            <small>Esta acción no se puede deshacer.</small>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={cancelDelete}>
                        Cancelar
                    </Button>
                    <Button variant="danger" onClick={confirmDelete}>
                        <Trash size={16} className="me-1" />
                        Eliminar Pedido
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default OrderTable;