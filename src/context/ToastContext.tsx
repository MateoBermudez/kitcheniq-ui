import { useState, type ReactNode } from 'react';
import {type Toast, ToastContext} from './toastContext.ts';

interface ToastProviderProps {
    children: ReactNode;
}

export const ToastProvider = ({ children }: ToastProviderProps) => {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const addToast = (
        messageOrObject: string | Partial<Toast>,
        typeArg: string = 'info',
        duration: number = 5000
    ): number => {
        const id = Date.now();
        let message: string;
        let type: string = typeArg;
        let title: string | undefined = undefined;
        let toastDuration = duration;

        if (typeof messageOrObject === 'object' && messageOrObject !== null) {
            title = messageOrObject.title;
            message = messageOrObject.message ?? '';
            type = messageOrObject.type ?? typeArg;
            toastDuration = messageOrObject.duration ?? duration;
        } else {
            message = messageOrObject;
        }

        const toast: Toast = {
            id,
            title: title ?? undefined,
            message,
            type,
            timestamp: new Date().toLocaleTimeString(),
            duration: toastDuration,
        };

        setToasts(prev => [...prev, toast]);

        setTimeout(() => {
            removeToast(id);
        }, toastDuration);

        return id;
    };

    const removeToast = (id: number) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };

    const showSuccess = (messageOrObject: string | Partial<Toast>): number => {
        if (typeof messageOrObject === 'object') {
            return addToast({ ...messageOrObject, type: 'success' });
        }
        return addToast(messageOrObject, 'success');
    };

    const showError = (messageOrObject: string | Partial<Toast>): number => {
        if (typeof messageOrObject === 'object') {
            return addToast({ ...messageOrObject, type: 'danger' });
        }
        return addToast(messageOrObject, 'danger');
    };

    const showWarning = (messageOrObject: string | Partial<Toast>): number => {
        if (typeof messageOrObject === 'object') {
            return addToast({ ...messageOrObject, type: 'warning' });
        }
        return addToast(messageOrObject, 'warning');
    };

    const showInfo = (messageOrObject: string | Partial<Toast>): number => {
        if (typeof messageOrObject === 'object') {
            return addToast({ ...messageOrObject, type: 'info' });
        }
        return addToast(messageOrObject, 'info');
    };

    return (
        <ToastContext.Provider value={{
            toasts,
            removeToast,
            showSuccess,
            showError,
            showWarning,
            showInfo,
        }}>
            {children}
        </ToastContext.Provider>
    );
};