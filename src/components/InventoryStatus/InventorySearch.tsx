import React, { useState, useCallback } from 'react';
import { Form, Button, Row, Col, Card, Spinner, Alert } from 'react-bootstrap';
import { Search } from 'react-bootstrap-icons';
import { getAllInventoryItems } from '../../service/api';
import type { InventoryItem } from './InventoryStatus';

interface InventorySearchProps {
    onSearch?: (results: InventoryItem[]) => void;
}

const InventorySearch: React.FC<InventorySearchProps> = ({ onSearch }) => {
    const [searchForm, setSearchForm] = useState<{ name: string; category: string }>({
        name: '',
        category: ''
    });
    const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
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
            const response = await getAllInventoryItems();
            const items: InventoryItem[] = response.data ?? [];
            const filtered = items.filter(item => {
                const nameMatch = searchForm.name ? item.name.toLowerCase().includes(searchForm.name.toLowerCase()) : true;
                const categoryMatch = searchForm.category ? item.category.toLowerCase().includes(searchForm.category.toLowerCase()) : true;
                return nameMatch && categoryMatch;
            });
            setSearchResults(filtered);
            setHasSearched(true);
            if (onSearch) onSearch(filtered);
        } catch (err: unknown) {
            console.error(err);
            setError('Error searching inventory items');
        } finally {
            setLoading(false);
        }
    }, [searchForm, onSearch]);

    return (
        <Card className="mb-3">
            <Card.Body>
                <Form>
                    <Row className="align-items-end">
                        <Col md={5}>
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
                        <Col md={5}>
                            <Form.Group controlId="searchCategory">
                                <Form.Label>Category</Form.Label>
                                <Form.Control
                                    type="text"
                                    placeholder="Search by category"
                                    value={searchForm.category}
                                    onChange={e => handleInputChange('category', e.target.value)}
                                />
                            </Form.Group>
                        </Col>
                        <Col md={2}>
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
                            <div className="text-muted text-center">No inventory items found.</div>
                        ) : (
                            <Row>
                                {searchResults.map(item => (
                                    <Col md={6} lg={4} key={item.id ?? item.name} className="mb-3">
                                        <Card>
                                            <Card.Body>
                                                <Card.Title>{item.name}</Card.Title>
                                                <Card.Subtitle className="mb-2 text-muted">{item.category}</Card.Subtitle>
                                                <Card.Text>
                                                    <strong>Description:</strong> {item.description || 'No description'}<br />
                                                    <strong>Base Quantity:</strong> {item.baseQuantity}<br />
                                                    <strong>Stock Quantity:</strong> {item.stockQuantity}
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

export default InventorySearch;
