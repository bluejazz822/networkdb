/**
 * AliVpnConnection Sequelize Model
 * Maps to existing ali_vpn_info table in the database
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
 * AliVpnConnection model class - maps to ali_vpn_info table
 */
class AliVpnConnection extends Model<InferAttributes<AliVpnConnection>, InferCreationAttributes<AliVpnConnection>> {

  declare VpnConnectionId: string; // Primary key
  declare Region: CreationOptional<string>;
  declare Name: CreationOptional<string>;
  declare Status: CreationOptional<string>;
  declare VpnGatewayId: CreationOptional<string>;
  declare CustomerGatewayId: CreationOptional<string>;
  declare LocalSubnet: CreationOptional<string>;
  declare RemoteSubnet: CreationOptional<string>;
  declare CreateTime: CreationOptional<Date>;
  declare IkeConfig: CreationOptional<string>;
  declare IpsecConfig: CreationOptional<string>;

  // Business/Environment fields
  declare 'ENV Name': CreationOptional<string>;
  declare Tenant: CreationOptional<string>;
  declare 'ENV Type': CreationOptional<string>;
  declare vpn_status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

AliVpnConnection.init({
  VpnConnectionId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true
  },

  Region: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Name: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  VpnGatewayId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  CustomerGatewayId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  LocalSubnet: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  RemoteSubnet: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  CreateTime: {
    type: DataTypes.DATE,
    allowNull: true
  },

  IkeConfig: {
    type: DataTypes.STRING(300),
    allowNull: true
  },

  IpsecConfig: {
    type: DataTypes.STRING(300),
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

  vpn_status: {
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
  modelName: 'AliVpnConnection',
  tableName: 'ali_vpn_info',
  timestamps: false,
  freezeTableName: true
});

export default AliVpnConnection;
