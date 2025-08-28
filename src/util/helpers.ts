export const getStatusVariant = (estado) => {
    switch (estado?.toLowerCase()) {
        case 'pendiente': return 'warning';
        case 'listo': return 'success';
        case 'entregado': return 'info';
        case 'cancelado': return 'danger';
        default: return 'secondary';
    }
};

export const formatTime = (timeString) => {
    if (!timeString) return '--:--';
    return timeString;
};

export const formatDate = (date) => {
    return new Date(date).toLocaleDateString('es-ES');
};