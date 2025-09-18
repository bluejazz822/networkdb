'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    console.log('Creating workflow monitoring tables...');

    // Create workflow_registry table
    await queryInterface.createTable('workflow_registry', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      workflow_id: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false
      },
      workflow_name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      workflow_type: {
        type: Sequelize.ENUM('vpc', 'subnet', 'transit_gateway', 'nat_gateway', 'vpn'),
        allowNull: false
      },
      provider: {
        type: Sequelize.ENUM('aws', 'azure', 'gcp', 'ali', 'oci', 'huawei', 'others'),
        allowNull: false
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true
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

    // Create workflow_executions table
    await queryInterface.createTable('workflow_executions', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      workflow_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        references: {
          model: 'workflow_registry',
          key: 'workflow_id'
        },
        onDelete: 'CASCADE'
      },
      execution_id: {
        type: Sequelize.STRING(255),
        unique: true,
        allowNull: false
      },
      status: {
        type: Sequelize.ENUM('success', 'failure', 'running', 'cancelled'),
        allowNull: false
      },
      start_time: {
        type: Sequelize.DATE,
        allowNull: false
      },
      end_time: {
        type: Sequelize.DATE,
        allowNull: true
      },
      duration_ms: {
        type: Sequelize.INTEGER,
        allowNull: true
      },
      resources_created: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      resources_updated: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      resources_failed: {
        type: Sequelize.INTEGER,
        defaultValue: 0
      },
      error_message: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      execution_data: {
        type: Sequelize.JSON,
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      }
    });

    // Create workflow_alerts table
    await queryInterface.createTable('workflow_alerts', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      execution_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
        references: {
          model: 'workflow_executions',
          key: 'execution_id'
        },
        onDelete: 'CASCADE'
      },
      alert_type: {
        type: Sequelize.ENUM('failure', 'success', 'manual_trigger'),
        allowNull: false
      },
      recipients: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      sent_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      resolved_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    });

    // Add indexes for performance
    await queryInterface.addIndex('workflow_registry', ['workflow_id'], { unique: true });
    await queryInterface.addIndex('workflow_registry', ['workflow_type']);
    await queryInterface.addIndex('workflow_registry', ['provider']);
    await queryInterface.addIndex('workflow_registry', ['is_active']);

    await queryInterface.addIndex('workflow_executions', ['execution_id'], { unique: true });
    await queryInterface.addIndex('workflow_executions', ['workflow_id']);
    await queryInterface.addIndex('workflow_executions', ['status']);
    await queryInterface.addIndex('workflow_executions', ['start_time']);

    await queryInterface.addIndex('workflow_alerts', ['execution_id']);
    await queryInterface.addIndex('workflow_alerts', ['alert_type']);
    await queryInterface.addIndex('workflow_alerts', ['sent_at']);

    console.log('Workflow monitoring tables created successfully');
  },

  async down(queryInterface, Sequelize) {
    console.log('Dropping workflow monitoring tables...');
    await queryInterface.dropTable('workflow_alerts');
    await queryInterface.dropTable('workflow_executions'); 
    await queryInterface.dropTable('workflow_registry');
    console.log('Workflow monitoring tables dropped successfully');
  }
};