import React, { useState, useEffect } from 'react';
import { Container, Row, Col } from 'react-bootstrap';
import {
    Clock,
} from 'react-bootstrap-icons';
import SupplierTable from './SupplierTable';
import SupplierSearch from './SupplierSearch';
import SupplierNotifications from './SupplierNotifications.tsx';

export interface SupplierOrder {
    orderId: number | null;
    status: string;
    orderDate: string;
    totalAmount: number;
}

interface SupplierStatusProps {
    onToast: (msg: string, type?: string) => void;
}

const SupplierStatus: React.FC<SupplierStatusProps> = ({ onToast }) => {
    const [searchTerm] = useState<string>('');
    const [currentTime, setCurrentTime] = useState<Date>(new Date());

    useEffect(() => {
        const intervalId = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(intervalId);
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
                    <SupplierTable
                        searchTerm={searchTerm}
                        onToast={onToast}
                    />
                </div>
                <Row>
                    <Col md={6}>
                        <div className="p-3 border rounded-4 shadow h-100">
                            <SupplierSearch onSearch={() => {}} />
                        </div>
                    </Col>
                    <Col md={6}>
                        <div className="p-3 border rounded-4 shadow h-100">
                            <SupplierNotifications onToast={onToast} />
                        </div>
                    </Col>
                </Row>
            </Container>
        </div>
    );
};

export default SupplierStatus;
