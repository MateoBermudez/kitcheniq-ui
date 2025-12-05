import React from 'react';
import { Card } from 'react-bootstrap';
import { ExclamationTriangle } from 'react-bootstrap-icons';

interface UnavailableSectionProps {
    title?: string;
    icon?: React.ReactNode;
    message?: string;
}

const UnavailableSection: React.FC<UnavailableSectionProps> = ({ title, icon, message }) => {
    return (
        <div className="d-flex align-items-center justify-content-center w-100 h-100" style={{ backgroundColor: '#f8fbff' }}>
            <Card className="border-0 shadow-sm text-center" style={{ maxWidth: 520 }}>
                <Card.Body className="py-4 d-flex flex-column align-items-center justify-content-center">
                    <div className="mb-3" style={{ fontSize: 36, lineHeight: 1 }}>
                        {icon || <ExclamationTriangle className="text-warning" />}
                    </div>
                    {title && <h5 className="mb-2">{title}</h5>}
                    <div className="text-muted">{message || 'Section not available at the moment'}</div>
                </Card.Body>
            </Card>
        </div>
    );
};

export default UnavailableSection;

