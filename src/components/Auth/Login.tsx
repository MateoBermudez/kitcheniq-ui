import React, { useState } from 'react';
import { Eye, EyeOff, User, Lock, AlertCircle } from 'lucide-react';

// Types for requests and responses
interface LoginRequest {
    userId: string;
    password: string;
}

interface AuthResponse {
    Token: string;
}

interface LoginProps {
    onLoginSuccess?: (token: string) => void;
    apiBaseUrl?: string;
}

const Login: React.FC<LoginProps> = ({onLoginSuccess, apiBaseUrl = 'http://localhost:5000/api'}) => {
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
        // Clear error when user starts typing
        if (error) setError('');
    };

    const handleSubmit = async (e: React.MouseEvent | React.KeyboardEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response = await fetch(`${apiBaseUrl}/auth/login`, {
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

            // Store token in localStorage
            localStorage.setItem('authToken', data.Token);

            // Call callback if provided
            if (onLoginSuccess) {
                onLoginSuccess(data.Token);
            }

            console.log('Login successful:', data);

        } catch (err) {
            console.error('Login error:', err);
            setError(err instanceof Error ? err.message : 'Connection error');
        } finally {
            setIsLoading(false);
        }
    };

    const isFormValid = formData.userId.trim() !== '' && formData.password.trim() !== '';

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full space-y-8">
                {/* Header */}
                <div className="text-center">
                    <div className="mx-auto h-12 w-12 bg-orange-500 rounded-full flex items-center justify-center mb-4">
                        <User className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-3xl font-bold text-gray-900">KitchenIQ</h2>
                    <p className="mt-2 text-sm text-gray-600">Sign in to your account</p>
                </div>

                {/* Form */}
                <div className="mt-8 space-y-6">
                    <div className="bg-white rounded-lg shadow-lg p-6 space-y-4">

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center space-x-2">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                                <span className="text-sm text-red-700">{error}</span>
                            </div>
                        )}

                        {/* User ID Field */}
                        <div className="space-y-1">
                            <label htmlFor="userId" className="text-sm font-medium text-gray-700">
                                User ID
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <User className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    id="userId"
                                    name="userId"
                                    type="text"
                                    required
                                    value={formData.userId}
                                    onChange={handleInputChange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && isFormValid && !isLoading) {
                                            handleSubmit(e as any);
                                        }
                                    }}
                                    className="pl-10 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                                    placeholder="Enter your user ID"
                                />
                            </div>
                        </div>

                        {/* Password Field */}
                        <div className="space-y-1">
                            <label htmlFor="password" className="text-sm font-medium text-gray-700">
                                Password
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-gray-400" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    required
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && isFormValid && !isLoading) {
                                            handleSubmit(e as any);
                                        }
                                    }}
                                    className="pl-10 pr-10 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-orange-500 focus:border-orange-500"
                                    placeholder="Enter your password"
                                />
                                <button
                                    type="button"
                                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? (
                                        <EyeOff className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                                    ) : (
                                        <Eye className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Submit Button */}
                        <button
                            type="button"
                            onClick={(e) => handleSubmit(e as any)}
                            disabled={!isFormValid || isLoading}
                            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                                isFormValid && !isLoading
                                    ? 'bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500'
                                    : 'bg-gray-400 cursor-not-allowed'
                            } transition duration-150 ease-in-out`}
                        >
                            {isLoading ? (
                                <div className="flex items-center">
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                    Signing in...
                                </div>
                            ) : (
                                'Sign In'
                            )}
                        </button>
                    </div>

                    {/* Footer */}
                    <div className="text-center">
                        <p className="text-xs text-gray-500">
                            Having trouble signing in? Contact your system administrator
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;