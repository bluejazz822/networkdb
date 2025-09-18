/**
 * Workflow Model Associations
 * Defines relationships between workflow-related models
 */

import { WorkflowRegistry } from './WorkflowRegistry';
import { WorkflowExecution } from './WorkflowExecution';
import { WorkflowAlert } from './WorkflowAlert';

// WorkflowRegistry -> WorkflowExecution (One-to-Many)
WorkflowRegistry.hasMany(WorkflowExecution, {
  foreignKey: 'workflow_id',
  sourceKey: 'workflow_id',
  as: 'executions'
});

WorkflowExecution.belongsTo(WorkflowRegistry, {
  foreignKey: 'workflow_id',
  targetKey: 'workflow_id',
  as: 'workflow'
});

// WorkflowExecution -> WorkflowAlert (One-to-Many)
WorkflowExecution.hasMany(WorkflowAlert, {
  foreignKey: 'execution_id',
  sourceKey: 'execution_id',
  as: 'alerts'
});

WorkflowAlert.belongsTo(WorkflowExecution, {
  foreignKey: 'execution_id',
  targetKey: 'execution_id',
  as: 'execution'
});

export {
  WorkflowRegistry,
  WorkflowExecution,
  WorkflowAlert
};