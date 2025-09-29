import React, { useEffect, useRef } from 'react';
import { getAllSupplierItems } from '../../service/api';
import type { SupplierOrder } from './SupplierStatus';

export type NotificationType = 'success' | 'warning' | 'danger' | 'info';

export interface SupplierNotificationsProps {
    onToast: (msg: string, type?: NotificationType) => void;
}

const SupplierNotifications: React.FC<SupplierNotificationsProps> = ({ onToast }) => {
    // Store last known state of each supplier item
    const lastSupplierStateRef = useRef<Record<number, SupplierOrder>>({});
    // Track if new supplier notification was sent for each item
    const notifiedNewSupplierRef = useRef<Record<number, boolean>>({});
    // Track if unavailable notification was sent for each item
    const notifiedUnavailableRef = useRef<Record<number, boolean>>({});
    // Track if status change notification was sent for each item
    const notifiedStatusChangeRef = useRef<Record<number, string>>({});

    useEffect(() => {
        const checkSupplierStatus = async () => {
            try {
                const response = await getAllSupplierItems();
                const items: SupplierOrder[] = response.data;
                if (!items || !Array.isArray(items) || items.length === 0) return;

                items.forEach(item => {
                    if (item.id == null) return;
                    const prev = lastSupplierStateRef.current[item.id];

                    // New supplier notification
                    if (!prev && !notifiedNewSupplierRef.current[item.id]) {
                        onToast(`New supplier registered: ${item.name}`, 'info');
                        notifiedNewSupplierRef.current[item.id] = true;
                    }

                    // Unavailable supplier notification
                    if (!item.available && !notifiedUnavailableRef.current[item.id]) {
                        onToast(`Supplier unavailable: ${item.name}`, 'warning');
                        notifiedUnavailableRef.current[item.id] = true;
                    }
                    if (item.available) {
                        notifiedUnavailableRef.current[item.id] = false;
                    }

                    // Status change notification
                    if (prev && item.status !== prev.status) {
                        onToast(`Supplier status changed for "${item.name}": ${prev.status} → ${item.status}`, 'info');
                        notifiedStatusChangeRef.current[item.id] = item.status;
                    }

                    lastSupplierStateRef.current[item.id] = { ...item };
                });
            } catch (error) {
                console.error('Error checking suppliers:', error);
            }
        };

        checkSupplierStatus().then(() => {});
        const interval = setInterval(checkSupplierStatus, 600000); // every 10 minutes
        return () => clearInterval(interval);
    }, [onToast]);

    return null;
};

export default SupplierNotifications;
