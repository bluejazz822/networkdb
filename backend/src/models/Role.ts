import { DataTypes, Model, Optional, Association, BelongsToManyGetAssociationsMixin } from 'sequelize';
import { getDatabase } from '../config/database';

const sequelize = getDatabase();

/**
 * Role attributes interface
 */
export interface RoleAttributes {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  isSystem: boolean;
  isActive: boolean;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * Role creation attributes (optional fields during creation)
 */
export interface RoleCreationAttributes extends Optional<RoleAttributes, 
  'id' | 'isSystem' | 'isActive' | 'priority' | 'createdAt' | 'updatedAt' | 'deletedAt'
> {}

/**
 * Role model class
 */
export class Role extends Model<RoleAttributes, RoleCreationAttributes> 
  implements RoleAttributes {
  public id!: string;
  public name!: string;
  public displayName!: string;
  public description?: string;
  public isSystem!: boolean;
  public isActive!: boolean;
  public priority!: number;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt?: Date;

  // Association mixins
  public getUsers!: BelongsToManyGetAssociationsMixin<any>;
  public getPermissions!: BelongsToManyGetAssociationsMixin<any>;

  // Associations
  public static associations: {
    users: Association<Role, any>;
    permissions: Association<Role, any>;
  };

  /**
   * Check if role has specific permission
   */
  public async hasPermission(permissionName: string): Promise<boolean> {
    const permissions = await this.getPermissions({
      where: { name: permissionName, isActive: true }
    });
    return permissions.length > 0;
  }

  /**
   * Check if role has any of the specified permissions
   */
  public async hasAnyPermission(permissionNames: string[]): Promise<boolean> {
    const permissions = await this.getPermissions({
      where: { 
        name: permissionNames,
        isActive: true 
      }
    });
    return permissions.length > 0;
  }

  /**
   * Check if role has all of the specified permissions
   */
  public async hasAllPermissions(permissionNames: string[]): Promise<boolean> {
    const permissions = await this.getPermissions({
      where: { 
        name: permissionNames,
        isActive: true 
      }
    });
    return permissions.length === permissionNames.length;
  }

  /**
   * Get all permission names for this role
   */
  public async getPermissionNames(): Promise<string[]> {
    const permissions = await this.getPermissions({
      where: { isActive: true },
      attributes: ['name']
    });
    return permissions.map(permission => permission.name);
  }

  /**
   * Check if this is a system role (cannot be deleted)
   */
  public get isSystemRole(): boolean {
    return this.isSystem;
  }

  /**
   * Serialize role for JSON
   */
  public toJSON(): any {
    const values = super.toJSON();
    return values;
  }
}

// Initialize the Role model
Role.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: {
      name: 'unique_role_name',
      msg: 'Role name already exists'
    },
    validate: {
      notEmpty: {
        msg: 'Role name cannot be empty'
      },
      len: {
        args: [2, 50],
        msg: 'Role name must be between 2 and 50 characters'
      },
      is: {
        args: /^[A-Z_]+$/,
        msg: 'Role name must be uppercase letters and underscores only (e.g., ADMIN, NETWORK_VIEWER)'
      }
    }
  },
  displayName: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Display name cannot be empty'
      },
      len: {
        args: [2, 100],
        msg: 'Display name must be between 2 and 100 characters'
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
  isSystem: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'System roles cannot be deleted and have special handling'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  priority: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100,
    validate: {
      min: {
        args: [0],
        msg: 'Priority cannot be negative'
      },
      max: {
        args: [1000],
        msg: 'Priority cannot exceed 1000'
      }
    },
    comment: 'Role priority for conflict resolution (lower number = higher priority)'
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
  tableName: 'roles',
  modelName: 'Role',
  timestamps: true,
  paranoid: true, // Enables soft deletes
  indexes: [
    {
      fields: ['name']
    },
    {
      fields: ['displayName']
    },
    {
      fields: ['isSystem']
    },
    {
      fields: ['isActive']
    },
    {
      fields: ['priority']
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
    beforeDestroy: async (role: Role) => {
      // Prevent deletion of system roles
      if (role.isSystem) {
        throw new Error(`Cannot delete system role: ${role.name}`);
      }
    },
    beforeBulkDestroy: async (options) => {
      // Check if any system roles would be affected
      const roles = await Role.findAll({
        where: {
          ...options.where,
          isSystem: true
        },
        paranoid: false
      });
      
      if (roles.length > 0) {
        throw new Error('Cannot delete system roles');
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
    byPriority: {
      order: [['priority', 'ASC']]
    }
  }
});

// Define common system roles
export const SystemRoles = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  NETWORK_ADMIN: 'NETWORK_ADMIN',
  NETWORK_VIEWER: 'NETWORK_VIEWER',
  USER: 'USER'
} as const;

// Role hierarchy (higher values have more permissions)
export const RoleHierarchy = {
  [SystemRoles.USER]: 1,
  [SystemRoles.NETWORK_VIEWER]: 2,
  [SystemRoles.NETWORK_ADMIN]: 3,
  [SystemRoles.ADMIN]: 4,
  [SystemRoles.SUPER_ADMIN]: 5
} as const;

/**
 * Check if role1 has higher or equal permissions than role2
 */
export function roleHasPermissionLevel(role1: string, role2: string): boolean {
  const level1 = RoleHierarchy[role1 as keyof typeof RoleHierarchy] || 0;
  const level2 = RoleHierarchy[role2 as keyof typeof RoleHierarchy] || 0;
  return level1 >= level2;
}

export default Role;