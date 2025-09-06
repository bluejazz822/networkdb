/**
 * TransitGateway Sequelize Model
 * Represents AWS Transit Gateway resources in the database
 */

import { 
  Model, 
  DataTypes, 
  CreationOptional, 
  InferAttributes, 
  InferCreationAttributes,
  Association
} from 'sequelize';
import { getDatabase } from '../config/database';
import { INetworkResourceModel } from '../repositories/NetworkResourceRepository';

const sequelize = getDatabase();

/**
 * TransitGateway model class
 */
class TransitGateway extends Model<InferAttributes<TransitGateway>, InferCreationAttributes<TransitGateway>> 
  implements INetworkResourceModel {
  
  // Primary key
  declare id: CreationOptional<string>;
  
  // AWS Identifiers
  declare awsTransitGatewayId: string;
  declare awsAccountId: string;
  
  // Basic Information
  declare description: CreationOptional<string>;
  
  // State and Status
  declare state: string;
  declare statusId: string;
  
  // Location
  declare region: string;
  declare regionId: string;
  
  // Configuration
  declare amazonSideAsn: number;
  declare autoAcceptSharedAttachments: CreationOptional<'enable' | 'disable'>;
  declare defaultRouteTableAssociation: CreationOptional<'enable' | 'disable'>;
  declare defaultRouteTablePropagation: CreationOptional<'enable' | 'disable'>;
  declare dnsSupport: CreationOptional<'enable' | 'disable'>;
  declare multicast: CreationOptional<'enable' | 'disable'>;
  
  // Route Tables
  declare associationDefaultRouteTableId: CreationOptional<string>;
  declare propagationDefaultRouteTableId: CreationOptional<string>;
  
  // Transit Gateway CIDR Blocks
  declare transitGatewayCidrBlocks: CreationOptional<string[]>;
  
  // Metadata
  declare tags: CreationOptional<Record<string, any>>;
  declare name: CreationOptional<string>;
  
  // Sync Information
  declare sourceSystem: CreationOptional<string>;
  declare lastSyncAt: CreationOptional<Date>;
  declare syncVersion: CreationOptional<number>;
  
  // Business Information
  declare environment: CreationOptional<string>;
  declare project: CreationOptional<string>;
  declare costCenter: CreationOptional<string>;
  declare owner: CreationOptional<string>;
  
  // Network Architecture
  declare transitGatewayType: CreationOptional<'hub' | 'spoke' | 'inspection'>;
  declare isPrimary: CreationOptional<boolean>;
  
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date>;
  
  // Associations (will be defined later)
  // declare attachments?: NonAttribute<TransitGatewayAttachment[]>;
  // declare routeTables?: NonAttribute<TransitGatewayRouteTable[]>;
}

/**
 * Initialize the TransitGateway model
 */
TransitGateway.init({
  // Primary key
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // AWS Identifiers
  awsTransitGatewayId: {
    type: DataTypes.STRING(21),
    allowNull: false,
    unique: true,
    validate: {
      is: /^tgw-[0-9a-f]{17}$/i
    }
  },
  
  awsAccountId: {
    type: DataTypes.STRING(12),
    allowNull: false,
    validate: {
      isNumeric: true,
      len: [12, 12]
    }
  },
  
  // Basic Information
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  // State and Status
  state: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'available', 'modifying', 'deleting', 'deleted', 'failed']]
    }
  },
  
  statusId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'enum_resource_status',
      key: 'id'
    }
  },
  
  // Location
  region: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  
  regionId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'enum_aws_regions',
      key: 'id'
    }
  },
  
  // Configuration
  amazonSideAsn: {
    type: DataTypes.BIGINT,
    allowNull: false,
    validate: {
      min: 1,
      max: 4294967294
    }
  },
  
  autoAcceptSharedAttachments: {
    type: DataTypes.ENUM('enable', 'disable'),
    allowNull: false,
    defaultValue: 'disable'
  },
  
  defaultRouteTableAssociation: {
    type: DataTypes.ENUM('enable', 'disable'),
    allowNull: false,
    defaultValue: 'enable'
  },
  
  defaultRouteTablePropagation: {
    type: DataTypes.ENUM('enable', 'disable'),
    allowNull: false,
    defaultValue: 'enable'
  },
  
  dnsSupport: {
    type: DataTypes.ENUM('enable', 'disable'),
    allowNull: false,
    defaultValue: 'enable'
  },
  
  multicast: {
    type: DataTypes.ENUM('enable', 'disable'),
    allowNull: false,
    defaultValue: 'disable'
  },
  
  // Route Tables
  associationDefaultRouteTableId: {
    type: DataTypes.STRING(21),
    allowNull: true,
    validate: {
      is: /^tgw-rtb-[0-9a-f]{17}$/i
    }
  },
  
  propagationDefaultRouteTableId: {
    type: DataTypes.STRING(21),
    allowNull: true,
    validate: {
      is: /^tgw-rtb-[0-9a-f]{17}$/i
    }
  },
  
  // Transit Gateway CIDR Blocks
  transitGatewayCidrBlocks: {
    type: DataTypes.JSON,
    allowNull: true
  },
  
  // Metadata
  tags: {
    type: DataTypes.JSON,
    allowNull: true
  },
  
  name: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  
  // Sync Information
  sourceSystem: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'aws'
  },
  
  lastSyncAt: {
    type: DataTypes.DATE,
    allowNull: true
  },
  
  syncVersion: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  
  // Business Information
  environment: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  
  project: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  
  costCenter: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  
  owner: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  
  // Network Architecture
  transitGatewayType: {
    type: DataTypes.ENUM('hub', 'spoke', 'inspection'),
    allowNull: true
  },
  
  isPrimary: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  
  // Timestamps
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
  modelName: 'TransitGateway',
  tableName: 'transit_gateways',
  paranoid: true, // Soft deletes
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['awsTransitGatewayId']
    },
    {
      fields: ['awsAccountId']
    },
    {
      fields: ['region']
    },
    {
      fields: ['awsAccountId', 'region']
    },
    {
      fields: ['state']
    },
    {
      fields: ['environment']
    },
    {
      fields: ['transitGatewayType']
    },
    {
      fields: ['isPrimary']
    },
    {
      fields: ['amazonSideAsn']
    },
    {
      fields: ['lastSyncAt']
    }
  ],
  hooks: {
    beforeCreate: (tgw, options) => {
      // Extract name from tags if not provided
      if (!tgw.name && tgw.tags && tgw.tags.Name) {
        tgw.name = tgw.tags.Name;
      }
    },
    beforeUpdate: (tgw, options) => {
      // Extract name from tags if not provided
      if (!tgw.name && tgw.tags && tgw.tags.Name) {
        tgw.name = tgw.tags.Name;
      }
    }
  }
});

export default TransitGateway;