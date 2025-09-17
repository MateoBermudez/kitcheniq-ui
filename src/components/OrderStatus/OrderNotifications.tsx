import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-bootstrap';
import { BellSlash, Clock, InfoCircle, CheckCircle, ExclamationTriangle } from 'react-bootstrap-icons';
import { getAllOrders } from '../../service/api';

export type NotificationType = 'success' | 'warning' | 'danger' | 'info';

export interface OrderNotification {
    id: string;
    code: string;
    message: string;
    type: NotificationType;
    timestamp: Date;
}

interface LastOrderState {
    status: string;
    timestamp: number;
    notified: {
        pendingTooLong: boolean;
        readyTooLong: boolean;
        cancelledNotified: boolean;
        highPriority: boolean;
    };
}

interface Order {
    id: number;
    details: string;
    price: number;
    bill: string;
    status: string;
    orderDate: string;
    items: string[];
}

const OrderNotifications: React.FC = () => {
    const [notifications, setNotifications] = useState<OrderNotification[]>([]);
    const lastOrderStatesRef = useRef<Record<string, LastOrderState | number>>({});
    const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const addNotification = useCallback(
        (message: string, type: NotificationType = 'info', title: string | null = null, autoRemove: boolean = true): string => {
            console.log('Adding notification:', message, type, title);

            const newNotification: OrderNotification = {
                id: Date.now().toString(),
                code: title || (type === 'success' ? 'Success' :
                    type === 'warning' ? 'Warning' :
                        type === 'danger' ? 'Error' : 'Information'),
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
        },
        []
    );

    const extractTableNumber = (order: Order): string | number | null => {
        if (order.details && order.details.includes('Table')) {
            const match = order.details.match(/Table\s+(\d+)/i);
            return match ? match[1] : null;
        }
        return null;
    };

    const checkOrdersStatus = useCallback(async (): Promise<void> => {
        try {
            console.log('Checking order status...');
            const orders = await getAllOrders();
            if (!orders || !Array.isArray(orders) || orders.length === 0) {
                console.log('No orders found to check');
                return;
            }

            console.log(`Checking ${orders.length} orders`);
            const currentTime = new Date();
            const currentTimestamp = currentTime.getTime();

            let pendingCount = 0;
            let readyCount = 0;
            let deliveredCount = 0;

            const ordersByTable: { [key: string]: number } = {};

            orders.forEach(order => {
                const orderId = order.id || order.code || order._id;
                if (!orderId) return;

                const orderStatus = (order.status || order.estado || '').toUpperCase();
                const lastKnownState = lastOrderStatesRef.current[orderId] as LastOrderState | undefined;

                if (orderStatus === 'PENDING') {
                    pendingCount++;
                } else if (orderStatus === 'READY') {
                    readyCount++;
                } else if (orderStatus === 'DELIVERED') {
                    deliveredCount++;
                }

                const tableNumber = extractTableNumber(order);
                if (tableNumber && orderStatus !== 'DELIVERED') {
                    ordersByTable[tableNumber] = (ordersByTable[tableNumber] || 0) + 1;
                }

                if (!lastKnownState) {
                    lastOrderStatesRef.current[orderId] = {
                        status: orderStatus,
                        timestamp: currentTimestamp,
                        notified: {
                            pendingTooLong: false,
                            readyTooLong: false,
                            cancelledNotified: false,
                            highPriority: false
                        }
                    };
                    return;
                }

                if (orderStatus === 'READY') {
                    if (lastKnownState.status !== 'READY') {
                        addNotification(
                            `ORD-${orderId} is ready to be delivered.`,
                            'success',
                            'Order Ready'
                        );

                        lastOrderStatesRef.current[orderId] = {
                            ...lastKnownState,
                            status: orderStatus,
                            timestamp: currentTimestamp,
                            notified: {
                                ...lastKnownState.notified,
                                pendingTooLong: false,
                                readyTooLong: false
                            }
                        };
                    }
                }

                if (orderStatus === 'CANCELLED') {
                    if (!lastKnownState.notified?.cancelledNotified) {
                        addNotification(
                            `ORD-${orderId} has been cancelled.`,
                            'danger',
                            'Order Cancelled'
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

                if (orderStatus === 'PENDING') {
                    const timeDiff = (currentTimestamp - lastKnownState.timestamp) / 60000; // in minutes

                    if (timeDiff >= 15 && !lastKnownState.notified?.pendingTooLong) {
                        addNotification(
                            `ORD-${orderId} has been pending for over 15 minutes.`,
                            'warning',
                            'Order Delayed'
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
                            `URGENT! ORD-${orderId} has been pending for over 30 minutes.`,
                            'danger',
                            'Urgent Order'
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

                if (orderStatus === 'READY') {
                    const timeDiff = (currentTimestamp - lastKnownState.timestamp) / 60000; // in minutes

                    if (timeDiff >= 15 && !lastKnownState.notified?.readyTooLong) {
                        addNotification(
                            `ORD-${orderId} has been ready for over 15 minutes without being delivered.`,
                            'warning',
                            'Pending Delivery'
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
                        timestamp: currentTimestamp,
                        notified: {
                            pendingTooLong: false,
                            readyTooLong: false,
                            highPriority: false,
                            cancelledNotified: lastKnownState.notified?.cancelledNotified || false
                        }
                    };
                }
            });

            const lastSummary = typeof lastOrderStatesRef.current['_lastSummary'] === 'number' ? lastOrderStatesRef.current['_lastSummary'] as number : 0;
            if ((currentTimestamp - lastSummary) >= 30 * 60 * 1000) { // 30 minutes
                if (pendingCount > 0 || readyCount > 0) {
                    addNotification(
                        `Summary: ${pendingCount} pending orders, ${readyCount} ready orders, ${deliveredCount} delivered today.`,
                        'info',
                        'Summary'
                    );
                    lastOrderStatesRef.current['_lastSummary'] = currentTimestamp;
                }
            }

            Object.entries(ordersByTable).forEach(([table, quantity]: [string, number]) => {
                const tableKey = `table_${table}`;
                const lastTableNotification = typeof lastOrderStatesRef.current[tableKey] === 'number' ? lastOrderStatesRef.current[tableKey] as number : 0;

                if ((quantity > 1) && (currentTimestamp - lastTableNotification) >= 15 * 60 * 1000) {
                    addNotification(
                        `Table ${table} has ${quantity} active orders.`,
                        'info',
                        'Active Table'
                    );

                    lastOrderStatesRef.current[tableKey] = currentTimestamp;
                }
            });

        } catch (error) {
            console.error('Error checking order status:', error);
        }
    }, [addNotification]);

    useEffect(() => {
        (async () => {
            try {
                await checkOrdersStatus();
            } catch (error) {
                console.error('Check Order Status Error:', error);
            }
        })();

        checkIntervalRef.current = setInterval(checkOrdersStatus, 600000);

        return () => {
            if (checkIntervalRef.current) {
                clearInterval(checkIntervalRef.current);
            }
        };
    }, [checkOrdersStatus]);

    const removeNotification = (id: string): void => {
        setNotifications(prev => prev.filter(notif => notif.id !== id));
    };

    const getNotificationIcon = (type: NotificationType) => {
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
                    <small>No notifications</small>
                </div>
            )}
        </div>
    );
};

export default OrderNotifications;
