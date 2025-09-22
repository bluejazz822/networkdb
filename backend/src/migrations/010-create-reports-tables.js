'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Creating reports system tables...');

    // Create reports table for report metadata and configuration
    await queryInterface.createTable('reports', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      report_id: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false,
        comment: 'Unique identifier for the report'
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
          'cost_optimization',
          'compliance_audit',
          'network_topology',
          'resource_usage',
          'performance_metrics',
          'custom'
        ),
        allowNull: false,
        comment: 'Type/category of the report'
      },
      category: {
        type: Sequelize.ENUM(
          'infrastructure',
          'security',
          'compliance',
          'cost',
          'performance',
          'operational'
        ),
        allowNull: false,
        comment: 'Report category for grouping and filtering'
      },
      provider: {
        type: Sequelize.ENUM('aws', 'azure', 'gcp', 'ali', 'oci', 'huawei', 'others', 'multi_cloud'),
        allowNull: false,
        defaultValue: 'multi_cloud',
        comment: 'Cloud provider scope for the report'
      },
      query_config: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'JSON configuration for report queries and parameters'
      },
      output_format: {
        type: Sequelize.ENUM('json', 'csv', 'excel', 'pdf', 'html'),
        allowNull: false,
        defaultValue: 'json',
        comment: 'Default output format for the report'
      },
      scheduling_config: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'JSON configuration for report scheduling (cron, frequency, etc.)'
      },
      notification_config: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'JSON configuration for notifications (email, slack, etc.)'
      },
      parameters_schema: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'JSON schema defining available parameters for the report'
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether the report is active and available for execution'
      },
      is_public: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
        comment: 'Whether the report is visible to all users'
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL',
        comment: 'User who created the report'
      },
      last_modified_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL',
        comment: 'User who last modified the report'
      },
      version: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        allowNull: false,
        comment: 'Version number for report configuration tracking'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Timestamp when the report was created'
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
        comment: 'Timestamp when the report was last updated'
      }
    });

    // Create report_executions table for execution history and status tracking
    await queryInterface.createTable('report_executions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      execution_id: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false,
        comment: 'Unique identifier for the execution instance'
      },
      report_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        references: {
          model: 'reports',
          key: 'report_id'
        },
        onDelete: 'CASCADE',
        comment: 'Reference to the report being executed'
      },
      status: {
        type: Sequelize.ENUM('pending', 'running', 'completed', 'failed', 'cancelled', 'timeout'),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Current status of the report execution'
      },
      trigger_type: {
        type: Sequelize.ENUM('manual', 'scheduled', 'api', 'webhook'),
        allowNull: false,
        defaultValue: 'manual',
        comment: 'How the report execution was triggered'
      },
      started_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'SET NULL',
        comment: 'User who initiated the execution (null for scheduled)'
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When the execution started'
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
      execution_parameters: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Parameters used for this specific execution'
      },
      result_summary: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Summary of execution results (record counts, key metrics, etc.)'
      },
      output_location: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Storage location of the generated report output'
      },
      output_size_bytes: {
        type: Sequelize.BIGINT,
        allowNull: true,
        comment: 'Size of the generated output in bytes'
      },
      records_processed: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
        comment: 'Number of records processed during execution'
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Error message if execution failed'
      },
      error_details: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Detailed error information including stack traces'
      },
      execution_metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional metadata about the execution environment'
      },
      retention_until: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When this execution record should be cleaned up'
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'Timestamp when the execution record was created'
      }
    });

    // Create comprehensive indexes for query performance optimization
    console.log('Creating indexes for reports table...');

    // Primary access patterns for reports
    await queryInterface.addIndex('reports', ['report_id'], {
      unique: true,
      name: 'idx_reports_report_id'
    });
    await queryInterface.addIndex('reports', ['report_type'], {
      name: 'idx_reports_type'
    });
    await queryInterface.addIndex('reports', ['category'], {
      name: 'idx_reports_category'
    });
    await queryInterface.addIndex('reports', ['provider'], {
      name: 'idx_reports_provider'
    });
    await queryInterface.addIndex('reports', ['is_active'], {
      name: 'idx_reports_active'
    });
    await queryInterface.addIndex('reports', ['is_public'], {
      name: 'idx_reports_public'
    });
    await queryInterface.addIndex('reports', ['created_by'], {
      name: 'idx_reports_created_by'
    });

    // Composite indexes for common filtering patterns
    await queryInterface.addIndex('reports', ['report_type', 'provider'], {
      name: 'idx_reports_type_provider'
    });
    await queryInterface.addIndex('reports', ['category', 'is_active'], {
      name: 'idx_reports_category_active'
    });
    await queryInterface.addIndex('reports', ['is_active', 'is_public'], {
      name: 'idx_reports_active_public'
    });

    // Time-based indexes
    await queryInterface.addIndex('reports', ['created_at'], {
      name: 'idx_reports_created_at'
    });
    await queryInterface.addIndex('reports', ['updated_at'], {
      name: 'idx_reports_updated_at'
    });

    console.log('Creating indexes for report_executions table...');

    // Primary access patterns for executions
    await queryInterface.addIndex('report_executions', ['execution_id'], {
      unique: true,
      name: 'idx_executions_execution_id'
    });
    await queryInterface.addIndex('report_executions', ['report_id'], {
      name: 'idx_executions_report_id'
    });
    await queryInterface.addIndex('report_executions', ['status'], {
      name: 'idx_executions_status'
    });
    await queryInterface.addIndex('report_executions', ['trigger_type'], {
      name: 'idx_executions_trigger_type'
    });
    await queryInterface.addIndex('report_executions', ['started_by'], {
      name: 'idx_executions_started_by'
    });

    // Time-based indexes for execution monitoring
    await queryInterface.addIndex('report_executions', ['start_time'], {
      name: 'idx_executions_start_time'
    });
    await queryInterface.addIndex('report_executions', ['end_time'], {
      name: 'idx_executions_end_time'
    });
    await queryInterface.addIndex('report_executions', ['created_at'], {
      name: 'idx_executions_created_at'
    });

    // Composite indexes for common query patterns
    await queryInterface.addIndex('report_executions', ['report_id', 'status'], {
      name: 'idx_executions_report_status'
    });
    await queryInterface.addIndex('report_executions', ['report_id', 'start_time'], {
      name: 'idx_executions_report_start_time'
    });
    await queryInterface.addIndex('report_executions', ['status', 'start_time'], {
      name: 'idx_executions_status_start_time'
    });
    await queryInterface.addIndex('report_executions', ['trigger_type', 'status'], {
      name: 'idx_executions_trigger_status'
    });

    // Performance monitoring indexes
    await queryInterface.addIndex('report_executions', ['duration_ms'], {
      name: 'idx_executions_duration'
    });
    await queryInterface.addIndex('report_executions', ['records_processed'], {
      name: 'idx_executions_records_processed'
    });

    // Cleanup and retention indexes
    await queryInterface.addIndex('report_executions', ['retention_until'], {
      name: 'idx_executions_retention_until'
    });

    console.log('Reports system tables created successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('Dropping reports system tables...');

    // Drop tables in reverse order due to foreign key constraints
    await queryInterface.dropTable('report_executions');
    await queryInterface.dropTable('reports');

    console.log('Reports system tables dropped successfully');
  }
};