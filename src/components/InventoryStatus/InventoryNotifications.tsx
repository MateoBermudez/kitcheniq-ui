import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Alert, Button, Collapse, Form } from 'react-bootstrap';
import { BellSlash, InfoCircle, CheckCircle, ExclamationTriangle, BoxSeam } from 'react-bootstrap-icons';
import { getAllInventoryItems } from '../../service/api';
import type { InventoryItem } from './InventoryStatus';

export type NotificationType = 'success' | 'warning' | 'danger' | 'info';

export interface InventoryNotification {
    id: string;
    itemName: string;
    message: string;
    type: NotificationType;
    timestamp: Date;
}

interface LastInventoryState {
    quantity: number;
    timestamp: number;
    notified: {
        lowStock: boolean;
        outOfStock: boolean;
        purchaseOrderSent: boolean;
    };
}

const DEFAULT_LOW_STOCK_THRESHOLD = 10;
const DEFAULT_CRITICAL_STOCK_THRESHOLD = 5;
const POLL_INTERVAL_MS = 30_000; // Check every 30 seconds for more responsive notifications
const LS_THRESHOLDS_KEY = 'inventory_notif_thresholds';

const InventoryNotifications: React.FC = () => {
    const [notifications, setNotifications] = useState<InventoryNotification[]>([]);
    const [showSettings, setShowSettings] = useState(false);
    const [lowStockThreshold, setLowStockThreshold] = useState<number>(DEFAULT_LOW_STOCK_THRESHOLD);
    const [criticalStockThreshold, setCriticalStockThreshold] = useState<number>(DEFAULT_CRITICAL_STOCK_THRESHOLD);
    const lastInventoryStatesRef = useRef<Record<string, LastInventoryState>>({});
    const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Load persisted thresholds
    useEffect(() => {
        try {
            const raw = localStorage.getItem(LS_THRESHOLDS_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (parsed.lowStockThreshold) setLowStockThreshold(parsed.lowStockThreshold);
                if (parsed.criticalStockThreshold) setCriticalStockThreshold(parsed.criticalStockThreshold);
            }
        } catch (error) {
            console.error('Error loading inventory notification thresholds from localStorage:', error);
        }
    }, []);

    const persistThresholds = () => {
        localStorage.setItem(LS_THRESHOLDS_KEY, JSON.stringify({
            lowStockThreshold,
            criticalStockThreshold
        }));
    };

    const addNotification = useCallback(
        (message: string, type: NotificationType = 'info', itemName: string = '', autoRemove: boolean = true): string => {
            console.log('Adding inventory notification:', message, type, itemName);

            // Avoid exact duplicates in the recent past (last 30s)
            const now = Date.now();
            const duplicate = notifications.find(n =>
                n.message === message &&
                n.type === type &&
                (now - n.timestamp.getTime()) < 30000
            );
            if (duplicate) return duplicate.id;

            const newNotification: InventoryNotification = {
                id: `inv-${Date.now()}-${Math.random()}`,
                itemName: itemName || 'Inventory',
                message,
                type,
                timestamp: new Date()
            };

            setNotifications(prev => [newNotification, ...prev]);

            if (autoRemove) {
                setTimeout(() => {
                    setNotifications(prev => prev.filter(notif => notif.id !== newNotification.id));
                }, 10000); // Auto-remove after 10 seconds
            }

            return newNotification.id;
        },
        [notifications]
    );

    const sendPurchaseOrderToSupplier = useCallback((item: InventoryItem): void => {
        const currentDate = new Date();
        const formattedDate = currentDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = currentDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit'
        });

        // Simulate sending purchase order to supplier
        console.log('Purchase Order Request:', {
            productName: item.name,
            baseQuantity: item.baseQuantity,
            currentQuantity: item.stockQuantity,
            supplier: item.category,
            requestDate: formattedDate,
            requestTime: formattedTime
        });

        addNotification(
            `Purchase order sent to supplier for "${item.name}". Requested: ${item.baseQuantity} units. Current stock: ${item.stockQuantity}. Date: ${formattedDate} at ${formattedTime}.`,
            'info',
            item.name,
            false // Don't auto-remove purchase orders
        );

        // Dispatch custom event for purchase order
        window.dispatchEvent(new CustomEvent('purchase-order-sent', {
            detail: {
                itemId: item.id,
                itemName: item.name,
                baseQuantity: item.baseQuantity,
                currentQuantity: item.stockQuantity,
                supplier: item.category,
                timestamp: currentDate.getTime()
            }
        }));
    }, [addNotification]);

    const checkInventoryStatus = useCallback(async (): Promise<void> => {
        try {
            const response = await getAllInventoryItems();
            const items: InventoryItem[] = response.data || [];
            console.log('Checking inventory status. Total items:', items.length);
            if (items.length === 0) return;

            const currentTime = Date.now();

            items.forEach(item => {
                if (item.id == null) return;

                const itemKey = `item_${item.id}`;
                let lastKnownState = lastInventoryStatesRef.current[itemKey];

                const currentQuantity = item.stockQuantity ?? 0;
                console.log(`Item: ${item.name}, Quantity: ${currentQuantity}, LowThreshold: ${lowStockThreshold}, CriticalThreshold: ${criticalStockThreshold}`);

                // Initialize state for new items
                const isNewItem = !lastKnownState;
                if (isNewItem) {
                    console.log(`New item detected: ${item.name} with quantity ${currentQuantity}`);
                    lastKnownState = {
                        quantity: currentQuantity,
                        timestamp: currentTime,
                        notified: {
                            lowStock: false,
                            outOfStock: false,
                            purchaseOrderSent: false
                        }
                    };
                    lastInventoryStatesRef.current[itemKey] = lastKnownState;
                    // Don't return - continue to check if this new item needs notifications
                }

                // Critical stock - Out of stock
                if (currentQuantity === 0 && !lastKnownState.notified.outOfStock) {
                    addNotification(
                        `"${item.name}" is OUT OF STOCK! Immediate action required.`,
                        'danger',
                        item.name,
                        false
                    );

                    if (!lastKnownState.notified.purchaseOrderSent) {
                        sendPurchaseOrderToSupplier(item);
                        lastInventoryStatesRef.current[itemKey] = {
                            ...lastKnownState,
                            notified: {
                                ...lastKnownState.notified,
                                outOfStock: true,
                                purchaseOrderSent: true
                            }
                        };
                    } else {
                        lastInventoryStatesRef.current[itemKey] = {
                            ...lastKnownState,
                            notified: {
                                ...lastKnownState.notified,
                                outOfStock: true
                            }
                        };
                    }
                }

                // Critical stock level
                if (currentQuantity > 0 && currentQuantity <= criticalStockThreshold) {
                    if (!lastKnownState.notified.outOfStock) {
                        addNotification(
                            `CRITICAL: "${item.name}" has only ${currentQuantity} units left!`,
                            'danger',
                            item.name
                        );

                        if (!lastKnownState.notified.purchaseOrderSent) {
                            sendPurchaseOrderToSupplier(item);
                            lastInventoryStatesRef.current[itemKey] = {
                                ...lastKnownState,
                                notified: {
                                    ...lastKnownState.notified,
                                    outOfStock: true,
                                    purchaseOrderSent: true
                                }
                            };
                        }
                    }
                }

                // Low stock notification
                if (currentQuantity > criticalStockThreshold &&
                    currentQuantity <= lowStockThreshold &&
                    !lastKnownState.notified.lowStock) {
                    addNotification(
                        `Low stock alert for "${item.name}": ${currentQuantity} units remaining.`,
                        'warning',
                        item.name
                    );

                    if (!lastKnownState.notified.purchaseOrderSent) {
                        sendPurchaseOrderToSupplier(item);
                        lastInventoryStatesRef.current[itemKey] = {
                            ...lastKnownState,
                            notified: {
                                ...lastKnownState.notified,
                                lowStock: true,
                                purchaseOrderSent: true
                            }
                        };
                    } else {
                        lastInventoryStatesRef.current[itemKey] = {
                            ...lastKnownState,
                            notified: {
                                ...lastKnownState.notified,
                                lowStock: true
                            }
                        };
                    }
                }

                // Reset notifications when stock is replenished
                if (currentQuantity > lowStockThreshold) {
                    lastInventoryStatesRef.current[itemKey] = {
                        quantity: currentQuantity,
                        timestamp: currentTime,
                        notified: {
                            lowStock: false,
                            outOfStock: false,
                            purchaseOrderSent: false
                        }
                    };
                }

                // Significant stock increase (replenishment detected)
                // Only check for restocks if this is not a newly initialized item
                if (!isNewItem && lastKnownState.quantity < currentQuantity) {
                    const diff = currentQuantity - lastKnownState.quantity;
                    if (diff >= 10) {
                        addNotification(
                            `"${item.name}" restocked! Added ${diff} units. New quantity: ${currentQuantity}.`,
                            'success',
                            item.name
                        );
                    }
                }

                // Update quantity tracking (only if not a new item, to avoid overwriting initial state)
                if (!isNewItem && currentQuantity !== lastKnownState.quantity) {
                    lastInventoryStatesRef.current[itemKey] = {
                        ...lastKnownState,
                        quantity: currentQuantity,
                        timestamp: currentTime
                    };
                }
            });

        } catch (error) {
            console.error('Error checking inventory status:', error);
        }
    }, [addNotification, sendPurchaseOrderToSupplier, lowStockThreshold, criticalStockThreshold]);

    useEffect(() => {
        // Initial check
        checkInventoryStatus().catch(() => {});

        // Poll every 2 minutes
        checkIntervalRef.current = setInterval(checkInventoryStatus, POLL_INTERVAL_MS);

        // Listen for real-time inventory events
        const handleItemAdded = (e: Event) => {
            const detail = (e as CustomEvent).detail as {
                itemId?: number;
                itemName?: string;
                quantity?: number;
                timestamp: number
            };
            if (!detail) return;

            const itemName = detail.itemName || 'New Product';
            addNotification(
                `New product added: "${itemName}" with ${detail.quantity || 0} units.`,
                'success',
                itemName
            );

            // Initialize tracking for new item
            if (detail.itemId) {
                lastInventoryStatesRef.current[`item_${detail.itemId}`] = {
                    quantity: detail.quantity || 0,
                    timestamp: detail.timestamp || Date.now(),
                    notified: {
                        lowStock: false,
                        outOfStock: false,
                        purchaseOrderSent: false
                    }
                };
            }
        };

        const handleStockUpdated = (e: Event) => {
            const detail = (e as CustomEvent).detail as {
                itemId?: number;
                itemName?: string;
                previousQuantity?: number;
                newQuantity?: number;
                timestamp: number;
            };
            if (!detail) return;

            const itemName = detail.itemName || 'Product';
            const diff = (detail.newQuantity || 0) - (detail.previousQuantity || 0);

            if (diff > 0) {
                addNotification(
                    `Stock increased for "${itemName}": +${diff} units (Total: ${detail.newQuantity}).`,
                    'info',
                    itemName
                );
            } else if (diff < 0) {
                addNotification(
                    `Stock decreased for "${itemName}": ${diff} units (Total: ${detail.newQuantity}).`,
                    'info',
                    itemName
                );
            }

            // Update tracking
            if (detail.itemId) {
                const itemKey = `item_${detail.itemId}`;
                const current = lastInventoryStatesRef.current[itemKey];
                if (current) {
                    lastInventoryStatesRef.current[itemKey] = {
                        ...current,
                        quantity: detail.newQuantity || 0,
                        timestamp: detail.timestamp || Date.now()
                    };
                }
            }
        };

        window.addEventListener('inventory-item-added', handleItemAdded as EventListener);
        window.addEventListener('inventory-stock-updated', handleStockUpdated as EventListener);

        return () => {
            if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
            window.removeEventListener('inventory-item-added', handleItemAdded as EventListener);
            window.removeEventListener('inventory-stock-updated', handleStockUpdated as EventListener);
        };
    }, [addNotification, checkInventoryStatus]);

    const removeNotification = (id: string): void => {
        setNotifications(prev => prev.filter(notif => notif.id !== id));
    };

    const clearAll = () => setNotifications([]);

    const handleSaveSettings = (e: React.FormEvent) => {
        e.preventDefault();
        if (criticalStockThreshold < 1 || lowStockThreshold <= criticalStockThreshold) {
            addNotification(
                'Invalid thresholds. Low stock must be greater than critical stock and both > 0.',
                'danger',
                'Settings'
            );
            return;
        }
        persistThresholds();
        addNotification('Inventory notification settings saved.', 'success', 'Settings', true);
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
                <h6 className="fw-bold" style={{ letterSpacing: '0.5px' }}>
                    <BoxSeam className="me-2" />
                    INVENTORY ALERTS
                </h6>
                <div className="d-flex gap-2">
                    <Button
                        variant="outline-primary"
                        size="sm"
                        onClick={() => {
                            console.log('Manual check triggered');
                            checkInventoryStatus();
                        }}
                    >
                        Check Now
                    </Button>
                    <Button variant="outline-secondary" size="sm" onClick={() => setShowSettings(s => !s)}>
                        {showSettings ? 'Close Settings' : 'Settings'}
                    </Button>
                    <Button variant="outline-danger" size="sm" onClick={clearAll} disabled={notifications.length === 0}>
                        Clear All
                    </Button>
                </div>
            </div>

            <Collapse in={showSettings}>
                <div className="border rounded p-3 mb-3 bg-light-subtle">
                    <Form onSubmit={handleSaveSettings} className="small">
                        <div className="row g-2">
                            <div className="col-6">
                                <Form.Label className="mb-1">Critical Stock Threshold</Form.Label>
                                <Form.Control
                                    type="number"
                                    min={1}
                                    value={criticalStockThreshold}
                                    onChange={e => setCriticalStockThreshold(Number(e.target.value))}
                                />
                                <Form.Text className="text-muted">Send urgent purchase order</Form.Text>
                            </div>
                            <div className="col-6">
                                <Form.Label className="mb-1">Low Stock Threshold</Form.Label>
                                <Form.Control
                                    type="number"
                                    min={1}
                                    value={lowStockThreshold}
                                    onChange={e => setLowStockThreshold(Number(e.target.value))}
                                />
                                <Form.Text className="text-muted">Send warning</Form.Text>
                            </div>
                        </div>
                        <div className="mt-3 d-flex gap-2">
                            <Button
                                type="submit"
                                size="sm"
                                variant="primary"
                                style={{ backgroundColor: '#86e5ff', borderColor: '#86e5ff', color: '#000' }}
                            >
                                Save
                            </Button>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline-secondary"
                                onClick={() => setShowSettings(false)}
                            >
                                Cancel
                            </Button>
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
                                {notif.itemName}
                            </Alert.Heading>
                            <p className="mb-2 small">{notif.message}</p>
                            <small className="text-muted">
                                {notif.timestamp.toLocaleTimeString('en-US', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
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
                    <small>No inventory alerts</small>
                </div>
            )}
        </div>
    );
};

export default InventoryNotifications;
