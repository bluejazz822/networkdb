/**
 * CustomerGateway Sequelize Model
 * Represents AWS Customer Gateway resources in the database
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
 * CustomerGateway model class
 */
class CustomerGateway extends Model<InferAttributes<CustomerGateway>, InferCreationAttributes<CustomerGateway>> 
  implements INetworkResourceModel {
  
  // Primary key
  declare id: CreationOptional<string>;
  
  // AWS Identifiers
  declare awsCustomerGatewayId: string;
  declare awsAccountId: string;
  
  // Basic Configuration
  declare type: CreationOptional<'ipsec.1'>;
  declare ipAddress: string;
  declare bgpAsn: number;
  
  // State and Status
  declare state: string;
  declare statusId: string;
  
  // Location
  declare region: string;
  declare regionId: string;
  
  // Device Configuration
  declare deviceName: CreationOptional<string>;
  declare deviceModel: CreationOptional<string>;
  declare deviceVendor: CreationOptional<string>;
  declare deviceSoftwareVersion: CreationOptional<string>;
  
  // Network Configuration
  declare insideIpv4NetworkCidr: CreationOptional<string>;
  declare outsideIpAddress: CreationOptional<string>;
  
  // Certificate-based Authentication
  declare certificateArn: CreationOptional<string>;
  
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
  
  // Physical Location
  declare siteLocation: CreationOptional<string>;
  declare siteAddress: CreationOptional<string>;
  declare contactPerson: CreationOptional<string>;
  declare contactPhone: CreationOptional<string>;
  declare contactEmail: CreationOptional<string>;
  
  // Operational Information
  declare maintenanceWindow: CreationOptional<string>;
  declare isPrimary: CreationOptional<boolean>;
  declare redundancyGroup: CreationOptional<string>;
  
  // Timestamps
  declare createdAt: CreationOptional<Date>;
  declare updatedAt: CreationOptional<Date>;
  declare deletedAt: CreationOptional<Date>;
  
  // Associations (will be defined later)
  // declare vpnConnections?: NonAttribute<VpnConnection[]>;
}

/**
 * Initialize the CustomerGateway model
 */
CustomerGateway.init({
  // Primary key
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  
  // AWS Identifiers
  awsCustomerGatewayId: {
    type: DataTypes.STRING(21),
    allowNull: false,
    unique: true,
    validate: {
      is: /^cgw-[0-9a-f]{17}$/i
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
  
  // Basic Configuration
  type: {
    type: DataTypes.ENUM('ipsec.1'),
    allowNull: false,
    defaultValue: 'ipsec.1'
  },
  
  ipAddress: {
    type: DataTypes.STRING(15),
    allowNull: false,
    validate: {
      isIP: true
    }
  },
  
  bgpAsn: {
    type: DataTypes.BIGINT,
    allowNull: false,
    validate: {
      min: 1,
      max: 4294967294
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
  
  // Device Configuration
  deviceName: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  
  deviceModel: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  
  deviceVendor: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  
  deviceSoftwareVersion: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  
  // Network Configuration
  insideIpv4NetworkCidr: {
    type: DataTypes.STRING(18),
    allowNull: true,
    validate: {
      is: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/
    }
  },
  
  outsideIpAddress: {
    type: DataTypes.STRING(15),
    allowNull: true,
    validate: {
      isIP: true
    }
  },
  
  // Certificate-based Authentication
  certificateArn: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      is: /^arn:aws:acm:/
    }
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
  
  // Physical Location
  siteLocation: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  
  siteAddress: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  
  contactPerson: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  
  contactPhone: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  
  contactEmail: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true
    }
  },
  
  // Operational Information
  maintenanceWindow: {
    type: DataTypes.STRING(100),
    allowNull: true
  },
  
  isPrimary: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  
  redundancyGroup: {
    type: DataTypes.STRING(100),
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
  modelName: 'CustomerGateway',
  tableName: 'customer_gateways',
  paranoid: true, // Soft deletes
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['awsCustomerGatewayId']
    },
    {
      fields: ['awsAccountId']
    },
    {
      fields: ['region']
    },
    {
      fields: ['ipAddress']
    },
    {
      fields: ['bgpAsn']
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
      fields: ['siteLocation']
    },
    {
      fields: ['isPrimary']
    },
    {
      fields: ['redundancyGroup']
    },
    {
      fields: ['lastSyncAt']
    }
  ],
  hooks: {
    beforeCreate: (cgw, options) => {
      // Extract name from tags if not provided
      if (!cgw.name && cgw.tags && cgw.tags.Name) {
        cgw.name = cgw.tags.Name;
      }
      
      // Validate contact email
      if (cgw.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cgw.contactEmail)) {
        throw new Error('Invalid contact email format');
      }
    },
    beforeUpdate: (cgw, options) => {
      // Extract name from tags if not provided
      if (!cgw.name && cgw.tags && cgw.tags.Name) {
        cgw.name = cgw.tags.Name;
      }
      
      // Validate contact email
      if (cgw.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cgw.contactEmail)) {
        throw new Error('Invalid contact email format');
      }
    }
  }
});

export default CustomerGateway;