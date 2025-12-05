import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Table, Badge, Button, Spinner, Alert, Modal, Collapse, Dropdown } from 'react-bootstrap';
import {
    ArrowClockwise,
    ThreeDots,
    HourglassSplit,
    CheckCircle,
    Box,
    XCircle,
    Trash,
    Plus,
    Dash
} from 'react-bootstrap-icons';
import { getAllOrders, updateOrderStatus, deleteOrder, type OrderComponentData, type OrderData } from '../../service/api';

// Event hook used by external components to inject a newly created order placeholder
interface UpdateOrderEvent {
    data?: { id?: number | string };
    requestTime?: string;
    tableNumber?: string | number;
}

type RawOrder = Partial<OrderData> & {
    orderId?: number; // sometimes returned as orderId instead of id
    orderStatus?: string | null;
    deliverTime?: string | null;
}

interface OrderTableRow {
    id: number | null;
    code: string;
    status: string;
    requestTime: string | null;
    deliveryTime: string | null;
    requestingClient: string;
    table: string;
    items: OrderComponentData[];
    details: string;
    originalStatus?: string;
    components: OrderComponentData[];
    totalPrice: number;
}

interface OrderTableProps {
    searchTerm: string;
    onToast: (msg: string, type?: string) => void;
}

const OrderTable: React.FC<OrderTableProps> = ({ searchTerm, onToast }) => {
    const [orders, setOrders] = useState<OrderTableRow[]>([]);
    const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
    const [deletingOrder, setDeletingOrder] = useState<string | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState<OrderTableRow | null>(null);
    const [localOrderTimes, setLocalOrderTimes] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem('orderCreationTimes');
        return saved ? JSON.parse(saved) : {};
    });
    const [localDeliveryTimes, setLocalDeliveryTimes] = useState<Record<string, string>>(() => {
        const saved = localStorage.getItem('orderDeliveryTimes');
        return saved ? JSON.parse(saved) : {};
    });
    // Pagination for render performance: only render a page of rows at a time
    const PAGE_SIZE = 50; // keep reasonable default
    const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);
    // Prevent overlapping fetches
    const isFetchingRef = useRef<boolean>(false);
    const [showCancelled, setShowCancelled] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
    // New state variables: status filter and recent highlight set
    const [statusFilter, setStatusFilter] = useState<string>('ALL');
    const [recentOrders, setRecentOrders] = useState<Set<number>>(new Set());

    const mapStatusToEnglish = useCallback((status: string | null | undefined): string => {
        if (!status) return 'Pending';
        const s = status.toUpperCase();
        const statusMap: Record<string, string> = {
            'PENDING': 'Pending',
            'IN_PROGRESS': 'In Progress',
            'COMPLETED': 'Ready',      // backend canonical -> UI label
            'READY': 'Ready',          // compatibility (old frontend)
            'SERVED': 'Delivered',     // backend canonical -> UI label
            'DELIVERED': 'Delivered',  // compatibility (old frontend)
            'CANCELLED': 'Cancelled'
        };
        return statusMap[s] || 'Pending';
    }, []);

    const mapStatusToBackend = useCallback((englishStatus: string): string => {
        // Backend currently expects these canonical codes
        const m: Record<string,string> = {
            'Pending': 'PENDING',
            'In Progress': 'IN_PROGRESS',
            'Ready': 'COMPLETED',
            'Delivered': 'SERVED',
            'Cancelled': 'CANCELLED'
        };
        return m[englishStatus] || 'PENDING';
    }, []);

    const mapOrderData = useCallback((raw: RawOrder): OrderTableRow => {
        const orderId = raw.orderId ?? raw.id ?? null;

        const parseOrderItems = (orderBillJson: string): OrderComponentData[] => {
            interface ParsedBillItem {
                productId?: number;
                quantity?: number;
                productName?: string;
                productPrice?: number;
            }
            try {
                const parsed: unknown = JSON.parse(orderBillJson);
                if (!Array.isArray(parsed)) return [];
                return (parsed as ParsedBillItem[]).map((item, idx) => ({
                    id: (item.productId ?? (idx + 1)) as number,
                    quantity: (item.quantity ?? 1) as number,
                    productId: item.productId,
                    productName: item.productName || `Product ${item.productId}`,
                    productPrice: item.productPrice ?? 0,
                    type: 'PRODUCT'
                }));
            } catch {
                return [];
            }
        };

        const formatTime = (iso: string | null | undefined): string | null => {
            if (!iso) return null;
            // If it already comes formatted as HH:MM or HH:MM:SS, accept it directly
            if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(iso)) {
                return iso.length === 8 ? iso.substring(0,5) : iso; // trim to HH:MM if it includes seconds
            }
            const d = new Date(iso);
            if (isNaN(d.getTime())) return null;
            return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        };

        const requestTime = formatTime(raw.requestTime) || 'N/A';
        const rawDelivery = raw.deliveryTime ?? raw.deliverTime ?? null;
        const deliveryTime = formatTime(rawDelivery);

        const tableNumber = raw.tableNumber ?? (raw.table ? parseInt(raw.table, 10) : 0);
        const tableDisplay = tableNumber > 0 ? String(tableNumber) : 'N/A';

        const items = parseOrderItems(raw.orderBill || raw.details || '[]');
        const totalPrice = typeof raw.totalPrice === 'number' ? raw.totalPrice : (items.reduce((s, it) => s + ((it.productPrice || 0) * (it.quantity || 1)), 0));

        const backendStatus = raw.status || raw.orderStatus || 'PENDING';
        const statusEnglish = mapStatusToEnglish(backendStatus);

        return {
            id: orderId,
            code: `ORD-${orderId ?? 'XXX'}`,
            requestingClient: 'Customer',
            table: tableDisplay,
            status: statusEnglish,
            requestTime,
            deliveryTime: deliveryTime || null,
            items,
            details: raw.orderBill || raw.details || '',
            originalStatus: backendStatus,
            components: items,
            totalPrice
        };
    }, [mapStatusToEnglish]);

    const loadOrders = useCallback(async (opts?: { showSpinner?: boolean }) => {
         if (isFetchingRef.current) return; // avoid concurrent fetches
         isFetchingRef.current = true;
         try {
            if (opts?.showSpinner) setLoading(true);
             setError(null);
             const response = await getAllOrders() as { data: RawOrder[] };
             const incoming = response.data || [];
             const mappedOrders: OrderTableRow[] = incoming.map(mapOrderData);
             setOrders(mappedOrders);
             // Persist any delivery times reported by backend into localDeliveryTimes for consistent display
             try {
                 const newDeliveryTimes: Record<string,string> = {};
                 mappedOrders.forEach(o => {
                     if (o.id != null && o.deliveryTime) {
                         newDeliveryTimes[o.id] = o.deliveryTime;
                     }
                 });
                 // merge with existing (read from state) to preserve prior values
                setLocalDeliveryTimes(prev => ({ ...(prev || {}), ...newDeliveryTimes }));
                localStorage.setItem('orderDeliveryTimes', JSON.stringify({ ...(localStorage.getItem('orderDeliveryTimes') ? JSON.parse(localStorage.getItem('orderDeliveryTimes') as string) : {}), ...newDeliveryTimes }));
             } catch {
                 // ignore persistence errors
             }
         } catch (err) {
             let errorMessage = 'Error loading orders';
             if (err instanceof Error) errorMessage = err.message || errorMessage;
             setError(errorMessage);
             onToast(errorMessage, 'error');
         } finally {
            if (opts?.showSpinner) setLoading(false);
             isFetchingRef.current = false;
         }
     }, [mapOrderData, onToast]);

    // When filters or orders change, reset the visible count so user sees top of filtered list
    useEffect(() => {
        setVisibleCount(PAGE_SIZE);
    }, [/* reset on orders or filter changes */ orders.length]);

    const filteredOrders = React.useMemo(() => {
         let list = [...orders];
         if (!showCancelled) list = list.filter(o => o.status !== 'Cancelled');
         if (statusFilter !== 'ALL') list = list.filter(o => o.status === statusFilter);
         if (searchTerm) list = list.filter(o => o.code?.toLowerCase().includes(searchTerm.toLowerCase()));
         list.sort((a, b) => {
             if (a.status === 'Ready' && b.status !== 'Ready') return -1;
             if (a.status !== 'Ready' && b.status === 'Ready') return 1;
             if (a.status === 'Delivered' && b.status !== 'Delivered') return 1;
             if (a.status !== 'Delivered' && b.status === 'Delivered') return -1;
             return 0;
         });
         return list;
     }, [orders, searchTerm, showCancelled, statusFilter]);

    useEffect(() => {
        // Load saved user preference for showing cancelled orders
        const storedShowCancelled = localStorage.getItem('pref_show_cancelled');
        if (storedShowCancelled) {
            setShowCancelled(storedShowCancelled === 'true');
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('pref_show_cancelled', String(showCancelled));
    }, [showCancelled]);

    useEffect(() => {
        window.updateOrderTable = (newOrder: UpdateOrderEvent) => {
              const id = newOrder?.data?.id;
              if (!id) return;
              setLocalOrderTimes(times => {
                  if (!newOrder.requestTime) return times;
                  const updated = { ...times, [id]: newOrder.requestTime };
                  localStorage.setItem('orderCreationTimes', JSON.stringify(updated));
                  return updated;
              });
              // Mark as recent (temporary highlight)
              setRecentOrders(prev => {
                  const next = new Set(prev);
                  if (typeof id === 'number') next.add(id); else next.add(Number(id));
                  return next;
              });
              // Remove highlight after 30s
              setTimeout(() => {
                  setRecentOrders(prev => {
                      const next = new Set(prev);
                      next.delete(Number(id));
                      return next;
                  });
              }, 30000);
              // Optimistic patch for fast UI feedback
              setOrders(prev => prev.map(o => o.id === Number(id) ? { ...o, requestTime: newOrder.requestTime || o.requestTime, table: newOrder.tableNumber ? String(newOrder.tableNumber) : o.table } : o));
          };
         return () => { window.updateOrderTable = undefined; };
    }, [loadOrders]);

    // Initial load once on mount
    useEffect(() => {
        loadOrders({ showSpinner: true }).then(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Single auto-refresh every 30 seconds
    useEffect(() => {
        const intervalId = setInterval(() => {
            loadOrders({ showSpinner: false }).then(() => {});
        }, 30000);
        return () => clearInterval(intervalId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRefresh = async () => {
        try {
            setRefreshing(true);
            await loadOrders({ showSpinner: true });
            onToast('Orders updated successfully', 'success');
        } catch {
            onToast('Error updating orders', 'error');
        } finally {
            setRefreshing(false);
        }
    };


    const getBadgeStyle = useCallback((status: string): React.CSSProperties => {
        switch (status?.toLowerCase()) {
            case 'pending':
                return { backgroundColor: '#feffd4', border: '1px solid #c2c838', color: '#000000' };
            case 'in progress':
                return { backgroundColor: '#FFE4B5', border: '1px solid #DEB887', color: '#000000' };
            case 'ready':
                return { backgroundColor: '#D1FFD7', border: '1px solid #A3C6B0', color: '#000000' };
            case 'delivered':
                return { backgroundColor: '#86e5ff', border: '1px solid #86e5ff', color: '#000000' };
            case 'cancelled':
                return { backgroundColor: '#F8D7DA', border: '1px solid #EA868F', color: '#000000' };
            default:
                return { backgroundColor: '#E9ECEF', border: '1px solid #CED4DA', color: '#000000' };
        }
    }, []);

    const handleStatusChange = async (code: string, newStatus: string) => {
        try {
            const order = orders.find(o => o.code === code);
            if (!order) {
                onToast('Order not found', 'error');
                return;
            }
            if (order.status === 'Cancelled') {
                onToast('Cannot change a cancelled order', 'warning');
                return;
            }
            setUpdatingOrder(code);

            const backendStatus = mapStatusToBackend(newStatus);
            const resp = await updateOrderStatus(Number(order.id), backendStatus);
            const data = resp.data || {};
            // backend may return delivery time under deliveryTime or deliverTime
            const respObj = data as unknown;
            let serverDeliveryRaw: unknown = undefined;
            if (respObj && typeof respObj === 'object') {
                const obj = respObj as Record<string, unknown>;
                serverDeliveryRaw = obj['deliveryTime'] ?? obj['deliverTime'];
            }
            let backendReported: string = backendStatus;
            if (data && typeof data === 'object') {
                const d = (data as unknown) as Record<string, unknown>;
                const s1 = d['status'];
                const s2 = d['orderStatus'];
                backendReported = typeof s1 === 'string' ? s1 : (typeof s2 === 'string' ? s2 : backendStatus);
            }
            const english = mapStatusToEnglish(backendReported);

            const deliveryTimeUpd = english === 'Delivered'
                ? (serverDeliveryRaw ? (() => { try { const dt = new Date(String(serverDeliveryRaw)); return isNaN(dt.getTime()) ? order.deliveryTime : dt.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false}); } catch { return order.deliveryTime; } })() : new Date().toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',hour12:false}))
                : (serverDeliveryRaw ? String(serverDeliveryRaw) : order.deliveryTime);

            const prevStatus = order.status;
            setOrders(prev => prev.map(o => o.code === code ? {...o, status: english, deliveryTime: deliveryTimeUpd} : o));

            // Persist delivery time locally keyed by order id so table shows it reliably
            try {
                if (order.id != null && deliveryTimeUpd) {
                    const newDeliveryTimes = { ...localDeliveryTimes, [order.id]: deliveryTimeUpd };
                    setLocalDeliveryTimes(newDeliveryTimes);
                    localStorage.setItem('orderDeliveryTimes', JSON.stringify(newDeliveryTimes));
                }
            } catch { /* ignore */ }

            // Fire global event for real‑time notification component
            try {
                window.dispatchEvent(new CustomEvent('order-status-changed', {
                    detail: {
                        id: order.id,
                        code: order.code,
                        previousStatus: prevStatus,
                        newStatus: english,
                        deliveryTime: deliveryTimeUpd,
                        timestamp: Date.now()
                    }
                }));
            } catch { /* noop */ }

            onToast(`Order ${code} updated to ${english}`, 'success');
        } catch (err) {
            let msg = `Error updating order ${code}`;
            if (err instanceof Error) msg = err.message || msg;
            onToast(msg, 'error');
        } finally {
            setUpdatingOrder(null);
        }
    };

    const handleDeleteClick = (order: OrderTableRow) => {
        setOrderToDelete(order);
        setShowDeleteModal(true);
    };

    const confirmDelete = async () => {
        if (!orderToDelete) return;
        try {
            setDeletingOrder(orderToDelete.code);
            setShowDeleteModal(false);
            await deleteOrder(Number(orderToDelete.id));
            // Remove locally (soft delete)
            setOrders(prevOrders => prevOrders.filter(o => o.code !== orderToDelete.code));
            // Purge cached timing metadata
            const newTimes = { ...localOrderTimes };
            if (orderToDelete.id !== null) delete newTimes[orderToDelete.id];
            setLocalOrderTimes(newTimes);
            localStorage.setItem('orderCreationTimes', JSON.stringify(newTimes));
            const newDeliveryTimes = { ...localDeliveryTimes };
            if (orderToDelete.id !== null) delete newDeliveryTimes[orderToDelete.id];
            setLocalDeliveryTimes(newDeliveryTimes);
            localStorage.setItem('orderDeliveryTimes', JSON.stringify(newDeliveryTimes));
            onToast(`Order ${orderToDelete.code} deleted`, 'success');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : `Error deleting order ${orderToDelete.code}`;
            onToast(errorMessage, 'error');
        } finally {
            setDeletingOrder(null);
            setOrderToDelete(null);
        }
    };

    const cancelDelete = () => {
        setShowDeleteModal(false);
        setOrderToDelete(null);
    };

    const toggleExpand = (id: number | null) => {
        if (id === null) return;
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };

    const buttonStyle = {
        backgroundColor: isHovered ? '#86e5ff' : 'transparent',
        color: isHovered ? '#001f45' : '#86e5ff',
        borderColor: '#86e5ff',
        transition: 'all 0.3s ease'
    };

    if (loading) {
        return (
            <div className="bg-white rounded shadow-sm">
                <div className="p-5 text-center">
                    <Spinner animation="border" variant="primary" />
                    <div className="mt-2 text-muted">Loading orders...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-white rounded shadow-sm">
                <div className="p-3">
                    <Alert variant="danger" className="mb-3">
                        <div className="d-flex justify-content-between align-items-center">
                            <div>
                                <strong>Error:</strong> {error}
                                <br />
                                <small className="text-muted">
                                    Check that the server is running correctly
                                </small>
                            </div>
                            <Button variant="outline-danger" size="sm" onClick={() => loadOrders({ showSpinner: true })}>
                                <ArrowClockwise size={16} className="me-1" /> Retry
                            </Button>
                        </div>
                    </Alert>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="bg-white rounded order-table-wrapper">
                <div className="p-3 border-bottom bg-white">
                    <div className="d-flex justify-content-between align-items-center">
                        <h6 className="mb-0 text-muted">
                            Total orders: <span className="text-dark">{filteredOrders.length}</span>
                        </h6>
                        <div className="d-flex gap-2 align-items-center flex-wrap">
                            <div className="d-flex gap-1">
                                {['ALL','Pending','In Progress','Ready','Delivered'].map(s => (
                                    <Button
                                        key={s}
                                        variant={statusFilter === s ? 'primary' : 'outline-secondary'}
                                        size="sm"
                                        onClick={() => setStatusFilter(s)}
                                        style={statusFilter === s ? { backgroundColor:'#86e5ff', borderColor:'#86e5ff', color:'#000'} : {}}
                                    >
                                        {s}
                                    </Button>
                                ))}
                            </div>
                            <Button
                                variant={showCancelled ? 'outline-secondary' : 'outline-dark'}
                                size="sm"
                                onClick={() => setShowCancelled(s => !s)}
                            >
                                {showCancelled ? 'Hide Cancelled' : 'Show Cancelled'}
                            </Button>
                            <Button
                                style={buttonStyle}
                                size="sm"
                                disabled={refreshing}
                                onClick={handleRefresh}
                                onMouseEnter={() => setIsHovered(true)}
                                onMouseLeave={() => setIsHovered(false)}
                            >
                                {refreshing ? (
                                    <>
                                        <Spinner as="span" animation="border" size="sm" className="me-1" />
                                        Updating...
                                    </>
                                ) : (
                                    <>
                                        <ArrowClockwise size={16} className="me-1" /> Refresh
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>

                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                    <Table responsive hover className="mb-0">
                        <thead className="sticky-top">
                        <tr>
                            <th></th>
                            <th>Code</th>
                            <th>Total Price</th>
                            <th>Table</th>
                            <th>Status</th>
                            <th>Request Time</th>
                            <th>Delivery Time</th>
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {filteredOrders.slice(0, visibleCount).map((order, index) => (
                            <React.Fragment key={order.code || order.id || index}>
                                <tr key={order.code || order.id || index} style={order.id && recentOrders.has(order.id) ? { backgroundColor: '#e8f7ff', transition: 'background-color 0.5s' } : {}}>
                                    <td style={{width:'32px'}}>
                                        <Button variant="outline-secondary" size="sm" onClick={() => toggleExpand(order.id)}>
                                            {order.id && expandedRows.has(order.id) ? <Dash size={14}/> : <Plus size={14}/>}
                                        </Button>
                                    </td>
                                    <td><strong className="text-black">{order.code || 'N/A'}</strong></td>
                                    <td>${(order.totalPrice ?? 0).toFixed(2)}</td>
                                    <td>
                                        <Badge bg="light" text="dark">
                                            {order.table && order.table !== 'N/A' ? `Table ${order.table}` : 'Takeout'}
                                        </Badge>
                                    </td>
                                    <td>
                                        <span className="badge" style={getBadgeStyle(order.status)}>
                                            {order.status || 'N/A'}
                                        </span>
                                    </td>
                                    <td><small className="text-muted">{order.requestTime || 'N/A'}</small></td>
                                    <td><small className="text-muted">{order.deliveryTime || (order.id != null && localDeliveryTimes[order.id] ? localDeliveryTimes[order.id] : '--:--')}</small></td>
                                    <td>
                                        <Dropdown>
                                            <Dropdown.Toggle
                                                variant="outline-secondary"
                                                size="sm"
                                                disabled={updatingOrder === order.code || deletingOrder === order.code}
                                            >
                                                {(updatingOrder === order.code || deletingOrder === order.code)
                                                    ? <HourglassSplit size={16} />
                                                    : <ThreeDots size={16} />}
                                            </Dropdown.Toggle>
                                            <Dropdown.Menu>
                                                <Dropdown.Item
                                                    onClick={() => handleStatusChange(order.code, 'Pending')}
                                                    disabled={order.status === 'Pending' || order.status === 'Cancelled'}
                                                >
                                                    <HourglassSplit size={16} className="me-2" /> Mark as Pending
                                                </Dropdown.Item>
                                                <Dropdown.Item
                                                    onClick={() => handleStatusChange(order.code, 'In Progress')}
                                                    disabled={order.status === 'In Progress' || order.status === 'Cancelled'}
                                                >
                                                    <ArrowClockwise size={16} className="me-2" /> Mark as In Progress
                                                </Dropdown.Item>
                                                <Dropdown.Item
                                                    onClick={() => handleStatusChange(order.code, 'Ready')}
                                                    disabled={order.status === 'Ready' || order.status === 'Cancelled'}
                                                >
                                                    <CheckCircle size={16} className="me-2" /> Mark as Ready
                                                </Dropdown.Item>
                                                <Dropdown.Item
                                                    onClick={() => handleStatusChange(order.code, 'Delivered')}
                                                    disabled={order.status === 'Delivered' || order.status === 'Cancelled'}
                                                >
                                                    <Box size={16} className="me-2" /> Mark as Delivered
                                                </Dropdown.Item>
                                                <Dropdown.Divider />
                                                <Dropdown.Item
                                                    onClick={() => handleStatusChange(order.code, 'Cancelled')}
                                                    className="text-warning"
                                                    disabled={order.status === 'Cancelled'}
                                                >
                                                    <XCircle size={16} className="me-2" /> Cancel Order
                                                </Dropdown.Item>
                                                <Dropdown.Item
                                                    onClick={() => handleDeleteClick(order)}
                                                    className="text-danger"
                                                    disabled={deletingOrder === order.code}
                                                >
                                                    <Trash size={16} className="me-2" /> Delete Order
                                                </Dropdown.Item>
                                            </Dropdown.Menu>
                                        </Dropdown>
                                    </td>
                                </tr>
                                {order.id && (
                                    <tr>
                                        <td colSpan={8} className="p-0 border-0">
                                            <Collapse in={expandedRows.has(order.id)}>
                                                <div className="bg-light p-3">
                                                    <h6 className="fw-bold mb-2">Items</h6>
                                                    {order.items.length > 0 ? (
                                                         <div className="small">
                                                             {(() => {
                                                                 // Helper to map names to English if needed
                                                                 const toEnglish = (name: string): string => {
                                                                     const map: Record<string,string> = {
                                                                         'hamburguesa': 'Burger',
                                                                         'papas fritas': 'Fries',
                                                                         'refresco': 'Soda',
                                                                         'pollo': 'Chicken',
                                                                         'carne': 'Beef',
                                                                         'ensalada': 'Salad',
                                                                     };
                                                                     const key = name.trim().toLowerCase();
                                                                     return map[key] || name;
                                                                 };
                                                                 // Group items by productName and sum quantities
                                                                 const groups = new Map<string, { name: string; quantity: number; price: number }>();
                                                                 order.items.forEach(it => {
                                                                     const rawName = it.productName || `Item ${it.id}`;
                                                                     const englishName = toEnglish(rawName);
                                                                     const key = englishName.toLowerCase();
                                                                     const current = groups.get(key);
                                                                     const qty = typeof it.quantity === 'number' ? it.quantity : 1;
                                                                     const price = typeof it.productPrice === 'number' ? it.productPrice : 0;
                                                                     if (current) {
                                                                         current.quantity += qty;
                                                                     } else {
                                                                         groups.set(key, { name: englishName, quantity: qty, price });
                                                                     }
                                                                 });
                                                                 const items = Array.from(groups.values());
                                                                 return (
                                                                     <div>
                                                                         {items.map((g, idx) => (
                                                                             <div key={idx} className="d-flex justify-content-between border-bottom py-1">
                                                                                 <span>{g.name}</span>
                                                                                 <span className="text-muted">x{g.quantity}</span>
                                                                             </div>
                                                                         ))}
                                                                     </div>
                                                                 );
                                                             })()}
                                                             <div className="mt-3 text-end fw-bold">Total ${(order.totalPrice ?? 0).toFixed(2)}</div>
                                                         </div>
                                                     ) : (
                                                         <div className="text-muted fst-italic">No items parsed</div>
                                                     )}
                                                </div>
                                            </Collapse>
                                        </td>
                                    </tr>
                                )}
                            </React.Fragment>
                        ))}
                        </tbody>
                    </Table>
                </div>

                {/* Pagination controls for table rendering to avoid rendering too many rows at once */}
                {filteredOrders.length > visibleCount && (
                    <div className="p-3 text-center">
                        <Button size="sm" variant="outline-primary" onClick={() => setVisibleCount(c => Math.min(filteredOrders.length, c + PAGE_SIZE))}>
                            Show more ({Math.min(PAGE_SIZE, filteredOrders.length - visibleCount)})
                        </Button>
                    </div>
                )}
                {filteredOrders.length > PAGE_SIZE && visibleCount > PAGE_SIZE && (
                    <div className="p-2 text-center">
                        <Button size="sm" variant="outline-secondary" onClick={() => setVisibleCount(PAGE_SIZE)}>
                            Show less
                        </Button>
                    </div>
                )}
            </div>

            <Modal show={showDeleteModal} onHide={cancelDelete} centered>
                <Modal.Header closeButton>
                    <Modal.Title>
                        <Trash size={20} className="me-2 text-danger" />
                        CONFIRM DELETION
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div className="text-center">
                        <div className="mb-3">
                            <Trash size={48} className="text-danger" />
                        </div>
                        <h5>Are you sure you want to delete this order?</h5>
                        {orderToDelete && (
                            <div className="mt-3 p-3 bg-light rounded">
                                <strong>Code:</strong> {orderToDelete.code}<br />
                                <strong>Status:</strong> {orderToDelete.status}<br />
                                <strong>Total:</strong> ${(orderToDelete.totalPrice ?? 0).toFixed(2)}
                            </div>
                        )}
                        <div className="mt-3 text-muted">
                            <small>This action cannot be undone.</small>
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={cancelDelete}>
                        Cancel
                    </Button>
                    <Button variant="danger" onClick={confirmDelete}>
                        <Trash size={16} className="me-1" />
                        Delete Order
                    </Button>
                </Modal.Footer>
            </Modal>
        </>
    );
};

declare global {
    interface Window {
        updateOrderTable?: (newOrder: { data?: { id?: number | string }, requestTime?: string, tableNumber?: string | number }) => void;
    }
}

export default OrderTable;
