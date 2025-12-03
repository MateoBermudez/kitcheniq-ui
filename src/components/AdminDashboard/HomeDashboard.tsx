import React, { useCallback, useState, useEffect, useRef } from 'react';
import { Container } from 'react-bootstrap';
import DashboardQuickAccess from './DashboardQuickAccess';
import { AlertItem } from './DashboardNotifications';
import { useToast } from '../hooks/useToast';

const HomeDashboard: React.FC = () => {
    const [alerts, setAlerts] = useState<AlertItem[]>([]);
    const { toasts } = useToast();
    const processedToastIds = useRef<Set<number>>(new Set());

    // Sync toasts to dashboard notifications, avoiding duplicates
    useEffect(() => {
        toasts.forEach(toast => {
            // Skip if we've already processed this toast
            if (processedToastIds.current.has(toast.id)) {
                return;
            }

            if (toast.message) {
                processedToastIds.current.add(toast.id);

                const newAlert: AlertItem = {
                    id: `toast-${toast.id}`,
                    message: toast.title ? `${toast.title}: ${toast.message}` : toast.message,
                    timestamp: new Date().toISOString(),
                    severity: toast.type === 'danger' ? 'critical' : toast.type === 'warning' ? 'warning' : 'info'
                };

                setAlerts(prev => {
                    // Keep only last 5 notifications
                    const updated = [newAlert, ...prev].slice(0, 5);
                    return updated;
                });
            }
        });

        // Clean up processed IDs for toasts that no longer exist
        const currentToastIds = new Set(toasts.map(t => t.id));
        processedToastIds.current.forEach(id => {
            if (!currentToastIds.has(id)) {
                processedToastIds.current.delete(id);
            }
        });
    }, [toasts]);

    const onCloseAlert = useCallback((id: string) => {
        setAlerts(prev => prev.filter(a => a.id !== id));
    }, []);

    return (
        <div style={{ backgroundColor: 'white', minHeight: '100vh', padding: 0 }}>
            <Container fluid>
                <DashboardQuickAccess alerts={alerts} onCloseAlert={onCloseAlert} />
            </Container>
        </div>
    );
};

export default HomeDashboard;
