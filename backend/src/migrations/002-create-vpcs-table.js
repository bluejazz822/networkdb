'use strict';

const { createMigrationHelper } = require('../../dist/utils/migration-helper');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const helper = createMigrationHelper(queryInterface);

    await helper.createTableWithCommonFields('vpcs', {
      // AWS Identifiers
      awsVpcId: {
        type: Sequelize.STRING(21), // vpc-xxxxxxxxxxxxxxxxx
        allowNull: false,
        unique: true
      },
      awsAccountId: {
        type: Sequelize.STRING(12),
        allowNull: false
      },
      
      // Basic VPC Information
      cidrBlock: {
        type: Sequelize.STRING(18), // xxx.xxx.xxx.xxx/xx
        allowNull: false
      },
      cidrBlockAssociationSet: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional CIDR blocks associated with VPC'
      },
      dhcpOptionsId: {
        type: Sequelize.STRING(21), // dopt-xxxxxxxxxxxxxxxxx
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
      availabilityZones: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'List of availability zones in this VPC'
      },
      
      // Configuration
      isDefault: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      instanceTenancy: {
        type: Sequelize.ENUM('default', 'dedicated', 'host'),
        allowNull: false,
        defaultValue: 'default'
      },
      enableDnsHostnames: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      enableDnsSupport: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      
      // Network Configuration
      enableNetworkAddressUsageMetrics: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
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
        comment: 'VPC name from Name tag'
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
      }
    });

    // Add additional indexes
    await helper.createIndex('vpcs', 'awsVpcId', { unique: true });
    await helper.createIndex('vpcs', 'awsAccountId');
    await helper.createIndex('vpcs', 'region');
    await helper.createIndex('vpcs', ['awsAccountId', 'region']);
    await helper.createIndex('vpcs', 'state');
    await helper.createIndex('vpcs', 'isDefault');
    await helper.createIndex('vpcs', 'environment');
    await helper.createIndex('vpcs', 'project');
    await helper.createIndex('vpcs', 'lastSyncAt');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('vpcs');
  }
};