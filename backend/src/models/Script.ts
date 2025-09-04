import { DataTypes, Model, Optional, Association, HasManyGetAssociationsMixin, BelongsToGetAssociationMixin } from 'sequelize';
import { getDatabase } from '../config/database';

const sequelize = getDatabase();

/**
 * Script attributes interface
 */
export interface ScriptAttributes {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  version: string;
  filePath: string;
  fileHash: string;
  language: string;
  isActive: boolean;
  isTemplate: boolean;
  categoryId?: string;
  authorId: string;
  lastModifiedBy?: string;
  permissions: string[];
  requirements?: string;
  estimatedExecutionTime?: number;
  maxExecutionTime: number;
  resourceLimits?: {
    maxMemory?: number;
    maxCpu?: number;
    maxDisk?: number;
  };
  tags: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * Script creation attributes (optional fields during creation)
 */
export interface ScriptCreationAttributes extends Optional<ScriptAttributes,
  'id' | 'version' | 'isActive' | 'isTemplate' | 'categoryId' | 'lastModifiedBy' |
  'permissions' | 'requirements' | 'estimatedExecutionTime' | 'maxExecutionTime' |
  'resourceLimits' | 'tags' | 'metadata' | 'createdAt' | 'updatedAt' | 'deletedAt'
> {}

/**
 * Script model class
 */
export class Script extends Model<ScriptAttributes, ScriptCreationAttributes>
  implements ScriptAttributes {
  public id!: string;
  public name!: string;
  public displayName!: string;
  public description?: string;
  public version!: string;
  public filePath!: string;
  public fileHash!: string;
  public language!: string;
  public isActive!: boolean;
  public isTemplate!: boolean;
  public categoryId?: string;
  public authorId!: string;
  public lastModifiedBy?: string;
  public permissions!: string[];
  public requirements?: string;
  public estimatedExecutionTime?: number;
  public maxExecutionTime!: number;
  public resourceLimits?: {
    maxMemory?: number;
    maxCpu?: number;
    maxDisk?: number;
  };
  public tags!: string[];
  public metadata?: Record<string, any>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt?: Date;

  // Association mixins
  public getAuthor!: BelongsToGetAssociationMixin<any>;
  public getLastModifier!: BelongsToGetAssociationMixin<any>;
  public getExecutions!: HasManyGetAssociationsMixin<any>;
  public getParameters!: HasManyGetAssociationsMixin<any>;
  public getSchedules!: HasManyGetAssociationsMixin<any>;

  // Associations
  public static associations: {
    author: Association<Script, any>;
    lastModifier: Association<Script, any>;
    executions: Association<Script, any>;
    parameters: Association<Script, any>;
    schedules: Association<Script, any>;
  };

  /**
   * Get the script's full qualified name
   */
  public get fullName(): string {
    return `${this.name}@${this.version}`;
  }

  /**
   * Check if script is executable
   */
  public get isExecutable(): boolean {
    return this.isActive && !this.deletedAt;
  }

  /**
   * Get script size category based on estimated execution time
   */
  public get sizeCategory(): 'small' | 'medium' | 'large' {
    if (!this.estimatedExecutionTime) return 'medium';
    if (this.estimatedExecutionTime <= 60) return 'small'; // <= 1 minute
    if (this.estimatedExecutionTime <= 600) return 'medium'; // <= 10 minutes
    return 'large'; // > 10 minutes
  }

  /**
   * Get default resource limits based on size category
   */
  public get defaultResourceLimits(): { maxMemory: number; maxCpu: number; maxDisk: number } {
    const category = this.sizeCategory;
    switch (category) {
      case 'small':
        return { maxMemory: 128, maxCpu: 0.5, maxDisk: 256 }; // 128MB RAM, 0.5 CPU, 256MB disk
      case 'medium':
        return { maxMemory: 512, maxCpu: 1, maxDisk: 1024 }; // 512MB RAM, 1 CPU, 1GB disk
      case 'large':
        return { maxMemory: 2048, maxCpu: 2, maxDisk: 4096 }; // 2GB RAM, 2 CPUs, 4GB disk
      default:
        return { maxMemory: 512, maxCpu: 1, maxDisk: 1024 };
    }
  }

  /**
   * Get effective resource limits (custom or default)
   */
  public get effectiveResourceLimits(): { maxMemory: number; maxCpu: number; maxDisk: number } {
    const defaults = this.defaultResourceLimits;
    return {
      maxMemory: this.resourceLimits?.maxMemory || defaults.maxMemory,
      maxCpu: this.resourceLimits?.maxCpu || defaults.maxCpu,
      maxDisk: this.resourceLimits?.maxDisk || defaults.maxDisk
    };
  }

  /**
   * Check if user has required permissions
   */
  public hasRequiredPermissions(userPermissions: string[]): boolean {
    if (!this.permissions || this.permissions.length === 0) {
      return true; // No permissions required
    }
    
    return this.permissions.every(permission => 
      userPermissions.includes(permission) || 
      userPermissions.includes('script:manage') ||
      userPermissions.includes('system:manage')
    );
  }

  /**
   * Generate next version number
   */
  public static generateNextVersion(currentVersion: string): string {
    const parts = currentVersion.split('.');
    if (parts.length === 3) {
      // Semantic versioning (major.minor.patch)
      const patch = parseInt(parts[2]) + 1;
      return `${parts[0]}.${parts[1]}.${patch}`;
    } else if (parts.length === 1) {
      // Simple integer versioning
      const version = parseInt(parts[0]) + 1;
      return version.toString();
    } else {
      // Fallback to timestamp-based versioning
      return Date.now().toString();
    }
  }

  /**
   * Create a new version of this script
   */
  public async createVersion(
    updates: Partial<ScriptCreationAttributes>,
    modifiedBy: string
  ): Promise<Script> {
    const nextVersion = Script.generateNextVersion(this.version);
    
    const newVersion = await Script.create({
      ...this.toJSON(),
      ...updates,
      id: undefined, // Generate new ID
      version: nextVersion,
      lastModifiedBy: modifiedBy,
      createdAt: undefined,
      updatedAt: undefined,
      deletedAt: undefined
    });

    return newVersion;
  }

  /**
   * Archive (soft delete) the script
   */
  public async archive(archivedBy: string): Promise<void> {
    this.isActive = false;
    this.lastModifiedBy = archivedBy;
    await this.save();
    await this.destroy(); // Soft delete
  }

  /**
   * Restore archived script
   */
  public async restore(restoredBy: string): Promise<void> {
    this.isActive = true;
    this.lastModifiedBy = restoredBy;
    await this.save();
    await this.restore();
  }

  /**
   * Serialize script for JSON (exclude sensitive data)
   */
  public toJSON(): any {
    const values = super.toJSON();
    // Could exclude sensitive metadata if needed
    return values;
  }
}

// Initialize the Script model
Script.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Script name cannot be empty'
      },
      len: {
        args: [3, 100],
        msg: 'Script name must be between 3 and 100 characters'
      },
      is: {
        args: /^[a-zA-Z0-9_-]+$/,
        msg: 'Script name can only contain letters, numbers, underscores, and hyphens'
      }
    },
    comment: 'Unique script identifier name'
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
    },
    comment: 'Human-readable script name'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Detailed script description and usage instructions'
  },
  version: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '1.0.0',
    validate: {
      notEmpty: {
        msg: 'Version cannot be empty'
      },
      len: {
        args: [1, 20],
        msg: 'Version must be between 1 and 20 characters'
      }
    },
    comment: 'Script version (semantic versioning recommended)'
  },
  filePath: {
    type: DataTypes.STRING(500),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'File path cannot be empty'
      },
      len: {
        args: [1, 500],
        msg: 'File path must be between 1 and 500 characters'
      }
    },
    comment: 'Path to script file (relative to storage root)'
  },
  fileHash: {
    type: DataTypes.STRING(64),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'File hash cannot be empty'
      },
      len: {
        args: [32, 64],
        msg: 'File hash must be between 32 and 64 characters'
      }
    },
    comment: 'SHA-256 hash of script file for integrity verification'
  },
  language: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'python',
    validate: {
      isIn: {
        args: [['python', 'bash', 'shell', 'javascript', 'node', 'powershell']],
        msg: 'Language must be one of: python, bash, shell, javascript, node, powershell'
      }
    },
    comment: 'Script programming language'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether script is active and executable'
  },
  isTemplate: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether script is a template for creating new scripts'
  },
  categoryId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Optional category for script organization'
  },
  authorId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'User who created the script'
  },
  lastModifiedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'User who last modified the script'
  },
  permissions: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    validate: {
      isArray(value: any) {
        if (!Array.isArray(value)) {
          throw new Error('Permissions must be an array');
        }
      }
    },
    comment: 'Required permissions to execute this script'
  },
  requirements: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Script dependencies and requirements (pip install, etc.)'
  },
  estimatedExecutionTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: {
        args: [1],
        msg: 'Estimated execution time must be at least 1 second'
      },
      max: {
        args: [86400],
        msg: 'Estimated execution time cannot exceed 24 hours'
      }
    },
    comment: 'Estimated execution time in seconds'
  },
  maxExecutionTime: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1800, // 30 minutes default
    validate: {
      min: {
        args: [1],
        msg: 'Max execution time must be at least 1 second'
      },
      max: {
        args: [86400],
        msg: 'Max execution time cannot exceed 24 hours'
      }
    },
    comment: 'Maximum allowed execution time in seconds (timeout)'
  },
  resourceLimits: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Resource limits for script execution (memory, CPU, disk)'
  },
  tags: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: [],
    validate: {
      isArray(value: any) {
        if (!Array.isArray(value)) {
          throw new Error('Tags must be an array');
        }
        if (value.some((tag: any) => typeof tag !== 'string')) {
          throw new Error('All tags must be strings');
        }
      }
    },
    comment: 'Tags for script categorization and search'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional metadata for script customization'
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
  tableName: 'scripts',
  modelName: 'Script',
  timestamps: true,
  paranoid: true, // Enables soft deletes
  indexes: [
    {
      fields: ['name'],
      name: 'idx_scripts_name'
    },
    {
      fields: ['name', 'version'],
      unique: true,
      name: 'idx_scripts_name_version_unique'
    },
    {
      fields: ['authorId'],
      name: 'idx_scripts_author_id'
    },
    {
      fields: ['lastModifiedBy'],
      name: 'idx_scripts_last_modified_by'
    },
    {
      fields: ['language'],
      name: 'idx_scripts_language'
    },
    {
      fields: ['isActive'],
      name: 'idx_scripts_is_active'
    },
    {
      fields: ['isTemplate'],
      name: 'idx_scripts_is_template'
    },
    {
      fields: ['categoryId'],
      name: 'idx_scripts_category_id'
    },
    {
      fields: ['fileHash'],
      name: 'idx_scripts_file_hash'
    },
    {
      fields: ['tags'],
      type: 'GIN', // For JSON array search in PostgreSQL
      name: 'idx_scripts_tags'
    },
    {
      fields: ['createdAt'],
      name: 'idx_scripts_created_at'
    },
    {
      fields: ['updatedAt'],
      name: 'idx_scripts_updated_at'
    },
    {
      fields: ['deletedAt'],
      name: 'idx_scripts_deleted_at'
    }
  ],
  hooks: {
    beforeValidate: (script: Script) => {
      // Ensure tags are lowercase and trimmed
      if (script.tags && Array.isArray(script.tags)) {
        script.tags = script.tags.map((tag: string) => tag.toLowerCase().trim());
      }
    },
    beforeCreate: (script: Script) => {
      // Set default permissions if not provided
      if (!script.permissions || script.permissions.length === 0) {
        script.permissions = ['script:execute'];
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
    template: {
      where: {
        isTemplate: true
      }
    },
    byLanguage: (language: string) => ({
      where: {
        language: language
      }
    }),
    byAuthor: (authorId: string) => ({
      where: {
        authorId: authorId
      }
    }),
    withoutDeleted: {
      where: {
        deletedAt: null
      }
    }
  }
});

export default Script;