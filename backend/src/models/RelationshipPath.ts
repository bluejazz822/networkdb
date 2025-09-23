import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type PathType = 'dependency' | 'impact' | 'connectivity' | 'data_flow';

export interface RelationshipPathAttributes {
  id: number;
  path_id: string;
  source_resource_id: string;
  target_resource_id: string;
  path_type: PathType;
  path_depth: number;
  path_relationships: string[];
  path_confidence: number;
  path_strength: number;
  is_critical_path: boolean;
  computed_at: Date;
  expires_at?: Date;
  computation_metadata?: any;
  created_at: Date;
  updated_at: Date;
}

export interface RelationshipPathCreationAttributes
  extends Optional<RelationshipPathAttributes, 'id' | 'is_critical_path' | 'computed_at' | 'created_at' | 'updated_at'> {}

export class RelationshipPath extends Model<RelationshipPathAttributes, RelationshipPathCreationAttributes> implements RelationshipPathAttributes {
  public id!: number;
  public path_id!: string;
  public source_resource_id!: string;
  public target_resource_id!: string;
  public path_type!: PathType;
  public path_depth!: number;
  public path_relationships!: string[];
  public path_confidence!: number;
  public path_strength!: number;
  public is_critical_path!: boolean;
  public computed_at!: Date;
  public expires_at?: Date;
  public computation_metadata?: any;
  public created_at!: Date;
  public updated_at!: Date;

  // Instance methods
  public isExpired(): boolean {
    if (!this.expires_at) {
      return false; // Paths without expiration don't expire
    }
    return new Date() > this.expires_at;
  }

  public getRelationshipCount(): number {
    return this.path_relationships.length;
  }

  public async refreshExpiration(ttlHours: number = 24): Promise<void> {
    this.expires_at = new Date(Date.now() + ttlHours * 60 * 60 * 1000);
    await this.save();
  }

  public getComputationAge(): number {
    return Date.now() - this.computed_at.getTime();
  }

  public isStale(maxAgeHours: number = 6): boolean {
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    return this.getComputationAge() > maxAgeMs;
  }

  public async markAsCritical(): Promise<void> {
    this.is_critical_path = true;
    await this.save();
  }

  public getPathSummary(): string {
    return `${this.path_type} path from ${this.source_resource_id} to ${this.target_resource_id} (${this.path_depth} hops, strength: ${this.path_strength})`;
  }

  // Static methods for path queries
  public static async findPathsBetween(
    sourceId: string,
    targetId: string,
    pathType?: PathType
  ): Promise<RelationshipPath[]> {
    const whereClause: any = {
      source_resource_id: sourceId,
      target_resource_id: targetId
    };

    if (pathType) {
      whereClause.path_type = pathType;
    }

    // Filter out expired paths
    whereClause[require('sequelize').Op.or] = [
      { expires_at: null },
      { expires_at: { [require('sequelize').Op.gt]: new Date() } }
    ];

    return await RelationshipPath.findAll({
      where: whereClause,
      order: [['path_strength', 'DESC'], ['path_confidence', 'DESC'], ['path_depth', 'ASC']]
    });
  }

  public static async findPathsFrom(
    sourceId: string,
    pathType?: PathType,
    maxDepth?: number
  ): Promise<RelationshipPath[]> {
    const whereClause: any = {
      source_resource_id: sourceId,
      [require('sequelize').Op.or]: [
        { expires_at: null },
        { expires_at: { [require('sequelize').Op.gt]: new Date() } }
      ]
    };

    if (pathType) {
      whereClause.path_type = pathType;
    }

    if (maxDepth) {
      whereClause.path_depth = { [require('sequelize').Op.lte]: maxDepth };
    }

    return await RelationshipPath.findAll({
      where: whereClause,
      order: [['path_strength', 'DESC'], ['path_depth', 'ASC']],
      limit: 100 // Prevent overwhelming results
    });
  }

  public static async findPathsTo(
    targetId: string,
    pathType?: PathType,
    maxDepth?: number
  ): Promise<RelationshipPath[]> {
    const whereClause: any = {
      target_resource_id: targetId,
      [require('sequelize').Op.or]: [
        { expires_at: null },
        { expires_at: { [require('sequelize').Op.gt]: new Date() } }
      ]
    };

    if (pathType) {
      whereClause.path_type = pathType;
    }

    if (maxDepth) {
      whereClause.path_depth = { [require('sequelize').Op.lte]: maxDepth };
    }

    return await RelationshipPath.findAll({
      where: whereClause,
      order: [['path_strength', 'DESC'], ['path_depth', 'ASC']],
      limit: 100 // Prevent overwhelming results
    });
  }

  public static async findCriticalPaths(
    pathType?: PathType
  ): Promise<RelationshipPath[]> {
    const whereClause: any = {
      is_critical_path: true,
      [require('sequelize').Op.or]: [
        { expires_at: null },
        { expires_at: { [require('sequelize').Op.gt]: new Date() } }
      ]
    };

    if (pathType) {
      whereClause.path_type = pathType;
    }

    return await RelationshipPath.findAll({
      where: whereClause,
      order: [['path_strength', 'DESC'], ['path_confidence', 'DESC']]
    });
  }

  public static async findExpiredPaths(): Promise<RelationshipPath[]> {
    return await RelationshipPath.findAll({
      where: {
        expires_at: {
          [require('sequelize').Op.and]: [
            { [require('sequelize').Op.ne]: null },
            { [require('sequelize').Op.lt]: new Date() }
          ]
        }
      }
    });
  }

  public static async findStalePaths(maxAgeHours: number = 6): Promise<RelationshipPath[]> {
    const staleTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    return await RelationshipPath.findAll({
      where: {
        computed_at: { [require('sequelize').Op.lt]: staleTime }
      }
    });
  }

  public static async cleanupExpiredPaths(): Promise<number> {
    const expiredPaths = await RelationshipPath.findExpiredPaths();
    const count = expiredPaths.length;

    if (count > 0) {
      await RelationshipPath.destroy({
        where: {
          expires_at: {
            [require('sequelize').Op.and]: [
              { [require('sequelize').Op.ne]: null },
              { [require('sequelize').Op.lt]: new Date() }
            ]
          }
        }
      });
    }

    return count;
  }

  public static async getPathStatistics(): Promise<{
    total: number;
    byType: Record<PathType, number>;
    byDepth: Record<number, number>;
    criticalPaths: number;
    expiredPaths: number;
    averageConfidence: number;
    averageStrength: number;
  }> {
    const allPaths = await RelationshipPath.findAll({
      where: {
        [require('sequelize').Op.or]: [
          { expires_at: null },
          { expires_at: { [require('sequelize').Op.gt]: new Date() } }
        ]
      }
    });

    const stats = {
      total: allPaths.length,
      byType: {} as Record<PathType, number>,
      byDepth: {} as Record<number, number>,
      criticalPaths: 0,
      expiredPaths: 0,
      averageConfidence: 0,
      averageStrength: 0
    };

    if (allPaths.length === 0) {
      return stats;
    }

    let totalConfidence = 0;
    let totalStrength = 0;

    for (const path of allPaths) {
      // Count by type
      stats.byType[path.path_type] = (stats.byType[path.path_type] || 0) + 1;

      // Count by depth
      stats.byDepth[path.path_depth] = (stats.byDepth[path.path_depth] || 0) + 1;

      // Count critical paths
      if (path.is_critical_path) {
        stats.criticalPaths++;
      }

      // Sum for averages
      totalConfidence += path.path_confidence;
      totalStrength += path.path_strength;
    }

    stats.averageConfidence = totalConfidence / allPaths.length;
    stats.averageStrength = totalStrength / allPaths.length;

    // Get expired paths count
    const expiredPaths = await RelationshipPath.findExpiredPaths();
    stats.expiredPaths = expiredPaths.length;

    return stats;
  }
}

RelationshipPath.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  path_id: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false
  },
  source_resource_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  target_resource_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  path_type: {
    type: DataTypes.ENUM('dependency', 'impact', 'connectivity', 'data_flow'),
    allowNull: false
  },
  path_depth: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1
    }
  },
  path_relationships: {
    type: DataTypes.JSON,
    allowNull: false,
    validate: {
      isArray(value: any) {
        if (!Array.isArray(value)) {
          throw new Error('path_relationships must be an array');
        }
      }
    }
  },
  path_confidence: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: false,
    validate: {
      min: 0.00,
      max: 1.00
    }
  },
  path_strength: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
      max: 10
    }
  },
  is_critical_path: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  computed_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  computation_metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'RelationshipPath',
  tableName: 'relationship_paths',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['path_id'], unique: true },
    { fields: ['source_resource_id'] },
    { fields: ['target_resource_id'] },
    { fields: ['path_type'] },
    { fields: ['is_critical_path'] },
    { fields: ['expires_at'] },
    { fields: ['computed_at'] },
    { fields: ['source_resource_id', 'target_resource_id', 'path_type'] }
  ]
});

export default RelationshipPath;