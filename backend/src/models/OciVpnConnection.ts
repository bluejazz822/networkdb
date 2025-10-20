/**
 * OciVpnConnection Sequelize Model
 * Maps to existing oci_vpn_info table in the database
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
 * OciVpnConnection model class - maps to oci_vpn_info table
 */
class OciVpnConnection extends Model<InferAttributes<OciVpnConnection>, InferCreationAttributes<OciVpnConnection>> {

  declare VpnId: string; // Primary key
  declare Region: CreationOptional<string>;
  declare CompartmentName: CreationOptional<string>;
  declare CompartmentId: CreationOptional<string>;
  declare VpnName: CreationOptional<string>;
  declare DrgId: CreationOptional<string>;
  declare CpeId: CreationOptional<string>;
  declare CpeLocalIdentifier: CreationOptional<string>;
  declare LifecycleState: CreationOptional<string>;

  // Business/Environment fields
  declare 'ENV Name': CreationOptional<string>;
  declare Tenant: CreationOptional<string>;
  declare 'ENV Type': CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

OciVpnConnection.init({
  VpnId: {
    type: DataTypes.STRING(200),
    allowNull: false,
    primaryKey: true
  },

  Region: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  CompartmentName: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  CompartmentId: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  VpnName: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  DrgId: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  CpeId: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  CpeLocalIdentifier: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  LifecycleState: {
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
  modelName: 'OciVpnConnection',
  tableName: 'oci_vpn_info',
  timestamps: false,
  freezeTableName: true
});

export default OciVpnConnection;
