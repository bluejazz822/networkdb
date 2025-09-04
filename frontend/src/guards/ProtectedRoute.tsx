import React, { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Spin, Result, Button } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { useAuth, usePermissions } from '@/hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  // Authentication requirements
  requireAuth?: boolean;
  // Permission requirements
  permission?: string;
  permissions?: string[];
  // Role requirements
  role?: string;
  roles?: string[];
  // Logical operators
  requireAll?: boolean; // If true, user must have ALL permissions/roles
  // Fallback components
  loadingFallback?: ReactNode;
  unauthorizedFallback?: ReactNode;
  // Redirect options
  redirectTo?: string;
  // Error display options
  showUnauthorized?: boolean;
}

/**
 * ProtectedRoute component that combines authentication and authorization checks
 */
export default function ProtectedRoute({
  children,
  requireAuth = true,
  permission,
  permissions = [],
  role,
  roles = [],
  requireAll = false,
  loadingFallback,
  unauthorizedFallback,
  redirectTo,
  showUnauthorized = true,
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const { hasPermission, hasRole, hasAnyPermission, hasAllPermissions } = usePermissions();
  const location = useLocation();

  // Show loading while checking authentication
  if (isLoading && requireAuth) {
    return loadingFallback || (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh'
      }}>
        <Spin size="large" tip="Loading..." />
      </div>
    );
  }

  // Check authentication requirement
  if (requireAuth && !isAuthenticated) {
    if (redirectTo) {
      return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
    }
    return (
      <Navigate
        to="/auth/login"
        state={{ 
          from: location.pathname,
          message: 'Please log in to access this page.'
        }}
        replace
      />
    );
  }

  // Build permission and role arrays for authorization check
  const allPermissions = permission ? [permission, ...permissions] : permissions;
  const allRoles = role ? [role, ...roles] : roles;

  // Check authorization if user is authenticated
  if (isAuthenticated && (allPermissions.length > 0 || allRoles.length > 0)) {
    let hasAccess = true;

    // Check permissions
    if (allPermissions.length > 0) {
      if (requireAll) {
        hasAccess = hasAccess && hasAllPermissions(allPermissions);
      } else {
        hasAccess = hasAccess && hasAnyPermission(allPermissions);
      }
    }

    // Check roles
    if (allRoles.length > 0) {
      const roleAccess = requireAll 
        ? allRoles.every(r => hasRole(r))
        : allRoles.some(r => hasRole(r));
      hasAccess = hasAccess && roleAccess;
    }

    // Handle unauthorized access
    if (!hasAccess) {
      if (unauthorizedFallback) {
        return <>{unauthorizedFallback}</>;
      }

      if (showUnauthorized) {
        return (
          <Result
            status="403"
            title="Access Denied"
            subTitle="You don't have permission to access this page."
            icon={<ExclamationCircleOutlined />}
            extra={[
              <Button key="back" onClick={() => window.history.back()}>
                Go Back
              </Button>,
              <Button key="home" type="primary" onClick={() => window.location.href = '/dashboard'}>
                Go to Dashboard
              </Button>
            ]}
          />
        );
      }

      // Redirect to unauthorized page or dashboard
      return <Navigate to="/dashboard" replace />;
    }
  }

  // Render protected content
  return <>{children}</>;
}