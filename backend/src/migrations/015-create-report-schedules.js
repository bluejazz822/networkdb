'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Creating report scheduling tables...');

    // Create report_schedules table for scheduled report configuration
    await queryInterface.createTable('report_schedules', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      schedule_id: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false,
        comment: 'Unique identifier for the schedule'
      },
      report_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Reference to the report to be generated'
      },
      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Human-readable schedule name'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Description of the schedule'
      },
      cron_expression: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Cron expression for schedule timing'
      },
      timezone: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: 'UTC',
        comment: 'Timezone for schedule execution'
      },
      enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether the schedule is active'
      },
      delivery_config: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Delivery configuration (email, storage, API endpoints)'
      },
      report_config: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Report-specific configuration overrides'
      },
      retry_config: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Retry configuration for failed executions'
      },
      next_execution: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Next scheduled execution time'
      },
      last_execution: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last execution time'
      },
      execution_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total number of executions'
      },
      failure_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of failed executions'
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
      },
      created_by: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'User who created the schedule'
      },
      updated_by: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'User who last updated the schedule'
      }
    });

    // Create schedule_executions table for execution history
    await queryInterface.createTable('schedule_executions', {
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
        comment: 'Unique identifier for the execution'
      },
      schedule_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Reference to the schedule'
      },
      report_execution_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Reference to the actual report execution'
      },
      status: {
        type: Sequelize.ENUM(
          'pending',
          'running',
          'completed',
          'failed',
          'cancelled',
          'retrying'
        ),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Execution status'
      },
      scheduled_time: {
        type: Sequelize.DATE,
        allowNull: false,
        comment: 'Originally scheduled execution time'
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Actual start time'
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Execution completion time'
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Execution duration in milliseconds'
      },
      retry_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of retry attempts'
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Error message if execution failed'
      },
      execution_metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional execution metadata'
      },
      delivery_status: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Status of delivery attempts'
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

    // Create delivery_logs table for delivery tracking
    await queryInterface.createTable('delivery_logs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      log_id: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false,
        comment: 'Unique identifier for the delivery log'
      },
      execution_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Reference to the schedule execution'
      },
      delivery_method: {
        type: Sequelize.ENUM(
          'email',
          'file_storage',
          'api_endpoint',
          'webhook'
        ),
        allowNull: false,
        comment: 'Method used for delivery'
      },
      recipient: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'Delivery recipient (email, path, URL, etc.)'
      },
      status: {
        type: Sequelize.ENUM(
          'pending',
          'delivered',
          'failed',
          'retrying'
        ),
        allowNull: false,
        defaultValue: 'pending',
        comment: 'Delivery status'
      },
      attempt_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Number of delivery attempts'
      },
      delivered_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Successful delivery timestamp'
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Error message if delivery failed'
      },
      delivery_metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional delivery metadata'
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
    console.log('Creating indexes for report scheduling tables...');

    // report_schedules indexes
    await queryInterface.addIndex('report_schedules', ['schedule_id'], {
      name: 'idx_report_schedules_schedule_id'
    });
    await queryInterface.addIndex('report_schedules', ['report_id'], {
      name: 'idx_report_schedules_report_id'
    });
    await queryInterface.addIndex('report_schedules', ['enabled'], {
      name: 'idx_report_schedules_enabled'
    });
    await queryInterface.addIndex('report_schedules', ['next_execution'], {
      name: 'idx_report_schedules_next_execution'
    });
    await queryInterface.addIndex('report_schedules', ['created_at'], {
      name: 'idx_report_schedules_created_at'
    });

    // schedule_executions indexes
    await queryInterface.addIndex('schedule_executions', ['execution_id'], {
      name: 'idx_schedule_executions_execution_id'
    });
    await queryInterface.addIndex('schedule_executions', ['schedule_id'], {
      name: 'idx_schedule_executions_schedule_id'
    });
    await queryInterface.addIndex('schedule_executions', ['status'], {
      name: 'idx_schedule_executions_status'
    });
    await queryInterface.addIndex('schedule_executions', ['scheduled_time'], {
      name: 'idx_schedule_executions_scheduled_time'
    });
    await queryInterface.addIndex('schedule_executions', ['start_time'], {
      name: 'idx_schedule_executions_start_time'
    });

    // delivery_logs indexes
    await queryInterface.addIndex('delivery_logs', ['log_id'], {
      name: 'idx_delivery_logs_log_id'
    });
    await queryInterface.addIndex('delivery_logs', ['execution_id'], {
      name: 'idx_delivery_logs_execution_id'
    });
    await queryInterface.addIndex('delivery_logs', ['status'], {
      name: 'idx_delivery_logs_status'
    });
    await queryInterface.addIndex('delivery_logs', ['delivery_method'], {
      name: 'idx_delivery_logs_delivery_method'
    });
    await queryInterface.addIndex('delivery_logs', ['created_at'], {
      name: 'idx_delivery_logs_created_at'
    });

    // Add foreign key constraints
    await queryInterface.addConstraint('report_schedules', {
      fields: ['report_id'],
      type: 'foreign key',
      name: 'fk_report_schedules_report_id',
      references: {
        table: 'reports',
        field: 'report_id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('schedule_executions', {
      fields: ['schedule_id'],
      type: 'foreign key',
      name: 'fk_schedule_executions_schedule_id',
      references: {
        table: 'report_schedules',
        field: 'schedule_id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    await queryInterface.addConstraint('delivery_logs', {
      fields: ['execution_id'],
      type: 'foreign key',
      name: 'fk_delivery_logs_execution_id',
      references: {
        table: 'schedule_executions',
        field: 'execution_id'
      },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE'
    });

    console.log('✅ Report scheduling tables created successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('Dropping report scheduling tables...');

    // Drop foreign key constraints first
    await queryInterface.removeConstraint('delivery_logs', 'fk_delivery_logs_execution_id');
    await queryInterface.removeConstraint('schedule_executions', 'fk_schedule_executions_schedule_id');
    await queryInterface.removeConstraint('report_schedules', 'fk_report_schedules_report_id');

    // Drop tables in reverse order
    await queryInterface.dropTable('delivery_logs');
    await queryInterface.dropTable('schedule_executions');
    await queryInterface.dropTable('report_schedules');

    console.log('✅ Report scheduling tables dropped successfully');
  }
};