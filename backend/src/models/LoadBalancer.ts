/**
 * LoadBalancer Sequelize Model
 * Maps to existing lb_info table in the database
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
 * LoadBalancer model class - maps to lb_info table
 */
class LoadBalancer extends Model<InferAttributes<LoadBalancer>, InferCreationAttributes<LoadBalancer>> {

  // AWS Load Balancer fields
  declare AccountId: CreationOptional<string>;
  declare Region: CreationOptional<string>;
  declare LoadBalancerName: CreationOptional<string>;
  declare LoadBalancerArn: string; // Primary identifier
  declare DNSName: CreationOptional<string>;
  declare Type: CreationOptional<string>;
  declare Scheme: CreationOptional<string>;
  declare VpcId: CreationOptional<string>;

  // Business/Environment fields
  declare 'ENV Name': CreationOptional<string>;
  declare Tenant: CreationOptional<string>;
  declare 'ENV Type': CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

/**
 * Initialize the LoadBalancer model
 */
LoadBalancer.init({
  AccountId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Region: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  LoadBalancerName: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  LoadBalancerArn: {
    type: DataTypes.STRING(200),
    allowNull: false,
    primaryKey: true
  },

  DNSName: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  Type: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Scheme: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  VpcId: {
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
  modelName: 'LoadBalancer',
  tableName: 'lb_info',
  timestamps: false, // existing table doesn't use Sequelize timestamps
  freezeTableName: true // prevent pluralization
});

export default LoadBalancer;
