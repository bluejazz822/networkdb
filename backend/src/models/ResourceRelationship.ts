import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../config/database';

export type ResourceType =
  | 'vpc'
  | 'subnet'
  | 'transit_gateway'
  | 'transit_gateway_attachment'
  | 'customer_gateway'
  | 'vpc_endpoint'
  | 'route_table'
  | 'security_group'
  | 'network_acl'
  | 'nat_gateway'
  | 'internet_gateway'
  | 'vpn_connection'
  | 'direct_connect'
  | 'load_balancer'
  | 'peering_connection';

export type CloudProvider = 'aws' | 'azure' | 'gcp' | 'ali' | 'oci' | 'huawei' | 'others';

export type RelationshipType =
  | 'depends_on'
  | 'contains'
  | 'routes_to'
  | 'connects_to'
  | 'attached_to'
  | 'peers_with'
  | 'shares_with'
  | 'secured_by'
  | 'load_balances'
  | 'proxies_to'
  | 'gateways_to';

export type DiscoveryMethod =
  | 'api_discovery'
  | 'configuration_analysis'
  | 'traffic_analysis'
  | 'manual_mapping'
  | 'inference';

export type RelationshipStatus = 'active' | 'inactive' | 'deprecated' | 'pending_verification';

export interface ResourceRelationshipAttributes {
  id: number;
  relationship_id: string;
  source_resource_type: ResourceType;
  source_resource_id: string;
  source_provider: CloudProvider;
  target_resource_type: ResourceType;
  target_resource_id: string;
  target_provider: CloudProvider;
  relationship_type: RelationshipType;
  relationship_direction: 'unidirectional' | 'bidirectional';
  confidence_score: number;
  discovery_method: DiscoveryMethod;
  relationship_metadata?: any;
  strength: number;
  is_critical: boolean;
  first_discovered: Date;
  last_verified: Date;
  status: RelationshipStatus;
  created_at: Date;
  updated_at: Date;
}

export interface ResourceRelationshipCreationAttributes
  extends Optional<ResourceRelationshipAttributes, 'id' | 'relationship_direction' | 'confidence_score' | 'strength' | 'is_critical' | 'first_discovered' | 'last_verified' | 'status' | 'created_at' | 'updated_at'> {}

export class ResourceRelationship extends Model<ResourceRelationshipAttributes, ResourceRelationshipCreationAttributes> implements ResourceRelationshipAttributes {
  public id!: number;
  public relationship_id!: string;
  public source_resource_type!: ResourceType;
  public source_resource_id!: string;
  public source_provider!: CloudProvider;
  public target_resource_type!: ResourceType;
  public target_resource_id!: string;
  public target_provider!: CloudProvider;
  public relationship_type!: RelationshipType;
  public relationship_direction!: 'unidirectional' | 'bidirectional';
  public confidence_score!: number;
  public discovery_method!: DiscoveryMethod;
  public relationship_metadata?: any;
  public strength!: number;
  public is_critical!: boolean;
  public first_discovered!: Date;
  public last_verified!: Date;
  public status!: RelationshipStatus;
  public created_at!: Date;
  public updated_at!: Date;

  // Associations
  public readonly relationship_changes?: RelationshipChange[];

  // Instance methods
  public async verify(): Promise<void> {
    this.last_verified = new Date();
    await this.save();
  }

  public async markAsCritical(): Promise<void> {
    this.is_critical = true;
    await this.save();
  }

  public async updateConfidence(score: number): Promise<void> {
    this.confidence_score = Math.max(0, Math.min(1, score));
    await this.save();
  }

  public async updateStrength(strength: number): Promise<void> {
    this.strength = Math.max(1, Math.min(10, strength));
    await this.save();
  }

  public isExpired(maxAge: number = 24 * 60 * 60 * 1000): boolean {
    const now = new Date();
    return (now.getTime() - this.last_verified.getTime()) > maxAge;
  }

  public isCrossCloud(): boolean {
    return this.source_provider !== this.target_provider;
  }

  public getSourceIdentifier(): string {
    return `${this.source_provider}:${this.source_resource_type}:${this.source_resource_id}`;
  }

  public getTargetIdentifier(): string {
    return `${this.target_provider}:${this.target_resource_type}:${this.target_resource_id}`;
  }

  public getReverseRelationshipType(): RelationshipType | null {
    const reverseMap: Partial<Record<RelationshipType, RelationshipType>> = {
      'depends_on': 'contains',
      'contains': 'depends_on',
      'routes_to': 'routes_to',
      'connects_to': 'connects_to',
      'attached_to': 'contains',
      'peers_with': 'peers_with',
      'shares_with': 'shares_with',
      'secured_by': 'contains',
      'load_balances': 'depends_on',
      'proxies_to': 'depends_on',
      'gateways_to': 'depends_on'
    };

    return reverseMap[this.relationship_type] || null;
  }

  public static async findRelationshipsBetween(
    sourceType: ResourceType,
    sourceId: string,
    targetType: ResourceType,
    targetId: string
  ): Promise<ResourceRelationship[]> {
    return await ResourceRelationship.findAll({
      where: {
        source_resource_type: sourceType,
        source_resource_id: sourceId,
        target_resource_type: targetType,
        target_resource_id: targetId,
        status: 'active'
      }
    });
  }

  public static async findResourceDependencies(
    resourceType: ResourceType,
    resourceId: string,
    direction: 'incoming' | 'outgoing' | 'both' = 'both'
  ): Promise<ResourceRelationship[]> {
    const conditions: any[] = [];

    if (direction === 'incoming' || direction === 'both') {
      conditions.push({
        target_resource_type: resourceType,
        target_resource_id: resourceId,
        status: 'active'
      });
    }

    if (direction === 'outgoing' || direction === 'both') {
      conditions.push({
        source_resource_type: resourceType,
        source_resource_id: resourceId,
        status: 'active'
      });
    }

    return await ResourceRelationship.findAll({
      where: {
        [require('sequelize').Op.or]: conditions
      },
      order: [['strength', 'DESC'], ['confidence_score', 'DESC']]
    });
  }

  public static async findCriticalRelationships(
    resourceType?: ResourceType,
    provider?: CloudProvider
  ): Promise<ResourceRelationship[]> {
    const whereClause: any = {
      is_critical: true,
      status: 'active'
    };

    if (resourceType) {
      whereClause[require('sequelize').Op.or] = [
        { source_resource_type: resourceType },
        { target_resource_type: resourceType }
      ];
    }

    if (provider) {
      whereClause[require('sequelize').Op.and] = whereClause[require('sequelize').Op.and] || [];
      whereClause[require('sequelize').Op.and].push({
        [require('sequelize').Op.or]: [
          { source_provider: provider },
          { target_provider: provider }
        ]
      });
    }

    return await ResourceRelationship.findAll({
      where: whereClause,
      order: [['strength', 'DESC'], ['confidence_score', 'DESC']]
    });
  }

  public static async findCrossCloudRelationships(): Promise<ResourceRelationship[]> {
    return await ResourceRelationship.findAll({
      where: {
        [require('sequelize').Op.ne]: [
          require('sequelize').col('source_provider'),
          require('sequelize').col('target_provider')
        ],
        status: 'active'
      },
      order: [['strength', 'DESC']]
    });
  }
}

ResourceRelationship.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  relationship_id: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false
  },
  source_resource_type: {
    type: DataTypes.ENUM(
      'vpc',
      'subnet',
      'transit_gateway',
      'transit_gateway_attachment',
      'customer_gateway',
      'vpc_endpoint',
      'route_table',
      'security_group',
      'network_acl',
      'nat_gateway',
      'internet_gateway',
      'vpn_connection',
      'direct_connect',
      'load_balancer',
      'peering_connection'
    ),
    allowNull: false
  },
  source_resource_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  source_provider: {
    type: DataTypes.ENUM('aws', 'azure', 'gcp', 'ali', 'oci', 'huawei', 'others'),
    allowNull: false
  },
  target_resource_type: {
    type: DataTypes.ENUM(
      'vpc',
      'subnet',
      'transit_gateway',
      'transit_gateway_attachment',
      'customer_gateway',
      'vpc_endpoint',
      'route_table',
      'security_group',
      'network_acl',
      'nat_gateway',
      'internet_gateway',
      'vpn_connection',
      'direct_connect',
      'load_balancer',
      'peering_connection'
    ),
    allowNull: false
  },
  target_resource_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  target_provider: {
    type: DataTypes.ENUM('aws', 'azure', 'gcp', 'ali', 'oci', 'huawei', 'others'),
    allowNull: false
  },
  relationship_type: {
    type: DataTypes.ENUM(
      'depends_on',
      'contains',
      'routes_to',
      'connects_to',
      'attached_to',
      'peers_with',
      'shares_with',
      'secured_by',
      'load_balances',
      'proxies_to',
      'gateways_to'
    ),
    allowNull: false
  },
  relationship_direction: {
    type: DataTypes.ENUM('unidirectional', 'bidirectional'),
    allowNull: false,
    defaultValue: 'unidirectional'
  },
  confidence_score: {
    type: DataTypes.DECIMAL(3, 2),
    allowNull: false,
    defaultValue: 1.00,
    validate: {
      min: 0.00,
      max: 1.00
    }
  },
  discovery_method: {
    type: DataTypes.ENUM(
      'api_discovery',
      'configuration_analysis',
      'traffic_analysis',
      'manual_mapping',
      'inference'
    ),
    allowNull: false
  },
  relationship_metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  strength: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: 1,
      max: 10
    }
  },
  is_critical: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  first_discovered: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  last_verified: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive', 'deprecated', 'pending_verification'),
    allowNull: false,
    defaultValue: 'active'
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
  modelName: 'ResourceRelationship',
  tableName: 'resource_relationships',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['relationship_id'], unique: true },
    { fields: ['source_resource_type', 'source_resource_id'] },
    { fields: ['target_resource_type', 'target_resource_id'] },
    { fields: ['relationship_type'] },
    { fields: ['source_provider', 'target_provider'] },
    { fields: ['status'] },
    { fields: ['is_critical'] },
    { fields: ['last_verified'] },
    { fields: ['source_resource_type', 'source_resource_id', 'relationship_type'] },
    { fields: ['target_resource_type', 'target_resource_id', 'relationship_type'] }
  ]
});

// Import RelationshipChange here to avoid circular dependencies
import { RelationshipChange } from './RelationshipChange';

// Define associations
ResourceRelationship.hasMany(RelationshipChange, {
  foreignKey: 'relationship_id',
  sourceKey: 'relationship_id',
  as: 'relationship_changes',
  onDelete: 'CASCADE'
});

export default ResourceRelationship;