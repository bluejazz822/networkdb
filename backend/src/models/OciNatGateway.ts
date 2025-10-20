/**
 * OciNatGateway Sequelize Model
 * Maps to existing oci_ngw_info table in the database
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
 * OciNatGateway model class - maps to oci_ngw_info table
 */
class OciNatGateway extends Model<InferAttributes<OciNatGateway>, InferCreationAttributes<OciNatGateway>> {

  // Oracle Cloud Infrastructure NAT Gateway fields
  declare NatGatewayId: string; // Primary identifier
  declare Region: CreationOptional<string>;
  declare CompartmentName: CreationOptional<string>;
  declare CompartmentId: CreationOptional<string>;
  declare NatGatewayName: CreationOptional<string>;
  declare VcnId: CreationOptional<string>;
  declare PublicIpId: CreationOptional<string>;
  declare PublicIpAddress: CreationOptional<string>;
  declare LifecycleState: CreationOptional<string>;

  // Status and timestamps
  declare status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

/**
 * Initialize the OciNatGateway model
 */
OciNatGateway.init({
  NatGatewayId: {
    type: DataTypes.STRING(200),
    allowNull: false,
    primaryKey: true
  },

  Region: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  CompartmentName: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  CompartmentId: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  NatGatewayName: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  VcnId: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  PublicIpId: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  PublicIpAddress: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  LifecycleState: {
    type: DataTypes.STRING(50),
    allowNull: true
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
  modelName: 'OciNatGateway',
  tableName: 'oci_ngw_info',
  timestamps: false, // existing table doesn't use Sequelize timestamps
  freezeTableName: true // prevent pluralization
});

export default OciNatGateway;
