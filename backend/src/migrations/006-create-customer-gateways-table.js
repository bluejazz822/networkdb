'use strict';

const { createMigrationHelper } = require('../../dist/utils/migration-helper');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const helper = createMigrationHelper(queryInterface);

    await helper.createTableWithCommonFields('customer_gateways', {
      // AWS Identifiers
      awsCustomerGatewayId: {
        type: Sequelize.STRING(21), // cgw-xxxxxxxxxxxxxxxxx
        allowNull: false,
        unique: true
      },
      awsAccountId: {
        type: Sequelize.STRING(12),
        allowNull: false
      },
      
      // Basic Configuration
      type: {
        type: Sequelize.ENUM('ipsec.1'),
        allowNull: false,
        defaultValue: 'ipsec.1'
      },
      ipAddress: {
        type: Sequelize.STRING(15), // IPv4 address
        allowNull: false,
        comment: 'Public IP address of the customer gateway'
      },
      bgpAsn: {
        type: Sequelize.BIGINT,
        allowNull: false,
        comment: 'Border Gateway Protocol (BGP) Autonomous System Number'
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
      
      // Device Configuration
      deviceName: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Name of the customer gateway device'
      },
      deviceModel: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Model of the customer gateway device'
      },
      deviceVendor: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Vendor of the customer gateway device'
      },
      deviceSoftwareVersion: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Software version running on the device'
      },
      
      // Network Configuration
      insideIpv4NetworkCidr: {
        type: Sequelize.STRING(18),
        allowNull: true,
        comment: 'Inside IPv4 CIDR block for BGP peering'
      },
      outsideIpAddress: {
        type: Sequelize.STRING(15),
        allowNull: true,
        comment: 'Outside IP address for the customer gateway'
      },
      
      // Certificate-based Authentication
      certificateArn: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'ARN of the certificate for certificate-based authentication'
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
        comment: 'Customer Gateway name from Name tag'
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
      
      // Physical Location
      siteLocation: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Physical location of the customer gateway'
      },
      siteAddress: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Physical address of the customer gateway'
      },
      contactPerson: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Contact person for this customer gateway'
      },
      contactPhone: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Contact phone number'
      },
      contactEmail: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Contact email address'
      },
      
      // Operational Information
      maintenanceWindow: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Scheduled maintenance window'
      },
      isPrimary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Primary customer gateway for the site'
      },
      redundancyGroup: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Redundancy group identifier'
      }
    });

    // Add additional indexes
    await helper.createIndex('customer_gateways', 'awsCustomerGatewayId', { unique: true });
    await helper.createIndex('customer_gateways', 'awsAccountId');
    await helper.createIndex('customer_gateways', 'region');
    await helper.createIndex('customer_gateways', 'ipAddress');
    await helper.createIndex('customer_gateways', 'bgpAsn');
    await helper.createIndex('customer_gateways', ['awsAccountId', 'region']);
    await helper.createIndex('customer_gateways', 'state');
    await helper.createIndex('customer_gateways', 'environment');
    await helper.createIndex('customer_gateways', 'siteLocation');
    await helper.createIndex('customer_gateways', 'isPrimary');
    await helper.createIndex('customer_gateways', 'redundancyGroup');
    await helper.createIndex('customer_gateways', 'lastSyncAt');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('customer_gateways');
  }
};