'use strict';

const { createMigrationHelper } = require('../../dist/utils/migration-helper');
const { DataTypes } = require('sequelize');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const helper = createMigrationHelper(queryInterface);

    // Create scripts table
    await helper.createTableWithCommonFields('scripts', {
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Unique script identifier name'
      },
      displayName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'Human-readable script name'
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Detailed script description and usage instructions'
      },
      version: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: '1.0.0',
        comment: 'Script version (semantic versioning recommended)'
      },
      filePath: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: 'Path to script file (relative to storage root)'
      },
      fileHash: {
        type: DataTypes.STRING(64),
        allowNull: false,
        comment: 'SHA-256 hash of script file for integrity verification'
      },
      language: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'python',
        comment: 'Script programming language'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether script is active and executable'
      },
      isTemplate: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether script is a template for creating new scripts'
      },
      categoryId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Optional category for script organization'
      },
      authorId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'User who created the script'
      },
      lastModifiedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'User who last modified the script'
      },
      permissions: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: JSON.stringify(['script:execute']),
        comment: 'Required permissions to execute this script'
      },
      requirements: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Script dependencies and requirements (pip install, etc.)'
      },
      estimatedExecutionTime: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Estimated execution time in seconds'
      },
      maxExecutionTime: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1800, // 30 minutes default
        comment: 'Maximum allowed execution time in seconds (timeout)'
      },
      resourceLimits: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Resource limits for script execution (memory, CPU, disk)'
      },
      tags: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: JSON.stringify([]),
        comment: 'Tags for script categorization and search'
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional metadata for script customization'
      }
    }, {
      comment: 'Python scripts metadata and versioning information'
    });

    // Create script_executions table
    await helper.createTableWithCommonFields('script_executions', {
      scriptId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Reference to the script being executed'
      },
      scheduleId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Reference to schedule if this is a scheduled execution'
      },
      executorId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'User who triggered the execution'
      },
      status: {
        type: DataTypes.ENUM('PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT', 'KILLED'),
        allowNull: false,
        defaultValue: 'PENDING',
        comment: 'Current execution status'
      },
      priority: {
        type: DataTypes.ENUM('LOW', 'NORMAL', 'HIGH', 'CRITICAL'),
        allowNull: false,
        defaultValue: 'NORMAL',
        comment: 'Execution priority level'
      },
      queuedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'When execution was added to queue'
      },
      startedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When execution actually started'
      },
      completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'When execution completed (success or failure)'
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Execution duration in milliseconds'
      },
      parameters: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Parameters passed to script execution'
      },
      environment: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Environment variables for script execution'
      },
      workingDirectory: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Working directory for script execution'
      },
      containerId: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Docker container ID for sandboxed execution'
      },
      processId: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Process ID of executing script'
      },
      exitCode: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Script exit code (0 = success)'
      },
      stdout: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'Standard output from script execution'
      },
      stderr: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'Standard error from script execution'
      },
      logs: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'Combined execution logs'
      },
      error: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Error message if execution failed'
      },
      resourceUsage: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Resource usage statistics during execution'
      },
      output: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Structured output data from script'
      },
      artifacts: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'List of generated artifact file paths'
      },
      retryCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of retry attempts made'
      },
      maxRetries: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3,
        comment: 'Maximum number of retry attempts allowed'
      },
      retryReason: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Reason for retry attempt'
      },
      parentExecutionId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'Parent execution if this is a retry'
      },
      childExecutionIds: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Child execution IDs (retries)'
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional execution metadata'
      }
    }, {
      comment: 'Script execution history and logs'
    });

    // Create script_parameters table
    await helper.createTableWithCommonFields('script_parameters', {
      scriptId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Reference to the script this parameter belongs to'
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Parameter identifier name (used in script)'
      },
      displayName: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'Human-readable parameter name'
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Parameter description and usage instructions'
      },
      type: {
        type: DataTypes.ENUM('STRING', 'INTEGER', 'FLOAT', 'BOOLEAN', 'JSON', 'EMAIL', 'URL', 'PASSWORD', 'TEXT', 'SELECT', 'MULTISELECT', 'FILE', 'DATE', 'DATETIME'),
        allowNull: false,
        comment: 'Parameter data type'
      },
      isRequired: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether parameter is required for script execution'
      },
      isSecret: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether parameter contains sensitive data'
      },
      defaultValue: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Default value for the parameter'
      },
      allowedValues: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Array of allowed values for SELECT/MULTISELECT types'
      },
      validationRegex: {
        type: DataTypes.STRING(500),
        allowNull: true,
        comment: 'Regular expression for value validation'
      },
      validationRules: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional validation rules'
      },
      minLength: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Minimum string length'
      },
      maxLength: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Maximum string length'
      },
      minValue: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Minimum numeric value'
      },
      maxValue: {
        type: DataTypes.FLOAT,
        allowNull: true,
        comment: 'Maximum numeric value'
      },
      placeholder: {
        type: DataTypes.STRING(200),
        allowNull: true,
        comment: 'Placeholder text for UI input fields'
      },
      helpText: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Help text to guide users'
      },
      group: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Parameter group for UI organization'
      },
      order: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Display order within the script parameters'
      },
      dependsOn: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Name of parameter this depends on for conditional display'
      },
      showWhen: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Conditions for when to show this parameter'
      },
      isAdvanced: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether this is an advanced parameter (hidden by default)'
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional parameter metadata'
      }
    }, {
      comment: 'Configurable parameters for scripts'
    });

    // Create script_schedules table
    await helper.createTableWithCommonFields('script_schedules', {
      scriptId: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'Reference to the script to be scheduled'
      },
      name: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'Human-readable schedule name'
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Schedule description and purpose'
      },
      frequency: {
        type: DataTypes.ENUM('ONCE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'CRON', 'INTERVAL'),
        allowNull: false,
        comment: 'Schedule frequency type'
      },
      cronExpression: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Cron expression for CRON frequency type'
      },
      intervalMinutes: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Interval in minutes for INTERVAL frequency type'
      },
      scheduledAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Specific datetime for ONCE frequency type'
      },
      startDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Schedule start date (optional)'
      },
      endDate: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Schedule end date (optional)'
      },
      timezone: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'UTC',
        comment: 'Timezone for schedule execution'
      },
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether schedule is active'
      },
      status: {
        type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'PAUSED', 'EXPIRED', 'ERROR'),
        allowNull: false,
        defaultValue: 'ACTIVE',
        comment: 'Current schedule status'
      },
      parameters: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Parameters to pass to script execution'
      },
      environment: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Environment variables for script execution'
      },
      maxRetries: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 3,
        comment: 'Maximum retry attempts on failure'
      },
      retryDelayMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 5,
        comment: 'Delay between retry attempts in minutes'
      },
      timeoutMinutes: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 60,
        comment: 'Execution timeout in minutes'
      },
      priority: {
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'NORMAL',
        comment: 'Execution priority'
      },
      runOnWeekdays: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        comment: 'Whether to run on weekdays (Mon-Fri)'
      },
      runOnWeekends: {
        type: DataTypes.BOOLEAN,
        allowNull: true,
        comment: 'Whether to run on weekends (Sat-Sun)'
      },
      allowConcurrentRuns: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether to allow concurrent executions'
      },
      maxConcurrentRuns: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 1,
        comment: 'Maximum number of concurrent executions'
      },
      onFailureAction: {
        type: DataTypes.ENUM('CONTINUE', 'PAUSE', 'NOTIFY', 'DISABLE'),
        allowNull: true,
        comment: 'Action to take on execution failure'
      },
      alertOnFailure: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether to send alerts on execution failure'
      },
      alertOnSuccess: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        comment: 'Whether to send alerts on execution success'
      },
      alertEmails: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Email addresses for alerts'
      },
      lastRunAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Last execution timestamp'
      },
      nextRunAt: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Next scheduled execution timestamp'
      },
      runCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total number of executions'
      },
      successCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of successful executions'
      },
      failureCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        comment: 'Number of failed executions'
      },
      averageExecutionTime: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Average execution time in milliseconds'
      },
      lastExecutionId: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'ID of the last execution'
      },
      createdBy: {
        type: DataTypes.UUID,
        allowNull: false,
        comment: 'User who created the schedule'
      },
      lastModifiedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        comment: 'User who last modified the schedule'
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional schedule metadata'
      }
    }, {
      comment: 'Script scheduling configuration and statistics'
    });

    // Add unique constraints
    await helper.createIndex('scripts', ['name', 'version'], {
      unique: true,
      name: 'idx_scripts_name_version_unique'
    });

    await helper.createIndex('script_parameters', ['scriptId', 'name'], {
      unique: true,
      name: 'idx_script_parameters_script_name_unique'
    });

    await helper.createIndex('script_schedules', ['scriptId', 'name'], {
      unique: true,
      where: { deletedAt: null },
      name: 'idx_script_schedules_script_name_unique'
    });

    // Add regular indexes for scripts table
    await helper.createIndex('scripts', 'name', {
      name: 'idx_scripts_name'
    });

    await helper.createIndex('scripts', 'authorId', {
      name: 'idx_scripts_author_id'
    });

    await helper.createIndex('scripts', 'lastModifiedBy', {
      name: 'idx_scripts_last_modified_by'
    });

    await helper.createIndex('scripts', 'language', {
      name: 'idx_scripts_language'
    });

    await helper.createIndex('scripts', 'isActive', {
      name: 'idx_scripts_is_active'
    });

    await helper.createIndex('scripts', 'isTemplate', {
      name: 'idx_scripts_is_template'
    });

    await helper.createIndex('scripts', 'categoryId', {
      name: 'idx_scripts_category_id'
    });

    await helper.createIndex('scripts', 'fileHash', {
      name: 'idx_scripts_file_hash'
    });

    // Add indexes for script_executions table
    await helper.createIndex('script_executions', 'scriptId', {
      name: 'idx_script_executions_script_id'
    });

    await helper.createIndex('script_executions', 'scheduleId', {
      name: 'idx_script_executions_schedule_id'
    });

    await helper.createIndex('script_executions', 'executorId', {
      name: 'idx_script_executions_executor_id'
    });

    await helper.createIndex('script_executions', 'status', {
      name: 'idx_script_executions_status'
    });

    await helper.createIndex('script_executions', 'priority', {
      name: 'idx_script_executions_priority'
    });

    await helper.createIndex('script_executions', 'queuedAt', {
      name: 'idx_script_executions_queued_at'
    });

    await helper.createIndex('script_executions', 'startedAt', {
      name: 'idx_script_executions_started_at'
    });

    await helper.createIndex('script_executions', 'completedAt', {
      name: 'idx_script_executions_completed_at'
    });

    await helper.createIndex('script_executions', 'exitCode', {
      name: 'idx_script_executions_exit_code'
    });

    await helper.createIndex('script_executions', 'retryCount', {
      name: 'idx_script_executions_retry_count'
    });

    await helper.createIndex('script_executions', 'parentExecutionId', {
      name: 'idx_script_executions_parent_execution_id'
    });

    await helper.createIndex('script_executions', 'containerId', {
      name: 'idx_script_executions_container_id'
    });

    await helper.createIndex('script_executions', ['status', 'queuedAt'], {
      name: 'idx_script_executions_status_queued'
    });

    await helper.createIndex('script_executions', ['scriptId', 'completedAt'], {
      name: 'idx_script_executions_script_completed'
    });

    await helper.createIndex('script_executions', ['executorId', 'createdAt'], {
      name: 'idx_script_executions_executor_created'
    });

    // Add indexes for script_parameters table
    await helper.createIndex('script_parameters', 'scriptId', {
      name: 'idx_script_parameters_script_id'
    });

    await helper.createIndex('script_parameters', 'type', {
      name: 'idx_script_parameters_type'
    });

    await helper.createIndex('script_parameters', 'isRequired', {
      name: 'idx_script_parameters_is_required'
    });

    await helper.createIndex('script_parameters', 'isSecret', {
      name: 'idx_script_parameters_is_secret'
    });

    await helper.createIndex('script_parameters', 'group', {
      name: 'idx_script_parameters_group'
    });

    await helper.createIndex('script_parameters', 'order', {
      name: 'idx_script_parameters_order'
    });

    await helper.createIndex('script_parameters', 'dependsOn', {
      name: 'idx_script_parameters_depends_on'
    });

    await helper.createIndex('script_parameters', 'isAdvanced', {
      name: 'idx_script_parameters_is_advanced'
    });

    await helper.createIndex('script_parameters', ['scriptId', 'order'], {
      name: 'idx_script_parameters_script_order'
    });

    // Add indexes for script_schedules table
    await helper.createIndex('script_schedules', 'scriptId', {
      name: 'idx_script_schedules_script_id'
    });

    await helper.createIndex('script_schedules', 'name', {
      name: 'idx_script_schedules_name'
    });

    await helper.createIndex('script_schedules', 'frequency', {
      name: 'idx_script_schedules_frequency'
    });

    await helper.createIndex('script_schedules', 'isActive', {
      name: 'idx_script_schedules_is_active'
    });

    await helper.createIndex('script_schedules', 'status', {
      name: 'idx_script_schedules_status'
    });

    await helper.createIndex('script_schedules', 'nextRunAt', {
      name: 'idx_script_schedules_next_run_at'
    });

    await helper.createIndex('script_schedules', 'lastRunAt', {
      name: 'idx_script_schedules_last_run_at'
    });

    await helper.createIndex('script_schedules', 'createdBy', {
      name: 'idx_script_schedules_created_by'
    });

    await helper.createIndex('script_schedules', 'lastModifiedBy', {
      name: 'idx_script_schedules_last_modified_by'
    });

    await helper.createIndex('script_schedules', 'startDate', {
      name: 'idx_script_schedules_start_date'
    });

    await helper.createIndex('script_schedules', 'endDate', {
      name: 'idx_script_schedules_end_date'
    });

    await helper.createIndex('script_schedules', 'timezone', {
      name: 'idx_script_schedules_timezone'
    });

    await helper.createIndex('script_schedules', 'priority', {
      name: 'idx_script_schedules_priority'
    });

    await helper.createIndex('script_schedules', ['isActive', 'status', 'nextRunAt'], {
      name: 'idx_script_schedules_runnable'
    });

    // Add foreign key constraints
    await helper.addForeignKey('scripts', 'authorId', 'users', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    await helper.addForeignKey('scripts', 'lastModifiedBy', 'users', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await helper.addForeignKey('script_executions', 'scriptId', 'scripts', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await helper.addForeignKey('script_executions', 'scheduleId', 'script_schedules', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await helper.addForeignKey('script_executions', 'executorId', 'users', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    await helper.addForeignKey('script_executions', 'parentExecutionId', 'script_executions', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await helper.addForeignKey('script_parameters', 'scriptId', 'scripts', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await helper.addForeignKey('script_schedules', 'scriptId', 'scripts', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'CASCADE'
    });

    await helper.addForeignKey('script_schedules', 'createdBy', 'users', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'RESTRICT'
    });

    await helper.addForeignKey('script_schedules', 'lastModifiedBy', 'users', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    await helper.addForeignKey('script_schedules', 'lastExecutionId', 'script_executions', 'id', {
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL'
    });

    // Add check constraints
    await queryInterface.addConstraint('scripts', {
      type: 'check',
      fields: ['estimatedExecutionTime'],
      name: 'chk_scripts_estimated_execution_time_range',
      where: {
        estimatedExecutionTime: {
          [Sequelize.Op.between]: [1, 86400] // 1 second to 24 hours
        }
      }
    });

    await queryInterface.addConstraint('scripts', {
      type: 'check',
      fields: ['maxExecutionTime'],
      name: 'chk_scripts_max_execution_time_range',
      where: {
        maxExecutionTime: {
          [Sequelize.Op.between]: [1, 86400] // 1 second to 24 hours
        }
      }
    });

    await queryInterface.addConstraint('script_executions', {
      type: 'check',
      fields: ['retryCount'],
      name: 'chk_script_executions_retry_count_range',
      where: {
        retryCount: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    await queryInterface.addConstraint('script_executions', {
      type: 'check',
      fields: ['maxRetries'],
      name: 'chk_script_executions_max_retries_range',
      where: {
        maxRetries: {
          [Sequelize.Op.between]: [0, 10]
        }
      }
    });

    await queryInterface.addConstraint('script_parameters', {
      type: 'check',
      fields: ['minLength'],
      name: 'chk_script_parameters_min_length_non_negative',
      where: {
        minLength: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    await queryInterface.addConstraint('script_parameters', {
      type: 'check',
      fields: ['maxLength'],
      name: 'chk_script_parameters_max_length_non_negative',
      where: {
        maxLength: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    await queryInterface.addConstraint('script_schedules', {
      type: 'check',
      fields: ['intervalMinutes'],
      name: 'chk_script_schedules_interval_minutes_positive',
      where: {
        intervalMinutes: {
          [Sequelize.Op.gt]: 0
        }
      }
    });

    await queryInterface.addConstraint('script_schedules', {
      type: 'check',
      fields: ['maxRetries'],
      name: 'chk_script_schedules_max_retries_range',
      where: {
        maxRetries: {
          [Sequelize.Op.between]: [0, 10]
        }
      }
    });

    await queryInterface.addConstraint('script_schedules', {
      type: 'check',
      fields: ['retryDelayMinutes'],
      name: 'chk_script_schedules_retry_delay_non_negative',
      where: {
        retryDelayMinutes: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    await queryInterface.addConstraint('script_schedules', {
      type: 'check',
      fields: ['timeoutMinutes'],
      name: 'chk_script_schedules_timeout_minutes_range',
      where: {
        timeoutMinutes: {
          [Sequelize.Op.between]: [1, 1440] // 1 minute to 24 hours
        }
      }
    });

    await queryInterface.addConstraint('script_schedules', {
      type: 'check',
      fields: ['maxConcurrentRuns'],
      name: 'chk_script_schedules_max_concurrent_runs_range',
      where: {
        maxConcurrentRuns: {
          [Sequelize.Op.between]: [1, 10]
        }
      }
    });

    await queryInterface.addConstraint('script_schedules', {
      type: 'check',
      fields: ['runCount'],
      name: 'chk_script_schedules_run_count_non_negative',
      where: {
        runCount: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    await queryInterface.addConstraint('script_schedules', {
      type: 'check',
      fields: ['successCount'],
      name: 'chk_script_schedules_success_count_non_negative',
      where: {
        successCount: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    await queryInterface.addConstraint('script_schedules', {
      type: 'check',
      fields: ['failureCount'],
      name: 'chk_script_schedules_failure_count_non_negative',
      where: {
        failureCount: {
          [Sequelize.Op.gte]: 0
        }
      }
    });

    // Add system permissions for script management
    const systemPermissions = [
      // Script permissions
      { name: 'script:read', displayName: 'View Scripts', description: 'View script information and metadata', resource: 'script', action: 'read' },
      { name: 'script:write', displayName: 'Modify Scripts', description: 'Create and modify scripts', resource: 'script', action: 'write' },
      { name: 'script:delete', displayName: 'Delete Scripts', description: 'Delete scripts', resource: 'script', action: 'delete' },
      { name: 'script:execute', displayName: 'Execute Scripts', description: 'Execute scripts manually', resource: 'script', action: 'execute' },
      { name: 'script:manage', displayName: 'Manage Scripts', description: 'Full script management including versioning', resource: 'script', action: 'manage' },

      // Script execution permissions
      { name: 'script_execution:read', displayName: 'View Script Executions', description: 'View script execution history and logs', resource: 'script_execution', action: 'read' },
      { name: 'script_execution:write', displayName: 'Modify Executions', description: 'Cancel or retry script executions', resource: 'script_execution', action: 'write' },
      { name: 'script_execution:manage', displayName: 'Manage Executions', description: 'Full execution management', resource: 'script_execution', action: 'manage' },

      // Script schedule permissions
      { name: 'script_schedule:read', displayName: 'View Script Schedules', description: 'View script schedules and configuration', resource: 'script_schedule', action: 'read' },
      { name: 'script_schedule:write', displayName: 'Modify Schedules', description: 'Create and modify script schedules', resource: 'script_schedule', action: 'write' },
      { name: 'script_schedule:delete', displayName: 'Delete Schedules', description: 'Delete script schedules', resource: 'script_schedule', action: 'delete' },
      { name: 'script_schedule:manage', displayName: 'Manage Schedules', description: 'Full schedule management', resource: 'script_schedule', action: 'manage' }
    ];

    // Get the current max permission ID to continue the sequence
    const maxPermissionResult = await queryInterface.sequelize.query(
      "SELECT id FROM permissions ORDER BY id DESC LIMIT 1",
      { type: queryInterface.sequelize.QueryTypes.SELECT }
    );

    let permissionCounter = 24; // Start after existing permissions (0-23)
    if (maxPermissionResult.length > 0) {
      const lastId = maxPermissionResult[0].id;
      const match = lastId.match(/^b(\d{7})-/);
      if (match) {
        permissionCounter = parseInt(match[1]) + 1;
      }
    }

    const permissionsToInsert = systemPermissions.map((perm) => ({
      id: `b${permissionCounter.toString().padStart(7, '0')}-0000-4000-8000-000000000000`,
      ...perm,
      isSystem: true,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    })).map((perm, index) => {
      perm.id = `b${(permissionCounter + index).toString().padStart(7, '0')}-0000-4000-8000-000000000000`;
      return perm;
    });

    await queryInterface.bulkInsert('permissions', permissionsToInsert);

    // Add script templates for common use cases
    const scriptTemplates = [
      {
        id: 'c0000001-0000-4000-8000-000000000000',
        name: 'network_discovery',
        displayName: 'Network Discovery Template',
        description: 'Template for discovering network devices and services',
        version: '1.0.0',
        filePath: 'templates/network_discovery.py',
        fileHash: '0000000000000000000000000000000000000000000000000000000000000000',
        language: 'python',
        isActive: true,
        isTemplate: true,
        authorId: 'a0000000-0000-4000-8000-000000000001', // System user
        permissions: JSON.stringify(['script:execute', 'network:read']),
        requirements: 'pip install nmap-python python-nmap',
        estimatedExecutionTime: 300, // 5 minutes
        maxExecutionTime: 1800, // 30 minutes
        tags: JSON.stringify(['network', 'discovery', 'template']),
        metadata: JSON.stringify({
          category: 'network',
          complexity: 'intermediate',
          outputFormat: 'json'
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        id: 'c0000002-0000-4000-8000-000000000000',
        name: 'backup_config',
        displayName: 'Configuration Backup Template',
        description: 'Template for backing up device configurations',
        version: '1.0.0',
        filePath: 'templates/backup_config.py',
        fileHash: '1111111111111111111111111111111111111111111111111111111111111111',
        language: 'python',
        isActive: true,
        isTemplate: true,
        authorId: 'a0000000-0000-4000-8000-000000000001', // System user
        permissions: JSON.stringify(['script:execute', 'network:read', 'network:write']),
        requirements: 'pip install paramiko netmiko',
        estimatedExecutionTime: 120, // 2 minutes
        maxExecutionTime: 900, // 15 minutes
        tags: JSON.stringify(['backup', 'configuration', 'template']),
        metadata: JSON.stringify({
          category: 'maintenance',
          complexity: 'beginner',
          outputFormat: 'file'
        }),
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await queryInterface.bulkInsert('scripts', scriptTemplates);

    // Add comments to tables
    await queryInterface.sequelize.query(`
      ALTER TABLE scripts COMMENT = 'Python scripts metadata, versioning, and configuration for the Network CMDB script execution system'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE script_executions COMMENT = 'Script execution history, logs, and monitoring data for tracking and debugging script runs'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE script_parameters COMMENT = 'Configurable parameters for scripts with validation rules and UI configuration'
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE script_schedules COMMENT = 'Script scheduling configuration with cron-like capabilities and execution statistics'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Remove foreign key constraints first
    const foreignKeysToRemove = [
      { table: 'scripts', constraint: 'fk_scripts_authorId' },
      { table: 'scripts', constraint: 'fk_scripts_lastModifiedBy' },
      { table: 'script_executions', constraint: 'fk_script_executions_scriptId' },
      { table: 'script_executions', constraint: 'fk_script_executions_scheduleId' },
      { table: 'script_executions', constraint: 'fk_script_executions_executorId' },
      { table: 'script_executions', constraint: 'fk_script_executions_parentExecutionId' },
      { table: 'script_parameters', constraint: 'fk_script_parameters_scriptId' },
      { table: 'script_schedules', constraint: 'fk_script_schedules_scriptId' },
      { table: 'script_schedules', constraint: 'fk_script_schedules_createdBy' },
      { table: 'script_schedules', constraint: 'fk_script_schedules_lastModifiedBy' },
      { table: 'script_schedules', constraint: 'fk_script_schedules_lastExecutionId' }
    ];

    for (const fk of foreignKeysToRemove) {
      try {
        await queryInterface.removeConstraint(fk.table, fk.constraint);
      } catch (error) {
        console.warn(`Constraint ${fk.constraint} not found, skipping removal`);
      }
    }

    // Remove check constraints
    const checkConstraintsToRemove = [
      { table: 'scripts', constraint: 'chk_scripts_estimated_execution_time_range' },
      { table: 'scripts', constraint: 'chk_scripts_max_execution_time_range' },
      { table: 'script_executions', constraint: 'chk_script_executions_retry_count_range' },
      { table: 'script_executions', constraint: 'chk_script_executions_max_retries_range' },
      { table: 'script_parameters', constraint: 'chk_script_parameters_min_length_non_negative' },
      { table: 'script_parameters', constraint: 'chk_script_parameters_max_length_non_negative' },
      { table: 'script_schedules', constraint: 'chk_script_schedules_interval_minutes_positive' },
      { table: 'script_schedules', constraint: 'chk_script_schedules_max_retries_range' },
      { table: 'script_schedules', constraint: 'chk_script_schedules_retry_delay_non_negative' },
      { table: 'script_schedules', constraint: 'chk_script_schedules_timeout_minutes_range' },
      { table: 'script_schedules', constraint: 'chk_script_schedules_max_concurrent_runs_range' },
      { table: 'script_schedules', constraint: 'chk_script_schedules_run_count_non_negative' },
      { table: 'script_schedules', constraint: 'chk_script_schedules_success_count_non_negative' },
      { table: 'script_schedules', constraint: 'chk_script_schedules_failure_count_non_negative' }
    ];

    for (const constraint of checkConstraintsToRemove) {
      try {
        await queryInterface.removeConstraint(constraint.table, constraint.constraint);
      } catch (error) {
        console.warn(`Check constraint ${constraint.constraint} not found, skipping removal`);
      }
    }

    // Remove added permissions
    await queryInterface.sequelize.query(`
      DELETE FROM permissions WHERE resource IN ('script', 'script_execution', 'script_schedule')
    `);

    // Drop tables in reverse order of dependencies
    await queryInterface.dropTable('script_schedules');
    await queryInterface.dropTable('script_parameters');
    await queryInterface.dropTable('script_executions');
    await queryInterface.dropTable('scripts');
  }
};