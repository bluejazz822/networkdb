import { getDatabase } from '../config/database';

const sequelize = getDatabase();
import User from './User';
import Role from './Role';
import Permission from './Permission';
import Script from './Script';
import ScriptExecution from './ScriptExecution';
import ScriptParameter from './ScriptParameter';
import ScriptSchedule from './ScriptSchedule';

// Import associations to ensure they are set up
import './associations';
import './script-associations';

/**
 * Database models index
 * This file initializes all models and their associations
 */

// Export all models
export { User, Role, Permission, Script, ScriptExecution, ScriptParameter, ScriptSchedule };

// Export database instance
export { sequelize };

// Export utility functions from associations
export {
  getUserPermissions,
  userHasPermission,
  userHasAnyPermission,
  userHasAllPermissions,
  getUserRoles,
  userHasRole,
  userHasAnyRole,
  assignRoleToUser,
  removeRoleFromUser,
  assignPermissionToRole,
  removePermissionFromRole
} from './associations';

// Export script-related utility functions
export {
  userCanExecuteScript,
  getUserAccessibleScripts,
  getUserExecutionHistory,
  getUserActiveSchedules,
  getUserScriptStats
} from './script-associations';

/**
 * Initialize database and sync models
 * This should be called once during application startup
 */
export async function initializeModels(options: {
  force?: boolean;
  alter?: boolean;
  logging?: boolean;
} = {}): Promise<void> {
  try {
    // Test database connection
    await sequelize.authenticate();
    console.log('Database connection has been established successfully.');

    // Sync models (be careful with force: true in production)
    if (options.force || options.alter) {
      await sequelize.sync({ 
        force: options.force, 
        alter: options.alter,
        logging: options.logging 
      });
      console.log('Database models synchronized successfully.');
    }

    console.log('All models initialized successfully.');
  } catch (error) {
    console.error('Unable to initialize database models:', error);
    throw error;
  }
}

/**
 * Close database connection
 */
export async function closeDatabaseConnection(): Promise<void> {
  try {
    await sequelize.close();
    console.log('Database connection closed successfully.');
  } catch (error) {
    console.error('Error closing database connection:', error);
    throw error;
  }
}

/**
 * Validate all models
 */
export async function validateModels(): Promise<boolean> {
  try {
    // Check if all models are properly defined
    const models = [User, Role, Permission, Script, ScriptExecution, ScriptParameter, ScriptSchedule];
    
    for (const model of models) {
      if (!model.tableName) {
        throw new Error(`Model ${model.name} is not properly defined`);
      }
    }

    // Test basic queries
    await User.count();
    await Role.count();
    await Permission.count();
    await Script.count();
    await ScriptExecution.count();
    await ScriptParameter.count();
    await ScriptSchedule.count();

    console.log('All models validated successfully.');
    return true;
  } catch (error) {
    console.error('Model validation failed:', error);
    return false;
  }
}

/**
 * Get model statistics
 */
export async function getModelStats(): Promise<{
  users: number;
  roles: number;
  permissions: number;
  userRoles: number;
  rolePermissions: number;
  scripts: number;
  scriptExecutions: number;
  scriptParameters: number;
  scriptSchedules: number;
}> {
  try {
    const [users, roles, permissions, userRoles, rolePermissions, scripts, scriptExecutions, scriptParameters, scriptSchedules] = await Promise.all([
      User.count({ where: { deletedAt: null } }),
      Role.count({ where: { deletedAt: null } }),
      Permission.count({ where: { deletedAt: null } }),
      sequelize.models.user_roles?.count() || 0,
      sequelize.models.role_permissions?.count() || 0,
      Script.count({ where: { deletedAt: null } }),
      ScriptExecution.count(),
      ScriptParameter.count(),
      ScriptSchedule.count({ where: { deletedAt: null } })
    ]);

    return {
      users,
      roles,
      permissions,
      userRoles,
      rolePermissions,
      scripts,
      scriptExecutions,
      scriptParameters,
      scriptSchedules
    };
  } catch (error) {
    console.error('Error getting model statistics:', error);
    throw error;
  }
}

/**
 * Create initial system data (roles and permissions)
 * This should be called during first-time setup
 */
export async function seedSystemData(): Promise<void> {
  try {
    console.log('Seeding system roles and permissions...');

    // Check if system roles already exist
    const existingRoles = await Role.count({ where: { isSystem: true } });
    if (existingRoles > 0) {
      console.log('System roles already exist, skipping seed.');
      return;
    }

    // This would typically be handled by migrations,
    // but providing a programmatic way as well
    console.log('System data seeding should be handled by migrations (008 and 009).');
    console.log('Run migrations to create initial system roles, permissions, and script templates.');
  } catch (error) {
    console.error('Error seeding system data:', error);
    throw error;
  }
}

// Default export
export default {
  User,
  Role,
  Permission,
  Script,
  ScriptExecution,
  ScriptParameter,
  ScriptSchedule,
  sequelize,
  initializeModels,
  closeDatabaseConnection,
  validateModels,
  getModelStats,
  seedSystemData
};