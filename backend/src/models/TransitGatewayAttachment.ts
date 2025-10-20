/**
 * TransitGatewayAttachment Sequelize Model
 * Maps to existing tgw_attachment_info table in the database
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
 * TransitGatewayAttachment model class - maps to tgw_attachment_info table
 */
class TransitGatewayAttachment extends Model<InferAttributes<TransitGatewayAttachment>, InferCreationAttributes<TransitGatewayAttachment>> {

  // AWS Transit Gateway Attachment fields
  declare AccountId: CreationOptional<string>;
  declare Region: CreationOptional<string>;
  declare TransitGatewayAttachmentId: string; // Primary identifier
  declare TransitGatewayId: CreationOptional<string>;
  declare TransitGatewayName: CreationOptional<string>;
  declare ResourceId: CreationOptional<string>;
  declare ResourceType: CreationOptional<string>;
  declare State: CreationOptional<string>;
  declare AssociationState: CreationOptional<string>;
  declare TransitGatewayAttachmentName: CreationOptional<string>;

  // Business/Environment fields
  declare Tenant: CreationOptional<string>;
  declare 'ENV Type': CreationOptional<string>;
  declare status: CreationOptional<string>;
  declare created_time: CreationOptional<Date>;
  declare termindated_time: CreationOptional<Date>;
}

/**
 * Initialize the TransitGatewayAttachment model
 */
TransitGatewayAttachment.init({
  AccountId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  Region: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  TransitGatewayAttachmentId: {
    type: DataTypes.STRING(50),
    allowNull: false,
    primaryKey: true
  },

  TransitGatewayId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  TransitGatewayName: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  ResourceId: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  ResourceType: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  State: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  AssociationState: {
    type: DataTypes.STRING(50),
    allowNull: true
  },

  TransitGatewayAttachmentName: {
    type: DataTypes.STRING(50),
    allowNull: true
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
  modelName: 'TransitGatewayAttachment',
  tableName: 'tgw_attachment_info',
  timestamps: false, // existing table doesn't use Sequelize timestamps
  freezeTableName: true // prevent pluralization
});

export default TransitGatewayAttachment;
