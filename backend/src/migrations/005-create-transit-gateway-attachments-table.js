'use strict';

const { createMigrationHelper } = require('../utils/migration-helper');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const helper = createMigrationHelper(queryInterface);

    await helper.createTableWithCommonFields('transit_gateway_attachments', {
      // AWS Identifiers
      awsTransitGatewayAttachmentId: {
        type: Sequelize.STRING(21), // tgw-attach-xxxxxxxxxxxxxxxxx
        allowNull: false,
        unique: true
      },
      awsTransitGatewayId: {
        type: Sequelize.STRING(21), // tgw-xxxxxxxxxxxxxxxxx
        allowNull: false
      },
      awsAccountId: {
        type: Sequelize.STRING(12),
        allowNull: false
      },
      
      // Relationships
      transitGatewayId: {
        type: Sequelize.UUID,
        allowNull: true, // Nullable in case TGW not in our database
        references: {
          model: 'transit_gateways',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      
      // Attachment Details
      resourceType: {
        type: Sequelize.ENUM('vpc', 'vpn', 'direct-connect-gateway', 'peering', 'connect'),
        allowNull: false
      },
      resourceId: {
        type: Sequelize.STRING(21), // vpc-xxx, vgw-xxx, dx-gw-xxx, etc.
        allowNull: false
      },
      resourceOwnerId: {
        type: Sequelize.STRING(12),
        allowNull: true,
        comment: 'AWS account ID that owns the attached resource'
      },
      
      // VPC-specific fields
      vpcId: {
        type: Sequelize.UUID,
        allowNull: true, // Only for VPC attachments
        references: {
          model: 'vpcs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      awsVpcId: {
        type: Sequelize.STRING(21), // vpc-xxxxxxxxxxxxxxxxx
        allowNull: true, // Only for VPC attachments
        comment: 'AWS VPC ID for VPC attachments'
      },
      subnetIds: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array of subnet IDs for VPC attachments'
      },
      
      // State and Status
      state: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: 'pending'
      },
      statusId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'enum_attachment_states',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      
      // Configuration
      dnsSupport: {
        type: Sequelize.ENUM('enable', 'disable'),
        allowNull: true,
        comment: 'DNS support for VPC attachments'
      },
      ipv6Support: {
        type: Sequelize.ENUM('enable', 'disable'),
        allowNull: true,
        comment: 'IPv6 support for VPC attachments'
      },
      applianceModeSupport: {
        type: Sequelize.ENUM('enable', 'disable'),
        allowNull: true,
        comment: 'Appliance mode support'
      },
      
      // Route Table Association
      associationRouteTableId: {
        type: Sequelize.STRING(21), // tgw-rtb-xxxxxxxxxxxxxxxxx
        allowNull: true,
        comment: 'Associated route table ID'
      },
      
      // Route Table Propagation
      propagationRouteTableIds: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array of route table IDs for propagation'
      },
      
      // Cross-Account Sharing
      isShared: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      sharingAccountId: {
        type: Sequelize.STRING(12),
        allowNull: true,
        comment: 'Account ID that shared the transit gateway'
      },
      
      // Metadata
      tags: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'AWS tags as key-value pairs'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Attachment name from Name tag'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      
      // Sync Information
      sourceSystem: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'aws'
      },
      lastSyncAt: {
        type: Sequelize.DATE,
        allowNull: true
      },
      syncVersion: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1
      },
      
      // Business Information
      environment: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Environment (dev, staging, prod, etc.)'
      },
      project: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Project or application name'
      },
      owner: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Resource owner or team'
      },
      
      // Network Architecture
      attachmentPurpose: {
        type: Sequelize.ENUM('production', 'development', 'testing', 'inspection', 'backup'),
        allowNull: true,
        comment: 'Purpose of this attachment'
      },
      isPrimary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Primary attachment for the resource'
      }
    });

    // Add additional indexes
    await helper.createIndex('transit_gateway_attachments', 'awsTransitGatewayAttachmentId', { unique: true });
    await helper.createIndex('transit_gateway_attachments', 'awsTransitGatewayId');
    await helper.createIndex('transit_gateway_attachments', 'transitGatewayId');
    await helper.createIndex('transit_gateway_attachments', 'awsAccountId');
    await helper.createIndex('transit_gateway_attachments', 'resourceType');
    await helper.createIndex('transit_gateway_attachments', 'resourceId');
    await helper.createIndex('transit_gateway_attachments', ['awsTransitGatewayId', 'resourceType']);
    await helper.createIndex('transit_gateway_attachments', ['resourceType', 'resourceId']);
    await helper.createIndex('transit_gateway_attachments', 'vpcId');
    await helper.createIndex('transit_gateway_attachments', 'awsVpcId');
    await helper.createIndex('transit_gateway_attachments', 'state');
    await helper.createIndex('transit_gateway_attachments', 'isShared');
    await helper.createIndex('transit_gateway_attachments', 'environment');
    await helper.createIndex('transit_gateway_attachments', 'attachmentPurpose');
    await helper.createIndex('transit_gateway_attachments', 'isPrimary');
    await helper.createIndex('transit_gateway_attachments', 'lastSyncAt');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('transit_gateway_attachments');
  }
};