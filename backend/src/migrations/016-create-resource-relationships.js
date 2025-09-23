'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Creating resource relationship tables...');

    // Create resource_relationships table for storing resource dependencies
    await queryInterface.createTable('resource_relationships', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      relationship_id: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false,
        comment: 'Unique identifier for the relationship'
      },
      source_resource_type: {
        type: Sequelize.ENUM(
          'vpc',
          'subnet',
          'transit_gateway',
          'transit_gateway_attachment',
          'customer_gateway',
          'vpc_endpoint',
          'route_table',
          'security_group',
          'network_acl',
          'nat_gateway',
          'internet_gateway',
          'vpn_connection',
          'direct_connect',
          'load_balancer',
          'peering_connection'
        ),
        allowNull: false,
        comment: 'Type of the source resource'
      },
      source_resource_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Unique identifier of the source resource'
      },
      source_provider: {
        type: Sequelize.ENUM('aws', 'azure', 'gcp', 'ali', 'oci', 'huawei', 'others'),
        allowNull: false,
        comment: 'Cloud provider of the source resource'
      },
      target_resource_type: {
        type: Sequelize.ENUM(
          'vpc',
          'subnet',
          'transit_gateway',
          'transit_gateway_attachment',
          'customer_gateway',
          'vpc_endpoint',
          'route_table',
          'security_group',
          'network_acl',
          'nat_gateway',
          'internet_gateway',
          'vpn_connection',
          'direct_connect',
          'load_balancer',
          'peering_connection'
        ),
        allowNull: false,
        comment: 'Type of the target resource'
      },
      target_resource_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Unique identifier of the target resource'
      },
      target_provider: {
        type: Sequelize.ENUM('aws', 'azure', 'gcp', 'ali', 'oci', 'huawei', 'others'),
        allowNull: false,
        comment: 'Cloud provider of the target resource'
      },
      relationship_type: {
        type: Sequelize.ENUM(
          'depends_on',
          'contains',
          'routes_to',
          'connects_to',
          'attached_to',
          'peers_with',
          'shares_with',
          'secured_by',
          'load_balances',
          'proxies_to',
          'gateways_to'
        ),
        allowNull: false,
        comment: 'Type of relationship between resources'
      },
      relationship_direction: {
        type: Sequelize.ENUM('unidirectional', 'bidirectional'),
        allowNull: false,
        defaultValue: 'unidirectional',
        comment: 'Direction of the relationship'
      },
      confidence_score: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 1.00,
        comment: 'Confidence score of the relationship (0.00-1.00)'
      },
      discovery_method: {
        type: Sequelize.ENUM(
          'api_discovery',
          'configuration_analysis',
          'traffic_analysis',
          'manual_mapping',
          'inference'
        ),
        allowNull: false,
        comment: 'Method used to discover this relationship'
      },
      relationship_metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional metadata about the relationship'
      },
      strength: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Strength of the relationship (1-10)'
      },
      is_critical: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this relationship is critical for system operation'
      },
      first_discovered: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When this relationship was first discovered'
      },
      last_verified: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When this relationship was last verified'
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive', 'deprecated', 'pending_verification'),
        allowNull: false,
        defaultValue: 'active',
        comment: 'Current status of the relationship'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Create relationship_changes table for tracking relationship history
    await queryInterface.createTable('relationship_changes', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      change_id: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false,
        comment: 'Unique identifier for the change record'
      },
      relationship_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Reference to the relationship'
      },
      change_type: {
        type: Sequelize.ENUM('created', 'updated', 'deleted', 'verified', 'invalidated'),
        allowNull: false,
        comment: 'Type of change that occurred'
      },
      change_reason: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Reason for the change'
      },
      previous_state: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Previous state of the relationship'
      },
      new_state: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'New state of the relationship'
      },
      changed_by: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'User or system that made the change'
      },
      change_metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional metadata about the change'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create relationship_paths table for storing computed dependency paths
    await queryInterface.createTable('relationship_paths', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      path_id: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false,
        comment: 'Unique identifier for the path'
      },
      source_resource_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Starting resource of the path'
      },
      target_resource_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Ending resource of the path'
      },
      path_type: {
        type: Sequelize.ENUM('dependency', 'impact', 'connectivity', 'data_flow'),
        allowNull: false,
        comment: 'Type of path analysis'
      },
      path_depth: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Number of hops in the path'
      },
      path_relationships: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Array of relationship IDs that form this path'
      },
      path_confidence: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        comment: 'Overall confidence score for the path'
      },
      path_strength: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Overall strength score for the path'
      },
      is_critical_path: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this is a critical dependency path'
      },
      computed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When this path was computed'
      },
      expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this path computation expires'
      },
      computation_metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Metadata about the path computation'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Add indexes for performance
    console.log('Creating indexes for resource relationship tables...');

    // resource_relationships indexes
    await queryInterface.addIndex('resource_relationships', ['relationship_id'], {
      name: 'idx_resource_relationships_relationship_id'
    });
    await queryInterface.addIndex('resource_relationships', ['source_resource_type', 'source_resource_id'], {
      name: 'idx_resource_relationships_source'
    });
    await queryInterface.addIndex('resource_relationships', ['target_resource_type', 'target_resource_id'], {
      name: 'idx_resource_relationships_target'
    });
    await queryInterface.addIndex('resource_relationships', ['relationship_type'], {
      name: 'idx_resource_relationships_type'
    });
    await queryInterface.addIndex('resource_relationships', ['source_provider', 'target_provider'], {
      name: 'idx_resource_relationships_providers'
    });
    await queryInterface.addIndex('resource_relationships', ['status'], {
      name: 'idx_resource_relationships_status'
    });
    await queryInterface.addIndex('resource_relationships', ['is_critical'], {
      name: 'idx_resource_relationships_critical'
    });
    await queryInterface.addIndex('resource_relationships', ['last_verified'], {
      name: 'idx_resource_relationships_verified'
    });

    // Composite indexes for common queries
    await queryInterface.addIndex('resource_relationships', ['source_resource_type', 'source_resource_id', 'relationship_type'], {
      name: 'idx_resource_relationships_source_type'
    });
    await queryInterface.addIndex('resource_relationships', ['target_resource_type', 'target_resource_id', 'relationship_type'], {
      name: 'idx_resource_relationships_target_type'
    });

    // relationship_changes indexes
    await queryInterface.addIndex('relationship_changes', ['change_id'], {
      name: 'idx_relationship_changes_change_id'
    });
    await queryInterface.addIndex('relationship_changes', ['relationship_id'], {
      name: 'idx_relationship_changes_relationship_id'
    });
    await queryInterface.addIndex('relationship_changes', ['change_type'], {
      name: 'idx_relationship_changes_type'
    });
    await queryInterface.addIndex('relationship_changes', ['created_at'], {
      name: 'idx_relationship_changes_created_at'
    });

    // relationship_paths indexes
    await queryInterface.addIndex('relationship_paths', ['path_id'], {
      name: 'idx_relationship_paths_path_id'
    });
    await queryInterface.addIndex('relationship_paths', ['source_resource_id'], {
      name: 'idx_relationship_paths_source'
    });
    await queryInterface.addIndex('relationship_paths', ['target_resource_id'], {
      name: 'idx_relationship_paths_target'
    });
    await queryInterface.addIndex('relationship_paths', ['path_type'], {
      name: 'idx_relationship_paths_type'
    });
    await queryInterface.addIndex('relationship_paths', ['is_critical_path'], {
      name: 'idx_relationship_paths_critical'
    });
    await queryInterface.addIndex('relationship_paths', ['expires_at'], {
      name: 'idx_relationship_paths_expires'
    });

    // Composite indexes for path queries
    await queryInterface.addIndex('relationship_paths', ['source_resource_id', 'target_resource_id', 'path_type'], {
      name: 'idx_relationship_paths_source_target_type'
    });

    // Add foreign key constraints
    await queryInterface.addConstraint('relationship_changes', {
      fields: ['relationship_id'],
      type: 'foreign key',
      name: 'fk_relationship_changes_relationship_id',
      references: {
        table: 'resource_relationships',
        field: 'relationship_id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    console.log('✅ Resource relationship tables created successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('Dropping resource relationship tables...');

    // Drop foreign key constraints first
    await queryInterface.removeConstraint('relationship_changes', 'fk_relationship_changes_relationship_id');

    // Drop tables in reverse order
    await queryInterface.dropTable('relationship_paths');
    await queryInterface.dropTable('relationship_changes');
    await queryInterface.dropTable('resource_relationships');

    console.log('✅ Resource relationship tables dropped successfully');
  }
};