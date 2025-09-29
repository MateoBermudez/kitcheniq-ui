import axios from 'axios';
import type {InventoryItem} from "../components/InventoryStatus/InventoryStatus.tsx";
import type {SupplierOrderItem} from "../components/SupplierStatus/SupplierStatus.tsx";

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
        const token = localStorage.getItem('authToken');
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