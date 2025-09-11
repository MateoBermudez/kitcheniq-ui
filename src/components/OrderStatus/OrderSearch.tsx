import React, { useState, useEffect, useCallback } from 'react';
import { Form, Button, InputGroup, Row, Col, Card, Spinner, Alert } from 'react-bootstrap';
import { Search, Clock, Person, CurrencyDollar } from 'react-bootstrap-icons';
import { getOrderById, getOrdersByStatus, getAllOrders } from '../../service/api';

interface Order {
    id: number;
    codigo?: string;
    estado?: string;
    details?: string;
    price?: number;
    bill?: string;
    status?: string;
    orderDate?: string;
    items?: string[];
}

interface OrderSearchProps {
    onSearch?: (results: Order[]) => void;
}

const OrderSearch: React.FC<OrderSearchProps> = ({ onSearch }) => {
    const [searchForm, setSearchForm] = useState<{ codigo: string; estado: string }>({
        codigo: '',
        estado: ''
    });
    const [searchResults, setSearchResults] = useState<Order[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [hasSearched, setHasSearched] = useState<boolean>(false);

    const handleInputChange = (field: string, value: string) => {
        setSearchForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const extractCustomerName = (details: string | undefined): string => {
        if (!details) return 'Customer not specified';
        const match = details.match(/Nombre Cliente:\s*([^\n]+)/);
        return match ? match[1].trim() : 'Customer not specified';
    };

    const extractTableNumber = (details: string | undefined): string => {
        if (!details) return '';
        const match = details.match(/Mesa\s*(\d+)/);
        return match ? `Table ${match[1]}` : '';
    };

    const formatOrderDate = (dateString: string | undefined): string => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('en-US', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
            });
        } catch {
            return dateString;
        }
    };

    const getStatusBadgeColor = (status: string | undefined): string => {
        switch (status?.toUpperCase()) {
            case 'PENDING':
                return 'warning';
            case 'READY':
            case 'LISTO':
                return 'success';
            case 'DELIVERED':
            case 'ENTREGADO':
                return 'primary';
            case 'CANCELLED':
            case 'CANCELADO':
                return 'danger';
            default:
                return 'secondary';
        }
    };

    const translateStatus = (status: string | undefined): string => {
        switch (status?.toUpperCase()) {
            case 'PENDING':
                return 'Pending';
            case 'READY':
                return 'Ready';
            case 'DELIVERED':
                return 'Delivered';
            case 'CANCELLED':
                return 'Cancelled';
            default:
                return status || 'Unknown';
        }
    };

    const performSearch = useCallback(async (): Promise<void> => {
        setLoading(true);
        setError('');
        setHasSearched(true);
        try {
            let results: Order[] = [];
            if (searchForm.codigo.trim()) {
                try {
                    const response = await getOrderById(parseInt(searchForm.codigo));
                    const order: Order = response.data;
                    results = [order];
                } catch (err) {
                    if (err && typeof err === 'object' && 'response' in err && (err as { response?: { status?: number } }).response?.status === 404) {
                        results = [];
                    } else {
                        setError('Error searching by code');
                    }
                }
            } else if (searchForm.estado.trim()) {
                const response = await getOrdersByStatus(searchForm.estado);
                results = response.data;
            } else {
                const response = await getAllOrders();
                results = response.data;
            }
            setSearchResults(results);
            if (onSearch) onSearch(results);
        } catch {
            setError('Error searching orders');
        } finally {
            setLoading(false);
        }
    }, [searchForm, onSearch]);

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        (async () => {
            await performSearch();
        })();
    };

    const handleClear = () => {
        setSearchForm({
            codigo: '',
            estado: ''
        });
        setSearchResults([]);
        setError('');
        setHasSearched(false);
        if (onSearch) {
            onSearch([]);
        }
    };

    useEffect(() => {
        if (searchForm.estado && !searchForm.codigo) {
            (async () => {
                await performSearch();
            })();
        }
    }, [searchForm.estado, searchForm.codigo, performSearch]);

    return (
        <div className="h-100 d-flex flex-column">
            <h6 className="mb-3 fw-bold rounded-heading">BÚSQUEDA ESPECIALIZADA</h6>

            <Form onSubmit={handleSearch} className="mb-3">
                <Row className="g-3">
                    <Col md={6}>
                        <Form.Label>Código de Pedido</Form.Label>
                        <InputGroup>
                            <Form.Control
                                type="text"
                                placeholder="Ej: 123"
                                value={searchForm.codigo}
                                onChange={(e) => handleInputChange('codigo', e.target.value)}
                            />
                            <Button variant="outline-primary" type="submit" disabled={loading}>
                                {loading ? <Spinner size="sm" animation="border" /> : <Search size={18} />}
                            </Button>
                            <Button variant="outline-secondary" onClick={handleClear} disabled={loading}>
                                Limpiar
                            </Button>
                        </InputGroup>
                    </Col>
                    <Col md={6}>
                        <Form.Label>Estado</Form.Label>
                        <Form.Select
                            value={searchForm.estado}
                            onChange={(e) => handleInputChange('estado', e.target.value)}
                            disabled={loading}
                        >
                            <option value="">Todos los estados</option>
                            <option value="Pendiente">Pendiente</option>
                            <option value="Listo">Listo</option>
                            <option value="Entregado">Entregado</option>
                            <option value="Cancelado">Cancelado</option>
                        </Form.Select>
                    </Col>
                </Row>
            </Form>

            {error && (
                <Alert variant="danger" className="mb-3">
                    {error}
                </Alert>
            )}

            <div className="flex-grow-1 overflow-auto">
                {hasSearched && (
                    <div className="mb-2">
                        <h6 className="text-muted mb-3">
                            Resultados de búsqueda: {searchResults.length} pedido(s) encontrado(s)
                        </h6>
                    </div>
                )}

                {searchResults.length > 0 && (
                    <div className="d-flex flex-column gap-2">
                        {searchResults.map((order) => (
                            <Card key={order.id} className="border-0 shadow-sm">
                                <Card.Body className="p-3">
                                    <div className="d-flex justify-content-between align-items-start mb-2">
                                        <div className="d-flex align-items-center">
                                            <h6 className="mb-0 me-2">
                                                Pedido #{order.id}
                                            </h6>
                                            <span className={`badge bg-${getStatusBadgeColor(order.status)}`}>
                                                {translateStatus(order.status)}
                                            </span>
                                        </div>
                                        <div className="text-end">
                                            <div className="fw-bold text-success">
                                                <CurrencyDollar size={16} />
                                                ${order.price?.toFixed(1) || '0.0'}
                                            </div>
                                            {order.orderDate && (
                                                <small className="text-muted">
                                                    <Clock size={14} className="me-1" />
                                                    {formatOrderDate(order.orderDate)}
                                                </small>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mb-2">
                                        <div className="d-flex align-items-center text-muted mb-1">
                                            <Person size={16} className="me-1" />
                                            <strong>{extractCustomerName(order.details)}</strong>
                                            {extractTableNumber(order.details) && (
                                                <span className="ms-2 badge bg-light text-dark">
                                                    {extractTableNumber(order.details)}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {Array.isArray(order.items) && order.items.length > 0 && (
                                        <div className="mt-2">
                                            <small className="text-muted d-block mb-1">Products:</small>
                                            <div className="bg-light p-2 rounded">
                                                {order.items?.map((item, index) => (
                                                    <div
                                                        key={index}
                                                        className={`small mb-1 ${index === (order.items?.length ?? 0) - 1 ? 'mb-0' : ''}`}
                                                    >
                                                        • {item}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </Card.Body>
                            </Card>
                        ))}
                    </div>
                )}

                {hasSearched && searchResults.length === 0 && !loading && (
                    <div className="text-center text-muted p-4">
                        <Search size={48} className="mb-2 opacity-50" />
                        <p>No se encontraron pedidos que coincidan con los criterios de búsqueda.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrderSearch;