/**
 * Vpc Sequelize Model
 * Represents AWS Virtual Private Cloud (VPC) resources in the database
 */

import { 
  Model, 
  DataTypes, 
  CreationOptional, 
  InferAttributes, 
  InferCreationAttributes,
  Association,
  ForeignKey
} from 'sequelize';
import { getDatabase } from '../config/database';
import { INetworkResourceModel } from '../repositories/NetworkResourceRepository';

const sequelize = getDatabase();

/**
 * Vpc model class
 */
class Vpc extends Model<InferAttributes<Vpc>, InferCreationAttributes<Vpc>> 
  implements INetworkResourceModel {
  
  // Primary key
  declare id: CreationOptional<string>;
  
  // AWS Identifiers
  declare awsVpcId: string;
  declare awsAccountId: string;
  
  // Basic VPC Information
  declare cidrBlock: string;
  declare cidrBlockAssociationSet: CreationOptional<any>;
  declare dhcpOptionsId: CreationOptional<string>;
  
  // State and Status
  declare state: string;
  declare statusId: string;
  
  // Location
  declare region: string;
  declare regionId: string;
  declare availabilityZones: CreationOptional<string[]>;
  
  // Configuration
  declare isDefault: CreationOptional<boolean>;
  declare instanceTenancy: CreationOptional<'default' | 'dedicated' | 'host'>;
  declare enableDnsHostnames: CreationOptional<boolean>;
  declare enableDnsSupport: CreationOptional<boolean>;
  
  // Network Configuration
  declare enableNetworkAddressUsageMetrics: CreationOptional<boolean>;
  
  // Metadata
  declare tags: CreationOptional<Record<string, any>>;
  declare name: CreationOptional<string>;
  declare description: CreationOptional<string>;
  
  // Sync Information
  declare sourceSystem: CreationOptional<string>;
  declare lastSyncAt: CreationOptional<Date>;
  declare syncVersion: CreationOptional<number>;
  
  // Business Information
  declare environment: CreationOptional<string>;
  declare project: CreationOptional<string>;
  declare costCenter: CreationOptional<string>;
  declare owner: CreationOptional<string>;
  
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date>;
  
  // Associations (will be defined later)
  // declare subnets?: NonAttribute<Subnet[]>;
  // declare routeTables?: NonAttribute<RouteTable[]>;
  // declare securityGroups?: NonAttribute<SecurityGroup[]>;
  
  // Association type declarations (for TypeScript)
  // declare static associations: {
  //   subnets: Association<Vpc, Subnet>;
  //   routeTables: Association<Vpc, RouteTable>;
  //   securityGroups: Association<Vpc, SecurityGroup>;
  // };
}

/**
 * Initialize the Vpc model
 */
Vpc.init({
  // Primary key
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // AWS Identifiers
  awsVpcId: {
    type: DataTypes.STRING(21),
    allowNull: false,
    unique: true,
    validate: {
      is: /^vpc-[0-9a-f]{17}$/i
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
  
  // Basic VPC Information
  cidrBlock: {
    type: DataTypes.STRING(18),
    allowNull: false,
    validate: {
      is: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/
    }
  },
  
  cidrBlockAssociationSet: {
    type: DataTypes.JSON,
    allowNull: true
  },
  
  dhcpOptionsId: {
    type: DataTypes.STRING(21),
    allowNull: true,
    validate: {
      is: /^dopt-[0-9a-f]{17}$/i
    }
  },
  
  // State and Status
  state: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'available', 'deleting', 'deleted', 'failed']]
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
  
  availabilityZones: {
    type: DataTypes.JSON,
    allowNull: true
  },
  
  // Configuration
  isDefault: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  
  instanceTenancy: {
    type: DataTypes.ENUM('default', 'dedicated', 'host'),
    allowNull: false,
    defaultValue: 'default'
  },
  
  enableDnsHostnames: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  
  enableDnsSupport: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  
  // Network Configuration
  enableNetworkAddressUsageMetrics: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
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
  
  description: {
    type: DataTypes.TEXT,
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
  modelName: 'Vpc',
  tableName: 'vpcs',
  paranoid: true, // Soft deletes
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['awsVpcId']
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
      fields: ['isDefault']
    },
    {
      fields: ['environment']
    },
    {
      fields: ['project']
    },
    {
      fields: ['lastSyncAt']
    }
  ],
  hooks: {
    beforeCreate: (vpc, options) => {
      // Extract name from tags if not provided
      if (!vpc.name && vpc.tags && vpc.tags.Name) {
        vpc.name = vpc.tags.Name;
      }
    },
    beforeUpdate: (vpc, options) => {
      // Extract name from tags if not provided
      if (!vpc.name && vpc.tags && vpc.tags.Name) {
        vpc.name = vpc.tags.Name;
      }
    }
  }
});

export default Vpc;