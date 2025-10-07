import React, { useEffect, useRef } from 'react';
import { getAllInventoryItems } from '../../service/api';
import type {InventoryItem} from './InventoryStatus';

export type NotificationType = 'success' | 'warning' | 'danger' | 'info';

export interface InventoryNotificationsProps {
    onToast: (msg: string, type?: NotificationType) => void;
}

const LOW_STOCK_THRESHOLD = 10;

const InventoryNotifications: React.FC<InventoryNotificationsProps> = ({ onToast }) => {
    // Store last known state of each inventory item
    const lastInventoryStateRef = useRef<Record<number, InventoryItem>>({});
    // Track if low stock notification was sent for each item
    const notifiedLowStockRef = useRef<Record<number, boolean>>({});
    // Track if out of stock notification was sent for each item
    const notifiedOutOfStockRef = useRef<Record<number, boolean>>({});
    // Track if new item notification was sent for each item
    const notifiedNewItemRef = useRef<Record<number, boolean>>({});

    useEffect(() => {
        const checkInventoryStatus = async () => {
            try {
                const response = await getAllInventoryItems();
                const items: InventoryItem[] = response.data;
                if (!items || !Array.isArray(items) || items.length === 0) return;

                items.forEach(item => {
                    if (item.id == null) return;
                    const prev = lastInventoryStateRef.current[item.id];

                    // New item notification
                    if (!prev && !notifiedNewItemRef.current[item.id]) {
                        onToast(`New inventory item: ${item.name}`, 'info');
                        notifiedNewItemRef.current[item.id] = true;
                    }

                    // Low stock notification
                    if (item.stockQuantity > 0 && item.stockQuantity <= LOW_STOCK_THRESHOLD && !notifiedLowStockRef.current[item.id]) {
                        onToast(`Low stock for "${item.name}": only ${item.stockQuantity} left`, 'warning');
                        notifiedLowStockRef.current[item.id] = true;
                    }
                    if (item.stockQuantity > LOW_STOCK_THRESHOLD) {
                        notifiedLowStockRef.current[item.id] = false;
                    }

                    // Out of stock notification
                    if (item.stockQuantity === 0 && !notifiedOutOfStockRef.current[item.id]) {
                        onToast(`"${item.name}" is out of stock!`, 'danger');
                        notifiedOutOfStockRef.current[item.id] = true;
                    }
                    if (item.stockQuantity > 0) {
                        notifiedOutOfStockRef.current[item.id] = false;
                    }

                    // Significant stock change notification
                    if (prev && item.stockQuantity !== prev.stockQuantity) {
                        const diff = item.stockQuantity - prev.stockQuantity;
                        if (Math.abs(diff) >= 5) {
                            onToast(`Stock for "${item.name}" changed by ${diff > 0 ? '+' : ''}${diff} units.`, 'info');
                        }
                    }

                    lastInventoryStateRef.current[item.id] = { ...item };
                });
            } catch (error) {
                console.error('Error checking inventory:', error);
            }
        };

        checkInventoryStatus().then(() => {});
        const interval = setInterval(checkInventoryStatus, 600000); // every 10 minutes
        return () => clearInterval(interval);
    }, [onToast]);

    return null;
};

export default InventoryNotifications;
