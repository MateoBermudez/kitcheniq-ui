import React, { useState, useEffect } from 'react';
import { Form, InputGroup } from 'react-bootstrap';
import { Search, Hash, Person } from 'react-bootstrap-icons';

interface StaffSearchProps {
    onSearchTermChange?: (term: string) => void;
}

const StaffSearch: React.FC<StaffSearchProps> = ({ onSearchTermChange }) => {
    const [term, setTerm] = useState<string>('');

    useEffect(() => {
        onSearchTermChange?.(term.trim());
    }, [term, onSearchTermChange]);

    return (
        <div className="mb-3">
            <h6 className="mb-3 fw-bold rounded-heading d-flex align-items-center">
                <span style={{letterSpacing: '0.5px'}}>SEARCH STAFF</span>
                <span className="ms-2 badge bg-info text-dark" style={{opacity: 0.85}}>Staff</span>
            </h6>
            <Form>
                <InputGroup>
                    <InputGroup.Text style={{background:'#f8f9fa', borderColor:'#dee2e6'}}>
                        <Search size={16} />
                    </InputGroup.Text>
                    <Form.Control
                        type="text"
                        placeholder="Search by ID or Name"
                        value={term}
                        onChange={(e) => setTerm(e.target.value)}
                    />
                    <InputGroup.Text style={{background:'#f8f9fa', borderColor:'#dee2e6'}}>
                        <Person size={16} className="me-2" />
                        <Hash size={16} />
                    </InputGroup.Text>
                </InputGroup>
                <Form.Text className="text-muted">Type an employee ID or any part of a name (e.g. Ana).</Form.Text>
            </Form>
        </div>
    );
};

export default StaffSearch;
