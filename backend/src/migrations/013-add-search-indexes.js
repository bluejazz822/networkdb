'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Adding search optimization indexes...');

    // VPC search indexes
    await queryInterface.addIndex('Vpcs', ['name'], {
      name: 'idx_vpcs_name_search',
      comment: 'Index for VPC name searches'
    });

    await queryInterface.addIndex('Vpcs', ['vpcId'], {
      name: 'idx_vpcs_vpc_id_search',
      comment: 'Index for VPC ID searches'
    });

    await queryInterface.addIndex('Vpcs', ['region', 'state'], {
      name: 'idx_vpcs_region_state',
      comment: 'Composite index for region and state filtering'
    });

    await queryInterface.addIndex('Vpcs', ['environment'], {
      name: 'idx_vpcs_environment',
      comment: 'Index for environment filtering'
    });

    await queryInterface.addIndex('Vpcs', ['owner'], {
      name: 'idx_vpcs_owner',
      comment: 'Index for owner filtering'
    });

    await queryInterface.addIndex('Vpcs', ['awsAccountId'], {
      name: 'idx_vpcs_account_id',
      comment: 'Index for AWS account filtering'
    });

    // Try to add full-text index for VPCs (MySQL 5.6+)
    try {
      await queryInterface.sequelize.query(`
        CREATE FULLTEXT INDEX idx_vpcs_fulltext 
        ON Vpcs (name, vpcId)
      `);
      console.log('Added full-text index for VPCs');
    } catch (error) {
      console.warn('Could not create full-text index for VPCs:', error.message);
    }

    // Transit Gateway search indexes
    await queryInterface.addIndex('TransitGateways', ['name'], {
      name: 'idx_tgw_name_search',
      comment: 'Index for Transit Gateway name searches'
    });

    await queryInterface.addIndex('TransitGateways', ['transitGatewayId'], {
      name: 'idx_tgw_id_search',
      comment: 'Index for Transit Gateway ID searches'
    });

    await queryInterface.addIndex('TransitGateways', ['region', 'state'], {
      name: 'idx_tgw_region_state',
      comment: 'Composite index for region and state filtering'
    });

    await queryInterface.addIndex('TransitGateways', ['environment'], {
      name: 'idx_tgw_environment',
      comment: 'Index for environment filtering'
    });

    await queryInterface.addIndex('TransitGateways', ['owner'], {
      name: 'idx_tgw_owner',
      comment: 'Index for owner filtering'
    });

    // Try to add full-text index for Transit Gateways
    try {
      await queryInterface.sequelize.query(`
        CREATE FULLTEXT INDEX idx_tgw_fulltext 
        ON TransitGateways (name, transitGatewayId)
      `);
      console.log('Added full-text index for Transit Gateways');
    } catch (error) {
      console.warn('Could not create full-text index for Transit Gateways:', error.message);
    }

    // Customer Gateway search indexes
    await queryInterface.addIndex('CustomerGateways', ['name'], {
      name: 'idx_cgw_name_search',
      comment: 'Index for Customer Gateway name searches'
    });

    await queryInterface.addIndex('CustomerGateways', ['customerGatewayId'], {
      name: 'idx_cgw_id_search',
      comment: 'Index for Customer Gateway ID searches'
    });

    await queryInterface.addIndex('CustomerGateways', ['ipAddress'], {
      name: 'idx_cgw_ip_address',
      comment: 'Index for IP address searches'
    });

    await queryInterface.addIndex('CustomerGateways', ['region', 'state'], {
      name: 'idx_cgw_region_state',
      comment: 'Composite index for region and state filtering'
    });

    await queryInterface.addIndex('CustomerGateways', ['environment'], {
      name: 'idx_cgw_environment',
      comment: 'Index for environment filtering'
    });

    await queryInterface.addIndex('CustomerGateways', ['type'], {
      name: 'idx_cgw_type',
      comment: 'Index for gateway type filtering'
    });

    // Try to add full-text index for Customer Gateways
    try {
      await queryInterface.sequelize.query(`
        CREATE FULLTEXT INDEX idx_cgw_fulltext 
        ON CustomerGateways (name, customerGatewayId, ipAddress)
      `);
      console.log('Added full-text index for Customer Gateways');
    } catch (error) {
      console.warn('Could not create full-text index for Customer Gateways:', error.message);
    }

    // VPC Endpoint search indexes
    await queryInterface.addIndex('VpcEndpoints', ['serviceName'], {
      name: 'idx_vpce_service_name',
      comment: 'Index for service name searches'
    });

    await queryInterface.addIndex('VpcEndpoints', ['vpcEndpointId'], {
      name: 'idx_vpce_id_search',
      comment: 'Index for VPC Endpoint ID searches'
    });

    await queryInterface.addIndex('VpcEndpoints', ['vpcId'], {
      name: 'idx_vpce_vpc_id',
      comment: 'Index for VPC ID filtering'
    });

    await queryInterface.addIndex('VpcEndpoints', ['region', 'state'], {
      name: 'idx_vpce_region_state',
      comment: 'Composite index for region and state filtering'
    });

    await queryInterface.addIndex('VpcEndpoints', ['vpcEndpointType'], {
      name: 'idx_vpce_type',
      comment: 'Index for endpoint type filtering'
    });

    await queryInterface.addIndex('VpcEndpoints', ['environment'], {
      name: 'idx_vpce_environment',
      comment: 'Index for environment filtering'
    });

    // Try to add full-text index for VPC Endpoints
    try {
      await queryInterface.sequelize.query(`
        CREATE FULLTEXT INDEX idx_vpce_fulltext 
        ON VpcEndpoints (serviceName, vpcEndpointId)
      `);
      console.log('Added full-text index for VPC Endpoints');
    } catch (error) {
      console.warn('Could not create full-text index for VPC Endpoints:', error.message);
    }

    // Common indexes for all tables (timestamps for sorting)
    const tables = ['Vpcs', 'TransitGateways', 'CustomerGateways', 'VpcEndpoints'];
    
    for (const table of tables) {
      try {
        await queryInterface.addIndex(table, ['createdAt'], {
          name: `idx_${table.toLowerCase()}_created_at`,
          comment: 'Index for created date sorting'
        });

        await queryInterface.addIndex(table, ['updatedAt'], {
          name: `idx_${table.toLowerCase()}_updated_at`,
          comment: 'Index for updated date sorting'
        });
      } catch (error) {
        console.warn(`Could not add timestamp indexes for ${table}:`, error.message);
      }
    }

    // Add JSON indexes for tags if MySQL 5.7+
    for (const table of tables) {
      try {
        // MySQL 5.7+ supports generated columns and indexes on JSON
        await queryInterface.sequelize.query(`
          ALTER TABLE ${table} 
          ADD COLUMN tags_generated VARCHAR(1000) 
          GENERATED ALWAYS AS (JSON_UNQUOTE(JSON_EXTRACT(tags, '$'))) STORED
        `);
        
        await queryInterface.addIndex(table, ['tags_generated'], {
          name: `idx_${table.toLowerCase()}_tags_generated`,
          comment: 'Index for tags JSON searches'
        });
        
        console.log(`Added JSON tags index for ${table}`);
      } catch (error) {
        console.warn(`Could not add JSON tags index for ${table}:`, error.message);
      }
    }

    console.log('Search optimization indexes added successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('Removing search optimization indexes...');

    const tables = ['Vpcs', 'TransitGateways', 'CustomerGateways', 'VpcEndpoints'];

    // Remove JSON generated columns and indexes
    for (const table of tables) {
      try {
        await queryInterface.removeIndex(table, `idx_${table.toLowerCase()}_tags_generated`);
        await queryInterface.sequelize.query(`
          ALTER TABLE ${table} DROP COLUMN tags_generated
        `);
      } catch (error) {
        console.warn(`Could not remove JSON tags index for ${table}:`, error.message);
      }
    }

    // Remove timestamp indexes
    for (const table of tables) {
      try {
        await queryInterface.removeIndex(table, `idx_${table.toLowerCase()}_created_at`);
        await queryInterface.removeIndex(table, `idx_${table.toLowerCase()}_updated_at`);
      } catch (error) {
        console.warn(`Could not remove timestamp indexes for ${table}:`, error.message);
      }
    }

    // Remove full-text indexes
    try {
      await queryInterface.sequelize.query('DROP INDEX idx_vpce_fulltext ON VpcEndpoints');
      await queryInterface.sequelize.query('DROP INDEX idx_cgw_fulltext ON CustomerGateways');
      await queryInterface.sequelize.query('DROP INDEX idx_tgw_fulltext ON TransitGateways');
      await queryInterface.sequelize.query('DROP INDEX idx_vpcs_fulltext ON Vpcs');
    } catch (error) {
      console.warn('Could not remove full-text indexes:', error.message);
    }

    // Remove VPC Endpoint indexes
    await queryInterface.removeIndex('VpcEndpoints', 'idx_vpce_environment');
    await queryInterface.removeIndex('VpcEndpoints', 'idx_vpce_type');
    await queryInterface.removeIndex('VpcEndpoints', 'idx_vpce_region_state');
    await queryInterface.removeIndex('VpcEndpoints', 'idx_vpce_vpc_id');
    await queryInterface.removeIndex('VpcEndpoints', 'idx_vpce_id_search');
    await queryInterface.removeIndex('VpcEndpoints', 'idx_vpce_service_name');

    // Remove Customer Gateway indexes
    await queryInterface.removeIndex('CustomerGateways', 'idx_cgw_type');
    await queryInterface.removeIndex('CustomerGateways', 'idx_cgw_environment');
    await queryInterface.removeIndex('CustomerGateways', 'idx_cgw_region_state');
    await queryInterface.removeIndex('CustomerGateways', 'idx_cgw_ip_address');
    await queryInterface.removeIndex('CustomerGateways', 'idx_cgw_id_search');
    await queryInterface.removeIndex('CustomerGateways', 'idx_cgw_name_search');

    // Remove Transit Gateway indexes
    await queryInterface.removeIndex('TransitGateways', 'idx_tgw_owner');
    await queryInterface.removeIndex('TransitGateways', 'idx_tgw_environment');
    await queryInterface.removeIndex('TransitGateways', 'idx_tgw_region_state');
    await queryInterface.removeIndex('TransitGateways', 'idx_tgw_id_search');
    await queryInterface.removeIndex('TransitGateways', 'idx_tgw_name_search');

    // Remove VPC indexes
    await queryInterface.removeIndex('Vpcs', 'idx_vpcs_account_id');
    await queryInterface.removeIndex('Vpcs', 'idx_vpcs_owner');
    await queryInterface.removeIndex('Vpcs', 'idx_vpcs_environment');
    await queryInterface.removeIndex('Vpcs', 'idx_vpcs_region_state');
    await queryInterface.removeIndex('Vpcs', 'idx_vpcs_vpc_id_search');
    await queryInterface.removeIndex('Vpcs', 'idx_vpcs_name_search');

    console.log('Search optimization indexes removed successfully');
  }
};