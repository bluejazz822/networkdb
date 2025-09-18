import { DataTypes, Model, Optional } from 'sequelize';
import { sequelize } from '../database';
import { WorkflowExecution } from './WorkflowExecution';

export interface WorkflowAlertAttributes {
  id: number;
  execution_id: string;
  alert_type: 'failure' | 'success' | 'manual_trigger';
  recipients: string;
  sent_at: Date;
  resolved_at?: Date;
}

export interface WorkflowAlertCreationAttributes 
  extends Optional<WorkflowAlertAttributes, 'id' | 'sent_at' | 'resolved_at'> {}

export class WorkflowAlert extends Model<WorkflowAlertAttributes, WorkflowAlertCreationAttributes> 
  implements WorkflowAlertAttributes {
  public id!: number;
  public execution_id!: string;
  public alert_type!: 'failure' | 'success' | 'manual_trigger';
  public recipients!: string;
  public sent_at!: Date;
  public resolved_at?: Date;
}

WorkflowAlert.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false
    },
    execution_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
      references: {
        model: WorkflowExecution,
        key: 'execution_id'
      },
      onDelete: 'CASCADE'
    },
    alert_type: {
      type: DataTypes.ENUM('failure', 'success', 'manual_trigger'),
      allowNull: false
    },
    recipients: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    sent_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    resolved_at: {
      type: DataTypes.DATE,
      allowNull: true
    }
  },
  {
    sequelize,
    modelName: 'WorkflowAlert',
    tableName: 'workflow_alerts',
    timestamps: false
  }
);