/**
 * NatGateway Sequelize Model
 * Maps to existing ngw_info table in the database
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
 * NatGateway model class - maps to ngw_info table
 */
class NatGateway extends Model<InferAttributes<NatGateway>, InferCreationAttributes<NatGateway>> {

  // AWS NAT Gateway fields
  declare NatGatewayId: string; // Primary identifier
  declare AccountId: CreationOptional<string>;
  declare Region: CreationOptional<string>;
  declare VpcId: CreationOptional<string>;
  declare SubnetId: CreationOptional<string>;
  declare State: CreationOptional<string>;
  declare PublicIps: CreationOptional<string>;
  declare PrivateIps: CreationOptional<string>;
  declare ConnectivityType: CreationOptional<string>;
  declare NatGatewayName: CreationOptional<string>;

  // Business/Environment fields
  declare 'ENV Name': CreationOptional<string>;
  declare Tenant: CreationOptional<string>;
  declare 'ENV Type': CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

/**
 * Initialize the NatGateway model
 */
NatGateway.init({
  NatGatewayId: {
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

  VpcId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  SubnetId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  State: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  PublicIps: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  PrivateIps: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  ConnectivityType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  NatGatewayName: {
    type: DataTypes.STRING(200),
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
  modelName: 'NatGateway',
  tableName: 'ngw_info',
  timestamps: false, // existing table doesn't use Sequelize timestamps
  freezeTableName: true // prevent pluralization
});

export default NatGateway;
