import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Modal, Form } from 'react-bootstrap';
import {
    PlusCircle,
    BoxSeam,
    Clock,
    XCircle,
    CheckCircle
} from 'react-bootstrap-icons';
import InventoryTable from './InventoryTable';
import InventorySearch from './InventorySearch';
import {createInventoryItem} from "../../service/api.ts";
import InventoryNotifications from "./InventoryNotifications.tsx";

export interface InventoryItem {
    id: number | null;
    name: string;
    description: string;
    category: string;
    baseQuantity: number;
    stockQuantity: number;
}

interface InventoryStatusProps {
    onToast: (msg: string, type?: string) => void;
}

declare global {
    interface Window {
        updateInventoryTable?: (inventory: InventoryItem) => void;
    }
}

const InventoryStatus: React.FC<InventoryStatusProps> = ({ onToast }) => {
    const [searchTerm] = useState<string>('');
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
    const [newInventoryItem, setNewInventoryItem] = useState<InventoryItem>({
        id: null,
        name: '',
        description: '',
        category: '',
        baseQuantity: 0,
        stockQuantity: 0
    });

    useEffect(() => {
        const intervalId = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(intervalId);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setNewInventoryItem({
            ...newInventoryItem,
            [name]: name === 'baseQuantity' || name === 'stockQuantity' ? Number(value) : value
        });
    };

    const handleCreateInventoryItem = () => {
        if (!newInventoryItem.name.trim()) {
            onToast('Name is required', 'error');
            return;
        }
        if (!newInventoryItem.category.trim()) {
            onToast('Category is required', 'error');
            return;
        }
        if (newInventoryItem.baseQuantity < 0 || newInventoryItem.stockQuantity < 0) {
            onToast('Quantities must be non-negative', 'error');
            return;
        }

        createInventoryItem(newInventoryItem)
            .then(() => {
                console.log(newInventoryItem);
                setNewInventoryItem({
                    id: null,
                    name: '',
                    description: '',
                    category: '',
                    baseQuantity: 0,
                    stockQuantity: 0
                });
                setShowCreateModal(false);
                onToast(`Inventory item "${newInventoryItem.name}" created successfully`, 'success');
            })
            .catch(error => {
                const errorMessage = error?.response?.data?.message || error.message || 'Could not create inventory item. Please try again.';
                onToast(errorMessage, 'error');
            });
    };

    return (
        <div className="d-flex flex-column" style={{backgroundColor: 'white'}}>
            <Container fluid className="py-4">
                <div className="p-3 border rounded-4 shadow mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 className="mb-1 rounded-heading">INVENTORY</h2>
                            <small className="text-muted">
                                <Clock size={14} className="me-1" />
                                {currentTime.toLocaleTimeString()}
                            </small>
                        </div>
                        <Button
                            variant="primary"
                            onClick={() => setShowCreateModal(true)}
                            className="d-flex align-items-center"
                            style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}
                        >
                            <PlusCircle size={18} className="me-2" />
                            Create Inventory Item
                        </Button>
                    </div>
                    <InventoryTable
                        searchTerm={searchTerm}
                        onToast={onToast}
                    />
                </div>
                <Row>
                    <Col md={6}>
                        <div className="p-3 border rounded-4 shadow h-100">
                            <InventorySearch onSearch={() => {}} />
                        </div>
                    </Col>
                    <Col md={6}>
                        <div className="p-3 border rounded-4 shadow h-100">
                            <InventoryNotifications onToast={onToast} />
                        </div>
                    </Col>
                </Row>
            </Container>
            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} size="lg">
                <Modal.Header closeButton>
                    <Modal.Title>
                        <BoxSeam size={20} className="me-2" />
                        CREATE NEW INVENTORY ITEM
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3" controlId="name">
                            <Form.Label>Name *</Form.Label>
                            <Form.Control
                                type="text"
                                name="name"
                                value={newInventoryItem.name}
                                onChange={handleInputChange}
                                placeholder="Product name"
                                required
                            />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="description">
                            <Form.Label>Description</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                name="description"
                                value={newInventoryItem.description}
                                onChange={handleInputChange}
                                placeholder="Product description"
                            />
                        </Form.Group>
                        <Form.Group className="mb-3" controlId="category">
                            <Form.Label>Category *</Form.Label>
                            <Form.Control
                                type="text"
                                name="category"
                                value={newInventoryItem.category}
                                onChange={handleInputChange}
                                placeholder="Category"
                                required
                            />
                        </Form.Group>
                        <Row>
                            <Col md={6}>
                                <Form.Group className="mb-3" controlId="baseQuantity">
                                    <Form.Label>Base Quantity *</Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="baseQuantity"
                                        value={newInventoryItem.baseQuantity}
                                        onChange={handleInputChange}
                                        min="0"
                                        required
                                    />
                                </Form.Group>
                            </Col>
                            <Col md={6}>
                                <Form.Group className="mb-3" controlId="stockQuantity">
                                    <Form.Label>Stock Quantity *</Form.Label>
                                    <Form.Control
                                        type="number"
                                        name="stockQuantity"
                                        value={newInventoryItem.stockQuantity}
                                        onChange={handleInputChange}
                                        min="0"
                                        required
                                    />
                                </Form.Group>
                            </Col>
                        </Row>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowCreateModal(false)}>
                        <XCircle size={16} className="me-1" />
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleCreateInventoryItem}
                        style={{ backgroundColor: '#B1E5FF', borderColor: '#B1E5FF', color: '#000' }}
                        disabled={!newInventoryItem.name || !newInventoryItem.category || newInventoryItem.baseQuantity < 0 || newInventoryItem.stockQuantity < 0}
                    >
                        <CheckCircle size={16} className="me-1" />
                        Create Inventory Item
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default InventoryStatus;
