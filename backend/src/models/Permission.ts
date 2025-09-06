import { DataTypes, Model, Optional, Association, BelongsToManyGetAssociationsMixin } from 'sequelize';
import { getDatabase } from '../config/database';

const sequelize = getDatabase();

/**
 * Permission attributes interface
 */
export interface PermissionAttributes {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  resource: string;
  action: string;
  isSystem: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * Permission creation attributes (optional fields during creation)
 */
export interface PermissionCreationAttributes extends Optional<PermissionAttributes, 
  'id' | 'isSystem' | 'isActive' | 'createdAt' | 'updatedAt' | 'deletedAt'
> {}

/**
 * Permission model class
 */
export class Permission extends Model<PermissionAttributes, PermissionCreationAttributes> 
  implements PermissionAttributes {
  public id!: string;
  public name!: string;
  public displayName!: string;
  public description?: string;
  public resource!: string;
  public action!: string;
  public isSystem!: boolean;
  public isActive!: boolean;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt?: Date;

  // Association mixins
  public getRoles!: BelongsToManyGetAssociationsMixin<any>;

  // Associations
  public static associations: {
    roles: Association<Permission, any>;
  };

  /**
   * Get the full permission string (resource:action)
   */
  public get fullPermission(): string {
    return `${this.resource}:${this.action}`;
  }

  /**
   * Check if this is a system permission (cannot be deleted)
   */
  public get isSystemPermission(): boolean {
    return this.isSystem;
  }

  /**
   * Get all roles that have this permission
   */
  public async getAssignedRoles(): Promise<any[]> {
    return await this.getRoles({
      where: { isActive: true }
    });
  }

  /**
   * Serialize permission for JSON
   */
  public toJSON(): any {
    const values = super.toJSON();
    values.fullPermission = this.fullPermission;
    return values;
  }
}

// Initialize the Permission model
Permission.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: {
      name: 'unique_permission_name',
      msg: 'Permission name already exists'
    },
    validate: {
      notEmpty: {
        msg: 'Permission name cannot be empty'
      },
      len: {
        args: [3, 100],
        msg: 'Permission name must be between 3 and 100 characters'
      },
      is: {
        args: /^[a-z_]+:[a-z_]+$/,
        msg: 'Permission name must be in format "resource:action" with lowercase letters and underscores'
      }
    }
  },
  displayName: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Display name cannot be empty'
      },
      len: {
        args: [3, 150],
        msg: 'Display name must be between 3 and 150 characters'
      }
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: {
        args: [0, 1000],
        msg: 'Description cannot exceed 1000 characters'
      }
    }
  },
  resource: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Resource cannot be empty'
      },
      len: {
        args: [2, 50],
        msg: 'Resource must be between 2 and 50 characters'
      },
      is: {
        args: /^[a-z_]+$/,
        msg: 'Resource must be lowercase letters and underscores only'
      }
    },
    comment: 'The resource this permission applies to (e.g., network, user, dashboard)'
  },
  action: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Action cannot be empty'
      },
      len: {
        args: [2, 50],
        msg: 'Action must be between 2 and 50 characters'
      },
      is: {
        args: /^[a-z_]+$/,
        msg: 'Action must be lowercase letters and underscores only'
      }
    },
    comment: 'The action this permission allows (e.g., read, write, delete, manage)'
  },
  isSystem: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'System permissions cannot be deleted and have special handling'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  sequelize,
  tableName: 'permissions',
  modelName: 'Permission',
  timestamps: true,
  paranoid: true, // Enables soft deletes
  indexes: [
    {
      fields: ['name']
    },
    {
      fields: ['resource']
    },
    {
      fields: ['action']
    },
    {
      fields: ['resource', 'action']
    },
    {
      fields: ['isSystem']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['createdAt']
    },
    {
      fields: ['updatedAt']
    },
    {
      fields: ['deletedAt']
    }
  ],
  hooks: {
    beforeValidate: (permission: Permission) => {
      // Auto-generate name from resource and action if not provided
      if (!permission.name && permission.resource && permission.action) {
        permission.name = `${permission.resource}:${permission.action}`;
      }
    },
    beforeDestroy: async (permission: Permission) => {
      // Prevent deletion of system permissions
      if (permission.isSystem) {
        throw new Error(`Cannot delete system permission: ${permission.name}`);
      }
    },
    beforeBulkDestroy: async (options) => {
      // Check if any system permissions would be affected
      const permissions = await Permission.findAll({
        where: {
          ...options.where,
          isSystem: true
        },
        paranoid: false
      });
      
      if (permissions.length > 0) {
        throw new Error('Cannot delete system permissions');
      }
    }
  },
  scopes: {
    active: {
      where: {
        isActive: true,
        deletedAt: null
      }
    },
    system: {
      where: {
        isSystem: true
      }
    },
    nonSystem: {
      where: {
        isSystem: false
      }
    },
    byResource: (resource: string) => ({
      where: {
        resource
      }
    }),
    byAction: (action: string) => ({
      where: {
        action
      }
    })
  }
});

// Define system permissions for Network CMDB
export const SystemPermissions = {
  // Network resource permissions
  NETWORK_READ: 'network:read',
  NETWORK_WRITE: 'network:write',
  NETWORK_DELETE: 'network:delete',
  NETWORK_MANAGE: 'network:manage',

  // VPC permissions
  VPC_READ: 'vpc:read',
  VPC_WRITE: 'vpc:write',
  VPC_DELETE: 'vpc:delete',
  VPC_MANAGE: 'vpc:manage',

  // Subnet permissions
  SUBNET_READ: 'subnet:read',
  SUBNET_WRITE: 'subnet:write',
  SUBNET_DELETE: 'subnet:delete',
  SUBNET_MANAGE: 'subnet:manage',

  // Transit Gateway permissions
  TGW_READ: 'transit_gateway:read',
  TGW_WRITE: 'transit_gateway:write',
  TGW_DELETE: 'transit_gateway:delete',
  TGW_MANAGE: 'transit_gateway:manage',

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

  // System administration permissions
  SYSTEM_READ: 'system:read',
  SYSTEM_WRITE: 'system:write',
  SYSTEM_MANAGE: 'system:manage',

  // API permissions
  API_READ: 'api:read',
  API_WRITE: 'api:write',
  API_MANAGE: 'api:manage'
} as const;

// Permission groups for easier management
export const PermissionGroups = {
  NETWORK_RESOURCES: [
    SystemPermissions.NETWORK_READ,
    SystemPermissions.NETWORK_WRITE,
    SystemPermissions.NETWORK_DELETE,
    SystemPermissions.NETWORK_MANAGE
  ],
  VPC_MANAGEMENT: [
    SystemPermissions.VPC_READ,
    SystemPermissions.VPC_WRITE,
    SystemPermissions.VPC_DELETE,
    SystemPermissions.VPC_MANAGE
  ],
  USER_MANAGEMENT: [
    SystemPermissions.USER_READ,
    SystemPermissions.USER_WRITE,
    SystemPermissions.USER_DELETE,
    SystemPermissions.USER_MANAGE
  ],
  ROLE_MANAGEMENT: [
    SystemPermissions.ROLE_READ,
    SystemPermissions.ROLE_WRITE,
    SystemPermissions.ROLE_DELETE,
    SystemPermissions.ROLE_MANAGE
  ],
  SYSTEM_ADMINISTRATION: [
    SystemPermissions.SYSTEM_READ,
    SystemPermissions.SYSTEM_WRITE,
    SystemPermissions.SYSTEM_MANAGE
  ]
} as const;

/**
 * Utility function to check if a permission string is valid
 */
export function isValidPermission(permission: string): boolean {
  return /^[a-z_]+:[a-z_]+$/.test(permission);
}

/**
 * Utility function to parse permission string into resource and action
 */
export function parsePermission(permission: string): { resource: string; action: string } {
  const [resource, action] = permission.split(':');
  return { resource, action };
}

export default Permission;