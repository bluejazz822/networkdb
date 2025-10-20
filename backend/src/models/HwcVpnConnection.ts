/**
 * HwcVpnConnection Sequelize Model
 * Maps to existing hwc_vpn_info table in the database
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
 * HwcVpnConnection model class - maps to hwc_vpn_info table
 */
class HwcVpnConnection extends Model<InferAttributes<HwcVpnConnection>, InferCreationAttributes<HwcVpnConnection>> {

  declare id: string; // Primary key
  declare name: CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare gateway_ip: CreationOptional<string>;
  declare vpn_gateway_id: CreationOptional<string>;
  declare customer_gateway_id: CreationOptional<string>;
  declare enterprise_project_id: CreationOptional<string>;
  declare created_at: CreationOptional<Date>;

  // Business/Environment fields
  declare 'ENV Name': CreationOptional<string>;
  declare Tenant: CreationOptional<string>;
  declare 'ENV Type': CreationOptional<string>;
  declare vpn_status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

HwcVpnConnection.init({
  id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true
  },

  name: {
    type: DataTypes.STRING(100),
    allowNull: true
  },

  status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  gateway_ip: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  vpn_gateway_id: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  customer_gateway_id: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  enterprise_project_id: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  created_at: {
    type: DataTypes.DATE,
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
  modelName: 'HwcVpnConnection',
  tableName: 'hwc_vpn_info',
  timestamps: false,
  freezeTableName: true
});

export default HwcVpnConnection;
