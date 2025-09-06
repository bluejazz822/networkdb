/**
 * VpcEndpoint Sequelize Model
 * Represents AWS VPC Endpoint resources in the database
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
 * VpcEndpoint model class
 */
class VpcEndpoint extends Model<InferAttributes<VpcEndpoint>, InferCreationAttributes<VpcEndpoint>> 
  implements INetworkResourceModel {
  
  // Primary key
  declare id: CreationOptional<string>;
  
  // AWS Identifiers
  declare awsVpcEndpointId: string;
  declare awsAccountId: string;
  
  // VPC Association
  declare vpcId: string;
  
  // Service Information
  declare serviceName: string;
  declare serviceType: 'Interface' | 'Gateway' | 'GatewayLoadBalancer';
  
  // State and Status
  declare state: string;
  declare statusId: string;
  
  // Location
  declare region: string;
  declare regionId: string;
  
  // Network Configuration
  declare subnetIds: CreationOptional<string[]>;
  declare routeTableIds: CreationOptional<string[]>;
  declare securityGroupIds: CreationOptional<string[]>;
  
  // DNS Configuration
  declare dnsOptions: CreationOptional<any>;
  declare privateDnsEnabled: CreationOptional<boolean>;
  declare dnsEntries: CreationOptional<any[]>;
  
  // Policy Configuration
  declare policyDocument: CreationOptional<any>;
  
  // Network Interface Information (for Interface endpoints)
  declare networkInterfaceIds: CreationOptional<string[]>;
  
  // Prefix List Information (for Gateway endpoints)
  declare prefixListId: CreationOptional<string>;
  
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
  
  // Operational Information
  declare acceptanceRequired: CreationOptional<boolean>;
  declare managedByAws: CreationOptional<boolean>;
  
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date>;
  
  // Associations (will be defined later)
  // declare vpc?: NonAttribute<Vpc>;
}

/**
 * Initialize the VpcEndpoint model
 */
VpcEndpoint.init({
  // Primary key
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // AWS Identifiers
  awsVpcEndpointId: {
    type: DataTypes.STRING(21),
    allowNull: false,
    unique: true,
    validate: {
      is: /^vpce-[0-9a-f]{17}$/i
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
  
  // VPC Association
  vpcId: {
    type: DataTypes.STRING(21),
    allowNull: false,
    validate: {
      is: /^vpc-[0-9a-f]{17}$/i
    }
  },
  
  // Service Information
  serviceName: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      notEmpty: true
    }
  },
  
  serviceType: {
    type: DataTypes.ENUM('Interface', 'Gateway', 'GatewayLoadBalancer'),
    allowNull: false
  },
  
  // State and Status
  state: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: [['pending', 'available', 'deleting', 'deleted', 'rejected', 'failed']]
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
  
  // Network Configuration
  subnetIds: {
    type: DataTypes.JSON,
    allowNull: true
  },
  
  routeTableIds: {
    type: DataTypes.JSON,
    allowNull: true
  },
  
  securityGroupIds: {
    type: DataTypes.JSON,
    allowNull: true
  },
  
  // DNS Configuration
  dnsOptions: {
    type: DataTypes.JSON,
    allowNull: true
  },
  
  privateDnsEnabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  
  dnsEntries: {
    type: DataTypes.JSON,
    allowNull: true
  },
  
  // Policy Configuration
  policyDocument: {
    type: DataTypes.JSON,
    allowNull: true
  },
  
  // Network Interface Information (for Interface endpoints)
  networkInterfaceIds: {
    type: DataTypes.JSON,
    allowNull: true
  },
  
  // Prefix List Information (for Gateway endpoints)
  prefixListId: {
    type: DataTypes.STRING(50),
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
  
  // Operational Information
  acceptanceRequired: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  
  managedByAws: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
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
  modelName: 'VpcEndpoint',
  tableName: 'vpc_endpoints',
  paranoid: true, // Soft deletes
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['awsVpcEndpointId']
    },
    {
      fields: ['awsAccountId']
    },
    {
      fields: ['region']
    },
    {
      fields: ['vpcId']
    },
    {
      fields: ['serviceName']
    },
    {
      fields: ['serviceType']
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
      fields: ['project']
    },
    {
      fields: ['privateDnsEnabled']
    },
    {
      fields: ['lastSyncAt']
    }
  ],
  hooks: {
    beforeCreate: (endpoint, options) => {
      // Extract name from tags if not provided
      if (!endpoint.name && endpoint.tags && endpoint.tags.Name) {
        endpoint.name = endpoint.tags.Name;
      }
      
      // Validate subnet IDs format
      if (endpoint.subnetIds) {
        const validSubnetIds = endpoint.subnetIds.every(id => 
          typeof id === 'string' && /^subnet-[0-9a-f]{17}$/i.test(id)
        );
        if (!validSubnetIds) {
          throw new Error('Invalid subnet ID format in subnetIds array');
        }
      }
      
      // Validate route table IDs format
      if (endpoint.routeTableIds) {
        const validRouteTableIds = endpoint.routeTableIds.every(id => 
          typeof id === 'string' && /^rtb-[0-9a-f]{17}$/i.test(id)
        );
        if (!validRouteTableIds) {
          throw new Error('Invalid route table ID format in routeTableIds array');
        }
      }
      
      // Validate security group IDs format
      if (endpoint.securityGroupIds) {
        const validSgIds = endpoint.securityGroupIds.every(id => 
          typeof id === 'string' && /^sg-[0-9a-f]{17}$/i.test(id)
        );
        if (!validSgIds) {
          throw new Error('Invalid security group ID format in securityGroupIds array');
        }
      }
    },
    beforeUpdate: (endpoint, options) => {
      // Extract name from tags if not provided
      if (!endpoint.name && endpoint.tags && endpoint.tags.Name) {
        endpoint.name = endpoint.tags.Name;
      }
      
      // Apply same validations as beforeCreate
      if (endpoint.subnetIds) {
        const validSubnetIds = endpoint.subnetIds.every(id => 
          typeof id === 'string' && /^subnet-[0-9a-f]{17}$/i.test(id)
        );
        if (!validSubnetIds) {
          throw new Error('Invalid subnet ID format in subnetIds array');
        }
      }
      
      if (endpoint.routeTableIds) {
        const validRouteTableIds = endpoint.routeTableIds.every(id => 
          typeof id === 'string' && /^rtb-[0-9a-f]{17}$/i.test(id)
        );
        if (!validRouteTableIds) {
          throw new Error('Invalid route table ID format in routeTableIds array');
        }
      }
      
      if (endpoint.securityGroupIds) {
        const validSgIds = endpoint.securityGroupIds.every(id => 
          typeof id === 'string' && /^sg-[0-9a-f]{17}$/i.test(id)
        );
        if (!validSgIds) {
          throw new Error('Invalid security group ID format in securityGroupIds array');
        }
      }
    }
  }
});

export default VpcEndpoint;