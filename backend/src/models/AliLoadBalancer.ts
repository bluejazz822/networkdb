/**
 * AliLoadBalancer Sequelize Model
 * Maps to existing ali_lb_info table in the database
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
 * AliLoadBalancer model class - maps to ali_lb_info table
 */
class AliLoadBalancer extends Model<InferAttributes<AliLoadBalancer>, InferCreationAttributes<AliLoadBalancer>> {

  declare Region: CreationOptional<string>;
  declare LoadBalancerId: string; // Primary identifier
  declare Name: CreationOptional<string>;
  declare Address: CreationOptional<string>;
  declare AddressType: CreationOptional<string>;
  declare VpcId: CreationOptional<string>;
  declare VSwitchId: CreationOptional<string>;
  declare Status: CreationOptional<string>;
  declare Listeners: CreationOptional<string>;

  // Business/Environment fields
  declare 'ENV Name': CreationOptional<string>;
  declare Tenant: CreationOptional<string>;
  declare 'ENV Type': CreationOptional<string>;
  declare lb_status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

AliLoadBalancer.init({
  Region: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  LoadBalancerId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true
  },

  Name: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Address: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  AddressType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  VpcId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  VSwitchId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Status: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Listeners: {
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
  modelName: 'AliLoadBalancer',
  tableName: 'ali_lb_info',
  timestamps: false,
  freezeTableName: true
});

export default AliLoadBalancer;
