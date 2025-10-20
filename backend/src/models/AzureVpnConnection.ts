/**
 * AzureVpnConnection Sequelize Model
 * Maps to existing azure_vpn_info table in the database
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
 * AzureVpnConnection model class - maps to azure_vpn_info table
 */
class AzureVpnConnection extends Model<InferAttributes<AzureVpnConnection>, InferCreationAttributes<AzureVpnConnection>> {

  declare SubscriptionId: string; // Primary key
  declare ResourceGroup: CreationOptional<string>;
  declare Location: CreationOptional<string>;
  declare ConnectionName: CreationOptional<string>;
  declare ConnectionType: CreationOptional<string>;
  declare 'Peer IP': CreationOptional<string>;

  // Business/Environment fields
  declare 'ENV Name': CreationOptional<string>;
  declare Tenant: CreationOptional<string>;
  declare 'ENV Type': CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

AzureVpnConnection.init({
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

  ConnectionName: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  ConnectionType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  'Peer IP': {
    type: DataTypes.STRING(50),
    allowNull: true,
    field: 'Peer IP'
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
  modelName: 'AzureVpnConnection',
  tableName: 'azure_vpn_info',
  timestamps: false,
  freezeTableName: true
});

export default AzureVpnConnection;
