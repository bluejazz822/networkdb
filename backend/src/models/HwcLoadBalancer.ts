/**
 * HwcLoadBalancer Sequelize Model
 * Maps to existing hwc_lb_info table in the database
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
 * HwcLoadBalancer model class - maps to hwc_lb_info table
 */
class HwcLoadBalancer extends Model<InferAttributes<HwcLoadBalancer>, InferCreationAttributes<HwcLoadBalancer>> {

  declare id: string; // Primary identifier
  declare name: CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare type: CreationOptional<string>;
  declare vip_address: CreationOptional<string>;
  declare vpc_id: CreationOptional<string>;

  // Business/Environment fields
  declare 'ENV Name': CreationOptional<string>;
  declare Tenant: CreationOptional<string>;
  declare 'ENV Type': CreationOptional<string>;
  declare lb_status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

HwcLoadBalancer.init({
  id: {
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true
  },

  name: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  vip_address: {
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

  lb_status: {
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
  modelName: 'HwcLoadBalancer',
  tableName: 'hwc_lb_info',
  timestamps: false,
  freezeTableName: true
});

export default HwcLoadBalancer;
