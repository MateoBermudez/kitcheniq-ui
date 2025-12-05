import React, { useState } from 'react';
import { Form, Button, Row, Col, Card } from 'react-bootstrap';
import { Search } from 'react-bootstrap-icons';
import type { SupplierOrder } from './SupplierStatus';

interface SupplierSearchProps {
    items: SupplierOrder[];
    onSearch?: (results: SupplierOrder[]) => void;
}

const PURCHASE_ORDER_STATUS = [
    'PENDING',
    'ACCEPTED',
    'REJECTED',
    'DELIVERED',
    'CANCELLED',
    'DISPATCHING'
];

const SupplierSearch: React.FC<SupplierSearchProps> = ({ items, onSearch }) => {
    const [searchForm, setSearchForm] = useState<{
        orderId: string;
        status: string;
        requestDay: string;
        totalAmount: string;
    }>({
        orderId: '',
        status: '',
        requestDay: '',
        totalAmount: ''
    });
    const [searchResults, setSearchResults] = useState<SupplierOrder[]>(items);
    const [hasSearched, setHasSearched] = useState<boolean>(false);

    const handleInputChange = (field: string, value: string) => {
        setSearchForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSearch = () => {
        const filtered = items.filter(item => {
            const idMatch = searchForm.orderId ? String(item.orderId).includes(searchForm.orderId) : true;
            const statusMatch = searchForm.status ? item.status === searchForm.status : true;
            const dayMatch = searchForm.requestDay ? item.orderDate.slice(0, 10) === searchForm.requestDay : true;
            const totalMatch = searchForm.totalAmount ? item.totalAmount === Number(searchForm.totalAmount) : true;
            return idMatch && statusMatch && dayMatch && totalMatch;
        });
        setSearchResults(filtered);
        setHasSearched(true);
        if (onSearch) onSearch(filtered);
    };

    return (
        <Card className="mb-3">
            <Card.Body>
                <Form>
                    <Row className="align-items-end">
                        <Col md={3}>
                            <Form.Group controlId="searchOrderId">
                                <Form.Label>Order ID</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="Search by order ID"
                                    value={searchForm.orderId}
                                    onChange={e => handleInputChange('orderId', e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={3}>
                            <Form.Group controlId="searchStatus">
                                <Form.Label>Status</Form.Label>
                                <Form.Select
                                    value={searchForm.status}
                                    onChange={e => handleInputChange('status', e.target.value)}
                                >
                                    <option value="">All</option>
                                    {PURCHASE_ORDER_STATUS.map(status => (
                                        <option key={status} value={status}>{status}</option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        </Col>
                        <Col md={3}>
                            <Form.Group controlId="searchRequestDay">
                                <Form.Label>Request Day</Form.Label>
                                <Form.Control
                                    type="date"
                                    placeholder="Search by request day"
                                    value={searchForm.requestDay}
                                    max={new Date().toISOString().split('T')[0]}
                                    onChange={e => handleInputChange('requestDay', e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={3}>
                            <Form.Group controlId="searchTotalAmount">
                                <Form.Label>Total Amount</Form.Label>
                                <Form.Control
                                    type="number"
                                    placeholder="Search by total amount"
                                    value={searchForm.totalAmount}
                                    min={0}
                                    max={120000}
                                    onChange={e => handleInputChange('totalAmount', e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row className="mt-3">
                        <Col md={12}>
                            <Button variant="primary" onClick={handleSearch} className="w-100"
                                    style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}>
                                <Search className="me-1" />
                                Search
                            </Button>
                        </Col>
                    </Row>
                </Form>
                {hasSearched && (
                    <div className="mt-3">
                        {searchResults.length === 0 ? (
                            <div className="text-muted text-center">No supplier orders found.</div>
                        ) : (
                            <div style={{ maxHeight: 220, overflowY: 'auto', overflowX: 'hidden' }}>
                                <Row>
                                    {searchResults.map(item => (
                                        <Col md={6} lg={4} key={item.orderId ?? item.orderDate} className="mb-3">
                                            <Card className="h-100" style={{ minHeight: 180 }}>
                                                <Card.Body>
                                                    <Card.Title>Order #{item.orderId}</Card.Title>
                                                    <Card.Subtitle className="mb-2 text-muted">Status: {item.status}</Card.Subtitle>
                                                    <Card.Text>
                                                        <strong>Date:</strong> {item.orderDate}<br />
                                                        <strong>Total:</strong> ${item.totalAmount}
                                                    </Card.Text>
                                                </Card.Body>
                                            </Card>
                                        </Col>
                                    ))}
                                </Row>
                            </div>
                        )}
                    </div>
                )}
            </Card.Body>
        </Card>
    );
};

export default SupplierSearch;
