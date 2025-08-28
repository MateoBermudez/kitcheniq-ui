import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-bootstrap';
import { BellSlash, Clock, InfoCircle, CheckCircle, ExclamationTriangle } from 'react-bootstrap-icons';
import { getAllOrders } from '../../service/api';

const OrderNotifications = () => {
    const [notifications, setNotifications] = useState([]);
    const lastOrderStatesRef = useRef({});
    const checkIntervalRef = useRef(null);

    const addNotification = useCallback((message, type = 'info', title = null, autoRemove = true) => {
        console.log('Añadiendo notificación:', message, type, title);

        const newNotification = {
            id: Date.now().toString(),
            code: title || (type === 'success' ? 'Éxito' :
                type === 'warning' ? 'Advertencia' :
                    type === 'danger' ? 'Error' : 'Información'),
            message,
            type,
            timestamp: new Date()
        };

        setNotifications(prev => [newNotification, ...prev]);

        if (autoRemove) {
            setTimeout(() => {
                setNotifications(prev => prev.filter(notif => notif.id !== newNotification.id));
            }, 120000);
        }

        return newNotification.id;
    }, []);

    const checkOrdersStatus = useCallback(async () => {
        try {
            console.log('Verificando estado de pedidos...');
            const orders = await getAllOrders();

            if (!orders || !Array.isArray(orders) || orders.length === 0) {
                console.log('No se encontraron pedidos para verificar');
                return;
            }

            console.log(`Verificando ${orders.length} pedidos`);
            const currentTime = new Date();

            let pendingCount = 0;
            let readyCount = 0;
            let deliveredCount = 0;

            let ordersByTable = {};

            orders.forEach(order => {
                const orderId = order.id || order.codigo || order._id;
                if (!orderId) return;

                const orderStatus = (order.status || order.estado || '').toUpperCase();
                const lastKnownState = lastOrderStatesRef.current[orderId];

                if (orderStatus === 'PENDING' || orderStatus === 'PENDIENTE') {
                    pendingCount++;
                } else if (orderStatus === 'READY' || orderStatus === 'LISTO') {
                    readyCount++;
                } else if (orderStatus === 'DELIVERED' || orderStatus === 'ENTREGADO') {
                    deliveredCount++;
                }

                const tableNumber = extractTableNumber(order);
                if (tableNumber && orderStatus !== 'DELIVERED' && orderStatus !== 'ENTREGADO') {
                    ordersByTable[tableNumber] = (ordersByTable[tableNumber] || 0) + 1;
                }

                if (!lastKnownState) {
                    lastOrderStatesRef.current[orderId] = {
                        status: orderStatus,
                        timestamp: currentTime,
                        notified: {
                            pendingTooLong: false,
                            readyTooLong: false,
                            cancelledNotified: false,
                            highPriority: false
                        }
                    };
                    return;
                }

                if (orderStatus === 'READY' || orderStatus === 'LISTO') {
                    if (lastKnownState.status !== 'READY' && lastKnownState.status !== 'LISTO') {
                        addNotification(
                            `ORD-${orderId} está lista para ser entregada.`,
                            'success',
                            'Pedido Listo'
                        );

                        lastOrderStatesRef.current[orderId] = {
                            ...lastKnownState,
                            status: orderStatus,
                            timestamp: currentTime,
                            notified: {
                                ...lastKnownState.notified,
                                pendingTooLong: false,
                                readyTooLong: false
                            }
                        };
                    }
                }

                if (orderStatus === 'CANCELLED' || orderStatus === 'CANCELADO') {
                    if (!lastKnownState.notified?.cancelledNotified) {
                        addNotification(
                            `ORD-${orderId} ha sido cancelada.`,
                            'danger',
                            'Pedido Cancelado'
                        );

                        lastOrderStatesRef.current[orderId] = {
                            ...lastKnownState,
                            status: orderStatus,
                            notified: {
                                ...lastKnownState.notified,
                                cancelledNotified: true
                            }
                        };
                    }
                }

                if (orderStatus === 'PENDING' || orderStatus === 'PENDIENTE') {
                    const timeDiff = (currentTime - new Date(lastKnownState.timestamp)) / 600000; // en minutos

                    if (timeDiff >= 15 && !lastKnownState.notified?.pendingTooLong) {
                        addNotification(
                            `ORD-${orderId} lleva más de 15 minutos en estado pendiente.`,
                            'warning',
                            'Pedido Demorado'
                        );

                        lastOrderStatesRef.current[orderId] = {
                            ...lastKnownState,
                            notified: {
                                ...lastKnownState.notified,
                                pendingTooLong: true
                            }
                        };
                    }

                    if (timeDiff >= 30 && !lastKnownState.notified?.highPriority) {
                        addNotification(
                            `¡URGENTE! ORD-${orderId} lleva más de 30 minutos pendiente.`,
                            'danger',
                            'Pedido Urgente'
                        );

                        lastOrderStatesRef.current[orderId] = {
                            ...lastKnownState,
                            notified: {
                                ...lastKnownState.notified,
                                highPriority: true
                            }
                        };
                    }
                }

                if (orderStatus === 'READY' || orderStatus === 'LISTO') {
                    const timeDiff = (currentTime - new Date(lastKnownState.timestamp)) / 60000; // en minutos

                    if (timeDiff >= 15 && !lastKnownState.notified?.readyTooLong) {
                        addNotification(
                            `ORD-${orderId} lleva más de 15 minutos listo sin ser entregado.`,
                            'warning',
                            'Entrega Pendiente'
                        );

                        lastOrderStatesRef.current[orderId] = {
                            ...lastKnownState,
                            notified: {
                                ...lastKnownState.notified,
                                readyTooLong: true
                            }
                        };
                    }
                }

                if (orderStatus !== lastKnownState.status) {
                    lastOrderStatesRef.current[orderId] = {
                        status: orderStatus,
                        timestamp: currentTime,
                        notified: {
                            pendingTooLong: false,
                            readyTooLong: false,
                            highPriority: false,
                            cancelledNotified: lastKnownState.notified?.cancelledNotified || false
                        }
                    };
                }
            });

            const lastSummary = lastOrderStatesRef.current['_lastSummary'] || 0;
            if ((currentTime - lastSummary) >= 30 * 60 * 1000) { // 30 minutos
                if (pendingCount > 0 || readyCount > 0) {
                    addNotification(
                        `Resumen: ${pendingCount} pedidos pendientes, ${readyCount} pedidos listos, ${deliveredCount} entregados hoy.`,
                        'info',
                        'Resumen'
                    );
                    lastOrderStatesRef.current['_lastSummary'] = currentTime;
                }
            }

            Object.entries(ordersByTable).forEach(([mesa, cantidad]) => {
                const mesaKey = `mesa_${mesa}`;
                const lastMesaNotification = lastOrderStatesRef.current[mesaKey]?.timestamp || 0;

                if (cantidad > 1 && (currentTime - lastMesaNotification) >= 15 * 60 * 1000) {
                    addNotification(
                        `La mesa ${mesa} tiene ${cantidad} pedidos activos.`,
                        'info',
                        'Mesa Activa'
                    );

                    lastOrderStatesRef.current[mesaKey] = {
                        timestamp: currentTime
                    };
                }
            });

        } catch (error) {
            console.error('Error al verificar el estado de los pedidos:', error);
        }
    }, [addNotification]);

    const extractTableNumber = (order) => {
        if (order.details && typeof order.details === 'string' && order.details.includes('Mesa')) {
            const match = order.details.match(/Mesa\s+(\d+)/i);
            return match ? match[1] : null;
        }
        return order.tableNumber || order.mesa || null;
    };

    useEffect(() => {
        checkOrdersStatus();

        checkIntervalRef.current = setInterval(checkOrdersStatus, 600000);

        return () => {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
        };
    }, [checkOrdersStatus]);

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(notif => notif.id !== id));
    };

    const getNotificationIcon = (type) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="me-2" />;
            case 'warning':
                return <ExclamationTriangle className="me-2" />;
            case 'danger':
                return <ExclamationTriangle className="me-2" />;
            default:
                return <InfoCircle className="me-2" />;
        }
    };

    return (
        <div style={{ maxHeight: '350px', overflowY: 'auto' }}>
            {notifications.map((notif) => (
                <Alert
                    key={notif.id}
                    variant={notif.type}
                    dismissible
                    onClose={() => removeNotification(notif.id)}
                    className="mb-3 position-relative"
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                            <Alert.Heading as="h6" className="mb-1 d-flex align-items-center">
                                {getNotificationIcon(notif.type)}
                                {notif.code}
                            </Alert.Heading>
                            <p className="mb-2 small">{notif.message}</p>
                            <small className="text-muted d-flex align-items-center">
                                <Clock size={12} className="me-1" />
                                {notif.timestamp.toLocaleTimeString()}
                            </small>
                        </div>
                    </div>
                </Alert>
            ))}

            {notifications.length === 0 && (
                <div className="text-center py-4 text-muted">
                    <div className="mb-2">
                        <BellSlash size={24} />
                    </div>
                    <small>No hay notificaciones</small>
                </div>
            )}
        </div>
    );
};

export default OrderNotifications;