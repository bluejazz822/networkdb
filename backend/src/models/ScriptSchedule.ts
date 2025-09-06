import { DataTypes, Model, Optional, Association, BelongsToGetAssociationMixin, HasManyGetAssociationsMixin } from 'sequelize';
import { getDatabase } from '../config/database';

const sequelize = getDatabase();

/**
 * Schedule frequency types
 */
export enum ScheduleFrequency {
  ONCE = 'ONCE',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  YEARLY = 'YEARLY',
  CRON = 'CRON',
  INTERVAL = 'INTERVAL'
}

/**
 * Schedule status enumeration
 */
export enum ScheduleStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
  ERROR = 'ERROR'
}

/**
 * ScriptSchedule attributes interface
 */
export interface ScriptScheduleAttributes {
  id: string;
  scriptId: string;
  name: string;
  description?: string;
  frequency: ScheduleFrequency;
  cronExpression?: string;
  intervalMinutes?: number;
  scheduledAt?: Date;
  startDate?: Date;
  endDate?: Date;
  timezone: string;
  isActive: boolean;
  status: ScheduleStatus;
  parameters?: Record<string, any>;
  environment?: Record<string, string>;
  maxRetries: number;
  retryDelayMinutes: number;
  timeoutMinutes: number;
  priority: string;
  runOnWeekdays?: boolean;
  runOnWeekends?: boolean;
  allowConcurrentRuns: boolean;
  maxConcurrentRuns: number;
  onFailureAction?: 'CONTINUE' | 'PAUSE' | 'NOTIFY' | 'DISABLE';
  alertOnFailure: boolean;
  alertOnSuccess: boolean;
  alertEmails?: string[];
  lastRunAt?: Date;
  nextRunAt?: Date;
  runCount: number;
  successCount: number;
  failureCount: number;
  averageExecutionTime?: number;
  lastExecutionId?: string;
  createdBy: string;
  lastModifiedBy?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

/**
 * ScriptSchedule creation attributes (optional fields during creation)
 */
export interface ScriptScheduleCreationAttributes extends Optional<ScriptScheduleAttributes,
  'id' | 'cronExpression' | 'intervalMinutes' | 'scheduledAt' | 'startDate' | 'endDate' |
  'timezone' | 'isActive' | 'status' | 'parameters' | 'environment' | 'maxRetries' |
  'retryDelayMinutes' | 'timeoutMinutes' | 'priority' | 'runOnWeekdays' | 'runOnWeekends' |
  'allowConcurrentRuns' | 'maxConcurrentRuns' | 'onFailureAction' | 'alertOnFailure' |
  'alertOnSuccess' | 'alertEmails' | 'lastRunAt' | 'nextRunAt' | 'runCount' | 'successCount' |
  'failureCount' | 'averageExecutionTime' | 'lastExecutionId' | 'lastModifiedBy' |
  'metadata' | 'createdAt' | 'updatedAt' | 'deletedAt'
> {}

/**
 * ScriptSchedule model class
 */
export class ScriptSchedule extends Model<ScriptScheduleAttributes, ScriptScheduleCreationAttributes>
  implements ScriptScheduleAttributes {
  public id!: string;
  public scriptId!: string;
  public name!: string;
  public description?: string;
  public frequency!: ScheduleFrequency;
  public cronExpression?: string;
  public intervalMinutes?: number;
  public scheduledAt?: Date;
  public startDate?: Date;
  public endDate?: Date;
  public timezone!: string;
  public isActive!: boolean;
  public status!: ScheduleStatus;
  public parameters?: Record<string, any>;
  public environment?: Record<string, string>;
  public maxRetries!: number;
  public retryDelayMinutes!: number;
  public timeoutMinutes!: number;
  public priority!: string;
  public runOnWeekdays?: boolean;
  public runOnWeekends?: boolean;
  public allowConcurrentRuns!: boolean;
  public maxConcurrentRuns!: number;
  public onFailureAction?: 'CONTINUE' | 'PAUSE' | 'NOTIFY' | 'DISABLE';
  public alertOnFailure!: boolean;
  public alertOnSuccess!: boolean;
  public alertEmails?: string[];
  public lastRunAt?: Date;
  public nextRunAt?: Date;
  public runCount!: number;
  public successCount!: number;
  public failureCount!: number;
  public averageExecutionTime?: number;
  public lastExecutionId?: string;
  public createdBy!: string;
  public lastModifiedBy?: string;
  public metadata?: Record<string, any>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
  public readonly deletedAt?: Date;

  // Association mixins
  public getScript!: BelongsToGetAssociationMixin<any>;
  public getCreator!: BelongsToGetAssociationMixin<any>;
  public getLastModifier!: BelongsToGetAssociationMixin<any>;
  public getExecutions!: HasManyGetAssociationsMixin<any>;

  // Associations
  public static associations: {
    script: Association<ScriptSchedule, any>;
    creator: Association<ScriptSchedule, any>;
    lastModifier: Association<ScriptSchedule, any>;
    executions: Association<ScriptSchedule, any>;
  };

  /**
   * Check if schedule is currently active and should run
   */
  public get isRunnable(): boolean {
    const now = new Date();
    
    // Check basic active status
    if (!this.isActive || this.status !== ScheduleStatus.ACTIVE) {
      return false;
    }

    // Check date constraints
    if (this.startDate && now < this.startDate) {
      return false;
    }
    
    if (this.endDate && now > this.endDate) {
      return false;
    }

    // Check day-of-week constraints
    if (this.runOnWeekdays !== undefined || this.runOnWeekends !== undefined) {
      const dayOfWeek = now.getDay(); // 0 = Sunday, 6 = Saturday
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      
      if (isWeekend && this.runOnWeekends === false) {
        return false;
      }
      
      if (!isWeekend && this.runOnWeekdays === false) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get success rate percentage
   */
  public get successRate(): number {
    if (this.runCount === 0) return 0;
    return Math.round((this.successCount / this.runCount) * 100);
  }

  /**
   * Get failure rate percentage
   */
  public get failureRate(): number {
    if (this.runCount === 0) return 0;
    return Math.round((this.failureCount / this.runCount) * 100);
  }

  /**
   * Check if schedule has expired
   */
  public get hasExpired(): boolean {
    if (!this.endDate) return false;
    return new Date() > this.endDate;
  }

  /**
   * Check if schedule is overdue
   */
  public get isOverdue(): boolean {
    if (!this.nextRunAt || !this.isActive) return false;
    return new Date() > this.nextRunAt;
  }

  /**
   * Get human-readable schedule description
   */
  public get scheduleDescription(): string {
    switch (this.frequency) {
      case ScheduleFrequency.ONCE:
        return this.scheduledAt ? `Once on ${this.scheduledAt.toLocaleString()}` : 'Once (not scheduled)';
      
      case ScheduleFrequency.DAILY:
        return 'Daily';
      
      case ScheduleFrequency.WEEKLY:
        return 'Weekly';
      
      case ScheduleFrequency.MONTHLY:
        return 'Monthly';
      
      case ScheduleFrequency.YEARLY:
        return 'Yearly';
      
      case ScheduleFrequency.CRON:
        return this.cronExpression ? `Cron: ${this.cronExpression}` : 'Cron (no expression)';
      
      case ScheduleFrequency.INTERVAL:
        if (this.intervalMinutes) {
          if (this.intervalMinutes < 60) {
            return `Every ${this.intervalMinutes} minutes`;
          } else if (this.intervalMinutes < 1440) {
            return `Every ${Math.round(this.intervalMinutes / 60)} hours`;
          } else {
            return `Every ${Math.round(this.intervalMinutes / 1440)} days`;
          }
        }
        return 'Interval (not configured)';
      
      default:
        return 'Unknown frequency';
    }
  }

  /**
   * Calculate next run time based on frequency
   */
  public calculateNextRun(): Date | null {
    if (!this.isRunnable) {
      return null;
    }

    const now = new Date();
    const baseTime = this.lastRunAt || now;

    switch (this.frequency) {
      case ScheduleFrequency.ONCE:
        // For one-time schedules, return the scheduled time if it hasn't run yet
        return this.scheduledAt && !this.lastRunAt ? this.scheduledAt : null;

      case ScheduleFrequency.DAILY:
        const nextDay = new Date(baseTime);
        nextDay.setDate(nextDay.getDate() + 1);
        return nextDay;

      case ScheduleFrequency.WEEKLY:
        const nextWeek = new Date(baseTime);
        nextWeek.setDate(nextWeek.getDate() + 7);
        return nextWeek;

      case ScheduleFrequency.MONTHLY:
        const nextMonth = new Date(baseTime);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        return nextMonth;

      case ScheduleFrequency.YEARLY:
        const nextYear = new Date(baseTime);
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        return nextYear;

      case ScheduleFrequency.INTERVAL:
        if (!this.intervalMinutes) return null;
        const nextInterval = new Date(baseTime);
        nextInterval.setMinutes(nextInterval.getMinutes() + this.intervalMinutes);
        return nextInterval;

      case ScheduleFrequency.CRON:
        // For cron expressions, this would need a cron parser library
        // For now, return null and handle externally
        return null;

      default:
        return null;
    }
  }

  /**
   * Update schedule after execution
   */
  public async updateAfterExecution(
    executionId: string, 
    success: boolean, 
    executionTimeMs?: number
  ): Promise<void> {
    this.lastRunAt = new Date();
    this.lastExecutionId = executionId;
    this.runCount += 1;

    if (success) {
      this.successCount += 1;
    } else {
      this.failureCount += 1;
      
      // Handle failure actions
      switch (this.onFailureAction) {
        case 'PAUSE':
          this.status = ScheduleStatus.PAUSED;
          break;
        case 'DISABLE':
          this.isActive = false;
          this.status = ScheduleStatus.INACTIVE;
          break;
        case 'NOTIFY':
          // Notification would be handled externally
          break;
        case 'CONTINUE':
        default:
          // Continue as normal
          break;
      }
    }

    // Update average execution time
    if (executionTimeMs) {
      if (this.averageExecutionTime) {
        // Moving average calculation
        this.averageExecutionTime = Math.round(
          (this.averageExecutionTime * (this.runCount - 1) + executionTimeMs) / this.runCount
        );
      } else {
        this.averageExecutionTime = executionTimeMs;
      }
    }

    // Calculate next run
    this.nextRunAt = this.calculateNextRun();

    // Check if schedule has expired
    if (this.hasExpired) {
      this.status = ScheduleStatus.EXPIRED;
      this.isActive = false;
    }

    await this.save();
  }

  /**
   * Activate the schedule
   */
  public async activate(): Promise<void> {
    this.isActive = true;
    this.status = ScheduleStatus.ACTIVE;
    this.nextRunAt = this.calculateNextRun();
    await this.save();
  }

  /**
   * Deactivate the schedule
   */
  public async deactivate(): Promise<void> {
    this.isActive = false;
    this.status = ScheduleStatus.INACTIVE;
    this.nextRunAt = null;
    await this.save();
  }

  /**
   * Pause the schedule
   */
  public async pause(): Promise<void> {
    this.status = ScheduleStatus.PAUSED;
    await this.save();
  }

  /**
   * Resume the schedule
   */
  public async resume(): Promise<void> {
    if (this.isActive) {
      this.status = ScheduleStatus.ACTIVE;
      this.nextRunAt = this.calculateNextRun();
      await this.save();
    }
  }

  /**
   * Reset schedule statistics
   */
  public async resetStats(): Promise<void> {
    this.runCount = 0;
    this.successCount = 0;
    this.failureCount = 0;
    this.averageExecutionTime = undefined;
    this.lastRunAt = undefined;
    this.lastExecutionId = undefined;
    await this.save();
  }

  /**
   * Validate schedule configuration
   */
  public validateSchedule(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Validate frequency-specific requirements
    switch (this.frequency) {
      case ScheduleFrequency.ONCE:
        if (!this.scheduledAt) {
          errors.push('scheduledAt is required for one-time schedules');
        }
        break;

      case ScheduleFrequency.CRON:
        if (!this.cronExpression) {
          errors.push('cronExpression is required for cron schedules');
        }
        // Here you could add cron expression validation
        break;

      case ScheduleFrequency.INTERVAL:
        if (!this.intervalMinutes || this.intervalMinutes <= 0) {
          errors.push('intervalMinutes must be greater than 0 for interval schedules');
        }
        break;
    }

    // Validate date constraints
    if (this.startDate && this.endDate && this.startDate >= this.endDate) {
      errors.push('startDate must be before endDate');
    }

    // Validate retry configuration
    if (this.retryDelayMinutes < 0) {
      errors.push('retryDelayMinutes cannot be negative');
    }

    if (this.maxRetries < 0) {
      errors.push('maxRetries cannot be negative');
    }

    if (this.timeoutMinutes <= 0) {
      errors.push('timeoutMinutes must be greater than 0');
    }

    // Validate concurrent runs
    if (this.maxConcurrentRuns < 1) {
      errors.push('maxConcurrentRuns must be at least 1');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Create a copy of this schedule
   */
  public async duplicate(
    name: string, 
    createdBy: string,
    modifications?: Partial<ScriptScheduleCreationAttributes>
  ): Promise<ScriptSchedule> {
    const scheduleData = {
      ...this.toJSON(),
      id: undefined, // Generate new ID
      name: name,
      createdBy: createdBy,
      lastModifiedBy: undefined,
      runCount: 0,
      successCount: 0,
      failureCount: 0,
      averageExecutionTime: undefined,
      lastRunAt: undefined,
      lastExecutionId: undefined,
      nextRunAt: undefined,
      createdAt: undefined,
      updatedAt: undefined,
      deletedAt: undefined,
      ...modifications
    };

    const duplicate = await ScriptSchedule.create(scheduleData);
    await duplicate.activate(); // Calculate initial nextRunAt
    
    return duplicate;
  }

  /**
   * Serialize schedule for JSON (exclude sensitive data if needed)
   */
  public toJSON(): any {
    const values = super.toJSON();
    return values;
  }
}

// Initialize the ScriptSchedule model
ScriptSchedule.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  scriptId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Reference to the script to be scheduled'
  },
  name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Schedule name cannot be empty'
      },
      len: {
        args: [3, 150],
        msg: 'Schedule name must be between 3 and 150 characters'
      }
    },
    comment: 'Human-readable schedule name'
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Schedule description and purpose'
  },
  frequency: {
    type: DataTypes.ENUM(...Object.values(ScheduleFrequency)),
    allowNull: false,
    comment: 'Schedule frequency type'
  },
  cronExpression: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Cron expression for CRON frequency type'
  },
  intervalMinutes: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: {
        args: [1],
        msg: 'Interval must be at least 1 minute'
      }
    },
    comment: 'Interval in minutes for INTERVAL frequency type'
  },
  scheduledAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Specific datetime for ONCE frequency type'
  },
  startDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Schedule start date (optional)'
  },
  endDate: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Schedule end date (optional)'
  },
  timezone: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'UTC',
    comment: 'Timezone for schedule execution'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether schedule is active'
  },
  status: {
    type: DataTypes.ENUM(...Object.values(ScheduleStatus)),
    allowNull: false,
    defaultValue: ScheduleStatus.ACTIVE,
    comment: 'Current schedule status'
  },
  parameters: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Parameters to pass to script execution'
  },
  environment: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Environment variables for script execution'
  },
  maxRetries: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 3,
    validate: {
      min: {
        args: [0],
        msg: 'Max retries cannot be negative'
      },
      max: {
        args: [10],
        msg: 'Max retries cannot exceed 10'
      }
    },
    comment: 'Maximum retry attempts on failure'
  },
  retryDelayMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    validate: {
      min: {
        args: [0],
        msg: 'Retry delay cannot be negative'
      }
    },
    comment: 'Delay between retry attempts in minutes'
  },
  timeoutMinutes: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 60,
    validate: {
      min: {
        args: [1],
        msg: 'Timeout must be at least 1 minute'
      },
      max: {
        args: [1440],
        msg: 'Timeout cannot exceed 24 hours'
      }
    },
    comment: 'Execution timeout in minutes'
  },
  priority: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'NORMAL',
    validate: {
      isIn: {
        args: [['LOW', 'NORMAL', 'HIGH', 'CRITICAL']],
        msg: 'Priority must be one of: LOW, NORMAL, HIGH, CRITICAL'
      }
    },
    comment: 'Execution priority'
  },
  runOnWeekdays: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    comment: 'Whether to run on weekdays (Mon-Fri)'
  },
  runOnWeekends: {
    type: DataTypes.BOOLEAN,
    allowNull: true,
    comment: 'Whether to run on weekends (Sat-Sun)'
  },
  allowConcurrentRuns: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether to allow concurrent executions'
  },
  maxConcurrentRuns: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
    validate: {
      min: {
        args: [1],
        msg: 'Max concurrent runs must be at least 1'
      },
      max: {
        args: [10],
        msg: 'Max concurrent runs cannot exceed 10'
      }
    },
    comment: 'Maximum number of concurrent executions'
  },
  onFailureAction: {
    type: DataTypes.ENUM('CONTINUE', 'PAUSE', 'NOTIFY', 'DISABLE'),
    allowNull: true,
    comment: 'Action to take on execution failure'
  },
  alertOnFailure: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Whether to send alerts on execution failure'
  },
  alertOnSuccess: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Whether to send alerts on execution success'
  },
  alertEmails: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Email addresses for alerts'
  },
  lastRunAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Last execution timestamp'
  },
  nextRunAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Next scheduled execution timestamp'
  },
  runCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: {
        args: [0],
        msg: 'Run count cannot be negative'
      }
    },
    comment: 'Total number of executions'
  },
  successCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: {
        args: [0],
        msg: 'Success count cannot be negative'
      }
    },
    comment: 'Number of successful executions'
  },
  failureCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: {
        args: [0],
        msg: 'Failure count cannot be negative'
      }
    },
    comment: 'Number of failed executions'
  },
  averageExecutionTime: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Average execution time in milliseconds'
  },
  lastExecutionId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'ID of the last execution'
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'User who created the schedule'
  },
  lastModifiedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'User who last modified the schedule'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional schedule metadata'
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  deletedAt: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  sequelize,
  tableName: 'script_schedules',
  modelName: 'ScriptSchedule',
  timestamps: true,
  paranoid: true, // Enables soft deletes
  indexes: [
    {
      fields: ['scriptId'],
      name: 'idx_script_schedules_script_id'
    },
    {
      fields: ['name'],
      name: 'idx_script_schedules_name'
    },
    {
      fields: ['scriptId', 'name'],
      unique: true,
      where: {
        deletedAt: null
      },
      name: 'idx_script_schedules_script_name_unique'
    },
    {
      fields: ['frequency'],
      name: 'idx_script_schedules_frequency'
    },
    {
      fields: ['isActive'],
      name: 'idx_script_schedules_is_active'
    },
    {
      fields: ['status'],
      name: 'idx_script_schedules_status'
    },
    {
      fields: ['nextRunAt'],
      name: 'idx_script_schedules_next_run_at'
    },
    {
      fields: ['lastRunAt'],
      name: 'idx_script_schedules_last_run_at'
    },
    {
      fields: ['createdBy'],
      name: 'idx_script_schedules_created_by'
    },
    {
      fields: ['lastModifiedBy'],
      name: 'idx_script_schedules_last_modified_by'
    },
    {
      fields: ['startDate'],
      name: 'idx_script_schedules_start_date'
    },
    {
      fields: ['endDate'],
      name: 'idx_script_schedules_end_date'
    },
    {
      fields: ['timezone'],
      name: 'idx_script_schedules_timezone'
    },
    {
      fields: ['priority'],
      name: 'idx_script_schedules_priority'
    },
    {
      fields: ['isActive', 'status', 'nextRunAt'],
      name: 'idx_script_schedules_runnable'
    },
    {
      fields: ['createdAt'],
      name: 'idx_script_schedules_created_at'
    },
    {
      fields: ['updatedAt'],
      name: 'idx_script_schedules_updated_at'
    },
    {
      fields: ['deletedAt'],
      name: 'idx_script_schedules_deleted_at'
    }
  ],
  hooks: {
    beforeCreate: async (schedule: ScriptSchedule) => {
      // Set initial nextRunAt if not provided
      if (!schedule.nextRunAt && schedule.isActive) {
        schedule.nextRunAt = schedule.calculateNextRun();
      }
    },
    beforeUpdate: async (schedule: ScriptSchedule) => {
      // Recalculate nextRunAt if frequency or active status changed
      if (schedule.changed('frequency') || schedule.changed('isActive') || 
          schedule.changed('cronExpression') || schedule.changed('intervalMinutes') ||
          schedule.changed('scheduledAt')) {
        schedule.nextRunAt = schedule.calculateNextRun();
      }
    }
  },
  scopes: {
    active: {
      where: {
        isActive: true,
        status: ScheduleStatus.ACTIVE,
        deletedAt: null
      }
    },
    runnable: {
      where: {
        isActive: true,
        status: ScheduleStatus.ACTIVE,
        nextRunAt: {
          [sequelize.Op.lte]: new Date()
        },
        deletedAt: null
      }
    },
    byScript: (scriptId: string) => ({
      where: {
        scriptId: scriptId,
        deletedAt: null
      }
    }),
    byFrequency: (frequency: ScheduleFrequency) => ({
      where: {
        frequency: frequency
      }
    }),
    byStatus: (status: ScheduleStatus) => ({
      where: {
        status: status
      }
    }),
    byCreator: (createdBy: string) => ({
      where: {
        createdBy: createdBy
      }
    }),
    expired: {
      where: {
        endDate: {
          [sequelize.Op.lt]: new Date()
        }
      }
    },
    overdue: {
      where: {
        isActive: true,
        nextRunAt: {
          [sequelize.Op.lt]: new Date()
        }
      }
    },
    withoutDeleted: {
      where: {
        deletedAt: null
      }
    }
  }
});

export default ScriptSchedule;