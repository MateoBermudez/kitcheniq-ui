import axios from 'axios';
import type {InventoryItem} from "../components/InventoryStatus/InventoryStatus.tsx";

// Ambos usan el mismo puerto ahora
const API_BASE_URL = 'http://localhost:5000';
const ORDERS_API_BASE_URL = 'http://localhost:5000/kitcheniq/api/v1';

export interface OrderComponentData {
    id: number;
    type?: string;
    name?: string;
    quantity?: number;
    productId?: number;
    productName?: string;
    productPrice?: number;
}

// Type for Order Data
export interface OrderData {
    id: number | null;
    details: string;
    components: OrderComponentData[];
    deliveryTime: string | null;
    requestTime: string | null;
    requestingClient?: string; // ahora opcional
    table: string;
    code?: string;
    status?: string;
    totalPrice?: number; // agregado
    orderBill?: string;  // agregado
    tableNumber?: number; // agregado
}

// Backend response from Spring Boot
interface OrderResponseDTO {
    orderId: number;
    totalPrice: number;
    orderBill: string;
    orderDate: string;
    orderStatus: string;
    tableNumber?: number;
    requestTime?: string;
    deliverTime?: string | null;
}

export interface SupplierItem {
    id: number | null;
    name: string;
    description: string;
    available: boolean;
    status: string;
    requestDay: string;
    cost: number;
}

// Auth interfaces
export interface LoginRequest {
    username: string;
    password: string;
}

export interface RegisterRequest {
    username: string;
    password: string;
    firstname: string;
    lastname: string;
    country: string;
}

export interface AuthResponse {
    token: string;
}

// ==================== TOKEN MANAGEMENT ====================

const TOKEN_KEY = 'jwt_token';

export const setAuthToken = (token: string) => {
    localStorage.setItem(TOKEN_KEY, token);
};

export const getAuthToken = (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
};

export const removeAuthToken = () => {
    localStorage.removeItem(TOKEN_KEY);
};

export const isAuthenticated = (): boolean => {
    return getAuthToken() !== null;
};

// ==================== API CLIENTS ====================

// Cliente para inventario y proveedores
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Cliente para órdenes (Spring Boot)
const ordersApiClient = axios.create({
    baseURL: ORDERS_API_BASE_URL,
    timeout: 20000, // aumentado de 10000 a 20000 ms
    headers: {
        'Content-Type': 'application/json',
    },
});

// Interceptor para agregar token JWT a las peticiones
apiClient.interceptors.request.use(
    (config) => {
        const token = getAuthToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        console.log('API Request:', config.method?.toUpperCase(), config.url);
        return config;
    },
    (error) => {
        console.error('Request Error:', error);
        return Promise.reject(error);
    }
);

ordersApiClient.interceptors.request.use(
    (config) => {
        const token = getAuthToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        console.log('Orders API Request:', config.method?.toUpperCase(), config.url);
        return config;
    },
    (error) => {
        console.error('Orders Request Error:', error);
        return Promise.reject(error);
    }
);

// Interceptor para manejar errores de autenticación
const handleAuthError = (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
        removeAuthToken();
        window.location.href = '/login'; // Redirigir al login
    }
    return Promise.reject(error);
};

apiClient.interceptors.response.use(
    (response) => response,
    handleAuthError
);

ordersApiClient.interceptors.response.use(
    (response) => response,
    handleAuthError
);

// ==================== AUTH OPERATIONS ====================

export const login = async (credentials: LoginRequest): Promise<AuthResponse> => {
    try {
        const response = await ordersApiClient.post<AuthResponse>('/auth/login', credentials);
        if (response.data.token) {
            setAuthToken(response.data.token);
        }
        return response.data;
    } catch (error) {
        console.error('Error during login:', error);
        throw error;
    }
};

export const register = async (userData: RegisterRequest): Promise<AuthResponse> => {
    try {
        const response = await ordersApiClient.post<AuthResponse>('/auth/register', userData);
        if (response.data.token) {
            setAuthToken(response.data.token);
        }
        return response.data;
    } catch (error) {
        console.error('Error during registration:', error);
        throw error;
    }
};

export const logout = () => {
    removeAuthToken();
    window.location.href = '/login';
};

// ==================== HELPER FUNCTIONS ====================

// Función helper para mapear respuesta del backend al formato frontend
// Función helper para mapear respuesta del backend al formato frontend
const mapBackendToFrontend = (backendOrder: OrderResponseDTO, requestTime?: string): OrderData => {
    // Formatear tiempo ISO del backend a formato local
    const formatBackendTime = (isoString: string | null | undefined): string | null => {
        if (!isoString) return null;
        try {
            const date = new Date(isoString);
            // Verificar si la fecha es válida
            if (isNaN(date.getTime())) return null;
            return date.toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false
            });
        } catch {
            return null;
        }
    };

    const backendRequestTime = formatBackendTime(backendOrder.requestTime);
    const backendDeliveryTime = formatBackendTime(backendOrder.deliverTime);

    // Manejar orderDate que puede ser solo fecha o timestamp completo
    let defaultRequestTime = 'N/A';
    if (backendOrder.orderDate) {
        if (backendOrder.orderDate.length > 10) {
            // Es un timestamp completo
            const orderDate = new Date(backendOrder.orderDate);
            if (!isNaN(orderDate.getTime())) {
                defaultRequestTime = orderDate.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            }
        }
        // Si es solo fecha (formato YYYY-MM-DD), dejar como 'N/A'
    }

    const tableNumber = backendOrder.tableNumber || 0;
    const tableDisplay = tableNumber > 0 ? String(tableNumber) : 'N/A';

    // Mapear estados del backend incluyendo SERVED y manejando null
    const mapStatus = (status: string | null | undefined): string => {
        if (!status) return 'PENDING';  // Por defecto si es null
        const statusMap: Record<string, string> = {
            'PENDING': 'PENDING',
            'IN_PROGRESS': 'IN_PROGRESS',
            'READY': 'READY',
            'COMPLETED': 'READY',    // compatibilidad backend
            'DELIVERED': 'DELIVERED',
            'SERVED': 'DELIVERED',   // SERVED se mapea a DELIVERED
            'CANCELLED': 'CANCELLED'
        };
        return statusMap[status.toUpperCase()] || 'PENDING';
    };

    return {
        id: backendOrder.orderId,
        code: `ORD-${backendOrder.orderId}`,
        status: mapStatus(backendOrder.orderStatus),
        requestTime: backendRequestTime || requestTime || defaultRequestTime,
        deliveryTime: backendDeliveryTime || null,
        requestingClient: '', // vacío ya que no se usa
        table: tableDisplay,
        tableNumber: backendOrder.tableNumber || 0,
        components: [],
        details: backendOrder.orderBill || '',
        orderBill: backendOrder.orderBill || '',
        totalPrice: backendOrder.totalPrice
    };
};
// ==================== CRUD OPERATIONS ====================

// Crear orden - adaptado para Spring Boot
export const createOrder = async (orderData: OrderData) => {
    try {
        if (!orderData.components || orderData.components.length === 0) {
            throw new Error('Order must have at least one item');
        }
        const firstComponent = orderData.components[0];
        const createDTO = {
            employeeId: orderData.requestingClient || 'Customer',
            menuComponentId: firstComponent.id,
            quantity: 1,
            tableNumber: parseInt(orderData.table, 10) || 0
        };

        const response = await ordersApiClient.post<OrderResponseDTO>('/order', createDTO);

        const currentTime = new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });

        // Agregar items adicionales si existen
        if (orderData.components.length > 1) {
            const orderId = response.data.orderId;
            for (let i = 1; i < orderData.components.length; i++) {
                const component = orderData.components[i];
                await ordersApiClient.post(`/order/${orderId}/items`, {
                    menuComponentId: component.id,
                    quantity: 1
                });
            }

            const updatedResponse = await ordersApiClient.get<OrderResponseDTO>(`/order/${orderId}`);
            const mappedOrder = mapBackendToFrontend(updatedResponse.data, currentTime);

            return {
                data: {
                    ...mappedOrder,
                    requestingClient: orderData.requestingClient,
                    table: orderData.table,
                    price: updatedResponse.data.totalPrice
                },
                requestTime: currentTime
            };
        }

        const mappedOrder = mapBackendToFrontend(response.data, currentTime);

        return {
            data: {
                ...mappedOrder,
                requestingClient: orderData.requestingClient,
                table: orderData.table,
                price: response.data.totalPrice
            },
            requestTime: currentTime
        };
    } catch (error) {
        console.error('Error creating order:', error);
        if (axios.isAxiosError(error)) {
            throw new Error(error.response?.data?.message || error.message);
        }
        throw error;
    }
};

export const getOrderById = async (id: number) => {
    try {
        const response = await ordersApiClient.get<OrderResponseDTO>(`/order/${id}`);
        const raw = response.data;
        return { data: { ...raw, id: raw.orderId, price: raw.totalPrice, details: raw.orderBill } };
    } catch (error) {
        console.error(`Error fetching order ${id}:`, error);
        throw error;
    }
};

export const getAllOrders = async () => {
    try {
        const response = await ordersApiClient.get<OrderResponseDTO[]>('/orders');
        const adapted = response.data.map(o => mapBackendToFrontend(o));
        return { data: adapted };
    } catch (error) {
        console.error('Error fetching orders:', error);
        throw error;
    }
};

export const updateOrder = async (id: number, orderData: string) => {
    try {
        const response = await ordersApiClient.put<OrderResponseDTO>(`/order/${id}`, {
            orderBill: orderData
        });
        return { data: mapBackendToFrontend(response.data) };
    } catch (error) {
        console.error(`Error updating order ${id}:`, error);
        throw error;
    }
};

export const deleteOrder = async (id: number) => {
    try {
        const response = await ordersApiClient.delete<OrderResponseDTO>(`/order/${id}`);
        return { data: mapBackendToFrontend(response.data) };
    } catch (error) {
        console.error(`Error deleting order ${id}:`, error);
        throw error;
    }
};

export const getOrdersByStatus = async (status: string) => {
    try {
        const response = await ordersApiClient.get<OrderResponseDTO[]>(`/orders/status/${status}`);
        const adapted = response.data.map(o => mapBackendToFrontend(o));
        return { data: adapted };
    } catch (error) {
        console.error(`Error fetching orders with status ${status}:`, error);
        throw error;
    }
};

export const updateOrderStatus = async (id: number, status: string) => {
    try {
        console.debug('[updateOrderStatus] Intentando actualizar', { id, status });
        const response = await ordersApiClient.put<OrderResponseDTO>(
            `/order/${id}/status`,
            null,
            { params: { status } }
        );
        return { data: mapBackendToFrontend(response.data) };
    } catch (error) {
        // Intentar con fallback si el backend rechaza el enum
        const fallbackMap: Record<string,string> = {
            'READY': 'COMPLETED',
            'DELIVERED': 'SERVED'
        };
        const upper = status.toUpperCase();
        if (fallbackMap[upper]) {
            try {
                console.warn('[updateOrderStatus] Fallback intentando', { original: status, fallback: fallbackMap[upper] });
                const resp2 = await ordersApiClient.put<OrderResponseDTO>(
                    `/order/${id}/status`,
                    null,
                    { params: { status: fallbackMap[upper] } }
                );
                return { data: mapBackendToFrontend(resp2.data) };
            } catch (err2) {
                console.error(`Error updating order ${id} status (fallback también falló):`, err2);
                throw err2;
            }
        }
        console.error(`Error updating order ${id} status:`, error);
        throw error;
    }
};

// ==================== INVENTARIO ====================

export const createInventoryItem = (itemData: InventoryItem) => {
    return apiClient.post('/inventory/create', itemData);
}

export const getAllInventoryItems = () => {
    return apiClient.get('/inventory/getAll');
}

// ==================== PROVEEDORES ====================

export const createSupplierItem = (itemData: SupplierItem) => {
    return apiClient.post('/supplier/create', itemData);
}

export const getAllSupplierItems = (supplierId?: string) => {
    return apiClient.get('/kitcheniq/api/v1/suppliers/get-orders', { params: { supplierId } });
};

export default apiClient;