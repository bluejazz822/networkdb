import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type ChangeType = 'created' | 'updated' | 'deleted' | 'verified' | 'invalidated';

export interface RelationshipChangeAttributes {
  id: number;
  change_id: string;
  relationship_id: string;
  change_type: ChangeType;
  change_reason?: string;
  previous_state?: any;
  new_state?: any;
  changed_by?: string;
  change_metadata?: any;
  created_at: Date;
}

export interface RelationshipChangeCreationAttributes
  extends Optional<RelationshipChangeAttributes, 'id' | 'created_at'> {}

export class RelationshipChange extends Model<RelationshipChangeAttributes, RelationshipChangeCreationAttributes> implements RelationshipChangeAttributes {
  public id!: number;
  public change_id!: string;
  public relationship_id!: string;
  public change_type!: ChangeType;
  public change_reason?: string;
  public previous_state?: any;
  public new_state?: any;
  public changed_by?: string;
  public change_metadata?: any;
  public created_at!: Date;

  // Instance methods
  public hasSignificantChange(): boolean {
    if (!this.previous_state || !this.new_state) {
      return true; // Creation or deletion is always significant
    }

    const significantFields = [
      'relationship_type',
      'status',
      'is_critical',
      'strength',
      'confidence_score'
    ];

    return significantFields.some(field =>
      this.previous_state[field] !== this.new_state[field]
    );
  }

  public getChangeSummary(): string {
    switch (this.change_type) {
      case 'created':
        return `Relationship created: ${this.new_state?.relationship_type || 'unknown'}`;
      case 'deleted':
        return `Relationship deleted: ${this.previous_state?.relationship_type || 'unknown'}`;
      case 'updated':
        return this.getUpdateSummary();
      case 'verified':
        return 'Relationship verified';
      case 'invalidated':
        return 'Relationship invalidated';
      default:
        return 'Unknown change';
    }
  }

  private getUpdateSummary(): string {
    if (!this.previous_state || !this.new_state) {
      return 'Relationship updated';
    }

    const changes: string[] = [];

    if (this.previous_state.relationship_type !== this.new_state.relationship_type) {
      changes.push(`type: ${this.previous_state.relationship_type} → ${this.new_state.relationship_type}`);
    }

    if (this.previous_state.status !== this.new_state.status) {
      changes.push(`status: ${this.previous_state.status} → ${this.new_state.status}`);
    }

    if (this.previous_state.is_critical !== this.new_state.is_critical) {
      changes.push(`critical: ${this.previous_state.is_critical} → ${this.new_state.is_critical}`);
    }

    if (this.previous_state.strength !== this.new_state.strength) {
      changes.push(`strength: ${this.previous_state.strength} → ${this.new_state.strength}`);
    }

    if (this.previous_state.confidence_score !== this.new_state.confidence_score) {
      changes.push(`confidence: ${this.previous_state.confidence_score} → ${this.new_state.confidence_score}`);
    }

    return changes.length > 0 ? `Updated: ${changes.join(', ')}` : 'Minor update';
  }

  public static async getChangeHistory(
    relationshipId: string,
    limit: number = 50
  ): Promise<RelationshipChange[]> {
    return await RelationshipChange.findAll({
      where: { relationship_id: relationshipId },
      order: [['created_at', 'DESC']],
      limit
    });
  }

  public static async getRecentChanges(
    hours: number = 24,
    changeTypes?: ChangeType[]
  ): Promise<RelationshipChange[]> {
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);
    const whereClause: any = {
      created_at: { [require('sequelize').Op.gte]: since }
    };

    if (changeTypes && changeTypes.length > 0) {
      whereClause.change_type = { [require('sequelize').Op.in]: changeTypes };
    }

    return await RelationshipChange.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: 1000
    });
  }

  public static async getChangesByUser(
    changedBy: string,
    limit: number = 100
  ): Promise<RelationshipChange[]> {
    return await RelationshipChange.findAll({
      where: { changed_by: changedBy },
      order: [['created_at', 'DESC']],
      limit
    });
  }
}

RelationshipChange.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  change_id: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false
  },
  relationship_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  change_type: {
    type: DataTypes.ENUM('created', 'updated', 'deleted', 'verified', 'invalidated'),
    allowNull: false
  },
  change_reason: {
    type: DataTypes.STRING(500),
    allowNull: true
  },
  previous_state: {
    type: DataTypes.JSON,
    allowNull: true
  },
  new_state: {
    type: DataTypes.JSON,
    allowNull: true
  },
  changed_by: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  change_metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'RelationshipChange',
  tableName: 'relationship_changes',
  timestamps: false, // Only using created_at
  indexes: [
    { fields: ['change_id'], unique: true },
    { fields: ['relationship_id'] },
    { fields: ['change_type'] },
    { fields: ['created_at'] },
    { fields: ['changed_by'] }
  ]
});

export default RelationshipChange;