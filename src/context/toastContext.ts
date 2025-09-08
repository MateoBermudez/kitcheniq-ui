import { createContext } from 'react';

export interface Toast {
    id: number;
    title?: string;
    message: string;
    type: string;
    timestamp: string;
    duration?: number;
}

export interface ToastContextType {
    toasts: Toast[];
    removeToast: (id: number) => void;
    showSuccess: (msg: string | Partial<Toast>) => number;
    showError: (msg: string | Partial<Toast>) => number;
    showWarning: (msg: string | Partial<Toast>) => number;
    showInfo: (msg: string | Partial<Toast>) => number;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);