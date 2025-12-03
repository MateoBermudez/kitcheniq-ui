import React from 'react';
import { Card, CloseButton } from 'react-bootstrap';

export interface AlertItem {
    id: string;
    message: string;
    timestamp: string;
    severity?: 'info' | 'warning' | 'critical';
}

interface AlertsPanelProps {
    alerts: AlertItem[];
    onCloseAlert: (id: string) => void;
    className?: string;
}

const DashboardNotifications: React.FC<AlertsPanelProps> = ({ alerts, onCloseAlert, className }) => {
    const now = new Date();
    const month = now.toLocaleString('en-US', { month: 'short' });
    const dayNumber = now.toLocaleString('en-US', { day: '2-digit' });
    const weekday = now.toLocaleString('en-US', { weekday: 'short' });

    return (
        <Card className={`border-0 shadow-sm h-100 ${className || ''}`}>
            <Card.Body className="d-flex gap-3">
                {/* Left side: Date */}
                <div style={{ minWidth: 80, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', paddingTop: '0.5rem' }}>
                    <div className="small text-muted">{month}</div>
                    <h2 className="fw-bold mb-0" style={{ fontSize: '2.5rem', lineHeight: 1 }}>{dayNumber}</h2>
                    <div className="small text-muted">{weekday}</div>
                </div>

                {/* Right side: Notifications */}
                <div className="flex-grow-1 d-flex flex-column gap-2" style={{ minHeight: 0 }}>
                    {alerts.length === 0 && (
                        <div className="text-muted small">No notifications</div>
                    )}
                    {alerts.map((a) => (
                        <Card key={a.id} className="border shadow-sm">
                            <Card.Body className="p-2 d-flex align-items-start gap-2">
                                <div className="flex-grow-1">
                                    <div className="small fw-semibold">{a.message}</div>
                                    <div className="small text-muted">{new Date(a.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                                <CloseButton
                                    aria-label={`close-${a.id}`}
                                    onClick={() => onCloseAlert(a.id)}
                                    style={{ fontSize: '0.75rem' }}
                                />
                            </Card.Body>
                        </Card>
                    ))}
                </div>
            </Card.Body>
        </Card>
    );
};

export default DashboardNotifications;
