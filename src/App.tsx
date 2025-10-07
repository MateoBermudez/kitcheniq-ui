import { useState, useEffect, createContext, useContext, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/common/Sidebar';
import TopNavbar from './components/common/TopNavbar';
import OrderStatus from './components/OrderStatus/OrderStatus';
import Login from './components/Auth/Login';
import ToastContainer, {type ToastType} from './components/common/ToastContainer';
import {type ToastContextType} from './context/toastContext.ts';
import {ToastProvider} from "./context/ToastContext.tsx";
import {useToast} from "./components/hooks/useToast.ts";
import Inventory from './views/Inventory';
import Supplier from "./views/Supplier.tsx";
import './App.scss';
import { getUserInfo } from './service/api';

interface User {
    id: string;
    name?: string;
    type?: string; // ALWAYS stored uppercase
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, userData?: { name?: string; type?: string; id?: string }) => void;
    logout: () => void;
    isAuthenticated: boolean;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

function normalizeType(type?: string): string | undefined {
    return type ? type.toUpperCase() : undefined;
}

function AuthProvider({ children }: { children: ReactNode }) {
    // State for auth token, user object and loading indicator
    const [token, setToken] = useState<string | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const checkStoredAuth = async () => {
            try {
                const storedToken = localStorage.getItem('authToken');
                const storedUserData = localStorage.getItem('userData');
                const lastUserId = localStorage.getItem('lastUserId');
                if (storedToken) {
                    setToken(storedToken);
                    let userData = storedUserData ? JSON.parse(storedUserData) : {};

                    // If name or type missing, try refreshing from backend
                    if ((!userData.name || !userData.type) && lastUserId) {
                        try {
                            const info = await getUserInfo(lastUserId);
                            userData = {
                                ...userData,
                                id: info.id || info.userId || lastUserId,
                                name: info.name || info.username || userData.name,
                                type: normalizeType(info.type || info.role || userData.type)
                            };
                            localStorage.setItem('userData', JSON.stringify(userData));
                        } catch (e) {
                            console.warn('Could not refresh user info:', e);
                        }
                    } else if (userData.type) {
                        // Ensure normalization if already present
                        userData.type = normalizeType(userData.type);
                        localStorage.setItem('userData', JSON.stringify(userData));
                    }

                    setUser({
                        id: userData.id || 'current_user',
                        name: userData.name,
                        type: userData.type
                    });
                } else {
                    setToken(null);
                    setUser(null);
                }
            } catch (error) {
                console.error('Error checking auth:', error);
                setToken(null);
                setUser(null);
                localStorage.removeItem('authToken');
                localStorage.removeItem('userData');
            } finally {
                setIsLoading(false);
            }
        };

        checkStoredAuth();
    }, []);

    const login = (newToken: string, userData?: { name?: string; type?: string; id?: string }) => {
        setToken(newToken);
        localStorage.setItem('authToken', newToken);

        const normalizedType = normalizeType(userData?.type);
        const userInfo = {
            id: userData?.id || 'current_user',
            name: userData?.name,
            type: normalizedType
        };

        setUser(userInfo);

        if (userData) {
            localStorage.setItem('userData', JSON.stringify({ ...userData, type: normalizedType }));
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('userData');
    };

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            logout,
            isAuthenticated: !!token && !!user,
            isLoading
        }}>
            {children}
        </AuthContext.Provider>
    );
}

function useAuth(): AuthContextType {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}

function MainLayout() {
    const { toasts, removeToast, showInfo, showSuccess } : ToastContextType = useToast();
    const { logout, user } = useAuth();
    const location = useLocation();
    const [activeSection, setActiveSection] = useState('orders');

    const isSupplierUser = user?.type === 'SUPPLIER';

    // Only derive active section from current path (no redirect logic here to avoid loops)
    useEffect(() => {
        const path = location.pathname;
        if (path.includes('/orders')) setActiveSection('orders');
        else if (path.includes('/inventory')) setActiveSection('inventory');
        else if (path.includes('/supplier')) setActiveSection('supplier');
        else if (path.includes('/menu')) setActiveSection('menu');
        else if (path.includes('/staff')) setActiveSection('staff');
        else if (path.includes('/cash')) setActiveSection('cash');
        else if (path.includes('/sales')) setActiveSection('sales');
        else if (path.includes('/expenses')) setActiveSection('expenses');
        else if (path.includes('/reports')) setActiveSection('reports');
        else if (path.includes('/home')) setActiveSection('home');
    }, [location.pathname]);

    const mappedToasts = toasts.map(t => ({
        ...t,
        type: t.type as ToastType
    }));

    const handleRemoveToast = (id: string | number) => {
        removeToast(typeof id === 'string' ? Number(id) : id);
    };

    const handleLogout = () => {
        logout();
        showInfo('You have been logged out');
    };

    const handleSectionChange = (section: string) => {
        setActiveSection(section);
    };

    return (
        <div className="d-flex flex-column vh-100">
            <TopNavbar onLogout={handleLogout} />
            <div className="d-flex flex-grow-1">
                <Sidebar
                    activeSection={activeSection}
                    onSectionChange={handleSectionChange}
                    userName={user?.name}
                    userType={user?.type}
                />
                <div className="flex-grow-1">
                    {isSupplierUser ? (
                        <Routes>
                            <Route path="/supplier" element={<Supplier key="supplier" />} />
                            <Route path="*" element={<Navigate to="/supplier" replace />} />
                        </Routes>
                    ) : (
                        <Routes>
                            <Route path="/" element={<Navigate to="/orders" replace />} />
                            <Route path="/home" element={<div>Home Page</div>} />
                            <Route path="/orders" element={
                                <OrderStatus key="orders" onToast={(message: string) => showSuccess(message)} />
                            } />
                            <Route path="/inventory" element={<Inventory key="inventory" />} />
                            <Route path="/supplier" element={<Supplier key="supplier" />} />
                            <Route path="/menu" element={<div key="menu">Menu Page</div>} />
                            <Route path="/staff" element={<div key="staff">Staff Page</div>} />
                            <Route path="/cash" element={<div key="cash">Cash Register Page</div>} />
                            <Route path="/sales" element={<div key="sales">Sales Page</div>} />
                            <Route path="/expenses" element={<div key="expenses">Expenses Page</div>} />
                            <Route path="/reports" element={<div key="reports">Reports Page</div>} />
                            <Route path="*" element={<Navigate to="/orders" replace />} />
                        </Routes>
                    )}
                </div>
                <ToastContainer
                    toasts={mappedToasts}
                    onClose={handleRemoveToast}
                    title="Notifications"
                />
            </div>
        </div>
    );
}

function AppContent() {
    const { toasts, removeToast, showSuccess } : ToastContextType = useToast();
    const { isAuthenticated, login, isLoading, user, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();

    const mappedToasts = toasts.map(t => ({
        ...t,
        type: t.type as ToastType
    }));

    const handleRemoveToast = (id: string | number) => {
        removeToast(typeof id === 'string' ? Number(id) : id);
    };

    const handleLoginSuccess = (token: string, userData?: { name?: string; type?: string; id?: string }) => {
        login(token, userData);
        const incomingType = (userData?.type || '').toUpperCase();
        const destination = incomingType === 'SUPPLIER' ? '/supplier' : '/orders';
        // Slight delay to ensure context state committed before navigation
        setTimeout(() => {
            navigate(destination, { replace: true });
            showSuccess('Login successful! Welcome to KitchenIQ');
        }, 50);
    };

    // Centralized redirect logic to avoid loops
    useEffect(() => {
        if (!isAuthenticated || isLoading) return;
        const current = location.pathname;
        const supplier = user?.type === 'SUPPLIER';
        if (supplier && current !== '/supplier') {
            navigate('/supplier', { replace: true });
            return;
        }
        if (!supplier) {
            if (current === '/' || current === '/login') {
                navigate('/orders', { replace: true });
            }
        }
    }, [isAuthenticated, isLoading, user?.type, location.pathname, navigate]);

    // Listen for global auth-expired event (401 from API)
    useEffect(() => {
        const handler = () => {
            logout();
            navigate('/login', { replace: true });
        };
        window.addEventListener('auth-expired', handler);
        return () => window.removeEventListener('auth-expired', handler);
    }, [logout, navigate]);

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
                    title="Authentication"
                />
            </>
        );
    }

    return <MainLayout />;
}

function App() {
    return (
        <AuthProvider>
            <ToastProvider>
                <BrowserRouter>
                    <AppContent />
                </BrowserRouter>
            </ToastProvider>
        </AuthProvider>
    );
}

export default App;
