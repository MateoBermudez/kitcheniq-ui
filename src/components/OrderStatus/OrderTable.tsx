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
import {getAllOrders, updateOrderStatus, deleteOrder, type OrderData, type OrderComponentData} from '../../service/api';

// Types for the order table
export interface OrderTableRow extends Omit<OrderData, 'details'> {
    details: string;
    codigo: string;
    estado: string;
    horasolicitud: string | null;
    horaEntrega: string | null;
    clienteSolicitante: string;
    mesa: string;
    items: OrderComponentData[];
    originalStatus?: string;
}

interface OrderTableProps {
    searchTerm: string;
    onToast: (msg: string, type?: string) => void;
}

const OrderTable: React.FC<OrderTableProps> = ({ searchTerm, onToast }) => {
    const [orders, setOrders] = useState<OrderTableRow[]>([]);
    const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
    const [deletingOrder, setDeletingOrder] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState<OrderTableRow | null>(null);
    const [localOrderTimes, setLocalOrderTimes] = useState(() => {
        const saved = localStorage.getItem('orderCreationTimes');
        return saved ? JSON.parse(saved) : {};
    });
    const [localDeliveryTimes, setLocalDeliveryTimes] = useState(() => {
        const saved = localStorage.getItem('orderDeliveryTimes');
        return saved ? JSON.parse(saved) : {};
    });

    const mapStatusToSpanish = useCallback((status: string): string => {
        const statusMap: Record<string, string> = {
            'PENDING': 'Pendiente',
            'READY': 'Listo',
            'DELIVERED': 'Entregado',
            'CANCELLED': 'Cancelado',
            'PREPARING': 'Pendiente',
            'COMPLETED': 'Entregado',
            'IN_PROGRESS': 'Pendiente'
        };
        return statusMap[status.toUpperCase()] ?? status ?? 'Pendiente';
    }, []);

    const mapOrderData = useCallback((backendOrder: Record<string, unknown>): OrderTableRow => {
        const orderId = typeof backendOrder.id === 'number' ? backendOrder.id :
            typeof backendOrder._id === 'number' ? backendOrder._id : null;
        const horasolicitud = orderId !== null ? (localOrderTimes[String(orderId)] || 'N/A') : 'N/A';
        const horaEntrega = orderId !== null ? (localDeliveryTimes[String(orderId)] || null) : null;
        return {
            id: orderId,
            codigo: typeof backendOrder.codigo === 'string' ? backendOrder.codigo : `ORD-${orderId ?? 'XXX'}`,
            clienteSolicitante: typeof backendOrder.clienteSolicitante === 'string' ? backendOrder.clienteSolicitante : 'Cliente',
            mesa: typeof backendOrder.mesa === 'string' ? backendOrder.mesa : 'N/A',
            estado: mapStatusToSpanish(typeof backendOrder.status === 'string' ? backendOrder.status : 'PENDING'),
            horasolicitud,
            horaEntrega,
            items: Array.isArray(backendOrder.components) ? backendOrder.components as OrderComponentData[] : [],
            details: typeof backendOrder.details === 'string' ? backendOrder.details : '',
            originalStatus: typeof backendOrder.originalStatus === 'string' ? backendOrder.originalStatus : undefined,
            horaSolicitud: typeof backendOrder.horaSolicitud === 'string' ? backendOrder.horaSolicitud : null,
            components: Array.isArray(backendOrder.components) ? backendOrder.components as OrderComponentData[] : [],
        };
    }, [localOrderTimes, localDeliveryTimes, mapStatusToSpanish]);

    const loadOrders = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getAllOrders();
            const ordersData = response.data ?? response;
            let processedOrders: Partial<OrderTableRow>[] = [];
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
                if ('id' in ordersData || '_id' in ordersData || 'codigo' in ordersData) {
                    processedOrders = [ordersData];
                }
            }
            const mappedOrders: OrderTableRow[] = processedOrders.map(mapOrderData);
            setOrders(mappedOrders);
        } catch (err) {
            let errorMessage = 'Error al cargar los pedidos';
            if (err instanceof Error) {
                errorMessage = err.message || errorMessage;
            }
            setError(errorMessage);
            onToast(errorMessage, 'error');
        } finally {
            setLoading(false);
        }
    }, [mapOrderData, onToast]);

    useEffect(() => {
        (async () => {
            await loadOrders();
        })();
    }, [loadOrders]);

    // Corrects the statusMap indexing
    const mapStatusToEnglish = useCallback((spanishStatus: string): string => {
        const statusMap: Record<string, string> = {
            'Pendiente': 'PENDING',
            'Listo': 'READY',
            'Entregado': 'DELIVERED',
            'Cancelado': 'CANCELLED'
        };
        return statusMap[spanishStatus] ?? spanishStatus;
    }, []);

    const handleRefresh = async () => {
        try {
            setRefreshing(true);
            await loadOrders();
            onToast('Pedidos actualizados correctamente', 'success');
        } catch (err) {
            console.error('Error refreshing orders:', err);
            onToast('Error al actualizar los pedidos', 'error');
        } finally {
            setRefreshing(false);
        }
    };

    const filteredOrders = React.useMemo(() => {
        const filtered = searchTerm
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

    const getBadgeStyle = useCallback((estado: string): React.CSSProperties => {
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

    const handleStatusChange = async (codigo: string, nuevoEstado: string) => {
        try {
            setUpdatingOrder(codigo);
            const order = orders.find(o => o.codigo === codigo);
            if (!order) {
                onToast('Pedido no encontrado', 'error');
                setUpdatingOrder(null);
                return;
            }
            const backendStatus = mapStatusToEnglish(nuevoEstado);
            let horaEntregaActual = null;
            if (nuevoEstado === 'Entregado' && order.id !== null) {
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
            await updateOrderStatus(Number(order.id), backendStatus);
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
            onToast(`Pedido ${codigo} actualizado a ${nuevoEstado}`, 'success');
        } catch (err) {
            console.error('Error updating order status:', err);
            let errorMessage = `Error al actualizar el pedido ${codigo}`;
            if (err instanceof Error) {
                errorMessage = err.message || errorMessage;
            }
            onToast(errorMessage, 'error');
        } finally {
            setUpdatingOrder(null);
        }
    };

    const handleDeleteClick = (order: OrderTableRow) => {
        setOrderToDelete(order);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!orderToDelete) return;
        try {
            setDeletingOrder(orderToDelete.codigo);
            setShowDeleteModal(false);
            await deleteOrder(Number(orderToDelete.id));
            setOrders(prevOrders =>
                prevOrders.filter(o => o.codigo !== orderToDelete.codigo)
            );
            const newTimes = { ...localOrderTimes };
            if (orderToDelete.id !== null) {
                delete newTimes[orderToDelete.id];
            }
            setLocalOrderTimes(newTimes);
            localStorage.setItem('orderCreationTimes', JSON.stringify(newTimes));
            const newDeliveryTimes = { ...localDeliveryTimes };
            if (orderToDelete.id !== null) {
                delete newDeliveryTimes[orderToDelete.id];
            }
            setLocalDeliveryTimes(newDeliveryTimes);
            localStorage.setItem('orderDeliveryTimes', JSON.stringify(newDeliveryTimes));
            onToast(`Pedido ${orderToDelete.codigo} eliminado correctamente`, 'success');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : `Error al eliminar el pedido ${orderToDelete.codigo}`;
            onToast(errorMessage, 'error');
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

            {/* Confirmation modal for deletion */}
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
