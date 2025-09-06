import React, { ReactNode } from 'react';
import { Result, Button } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { usePermissions } from '@/hooks/useAuth';

interface PermissionGuardProps {
  children: ReactNode;
  permission?: string;
  permissions?: string[];
  role?: string;
  roles?: string[];
  requireAll?: boolean; // If true, user must have ALL permissions/roles
  fallback?: ReactNode;
  showError?: boolean;
}

/**
 * PermissionGuard component that protects content based on permissions or roles
 */
export default function PermissionGuard({
  children,
  permission,
  permissions = [],
  role,
  roles = [],
  requireAll = false,
  fallback,
  showError = true,
}: PermissionGuardProps) {
  const { hasPermission, hasRole, hasAnyPermission, hasAllPermissions } = usePermissions();

  // Build permission and role arrays
  const allPermissions = permission ? [permission, ...permissions] : permissions;
  const allRoles = role ? [role, ...roles] : roles;

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

  // Return children if user has access
  if (hasAccess) {
    return <>{children}</>;
  }

  // Return custom fallback if provided
  if (fallback) {
    return <>{fallback}</>;
  }

  // Return error message if showError is true
  if (showError) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="Sorry, you are not authorized to access this page."
        icon={<ExclamationCircleOutlined />}
        extra={
          <Button type="primary" onClick={() => window.history.back()}>
            Go Back
          </Button>
        }
      />
    );
  }

  // Return nothing (hide content)
  return null;
}