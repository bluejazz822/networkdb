/**
 * Database Test Helper
 * Provides utilities for setting up and cleaning up test database
 */

import { sequelize } from '../../src/database';
import { WorkflowRegistry } from '../../src/models/WorkflowRegistry';
import { WorkflowExecution } from '../../src/models/WorkflowExecution';
import { WorkflowAlert } from '../../src/models/WorkflowAlert';

/**
 * Setup test database - ensure models are synced
 */
export async function setupTestDatabase(): Promise<void> {
  try {
    // Force sync all models for testing
    await sequelize.sync({ force: true });
    console.log('Test database setup completed');
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
}

/**
 * Clean up test database
 */
export async function cleanupTestDatabase(): Promise<void> {
  try {
    // Close database connection
    if (sequelize) {
      await sequelize.close();
      console.log('Test database cleanup completed');
    }
  } catch (error) {
    console.error('Failed to cleanup test database:', error);
    // Don't throw - cleanup should be non-fatal
  }
}