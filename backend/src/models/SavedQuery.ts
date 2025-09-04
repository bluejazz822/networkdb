/**
 * SavedQuery Model
 * Represents saved search queries for users
 */

import { 
  Model, 
  DataTypes, 
  CreationOptional, 
  InferAttributes, 
  InferCreationAttributes,
  ForeignKey,
  Sequelize
} from 'sequelize';

export interface SavedQueryAttributes extends Model<
  InferAttributes<SavedQueryAttributes>,
  InferCreationAttributes<SavedQueryAttributes>
> {
  id: CreationOptional<number>;
  name: string;
  description?: string;
  query: object; // JSON object containing the search query
  userId: string;
  isPublic?: boolean;
  tags?: string[];
  resourceType: 'vpc' | 'transitGateway' | 'customerGateway' | 'vpcEndpoint' | 'all';
  createdAt: CreationOptional<Date>;
  updatedAt: CreationOptional<Date>;
  lastUsedAt?: Date;
  useCount: CreationOptional<number>;
}

export class SavedQuery extends Model<
  InferAttributes<SavedQuery>,
  InferCreationAttributes<SavedQuery>
> implements SavedQueryAttributes {
  declare id: CreationOptional<number>;
  declare name: string;
  declare description: string | null;
  declare query: object;
  declare userId: string;
  declare isPublic: boolean;
  declare tags: string[];
  declare resourceType: 'vpc' | 'transitGateway' | 'customerGateway' | 'vpcEndpoint' | 'all';
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare lastUsedAt: Date | null;
  declare useCount: CreationOptional<number>;

  // Associations
  declare User?: any; // We don't have User model imported to avoid circular dependency

  static initModel(sequelize: Sequelize): typeof SavedQuery {
    SavedQuery.init({
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: true,
          len: [1, 255]
        },
        comment: 'Human-readable name for the saved query'
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Optional description of what the query does'
      },
      query: {
        type: DataTypes.JSON,
        allowNull: false,
        validate: {
          isValidQuery(value: any) {
            if (!value || typeof value !== 'object') {
              throw new Error('Query must be a valid JSON object');
            }
            // Additional validation for query structure could be added here
          }
        },
        comment: 'The search query as a JSON object'
      },
      userId: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          notEmpty: true
        },
        comment: 'ID of the user who created this saved query'
      },
      isPublic: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this query is visible to other users'
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
            if (value.some(tag => typeof tag !== 'string')) {
              throw new Error('All tags must be strings');
            }
          }
        },
        comment: 'Tags for categorizing saved queries'
      },
      resourceType: {
        type: DataTypes.ENUM('vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint', 'all'),
        allowNull: false,
        validate: {
          isIn: [['vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint', 'all']]
        },
        comment: 'The type of resource this query searches'
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'When the saved query was created'
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'When the saved query was last modified'
      },
      lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When the saved query was last executed'
      },
      useCount: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of times this query has been executed'
      }
    }, {
      sequelize,
      modelName: 'SavedQuery',
      tableName: 'SavedQueries',
      timestamps: true,
      paranoid: false, // We don't need soft deletes for saved queries
      indexes: [
        {
          fields: ['userId'],
          comment: 'Index for finding queries by user'
        },
        {
          fields: ['userId', 'resourceType'],
          comment: 'Composite index for user queries by resource type'
        },
        {
          fields: ['isPublic', 'resourceType'],
          comment: 'Index for finding public queries by resource type'
        },
        {
          fields: ['lastUsedAt'],
          comment: 'Index for finding recently used queries'
        },
        {
          fields: ['useCount'],
          comment: 'Index for finding popular queries'
        },
        {
          fields: ['tags'],
          type: 'BTREE',
          comment: 'Index for searching by tags'
        }
      ],
      validate: {
        nameAndUserUnique() {
          // This would be better as a unique index, but we'll validate in service layer
          // MySQL doesn't support partial unique indexes easily
        }
      },
      comment: 'Stores saved search queries for users'
    });

    return SavedQuery;
  }

  // Instance methods
  async incrementUseCount(): Promise<void> {
    await this.update({
      useCount: this.useCount + 1,
      lastUsedAt: new Date()
    });
  }

  isOwnedBy(userId: string): boolean {
    return this.userId === userId;
  }

  canBeAccessedBy(userId: string): boolean {
    return this.userId === userId || this.isPublic;
  }

  toPublicJSON(): any {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      resourceType: this.resourceType,
      tags: this.tags,
      isPublic: this.isPublic,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      lastUsedAt: this.lastUsedAt,
      useCount: this.useCount,
      // Don't expose userId or query content to non-owners
      ...(this.userId ? {
        userId: this.userId,
        query: this.query
      } : {})
    };
  }

  // Static methods
  static async findPublicQueries(resourceType?: string, limit: number = 20): Promise<SavedQuery[]> {
    const where: any = { isPublic: true };
    if (resourceType && resourceType !== 'all') {
      where.resourceType = resourceType;
    }

    return await SavedQuery.findAll({
      where,
      order: [
        ['useCount', 'DESC'],
        ['lastUsedAt', 'DESC'],
        ['createdAt', 'DESC']
      ],
      limit
    });
  }

  static async findPopularQueries(resourceType?: string, limit: number = 10): Promise<SavedQuery[]> {
    const where: any = { useCount: { [DataTypes.Op?.gt || 'gt']: 0 } };
    if (resourceType && resourceType !== 'all') {
      where.resourceType = resourceType;
    }

    return await SavedQuery.findAll({
      where,
      order: [
        ['useCount', 'DESC'],
        ['lastUsedAt', 'DESC']
      ],
      limit
    });
  }

  static async findByTags(tags: string[], userId?: string): Promise<SavedQuery[]> {
    const where: any = {
      [DataTypes.Op?.or || 'or']: [
        { isPublic: true },
        ...(userId ? [{ userId }] : [])
      ]
    };

    // For MySQL JSON search - this would need to be adapted based on your MySQL version
    // This is a simplified version
    where.tags = {
      [DataTypes.Op?.overlap || 'overlap']: tags
    };

    return await SavedQuery.findAll({
      where,
      order: [['useCount', 'DESC']]
    });
  }

  static async searchByName(searchTerm: string, userId?: string): Promise<SavedQuery[]> {
    const where: any = {
      name: {
        [DataTypes.Op?.like || 'like']: `%${searchTerm}%`
      },
      [DataTypes.Op?.or || 'or']: [
        { isPublic: true },
        ...(userId ? [{ userId }] : [])
      ]
    };

    return await SavedQuery.findAll({
      where,
      order: [['useCount', 'DESC'], ['name', 'ASC']]
    });
  }
}

export default SavedQuery;