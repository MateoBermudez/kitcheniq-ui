import axios from 'axios';
import type {InventoryItem} from "../components/InventoryStatus/InventoryStatus.tsx";

const API_BASE_URL = 'http://localhost:5000'; // Use ENV Variables


export interface OrderComponentData {
    id: number;
    type: string;
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

const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000000,
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

// CRUD Operations
export const createOrder = (orderData: OrderData) => {
    return apiClient.post('/orders/create', orderData);
};

export const getOrderById = (id: number) => {
    return apiClient.get(`/orders/get/${id}`);
};

export const getAllOrders = () => {
    return apiClient.get('/orders/getAll');
};

export const updateOrder = (id: number, orderData: string) => {
    return apiClient.put(`/orders/update/${id}`, orderData);
};

export const deleteOrder = (id: number) => {
    return apiClient.delete(`/orders/delete/${id}`);
};

export const getOrdersByStatus = (status: string) => {
    return apiClient.get(`/orders/getByStatus/${status}`);
};

export const updateOrderStatus = (id: number, status: string) => {
    return apiClient.post(`/orders/updateStatus/${id}/${status}`);
};

export const createInventoryItem = (itemData: InventoryItem) => {
    return apiClient.post('/inventory/create', itemData);
}

export const getAllInventoryItems = () => {
    return apiClient.get('/inventory/getAll');
}

export const createSupplierItem = (itemData: SupplierItem) => {
    return apiClient.post('/supplier/create', itemData);
}

export const getAllSupplierItems = (supplierId?: string) => {
    return apiClient.get('/kitcheniq/api/v1/suppliers/get-orders', { params: { supplierId } });
};

export default apiClient;