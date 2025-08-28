export const mockOrders = [
    {
        codigo: "0001",
        clienteSolicitante: "Nombre Cliente 1",
        mesa: 4,
        estado: "Pendiente",
        horaSolicitud: "08:00",
        horaEntrega: "08:30",
        items: ["Ensalada César", "Agua"],
        observaciones: ""
    },
    {
        codigo: "0002",
        clienteSolicitante: "Nombre Cliente 2",
        mesa: 2,
        estado: "Listo",
        horaSolicitud: "08:15",
        horaEntrega: "08:45",
        items: ["Hamburguesa Clásica", "Papas Fritas"],
        observaciones: "Sin cebolla"
    },
    {
        codigo: "0003",
        clienteSolicitante: "Nombre Cliente 3",
        mesa: 6,
        estado: "Listo",
        horaSolicitud: "08:30",
        horaEntrega: "09:00",
        items: ["Pizza Margarita"],
        observaciones: ""
    },
    {
        codigo: "0004",
        clienteSolicitante: "Nombre Cliente 4",
        mesa: 1,
        estado: "Entregado",
        horaSolicitud: "07:45",
        horaEntrega: "08:15",
        items: ["Desayuno Completo"],
        observaciones: "Extra tostado"
    },
    {
        codigo: "0005",
        clienteSolicitante: "Nombre Cliente 5",
        mesa: 8,
        estado: "Pendiente",
        horaSolicitud: "09:00",
        horaEntrega: "09:30",
        items: ["Pasta Alfredo"],
        observaciones: ""
    },
    {
        codigo: "0006",
        clienteSolicitante: "Nombre Cliente 6",
        mesa: 8,
        estado: "Pendiente",
        horaSolicitud: "09:00",
        horaEntrega: "09:30",
        items: ["Sándwich Club", "Jugo de Naranja"],
        observaciones: "Pan integral"
    }
];

export const mockNotifications = [
    {
        id: 1,
        type: 'danger',
        code: 'PEDIDO PID-123',
        message: 'Más de 30 minutos sin actualizar',
        timestamp: new Date(),
    },
    {
        id: 2,
        type: 'success',
        code: 'PEDIDO PID-121',
        message: 'Listo para ser entregado',
        timestamp: new Date(),
    },
    {
        id: 3,
        type: 'success',
        code: 'PEDIDO PID-120',
        message: 'Listo para ser entregado',
        timestamp: new Date(),
    },
];

export const menuItems = [
    { id: 1, nombre: 'Hamburguesa Clásica', precio: 12500, categoria: 'Principales' },
    { id: 2, nombre: 'Pizza Margarita', precio: 18000, categoria: 'Principales' },
    { id: 3, nombre: 'Ensalada César', precio: 9500, categoria: 'Ensaladas' },
    { id: 4, nombre: 'Pasta Alfredo', precio: 14000, categoria: 'Principales' },
    { id: 5, nombre: 'Sándwich Club', precio: 11000, categoria: 'Sándwiches' },
    { id: 6, nombre: 'Papas Fritas', precio: 6000, categoria: 'Acompañamientos' },
    { id: 7, nombre: 'Jugo de Naranja', precio: 4500, categoria: 'Bebidas' },
    { id: 8, nombre: 'Agua', precio: 2000, categoria: 'Bebidas' },
    { id: 9, nombre: 'Desayuno Completo', precio: 16000, categoria: 'Desayunos' },
    { id: 10, nombre: 'Café Americano', precio: 3500, categoria: 'Bebidas' }
];