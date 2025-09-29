import React, { useState, useCallback } from 'react';
import { Form, Button, Row, Col, Card, Spinner, Alert } from 'react-bootstrap';
import { Search } from 'react-bootstrap-icons';
import { getAllSupplierItems } from '../../service/api';
import type { SupplierOrder } from './SupplierStatus';

interface SupplierSearchProps {
    onSearch?: (results: SupplierOrder[]) => void;
}

const SupplierSearch: React.FC<SupplierSearchProps> = ({ onSearch }) => {
    const [searchForm, setSearchForm] = useState<{ name: string; status: string; requestDay: string }>({
        name: '',
        status: '',
        requestDay: ''
    });
    const [searchResults, setSearchResults] = useState<SupplierOrder[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [hasSearched, setHasSearched] = useState<boolean>(false);

    const handleInputChange = (field: string, value: string) => {
        setSearchForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSearch = useCallback(async () => {
        setLoading(true);
        setError('');
        setHasSearched(false);
        try {
            const response = await getAllSupplierItems();
            const items: SupplierOrder[] = response.data ?? [];
            const filtered = items.filter(item => {
                const nameMatch = searchForm.name ? item.name.toLowerCase().includes(searchForm.name.toLowerCase()) : true;
                const statusMatch = searchForm.status ? item.status.toLowerCase().includes(searchForm.status.toLowerCase()) : true;
                const requestDayMatch = searchForm.requestDay ? item.requestDay.toLowerCase().includes(searchForm.requestDay.toLowerCase()) : true;
                return nameMatch && statusMatch && requestDayMatch;
            });
            setSearchResults(filtered);
            setHasSearched(true);
            if (onSearch) onSearch(filtered);
        } catch (err: unknown) {
            console.error(err);
            setError('Error searching supplier items');
        } finally {
            setLoading(false);
        }
    }, [searchForm, onSearch]);

    return (
        <Card className="mb-3">
            <Card.Body>
                <Form>
                    <Row className="align-items-end">
                        <Col md={4}>
                            <Form.Group controlId="searchName">
                                <Form.Label>Name</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="Search by name"
                                    value={searchForm.name}
                                    onChange={e => handleInputChange('name', e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group controlId="searchStatus">
                                <Form.Label>Status</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="Search by status"
                                    value={searchForm.status}
                                    onChange={e => handleInputChange('status', e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={4}>
                            <Form.Group controlId="searchRequestDay">
                                <Form.Label>Request Day</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="Search by request day"
                                    value={searchForm.requestDay}
                                    onChange={e => handleInputChange('requestDay', e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                    </Row>
                    <Row className="mt-3">
                        <Col md={12}>
                            <Button variant="primary" onClick={handleSearch} disabled={loading} className="w-100"
                                    style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}>
                                <Search className="me-1" />
                                Search
                            </Button>
                        </Col>
                    </Row>
                </Form>
                {loading && <div className="d-flex justify-content-center py-3"><Spinner animation="border" /></div>}
                {error && <Alert variant="danger" className="mt-2">{error}</Alert>}
                {hasSearched && !loading && (
                    <div className="mt-3">
                        {searchResults.length === 0 ? (
                            <div className="text-muted text-center">No supplier items found.</div>
                        ) : (
                            <Row>
                                {searchResults.map(item => (
                                    <Col md={6} lg={4} key={item.id ?? item.name} className="mb-3">
                                        <Card>
                                            <Card.Body>
                                                <Card.Title>{item.name}</Card.Title>
                                                <Card.Subtitle className="mb-2 text-muted">Status: {item.status}</Card.Subtitle>
                                                <Card.Text>
                                                    <strong>Description:</strong> {item.description || 'No description'}<br />
                                                    <strong>Available:</strong> {item.available ? 'Yes' : 'No'}<br />
                                                    <strong>Request Day:</strong> {item.requestDay}<br />
                                                    <strong>Cost:</strong> ${item.cost}
                                                </Card.Text>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        )}
                    </div>
                )}
            </Card.Body>
        </Card>
    );
};

export default SupplierSearch;
