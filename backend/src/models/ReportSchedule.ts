import { DataTypes, Model, Optional } from 'sequelize';
import { getDatabase } from '../config/database';

const sequelize = getDatabase();

export interface ReportScheduleAttributes {
  id: number;
  schedule_id: string;
  report_id: string;
  name: string;
  description?: string;
  cron_expression: string;
  timezone: string;
  enabled: boolean;
  delivery_config: {
    methods: Array<{
      type: 'email' | 'file_storage' | 'api_endpoint' | 'webhook';
      config: any;
    }>;
    format?: string;
    compression?: boolean;
  };
  report_config?: {
    filters?: any;
    parameters?: any;
    format_options?: any;
  };
  retry_config?: {
    max_attempts: number;
    retry_delay: number;
    backoff_multiplier: number;
  };
  next_execution?: Date;
  last_execution?: Date;
  execution_count: number;
  failure_count: number;
  created_at: Date;
  updated_at: Date;
  created_by?: string;
  updated_by?: string;
}

export interface ReportScheduleCreationAttributes
  extends Optional<ReportScheduleAttributes, 'id' | 'enabled' | 'execution_count' | 'failure_count' | 'created_at' | 'updated_at' | 'timezone'> {}

export class ReportSchedule extends Model<ReportScheduleAttributes, ReportScheduleCreationAttributes> implements ReportScheduleAttributes {
  public id!: number;
  public schedule_id!: string;
  public report_id!: string;
  public name!: string;
  public description?: string;
  public cron_expression!: string;
  public timezone!: string;
  public enabled!: boolean;
  public delivery_config!: {
    methods: Array<{
      type: 'email' | 'file_storage' | 'api_endpoint' | 'webhook';
      config: any;
    }>;
    format?: string;
    compression?: boolean;
  };
  public report_config?: {
    filters?: any;
    parameters?: any;
    format_options?: any;
  };
  public retry_config?: {
    max_attempts: number;
    retry_delay: number;
    backoff_multiplier: number;
  };
  public next_execution?: Date;
  public last_execution?: Date;
  public execution_count!: number;
  public failure_count!: number;
  public created_at!: Date;
  public updated_at!: Date;
  public created_by?: string;
  public updated_by?: string;

  // Associations
  public readonly schedule_executions?: ScheduleExecution[];

  // Instance methods
  public async updateNextExecution(): Promise<void> {
    const cron = require('node-cron');
    const cronParser = require('cron-parser');

    try {
      const interval = cronParser.parseExpression(this.cron_expression, {
        tz: this.timezone
      });
      this.next_execution = interval.next().toDate();
      await this.save();
    } catch (error) {
      console.error(`Failed to calculate next execution for schedule ${this.schedule_id}:`, error);
    }
  }

  public isExecutionDue(): boolean {
    if (!this.enabled || !this.next_execution) {
      return false;
    }
    return new Date() >= this.next_execution;
  }

  public async incrementExecutionCount(): Promise<void> {
    this.execution_count += 1;
    await this.save();
  }

  public async incrementFailureCount(): Promise<void> {
    this.failure_count += 1;
    await this.save();
  }

  public getRetryConfig() {
    return {
      max_attempts: 3,
      retry_delay: 5000,
      backoff_multiplier: 2,
      ...this.retry_config
    };
  }
}

ReportSchedule.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  schedule_id: {
    type: DataTypes.STRING(255),
    unique: true,
    allowNull: false
  },
  report_id: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  cron_expression: {
    type: DataTypes.STRING(255),
    allowNull: false,
    validate: {
      isCronExpression(value: string) {
        const cron = require('node-cron');
        if (!cron.validate(value)) {
          throw new Error('Invalid cron expression');
        }
      }
    }
  },
  timezone: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'UTC'
  },
  enabled: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true
  },
  delivery_config: {
    type: DataTypes.JSON,
    allowNull: false,
    validate: {
      hasValidMethods(value: any) {
        if (!value || !Array.isArray(value.methods) || value.methods.length === 0) {
          throw new Error('At least one delivery method must be configured');
        }

        const validTypes = ['email', 'file_storage', 'api_endpoint', 'webhook'];
        for (const method of value.methods) {
          if (!validTypes.includes(method.type)) {
            throw new Error(`Invalid delivery method type: ${method.type}`);
          }
        }
      }
    }
  },
  report_config: {
    type: DataTypes.JSON,
    allowNull: true
  },
  retry_config: {
    type: DataTypes.JSON,
    allowNull: true
  },
  next_execution: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_execution: {
    type: DataTypes.DATE,
    allowNull: true
  },
  execution_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
  },
  failure_count: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0
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
  },
  created_by: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  updated_by: {
    type: DataTypes.STRING(255),
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'ReportSchedule',
  tableName: 'report_schedules',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['schedule_id'], unique: true },
    { fields: ['report_id'] },
    { fields: ['enabled'] },
    { fields: ['next_execution'] },
    { fields: ['created_at'] }
  ]
});

// Import ScheduleExecution here to avoid circular dependencies
import { ScheduleExecution } from './ScheduleExecution';

// Define associations
ReportSchedule.hasMany(ScheduleExecution, {
  foreignKey: 'schedule_id',
  sourceKey: 'schedule_id',
  as: 'schedule_executions',
  onDelete: 'CASCADE'
});

export default ReportSchedule;