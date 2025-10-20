/**
 * AzureLoadBalancer Sequelize Model
 * Maps to existing azure_lb_info table in the database
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
 * AzureLoadBalancer model class - maps to azure_lb_info table
 */
class AzureLoadBalancer extends Model<InferAttributes<AzureLoadBalancer>, InferCreationAttributes<AzureLoadBalancer>> {

  declare SubscriptionId: string; // Primary identifier
  declare ResourceGroup: CreationOptional<string>;
  declare Location: CreationOptional<string>;
  declare AppGatewayName: CreationOptional<string>;
  declare Sku: CreationOptional<string>;
  declare Capacity: CreationOptional<string>;
  declare 'Frontend public IP address': CreationOptional<string>;
  declare State: CreationOptional<string>;

  // Business/Environment fields
  declare 'ENV Name': CreationOptional<string>;
  declare Tenant: CreationOptional<string>;
  declare 'ENV Type': CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

AzureLoadBalancer.init({
  SubscriptionId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true
  },

  ResourceGroup: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Location: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  AppGatewayName: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Sku: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Capacity: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  'Frontend public IP address': {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'Frontend public IP address'
  },

  State: {
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
  modelName: 'AzureLoadBalancer',
  tableName: 'azure_lb_info',
  timestamps: false,
  freezeTableName: true
});

export default AzureLoadBalancer;
