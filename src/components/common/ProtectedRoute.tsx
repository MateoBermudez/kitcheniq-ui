import { Navigate } from 'react-router-dom';
import { type ReactNode } from 'react';

interface ProtectedRouteProps {
    children: ReactNode;
    allowedRoles: string[];
    userType?: string;
    redirectTo?: string;
}

const ProtectedRoute = ({ children, allowedRoles, userType, redirectTo = '/orders' }: ProtectedRouteProps) => {
    const normalizedUserType = userType?.toUpperCase() || 'EMPLOYEE';
    
    // Check if user's role is allowed to access this route
    const isAllowed = allowedRoles.includes(normalizedUserType);
    
    if (!isAllowed) {
        // Redirect based on user type
        if (normalizedUserType === 'SUPPLIER') {
            return <Navigate to="/supplier" replace />;
        }
        // For EMPLOYEE, CHEF, WAITER, and others
        return <Navigate to={redirectTo} replace />;
    }
    
    return <>{children}</>;
};

export default ProtectedRoute;

