import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';
import { WorkflowRegistry } from './WorkflowRegistry';

export interface WorkflowExecutionAttributes {
  id: number;
  workflow_id: string;
  execution_id: string;
  status: 'success' | 'failure' | 'running' | 'cancelled';
  start_time: Date;
  end_time?: Date;
  duration_ms?: number;
  resources_created: number;
  resources_updated: number;
  resources_failed: number;
  error_message?: string;
  execution_data?: any;
  created_at: Date;
}

export interface WorkflowExecutionCreationAttributes 
  extends Optional<WorkflowExecutionAttributes, 'id' | 'end_time' | 'duration_ms' | 'resources_created' | 'resources_updated' | 'resources_failed' | 'error_message' | 'execution_data' | 'created_at'> {}

export class WorkflowExecution extends Model<WorkflowExecutionAttributes, WorkflowExecutionCreationAttributes> 
  implements WorkflowExecutionAttributes {
  public id!: number;
  public workflow_id!: string;
  public execution_id!: string;
  public status!: 'success' | 'failure' | 'running' | 'cancelled';
  public start_time!: Date;
  public end_time?: Date;
  public duration_ms?: number;
  public resources_created!: number;
  public resources_updated!: number;
  public resources_failed!: number;
  public error_message?: string;
  public execution_data?: any;
  public created_at!: Date;
}

WorkflowExecution.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    workflow_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      references: {
        model: WorkflowRegistry,
        key: 'workflow_id'
      },
      onDelete: 'CASCADE'
    },
    execution_id: {
      type: DataTypes.STRING(255),
      unique: true,
      allowNull: false
    },
    status: {
      type: DataTypes.ENUM('success', 'failure', 'running', 'cancelled'),
      allowNull: false
    },
    start_time: {
      type: DataTypes.DATE,
      allowNull: false
    },
    end_time: {
      type: DataTypes.DATE,
      allowNull: true
    },
    duration_ms: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    resources_created: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    resources_updated: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    resources_failed: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    error_message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    execution_data: {
      type: DataTypes.JSON,
      allowNull: true
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    modelName: 'WorkflowExecution',
    tableName: 'workflow_executions',
    timestamps: false
  }
);