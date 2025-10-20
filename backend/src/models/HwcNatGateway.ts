/**
 * HwcNatGateway Sequelize Model
 * Maps to existing hwc_ngw_info table in the database
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
 * HwcNatGateway model class - maps to hwc_ngw_info table
 */
class HwcNatGateway extends Model<InferAttributes<HwcNatGateway>, InferCreationAttributes<HwcNatGateway>> {

  // Huawei Cloud NAT Gateway fields
  declare id: string; // Primary identifier
  declare name: CreationOptional<string>;
  declare spec: CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare vpc_id: CreationOptional<string>;

  // Business/Environment fields
  declare 'ENV Name': CreationOptional<string>;
  declare Tenant: CreationOptional<string>;
  declare 'ENV Type': CreationOptional<string>;
  declare ngw_status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

/**
 * Initialize the HwcNatGateway model
 */
HwcNatGateway.init({
  id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true
  },

  name: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  spec: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  vpc_id: {
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
  modelName: 'HwcNatGateway',
  tableName: 'hwc_ngw_info',
  timestamps: false, // existing table doesn't use Sequelize timestamps
  freezeTableName: true // prevent pluralization
});

export default HwcNatGateway;
