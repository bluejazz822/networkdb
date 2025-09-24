'use strict';

const fs = require('fs');
const path = require('path');
const { createMigrationHelper } = require('../utils/migration-helper');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const helper = createMigrationHelper(queryInterface);

    // Read the SQL file with all view definitions
    const sqlFilePath = path.join(__dirname, '../database/views/report_performance_views.sql');

    try {
      const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

      // Split SQL content by view definitions and execute each one
      const statements = sqlContent
        .split(/(?=CREATE OR REPLACE VIEW)/g)
        .filter(statement => statement.trim().length > 0)
        .map(statement => statement.trim());

      console.log(`Creating ${statements.length} materialized views for report performance optimization...`);

      for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        if (statement.startsWith('CREATE OR REPLACE VIEW')) {
          console.log(`Creating view ${i + 1}/${statements.length}...`);
          await helper.executeRaw(statement);
        }
      }

      // Create additional indexes specifically for materialized view performance
      console.log('Creating performance indexes for materialized views...');

      // Index for reports summary view filtering
      await helper.createIndex('reports', ['report_type', 'category', 'provider'], {
        name: 'idx_reports_summary_filter'
      });

      // Index for execution trending queries
      await helper.createIndex('report_executions', ['start_time', 'status'], {
        name: 'idx_executions_time_status'
      });

      // Index for user activity analysis
      await helper.createIndex('report_executions', ['started_by', 'start_time', 'status'], {
        name: 'idx_executions_user_activity'
      });

      // Composite index for performance monitoring
      await helper.createIndex('report_executions', ['report_id', 'start_time', 'duration_ms'], {
        name: 'idx_executions_performance_monitoring'
      });

      // Index for daily metrics calculation
      await helper.createIndex('report_executions', ['report_id', 'start_time', 'records_processed'], {
        name: 'idx_executions_daily_metrics'
      });

      console.log('Successfully created all materialized views and performance indexes.');

    } catch (error) {
      console.error('Error creating materialized views:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    const helper = createMigrationHelper(queryInterface);

    console.log('Dropping materialized views and performance indexes...');

    // Drop materialized views in reverse order
    const viewNames = [
      'mv_execution_trends',
      'mv_performance_alerts',
      'mv_recent_executions',
      'mv_user_activity',
      'mv_category_performance',
      'mv_provider_performance',
      'mv_daily_execution_metrics',
      'mv_reports_summary'
    ];

    for (const viewName of viewNames) {
      try {
        await helper.executeRaw(`DROP VIEW IF EXISTS ${viewName}`);
        console.log(`Dropped view: ${viewName}`);
      } catch (error) {
        console.warn(`Warning: Could not drop view ${viewName}:`, error.message);
      }
    }

    // Drop performance indexes
    const indexesToDrop = [
      { table: 'reports', name: 'idx_reports_summary_filter' },
      { table: 'report_executions', name: 'idx_executions_time_status' },
      { table: 'report_executions', name: 'idx_executions_user_activity' },
      { table: 'report_executions', name: 'idx_executions_performance_monitoring' },
      { table: 'report_executions', name: 'idx_executions_daily_metrics' }
    ];

    for (const index of indexesToDrop) {
      try {
        await helper.removeIndex(index.table, index.name);
        console.log(`Dropped index: ${index.name} from ${index.table}`);
      } catch (error) {
        console.warn(`Warning: Could not drop index ${index.name}:`, error.message);
      }
    }

    console.log('Successfully dropped all materialized views and performance indexes.');
  }
};