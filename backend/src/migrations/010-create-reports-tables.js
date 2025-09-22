'use strict';

const { createMigrationHelper } = require('../utils/migration-helper');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const helper = createMigrationHelper(queryInterface);

    // Create reports table
    await queryInterface.createTable('reports', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      report_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'Unique external identifier for the report'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Human-readable report name'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Detailed description of the report'
      },
      report_type: {
        type: Sequelize.ENUM(
          'vpc_inventory',
          'subnet_utilization',
          'security_group_analysis',
          'cost_analysis',
          'compliance_report',
          'connectivity_matrix',
          'resource_usage',
          'performance_metrics',
          'audit_trail',
          'custom_query'
        ),
        allowNull: false,
        comment: 'Type of report being generated'
      },
      category: {
        type: Sequelize.ENUM(
          'infrastructure',
          'security',
          'compliance',
          'cost',
          'performance',
          'operational',
          'audit'
        ),
        allowNull: false,
        comment: 'Report category for organization'
      },
      provider: {
        type: Sequelize.ENUM(
          'aws',
          'azure',
          'gcp',
          'oci',
          'multi_cloud',
          'all'
        ),
        allowNull: false,
        defaultValue: 'all',
        comment: 'Cloud provider scope for the report'
      },
      query_config: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'SQL query configuration and parameters'
      },
      scheduling_config: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Automated scheduling configuration'
      },
      notification_config: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Notification settings for report completion'
      },
      parameters_schema: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'JSON schema for report parameters validation'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the report is active and available for execution'
      },
      is_public: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether the report is visible to all users'
      },
      created_by: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'User who created this report'
      },
      last_modified_by: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'User who last modified this report'
      },
      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Version number for configuration changes'
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
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB',
      comment: 'Reports metadata, configuration, and scheduling information'
    });

    // Create report_executions table
    await queryInterface.createTable('report_executions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      execution_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'Unique external identifier for the execution'
      },
      report_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Foreign key to reports table'
      },
      status: {
        type: Sequelize.ENUM(
          'pending',
          'running',
          'completed',
          'failed',
          'cancelled',
          'timeout'
        ),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Current status of the report execution'
      },
      trigger_type: {
        type: Sequelize.ENUM(
          'manual',
          'scheduled',
          'api',
          'webhook'
        ),
        allowNull: false,
        comment: 'How the report execution was triggered'
      },
      started_by: {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'User who started this execution (null for automated)'
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the execution actually started'
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When the execution completed or failed'
      },
      duration_ms: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Execution duration in milliseconds'
      },
      records_processed: {
        type: Sequelize.BIGINT,
        allowNull: true,
        comment: 'Number of records processed during execution'
      },
      output_size_bytes: {
        type: Sequelize.BIGINT,
        allowNull: true,
        comment: 'Size of the generated report output in bytes'
      },
      execution_parameters: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Parameters used for this specific execution'
      },
      result_summary: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Summary of execution results and statistics'
      },
      error_details: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Error information if execution failed'
      },
      output_location: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'File path or URL where report output is stored'
      },
      retention_until: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this execution record should be cleaned up'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB',
      comment: 'Report execution history and status tracking'
    });

    // Add foreign key constraints
    await queryInterface.addConstraint('reports', {
      fields: ['created_by'],
      type: 'foreign key',
      name: 'fk_reports_created_by',
      references: {
        table: 'users',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addConstraint('reports', {
      fields: ['last_modified_by'],
      type: 'foreign key',
      name: 'fk_reports_last_modified_by',
      references: {
        table: 'users',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await queryInterface.addConstraint('report_executions', {
      fields: ['report_id'],
      type: 'foreign key',
      name: 'fk_report_executions_report_id',
      references: {
        table: 'reports',
        field: 'report_id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await queryInterface.addConstraint('report_executions', {
      fields: ['started_by'],
      type: 'foreign key',
      name: 'fk_report_executions_started_by',
      references: {
        table: 'users',
        field: 'id'
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Create comprehensive indexes for reports table
    await queryInterface.addIndex('reports', {
      fields: ['report_id'],
      name: 'idx_reports_report_id',
      unique: true
    });

    await queryInterface.addIndex('reports', {
      fields: ['report_type'],
      name: 'idx_reports_type'
    });

    await queryInterface.addIndex('reports', {
      fields: ['category'],
      name: 'idx_reports_category'
    });

    await queryInterface.addIndex('reports', {
      fields: ['provider'],
      name: 'idx_reports_provider'
    });

    await queryInterface.addIndex('reports', {
      fields: ['is_active'],
      name: 'idx_reports_is_active'
    });

    await queryInterface.addIndex('reports', {
      fields: ['is_public'],
      name: 'idx_reports_is_public'
    });

    await queryInterface.addIndex('reports', {
      fields: ['created_by'],
      name: 'idx_reports_created_by'
    });

    await queryInterface.addIndex('reports', {
      fields: ['created_at'],
      name: 'idx_reports_created_at'
    });

    await queryInterface.addIndex('reports', {
      fields: ['updated_at'],
      name: 'idx_reports_updated_at'
    });

    // Composite indexes for common query patterns
    await queryInterface.addIndex('reports', {
      fields: ['report_type', 'provider'],
      name: 'idx_reports_type_provider'
    });

    await queryInterface.addIndex('reports', {
      fields: ['category', 'is_active'],
      name: 'idx_reports_category_active'
    });

    await queryInterface.addIndex('reports', {
      fields: ['created_by', 'is_active'],
      name: 'idx_reports_created_by_active'
    });

    // Create comprehensive indexes for report_executions table
    await queryInterface.addIndex('report_executions', {
      fields: ['execution_id'],
      name: 'idx_executions_execution_id',
      unique: true
    });

    await queryInterface.addIndex('report_executions', {
      fields: ['report_id'],
      name: 'idx_executions_report_id'
    });

    await queryInterface.addIndex('report_executions', {
      fields: ['status'],
      name: 'idx_executions_status'
    });

    await queryInterface.addIndex('report_executions', {
      fields: ['trigger_type'],
      name: 'idx_executions_trigger_type'
    });

    await queryInterface.addIndex('report_executions', {
      fields: ['started_by'],
      name: 'idx_executions_started_by'
    });

    await queryInterface.addIndex('report_executions', {
      fields: ['start_time'],
      name: 'idx_executions_start_time'
    });

    await queryInterface.addIndex('report_executions', {
      fields: ['end_time'],
      name: 'idx_executions_end_time'
    });

    await queryInterface.addIndex('report_executions', {
      fields: ['created_at'],
      name: 'idx_executions_created_at'
    });

    await queryInterface.addIndex('report_executions', {
      fields: ['retention_until'],
      name: 'idx_executions_retention_until'
    });

    // Composite indexes for monitoring and reporting queries
    await queryInterface.addIndex('report_executions', {
      fields: ['report_id', 'status'],
      name: 'idx_executions_report_status'
    });

    await queryInterface.addIndex('report_executions', {
      fields: ['report_id', 'start_time'],
      name: 'idx_executions_report_start_time'
    });

    await queryInterface.addIndex('report_executions', {
      fields: ['status', 'start_time'],
      name: 'idx_executions_status_start_time'
    });

    await queryInterface.addIndex('report_executions', {
      fields: ['started_by', 'start_time'],
      name: 'idx_executions_started_by_start_time'
    });
  },

  async down(queryInterface, Sequelize) {
    // Drop tables in reverse order (child tables first)
    await queryInterface.dropTable('report_executions');
    await queryInterface.dropTable('reports');
  }
};