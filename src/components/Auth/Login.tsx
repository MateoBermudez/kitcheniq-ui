import React, { useState } from 'react';
import '../../App.scss';
import { setAuthToken, getUserInfo } from "../../service/api";

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
    onLoginSuccess?: (token: string, userData?: {name?: string; type?: string; id?: string }) => void;
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
        if (isLoading) return;
        setIsLoading(true);
        setError('');

        try {
            // Send both userId and username for backend compatibility
            const response = await fetch(apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ userId: formData.userId, username: formData.userId, password: formData.password })
            });

            if (!response.ok) {
                // Friendly messages for common auth failures
                if (response.status === 401 || response.status === 403) {
                    setError('Credenciales incorrectas');
                    return;
                }
                let backendMessage = '';
                try {
                    const contentType = response.headers.get('content-type');
                    if (contentType && contentType.includes('application/json')) {
                        const json = await response.json();
                        backendMessage = json.message || json.error || '';
                    } else {
                        backendMessage = await response.text();
                    }
                } catch {
                    // ignore parsing issues
                }
                const finalMsg = backendMessage || `Error: ${response.status}`;
                throw new Error(finalMsg);
            }

            const data: AuthResponse = await response.json();
            const token = data.token;
            if (!token) {
                throw new Error('No authentication token received from server');
            }
            setAuthToken(token);

            // Fetch detailed user info
            let fetchedUserName: string | undefined;
            let fetchedUserType: string | undefined;
            let fetchedUserId: string | undefined;
            const candidateId = data.id || formData.userId; // prefer backend id if provided
            try {
                const userInfo = await getUserInfo(candidateId as string);
                fetchedUserName = userInfo.name || userInfo.username;
                fetchedUserType = userInfo.type || userInfo.role;
                fetchedUserId = userInfo.id || userInfo.userId || candidateId;
            } catch (infoErr) {
                console.warn('Could not fetch detailed user info, using login response fallback', infoErr);
                fetchedUserName = data.name;
                fetchedUserType = data.employeeType || data.type || data.entityType;
                fetchedUserId = data.id || formData.userId;
            }

            const userData = {
                name: fetchedUserName,
                type: fetchedUserType,
                id: fetchedUserId
            };

            localStorage.setItem('userData', JSON.stringify(userData));
            localStorage.setItem('lastUserId', fetchedUserId || '');

            if (onLoginSuccess) {
                onLoginSuccess(token, userData);
            }
        } catch (err) {
            console.error('Login error:', err);
            if (!error) {
                setError(err instanceof Error ? err.message : 'Error de conexión');
            }
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
