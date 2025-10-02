import React, { useState } from 'react';
import '../../App.scss';
import { setAuthToken } from "../../service/api";

interface LoginRequest {
    userId: string;
    password: string;
}

interface AuthResponse {
    token?: string;
    name?: string;
    type?: string;
    employeeType?: string;
    entityType?: string;
    id?: string;
}

interface LoginProps {
    onLoginSuccess?: (token: string, userData?: {name?: string; type?: string }) => void;
    apiBaseUrl?: string;
}

const Login: React.FC<LoginProps> = ({onLoginSuccess, apiBaseUrl = 'http://localhost:5000/kitcheniq/api/v1/auth/login'}) => {
    const [formData, setFormData] = useState<LoginRequest>({
        userId: '',
        password: ''
    });

    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        if (error) setError('');
    };

    const handleSubmit = async (e: React.MouseEvent<HTMLButtonElement> | React.KeyboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(errorData || `Error: ${response.status}`);
            }

            const data: AuthResponse = await response.json();
            console.log('Full Login response:', data); // View complete structure
            console.log('Response keys:', Object.keys(data)); // Debug response keys

            const token = data.token;

            if (!token) {
                throw new Error('No authentication token received from server');
            }

            setAuthToken(token);
            console.log('Token saved successfully');

            // Extract user data from login response
            const userData = {
                name: data.name,
                type: data.employeeType,
                entityType: data.entityType,
                id: data.id
            };

            localStorage.setItem('currentUser', JSON.stringify(userData));

            console.log('Mapped user data:', userData);

            if (onLoginSuccess) {
                onLoginSuccess(token, userData);
            }

        } catch (err) {
            console.error('Login error:', err);
            setError(err instanceof Error ? err.message : 'Connection error');
        } finally {
            setIsLoading(false);
        }
    };

    const isFormValid = formData.userId.trim() !== '' && formData.password.trim() !== '';

    return (
        <div className="container-fluid vh-100 p-0" style={{backgroundColor: '#B4E6FF'}}>
            <div className="row h-100 g-0">
                <div className="d-none d-lg-flex col-lg-6 align-items-center justify-content-center">
                    <div>
                        <img
                            src="/LogoCompleto.png"
                            alt="LogoKitchen"
                            className="img-fluid logo-animation logo-animation-subtle"
                            style={{maxWidth: '400px'}}
                        />
                    </div>
                </div>
                <div className="col-12 col-lg-6 d-flex align-items-center justify-content-center">
                    <div className="bg-light h-100 w-75 d-flex flex-column justify-content-center px-4 py-5 position-relative" style={{zIndex: 2}}>
                        {error && <div className="alert alert-danger mb-3">{error}</div>}
                        <div>
                            <label className="form-label fs-5 fw-medium">Username</label>
                            <input
                                type="text"
                                name="userId"
                                value={formData.userId}
                                onChange={handleInputChange}
                                onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                                className="w-100 border border-secondary rounded p-2 bg-transparent"
                                placeholder="Enter your username"
                            />
                        </div>
                        <div className="mt-3">
                            <label className="form-label fs-5 fw-medium">Password</label>
                            <div className="position-relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    onKeyDown={(e) => e.key === 'Enter' && handleSubmit(e)}
                                    className="w-100 border border-secondary rounded p-2 bg-transparent"
                                    placeholder="Enter your password"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="btn btn-sm position-absolute end-0 top-50 translate-middle-y me-2"
                                    style={{border: 'none', background: 'transparent'}}
                                >
                                    <i className={showPassword ? 'bi bi-eye-slash' : 'bi bi-eye'}></i>
                                </button>
                            </div>
                        </div>
                        <div className="mt-4 d-flex flex-column mb-3">
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!isFormValid || isLoading}
                                className="py-2 rounded-2"
                                style={{backgroundColor: '#D1DBFF', transition: 'transform 0.075s ease-in-out'}}
                                onMouseDown={(e) => e.currentTarget.style.transform = 'scale(0.98)'}
                                onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                            >
                                {isLoading ? 'Signing in...' : 'Sign in'}
                            </button>
                        </div>
                    </div>
                    <div
                        className="position-absolute"
                        style={{
                            bottom: '0',
                            right: '0',
                            width: '0',
                            height: '0',
                            borderLeft: '800px solid transparent',
                            borderBottom: '400px solid #38B0F0',
                            zIndex: 1
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default Login;
