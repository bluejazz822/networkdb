'use strict';

const { createMigrationHelper } = require('../../dist/utils/migration-helper');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const helper = createMigrationHelper(queryInterface);

    await helper.createTableWithCommonFields('transit_gateways', {
      // AWS Identifiers
      awsTransitGatewayId: {
        type: Sequelize.STRING(21), // tgw-xxxxxxxxxxxxxxxxx
        allowNull: false,
        unique: true
      },
      awsAccountId: {
        type: Sequelize.STRING(12),
        allowNull: false
      },
      
      // Basic Information
      description: {
        type: Sequelize.TEXT,
        allowNull: true
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
          model: 'enum_resource_status',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      
      // Location
      region: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      regionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'enum_aws_regions',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      
      // Configuration
      amazonSideAsn: {
        type: Sequelize.BIGINT,
        allowNull: false,
        comment: 'Amazon side BGP ASN'
      },
      autoAcceptSharedAttachments: {
        type: Sequelize.ENUM('enable', 'disable'),
        allowNull: false,
        defaultValue: 'disable'
      },
      defaultRouteTableAssociation: {
        type: Sequelize.ENUM('enable', 'disable'),
        allowNull: false,
        defaultValue: 'enable'
      },
      defaultRouteTablePropagation: {
        type: Sequelize.ENUM('enable', 'disable'),
        allowNull: false,
        defaultValue: 'enable'
      },
      dnsSupport: {
        type: Sequelize.ENUM('enable', 'disable'),
        allowNull: false,
        defaultValue: 'enable'
      },
      multicast: {
        type: Sequelize.ENUM('enable', 'disable'),
        allowNull: false,
        defaultValue: 'disable'
      },
      
      // Route Tables
      associationDefaultRouteTableId: {
        type: Sequelize.STRING(21), // tgw-rtb-xxxxxxxxxxxxxxxxx
        allowNull: true,
        comment: 'Default association route table ID'
      },
      propagationDefaultRouteTableId: {
        type: Sequelize.STRING(21), // tgw-rtb-xxxxxxxxxxxxxxxxx
        allowNull: true,
        comment: 'Default propagation route table ID'
      },
      
      // Transit Gateway CIDR Blocks
      transitGatewayCidrBlocks: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'CIDR blocks assigned to the transit gateway'
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
        comment: 'Transit Gateway name from Name tag'
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
      costCenter: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Cost center for billing'
      },
      owner: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Resource owner or team'
      },
      
      // Network Architecture
      transitGatewayType: {
        type: Sequelize.ENUM('hub', 'spoke', 'inspection'),
        allowNull: true,
        comment: 'Logical role in network architecture'
      },
      isPrimary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Primary transit gateway for the region'
      }
    });

    // Add additional indexes
    await helper.createIndex('transit_gateways', 'awsTransitGatewayId', { unique: true });
    await helper.createIndex('transit_gateways', 'awsAccountId');
    await helper.createIndex('transit_gateways', 'region');
    await helper.createIndex('transit_gateways', ['awsAccountId', 'region']);
    await helper.createIndex('transit_gateways', 'state');
    await helper.createIndex('transit_gateways', 'environment');
    await helper.createIndex('transit_gateways', 'transitGatewayType');
    await helper.createIndex('transit_gateways', 'isPrimary');
    await helper.createIndex('transit_gateways', 'amazonSideAsn');
    await helper.createIndex('transit_gateways', 'lastSyncAt');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('transit_gateways');
  }
};