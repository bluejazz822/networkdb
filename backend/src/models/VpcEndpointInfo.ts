/**
 * VpcEndpointInfo Sequelize Model
 * Maps to existing vpc_endpoint_info table in the database
 */

import {
  Model,
  DataTypes,
  CreationOptional,
  InferAttributes,
  InferCreationAttributes
} from 'sequelize';
import { getDatabase } from '../config/database';

const sequelize = getDatabase();

/**
 * VpcEndpointInfo model class - maps to vpc_endpoint_info table
 */
class VpcEndpointInfo extends Model<InferAttributes<VpcEndpointInfo>, InferCreationAttributes<VpcEndpointInfo>> {

  // AWS VPC Endpoint fields
  declare AccountId: CreationOptional<string>;
  declare Region: CreationOptional<string>;
  declare VpcEndpointId: string; // Primary identifier
  declare VpcId: CreationOptional<string>;
  declare ServiceName: CreationOptional<string>;
  declare VpcEndpointType: CreationOptional<string>;
  declare State: CreationOptional<string>;
  declare SubnetIds: CreationOptional<string>;
  declare NetworkInterfaceIds: CreationOptional<string>;
  declare EndpointName: CreationOptional<string>;

  // Business/Environment fields
  declare 'ENV Name': CreationOptional<string>;
  declare Tenant: CreationOptional<string>;
  declare 'ENV Type': CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

/**
 * Initialize the VpcEndpointInfo model
 */
VpcEndpointInfo.init({
  AccountId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Region: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  VpcEndpointId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true
  },

  VpcId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  ServiceName: {
    type: DataTypes.STRING(100),
    allowNull: true
  },

  VpcEndpointType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  State: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  SubnetIds: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  NetworkInterfaceIds: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  EndpointName: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  'ENV Name': {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'ENV Name'
  },

  Tenant: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  'ENV Type': {
    type: DataTypes.STRING(20),
    allowNull: true,
    field: 'ENV Type'
  },

  status: {
    type: DataTypes.STRING(20),
    allowNull: true
  },

  created_time: {
    type: DataTypes.DATE,
    allowNull: true
  },

  termindated_time: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'VpcEndpointInfo',
  tableName: 'vpc_endpoint_info',
  timestamps: false, // existing table doesn't use Sequelize timestamps
  freezeTableName: true // prevent pluralization
});

export default VpcEndpointInfo;
