/**
 * VpnConnection Sequelize Model
 * Maps to existing vpn_info table in the database
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
 * VpnConnection model class - maps to vpn_info table
 */
class VpnConnection extends Model<InferAttributes<VpnConnection>, InferCreationAttributes<VpnConnection>> {

  declare VpnConnectionId: string; // Primary key
  declare AccountId: CreationOptional<string>;
  declare Region: CreationOptional<string>;
  declare CustomerGatewayId: CreationOptional<string>;
  declare VpnGatewayId: CreationOptional<string>;
  declare TransitGatewayId: CreationOptional<string>;
  declare State: CreationOptional<string>;
  declare Type: CreationOptional<string>;
  declare VPNConnectionName: CreationOptional<string>;

  // Business/Environment fields
  declare 'ENV Name': CreationOptional<string>;
  declare Tenant: CreationOptional<string>;
  declare 'ENV Type': CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

VpnConnection.init({
  VpnConnectionId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true
  },

  AccountId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Region: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  CustomerGatewayId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  VpnGatewayId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  TransitGatewayId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  State: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  VPNConnectionName: {
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
  modelName: 'VpnConnection',
  tableName: 'vpn_info',
  timestamps: false,
  freezeTableName: true
});

export default VpnConnection;
