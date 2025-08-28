import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/api/v1'; // Use ENV Variables

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
export const createOrder = (orderData) => {
    return apiClient.post('/orders/create', orderData);
};

export const getOrderById = (id) => {
    return apiClient.get(`/orders/get/${id}`);
};

export const getAllOrders = () => {
    return apiClient.get('/orders/getAll');
};

export const updateOrder = (id, orderData) => {
    return apiClient.put(`/orders/update/${id}`, orderData);
};

export const deleteOrder = (id) => {
    return apiClient.delete(`/orders/delete/${id}`);
};

export const getOrdersByStatus = (status) => {
    return apiClient.get(`/orders/getByStatus/${status}`);
};

export const updateOrderStatus = (id, status) => {
    return apiClient.post(`/orders/updateStatus/${id}/${status}`);
};

export default apiClient;