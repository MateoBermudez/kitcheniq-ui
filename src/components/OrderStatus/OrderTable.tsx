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
import {getAllOrders, updateOrderStatus, deleteOrder, type OrderComponentData} from '../../service/api';

// Types for the order table - completely in English
interface OrderTableRow {
    id: number | null;
    code: string;
    status: string;
    requestTime: string | null;
    deliveryTime: string | null;
    requestingClient: string;
    table: string;
    items: OrderComponentData[];
    details: string;
    originalStatus?: string;
    components: OrderComponentData[];
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

    const mapStatusToEnglish = useCallback((status: string): string => {
        const statusMap: Record<string, string> = {
            'PENDING': 'Pending',
            'READY': 'Ready',
            'DELIVERED': 'Delivered',
            'CANCELLED': 'Cancelled',
            'PREPARING': 'Pending',
            'COMPLETED': 'Delivered',
            'IN_PROGRESS': 'Pending'
        };
        return statusMap[status.toUpperCase()] ?? status ?? 'Pending';
    }, []);

    const mapOrderData = useCallback((backendOrder: Record<string, unknown>): OrderTableRow => {
        const orderId = typeof backendOrder.id === 'number' ? backendOrder.id :
            typeof backendOrder._id === 'number' ? backendOrder._id : null;

        // Use backend requestTime directly
        const backendRequestTime = typeof backendOrder.requestTime === 'string' ? backendOrder.requestTime : null;
        const localRequestTime = orderId !== null ? localOrderTimes[String(orderId)] : null;
        const requestTime = localRequestTime || backendRequestTime || 'N/A';

        // Use backend deliveryTime directly
        const backendDeliveryTime = typeof backendOrder.deliveryTime === 'string' ? backendOrder.deliveryTime : null;
        const localDeliveryTime = orderId !== null ? localDeliveryTimes[String(orderId)] : null;
        const deliveryTime = localDeliveryTime || backendDeliveryTime;

        return {
            id: orderId,
            code: typeof backendOrder.code === 'string' ? backendOrder.code : `ORD-${orderId ?? 'XXX'}`,
            requestingClient: typeof backendOrder.requestingClient === 'string' ? backendOrder.requestingClient : 'Customer',
            table: typeof backendOrder.table === 'string' ? backendOrder.table : 'N/A',
            status: mapStatusToEnglish(typeof backendOrder.status === 'string' ? backendOrder.status : 'PENDING'),
            requestTime,
            deliveryTime,
            items: Array.isArray(backendOrder.components) ? backendOrder.components as OrderComponentData[] : [],
            details: typeof backendOrder.details === 'string' ? backendOrder.details : '',
            originalStatus: typeof backendOrder.originalStatus === 'string' ? backendOrder.originalStatus : undefined,
            components: Array.isArray(backendOrder.components) ? backendOrder.components as OrderComponentData[] : [],
        };
    }, [localOrderTimes, localDeliveryTimes, mapStatusToEnglish]);

    const loadOrders = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await getAllOrders();
            const ordersData = response.data ?? response;
            let processedOrders: Record<string, unknown>[] = [];

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
                if ('id' in ordersData || '_id' in ordersData || 'code' in ordersData) {
                    processedOrders = [ordersData];
                }
            }

            const mappedOrders: OrderTableRow[] = processedOrders.map(mapOrderData);
            setOrders(mappedOrders);
        } catch (err) {
            let errorMessage = 'Error loading orders';
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
        window.updateOrderTable = (newOrder) => {
            setLocalOrderTimes((currentTimes: Record<string, string>) => {
                if (!newOrder || !newOrder.data || !newOrder.data.id || !newOrder.requestTime) {
                    return currentTimes;
                }
                const newTimes = {
                    ...currentTimes,
                    [newOrder.data.id]: newOrder.requestTime
                };
                localStorage.setItem('orderCreationTimes', JSON.stringify(newTimes));
                return newTimes;
            });

            loadOrders().then(() => {});
        };

        return () => {
            delete window.updateOrderTable;
        };
    }, [loadOrders]);

    // Initial load
    useEffect(() => {
        loadOrders().then(() => {});
    }, []);

    useEffect(() => {
        const intervalId = setInterval(() => {
            loadOrders().then(() => {});
        }, 30000); // 30 seconds

        return () => clearInterval(intervalId);
    }, [loadOrders]);

    // Maps English status to backend format
    const mapStatusToBackend = useCallback((englishStatus: string): string => {
        const statusMap: Record<string, string> = {
            'Pending': 'PENDING',
            'Ready': 'READY',
            'Delivered': 'DELIVERED',
            'Cancelled': 'CANCELLED'
        };
        return statusMap[englishStatus] ?? englishStatus;
    }, []);

    const handleRefresh = async () => {
        try {
            setRefreshing(true);
            await loadOrders();
            onToast('Orders updated successfully', 'success');
        } catch (err) {
            console.error('Error refreshing orders:', err);
            onToast('Error updating orders', 'error');
        } finally {
            setRefreshing(false);
        }
    };

    const filteredOrders = React.useMemo(() => {
        const filtered = searchTerm
            ? orders.filter(order =>
                order.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                order.requestingClient?.toLowerCase().includes(searchTerm.toLowerCase())
            )
            : [...orders];

        filtered.sort((a, b) => {
            if (a.status === 'Ready' && b.status !== 'Ready') return -1;
            if (a.status !== 'Ready' && b.status === 'Ready') return 1;
            if (a.status === 'Delivered' && b.status !== 'Delivered') return 1;
            if (a.status !== 'Delivered' && b.status === 'Delivered') return -1;
            return 0;
        });

        return filtered;
    }, [orders, searchTerm]);

    const getBadgeStyle = useCallback((status: string): React.CSSProperties => {
        switch (status?.toLowerCase()) {
            case 'pending':
                return {
                    backgroundColor: '#feffd4',
                    border: '1px solid #c2c838',
                    color: '#000000'
                };
            case 'ready':
                return {
                    backgroundColor: '#D1FFD7',
                    border: '1px solid #A3C6B0',
                    color: '#000000'
                };
            case 'delivered':
                return {
                    backgroundColor: '#a7cdff',
                    border: '1px solid #7BB3FFFF',
                    color: '#000000'
                };
            case 'cancelled':
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

    const handleStatusChange = async (code: string, newStatus: string) => {
        try {
            setUpdatingOrder(code);
            const order = orders.find(o => o.code === code);
            if (!order) {
                onToast('Order not found', 'error');
                setUpdatingOrder(null);
                return;
            }
            const backendStatus = mapStatusToBackend(newStatus);
            let currentDeliveryTime = null;
            if (newStatus === 'Delivered' && order.id !== null) {
                currentDeliveryTime = new Date().toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
                const newDeliveryTimes = {
                    ...localDeliveryTimes,
                    [order.id]: currentDeliveryTime
                };
                setLocalDeliveryTimes(newDeliveryTimes);
                localStorage.setItem('orderDeliveryTimes', JSON.stringify(newDeliveryTimes));
            }
            await updateOrderStatus(Number(order.id), backendStatus);
            setOrders(prevOrders =>
                prevOrders.map(o =>
                    o.code === code
                        ? {
                            ...o,
                            status: newStatus,
                            originalStatus: backendStatus,
                            deliveryTime: newStatus === 'Delivered' ? currentDeliveryTime : o.deliveryTime
                        }
                        : o
                )
            );
            onToast(`Order ${code} updated to ${newStatus}`, 'success');
        } catch (err) {
            console.error('Error updating order status:', err);
            let errorMessage = `Error updating order ${code}`;
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
            setDeletingOrder(orderToDelete.code);
            setShowDeleteModal(false);
            await deleteOrder(Number(orderToDelete.id));
            setOrders(prevOrders =>
                prevOrders.filter(o => o.code !== orderToDelete.code)
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
            onToast(`Order ${orderToDelete.code} deleted successfully`, 'success');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : `Error deleting order ${orderToDelete.code}`;
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
                    <div className="mt-2 text-muted">Loading orders...</div>
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
                                    Check that the server is running correctly
                                </small>
                            </div>
                            <Button variant="outline-danger" size="sm" onClick={loadOrders}>
                                <ArrowClockwise size={16} className="me-1" /> Retry
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
                            Total orders: <span className="text-dark">{filteredOrders.length}</span>
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
                                    Updating...
                                </>
                            ) : (
                                <>
                                    <ArrowClockwise size={16} className="me-1" /> Refresh
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    <Table responsive hover className="mb-0">
                        <thead className="sticky-top">
                        <tr>
                            <th>Code</th>
                            <th>Customer</th>
                            <th>Table</th>
                            <th>Status</th>
                            <th>Request Time</th>
                            <th>Delivery Time</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {filteredOrders.map((order, index) => (
                            <tr key={order.code || order.id || index}>
                                <td>
                                    <strong className="text-black">{order.code || 'N/A'}</strong>
                                </td>
                                <td>
                                    <div>{order.requestingClient}</div>
                                </td>
                                <td>
                                    <Badge bg="light" text="dark">
                                        {order.table && order.table !== 'N/A' ? `Table ${order.table}` : 'Takeout'}
                                    </Badge>
                                </td>
                                <td>
                                    <span
                                        className="badge"
                                        style={getBadgeStyle(order.status)}
                                    >
                                        {order.status || 'N/A'}
                                    </span>
                                </td>
                                <td>
                                    <small className="text-muted">{order.requestTime || 'N/A'}</small>
                                </td>
                                <td>
                                    <small className="text-muted">{order.deliveryTime || '--:--'}</small>
                                </td>
                                <td>
                                    <Dropdown>
                                        <Dropdown.Toggle
                                            variant="outline-secondary"
                                            size="sm"
                                            disabled={updatingOrder === order.code || deletingOrder === order.code}
                                        >
                                            {(updatingOrder === order.code || deletingOrder === order.code) ?
                                                <HourglassSplit size={16} /> :
                                                <ThreeDots size={16} />}
                                        </Dropdown.Toggle>
                                        <Dropdown.Menu>
                                            <Dropdown.Item
                                                onClick={() => handleStatusChange(order.code, 'Pending')}
                                                disabled={order.status === 'Pending'}
                                            >
                                                <HourglassSplit size={16} className="me-2" /> Mark as Pending
                                            </Dropdown.Item>
                                            <Dropdown.Item
                                                onClick={() => handleStatusChange(order.code, 'Ready')}
                                                disabled={order.status === 'Ready'}
                                            >
                                                <CheckCircle size={16} className="me-2" /> Mark as Ready
                                            </Dropdown.Item>
                                            <Dropdown.Item
                                                onClick={() => handleStatusChange(order.code, 'Delivered')}
                                                disabled={order.status === 'Delivered'}
                                            >
                                                <Box size={16} className="me-2" /> Mark as Delivered
                                            </Dropdown.Item>
                                            <Dropdown.Divider />
                                            <Dropdown.Item
                                                onClick={() => handleStatusChange(order.code, 'Cancelled')}
                                                className="text-warning"
                                                disabled={order.status === 'Cancelled'}
                                            >
                                                <XCircle size={16} className="me-2" /> Cancel Order
                                            </Dropdown.Item>
                                            <Dropdown.Item
                                                onClick={() => handleDeleteClick(order)}
                                                className="text-danger"
                                                disabled={deletingOrder === order.code}
                                            >
                                                <Trash size={16} className="me-2" /> Delete Order
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
                        <div>No orders found</div>
                        {orders.length > 0 && (
                            <small>
                                There are {orders.length} orders in total, but none match the current filter
                            </small>
                        )}
                    </div>
                )}
            </div>

            <Modal show={showDeleteModal} onHide={cancelDelete} centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <Trash size={20} className="me-2 text-danger" />
                        CONFIRM DELETION
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="text-center">
                        <div className="mb-3">
                            <Trash size={48} className="text-danger" />
                        </div>
                        <h5>Are you sure you want to delete this order?</h5>
                        {orderToDelete && (
                            <div className="mt-3 p-3 bg-light rounded">
                                <strong>Code:</strong> {orderToDelete.code}<br />
                                <strong>Customer:</strong> {orderToDelete.requestingClient}<br />
                                <strong>Status:</strong> {orderToDelete.status}
                            </div>
                        )}
                        <div className="mt-3 text-muted">
                            <small>This action cannot be undone.</small>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={cancelDelete}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmDelete}>
                        <Trash size={16} className="me-1" />
                        Delete Order
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

export default OrderTable;
