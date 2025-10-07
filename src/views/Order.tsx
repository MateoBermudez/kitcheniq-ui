import { useState } from 'react';
import Sidebar from '../components/common/Sidebar.tsx';
import TopNavbar from '../components/common/TopNavbar.tsx';
import OrderStatus from '../components/OrderStatus/OrderStatus.tsx';
import ToastContainer, {type ToastType} from '../components/common/ToastContainer.tsx';
import {type ToastContextType} from '../context/toastContext.ts';
import {ToastProvider} from "../context/ToastContext.tsx";
import {useToast} from "../components/hooks/useToast.ts";
import '../App.scss';


function AppContent() {
    const [activeSection, setActiveSection] = useState('orders');
    const { toasts, removeToast, showSuccess, showError, showWarning, showInfo } : ToastContextType = useToast();

    const handleToast = (message: string, type = 'info') => {
        switch (type) {
            case 'success': return showSuccess(message);
            case 'danger': return showError(message);
            case 'warning': return showWarning(message);
            default: return showInfo(message);
        }
    };

    const mappedToasts = toasts.map(t => ({
        ...t,
        type: t.type as ToastType
    }));

    const handleRemoveToast = (id: string | number) => {
        removeToast(typeof id === 'string' ? Number(id) : id);
    };

    return (
        <div className="d-flex flex-column vh-100">
            <TopNavbar />
            <div className="d-flex flex-grow-1">
                <Sidebar
                    activeSection={activeSection}
                    onSectionChange={setActiveSection}
                />

                <div className="flex-grow-1">
                    {activeSection === 'orders' && (
                        <OrderStatus onToast={handleToast} />
                    )}
                    {activeSection !== 'orders' && (
                        <div className="d-flex align-items-center justify-content-center h-100" style={{backgroundColor : 'white'}}>
                            <div className="text-center text-muted">
                                <h3>Section: {activeSection}</h3>
                                <p>This section will be available soon.</p>
                            </div>
                        </div>
                    )}
                </div>

                <ToastContainer
                    toasts={mappedToasts}
                    onClose={handleRemoveToast}
                    title={"Orders"}
                />
            </div>
        </div>
    );
}

function Order() {
    return (
        <ToastProvider>
            <AppContent />
        </ToastProvider>
    );
}

export default Order;