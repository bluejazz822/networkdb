/**
 * AliNatGateway Sequelize Model
 * Maps to existing ali_ngw_info table in the database
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
 * AliNatGateway model class - maps to ali_ngw_info table
 */
class AliNatGateway extends Model<InferAttributes<AliNatGateway>, InferCreationAttributes<AliNatGateway>> {

  // Alibaba Cloud NAT Gateway fields
  declare NatGatewayId: string; // Primary identifier
  declare Region: CreationOptional<string>;
  declare VpcId: CreationOptional<string>;
  declare Name: CreationOptional<string>;
  declare Spec: CreationOptional<string>;
  declare Status: CreationOptional<string>;
  declare SnatEntryId: CreationOptional<string>;
  declare SnatEntryName: CreationOptional<string>;
  declare PublicIp: CreationOptional<string>;
  declare PublicIpName: CreationOptional<string>;

  // Status and timestamps
  declare ngw_status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

/**
 * Initialize the AliNatGateway model
 */
AliNatGateway.init({
  NatGatewayId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true
  },

  Region: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  VpcId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Name: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  Spec: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  SnatEntryId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  SnatEntryName: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  PublicIp: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  PublicIpName: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  ngw_status: {
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
  modelName: 'AliNatGateway',
  tableName: 'ali_ngw_info',
  timestamps: false, // existing table doesn't use Sequelize timestamps
  freezeTableName: true // prevent pluralization
});

export default AliNatGateway;
