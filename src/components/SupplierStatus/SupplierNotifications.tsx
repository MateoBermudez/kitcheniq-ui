import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Alert } from 'react-bootstrap';
import { getAllSupplierItems } from '../../service/api';
import type { SupplierOrder } from './SupplierStatus';

export type NotificationType = 'success' | 'warning' | 'danger' | 'info';

export interface SupplierNotificationsProps {
    items: SupplierOrder[];
}

interface Notification {
    id: string;
    msg: string;
    type: NotificationType;
}

const SupplierNotifications: React.FC<SupplierNotificationsProps> = ({ items }) => {
    const lastOrderStateRef = useRef<Record<number, SupplierOrder>>({});
    const [notifications, setNotifications] = useState<Notification[]>([]);

    // Helper function to add a notification (memoized to keep stable reference)
    const addNotification = useCallback((msg: string, type: NotificationType) => {
        setNotifications(prev => [
            ...prev,
            { id: Date.now().toString() + Math.random(), msg, type }
        ]);
    }, []);

    // Function to remove a notification by id
    const removeNotification = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    useEffect(() => {
        // Initial notification logic using items
        if (items && Array.isArray(items)) {
            items.forEach(order => {
                if (order.orderId == null) return;
                const prev = lastOrderStateRef.current[order.orderId];
                // New order
                if (!prev && order.status === 'PENDING') {
                    addNotification(`New order: #${order.orderId} (${order.status})`, 'success');
                }
                // Cancelled order
                if (!prev && order.status === 'CANCELLED') {
                    addNotification(`Order #${order.orderId} was cancelled.`, 'danger');
                }
                lastOrderStateRef.current[order.orderId] = { ...order };
            });
        }
    }, [items, addNotification]);

    useEffect(() => {
        const checkOrderStatus = async () => {
            try {
                const response = await getAllSupplierItems();
                const apiItems: SupplierOrder[] = response.data;
                if (!apiItems || !Array.isArray(apiItems) || apiItems.length === 0) return;

                apiItems.forEach(order => {
                    if (order.orderId == null) return;
                    const prev = lastOrderStateRef.current[order.orderId];

                    // New pending order
                    if (!prev && order.status === 'PENDING') {
                        addNotification(`New pending order: #${order.orderId}`, 'info');
                    }

                    // Relevant status change
                    if (prev && order.status !== prev.status) {
                        let msg: string;
                        let type: NotificationType;
                        switch (order.status) {
                            case 'ACCEPTED':
                                msg = `Order #${order.orderId} was accepted.`;
                                type = 'success';
                                break;
                            case 'DISPATCHING':
                                msg = `Order #${order.orderId} is being dispatched.`;
                                type = 'info';
                                break;
                            case 'DELIVERED':
                                msg = `Order #${order.orderId} was delivered.`;
                                type = 'success';
                                break;
                            case 'CANCELLED':
                                msg = `Order #${order.orderId} was cancelled.`;
                                type = 'danger';
                                break;
                            case 'REJECTED':
                                msg = `Order #${order.orderId} was rejected.`;
                                type = 'danger';
                                break;
                            case 'PENDING':
                                msg = `Order #${order.orderId} returned to pending.`;
                                type = 'warning';
                                break;
                            default:
                                msg = `Order #${order.orderId} changed status: ${prev.status} → ${order.status}`;
                                type = 'info';
                        }
                        addNotification(msg, type);
                    }

                    lastOrderStateRef.current[order.orderId] = { ...order };
                });
            } catch (error) {
                console.error('Error checking supplier orders:', error);
            }
        };

        checkOrderStatus().then(() => {});
        const interval = setInterval(checkOrderStatus, 60000); // every 1 minute
        return () => clearInterval(interval);
    }, [addNotification]);

    return (
        <div>
            {notifications.length === 0 ? (
                <div className="text-muted text-center">No order notifications.</div>
            ) : (
                // show up to 3 visible alerts; enable scroll when there are more
                <div style={{ maxHeight: notifications.length > 3 ? 240 : 'auto', overflowY: notifications.length > 3 ? 'auto' : 'visible' }} className="d-flex flex-column gap-2">
                    {notifications.map(n => (
                        <Alert key={n.id} variant={n.type} dismissible onClose={() => removeNotification(n.id)}>
                            {n.msg}
                        </Alert>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SupplierNotifications;
