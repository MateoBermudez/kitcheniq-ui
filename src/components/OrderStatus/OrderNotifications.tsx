import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Button, Collapse, Form } from 'react-bootstrap';
import { BellSlash, InfoCircle, CheckCircle, ExclamationTriangle } from 'react-bootstrap-icons';
import { getAllOrders, type OrderData } from '../../service/api';

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

const DEFAULT_PENDING_WARNING_MIN = 15;
const DEFAULT_PENDING_URGENT_MIN = 30;
const DEFAULT_READY_WARNING_MIN = 15;
const POLL_INTERVAL_MS = 60_000;
const LS_THRESHOLDS_KEY = 'order_notif_thresholds';

const OrderNotifications: React.FC = () => {
    const [notifications, setNotifications] = useState<OrderNotification[]>([]);
    const [showSettings, setShowSettings] = useState(false);
    const [pendingWarningMin, setPendingWarningMin] = useState<number>(DEFAULT_PENDING_WARNING_MIN);
    const [pendingUrgentMin, setPendingUrgentMin] = useState<number>(DEFAULT_PENDING_URGENT_MIN);
    const [readyWarningMin, setReadyWarningMin] = useState<number>(DEFAULT_READY_WARNING_MIN);
    const lastOrderStatesRef = useRef<Record<string, LastOrderState | number>>({});
    const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load persisted thresholds
    useEffect(() => {
        try {
            const raw = localStorage.getItem(LS_THRESHOLDS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.pendingWarningMin) setPendingWarningMin(parsed.pendingWarningMin);
                if (parsed.pendingUrgentMin) setPendingUrgentMin(parsed.pendingUrgentMin);
                if (parsed.readyWarningMin) setReadyWarningMin(parsed.readyWarningMin);
            }
        } catch {}
    }, []);

    const persistThresholds = () => {
        localStorage.setItem(LS_THRESHOLDS_KEY, JSON.stringify({
            pendingWarningMin,
            pendingUrgentMin,
            readyWarningMin
        }));
    };

    const addNotification = useCallback(
        (message: string, type: NotificationType = 'info', title: string | null = null, autoRemove: boolean = true): string => {
            // Deduplicate identical notification within the last 15s
            console.log('Adding notification:', message, type, title);

            // Avoid exact duplicates in the recent past (last 15s)
            const now = Date.now();
            const duplicate = notifications.find(n => n.message === message && n.type === type && (now - n.timestamp.getTime()) < 15000);
            if (duplicate) return duplicate.id;
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
        [notifications]
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
            const response = await getAllOrders() as { data: OrderData[] };
            const orders = response?.data || [];
            if (orders.length === 0) return;
             const currentTime = new Date();
             const currentTimestamp = currentTime.getTime();

             let pendingCount = 0;
             let readyCount = 0;
             let deliveredCount = 0;

             const ordersByTable: { [key: string]: number } = {};

            orders.forEach(order => {
                const orderId = (order.id ?? null) || (order as any).code;
                 if (!orderId) return;

                 const orderStatus = (order.status || '').toUpperCase();
                 const lastKnownState = lastOrderStatesRef.current[orderId] as LastOrderState | undefined;

                 if (orderStatus === 'PENDING') {
                    pendingCount++;
                 } else if (orderStatus === 'READY') {
                    readyCount++;
                 } else if (orderStatus === 'DELIVERED') {
                    deliveredCount++;
                 }

                 const tableNumber = order.tableNumber || extractTableNumber(order as any);
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
                     const timeDiff = (currentTimestamp - lastKnownState.timestamp) / 60000; // minutes elapsed

                    if (timeDiff >= pendingWarningMin && !lastKnownState.notified?.pendingTooLong) {
                         addNotification(
                            `ORD-${orderId} has been pending for over ${pendingWarningMin} minutes.`,
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

                    if (timeDiff >= pendingUrgentMin && !lastKnownState.notified?.highPriority) {
                         addNotification(
                            `URGENT! ORD-${orderId} has been pending for over ${pendingUrgentMin} minutes.`,
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
                     const timeDiff = (currentTimestamp - lastKnownState.timestamp) / 60000; // minutes elapsed

                    if (timeDiff >= readyWarningMin && !lastKnownState.notified?.readyTooLong) {
                         addNotification(
                            `ORD-${orderId} has been ready for over ${readyWarningMin} minutes without being delivered.`,
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
    }, [addNotification, pendingWarningMin, pendingUrgentMin, readyWarningMin]);

    useEffect(() => {
        // Initial load
        checkOrdersStatus().catch(()=>{});

        // Poll aging every minute
        checkIntervalRef.current = setInterval(checkOrdersStatus, POLL_INTERVAL_MS);

        // Real-time event listeners (status transitions + creation)
        const handleStatusChanged = (e: Event) => {
            const detail = (e as CustomEvent).detail as {
                id?: number;
                code?: string;
                previousStatus?: string;
                newStatus?: string;
                deliveryTime?: string;
                timestamp: number;
            };
            if (!detail) return;
            const orderCode = detail.code || (detail.id ? `ORD-${detail.id}` : 'ORDER');
            const newStatus = (detail.newStatus || '').toUpperCase();
            if (newStatus === 'READY') {
                addNotification(`${orderCode} is ready to be delivered.`, 'success', 'Order Ready');
            } else if (newStatus === 'DELIVERED') {
                addNotification(`${orderCode} delivered successfully.`, 'success', 'Order Delivered');
            } else if (newStatus === 'CANCELLED') {
                addNotification(`${orderCode} has been cancelled.`, 'danger', 'Order Cancelled');
            } else if (newStatus === 'IN PROGRESS') {
                addNotification(`${orderCode} is now in progress.`, 'info', 'Order Updated', true);
            }
            // Reset aging baseline on status change
            const key = detail.id ?? orderCode;
            lastOrderStatesRef.current[key] = {
                status: newStatus,
                timestamp: detail.timestamp || Date.now(),
                notified: {
                    pendingTooLong: false,
                    readyTooLong: false,
                    highPriority: false,
                    cancelledNotified: newStatus === 'CANCELLED'
                }
            };
        };
        const handleOrderCreated = (e: Event) => {
            const detail = (e as CustomEvent).detail as { id?: number; code?: string; table?: string | number; timestamp: number };
            if (!detail) return;
            const code = detail.code || (detail.id ? `ORD-${detail.id}` : 'ORDER');
            addNotification(`${code} created successfully.`, 'info', 'Order Created');
            // Initialize baseline for new order
            const key = detail.id ?? code;
            lastOrderStatesRef.current[key] = {
                status: 'PENDING',
                timestamp: detail.timestamp || Date.now(),
                notified: { pendingTooLong: false, readyTooLong: false, highPriority: false, cancelledNotified: false }
            };
        };
        window.addEventListener('order-status-changed', handleStatusChanged as EventListener);
        window.addEventListener('order-created', handleOrderCreated as EventListener);

        return () => {
            if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
            window.removeEventListener('order-status-changed', handleStatusChanged as EventListener);
            window.removeEventListener('order-created', handleOrderCreated as EventListener);
        };
    }, [addNotification, checkOrdersStatus]);

    const removeNotification = (id: string): void => {
         setNotifications(prev => prev.filter(notif => notif.id !== id));
     };

    const clearAll = () => setNotifications([]);

    const handleSaveSettings = (e: React.FormEvent) => {
        e.preventDefault();
        // Basic validation
        if (pendingWarningMin < 1 || pendingUrgentMin <= pendingWarningMin || readyWarningMin < 1) {
            addNotification('Invalid thresholds. Ensure urgent > warning and all > 0.', 'danger', 'Settings Error');
            return;
        }
        persistThresholds();
        addNotification('Notification settings saved.', 'success', 'Preferences', true);
        setShowSettings(false);
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
            <div className="d-flex justify-content-between align-items-center mb-2">
                <h6  className="fw-bold" style={{letterSpacing: '0.5px'}}>NOTIFICATIONS</h6>
                <div className="d-flex gap-2">
                    <Button variant="outline-secondary" size="sm" onClick={() => setShowSettings(s=>!s)}>
                        {showSettings ? 'Close Settings' : 'Settings'}
                    </Button>
                    <Button variant="outline-danger" size="sm" onClick={clearAll} disabled={notifications.length===0}>Clear All</Button>
                </div>
            </div>
            <Collapse in={showSettings}>
                <div className="border rounded p-3 mb-3 bg-light-subtle">
                    <Form onSubmit={handleSaveSettings} className="small">
                        <div className="row g-2">
                            <div className="col-4">
                                <Form.Label className="mb-1">Pending warn (min)</Form.Label>
                                <Form.Control type="number" min={1} value={pendingWarningMin} onChange={e=>setPendingWarningMin(Number(e.target.value))} />
                            </div>
                            <div className="col-4">
                                <Form.Label className="mb-1">Pending urgent (min)</Form.Label>
                                <Form.Control type="number" min={1} value={pendingUrgentMin} onChange={e=>setPendingUrgentMin(Number(e.target.value))} />
                            </div>
                            <div className="col-4">
                                <Form.Label className="mb-1">Ready warn (min)</Form.Label>
                                <Form.Control type="number" min={1} value={readyWarningMin} onChange={e=>setReadyWarningMin(Number(e.target.value))} />
                            </div>
                        </div>
                        <div className="mt-3 d-flex gap-2">
                            <Button type="submit" size="sm" variant="primary" style={{backgroundColor:'#86e5ff', borderColor:'#86e5ff', color:'#000'}}>Save</Button>
                            <Button type="button" size="sm" variant="outline-secondary" onClick={()=>setShowSettings(false)}>Cancel</Button>
                        </div>
                    </Form>
                </div>
            </Collapse>
            {notifications.map((notif) => (
                <Alert
                    key={notif.id}
                    variant={notif.type}
                    dismissible
                    onClose={() => removeNotification(notif.id)}
                    className={`mb-3 position-relative ${notif.type === 'danger' ? 'notif-urgent' : ''}`}
                >
                    <div className="d-flex justify-content-between align-items-start">
                        <div className="flex-grow-1">
                            <Alert.Heading as="h6" className="mb-1 d-flex align-items-center">
                                {getNotificationIcon(notif.type)}
                                {notif.code}
                            </Alert.Heading>
                            <p className="mb-2 small">{notif.message}</p>
                            {/* Timestamp removed intentionally */}
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
