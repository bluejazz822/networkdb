'use strict';

const { createMigrationHelper } = require('../utils/migration-helper');
const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const helper = createMigrationHelper(queryInterface);

    // Create roles table
    await helper.createTableWithCommonFields('roles', {
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Unique role name (e.g., ADMIN, USER, NETWORK_VIEWER)'
      },
      displayName: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Human-readable role name'
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Role description and purpose'
      },
      isSystem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'System roles cannot be deleted'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether role is active and assignable'
      },
      priority: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 100,
        comment: 'Role priority for conflict resolution (lower = higher priority)'
      }
    }, {
      comment: 'User roles for role-based access control (RBAC)'
    });

    // Create permissions table
    await helper.createTableWithCommonFields('permissions', {
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Unique permission name in format "resource:action"'
      },
      displayName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'Human-readable permission name'
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Permission description and usage'
      },
      resource: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Resource this permission applies to'
      },
      action: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Action this permission allows'
      },
      isSystem: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'System permissions cannot be deleted'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether permission is active and usable'
      }
    }, {
      comment: 'System permissions for fine-grained access control'
    });

    // Create user_roles junction table (many-to-many)
    await helper.createTableWithCommonFields('user_roles', {
      userId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Reference to users table'
      },
      roleId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Reference to roles table'
      },
      assignedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'User who assigned this role'
      },
      assignedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When this role was assigned'
      },
      expiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Role assignment expiration (null = never expires)'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether role assignment is active'
      }
    }, {
      comment: 'User-role assignments with metadata'
    });

    // Create role_permissions junction table (many-to-many)
    await helper.createTableWithCommonFields('role_permissions', {
      roleId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Reference to roles table'
      },
      permissionId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Reference to permissions table'
      },
      grantedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'User who granted this permission'
      },
      grantedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When this permission was granted'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether permission grant is active'
      }
    }, {
      comment: 'Role-permission assignments with metadata'
    });

    // Add indexes for roles table
    await helper.createIndex('roles', 'name', {
      unique: true,
      name: 'idx_roles_name_unique'
    });

    await helper.createIndex('roles', 'displayName', {
      name: 'idx_roles_display_name'
    });

    await helper.createIndex('roles', ['isSystem', 'isActive'], {
      name: 'idx_roles_system_active'
    });

    await helper.createIndex('roles', 'priority', {
      name: 'idx_roles_priority'
    });

    // Add indexes for permissions table
    await helper.createIndex('permissions', 'name', {
      unique: true,
      name: 'idx_permissions_name_unique'
    });

    await helper.createIndex('permissions', 'resource', {
      name: 'idx_permissions_resource'
    });

    await helper.createIndex('permissions', 'action', {
      name: 'idx_permissions_action'
    });

    await helper.createIndex('permissions', ['resource', 'action'], {
      name: 'idx_permissions_resource_action'
    });

    await helper.createIndex('permissions', ['isSystem', 'isActive'], {
      name: 'idx_permissions_system_active'
    });

    // Add indexes for user_roles table
    await helper.createIndex('user_roles', 'userId', {
      name: 'idx_user_roles_user_id'
    });

    await helper.createIndex('user_roles', 'roleId', {
      name: 'idx_user_roles_role_id'
    });

    await helper.createIndex('user_roles', ['userId', 'roleId'], {
      unique: true,
      name: 'idx_user_roles_user_role_unique'
    });

    await helper.createIndex('user_roles', 'assignedBy', {
      name: 'idx_user_roles_assigned_by'
    });

    await helper.createIndex('user_roles', 'assignedAt', {
      name: 'idx_user_roles_assigned_at'
    });

    await helper.createIndex('user_roles', 'expiresAt', {
      name: 'idx_user_roles_expires_at'
    });

    await helper.createIndex('user_roles', ['isActive', 'expiresAt'], {
      name: 'idx_user_roles_active_not_expired'
    });

    // Add indexes for role_permissions table
    await helper.createIndex('role_permissions', 'roleId', {
      name: 'idx_role_permissions_role_id'
    });

    await helper.createIndex('role_permissions', 'permissionId', {
      name: 'idx_role_permissions_permission_id'
    });

    await helper.createIndex('role_permissions', ['roleId', 'permissionId'], {
      unique: true,
      name: 'idx_role_permissions_role_permission_unique'
    });

    await helper.createIndex('role_permissions', 'grantedBy', {
      name: 'idx_role_permissions_granted_by'
    });

    await helper.createIndex('role_permissions', 'grantedAt', {
      name: 'idx_role_permissions_granted_at'
    });

    await helper.createIndex('role_permissions', 'isActive', {
      name: 'idx_role_permissions_active'
    });

    // Add foreign key constraints
    await helper.addForeignKey('user_roles', 'userId', 'users', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await helper.addForeignKey('user_roles', 'roleId', 'roles', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await helper.addForeignKey('user_roles', 'assignedBy', 'users', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await helper.addForeignKey('role_permissions', 'roleId', 'roles', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await helper.addForeignKey('role_permissions', 'permissionId', 'permissions', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await helper.addForeignKey('role_permissions', 'grantedBy', 'users', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add check constraints
    await queryInterface.addConstraint('roles', {
      type: 'check',
      fields: ['priority'],
      name: 'chk_roles_priority_range',
      where: {
        priority: {
          [Sequelize.Op.between]: [0, 1000]
        }
      }
    });

    // Insert system roles
    const systemRoles = [
      {
        id: 'a0000000-0000-4000-8000-000000000001',
        name: 'SUPER_ADMIN',
        displayName: 'Super Administrator',
        description: 'Full system access with all permissions',
        isSystem: true,
        isActive: true,
        priority: 1,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'a0000000-0000-4000-8000-000000000002',
        name: 'ADMIN',
        displayName: 'Administrator',
        description: 'Administrative access to most system functions',
        isSystem: true,
        isActive: true,
        priority: 10,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'a0000000-0000-4000-8000-000000000003',
        name: 'NETWORK_ADMIN',
        displayName: 'Network Administrator',
        description: 'Full access to network resources and configuration',
        isSystem: true,
        isActive: true,
        priority: 20,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'a0000000-0000-4000-8000-000000000004',
        name: 'NETWORK_VIEWER',
        displayName: 'Network Viewer',
        description: 'Read-only access to network resources',
        isSystem: true,
        isActive: true,
        priority: 50,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'a0000000-0000-4000-8000-000000000005',
        name: 'USER',
        displayName: 'User',
        description: 'Basic user access with limited permissions',
        isSystem: true,
        isActive: true,
        priority: 100,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await queryInterface.bulkInsert('roles', systemRoles);

    // Insert system permissions
    const systemPermissions = [
      // Network permissions
      { name: 'network:read', displayName: 'View Network Resources', description: 'View network resources and configurations', resource: 'network', action: 'read' },
      { name: 'network:write', displayName: 'Modify Network Resources', description: 'Create and modify network resources', resource: 'network', action: 'write' },
      { name: 'network:delete', displayName: 'Delete Network Resources', description: 'Delete network resources', resource: 'network', action: 'delete' },
      { name: 'network:manage', displayName: 'Manage Network Resources', description: 'Full network resource management', resource: 'network', action: 'manage' },

      // VPC permissions
      { name: 'vpc:read', displayName: 'View VPCs', description: 'View VPC information', resource: 'vpc', action: 'read' },
      { name: 'vpc:write', displayName: 'Modify VPCs', description: 'Create and modify VPCs', resource: 'vpc', action: 'write' },
      { name: 'vpc:delete', displayName: 'Delete VPCs', description: 'Delete VPCs', resource: 'vpc', action: 'delete' },
      { name: 'vpc:manage', displayName: 'Manage VPCs', description: 'Full VPC management', resource: 'vpc', action: 'manage' },

      // Subnet permissions
      { name: 'subnet:read', displayName: 'View Subnets', description: 'View subnet information', resource: 'subnet', action: 'read' },
      { name: 'subnet:write', displayName: 'Modify Subnets', description: 'Create and modify subnets', resource: 'subnet', action: 'write' },
      { name: 'subnet:delete', displayName: 'Delete Subnets', description: 'Delete subnets', resource: 'subnet', action: 'delete' },
      { name: 'subnet:manage', displayName: 'Manage Subnets', description: 'Full subnet management', resource: 'subnet', action: 'manage' },

      // Transit Gateway permissions
      { name: 'transit_gateway:read', displayName: 'View Transit Gateways', description: 'View transit gateway information', resource: 'transit_gateway', action: 'read' },
      { name: 'transit_gateway:write', displayName: 'Modify Transit Gateways', description: 'Create and modify transit gateways', resource: 'transit_gateway', action: 'write' },
      { name: 'transit_gateway:delete', displayName: 'Delete Transit Gateways', description: 'Delete transit gateways', resource: 'transit_gateway', action: 'delete' },
      { name: 'transit_gateway:manage', displayName: 'Manage Transit Gateways', description: 'Full transit gateway management', resource: 'transit_gateway', action: 'manage' },

      // User management permissions
      { name: 'user:read', displayName: 'View Users', description: 'View user accounts and profiles', resource: 'user', action: 'read' },
      { name: 'user:write', displayName: 'Modify Users', description: 'Create and modify user accounts', resource: 'user', action: 'write' },
      { name: 'user:delete', displayName: 'Delete Users', description: 'Delete user accounts', resource: 'user', action: 'delete' },
      { name: 'user:manage', displayName: 'Manage Users', description: 'Full user account management', resource: 'user', action: 'manage' },

      // Role management permissions
      { name: 'role:read', displayName: 'View Roles', description: 'View role definitions and assignments', resource: 'role', action: 'read' },
      { name: 'role:write', displayName: 'Modify Roles', description: 'Create and modify roles', resource: 'role', action: 'write' },
      { name: 'role:delete', displayName: 'Delete Roles', description: 'Delete roles', resource: 'role', action: 'delete' },
      { name: 'role:manage', displayName: 'Manage Roles', description: 'Full role management', resource: 'role', action: 'manage' },

      // Permission management permissions
      { name: 'permission:read', displayName: 'View Permissions', description: 'View permission definitions', resource: 'permission', action: 'read' },
      { name: 'permission:write', displayName: 'Modify Permissions', description: 'Create and modify permissions', resource: 'permission', action: 'write' },
      { name: 'permission:delete', displayName: 'Delete Permissions', description: 'Delete permissions', resource: 'permission', action: 'delete' },
      { name: 'permission:manage', displayName: 'Manage Permissions', description: 'Full permission management', resource: 'permission', action: 'manage' },

      // Dashboard permissions
      { name: 'dashboard:read', displayName: 'View Dashboard', description: 'Access dashboard and reports', resource: 'dashboard', action: 'read' },
      { name: 'dashboard:write', displayName: 'Modify Dashboard', description: 'Customize dashboard settings', resource: 'dashboard', action: 'write' },
      { name: 'dashboard:manage', displayName: 'Manage Dashboard', description: 'Full dashboard management', resource: 'dashboard', action: 'manage' },

      // System permissions
      { name: 'system:read', displayName: 'View System Info', description: 'View system status and configuration', resource: 'system', action: 'read' },
      { name: 'system:write', displayName: 'Modify System', description: 'Modify system configuration', resource: 'system', action: 'write' },
      { name: 'system:manage', displayName: 'Manage System', description: 'Full system administration', resource: 'system', action: 'manage' },

      // API permissions
      { name: 'api:read', displayName: 'API Read Access', description: 'Read access to API endpoints', resource: 'api', action: 'read' },
      { name: 'api:write', displayName: 'API Write Access', description: 'Write access to API endpoints', resource: 'api', action: 'write' },
      { name: 'api:manage', displayName: 'API Management', description: 'Full API access and management', resource: 'api', action: 'manage' }
    ];

    const permissionsToInsert = systemPermissions.map((perm, index) => ({
      id: `b${index.toString().padStart(7, '0')}-0000-4000-8000-000000000000`,
      ...perm,
      isSystem: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await queryInterface.bulkInsert('permissions', permissionsToInsert);

    // Add comments to tables
    await queryInterface.sequelize.query(`
      ALTER TABLE roles COMMENT = 'User roles for role-based access control (RBAC) in Network CMDB'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE permissions COMMENT = 'System permissions for fine-grained access control in Network CMDB'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE user_roles COMMENT = 'User-role assignments with metadata and expiration support'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE role_permissions COMMENT = 'Role-permission assignments for RBAC system'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Remove foreign key constraints first
    const foreignKeysToRemove = [
      { table: 'user_roles', constraint: 'fk_user_roles_userId' },
      { table: 'user_roles', constraint: 'fk_user_roles_roleId' },
      { table: 'user_roles', constraint: 'fk_user_roles_assignedBy' },
      { table: 'role_permissions', constraint: 'fk_role_permissions_roleId' },
      { table: 'role_permissions', constraint: 'fk_role_permissions_permissionId' },
      { table: 'role_permissions', constraint: 'fk_role_permissions_grantedBy' }
    ];

    for (const fk of foreignKeysToRemove) {
      try {
        await queryInterface.removeConstraint(fk.table, fk.constraint);
      } catch (error) {
        console.warn(`Constraint ${fk.constraint} not found, skipping removal`);
      }
    }

    // Remove check constraints
    try {
      await queryInterface.removeConstraint('roles', 'chk_roles_priority_range');
    } catch (error) {
      console.warn('Check constraint chk_roles_priority_range not found, skipping removal');
    }

    // Drop tables in reverse order
    await queryInterface.dropTable('role_permissions');
    await queryInterface.dropTable('user_roles');
    await queryInterface.dropTable('permissions');
    await queryInterface.dropTable('roles');
  }
};