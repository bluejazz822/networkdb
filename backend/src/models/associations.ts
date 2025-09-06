import User from './User';
import Role from './Role';
import Permission from './Permission';

/**
 * Define all model associations for the authentication system
 * This file sets up the many-to-many relationships between Users, Roles, and Permissions
 */

// User-Role associations (Many-to-Many through user_roles)
User.belongsToMany(Role, {
  through: 'user_roles',
  foreignKey: 'userId',
  otherKey: 'roleId',
  as: 'roles',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

Role.belongsToMany(User, {
  through: 'user_roles',
  foreignKey: 'roleId',
  otherKey: 'userId',
  as: 'users',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// Role-Permission associations (Many-to-Many through role_permissions)
Role.belongsToMany(Permission, {
  through: 'role_permissions',
  foreignKey: 'roleId',
  otherKey: 'permissionId',
  as: 'permissions',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

Permission.belongsToMany(Role, {
  through: 'role_permissions',
  foreignKey: 'permissionId',
  otherKey: 'roleId',
  as: 'roles',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// Additional useful association methods for the junction tables

/**
 * User role assignment methods
 * These allow working with role assignments directly
 */

// Self-referencing associations for user_roles metadata
User.belongsToMany(User, {
  through: 'user_roles',
  foreignKey: 'assignedBy',
  otherKey: 'userId',
  as: 'assignedUsers',
  constraints: false // Disable constraints to avoid circular reference
});

User.belongsToMany(User, {
  through: 'user_roles',
  foreignKey: 'userId',
  otherKey: 'assignedBy',
  as: 'assignedByUsers',
  constraints: false // Disable constraints to avoid circular reference
});

// Self-referencing associations for role_permissions metadata
User.belongsToMany(Permission, {
  through: {
    model: 'role_permissions',
    unique: false
  },
  foreignKey: 'grantedBy',
  otherKey: 'permissionId',
  as: 'grantedPermissions',
  constraints: false // Disable constraints to avoid circular reference
});

Permission.belongsToMany(User, {
  through: {
    model: 'role_permissions',
    unique: false
  },
  foreignKey: 'permissionId',
  otherKey: 'grantedBy',
  as: 'grantedByUsers',
  constraints: false // Disable constraints to avoid circular reference
});

/**
 * Export all models with associations configured
 */
export { User, Role, Permission };

/**
 * Utility function to get all user permissions (through roles)
 */
export async function getUserPermissions(userId: string): Promise<Permission[]> {
  const user = await User.findByPk(userId, {
    include: [{
      model: Role,
      as: 'roles',
      where: { isActive: true },
      required: false,
      include: [{
        model: Permission,
        as: 'permissions',
        where: { isActive: true },
        required: false,
        through: {
          where: { isActive: true }
        }
      }],
      through: {
        where: { 
          isActive: true,
          // Check if role assignment hasn't expired
          [require('sequelize').Op.or]: [
            { expiresAt: null },
            { expiresAt: { [require('sequelize').Op.gt]: new Date() } }
          ]
        }
      }
    }]
  });

  if (!user) {
    return [];
  }

  // Flatten permissions from all roles
  const permissions: Permission[] = [];
  const seenPermissions = new Set<string>();

  for (const role of user.roles || []) {
    for (const permission of role.permissions || []) {
      if (!seenPermissions.has(permission.id)) {
        permissions.push(permission);
        seenPermissions.add(permission.id);
      }
    }
  }

  return permissions;
}

/**
 * Utility function to check if user has specific permission
 */
export async function userHasPermission(userId: string, permissionName: string): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.some(permission => permission.name === permissionName);
}

/**
 * Utility function to check if user has any of the specified permissions
 */
export async function userHasAnyPermission(userId: string, permissionNames: string[]): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  return permissions.some(permission => permissionNames.includes(permission.name));
}

/**
 * Utility function to check if user has all of the specified permissions
 */
export async function userHasAllPermissions(userId: string, permissionNames: string[]): Promise<boolean> {
  const permissions = await getUserPermissions(userId);
  const userPermissionNames = permissions.map(p => p.name);
  return permissionNames.every(permissionName => userPermissionNames.includes(permissionName));
}

/**
 * Utility function to get user roles
 */
export async function getUserRoles(userId: string): Promise<Role[]> {
  const user = await User.findByPk(userId, {
    include: [{
      model: Role,
      as: 'roles',
      where: { isActive: true },
      required: false,
      through: {
        where: { 
          isActive: true,
          // Check if role assignment hasn't expired
          [require('sequelize').Op.or]: [
            { expiresAt: null },
            { expiresAt: { [require('sequelize').Op.gt]: new Date() } }
          ]
        }
      }
    }]
  });

  return user?.roles || [];
}

/**
 * Utility function to check if user has specific role
 */
export async function userHasRole(userId: string, roleName: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.some(role => role.name === roleName);
}

/**
 * Utility function to check if user has any of the specified roles
 */
export async function userHasAnyRole(userId: string, roleNames: string[]): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.some(role => roleNames.includes(role.name));
}

/**
 * Utility function to assign role to user
 */
export async function assignRoleToUser(
  userId: string, 
  roleId: string, 
  assignedBy?: string,
  expiresAt?: Date
): Promise<void> {
  const user = await User.findByPk(userId);
  const role = await Role.findByPk(roleId);

  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  if (!role) {
    throw new Error(`Role with ID ${roleId} not found`);
  }

  if (!role.isActive) {
    throw new Error(`Role ${role.name} is not active`);
  }

  // Add the role with metadata
  await user.addRole(role, {
    through: {
      assignedBy,
      assignedAt: new Date(),
      expiresAt,
      isActive: true
    }
  });
}

/**
 * Utility function to remove role from user
 */
export async function removeRoleFromUser(userId: string, roleId: string): Promise<void> {
  const user = await User.findByPk(userId);
  const role = await Role.findByPk(roleId);

  if (!user) {
    throw new Error(`User with ID ${userId} not found`);
  }

  if (!role) {
    throw new Error(`Role with ID ${roleId} not found`);
  }

  await user.removeRole(role);
}

/**
 * Utility function to assign permission to role
 */
export async function assignPermissionToRole(
  roleId: string, 
  permissionId: string, 
  grantedBy?: string
): Promise<void> {
  const role = await Role.findByPk(roleId);
  const permission = await Permission.findByPk(permissionId);

  if (!role) {
    throw new Error(`Role with ID ${roleId} not found`);
  }

  if (!permission) {
    throw new Error(`Permission with ID ${permissionId} not found`);
  }

  if (!permission.isActive) {
    throw new Error(`Permission ${permission.name} is not active`);
  }

  // Add the permission with metadata
  await role.addPermission(permission, {
    through: {
      grantedBy,
      grantedAt: new Date(),
      isActive: true
    }
  });
}

/**
 * Utility function to remove permission from role
 */
export async function removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
  const role = await Role.findByPk(roleId);
  const permission = await Permission.findByPk(permissionId);

  if (!role) {
    throw new Error(`Role with ID ${roleId} not found`);
  }

  if (!permission) {
    throw new Error(`Permission with ID ${permissionId} not found`);
  }

  await role.removePermission(permission);
}