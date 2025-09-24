import { useState, useEffect } from 'react';
import Sidebar from './components/common/Sidebar';
import TopNavbar from './components/common/TopNavbar';
import OrderStatus from './components/OrderStatus/OrderStatus';
import Login from './components/Auth/Login';
import ToastContainer, {type ToastType} from './components/common/ToastContainer';
import {type ToastContextType} from './context/toastContext.ts';
import {ToastProvider} from "./context/ToastContext.tsx";
import {useToast} from "./components/hooks/useToast.ts";
import './App.scss';

interface User {
    id: string;
    name?: string;
    type?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string) => void;
    logout: () => void;
    isAuthenticated: boolean;
    isLoading: boolean;
}

function useAuth(): AuthContextType {
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true); // Agregamos estado de carga

    useEffect(() => {
        // Check for stored token on app load
        const checkStoredAuth = async () => {
            try {
                const storedToken = localStorage.getItem('authToken');
                if (storedToken) {
                    // Aquí podrías validar el token con el servidor si es necesario
                    setToken(storedToken);
                    setUser({ id: 'current_user' });
                }
            } catch (error) {
                console.error('Error checking stored auth:', error);
                localStorage.removeItem('authToken');
            } finally {
                setIsLoading(false);
            }
        };

        checkStoredAuth();
    }, []);

    const login = (newToken: string) => {
        setToken(newToken);
        localStorage.setItem('authToken', newToken);
        setUser({ id: 'current_user' });
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('authToken');
    };

    return {
        user,
        token,
        login,
        logout,
        isAuthenticated: !!token && !!user,
        isLoading
    };
}

function AppContent() {
    const [activeSection, setActiveSection] = useState('pedidos');
    const { toasts, removeToast, showSuccess, showError, showWarning, showInfo } : ToastContextType = useToast();
    const { user, isAuthenticated, login, logout, isLoading } = useAuth();

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

    const handleLoginSuccess = (token: string) => {
        login(token);
        showSuccess('Login successful! Welcome to KitchenIQ');
    };

    const handleLogout = () => {
        logout();
        showInfo('You have been logged out');
        setActiveSection('pedidos');
    };

    if (isLoading) {
        return (
            <div className="d-flex align-items-center justify-content-center vh-100" style={{backgroundColor: '#B4E6FF'}}>
                <div className="text-center">
                    <div className="spinner-border text-primary mb-3" role="status">
                        <span className="visually-hidden">Loading...</span>
                    </div>
                    <p>Checking authentication...</p>
                </div>
            </div>
        );
    }

    // Show login screen if not authenticated
    if (!isAuthenticated) {
        return (
            <>
                <Login
                    onLoginSuccess={handleLoginSuccess}
                    apiBaseUrl="http://localhost:5000/kitcheniq/api/v1/auth/login"
                />
                <ToastContainer
                    toasts={mappedToasts}
                    onClose={handleRemoveToast}
                />
            </>
        );
    }

    // Show main app if authenticated
    return (
        <div className="d-flex flex-column vh-100">
            <TopNavbar onLogout={handleLogout} />
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
                                <h3>Section: {activeSection}</h3>
                                <p>This section will be available soon</p>
                            </div>
                        </div>
                    )}
                </div>

                <ToastContainer
                    toasts={mappedToasts}
                    onClose={handleRemoveToast}
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