import User from './User';
import Role from './Role';
import Permission from './Permission';
import Script from './Script';
import ScriptExecution from './ScriptExecution';
import ScriptParameter from './ScriptParameter';
import ScriptSchedule from './ScriptSchedule';

/**
 * Define script-related model associations
 * This file sets up relationships between Script models and existing User models
 */

// Script-User associations
Script.belongsTo(User, {
  foreignKey: 'authorId',
  as: 'author',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

User.hasMany(Script, {
  foreignKey: 'authorId',
  as: 'authoredScripts',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

Script.belongsTo(User, {
  foreignKey: 'lastModifiedBy',
  as: 'lastModifier',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
  constraints: false
});

User.hasMany(Script, {
  foreignKey: 'lastModifiedBy',
  as: 'modifiedScripts',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
  constraints: false
});

// Script-ScriptParameter associations (One-to-Many)
Script.hasMany(ScriptParameter, {
  foreignKey: 'scriptId',
  as: 'parameters',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

ScriptParameter.belongsTo(Script, {
  foreignKey: 'scriptId',
  as: 'script',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// Script-ScriptSchedule associations (One-to-Many)
Script.hasMany(ScriptSchedule, {
  foreignKey: 'scriptId',
  as: 'schedules',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

ScriptSchedule.belongsTo(Script, {
  foreignKey: 'scriptId',
  as: 'script',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// Script-ScriptExecution associations (One-to-Many)
Script.hasMany(ScriptExecution, {
  foreignKey: 'scriptId',
  as: 'executions',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

ScriptExecution.belongsTo(Script, {
  foreignKey: 'scriptId',
  as: 'script',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE'
});

// ScriptSchedule-User associations
ScriptSchedule.belongsTo(User, {
  foreignKey: 'createdBy',
  as: 'creator',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

User.hasMany(ScriptSchedule, {
  foreignKey: 'createdBy',
  as: 'createdSchedules',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

ScriptSchedule.belongsTo(User, {
  foreignKey: 'lastModifiedBy',
  as: 'lastModifier',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
  constraints: false
});

User.hasMany(ScriptSchedule, {
  foreignKey: 'lastModifiedBy',
  as: 'modifiedSchedules',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
  constraints: false
});

// ScriptSchedule-ScriptExecution associations
ScriptSchedule.hasMany(ScriptExecution, {
  foreignKey: 'scheduleId',
  as: 'executions',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

ScriptExecution.belongsTo(ScriptSchedule, {
  foreignKey: 'scheduleId',
  as: 'schedule',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE'
});

// ScriptSchedule-ScriptExecution (last execution)
ScriptSchedule.belongsTo(ScriptExecution, {
  foreignKey: 'lastExecutionId',
  as: 'lastExecution',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
  constraints: false
});

// ScriptExecution-User associations
ScriptExecution.belongsTo(User, {
  foreignKey: 'executorId',
  as: 'executor',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

User.hasMany(ScriptExecution, {
  foreignKey: 'executorId',
  as: 'executions',
  onDelete: 'RESTRICT',
  onUpdate: 'CASCADE'
});

// ScriptExecution self-referencing associations (for retries)
ScriptExecution.belongsTo(ScriptExecution, {
  foreignKey: 'parentExecutionId',
  as: 'parentExecution',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
  constraints: false
});

ScriptExecution.hasMany(ScriptExecution, {
  foreignKey: 'parentExecutionId',
  as: 'childExecutions',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
  constraints: false
});

// ScriptParameter self-referencing associations (for dependencies)
ScriptParameter.belongsTo(ScriptParameter, {
  foreignKey: 'dependsOn',
  as: 'dependency',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
  constraints: false
});

ScriptParameter.hasMany(ScriptParameter, {
  foreignKey: 'dependsOn',
  as: 'dependents',
  onDelete: 'SET NULL',
  onUpdate: 'CASCADE',
  constraints: false
});

/**
 * Script-related utility functions
 */

/**
 * Check if user can execute a specific script
 */
export async function userCanExecuteScript(userId: string, script: Script): Promise<boolean> {
  // Import getUserPermissions from the main associations file to avoid circular dependency
  const { getUserPermissions } = await import('./associations');
  const userPermissions = await getUserPermissions(userId);
  const permissionNames = userPermissions.map(p => p.name);
  
  return script.hasRequiredPermissions(permissionNames);
}

/**
 * Get scripts accessible by user
 */
export async function getUserAccessibleScripts(userId: string): Promise<Script[]> {
  // Import getUserPermissions from the main associations file to avoid circular dependency
  const { getUserPermissions } = await import('./associations');
  const userPermissions = await getUserPermissions(userId);
  const permissionNames = userPermissions.map(p => p.name);
  
  // Get all active scripts
  const scripts = await Script.scope('active').findAll({
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'username', 'firstName', 'lastName']
      },
      {
        model: ScriptParameter,
        as: 'parameters',
        where: { isAdvanced: false },
        required: false,
        order: [['order', 'ASC']]
      }
    ]
  });
  
  // Filter scripts based on permissions
  return scripts.filter(script => script.hasRequiredPermissions(permissionNames));
}

/**
 * Get user's script execution history
 */
export async function getUserExecutionHistory(
  userId: string, 
  limit: number = 50,
  scriptId?: string
): Promise<ScriptExecution[]> {
  const whereClause: any = { executorId: userId };
  
  if (scriptId) {
    whereClause.scriptId = scriptId;
  }
  
  return await ScriptExecution.findAll({
    where: whereClause,
    include: [
      {
        model: Script,
        as: 'script',
        attributes: ['id', 'name', 'displayName', 'version']
      },
      {
        model: ScriptSchedule,
        as: 'schedule',
        attributes: ['id', 'name'],
        required: false
      }
    ],
    order: [['createdAt', 'DESC']],
    limit: limit
  });
}

/**
 * Get active schedules for user's scripts
 */
export async function getUserActiveSchedules(userId: string): Promise<ScriptSchedule[]> {
  return await ScriptSchedule.scope('active').findAll({
    include: [
      {
        model: Script,
        as: 'script',
        where: { authorId: userId },
        attributes: ['id', 'name', 'displayName', 'version']
      },
      {
        model: User,
        as: 'creator',
        attributes: ['id', 'username', 'firstName', 'lastName']
      }
    ],
    order: [['nextRunAt', 'ASC']]
  });
}

/**
 * Get script execution statistics for a user
 */
export async function getUserScriptStats(userId: string): Promise<{
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  activeSchedules: number;
  scriptsCreated: number;
}> {
  const [executions, schedules, scripts] = await Promise.all([
    ScriptExecution.findAll({
      where: { executorId: userId },
      attributes: ['status', 'duration', 'exitCode']
    }),
    ScriptSchedule.scope('active').count({
      include: [{
        model: Script,
        as: 'script',
        where: { authorId: userId }
      }]
    }),
    Script.count({ where: { authorId: userId, deletedAt: null } })
  ]);
  
  const successful = executions.filter(e => e.status === 'COMPLETED' && (e.exitCode === 0 || e.exitCode === null)).length;
  const failed = executions.filter(e => e.status === 'FAILED' || e.status === 'TIMEOUT' || e.status === 'KILLED').length;
  const validDurations = executions.filter(e => e.duration !== null).map(e => e.duration!);
  const avgDuration = validDurations.length > 0 ? validDurations.reduce((a, b) => a + b, 0) / validDurations.length : 0;
  
  return {
    totalExecutions: executions.length,
    successfulExecutions: successful,
    failedExecutions: failed,
    averageExecutionTime: Math.round(avgDuration),
    activeSchedules: schedules,
    scriptsCreated: scripts
  };
}

/**
 * Export script models
 */
export { Script, ScriptExecution, ScriptParameter, ScriptSchedule };