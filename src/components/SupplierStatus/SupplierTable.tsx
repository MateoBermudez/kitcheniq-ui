import React, { useState, useEffect, useCallback } from 'react';
import { Table, Spinner, Alert } from 'react-bootstrap';
import { getAllSupplierItems } from '../../service/api';
import type { SupplierOrder } from './SupplierStatus';

interface SupplierTableProps {
    searchTerm: string;
    onToast: (msg: string, type?: string) => void;
}

const SupplierTable: React.FC<SupplierTableProps> = ({ searchTerm, onToast }) => {
    const [items, setItems] = useState<SupplierOrder[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadItems = useCallback(async () => {
         try {
             setLoading(true);
             setError(null);
             // Change "SUP001" to the actual supplier ID as needed -> Auth context
             const response = await getAllSupplierItems("SUP001");
             const data = response.data ?? response;
             let supplierItems: SupplierOrder[] = [];
             if (Array.isArray(data)) {
                 supplierItems = data;
             } else if (data.data && Array.isArray(data.data)) {
                 supplierItems = data.data;
             } else if (data.items && Array.isArray(data.items)) {
                 supplierItems = data.items;
             }
             setItems(supplierItems);
         } catch (error: unknown) {
             console.error(error);
             setError('Error loading supplier items');
             onToast('Error loading supplier items', 'error');
         } finally {
             setLoading(false);
         }
     }, [onToast]);

     useEffect(() => {
         loadItems().then(() => {});
     }, []);

    // Reload supplier items every 30 seconds

    useEffect(() => {
        const interval = setInterval(() => {
            loadItems().then(() => {});
        }, 30000);
        return () => clearInterval(interval);
    }, [loadItems]);

    // Filter items based on search term -> Use new Definition of SupplierOrder
    const filteredItems = items.filter(item =>
        item.orderId && item.orderDate && item.status &&
        (
            String(item.orderId).toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.orderDate.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.status.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    if (loading) {
        return <Spinner animation="border" variant="primary" className="mt-3" />;
    }
    if (error) {
        return <Alert variant="danger" className="mt-3">{error}</Alert>;
    }

    return (
        <Table striped bordered hover responsive className="mt-2">
            <thead>
            <tr>
                <th>ID</th>
                <th>Status</th>
                <th>Request Day</th>
                <th>Total Amount</th>
                <th>Options</th>
            </tr>
            </thead>
            <tbody>
            {filteredItems.length === 0 ? (
                <tr>
                    <td colSpan={5} className="text-center text-muted">No supplier orders found.</td>
                </tr>
            ) : (
                filteredItems.map(item => (
                    <tr key={item.orderId}>
                        <td>{item.orderId}</td>
                        <td>{item.status}</td>
                        <td>{item.orderDate}</td>
                        <td>{item.totalAmount}</td>
                        <td></td>
                    </tr>
                ))
            )}
            </tbody>
        </Table>
    );
};

export default SupplierTable;
