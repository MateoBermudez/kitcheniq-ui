import React, { useState, useCallback } from 'react';
import { Form, Button, InputGroup, Row, Col, Card, Spinner, Alert } from 'react-bootstrap';
import { Search, Clock, CurrencyDollar } from 'react-bootstrap-icons';
import { getOrderById, getAllOrders } from '../../service/api';

interface Order {
    id: number;
    code?: string;
    status?: string;
    details?: string;
    price?: number;
    totalPrice?: number; // fallback if price is absent
    orderBill?: string;
    orderDate?: string;
    items?: string[];
    notes?: string; // locally stored notes (from localStorage)
}

interface OrderBackend {
    id?: number;
    orderId?: number;
    code?: string;
    orderStatus?: string;
    status?: string;
    details?: string;
    orderBill?: string;
    price?: number;
    totalPrice?: number;
    orderDate?: string;
}

// Normalize backend status variants to canonical frontend representation
const normalizeBackendStatus = (status?: string): string => {
    const s = status?.toUpperCase() || 'PENDING';
    switch (s) {
        case 'COMPLETED':
            return 'READY';
        case 'SERVED':
            return 'DELIVERED';
        default:
            return s; // PENDING, IN_PROGRESS, READY, DELIVERED, CANCELLED
    }
};

interface OrderSearchProps {
    onSearch?: (results: Order[]) => void;
}

const OrderSearch: React.FC<OrderSearchProps> = ({ onSearch }) => {
    // Local search form (only code supported currently)
    const [searchForm, setSearchForm] = useState<{ code: string }>({
        code: ''
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

    const extractTableNumber = (details: string | undefined): string => {
        if (!details) return '';
        const match = details.match(/Table\s*(\d+)/);
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

    const translateStatus = (status: string | undefined): string => {
        const s = normalizeBackendStatus(status);
        switch (s) {
            case 'PENDING':
                return 'Pending';
            case 'IN_PROGRESS':
                return 'In Progress';
            case 'READY':
                return 'Ready';
            case 'DELIVERED':
                return 'Delivered';
            case 'CANCELLED':
                return 'Cancelled';
            default:
                return 'Unknown';
        }
    };

    const parseItems = (raw: string | undefined): string[] => {
        if (!raw) return [];
        try {
            const parsed: unknown = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.map((d) => {
                    if (typeof d === 'object' && d !== null) {
                        const rec = d as Record<string, unknown>;
                        const name = (rec.productName || rec.name || `Item ${rec.productId || ''}`).toString();
                        const qtyRaw = rec.quantity;
                        const qty = typeof qtyRaw === 'number' ? qtyRaw : 1;
                        return `${name} x${qty}`;
                    }
                    return 'Item';
                });
            }
            return [];
        } catch {
            return [];
        }
    };

    const mapBackendToOrder = useCallback((o: OrderBackend): Order => {
        const id = o.id ?? o.orderId ?? 0;
        const rawStatus = o.status || o.orderStatus;
        const normalized = normalizeBackendStatus(rawStatus);
        return {
            id,
            code: o.code || `ORD-${id}`,
            status: normalized,
            details: o.details || o.orderBill,
            orderBill: o.orderBill,
            price: o.price,
            totalPrice: o.totalPrice,
            orderDate: o.orderDate,
            items: parseItems(o.orderBill || o.details)
        };
    }, []);

    const performSearch = useCallback(async (): Promise<void> => {
         setLoading(true);
         setError('');
         setHasSearched(true);
         try {
             let results: Order[] = [];
             if (searchForm.code.trim()) {
                 try {
                     const response = await getOrderById(parseInt(searchForm.code));
                     const backend: OrderBackend = response.data;
                     results = [mapBackendToOrder(backend)];
                 } catch (err) {
                     if (err && typeof err === 'object' && 'response' in err && (err as { response?: { status?: number } }).response?.status === 404) {
                         results = [];
                     } else {
                         setError('Error searching by code');
                     }
                 }
             } else {
                // Empty input -> fetch all orders
                const response = await getAllOrders();
                const arr: OrderBackend[] = response.data as OrderBackend[];
                results = arr.map(mapBackendToOrder);
             }
             try {
                 const notesRaw = localStorage.getItem('order_notes');
                 if (notesRaw) {
                     const notesMap = JSON.parse(notesRaw) as Record<string, string>;
                     results = results.map(r => ({ ...r, notes: notesMap[r.id] }));
                 }
             } catch (e) {
                 console.warn('No se pudieron leer notas locales', e);
             }
             setSearchResults(results);
             if (onSearch) onSearch(results);
         } catch {
             setError('Error searching orders');
         } finally {
             setLoading(false);
         }
     }, [searchForm, onSearch, mapBackendToOrder]);

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        (async () => {
            await performSearch();
        })();
    };

    const handleClear = () => {
        setSearchForm({
            code: ''
        });
        setSearchResults([]);
        setError('');
        setHasSearched(false);
        if (onSearch) {
            onSearch([]);
        }
    };

    // Do not auto-load on mount; wait for explicit search action

    const getStatusVisualStyle = (status: string | undefined): { bg: string; border: string; text: string; left: string } => {
        const s = normalizeBackendStatus(status).toLowerCase();
        switch (s) {
            case 'pending':
                return { bg: '#feffd4', border: '#c2c838', text: '#000000', left: '#c2c838' };
            case 'in_progress':
            case 'in progress':
                return { bg: '#FFE4B5', border: '#DEB887', text: '#000000', left: '#DEB887' };
            case 'ready':
                return { bg: '#D1FFD7', border: '#A3C6B0', text: '#000000', left: '#A3C6B0' };
            case 'delivered':
                return { bg: '#86e5ff', border: '#86e5ff', text: '#000000', left: '#86e5ff' };
            case 'cancelled':
                return { bg: '#F8D7DA', border: '#EA868F', text: '#000000', left: '#EA868F' };
            default:
                return { bg: '#E9ECEF', border: '#CED4DA', text: '#000000', left: '#CED4DA' };
        }
    };

    return (
        <div className="h-100 d-flex flex-column">
            <h6 className="mb-3 fw-bold rounded-heading d-flex align-items-center">
                <span style={{letterSpacing: '0.5px'}}>SPECIALIZED SEARCH</span>
                <span className="ms-2 badge bg-info text-dark" style={{opacity: 0.85}}>Orders</span>
            </h6>

            <Form onSubmit={handleSearch} className="mb-3">
                <Row className="g-2 align-items-end">
                    <Col md={12} sm={12}>
                        <Form.Label className="mb-1">Order Code (optional)</Form.Label>
                        <InputGroup>
                            <Form.Control
                                type="text"
                                placeholder="Ex: 123 (empty = no results)"
                                value={searchForm.code}
                                onChange={(e) => handleInputChange('code', e.target.value)}
                            />
                            <Button variant="primary" type="submit" disabled={loading} style={{background:'#86e5ff', borderColor:'#86e5ff', color:'#000'}}>
                                {loading ? <Spinner size="sm" animation="border" /> : <Search size={18} />}
                            </Button>
                            <Button variant="outline-secondary" onClick={handleClear} disabled={loading}>
                                Clear
                            </Button>
                        </InputGroup>
                    </Col>
                </Row>
            </Form>

            {error && (
                <Alert variant="danger" className="mb-3">
                    {error}
                </Alert>
            )}

            <div className="flex-grow-1 overflow-auto" style={{ minHeight: 0 }}>
                {hasSearched && (
                    <div className="mb-2 d-flex flex-wrap justify-content-between align-items-center">
                        <h6 className="text-muted mb-2 mb-sm-0">
                            {searchResults.length} order(s) found
                        </h6>
                    </div>
                )}

                {searchResults.length > 0 ? (
                    // limit visible height to show up to 2 order cards; enable scrolling if more
                    <div style={{ maxHeight: 320, overflowY: searchResults.length > 2 ? 'auto' : 'visible' }}>
                        <div className="d-flex flex-column gap-2">
                            {searchResults.map((order) => {
                                const visual = getStatusVisualStyle(order.status);
                                return (
                                <Card
                                    key={order.id}
                                    className="border-0 shadow-sm position-relative"
                                    style={{
                                        borderLeft: `4px solid ${visual.left}`,
                                        background: '#ffffff'
                                    }}
                                >
                                    <Card.Body className="p-3">
                                        <div className="d-flex justify-content-between align-items-start mb-2">
                                            <div className="d-flex align-items-center">
                                                <h6 className="mb-0 me-2">
                                                    Order #{order.id}
                                                </h6>
                                                <span
                                                    className="badge"
                                                    style={{
                                                        backgroundColor: visual.bg,
                                                        color: visual.text,
                                                        border: `1px solid ${visual.border}`,
                                                        fontWeight: 500
                                                    }}
                                                >
                                                    {translateStatus(order.status)}
                                                </span>
                                            </div>
                                            <div className="text-end">
                                                <div className="fw-bold" style={{color: '#087f5b'}}>
                                                    <CurrencyDollar size={16} />
                                                    {(order.price ?? order.totalPrice ?? 0).toFixed(1)}
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
                                                {/* Table badge if present */}
                                                {extractTableNumber(order.details) && (
                                                    <span className="badge bg-light text-dark">
                                                        {extractTableNumber(order.details)}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {Array.isArray(order.items) && order.items.length > 0 && (
                                            <div className="mt-2">
                                                <small className="text-muted d-block mb-1">Products:</small>
                                                {(() => {
                                                     // Translate to English and consolidate quantities from labels like "name xN"
                                                     const toEnglish = (name: string): string => {
                                                         const dict: Record<string, string> = {
                                                             'papas fritas': 'Fries',
                                                             'refresco': 'Soda',
                                                             'hamburguesa': 'Burger',
                                                             'pollo': 'Chicken',
                                                             'carne': 'Beef',
                                                             'ensalada': 'Salad',
                                                         };
                                                         const key = name.trim().toLowerCase();
                                                         return dict[key] || name;
                                                     };
                                                    const capitalize = (s: string): string => s.length ? s[0].toUpperCase() + s.slice(1) : s;
                                                    const groups = new Map<string, { name: string; total: number }>();
                                                     order.items.forEach(label => {
                                                         const raw = String(label).trim();
                                                         // Extract name and optional trailing quantity like "name xN"
                                                         const match = raw.match(/^(.*?)(?:\s+x(\d+))?$/i);
                                                         const base = match ? match[1].trim() : raw;
                                                         const qty = match && match[2] ? parseInt(match[2], 10) : 1;
                                                        const english = toEnglish(base);
                                                        const key = english.toLowerCase();
                                                        const current = groups.get(key);
                                                        const inc = isNaN(qty) ? 1 : qty;
                                                        if (current) {
                                                            current.total += inc;
                                                        } else {
                                                            groups.set(key, { name: capitalize(english), total: inc });
                                                        }
                                                     });
                                                    const grouped = Array.from(groups.values());
                                                     return (
                                                         <div className="d-flex flex-wrap gap-1">
                                                             {grouped.map((g, idx) => (
                                                                 <span
                                                                     key={idx}
                                                                     className="badge rounded-pill"
                                                                     style={{ background:'#f1f3f5', color:'#0a0a0a', border:'1px solid #dee2e6', fontWeight:500 }}
                                                                 >
                                                                     {g.name} <span className="ms-1">x{g.total}</span>
                                                                 </span>
                                                             ))}
                                                         </div>
                                                     );
                                                 })()}
                                            </div>
                                        )}
                                        {order.notes && (
                                            <div className="mt-2">
                                                <small className="text-muted d-block mb-1">Notes:</small>
                                                <div className="bg-white border rounded p-2 small" style={{whiteSpace: 'pre-wrap'}}>
                                                    {order.notes}
                                                </div>
                                            </div>
                                        )}
                                    </Card.Body>
                                </Card>)})}
                        </div>
                    </div>
                ) : (hasSearched && !loading && (
                    <div className="text-center text-muted p-4">
                        <Search size={48} className="mb-2 opacity-50" />
                        <p>No orders found matching the search criteria.</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default OrderSearch;
