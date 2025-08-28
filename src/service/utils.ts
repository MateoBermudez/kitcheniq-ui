// Funciones utilitarias para los servicios
export const handleApiError = (error) => {
    if (error.response) {
        // Error de respuesta del servidor
        return {
            message: error.response.data?.message || 'Error del servidor',
            status: error.response.status
        };
    } else if (error.request) {
        // Error de red
        return {
            message: 'Error de conexión con el servidor',
            status: 0
        };
    } else {
        // Otro tipo de error
        return {
            message: 'Error inesperado',
            status: -1
        };
    }
};

export const formatApiResponse = (response) => {
    return response.data || response;
};