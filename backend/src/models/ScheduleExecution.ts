import { DataTypes, Model, Optional } from 'sequelize';
import { getDatabase } from '../config/database';

const sequelize = getDatabase();

export interface ScheduleExecutionAttributes {
  id: number;
  execution_id: string;
  schedule_id: string;
  report_execution_id?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying';
  scheduled_time: Date;
  start_time?: Date;
  end_time?: Date;
  duration?: number;
  retry_count: number;
  error_message?: string;
  execution_metadata?: {
    report_size?: number;
    record_count?: number;
    format?: string;
    generation_time?: number;
  };
  delivery_status?: {
    [deliveryMethod: string]: {
      status: 'pending' | 'delivered' | 'failed';
      attempts: number;
      last_attempt?: Date;
      error?: string;
    };
  };
  created_at: Date;
  updated_at: Date;
}

export interface ScheduleExecutionCreationAttributes
  extends Optional<ScheduleExecutionAttributes, 'id' | 'retry_count' | 'created_at' | 'updated_at'> {}

export class ScheduleExecution extends Model<ScheduleExecutionAttributes, ScheduleExecutionCreationAttributes> implements ScheduleExecutionAttributes {
  public id!: number;
  public execution_id!: string;
  public schedule_id!: string;
  public report_execution_id?: string;
  public status!: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'retrying';
  public scheduled_time!: Date;
  public start_time?: Date;
  public end_time?: Date;
  public duration?: number;
  public retry_count!: number;
  public error_message?: string;
  public execution_metadata?: {
    report_size?: number;
    record_count?: number;
    format?: string;
    generation_time?: number;
  };
  public delivery_status?: {
    [deliveryMethod: string]: {
      status: 'pending' | 'delivered' | 'failed';
      attempts: number;
      last_attempt?: Date;
      error?: string;
    };
  };
  public created_at!: Date;
  public updated_at!: Date;

  // Associations
  public readonly delivery_logs?: DeliveryLog[];
  public readonly report_schedule?: any; // To avoid circular import

  // Instance methods
  public async markAsStarted(): Promise<void> {
    this.status = 'running';
    this.start_time = new Date();
    await this.save();
  }

  public async markAsCompleted(metadata?: any): Promise<void> {
    this.status = 'completed';
    this.end_time = new Date();
    if (this.start_time) {
      this.duration = this.end_time.getTime() - this.start_time.getTime();
    }
    if (metadata) {
      this.execution_metadata = { ...this.execution_metadata, ...metadata };
    }
    await this.save();
  }

  public async markAsFailed(errorMessage: string): Promise<void> {
    this.status = 'failed';
    this.end_time = new Date();
    this.error_message = errorMessage;
    if (this.start_time) {
      this.duration = this.end_time.getTime() - this.start_time.getTime();
    }
    await this.save();
  }

  public async markAsRetrying(): Promise<void> {
    this.status = 'retrying';
    this.retry_count += 1;
    await this.save();
  }

  public async updateDeliveryStatus(method: string, status: 'pending' | 'delivered' | 'failed', error?: string): Promise<void> {
    if (!this.delivery_status) {
      this.delivery_status = {};
    }

    this.delivery_status[method] = {
      status,
      attempts: (this.delivery_status[method]?.attempts || 0) + 1,
      last_attempt: new Date(),
      error
    };

    await this.save();
  }

  public getExecutionDuration(): number | null {
    if (this.start_time && this.end_time) {
      return this.end_time.getTime() - this.start_time.getTime();
    }
    return null;
  }

  public isCompleted(): boolean {
    return ['completed', 'failed', 'cancelled'].includes(this.status);
  }

  public canRetry(maxRetries: number): boolean {
    return this.status === 'failed' && this.retry_count < maxRetries;
  }

  public getAllDeliveryMethodsStatus(): Array<{ method: string; status: string; attempts: number }> {
    if (!this.delivery_status) {
      return [];
    }

    return Object.entries(this.delivery_status).map(([method, status]) => ({
      method,
      status: status.status,
      attempts: status.attempts
    }));
  }
}

ScheduleExecution.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  execution_id: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false
  },
  schedule_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  report_execution_id: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'running', 'completed', 'failed', 'cancelled', 'retrying'),
    allowNull: false,
    defaultValue: 'pending'
  },
  scheduled_time: {
    type: DataTypes.DATE,
    allowNull: false
  },
  start_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  end_time: {
    type: DataTypes.DATE,
    allowNull: true
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true
  },
  retry_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  execution_metadata: {
    type: DataTypes.JSON,
    allowNull: true
  },
  delivery_status: {
    type: DataTypes.JSON,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'ScheduleExecution',
  tableName: 'schedule_executions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['execution_id'], unique: true },
    { fields: ['schedule_id'] },
    { fields: ['status'] },
    { fields: ['scheduled_time'] },
    { fields: ['start_time'] }
  ]
});

// Import DeliveryLog here to avoid circular dependencies
import { DeliveryLog } from './DeliveryLog';

// Define associations
ScheduleExecution.hasMany(DeliveryLog, {
  foreignKey: 'execution_id',
  sourceKey: 'execution_id',
  as: 'delivery_logs',
  onDelete: 'CASCADE'
});

export default ScheduleExecution;