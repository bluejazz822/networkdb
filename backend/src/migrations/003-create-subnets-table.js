'use strict';

const { createMigrationHelper } = require('../utils/migration-helper');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const helper = createMigrationHelper(queryInterface);

    await helper.createTableWithCommonFields('subnets', {
      // AWS Identifiers
      awsSubnetId: {
        type: Sequelize.STRING(21), // subnet-xxxxxxxxxxxxxxxxx
        allowNull: false,
        unique: true
      },
      awsVpcId: {
        type: Sequelize.STRING(21), // vpc-xxxxxxxxxxxxxxxxx
        allowNull: false
      },
      awsAccountId: {
        type: Sequelize.STRING(12),
        allowNull: false
      },
      
      // Relationships
      vpcId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'vpcs',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      
      // Network Configuration
      cidrBlock: {
        type: Sequelize.STRING(18), // xxx.xxx.xxx.xxx/xx
        allowNull: false
      },
      availableIpAddressCount: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      
      // Location
      availabilityZone: {
        type: Sequelize.STRING(20),
        allowNull: false
      },
      availabilityZoneId: {
        type: Sequelize.STRING(20),
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
      
      // Configuration
      mapPublicIpOnLaunch: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      assignIpv6AddressOnCreation: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      isDefault: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      },
      
      // IPv6 Configuration
      ipv6CidrBlockAssociationSet: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'IPv6 CIDR block associations'
      },
      
      // Route Table Association
      routeTableId: {
        type: Sequelize.STRING(21), // rtb-xxxxxxxxxxxxxxxxx
        allowNull: true,
        comment: 'Associated route table ID'
      },
      
      // Network ACL Association
      networkAclId: {
        type: Sequelize.STRING(21), // acl-xxxxxxxxxxxxxxxxx
        allowNull: true,
        comment: 'Associated network ACL ID'
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
        comment: 'Subnet name from Name tag'
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
      subnetType: {
        type: Sequelize.ENUM('public', 'private', 'isolated'),
        allowNull: true,
        comment: 'Logical subnet type based on routing'
      },
      tier: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Application tier (web, app, db, etc.)'
      },
      owner: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Resource owner or team'
      }
    });

    // Add additional indexes
    await helper.createIndex('subnets', 'awsSubnetId', { unique: true });
    await helper.createIndex('subnets', 'awsVpcId');
    await helper.createIndex('subnets', 'vpcId');
    await helper.createIndex('subnets', 'awsAccountId');
    await helper.createIndex('subnets', 'availabilityZone');
    await helper.createIndex('subnets', ['awsVpcId', 'availabilityZone']);
    await helper.createIndex('subnets', 'state');
    await helper.createIndex('subnets', 'isDefault');
    await helper.createIndex('subnets', 'mapPublicIpOnLaunch');
    await helper.createIndex('subnets', 'subnetType');
    await helper.createIndex('subnets', 'environment');
    await helper.createIndex('subnets', 'lastSyncAt');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('subnets');
  }
};