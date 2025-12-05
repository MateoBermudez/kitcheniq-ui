import React, { useState } from 'react';
import {Table, Alert, Dropdown, Modal, Button, Form} from 'react-bootstrap';
import {
    changeSupplierOrderStatus,
    deliverSupplierItem,
    finishSupplierDispatch,
    getSupplierOrderPdf, initiateDispatch
} from '../../service/api';
import type { SupplierOrder } from './SupplierStatus';
import {FileText, HourglassSplit, ThreeDots, Truck, XCircle, Check2Circle} from "react-bootstrap-icons";
import '../../App.scss';

interface SupplierTableProps {
    searchTerm: string;
    onToast: (msg: string, type?: string) => void;
    items: SupplierOrder[];
    onRefresh: () => void;
}

const SupplierTable: React.FC<SupplierTableProps> = ({ searchTerm, onToast, items, onRefresh }) => {
    const [dispatchingOrder, setDispatchingOrder] = useState<SupplierOrder | null>(null);
    const [dispatchQuantities, setDispatchQuantities] = useState<{[itemId: number]: number}>({});
    const [showDispatchModal, setShowDispatchModal] = useState(false);
    const [dispatchError, setDispatchError] = useState<string | null>(null);

    const [showCancelModal, setShowCancelModal] = useState(false);
    const [orderToCancel, setOrderToCancel] = useState<SupplierOrder | null>(null);

    const [acceptedItems, setAcceptedItems] = useState<{[itemId: number]: boolean}>({});

    const [showPreviewModal, setShowPreviewModal] = useState(false);
    const [previewOrder, setPreviewOrder] = useState<SupplierOrder | null>(null);

    const [total, setTotal] = useState<number | null>(null);

    const openDispatchModal = async (order: SupplierOrder) => {
        if (order.status !== 'ACCEPTED') {
            onToast('Order must be ACCEPTED before dispatching.', 'warning');
            return;
        }
        try {
            if (order.orderId === null) {
                onToast('Invalid order ID', 'error');
                return;
            }
            await initiateDispatch(order.orderId);
            setDispatchingOrder(order);
            // Initialize dispatch quantities to 0 for each item
            const initialQuantities: { [itemId: number]: number } = {};
            const initialAccepted: { [itemId: number]: boolean } = {};
            order.items.forEach(item => {
                initialQuantities[item.itemId] = 0;
                initialAccepted[item.itemId] = false;
            });
            setDispatchQuantities(initialQuantities);
            setAcceptedItems(initialAccepted);
            setShowDispatchModal(true);
            setDispatchError(null);
            setTotal(order.totalAmount)
        } catch (error) {
            console.error('Error changing order status to DISPATCHING:', error);
            onToast('Error changing order status', 'error');
        }
    };

    const handleQuantityChange = (itemId: number, value: number) => {
        setDispatchQuantities(prev => ({ ...prev, [itemId]: value }));
    };

    const handleAcceptItem = async (itemId: number, orderId: number) => {
        const order = items.find(o => o.orderId === orderId);
        if (!order) return;

        const item = order.items.find(i => i.itemId === itemId);


        if (!item) return;

        item.quantity = dispatchQuantities[itemId];

        try {
            console.log('Accepting item:', item);
            const response = await deliverSupplierItem(item);
            console.log('Item accepted:', response);
            setAcceptedItems(prev => ({ ...prev, [itemId]: true }));

            console.log(response.data)

            if (response.data && typeof response.data === 'number') {
                setTotal(response.data);
            }

            if (response.data === 0) {
                setTotal(0)
            }

        } catch (error) {
            console.error('Error accepting item:', error);
            onToast('Error accepting item', 'error');
        }
    };

    const confirmDispatch = async () => {
        if (!dispatchingOrder) return;
        // Validate that all items have been accepted
        const allAccepted = dispatchingOrder.items.every(item => acceptedItems[item.itemId]);
        if (!allAccepted) {
            setDispatchError('Please accept all items before confirming dispatch.');
            return;
        }
        // Validate that all quantities are valid
        const allSelected = dispatchingOrder.items.every(item =>
            dispatchQuantities[item.itemId] !== undefined &&
            dispatchQuantities[item.itemId] >= 0 &&
            dispatchQuantities[item.itemId] <= item.quantity
        );
        if (!allSelected) {
            setDispatchError('Please select a valid quantity for each item.');
            return;
        }
        // Here you would call the API to confirm the dispatch
        const allZero = Object.values(dispatchQuantities).every(qty => qty === 0);

        try {
            if (dispatchingOrder.orderId === null) {
                setDispatchError('Invalid order ID');
                return;
            }
            await finishSupplierDispatch(dispatchingOrder.orderId);
            if (allZero) {
                onToast('Order cancelled as no items were dispatched', 'danger');
            } else {
                onToast(`Order ${dispatchingOrder.orderId} dispatched!`, 'success');
            }
            setShowDispatchModal(false);
            setDispatchingOrder(null);
            setDispatchQuantities({});
            setAcceptedItems({});
            setDispatchError(null);
            setTotal(null);
            onRefresh();
        } catch (error) {
            console.error(error);
            setDispatchError('Error confirming dispatch');
            return;
        }
    };

    const handleSeeOrderReport = async (orderId: number) => {
        if (!orderId) return;

        if (items.find(item => item.orderId === orderId)?.status !== 'DELIVERED') {
            onToast('Order must be DELIVERED to view report', 'warning');
            return;
        }

        try {
            await getSupplierOrderPdf(orderId);
        } catch (error) {
            console.error(error);
            onToast('Error fetching PDF', 'error');
        }
    };

    const openCancelModal = (order: SupplierOrder) => {
        setOrderToCancel(order);
        setShowCancelModal(true);
    };
    const cancelCancelModal = () => {
        setShowCancelModal(false);
        setOrderToCancel(null);
    };
    const confirmCancelOrder = async () => {
        if (!orderToCancel) return;
        // Here you would call the API to cancel the order
        try {
            console.log('Cancelling order:', orderToCancel.orderId);
            const response = await changeSupplierOrderStatus(orderToCancel.orderId!, 'CANCELLED');
            if (response.status !== 200) {
                onToast('Error cancelling order', 'error');
                return;
            }
            onToast(`Order ${orderToCancel.orderId} cancelled!`, 'warning');
            setShowCancelModal(false);
            setOrderToCancel(null);
            onRefresh();
        } catch (error) {
            console.error(error);
            onToast('Error cancelling order', 'error');
            return;
        }

    };

    const openPreviewModal = (order: SupplierOrder) => {
        if (order.status === 'ACCEPTED' || order.status === 'DELIVERED') return;
        setPreviewOrder(order);
        setShowPreviewModal(true);
    };

    const acceptPreviewOrder = async () => {
        if (!previewOrder || previewOrder.orderId == null) return;
        try {
            await changeSupplierOrderStatus(previewOrder.orderId, 'ACCEPTED');
            onToast(`Order ${previewOrder.orderId} accepted!`, 'success');
            setShowPreviewModal(false);
            setPreviewOrder(null);
            onRefresh();
        } catch (error) {
            console.error(error);
            onToast('Error accepting order', 'error');
        }
    };

    // Filter items based on search term
    const filteredItems = items.filter(item =>
        item.orderId && item.orderDate && item.status &&
        (
            String(item.orderId).toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.orderDate.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.status.toLowerCase().includes(searchTerm.toLowerCase())
        )
    );

    return (
        <div>
            {/* Limit visible rows to ~10; enable scrolling when there are more. */}
            <div style={{ maxHeight: filteredItems.length > 10 ? 560 : 'auto', overflowY: filteredItems.length > 10 ? 'auto' : 'visible' }}>
                <Table striped bordered hover responsive className="mt-2">
                    <thead>
                    <tr>
                        <th>ID</th>
                        <th>Status</th>
                        <th>Request Day</th>
                        <th>Total Amount</th>
                        <th>Actions</th>
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
                                <td>
                                    {item.status !== 'CANCELLED' ? (
                                        <Dropdown>
                                            <Dropdown.Toggle
                                                variant="outline-secondary"
                                                size="sm"
                                                disabled={dispatchingOrder === item.orderId}
                                            >
                                                {dispatchingOrder === item.orderId ?
                                                    <HourglassSplit size={16} /> :
                                                    <ThreeDots size={16} />}
                                            </Dropdown.Toggle>
                                            <Dropdown.Menu
                                                className="dropdown-menu-super"
                                                popperConfig={{ strategy: 'fixed' }}
                                            >
                                                {item.orderId !== null && (
                                                    <>
                                                        {/* If the order is DELIVERED, only show PDF option */}
                                                        {item.status === 'DELIVERED' ? (
                                                            <Dropdown.Item
                                                                onClick={() => handleSeeOrderReport(item.orderId!)}
                                                            >
                                                                <FileText size={16} className="me-2" /> See Order Report
                                                            </Dropdown.Item>
                                                        ) : (
                                                            <>
                                                                {/* Show Review only if NOT ACCEPTED and NOT DELIVERED */}
                                                                {item.status !== 'ACCEPTED' && item.status !== 'DELIVERED' && (
                                                                    <Dropdown.Item
                                                                        onClick={() => openPreviewModal(item)}
                                                                        disabled={dispatchingOrder?.orderId === item.orderId}
                                                                    >
                                                                        <Check2Circle size={16} className="me-2" /> Review Order
                                                                    </Dropdown.Item>
                                                                )}
                                                                <Dropdown.Item
                                                                    onClick={() => openDispatchModal(item)}
                                                                    disabled={dispatchingOrder?.orderId === item.orderId || item.status !== 'ACCEPTED'}
                                                                >
                                                                    <Truck size={16} className="me-2" /> Dispatch Order
                                                                </Dropdown.Item>
                                                                <Dropdown.Item
                                                                    onClick={() => handleSeeOrderReport(item.orderId!)}
                                                                >
                                                                    <FileText size={16} className="me-2" /> See Order Report
                                                                </Dropdown.Item>
                                                                <Dropdown.Divider />
                                                                <Dropdown.Item
                                                                    onClick={() => openCancelModal(item)}
                                                                    className="text-danger"
                                                                    disabled={item.status === 'Cancelled'}
                                                                >
                                                                    <XCircle size={16} className="me-2" /> Cancel Order
                                                                </Dropdown.Item>
                                                            </>
                                                        )}
                                                    </>
                                                )}
                                            </Dropdown.Menu>
                                        </Dropdown>
                                    ) : (
                                        <span className="text-muted">No actions available</span>
                                    )}
                                </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                </Table>
            </div>

            <Modal show={showDispatchModal} centered>
                <Modal.Header>
                    <Modal.Title>
                        <Truck size={20} className="me-2 text-primary" />
                        Confirm Dispatch
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="text-center">
                        <div className="mb-3">
                            <Truck size={48} className="text-primary" />
                        </div>
                        <h5>Dispatch Menu</h5>
                        {dispatchingOrder && (
                            <div className="mt-3">
                                <Table bordered size="sm">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th>Requested</th>
                                            <th>Dispatch</th>
                                            <th>Unit Price</th>
                                            <th>Subtotal</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dispatchingOrder.items.map(item => (
                                            <tr key={item.itemId}>
                                                <td>{item.itemName}</td>
                                                <td>{item.quantity}</td>
                                                <td>
                                                    <Form.Control
                                                        type="number"
                                                        min={0}
                                                        max={item.quantity}
                                                        value={dispatchQuantities[item.itemId] ?? 0}
                                                        onChange={e => handleQuantityChange(item.itemId, Math.max(0, Math.min(item.quantity, Number(e.target.value))))}
                                                        disabled={acceptedItems[item.itemId]}
                                                    />
                                                </td>
                                                <td>{item.unitPrice}</td>
                                                <td>{(item.unitPrice * (dispatchQuantities[item.itemId] ?? 0)).toFixed(2)}</td>
                                                <td>
                                                    <Button
                                                        variant={acceptedItems[item.itemId] ? "success" : "primary"}
                                                        size="sm"
                                                        onClick={() => {
                                                            if (dispatchingOrder.orderId !== null) {
                                                                handleAcceptItem(item.itemId, dispatchingOrder.orderId).then(() => {});
                                                            }
                                                        }}
                                                        disabled={acceptedItems[item.itemId]}
                                                    >
                                                        {acceptedItems[item.itemId] ? "Accepted" : "Accept"}
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                                <div className="mt-3 p-3 bg-light rounded text-start">
                                    <strong>Order ID:</strong> {dispatchingOrder.orderId}<br />
                                    <strong>Status:</strong> {dispatchingOrder.status}<br />
                                    <strong>Date:</strong> {dispatchingOrder.orderDate}<br />
                                    <strong>Total:</strong> {total?.toFixed(2)}
                                </div>
                            </div>
                        )}
                        <div className="mt-3 text-muted">
                            <small>This action cannot be undone.</small>
                        </div>
                        {dispatchError && <Alert variant="danger" className="mt-2">{dispatchError}</Alert>}
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={confirmDispatch} disabled={dispatchingOrder ? !dispatchingOrder.items.every(item => acceptedItems[item.itemId]) : true}>
                        <Truck size={16} className="me-1" />
                        Dispatch Order
                    </Button>
                </Modal.Footer>
            </Modal>

            <Modal show={showCancelModal} onHide={cancelCancelModal} centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <XCircle size={20} className="me-2 text-danger" />
                        Confirm Cancellation
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="text-center">
                        <div className="mb-3">
                            <XCircle size={48} className="text-danger" />
                        </div>
                        <h5>Are you sure you want to cancel this order?</h5>
                        <div className="mt-3 p-3 bg-light rounded text-start">
                            {orderToCancel && (
                                <>
                                    <strong>Order ID:</strong> {orderToCancel.orderId}<br />
                                    <strong>Status:</strong> {orderToCancel.status}<br />
                                    <strong>Date:</strong> {orderToCancel.orderDate}<br />
                                    <strong>Total:</strong> {orderToCancel.totalAmount}<br />
                                    <strong>Items:</strong>
                                    <ul className="mt-2">
                                        {orderToCancel.items.map(item => (
                                            <li key={item.itemId}>{item.itemName}</li>
                                        ))}
                                    </ul>
                                </>
                            )}
                        </div>
                        <div className="mt-3 text-danger">
                            <small>This action is irreversible.</small>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={cancelCancelModal}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmCancelOrder}>
                        <XCircle size={16} className="me-1" />
                        Confirm Cancellation
                    </Button>
                </Modal.Footer>
            </Modal>

            {/* Order preview modal */}
            <Modal show={showPreviewModal} onHide={() => setShowPreviewModal(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <Check2Circle size={20} className="me-2 text-primary" />
                        Review Order
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="text-center">
                        <div className="mb-3">
                            <Check2Circle size={48} className="text-primary" />
                        </div>
                        <h5>Order Review</h5>
                        {previewOrder && (
                            <div className="mt-3">
                                <Table bordered size="sm">
                                    <thead>
                                        <tr>
                                            <th>Item</th>
                                            <th>Requested</th>
                                            <th>Unit Price</th>
                                            <th>Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewOrder.items.map(item => (
                                            <tr key={item.itemId}>
                                                <td>{item.itemName}</td>
                                                <td>{item.quantity}</td>
                                                <td>{item.unitPrice}</td>
                                                <td>{(item.unitPrice * item.quantity).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                                <div className="mt-3 p-3 bg-light rounded text-start">
                                    <strong>Order ID:</strong> {previewOrder.orderId}<br />
                                    <strong>Status:</strong> {previewOrder.status}<br />
                                    <strong>Date:</strong> {previewOrder.orderDate}<br />
                                    <strong>Total:</strong> {previewOrder.totalAmount}<br />
                                </div>
                            </div>
                        )}
                        <div className="mt-3 text-muted">
                            <small>Review the order before accepting.</small>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="primary" onClick={acceptPreviewOrder}>
                        Accept Order
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>

    );
};

export default SupplierTable;
