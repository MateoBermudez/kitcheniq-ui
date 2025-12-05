import React, { useState, useCallback, useEffect } from 'react';
import { Form, Button, InputGroup, Row, Col, Card, Spinner, Alert } from 'react-bootstrap';
import { Search, BoxSeam, Hash, Building } from 'react-bootstrap-icons';
import { searchInventoryItems } from '../../service/api';
import type { InventoryItem } from './InventoryStatus';

interface InventoryItemBackend {
    id?: number;
    name?: string;
    description?: string;
    category?: string;
    baseQuantity?: number;
    stockQuantity?: number;
    supplier?: string;
    supplierId?: string;
    quantity?: number;  // Backend may use this field
    price?: number;
}

interface InventorySearchProps {
    onSearch?: (results: InventoryItem[]) => void;
}

// Supplier list endpoint (same as InventoryStatus)
const SUPPLIER_LIST_ENDPOINT = 'http://localhost:5000/kitcheniq/api/v1/admin/supplier-list';

interface SupplierOption {
    id: string;
    name: string;
}

const InventorySearch: React.FC<InventorySearchProps> = ({ onSearch }) => {
    const [searchForm, setSearchForm] = useState<{ name: string; supplierId: string; itemId: string }>({
        name: '',
        supplierId: '',
        itemId: ''
    });
    const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [hasSearched, setHasSearched] = useState<boolean>(false);
    const [suppliers, setSuppliers] = useState<SupplierOption[]>([{ id: '', name: 'All Suppliers' }]);
    const [loadingSuppliers, setLoadingSuppliers] = useState<boolean>(false);
    const [suppliersError, setSuppliersError] = useState<string>('');

    const handleInputChange = (field: string, value: string) => {
        setSearchForm(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const mapBackendToInventoryItem = useCallback((item: InventoryItemBackend): InventoryItem => {
        // Backend may return different field names, handle both formats
        const quantity = item.quantity ?? item.stockQuantity ?? item.baseQuantity ?? 0;
        const supplier = item.supplier ?? item.category ?? '';

        return {
            id: item.id ?? null,
            name: item.name ?? 'Unknown',
            description: item.description ?? '',
            category: supplier,  // Map supplier to category for display
            baseQuantity: item.baseQuantity ?? quantity,  // Use quantity if baseQuantity is not present
            stockQuantity: item.stockQuantity ?? quantity  // Use quantity if stockQuantity is not present
        };
    }, []);

    const performSearch = useCallback(async (): Promise<void> => {
        setLoading(true);
        setError('');
        setHasSearched(true);
        try {
            // Use backend search with name parameter (empty string returns all)
            const searchName = searchForm.name.trim() || undefined;

            let results: InventoryItem[];
            try {
                const response = await searchInventoryItems(searchName);
                const items: InventoryItemBackend[] = response.data ?? [];
                console.log('Backend items received:', items);
                results = items.map(mapBackendToInventoryItem);
                console.log('Mapped items:', results);
            } catch (err) {
                console.error('Search error:', err);
                setError('Error searching inventory items. Please try again.');
                setSearchResults([]);
                if (onSearch) onSearch([]);
                return;
            }

            // Apply frontend filters for ID
            if (searchForm.itemId.trim()) {
                const id = parseInt(searchForm.itemId.trim());
                if (!isNaN(id)) {
                    results = results.filter(item => item.id === id);
                }
            }

            // Apply frontend filter for supplier (using category field)
            // Only filter if a specific supplier is selected (not empty and not 'All Suppliers')
            if (searchForm.supplierId.trim() && searchForm.supplierId !== '') {
                const supplierId = searchForm.supplierId.trim();
                results = results.filter(item =>
                    item.category?.toLowerCase().includes(supplierId.toLowerCase())
                );
            }

            setSearchResults(results);
            if (onSearch) onSearch(results);
        } catch (err) {
            console.error('Unexpected error:', err);
            setError('Unexpected error occurred during search');
        } finally {
            setLoading(false);
        }
    }, [searchForm, onSearch, mapBackendToInventoryItem]);

    // Fetch suppliers on mount
    useEffect(() => {
        let mounted = true;
        const load = async () => {
            setLoadingSuppliers(true);
            setSuppliersError('');
            try {
                const token = localStorage.getItem('authToken');
                const headers: Record<string,string> = { 'Content-Type': 'application/json' };
                if (token) headers.Authorization = `Bearer ${token}`;
                const resp = await fetch(SUPPLIER_LIST_ENDPOINT, { headers });
                if (!mounted) return;
                if (!resp.ok) {
                    setSuppliers([{ id: '', name: 'All Suppliers' }]);
                    setSuppliersError(`Could not load suppliers (${resp.status})`);
                    return;
                }
                const data = await resp.json().catch(() => null);
                // normalize possible payload shapes: array or { data: [...] }
                let arr: unknown[] = [];
                if (Array.isArray(data)) arr = data;
                else if (data && typeof data === 'object') {
                    const obj = data as Record<string, unknown>;
                    if (Array.isArray(obj.data)) arr = obj.data as unknown[];
                }

                const opts = [{ id: '', name: 'All Suppliers' }].concat(
                    arr.map((s, idx) => {
                        if (s && typeof s === 'object') {
                            const so = s as Record<string, unknown>;
                            const idVal = so['id'] ?? so['supplierId'];
                            const nameVal = so['name'] ?? so['supplierName'] ?? idVal;
                            return { id: String(idVal ?? `SUP${idx+1}`), name: String(nameVal ?? `Supplier ${idx+1}`) };
                        }
                        return { id: `SUP${idx+1}`, name: `Supplier ${idx+1}` };
                    })
                );
                setSuppliers(opts);
            } catch (e) {
                const msg = e instanceof Error ? e.message : 'Error loading suppliers';
                setSuppliersError(msg);
                setSuppliers([{ id: '', name: 'All Suppliers' }]);
            } finally {
                if (mounted) setLoadingSuppliers(false);
            }
        };
        load();
        return () => { mounted = false; };
    }, []);

    const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        (async () => {
            await performSearch();
        })();
    };

    const handleClear = () => {
        setSearchForm({
            name: '',
            supplierId: '',
            itemId: ''
        });
        setSearchResults([]);
        setError('');
        setHasSearched(false);
        if (onSearch) {
            onSearch([]);
        }
    };


    return (
        <div className="h-100 d-flex flex-column">
            <h6 className="mb-3 fw-bold rounded-heading d-flex align-items-center">
                <span style={{letterSpacing: '0.5px'}}>SPECIALIZED SEARCH</span>
                <span className="ms-2 badge bg-info text-dark" style={{opacity: 0.85}}>Inventory</span>
            </h6>

            <Form onSubmit={handleSearch} className="mb-3">
                <Row className="g-2 align-items-end">
                    <Col lg={4} md={6} sm={12}>
                        <Form.Label className="mb-1">Item Name</Form.Label>
                        <InputGroup>
                            <InputGroup.Text style={{background:'#f8f9fa', borderColor:'#dee2e6'}}>
                                <BoxSeam size={16} />
                            </InputGroup.Text>
                            <Form.Control
                                type="text"
                                placeholder="Ex: Tomato"
                                value={searchForm.name}
                                onChange={(e) => handleInputChange('name', e.target.value)}
                            />
                        </InputGroup>
                    </Col>
                    <Col lg={3} md={6} sm={12}>
                        <Form.Label className="mb-1">Item ID</Form.Label>
                        <InputGroup>
                            <InputGroup.Text style={{background:'#f8f9fa', borderColor:'#dee2e6'}}>
                                <Hash size={16} />
                            </InputGroup.Text>
                            <Form.Control
                                type="text"
                                placeholder="Ex: 123"
                                value={searchForm.itemId}
                                onChange={(e) => handleInputChange('itemId', e.target.value)}
                            />
                        </InputGroup>
                    </Col>
                    <Col lg={3} md={6} sm={12}>
                        <Form.Label className="mb-1">Supplier</Form.Label>
                        <InputGroup>
                            <InputGroup.Text style={{background:'#f8f9fa', borderColor:'#dee2e6'}}>
                                <Building size={16} />
                            </InputGroup.Text>
                            <Form.Select
                                value={searchForm.supplierId}
                                onChange={(e) => handleInputChange('supplierId', e.target.value)}
                                style={{borderTopLeftRadius: 0, borderBottomLeftRadius: 0}}
                            >
                                {suppliers.map(supplier => (
                                    <option key={supplier.id} value={supplier.id}>
                                        {supplier.name}
                                    </option>
                                ))}
                            </Form.Select>
                            {loadingSuppliers && <Spinner animation="border" size="sm" className="ms-2" />}
                        </InputGroup>
                    </Col>
                    <Col lg={2} md={6} sm={12}>
                        <div className="d-grid gap-2">
                            <Button
                                variant="primary"
                                type="submit"
                                disabled={loading}
                                style={{background:'#86e5ff', borderColor:'#86e5ff', color:'#000'}}
                            >
                                {loading ? <Spinner size="sm" animation="border" /> : <Search size={18} />}
                            </Button>
                            <Button
                                variant="outline-secondary"
                                onClick={handleClear}
                                disabled={loading}
                                size="sm"
                            >
                                Clear
                            </Button>
                        </div>
                    </Col>
                </Row>
            </Form>

            {error && (
                <Alert variant="danger" className="mb-3">
                    {error}
                </Alert>
            )}

            {suppliersError && (
                <Alert variant="warning" className="mb-3">
                    {suppliersError}
                </Alert>
            )}

            <div className="flex-grow-1 overflow-auto" style={{ minHeight: 0 }}>
                {hasSearched && (
                    <div className="mb-2 d-flex flex-wrap justify-content-between align-items-center">
                        <h6 className="text-muted mb-2 mb-sm-0">
                            {searchResults.length} item(s) found
                        </h6>
                    </div>
                )}

                {searchResults.length > 0 ? (
                    // limit visible height to show up to 3 cards; enable scrolling if more
                    <div style={{ maxHeight: 360, overflowY: searchResults.length > 3 ? 'auto' : 'visible' }}>
                        <div className="d-flex flex-column gap-2">
                            {searchResults.map((item) => {
                                // Determine color based on absolute quantity ranges
                                const quantity = item.stockQuantity;
                                let quantityColor = '#28a745'; // Green by default
                                let borderColor = '#A3C6B0';

                                if (quantity === 0) {
                                    quantityColor = '#dc3545'; // Red
                                    borderColor = '#EA868F';
                                } else if (quantity < 10) {
                                    quantityColor = '#ffc107'; // Yellow/Orange
                                    borderColor = '#DEB887';
                                } else if (quantity < 30) {
                                    quantityColor = '#17a2b8'; // Cyan
                                    borderColor = '#86e5ff';
                                }

                                return (
                                    <Card
                                        key={String(item.id ?? item.name)}
                                        className="border-0 shadow-sm position-relative"
                                        style={{
                                            borderLeft: `4px solid ${borderColor}`,
                                            background: '#ffffff'
                                        }}
                                    >
                                        <Card.Body className="p-3">
                                            <div className="d-flex justify-content-between align-items-start mb-2">
                                                <div className="d-flex align-items-center flex-wrap gap-2">
                                                    <h6 className="mb-0">ID: {item.id ?? 'N/A'}</h6>
                                                    <span className="badge bg-light text-dark border">{item.name || 'Unnamed'}</span>
                                                </div>
                                            </div>

                                            <div className="mb-2">
                                                <small className="text-muted d-block">
                                                    <strong>Supplier:</strong> {item.category || 'N/A'}
                                                </small>
                                                {item.description && (
                                                    <small className="text-muted d-block">
                                                        <strong>Description:</strong> {item.description}
                                                    </small>
                                                )}
                                            </div>

                                            <div className="d-flex flex-wrap gap-3 mt-2 align-items-center">
                                                <div className="d-flex align-items-center">
                                                    <span className="badge bg-light text-dark border me-2">Available Quantity</span>
                                                    <span className="fw-bold fs-5" style={{color: quantityColor}}>{item.stockQuantity}</span>
                                                </div>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                );
                            })}
                        </div>
                    </div>
                ) : (hasSearched && !loading && (
                    <div className="text-center text-muted p-4">
                        <Search size={48} className="mb-2 opacity-50" />
                        <p>No inventory items found matching the search criteria.</p>
                    </div>
                ))}
            </div>
        </div>
    );

};

export default InventorySearch;
