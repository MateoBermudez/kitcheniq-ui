import { getAllOrders, getOrderById, getOrdersByStatus, updateOrderStatus } from './api';

export const orderService = {
    getAllOrders: () => getAllOrders(),
    searchOrders: (codigo) => getOrderById(codigo),
    getOrdersByStatus: (estado) => getOrdersByStatus(estado),
    updateOrderStatus: (id, nuevoEstado) => updateOrderStatus(id, nuevoEstado),
};