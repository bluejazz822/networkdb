/**
 * OciLoadBalancer Sequelize Model
 * Maps to existing oci_lb_info table in the database
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
 * OciLoadBalancer model class - maps to oci_lb_info table
 */
class OciLoadBalancer extends Model<InferAttributes<OciLoadBalancer>, InferCreationAttributes<OciLoadBalancer>> {

  declare LoadBalancerId: string; // Primary identifier
  declare Region: CreationOptional<string>;
  declare CompartmentName: CreationOptional<string>;
  declare CompartmentId: CreationOptional<string>;
  declare LoadBalancerName: CreationOptional<string>;
  declare Shape: CreationOptional<string>;
  declare IpAddresses: CreationOptional<string>;
  declare IsPrivate: CreationOptional<string>;
  declare LifecycleState: CreationOptional<string>;

  // Business/Environment fields
  declare 'ENV Name': CreationOptional<string>;
  declare Tenant: CreationOptional<string>;
  declare 'ENV Type': CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

OciLoadBalancer.init({
  LoadBalancerId: {
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

  LoadBalancerName: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Shape: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  IpAddresses: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  IsPrivate: {
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
  modelName: 'OciLoadBalancer',
  tableName: 'oci_lb_info',
  timestamps: false,
  freezeTableName: true
});

export default OciLoadBalancer;
