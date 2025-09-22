'use strict';

const { createMigrationHelper } = require('../../dist/utils/migration-helper');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const helper = createMigrationHelper(queryInterface);

    await helper.createTableWithCommonFields('vpc_endpoints', {
      // AWS Identifiers
      awsVpcEndpointId: {
        type: Sequelize.STRING(21), // vpce-xxxxxxxxxxxxxxxxx
        allowNull: false,
        unique: true
      },
      awsAccountId: {
        type: Sequelize.STRING(12),
        allowNull: false
      },
      
      // VPC Association
      vpcId: {
        type: Sequelize.STRING(21), // vpc-xxxxxxxxxxxxxxxxx
        allowNull: false
      },
      
      // Service Information
      serviceName: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'AWS service name (e.g., com.amazonaws.us-east-1.s3)'
      },
      serviceType: {
        type: Sequelize.ENUM('Interface', 'Gateway', 'GatewayLoadBalancer'),
        allowNull: false
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
      
      // Network Configuration
      subnetIds: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array of subnet IDs for interface endpoints'
      },
      routeTableIds: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array of route table IDs for gateway endpoints'
      },
      securityGroupIds: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array of security group IDs for interface endpoints'
      },
      
      // DNS Configuration
      dnsOptions: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'DNS options including private DNS enabled'
      },
      privateDnsEnabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether private DNS is enabled for interface endpoints'
      },
      dnsEntries: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'DNS entries for the VPC endpoint'
      },
      
      // Policy Configuration
      policyDocument: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'JSON policy document for the VPC endpoint'
      },
      
      // Network Interface Information (for Interface endpoints)
      networkInterfaceIds: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array of network interface IDs'
      },
      
      // Prefix List Information (for Gateway endpoints)
      prefixListId: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Prefix list ID for gateway endpoints'
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
        comment: 'VPC Endpoint name from Name tag'
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
      
      // Operational Information
      acceptanceRequired: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether acceptance is required for the endpoint'
      },
      managedByAws: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the endpoint is managed by AWS'
      }
    });

    // Add additional indexes
    await helper.createIndex('vpc_endpoints', 'awsVpcEndpointId', { unique: true });
    await helper.createIndex('vpc_endpoints', 'awsAccountId');
    await helper.createIndex('vpc_endpoints', 'region');
    await helper.createIndex('vpc_endpoints', 'vpcId');
    await helper.createIndex('vpc_endpoints', 'serviceName');
    await helper.createIndex('vpc_endpoints', 'serviceType');
    await helper.createIndex('vpc_endpoints', ['awsAccountId', 'region']);
    await helper.createIndex('vpc_endpoints', 'state');
    await helper.createIndex('vpc_endpoints', 'environment');
    await helper.createIndex('vpc_endpoints', 'project');
    await helper.createIndex('vpc_endpoints', 'privateDnsEnabled');
    await helper.createIndex('vpc_endpoints', 'lastSyncAt');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('vpc_endpoints');
  }
};