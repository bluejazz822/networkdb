import type { User, Role, Permission } from '@/types/index';

/**
 * Permission checking utilities
 * These utilities can work with user objects directly
 */

/**
 * Extract all permissions from user's roles
 */
export function getUserPermissions(user: User | null): string[] {
  if (!user || !user.roles) return [];
  
  const permissions: string[] = [];
  
  user.roles.forEach(role => {
    if (role.permissions) {
      role.permissions.forEach(permission => {
        if (permission.isActive && !permissions.includes(permission.name)) {
          permissions.push(permission.name);
        }
      });
    }
  });
  
  // Add direct permissions if any
  if (user.permissions) {
    user.permissions.forEach(permission => {
      if (!permissions.includes(permission)) {
        permissions.push(permission);
      }
    });
  }
  
  return permissions;
}

/**
 * Extract all role names from user
 */
export function getUserRoles(user: User | null): string[] {
  if (!user || !user.roles) return [];
  
  return user.roles
    .filter(role => role.isActive)
    .map(role => role.name);
}

/**
 * Check if user has specific permission
 */
export function userHasPermission(user: User | null, permission: string): boolean {
  const permissions = getUserPermissions(user);
  return permissions.includes(permission);
}

/**
 * Check if user has specific role
 */
export function userHasRole(user: User | null, roleName: string): boolean {
  const roles = getUserRoles(user);
  return roles.includes(roleName);
}

/**
 * Check if user has any of the specified permissions
 */
export function userHasAnyPermission(user: User | null, permissions: string[]): boolean {
  const userPermissions = getUserPermissions(user);
  return permissions.some(permission => userPermissions.includes(permission));
}

/**
 * Check if user has all of the specified permissions
 */
export function userHasAllPermissions(user: User | null, permissions: string[]): boolean {
  const userPermissions = getUserPermissions(user);
  return permissions.every(permission => userPermissions.includes(permission));
}

/**
 * Check if user has any of the specified roles
 */
export function userHasAnyRole(user: User | null, roles: string[]): boolean {
  const userRoles = getUserRoles(user);
  return roles.some(role => userRoles.includes(role));
}

/**
 * Check if user has all of the specified roles
 */
export function userHasAllRoles(user: User | null, roles: string[]): boolean {
  const userRoles = getUserRoles(user);
  return roles.every(role => userRoles.includes(role));
}

/**
 * Get user's highest role based on priority
 */
export function getUserHighestRole(user: User | null): Role | null {
  if (!user || !user.roles || user.roles.length === 0) return null;
  
  return user.roles
    .filter(role => role.isActive)
    .sort((a, b) => a.priority - b.priority)[0] || null;
}

/**
 * Check if user is admin (has admin-level role)
 */
export function userIsAdmin(user: User | null): boolean {
  return userHasAnyRole(user, ['ADMIN', 'SUPER_ADMIN']);
}

/**
 * Check if user is super admin
 */
export function userIsSuperAdmin(user: User | null): boolean {
  return userHasRole(user, 'SUPER_ADMIN');
}

/**
 * Check if user can manage other users
 */
export function userCanManageUsers(user: User | null): boolean {
  return userHasAnyPermission(user, ['user:manage', 'user:write']);
}

/**
 * Check if user can manage roles
 */
export function userCanManageRoles(user: User | null): boolean {
  return userHasAnyPermission(user, ['role:manage', 'role:write']);
}

/**
 * Check if user can manage permissions
 */
export function userCanManagePermissions(user: User | null): boolean {
  return userHasAnyPermission(user, ['permission:manage', 'permission:write']);
}

/**
 * Check if user can manage network resources
 */
export function userCanManageNetwork(user: User | null): boolean {
  return userHasAnyPermission(user, [
    'network:manage', 
    'network:write',
    'vpc:manage',
    'vpc:write'
  ]);
}

/**
 * Check if user can view dashboards
 */
export function userCanViewDashboard(user: User | null): boolean {
  return userHasAnyPermission(user, ['dashboard:read', 'dashboard:manage']);
}

/**
 * Get permission display name from permission string
 */
export function getPermissionDisplayName(permission: string): string {
  const [resource, action] = permission.split(':');
  if (!resource || !action) return permission;
  
  const resourceName = resource
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  const actionName = action.charAt(0).toUpperCase() + action.slice(1);
  
  return `${actionName} ${resourceName}`;
}

/**
 * Group permissions by resource
 */
export function groupPermissionsByResource(permissions: Permission[]): Record<string, Permission[]> {
  return permissions.reduce((groups, permission) => {
    const resource = permission.resource;
    if (!groups[resource]) {
      groups[resource] = [];
    }
    groups[resource].push(permission);
    return groups;
  }, {} as Record<string, Permission[]>);
}

/**
 * Common permission constants for easy reference
 */
export const PERMISSIONS = {
  // Network permissions
  NETWORK_READ: 'network:read',
  NETWORK_WRITE: 'network:write',
  NETWORK_DELETE: 'network:delete',
  NETWORK_MANAGE: 'network:manage',
  
  // VPC permissions
  VPC_READ: 'vpc:read',
  VPC_WRITE: 'vpc:write',
  VPC_DELETE: 'vpc:delete',
  VPC_MANAGE: 'vpc:manage',
  
  // User management permissions
  USER_READ: 'user:read',
  USER_WRITE: 'user:write',
  USER_DELETE: 'user:delete',
  USER_MANAGE: 'user:manage',
  
  // Role management permissions
  ROLE_READ: 'role:read',
  ROLE_WRITE: 'role:write',
  ROLE_DELETE: 'role:delete',
  ROLE_MANAGE: 'role:manage',
  
  // Permission management permissions
  PERMISSION_READ: 'permission:read',
  PERMISSION_WRITE: 'permission:write',
  PERMISSION_DELETE: 'permission:delete',
  PERMISSION_MANAGE: 'permission:manage',
  
  // Dashboard permissions
  DASHBOARD_READ: 'dashboard:read',
  DASHBOARD_WRITE: 'dashboard:write',
  DASHBOARD_MANAGE: 'dashboard:manage',
  
  // System permissions
  SYSTEM_READ: 'system:read',
  SYSTEM_WRITE: 'system:write',
  SYSTEM_MANAGE: 'system:manage',
} as const;

/**
 * Common role constants
 */
export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  NETWORK_ADMIN: 'NETWORK_ADMIN',
  NETWORK_VIEWER: 'NETWORK_VIEWER',
  USER: 'USER',
} as const;

/**
 * Permission groups for easier management
 */
export const PERMISSION_GROUPS = {
  NETWORK: [
    PERMISSIONS.NETWORK_READ,
    PERMISSIONS.NETWORK_WRITE,
    PERMISSIONS.NETWORK_DELETE,
    PERMISSIONS.NETWORK_MANAGE,
    PERMISSIONS.VPC_READ,
    PERMISSIONS.VPC_WRITE,
    PERMISSIONS.VPC_DELETE,
    PERMISSIONS.VPC_MANAGE,
  ],
  USER_MANAGEMENT: [
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_WRITE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.USER_MANAGE,
  ],
  ROLE_MANAGEMENT: [
    PERMISSIONS.ROLE_READ,
    PERMISSIONS.ROLE_WRITE,
    PERMISSIONS.ROLE_DELETE,
    PERMISSIONS.ROLE_MANAGE,
  ],
  SYSTEM: [
    PERMISSIONS.SYSTEM_READ,
    PERMISSIONS.SYSTEM_WRITE,
    PERMISSIONS.SYSTEM_MANAGE,
    PERMISSIONS.DASHBOARD_READ,
    PERMISSIONS.DASHBOARD_WRITE,
    PERMISSIONS.DASHBOARD_MANAGE,
  ],
} as const;