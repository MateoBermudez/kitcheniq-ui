import React, { useState, useEffect } from 'react';
import {Container, Row, Col, Spinner, Alert} from 'react-bootstrap';
import {
    Clock,
} from 'react-bootstrap-icons';
import SupplierTable from './SupplierTable';
import SupplierSearch from './SupplierSearch';
import SupplierNotifications from './SupplierNotifications.tsx';
import { getAllSupplierItems } from '../../service/api';

export interface SupplierOrder {
    orderId: number | null;
    status: string;
    orderDate: string;
    totalAmount: number;
    items: SupplierOrderItem[];
}

export interface SupplierOrderItem {
    OrderId: number | null;
    itemName: string;
    itemId: number;
    quantity: number;
    unitPrice: number;
    subtotal: number;
}

interface SupplierStatusProps {
    onToast: (msg: string, type?: string) => void;
}

const SupplierStatus: React.FC<SupplierStatusProps> = ({ onToast }) => {
    const [searchTerm] = useState<string>('');
    const [currentTime, setCurrentTime] = useState<Date>(new Date());
    const [supplierOrders, setSupplierOrders] = useState<SupplierOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const intervalId = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(intervalId);
    }, []);

    const refreshOrders = async () => {
        setLoading(true);
        setError(null);
        try {
            // SUP001 is a placeholder supplier ID; replace with actual logic as needed
            let userId: string | null = localStorage.getItem('userId');
            if (!userId) {
                // /login or /
                // window.location.href = '/login';
                // return;
                // For now:
                userId = 'SUP001';
            }
            const response = await getAllSupplierItems(userId);
            const data = response.data ?? response;
            let orders: SupplierOrder[] = [];
            if (Array.isArray(data)) {
                orders = data;
            } else if (data.data && Array.isArray(data.data)) {
                orders = data.data;
            } else if (data.items && Array.isArray(data.items)) {
                orders = data.items;
            }
            setSupplierOrders(orders);
        } catch (err) {
            console.error('Error fetching supplier orders:', err);
            setError('Error loading supplier orders');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshOrders();
    }, []);

    return (
        <div className="d-flex flex-column" style={{backgroundColor: 'white'}}>
            <Container fluid className="py-4">
                <div className="p-3 border rounded-4 shadow mb-4">
                    <div className="d-flex justify-content-between align-items-center mb-4">
                        <div>
                            <h2 className="mb-1 rounded-heading">SUPPLIERS</h2>
                            <small className="text-muted">
                                <Clock size={14} className="me-1" />
                                {currentTime.toLocaleTimeString()}
                            </small>
                        </div>
                    </div>
                    {loading ? (
                        <Spinner animation="border" variant="primary" className="mt-3" />
                    ) : error ? (
                        <Alert variant="danger" className="mt-3">{error}</Alert>
                    ) : (
                        <SupplierTable
                            searchTerm={searchTerm}
                            onToast={onToast}
                            items={supplierOrders}
                            onRefresh={refreshOrders}
                        />
                    )}
                </div>
                <Row>
                    <Col md={6}>
                        <div className="p-3 border rounded-4 shadow h-100">
                            <SupplierSearch items={supplierOrders} onSearch={() => {}} />
                        </div>
                    </Col>
                    <Col md={6}>
                        <div className="p-3 border rounded-4 shadow h-100">
                            <SupplierNotifications items={supplierOrders} onToast={onToast} />
                        </div>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default SupplierStatus;
