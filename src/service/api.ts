import axios from 'axios';
import type {InventoryItem} from "../components/InventoryStatus/InventoryStatus.tsx";

// Ambos usan el mismo puerto ahora
const API_BASE_URL = 'http://localhost:5000';
const ORDERS_API_BASE_URL = 'http://localhost:5000/kitcheniq/api/v1';

export interface OrderComponentData {
    id: number;
    type: string;
    name?: string;
    quantity?: number;
}

// Type for Order Data
export interface OrderData {
    id: number | null;
    details: string;
    components: OrderComponentData[];
    deliveryTime: string | null;
    requestTime: string | null;
    requestingClient: string;
    table: string;
    code?: string;
    status?: string;
}

// Backend response from Spring Boot
interface OrderResponseDTO {
    orderId: number;
    totalPrice: number;
    orderBill: string;
    orderDate: string;
    orderStatus: string;
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
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

apiClient.interceptors.request.use(
    (config) => {
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
        console.log('Orders API Request:', config.method?.toUpperCase(), config.url);
        return config;
    },
    (error) => {
        console.error('Orders Request Error:', error);
        return Promise.reject(error);
    }
);

// Función helper para mapear respuesta del backend al formato frontend
const mapBackendToFrontend = (backendOrder: OrderResponseDTO, requestTime?: string): OrderData => {
    const orderDate = new Date(backendOrder.orderDate);
    const defaultRequestTime = orderDate.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });

    return {
        id: backendOrder.orderId,
        code: `ORD-${backendOrder.orderId}`,
        status: backendOrder.orderStatus || 'PENDING',
        requestTime: requestTime || defaultRequestTime,
        deliveryTime: null,
        requestingClient: 'Customer',
        table: 'N/A',
        components: [],
        details: backendOrder.orderBill || '',
    };
};

// ==================== CRUD Operations ====================

// Crear orden - adaptado para Spring Boot
export const createOrder = async (orderData: OrderData) => {
    try {
        if (!orderData.components || orderData.components.length === 0) {
            throw new Error('Order must have at least one item');
        }

        const firstComponent = orderData.components[0];

        // Crear orden con el primer item
        const createDTO = {
            employeeId: orderData.requestingClient || 'Customer',
            menuComponentId: firstComponent.id,
            quantity: 1
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
        return { data: mapBackendToFrontend(response.data) };
    } catch (error) {
        console.error(`Error fetching order ${id}:`, error);
        throw error;
    }
};

export const getAllOrders = async () => {
    try {
        const response = await ordersApiClient.get<OrderResponseDTO[]>('/orders');
        const mappedOrders = response.data.map(order => mapBackendToFrontend(order));
        return { data: mappedOrders };
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
        const mappedOrders = response.data.map(order => mapBackendToFrontend(order));
        return { data: mappedOrders };
    } catch (error) {
        console.error(`Error fetching orders with status ${status}:`, error);
        throw error;
    }
};

export const updateOrderStatus = async (id: number, status: string) => {
    try {
        const response = await ordersApiClient.put<OrderResponseDTO>(
            `/order/${id}/status`,
            null,
            { params: { status } }
        );
        return { data: mapBackendToFrontend(response.data) };
    } catch (error) {
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