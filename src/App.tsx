import { useState } from 'react';
import Sidebar from './components/common/Sidebar';
import TopNavbar from './components/common/TopNavbar';
import OrderStatus from './components/OrderStatus/OrderStatus';
import ToastContainer from './components/common/ToastContainer';
import {type ToastContextType, ToastProvider, useToast} from './context/ToastContext';
import './App.scss';


function AppContent() {
    const [activeSection, setActiveSection] = useState('pedidos');
    const { toasts, removeToast, showSuccess, showError, showWarning, showInfo } : ToastContextType = useToast();

    const handleToast = (message: string, type = 'info') => {
        switch (type) {
            case 'success': return showSuccess(message);
            case 'danger': return showError(message);
            case 'warning': return showWarning(message);
            default: return showInfo(message);
        }
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
                    {activeSection === 'pedidos' && (
                        <OrderStatus onToast={handleToast} />
                    )}
                    {activeSection !== 'pedidos' && (
                        <div className="d-flex align-items-center justify-content-center h-100" style={{backgroundColor : 'white'}}>
                            <div className="text-center text-muted">
                                <h3>Sección: {activeSection}</h3>
                                <p>Esta sección estará disponible próximamente</p>
                            </div>
                        </div>
                    )}
                </div>

                <ToastContainer
                    toasts={toasts}
                    onClose={removeToast}
                />
            </div>
        </div>
    );
}

function App() {
    return (
        <ToastProvider>
            <AppContent />
        </ToastProvider>
    );
}

export default App;