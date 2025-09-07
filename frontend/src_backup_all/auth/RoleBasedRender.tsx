import React, { ReactNode } from 'react';
import { usePermissions } from '@/hooks/useAuth';

interface RoleBasedRenderProps {
  children: ReactNode;
  permission?: string;
  permissions?: string[];
  role?: string;
  roles?: string[];
  requireAll?: boolean;
  fallback?: ReactNode;
}

/**
 * RoleBasedRender component for conditional rendering based on user permissions/roles
 * This is a lighter version of PermissionGuard that doesn't show error messages
 */
export default function RoleBasedRender({
  children,
  permission,
  permissions = [],
  role,
  roles = [],
  requireAll = false,
  fallback = null,
}: RoleBasedRenderProps) {
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

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

/**
 * Hook version for conditional rendering in functional components
 */
export function useRoleBasedAccess({
  permission,
  permissions = [],
  role,
  roles = [],
  requireAll = false,
}: Omit<RoleBasedRenderProps, 'children' | 'fallback'>): boolean {
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

  return hasAccess;
}