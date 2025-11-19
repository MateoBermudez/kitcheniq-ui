import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Spinner, Alert, Dropdown, Modal, Button, Form } from 'react-bootstrap';
import { ThreeDots, Plus, PencilSquare, Trash, XCircle, Check2Circle, BoxSeam } from 'react-bootstrap-icons';

interface InventoryTableProps {
    searchTerm: string;
    onToast: (msg: string, type?: string) => void;
}

// Product interface
interface Product {
    id: number | null;
    name: string;
    description: string;
    category: string;
    stockQuantity: number;
    price: number;
    supplier: string; // new supplier field
}

interface RawProduct {
    id?: number;
    itemId?: number;
    name?: string;
    itemName?: string;
    description?: string;
    category?: string;
    type?: string;
    stockQuantity?: number;
    quantity?: number;
    price?: number;
    unitPrice?: number;
    cost?: number;
    supplier?: string;
}

const INVENTORY_LIST_ENDPOINT = 'http://localhost:5000/kitcheniq/api/v1/admin/inventory-list';
const CREATE_ENDPOINT = 'http://localhost:5000/kitcheniq/api/v1/admin/add-inventory-item'; // updated
const TOKEN_KEY = 'authToken';

const InventoryTable: React.FC<InventoryTableProps> = ({ searchTerm, onToast }) => {
    const [items, setItems] = useState<Product[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    // Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [newProduct, setNewProduct] = useState<Omit<Product, 'id'>>({ name: '', description: '', category: '', stockQuantity: 0, price: 0, supplier: '' });
    const [savingAdd, setSavingAdd] = useState(false);

    const [showEditModal, setShowEditModal] = useState(false);
    const [productToEdit, setProductToEdit] = useState<Product | null>(null);

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [productToDelete, setProductToDelete] = useState<Product | null>(null);

    const [suppliers, setSuppliers] = useState<string[]>([]);
    const [refreshing, setRefreshing] = useState<boolean>(false); // nuevo estado para refresco silencioso

    const authHeaders = (): HeadersInit => {
        const token = localStorage.getItem(TOKEN_KEY);
        const base: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) base.Authorization = `Bearer ${token}`;
        return base;
    };

    // Helper to safely parse numeric values (including decimal strings)
    const parseNumeric = (val: unknown, fallback = 0): number => {
        if (typeof val === 'number') return isNaN(val) ? fallback : val;
        if (typeof val === 'string') {
            const n = Number(val.trim());
            return isNaN(n) ? fallback : n;
        }
        return fallback;
    };

    const mapRawProducts = (arr: RawProduct[]): Product[] => {
        return arr.map((p: RawProduct, idx: number) => ({
            id: typeof p.id === 'number' ? p.id : (typeof p.itemId === 'number' ? p.itemId : idx + 1),
            name: p.name ?? p.itemName ?? 'Unnamed',
            description: p.description ?? '',
            category: p.category ?? p.type ?? 'General',
            stockQuantity: typeof p.stockQuantity === 'number' ? p.stockQuantity : (typeof p.quantity === 'number' ? p.quantity : 0),
            price: parseNumeric(p.price ?? p.unitPrice ?? p.cost, 0),
            supplier: p.supplier ?? 'Unknown'
        }));
    };

    // Single source load (no fallbacks)
    const getAllProducts = useCallback(async (): Promise<Product[]> => {
        console.log('[InventoryTable] Fetching inventory list...');
        const resp = await fetch(INVENTORY_LIST_ENDPOINT, { headers: authHeaders() });
        if (!resp.ok) {
            const { status, statusText } = resp;
            console.error(`[InventoryTable] Fetch failed: ${status} ${statusText}`);
            throw new Error(status === 401 ? 'Unauthorized: token missing or expired' : `Inventory request failed (${status})`);
        }
        let data: unknown;
        try {
            data = await resp.json();
        } catch (parseErr) {
            console.error('[InventoryTable] JSON parse error:', parseErr);
            throw new Error('Invalid inventory response (JSON parse failed)');
        }

        const extractArray = (src: unknown): RawProduct[] => {
            if (Array.isArray(src)) return src as RawProduct[];
            if (typeof src === 'object' && src !== null) {
                const obj = src as Record<string, unknown>;
                const keys = ['data','items','inventory','inventoryItems','inventoryList'];
                for (const k of keys) {
                    const v = obj[k];
                    if (Array.isArray(v)) return v as RawProduct[];
                }
            }
            return [];
        };

        const arr = extractArray(data);
        if (!Array.isArray(arr)) {
            console.error('[InventoryTable] Expected array, got:', arr);
            throw new Error('Inventory response format not recognized');
        }
        const mapped = mapRawProducts(arr);
        console.log(`[InventoryTable] Mapped products (${mapped.length}):`, mapped);
        return mapped;
    }, []);

    const createProductRemote = useCallback(async (input: { name: string; quantity: number; supplier: string; price: number; }): Promise<Product> => {
        try {
            const resp = await fetch(CREATE_ENDPOINT, {
                method: 'POST',
                headers: authHeaders(),
                body: JSON.stringify(input)
            });
            if (!resp.ok) throw new Error(`Create product failed (${resp.status})`);
            const data: unknown = await resp.json();
            const raw = (typeof data === 'object' && data) ? data as RawProduct : {};
            return {
                id: raw?.id ?? raw?.itemId ?? null,
                name: raw?.name ?? input.name,
                description: raw?.description ?? '',
                category: raw?.category ?? 'General',
                stockQuantity: typeof raw?.stockQuantity === 'number' ? raw.stockQuantity : input.quantity,
                price: parseNumeric(raw?.price ?? raw?.unitPrice ?? raw?.cost, input.price),
                supplier: raw?.supplier ?? input.supplier
            };
        } catch (e) {
            throw e instanceof Error ? e : new Error('Create product error');
        }
    }, []);

    // Initial load
    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            setError(null);
            try {
                const list = await getAllProducts();
                if (mounted) {
                    setItems(list);
                    const uniq = Array.from(new Set(list.map(p => p.supplier).filter(Boolean)));
                    setSuppliers(uniq);
                }
            } catch (err) {
                const msg = err instanceof Error ? err.message : 'Error loading inventory items';
                setError(msg);
                onToast(msg, 'error');
            } finally {
                if (mounted) setLoading(false);
            }
        })();
        return () => { mounted = false; };
    }, [getAllProducts, onToast]);

    // Background refresh cada minuto (60s) sin pantalla de carga
    useEffect(() => {
        let mounted = true;
        const backgroundRefresh = async () => {
            if (!mounted) return;
            try {
                setRefreshing(true);
                const list = await getAllProducts();
                if (!mounted) return;
                setItems(list);
                const uniq = Array.from(new Set(list.map(p => p.supplier).filter(Boolean)));
                setSuppliers(uniq);
            } catch (err) {
                // Sólo notificar si no había error previo para evitar spam
                if (!error) {
                    const msg = err instanceof Error ? err.message : 'Error refreshing inventory';
                    onToast(msg, 'warning');
                }
            } finally {
                if (mounted) setRefreshing(false);
            }
        };
        const intervalId = setInterval(backgroundRefresh, 60000); // 1 minuto
        return () => { mounted = false; clearInterval(intervalId); };
    }, [getAllProducts, error, onToast]);

    // Filtering
    const filteredItems = useMemo(() => {
        if (!searchTerm) return items;
        const term = searchTerm.toLowerCase();
        return items.filter(item =>
            item.name.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term) ||
            item.category.toLowerCase().includes(term) ||
            item.supplier.toLowerCase().includes(term)
        );
    }, [items, searchTerm]);

    // UI handlers
    const [selectedSupplier, setSelectedSupplier] = useState<string>('');
    const [priceInput, setPriceInput] = useState<string>('');
    const [priceValid, setPriceValid] = useState<boolean>(false);

    const openAddModal = () => {
        setNewProduct({ name: '', description: '', category: '', stockQuantity: 0, price: 0, supplier: '' } as Omit<Product,'id'>);
        setSelectedSupplier('');
        setPriceInput('');
        setPriceValid(false);
        setShowAddModal(true);
    };

    const handlePriceChange = (raw: string) => {
        // Replace comma with dot, allow digits and single dot
        const normalized = raw.replace(/,/g, '.');
        // Allow empty (in-progress)
        if (normalized === '') {
            setPriceInput(raw);
            setPriceValid(false);
            setNewProduct(p => ({ ...p, price: 0 }));
            return;
        }
        // Validate pattern: digits optionally with one dot and up to 2 decimals
        if (!/^\d+(\.\d{0,2})?$/.test(normalized)) {
            // Keep showing raw but mark invalid
            setPriceInput(raw);
            setPriceValid(false);
            return;
        }
        const num = Number(normalized);
        if (isNaN(num) || num < 0) {
            setPriceInput(raw);
            setPriceValid(false);
            return;
        }
        setPriceInput(raw);
        setPriceValid(true);
        setNewProduct(p => ({ ...p, price: num }));
    };

    const submitAddProduct = async () => {
        if (!newProduct.name.trim()) { onToast('Name is required', 'error'); return; }
        if (!newProduct.category.trim()) { onToast('Category is required', 'error'); return; }
        if (!selectedSupplier.trim()) { onToast('Supplier is required', 'error'); return; }
        if (!priceValid) { onToast('Enter a valid price', 'error'); return; }
        try {
            setSavingAdd(true);
            const payload = {
                name: newProduct.name,
                quantity: 0, // always 0 per requirement
                supplier: selectedSupplier,
                price: newProduct.price
            };
            const created = await createProductRemote(payload);
            created.stockQuantity = 0;
            setItems(prev => [...prev, created]);
            setShowAddModal(false);
            onToast(`Product "${created.name}" added`, 'success');

            // Dispatch event for inventory notifications
            window.dispatchEvent(new CustomEvent('inventory-item-added', {
                detail: {
                    itemId: created.id,
                    itemName: created.name,
                    quantity: created.stockQuantity || 0,
                    supplier: selectedSupplier,
                    timestamp: Date.now()
                }
            }));
        } catch (e) {
            const msg = e instanceof Error ? e.message : 'Could not create product';
            onToast(msg, 'error');
        } finally {
            setSavingAdd(false);
        }
    };

    const openEditModal = (p: Product) => {
        setProductToEdit({ ...p });
        setShowEditModal(true);
    };

    const openDeleteModal = (p: Product) => {
        setProductToDelete(p);
        setShowDeleteModal(true);
    };

    const retryLoad = async () => {
        setLoading(true);
        setError(null);
        try {
            const list = await getAllProducts();
            setItems(list);
            onToast('Inventory reloaded', 'success');
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error loading inventory items';
            setError(msg);
            onToast(msg, 'error');
        } finally {
            setLoading(false);
        }
    };

    // Render states
    if (loading) {
        return (
            <div className="bg-white rounded shadow-sm">
                <div className="p-5 text-center">
                    <Spinner animation="border" variant="primary" />
                    <div className="mt-2 text-muted">Loading inventory...</div>
                </div>
            </div>
        );
    }

    return (
        <div>
            {error && (
                <Alert variant="danger" className="mb-2 d-flex justify-content-between align-items-center">
                    <span>{error}</span>
                    <Button variant="outline-light" size="sm" onClick={retryLoad}>Retry</Button>
                </Alert>
            )}
            <div className="d-flex justify-content-end mb-2">
                <Button variant="primary" size="sm" onClick={openAddModal} style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}>
                    <Plus size={16} className="me-1" /> Add Product
                </Button>
                {refreshing && (
                    <div className="d-flex align-items-center ms-3 small text-muted" style={{gap: '4px'}}>
                        <Spinner animation="border" size="sm" /> <span>Refreshing...</span>
                    </div>
                )}
            </div>
            <Table striped bordered hover responsive className="mt-2">
                <thead>
                <tr>
                    <th style={{width: '80px'}}>ID</th>
                    <th>Name</th>
                    <th>Supplier</th>
                    <th style={{width: '120px'}}>Price</th>
                    <th style={{width: '150px'}}>Stock Quantity</th>
                    <th style={{width: '70px'}}>Actions</th>
                </tr>
                </thead>
                <tbody>
                {filteredItems.length === 0 ? (
                    <tr>
                        <td colSpan={6} className="text-center text-muted">No inventory items found.</td>
                    </tr>
                ) : (
                    filteredItems.map(item => (
                        <tr key={item.id ?? item.name}>
                            <td>{item.id}</td>
                            <td>{item.name}</td>
                            <td>{item.supplier}</td>
                            <td>${item.price.toFixed(2)}</td>
                            <td>{item.stockQuantity}</td>
                            <td>
                                <Dropdown>
                                    <Dropdown.Toggle variant="outline-secondary" size="sm">
                                        <ThreeDots size={16} />
                                    </Dropdown.Toggle>
                                    <Dropdown.Menu className="dropdown-menu-super" popperConfig={{ strategy: 'fixed' }}>
                                        <Dropdown.Item onClick={() => openEditModal(item)}>
                                            <PencilSquare size={16} className="me-2" /> Edit Product
                                        </Dropdown.Item>
                                        <Dropdown.Item onClick={() => openDeleteModal(item)} className="text-danger">
                                            <Trash size={16} className="me-2" /> Delete Product
                                        </Dropdown.Item>
                                    </Dropdown.Menu>
                                </Dropdown>
                            </td>
                        </tr>
                    ))
                )}
                </tbody>
            </Table>

            {/* Modal: Add */}
            <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <BoxSeam size={18} className="me-2" /> Add Product
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3" controlId="prdName">
                            <Form.Label>Name *</Form.Label>
                            <Form.Control
                                type="text"
                                value={newProduct.name}
                                onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))}
                                placeholder="Product name"
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="prdDesc">
                            <Form.Label>Description</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={newProduct.description}
                                onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))}
                                placeholder="Product description"
                            />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="prdCat">
                            <Form.Label>Category *</Form.Label>
                            <Form.Control
                                type="text"
                                value={newProduct.category}
                                onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}
                                placeholder="Category"
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="prdSupplier">
                            <Form.Label>Supplier *</Form.Label>
                            <Form.Select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} required>
                                <option value="">Select supplier</option>
                                {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
                            </Form.Select>
                        </Form.Group>
                        <Form.Group className="mb-1" controlId="prdPrice">
                            <Form.Label>Price *</Form.Label>
                            <Form.Control
                                type="text"
                                inputMode="decimal"
                                placeholder="Ej: 12.50 o 12,50"
                                value={priceInput}
                                onChange={e => handlePriceChange(e.target.value)}
                                required
                            />
                            {!priceValid && priceInput !== '' && (
                                <div className="text-danger small mt-1">Invalid format. Use 12.34 or 12,34 (max 2 decimals).</div>
                            )}
                        </Form.Group>
                        <Form.Text className="text-muted">Stock Quantity is fixed to 0 when creating a product.</Form.Text>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowAddModal(false)}>
                        <XCircle size={16} className="me-1" /> Cancel
                    </Button>
                    <Button variant="primary" onClick={submitAddProduct} disabled={savingAdd || !newProduct.name || !newProduct.category || !selectedSupplier || !priceValid} style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}>
                        <Check2Circle size={16} className="me-1" /> Add
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Modal: Edit (placeholder) */}
            <Modal show={showEditModal} onHide={() => setShowEditModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <PencilSquare size={18} className="me-2" /> Edit Product (coming soon)
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {productToEdit ? (
                        <Form>
                            <Form.Group className="mb-3">
                                <Form.Label>Name</Form.Label>
                                <Form.Control value={productToEdit.name} disabled readOnly />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Description</Form.Label>
                                <Form.Control as="textarea" rows={2} value={productToEdit.description} disabled readOnly />
                            </Form.Group>
                            <Form.Group className="mb-3">
                                <Form.Label>Category</Form.Label>
                                <Form.Control value={productToEdit.category} disabled readOnly />
                            </Form.Group>
                            <Form.Group className="mb-1">
                                <Form.Label>Stock Quantity</Form.Label>
                                <Form.Control type="number" value={productToEdit.stockQuantity} disabled readOnly />
                            </Form.Group>
                            <div className="mt-2 text-muted"><small>This feature will be available soon.</small></div>
                        </Form>
                    ) : (
                        <div className="text-muted">No product selected.</div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowEditModal(false)}>
                        <XCircle size={16} className="me-1" /> Close
                    </Button>
                    <Button variant="primary" disabled>
                        <Check2Circle size={16} className="me-1" /> Save Changes
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Modal: Delete (placeholder) */}
            <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <Trash size={18} className="me-2" /> Delete Product (coming soon)
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {productToDelete ? (
                        <div>
                            <p>Delete product "{productToDelete.name}"?</p>
                            <Alert variant="warning" className="mb-0">This action is temporarily disabled.</Alert>
                        </div>
                    ) : (
                        <div className="text-muted">No product selected.</div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
                        <XCircle size={16} className="me-1" /> Cancel
                    </Button>
                    <Button variant="danger" disabled>
                        <Trash size={16} className="me-1" /> Delete
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default InventoryTable;
