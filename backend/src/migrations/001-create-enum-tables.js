'use strict';

const { createMigrationHelper, NetworkResourceStatuses, AwsRegions } = require('../../dist/utils/migration-helper');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const helper = createMigrationHelper(queryInterface);

    // Create resource status enum table
    await helper.createEnumTable('resource_status', NetworkResourceStatuses);

    // Create AWS regions enum table
    await helper.createEnumTable('aws_regions', AwsRegions);

    // Create network resource types enum table
    await helper.createEnumTable('network_resource_types', [
      { key: 'VPC', value: 'VPC', description: 'Virtual Private Cloud' },
      { key: 'SUBNET', value: 'Subnet', description: 'VPC Subnet' },
      { key: 'IGW', value: 'Internet Gateway', description: 'Internet Gateway' },
      { key: 'NAT_GW', value: 'NAT Gateway', description: 'NAT Gateway' },
      { key: 'VPN_GW', value: 'VPN Gateway', description: 'VPN Gateway' },
      { key: 'CGW', value: 'Customer Gateway', description: 'Customer Gateway' },
      { key: 'TGW', value: 'Transit Gateway', description: 'Transit Gateway' },
      { key: 'TGW_ATTACHMENT', value: 'Transit Gateway Attachment', description: 'Transit Gateway Attachment' },
      { key: 'ROUTE_TABLE', value: 'Route Table', description: 'Route Table' },
      { key: 'SECURITY_GROUP', value: 'Security Group', description: 'Security Group' },
      { key: 'NACL', value: 'Network ACL', description: 'Network Access Control List' },
      { key: 'ELB', value: 'Load Balancer', description: 'Elastic Load Balancer' },
      { key: 'ENI', value: 'Network Interface', description: 'Elastic Network Interface' }
    ]);

    // Create connection states enum table
    await helper.createEnumTable('connection_states', [
      { key: 'PENDING', value: 'pending', description: 'Connection is pending' },
      { key: 'AVAILABLE', value: 'available', description: 'Connection is available' },
      { key: 'DELETING', value: 'deleting', description: 'Connection is being deleted' },
      { key: 'DELETED', value: 'deleted', description: 'Connection has been deleted' },
      { key: 'FAILED', value: 'failed', description: 'Connection failed' }
    ]);

    // Create attachment states enum table
    await helper.createEnumTable('attachment_states', [
      { key: 'INITIATING', value: 'initiating', description: 'Attachment is initiating' },
      { key: 'PENDING_ACCEPTANCE', value: 'pendingAcceptance', description: 'Attachment is pending acceptance' },
      { key: 'ROLLING_BACK', value: 'rollingBack', description: 'Attachment is rolling back' },
      { key: 'PENDING', value: 'pending', description: 'Attachment is pending' },
      { key: 'AVAILABLE', value: 'available', description: 'Attachment is available' },
      { key: 'MODIFYING', value: 'modifying', description: 'Attachment is being modified' },
      { key: 'DELETING', value: 'deleting', description: 'Attachment is being deleted' },
      { key: 'DELETED', value: 'deleted', description: 'Attachment has been deleted' },
      { key: 'FAILED', value: 'failed', description: 'Attachment failed' },
      { key: 'REJECTED', value: 'rejected', description: 'Attachment was rejected' }
    ]);
  },

  async down(queryInterface, Sequelize) {
    const helper = createMigrationHelper(queryInterface);

    // Remove enum tables in reverse order
    await helper.removeEnumTable('attachment_states');
    await helper.removeEnumTable('connection_states');
    await helper.removeEnumTable('network_resource_types');
    await helper.removeEnumTable('aws_regions');
    await helper.removeEnumTable('resource_status');
  }
};