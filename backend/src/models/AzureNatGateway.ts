/**
 * AzureNatGateway Sequelize Model
 * Maps to existing azure_ngw_info table in the database
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
 * AzureNatGateway model class - maps to azure_ngw_info table
 */
class AzureNatGateway extends Model<InferAttributes<AzureNatGateway>, InferCreationAttributes<AzureNatGateway>> {

  // Azure NAT Gateway fields
  declare SubscriptionId: string; // Primary identifier
  declare ResourceGroup: CreationOptional<string>;
  declare Location: CreationOptional<string>;
  declare NatGatewayName: CreationOptional<string>;
  declare Sku: CreationOptional<string>;
  declare PublicIpAddresses: CreationOptional<string>;

  // Status and timestamps
  declare status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

/**
 * Initialize the AzureNatGateway model
 */
AzureNatGateway.init({
  SubscriptionId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true
  },

  ResourceGroup: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  Location: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  NatGatewayName: {
    type: DataTypes.STRING(200),
    allowNull: true
  },

  Sku: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  PublicIpAddresses: {
    type: DataTypes.STRING(200),
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
  modelName: 'AzureNatGateway',
  tableName: 'azure_ngw_info',
  timestamps: false, // existing table doesn't use Sequelize timestamps
  freezeTableName: true // prevent pluralization
});

export default AzureNatGateway;
