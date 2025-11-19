import axios from 'axios';
import type {InventoryItem} from "../components/InventoryStatus/InventoryStatus.tsx";
import type {SupplierOrderItem} from "../components/SupplierStatus/SupplierStatus.tsx";

// ==================== AUTH CONSTANTS ====================
const TOKEN_KEY = 'authToken';

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

// Both backend domains currently use the same port
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

// Order data shape used in the frontend
export interface OrderData {
    id: number | null;
    details: string;
    components: OrderComponentData[];
    deliveryTime: string | null;
    requestTime: string | null;
    requestingClient?: string; // optional now (was required earlier)
    table: string;
    code?: string;
    status?: string;
    totalPrice?: number; // added for price summary
    orderBill?: string;  // added textual bill/notes
    tableNumber?: number; // added for numeric handling
}

// Backend response DTO (Spring Boot)
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

// Auth request/response models
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

// User info DTO (from /users/my-info)
export interface UserInfo {
    id?: string;
    userId?: string;
    name?: string;
    username?: string;
    type?: string;
    role?: string;
    employeeType?: string;
    entityType?: string;   // e.g. Supplier / Customer
}

// Utility to decode a JWT (no signature verification, just base64 decode)
export const decodeJwt = (token: string): Record<string, any> | null => {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const payload = parts[1]
            .replace(/-/g, '+')
            .replace(/_/g, '/');
        const json = decodeURIComponent(atob(payload).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(json);
    } catch (e) {
        console.warn('decodeJwt failed:', e);
        return null;
    }
};

// ==================== API CLIENTS ====================

// Client for inventory & suppliers domain
const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Client for orders / auth / users domain
const ordersApiClient = axios.create({
    baseURL: ORDERS_API_BASE_URL,
    timeout: 10000000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Fetch authenticated user info and normalize type field
export const getUserInfo = async (userId: string): Promise<UserInfo> => {
    const resp = await ordersApiClient.get<UserInfo>('/users/my-info', { params: { userId } });
    const data = resp.data || {};
    const rawType = data.type || data.role || data.employeeType || data.entityType;
    const normalizedType = rawType ? String(rawType).toUpperCase() : undefined;
    return { ...data, type: normalizedType };
};

// Attach JWT token to outgoing requests if present
apiClient.interceptors.request.use(
    (config) => {
        const token = getAuthToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

ordersApiClient.interceptors.request.use(
    (config) => {
        const token = getAuthToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Unified handler for authentication errors (401)
const handleAuthError = (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
        removeAuthToken();
        try {
            window.dispatchEvent(new CustomEvent('auth-expired'));
        } catch { /* ignore */ }
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
        throw error;
    }
};

export const logout = () => {
    removeAuthToken();
    window.location.href = '/login';
};

// ==================== HELPER FUNCTIONS ====================

// Maps a backend order response into the frontend structure
const mapBackendToFrontend = (backendOrder: OrderResponseDTO, requestTime?: string): OrderData => {
    const formatBackendTime = (isoString: string | null | undefined): string | null => {
        if (!isoString) return null;
        try {
            const date = new Date(isoString);
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

    // Derive a fallback request time if none provided
    let defaultRequestTime = 'N/A';
    if (backendOrder.orderDate) {
        if (backendOrder.orderDate.length > 10) {
            const orderDate = new Date(backendOrder.orderDate);
            if (!isNaN(orderDate.getTime())) {
                defaultRequestTime = orderDate.toLocaleTimeString('en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: false
                });
            }
        }
    }

    const tableNumber = backendOrder.tableNumber || 0;
    const tableDisplay = tableNumber > 0 ? String(tableNumber) : 'N/A';

    // Normalize backend status to supported frontend statuses
    const mapStatus = (status: string | null | undefined): string => {
        if (!status) return 'PENDING';
        const statusMap: Record<string, string> = {
            'PENDING': 'PENDING',
            'IN_PROGRESS': 'IN_PROGRESS',
            'READY': 'READY',
            'COMPLETED': 'READY', // compatibility mapping
            'DELIVERED': 'DELIVERED',
            'SERVED': 'DELIVERED', // treat SERVED as DELIVERED
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
        requestingClient: '',
        table: tableDisplay,
        tableNumber: backendOrder.tableNumber || 0,
        components: [],
        details: backendOrder.orderBill || '',
        orderBill: backendOrder.orderBill || '',
        totalPrice: backendOrder.totalPrice
    };
};

// ==================== ORDER CRUD OPERATIONS ====================

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

        // If there are additional components, add them sequentially
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
        throw error;
    }
};

export const getAllOrders = async () => {
    try {
        const response = await ordersApiClient.get<OrderResponseDTO[]>('/orders');
        const adapted = response.data.map(o => mapBackendToFrontend(o));
        return { data: adapted };
    } catch (error) {
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
        throw error;
    }
};

export const deleteOrder = async (id: number) => {
    try {
        const response = await ordersApiClient.delete<OrderResponseDTO>(`/order/${id}`);
        return { data: mapBackendToFrontend(response.data) };
    } catch (error) {
        throw error;
    }
};

export const getOrdersByStatus = async (status: string) => {
    try {
        const response = await ordersApiClient.get<OrderResponseDTO[]>(`/orders/status/${status}`);
        const adapted = response.data.map(o => mapBackendToFrontend(o));
        return { data: adapted };
    } catch (error) {
        throw error;
    }
};

export const updateOrderStatus = async (id: number, status: string) => {
    try {
        const payload = { status, orderStatus: status } as Record<string,string>;
        const response = await ordersApiClient.put<OrderResponseDTO>(
            `/order/${id}/status`,
            payload,
            { params: { status } }
        );
        return { data: mapBackendToFrontend(response.data) };
    } catch (error) {
        const fallbackMap: Record<string,string> = {
            'READY': 'COMPLETED',
            'DELIVERED': 'SERVED'
        };
        const upper = status.toUpperCase();
        if (fallbackMap[upper]) {
            const fb = fallbackMap[upper];
            try {
                const payloadFb = { status: fb, orderStatus: fb };
                const resp2 = await ordersApiClient.put<OrderResponseDTO>(
                    `/order/${id}/status`,
                    payloadFb,
                    { params: { status: fb } }
                );
                return { data: mapBackendToFrontend(resp2.data) };
            } catch (err2) {
                throw err2;
            }
        }
        throw error;
    }
};

// ==================== INVENTORY ====================

export const createInventoryItem = (itemData: InventoryItem) => {
    return apiClient.post('/inventory/create', itemData);
}

export const getAllInventoryItems = () => {
    return apiClient.get('/inventory/getAll');
}

// This is an admin only function
export const createSupplierItem = (itemData: SupplierItem) => {
    return apiClient.post('/supplier/create', itemData);
}

export const getAllSupplierItems = (supplierId?: string) => {
    return apiClient.get('/kitcheniq/api/v1/suppliers/get-orders', { params: { supplierId } });
};

export async function getSupplierOrderPdf(orderId: number): Promise<void> {
    try {
        const response = await apiClient.get('/kitcheniq/api/v1/suppliers/get-order-pdf', {
            params: { orderId },
            responseType: 'blob', // Important: receive as Blob
        });

        // Create a Blob URL for the PDF
        const pdfBlob = new Blob([response.data], { type: 'application/pdf' });
        const pdfUrl = window.URL.createObjectURL(pdfBlob);

        // Open PDF in a new tab
        window.open(pdfUrl, '_blank');

        // Optionally, trigger download:
        // const link = document.createElement('a');
        // link.href = pdfUrl;
        // link.download = `purchase_order_${orderId}.pdf`;
        // document.body.appendChild(link);
        // link.click();
        // document.body.removeChild(link);

    } catch (error) {
        console.error('Error fetching PDF:', error);
        // Optionally, show a toast or error message
    }
}

export const changeSupplierOrderStatus = (orderId: number, status: string) => {
    return apiClient.post(`/kitcheniq/api/v1/suppliers/purchase-order`, null, { params: { orderId, status } });
}

export const deliverSupplierItem = (item: SupplierOrderItem) => {
    return apiClient.post(`/kitcheniq/api/v1/suppliers/deliver-order`, item);
}

export const finishSupplierDispatch = (orderId: number) => {
    return apiClient.post(`/kitcheniq/api/v1/suppliers/finish-dispatch`, null, { params: { purchaseOrderDTO: orderId } });
}

export const initiateDispatch = (orderId: number) => {
    return apiClient.post(`/kitcheniq/api/v1/suppliers/initiate-dispatch`, null, { params: { orderId } });
}

export default apiClient;