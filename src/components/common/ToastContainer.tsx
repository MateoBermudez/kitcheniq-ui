import React from 'react';
import { Toast, ToastContainer as BSToastContainer } from 'react-bootstrap';
import { CheckCircle, XCircle, ExclamationTriangle, InfoCircle } from 'react-bootstrap-icons';

export type ToastType = 'success' | 'danger' | 'warning' | 'info';

export interface ToastItem {
    id: string | number;
    type: ToastType;
    timestamp?: string;
    message?: string;
}

interface ToastContainerProps {
    toasts: ToastItem[];
    onClose: (id: string | number) => void;
    title: string;
    // Optional position: any of Bootstrap ToastContainer positions (e.g. 'bottom-start', 'bottom-end')
    position?:
        | 'top-start' | 'top-center' | 'top-end'
        | 'middle-start' | 'middle-center' | 'middle-end'
        | 'bottom-start' | 'bottom-center' | 'bottom-end';
}

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onClose, title, position = 'bottom-end' }) => {
    const getToastIcon = (type: ToastType) => {
        switch (type) {
            case 'success':
                return <CheckCircle className="me-2" size={18} />;
            case 'danger':
                return <XCircle className="me-2" size={18} />;
            case 'warning':
                return <ExclamationTriangle className="me-2" size={18} />;
            case 'info':
                return <InfoCircle className="me-2" size={18} />;
            default:
                return <InfoCircle className="me-2" size={18} />;
        }
    };

    const getToastStyle = (type: ToastType) => {
        switch (type) {
            case 'success':
                return {
                    header: { backgroundColor: '#d1e7dd', color: '#0f5132' },
                    body: { backgroundColor: '#d1e7dd', color: '#0f5132' }
                };
            case 'danger':
                return {
                    header: { backgroundColor: '#f8d7da', color: '#842029' },
                    body: { backgroundColor: '#f8d7da', color: '#842029' }
                };
            case 'warning':
                return {
                    header: { backgroundColor: '#fff3cd', color: '#856404' },
                    body: { backgroundColor: '#fff3cd', color: '#856404' }
                };
            case 'info':
                return {
                    header: { backgroundColor: '#B1E5FF', color: '#055160' },
                    body: { backgroundColor: '#B1E5FF', color: '#055160' }
                };
            default:
                return {
                    header: { backgroundColor: '#e2e3e5', color: '#383d41' },
                    body: { backgroundColor: '#e2e3e5', color: '#383d41' }
                };
        }
    };

    return (
        <BSToastContainer position={position} className="p-3" style={{ zIndex: 9999 }}>
            {toasts.map((toast) => {
                const toastStyle = getToastStyle(toast.type);

                return (
                    <Toast
                        key={toast.id}
                        onClose={() => onClose(toast.id)}
                        show={true}
                        delay={5000}
                        autohide
                        className="border-0 shadow-sm mb-2"
                    >
                        <Toast.Header style={toastStyle.header}>
                            {getToastIcon(toast.type)}
                            <strong className="me-auto">{title}</strong>
                            <small>{toast.timestamp}</small>
                        </Toast.Header>
                        <Toast.Body style={toastStyle.body}>
                            {toast.message}
                        </Toast.Body>
                    </Toast>
                );
            })}
        </BSToastContainer>
    );
};

export default ToastContainer;
