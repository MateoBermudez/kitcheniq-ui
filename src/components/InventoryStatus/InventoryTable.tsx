import React, { useState, useEffect, useCallback } from 'react';
import { Table, Spinner, Alert } from 'react-bootstrap';
import { getAllInventoryItems } from '../../service/api';
import type { InventoryItem } from './InventoryStatus';

interface InventoryTableProps {
    searchTerm: string;
    onToast: (msg: string, type?: string) => void;
}

const mockInventoryItems: InventoryItem[] = [
    { id: 1, name: 'Tomato', description: 'Fresh tomatoes', category: 'Vegetable', baseQuantity: 50, stockQuantity: 20 },
    { id: 2, name: 'Chicken Breast', description: 'Boneless chicken breast', category: 'Meat', baseQuantity: 30, stockQuantity: 10 },
    { id: 3, name: 'Rice', description: 'White rice', category: 'Grain', baseQuantity: 100, stockQuantity: 80 }
];

const InventoryTable: React.FC<InventoryTableProps> = ({ searchTerm, onToast }) => {
    const [items, setItems] = useState<InventoryItem[]>(mockInventoryItems);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Commented out API loading for mock data
    // const loadItems = useCallback(async () => {
    //     try {
    //         setLoading(true);
    //         setError(null);
    //         const response = await getAllInventoryItems();
    //         const data = response.data ?? response;
    //         let inventoryItems: InventoryItem[] = [];
    //         if (Array.isArray(data)) {
    //             inventoryItems = data;
    //         } else if (data.data && Array.isArray(data.data)) {
    //             inventoryItems = data.data;
    //         } else if (data.items && Array.isArray(data.items)) {
    //             inventoryItems = data.items;
    //         }
    //         setItems(inventoryItems);
    //     } catch (error: unknown) {
    //         console.error(error);
    //         setError('Error loading inventory items');
    //         onToast('Error loading inventory items', 'error');
    //     } finally {
    //         setLoading(false);
    //     }
    // }, [onToast]);

    // useEffect(() => {
    //     loadItems().then(() => {});
    // }, []);

    // Update items when new data is available
    /*
    useEffect(() => {
        window.updateInventoryTable = (newItem) => {
            setItems((currentItems: InventoryItem[]) => {
                if (!newItem || !newItem.name || !newItem.id) {
                    return currentItems;
                }
                // Replace or add the new item
                const updatedItems = currentItems.filter(item => item.id !== newItem.id);
                updatedItems.push(newItem);
                return updatedItems;
            });
            loadItems().then(() => {});
        };
        return () => {
            delete window.updateInventoryTable;
        };
    }, [loadItems]);

     */

    // Filter items by search term
    const filteredItems = React.useMemo(() => {
        if (!searchTerm) return items;
        const term = searchTerm.toLowerCase();
        return items.filter(item =>
            item.name.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term) ||
            item.category.toLowerCase().includes(term)
        );
    }, [items, searchTerm]);

    // Periodic refresh every 30 seconds
    /*
    useEffect(() => {
        const intervalId = setInterval(() => {
            loadItems().then(() => {});
        }, 30000); // 30 seconds
        return () => clearInterval(intervalId);
    }, [loadItems]);

     */

    if (loading) {
        return <div className="d-flex justify-content-center align-items-center py-4"><Spinner animation="border" /></div>;
    }
    if (error) {
        return <Alert variant="danger">{error}</Alert>;
    }

    return (
        <Table striped bordered hover responsive className="mt-2">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Category</th>
                    <th>Base Quantity</th>
                    <th>Stock Quantity</th>
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
                            <td>{item.description}</td>
                            <td>{item.category}</td>
                            <td>{item.baseQuantity}</td>
                            <td>{item.stockQuantity}</td>
                        </tr>
                    ))
                )}
            </tbody>
        </Table>
    );
};

export default InventoryTable;
