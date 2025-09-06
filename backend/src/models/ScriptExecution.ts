import { DataTypes, Model, Optional, Association, BelongsToGetAssociationMixin } from 'sequelize';
import { getDatabase } from '../config/database';

const sequelize = getDatabase();

/**
 * Script execution status enumeration
 */
export enum ScriptExecutionStatus {
  PENDING = 'PENDING',
  QUEUED = 'QUEUED',
  RUNNING = 'RUNNING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
  TIMEOUT = 'TIMEOUT',
  KILLED = 'KILLED'
}

/**
 * Script execution priority enumeration
 */
export enum ScriptExecutionPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

/**
 * ScriptExecution attributes interface
 */
export interface ScriptExecutionAttributes {
  id: string;
  scriptId: string;
  scheduleId?: string;
  executorId: string;
  status: ScriptExecutionStatus;
  priority: ScriptExecutionPriority;
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  duration?: number;
  parameters?: Record<string, any>;
  environment?: Record<string, string>;
  workingDirectory?: string;
  containerId?: string;
  processId?: number;
  exitCode?: number;
  stdout?: string;
  stderr?: string;
  logs?: string;
  error?: string;
  resourceUsage?: {
    maxMemoryMB?: number;
    maxCpuPercent?: number;
    diskUsedMB?: number;
    networkBytesIn?: number;
    networkBytesOut?: number;
  };
  output?: Record<string, any>;
  artifacts?: string[];
  retryCount: number;
  maxRetries: number;
  retryReason?: string;
  parentExecutionId?: string;
  childExecutionIds?: string[];
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ScriptExecution creation attributes (optional fields during creation)
 */
export interface ScriptExecutionCreationAttributes extends Optional<ScriptExecutionAttributes,
  'id' | 'status' | 'priority' | 'queuedAt' | 'startedAt' | 'completedAt' | 'duration' |
  'parameters' | 'environment' | 'workingDirectory' | 'containerId' | 'processId' | 
  'exitCode' | 'stdout' | 'stderr' | 'logs' | 'error' | 'resourceUsage' | 'output' | 
  'artifacts' | 'retryCount' | 'maxRetries' | 'retryReason' | 'parentExecutionId' | 
  'childExecutionIds' | 'metadata' | 'createdAt' | 'updatedAt'
> {}

/**
 * ScriptExecution model class
 */
export class ScriptExecution extends Model<ScriptExecutionAttributes, ScriptExecutionCreationAttributes>
  implements ScriptExecutionAttributes {
  public id!: string;
  public scriptId!: string;
  public scheduleId?: string;
  public executorId!: string;
  public status!: ScriptExecutionStatus;
  public priority!: ScriptExecutionPriority;
  public queuedAt!: Date;
  public startedAt?: Date;
  public completedAt?: Date;
  public duration?: number;
  public parameters?: Record<string, any>;
  public environment?: Record<string, string>;
  public workingDirectory?: string;
  public containerId?: string;
  public processId?: number;
  public exitCode?: number;
  public stdout?: string;
  public stderr?: string;
  public logs?: string;
  public error?: string;
  public resourceUsage?: {
    maxMemoryMB?: number;
    maxCpuPercent?: number;
    diskUsedMB?: number;
    networkBytesIn?: number;
    networkBytesOut?: number;
  };
  public output?: Record<string, any>;
  public artifacts?: string[];
  public retryCount!: number;
  public maxRetries!: number;
  public retryReason?: string;
  public parentExecutionId?: string;
  public childExecutionIds?: string[];
  public metadata?: Record<string, any>;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Association mixins
  public getScript!: BelongsToGetAssociationMixin<any>;
  public getSchedule!: BelongsToGetAssociationMixin<any>;
  public getExecutor!: BelongsToGetAssociationMixin<any>;
  public getParentExecution!: BelongsToGetAssociationMixin<ScriptExecution>;
  public getChildExecutions!: BelongsToGetAssociationMixin<ScriptExecution>;

  // Associations
  public static associations: {
    script: Association<ScriptExecution, any>;
    schedule: Association<ScriptExecution, any>;
    executor: Association<ScriptExecution, any>;
    parentExecution: Association<ScriptExecution, ScriptExecution>;
    childExecutions: Association<ScriptExecution, ScriptExecution>;
  };

  /**
   * Check if execution is in a terminal state
   */
  public get isTerminal(): boolean {
    return [
      ScriptExecutionStatus.COMPLETED,
      ScriptExecutionStatus.FAILED,
      ScriptExecutionStatus.CANCELLED,
      ScriptExecutionStatus.TIMEOUT,
      ScriptExecutionStatus.KILLED
    ].includes(this.status);
  }

  /**
   * Check if execution is running
   */
  public get isRunning(): boolean {
    return [
      ScriptExecutionStatus.QUEUED,
      ScriptExecutionStatus.RUNNING
    ].includes(this.status);
  }

  /**
   * Check if execution was successful
   */
  public get isSuccessful(): boolean {
    return this.status === ScriptExecutionStatus.COMPLETED && 
           (this.exitCode === undefined || this.exitCode === 0);
  }

  /**
   * Check if execution failed
   */
  public get isFailed(): boolean {
    return this.status === ScriptExecutionStatus.FAILED ||
           (this.status === ScriptExecutionStatus.COMPLETED && this.exitCode !== 0);
  }

  /**
   * Check if execution can be retried
   */
  public get canRetry(): boolean {
    return this.isTerminal && 
           this.isFailed && 
           this.retryCount < this.maxRetries;
  }

  /**
   * Get execution runtime duration in milliseconds
   */
  public get runtimeDuration(): number | null {
    if (!this.startedAt) return null;
    const endTime = this.completedAt || new Date();
    return endTime.getTime() - this.startedAt.getTime();
  }

  /**
   * Get total time in queue in milliseconds
   */
  public get queueDuration(): number | null {
    if (!this.startedAt) {
      // Still queued
      return new Date().getTime() - this.queuedAt.getTime();
    }
    return this.startedAt.getTime() - this.queuedAt.getTime();
  }

  /**
   * Get formatted execution summary
   */
  public get summary(): string {
    const duration = this.runtimeDuration;
    const durationStr = duration ? `${Math.round(duration / 1000)}s` : 'N/A';
    return `${this.status} in ${durationStr} (Exit: ${this.exitCode || 'N/A'})`;
  }

  /**
   * Start the execution
   */
  public async start(containerId?: string, processId?: number): Promise<void> {
    this.status = ScriptExecutionStatus.RUNNING;
    this.startedAt = new Date();
    this.containerId = containerId;
    this.processId = processId;
    await this.save();
  }

  /**
   * Complete the execution successfully
   */
  public async complete(
    exitCode: number = 0,
    stdout?: string,
    stderr?: string,
    output?: Record<string, any>,
    artifacts?: string[]
  ): Promise<void> {
    this.status = exitCode === 0 ? ScriptExecutionStatus.COMPLETED : ScriptExecutionStatus.FAILED;
    this.completedAt = new Date();
    this.exitCode = exitCode;
    this.stdout = stdout;
    this.stderr = stderr;
    this.output = output;
    this.artifacts = artifacts || [];
    
    if (this.startedAt) {
      this.duration = this.completedAt.getTime() - this.startedAt.getTime();
    }
    
    await this.save();
  }

  /**
   * Fail the execution with error details
   */
  public async fail(error: string, stderr?: string, exitCode?: number): Promise<void> {
    this.status = ScriptExecutionStatus.FAILED;
    this.completedAt = new Date();
    this.error = error;
    this.stderr = stderr;
    this.exitCode = exitCode;
    
    if (this.startedAt) {
      this.duration = this.completedAt.getTime() - this.startedAt.getTime();
    }
    
    await this.save();
  }

  /**
   * Cancel the execution
   */
  public async cancel(reason?: string): Promise<void> {
    this.status = ScriptExecutionStatus.CANCELLED;
    this.completedAt = new Date();
    this.error = reason || 'Execution cancelled by user';
    
    if (this.startedAt) {
      this.duration = this.completedAt.getTime() - this.startedAt.getTime();
    }
    
    await this.save();
  }

  /**
   * Mark execution as timed out
   */
  public async timeout(): Promise<void> {
    this.status = ScriptExecutionStatus.TIMEOUT;
    this.completedAt = new Date();
    this.error = 'Execution exceeded maximum allowed time';
    
    if (this.startedAt) {
      this.duration = this.completedAt.getTime() - this.startedAt.getTime();
    }
    
    await this.save();
  }

  /**
   * Kill the execution forcefully
   */
  public async kill(reason?: string): Promise<void> {
    this.status = ScriptExecutionStatus.KILLED;
    this.completedAt = new Date();
    this.error = reason || 'Execution was killed';
    
    if (this.startedAt) {
      this.duration = this.completedAt.getTime() - this.startedAt.getTime();
    }
    
    await this.save();
  }

  /**
   * Update resource usage statistics
   */
  public async updateResourceUsage(usage: {
    maxMemoryMB?: number;
    maxCpuPercent?: number;
    diskUsedMB?: number;
    networkBytesIn?: number;
    networkBytesOut?: number;
  }): Promise<void> {
    this.resourceUsage = {
      ...this.resourceUsage,
      ...usage
    };
    await this.save();
  }

  /**
   * Append to execution logs
   */
  public async appendLogs(newLogs: string): Promise<void> {
    this.logs = (this.logs || '') + newLogs;
    await this.save();
  }

  /**
   * Create a retry execution
   */
  public async createRetry(reason: string): Promise<ScriptExecution> {
    if (!this.canRetry) {
      throw new Error('Execution cannot be retried');
    }

    const retryExecution = await ScriptExecution.create({
      scriptId: this.scriptId,
      scheduleId: this.scheduleId,
      executorId: this.executorId,
      priority: this.priority,
      parameters: this.parameters,
      environment: this.environment,
      retryCount: this.retryCount + 1,
      maxRetries: this.maxRetries,
      retryReason: reason,
      parentExecutionId: this.parentExecutionId || this.id,
      metadata: {
        ...this.metadata,
        retryOf: this.id,
        originalExecutionId: this.parentExecutionId || this.id
      }
    });

    // Update child execution references
    if (!this.childExecutionIds) {
      this.childExecutionIds = [];
    }
    this.childExecutionIds.push(retryExecution.id);
    await this.save();

    return retryExecution;
  }

  /**
   * Serialize execution for JSON (optionally exclude large fields)
   */
  public toJSON(): any {
    const values = super.toJSON();
    
    // Optionally truncate large text fields for API responses
    if (values.stdout && values.stdout.length > 10000) {
      values.stdout = values.stdout.substring(0, 10000) + '\n... (truncated)';
    }
    if (values.stderr && values.stderr.length > 10000) {
      values.stderr = values.stderr.substring(0, 10000) + '\n... (truncated)';
    }
    if (values.logs && values.logs.length > 50000) {
      values.logs = values.logs.substring(0, 50000) + '\n... (truncated)';
    }
    
    return values;
  }

  /**
   * Get minimal execution info for lists
   */
  public toSummary(): Pick<ScriptExecutionAttributes, 'id' | 'status' | 'priority' | 'queuedAt' | 'startedAt' | 'completedAt' | 'duration' | 'exitCode'> {
    return {
      id: this.id,
      status: this.status,
      priority: this.priority,
      queuedAt: this.queuedAt,
      startedAt: this.startedAt,
      completedAt: this.completedAt,
      duration: this.duration,
      exitCode: this.exitCode
    };
  }
}

// Initialize the ScriptExecution model
ScriptExecution.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  scriptId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'Reference to the script being executed'
  },
  scheduleId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Reference to schedule if this is a scheduled execution'
  },
  executorId: {
    type: DataTypes.UUID,
    allowNull: false,
    comment: 'User who triggered the execution'
  },
  status: {
    type: DataTypes.ENUM(...Object.values(ScriptExecutionStatus)),
    allowNull: false,
    defaultValue: ScriptExecutionStatus.PENDING,
    comment: 'Current execution status'
  },
  priority: {
    type: DataTypes.ENUM(...Object.values(ScriptExecutionPriority)),
    allowNull: false,
    defaultValue: ScriptExecutionPriority.NORMAL,
    comment: 'Execution priority level'
  },
  queuedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    comment: 'When execution was added to queue'
  },
  startedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When execution actually started'
  },
  completedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'When execution completed (success or failure)'
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Execution duration in milliseconds'
  },
  parameters: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Parameters passed to script execution'
  },
  environment: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Environment variables for script execution'
  },
  workingDirectory: {
    type: DataTypes.STRING(500),
    allowNull: true,
    comment: 'Working directory for script execution'
  },
  containerId: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Docker container ID for sandboxed execution'
  },
  processId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Process ID of executing script'
  },
  exitCode: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Script exit code (0 = success)'
  },
  stdout: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    comment: 'Standard output from script execution'
  },
  stderr: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    comment: 'Standard error from script execution'
  },
  logs: {
    type: DataTypes.TEXT('long'),
    allowNull: true,
    comment: 'Combined execution logs'
  },
  error: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Error message if execution failed'
  },
  resourceUsage: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Resource usage statistics during execution'
  },
  output: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Structured output data from script'
  },
  artifacts: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'List of generated artifact file paths'
  },
  retryCount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: {
      min: {
        args: [0],
        msg: 'Retry count cannot be negative'
      }
    },
    comment: 'Number of retry attempts made'
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
    comment: 'Maximum number of retry attempts allowed'
  },
  retryReason: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Reason for retry attempt'
  },
  parentExecutionId: {
    type: DataTypes.UUID,
    allowNull: true,
    comment: 'Parent execution if this is a retry'
  },
  childExecutionIds: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Child execution IDs (retries)'
  },
  metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Additional execution metadata'
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
  }
}, {
  sequelize,
  tableName: 'script_executions',
  modelName: 'ScriptExecution',
  timestamps: true,
  indexes: [
    {
      fields: ['scriptId'],
      name: 'idx_script_executions_script_id'
    },
    {
      fields: ['scheduleId'],
      name: 'idx_script_executions_schedule_id'
    },
    {
      fields: ['executorId'],
      name: 'idx_script_executions_executor_id'
    },
    {
      fields: ['status'],
      name: 'idx_script_executions_status'
    },
    {
      fields: ['priority'],
      name: 'idx_script_executions_priority'
    },
    {
      fields: ['queuedAt'],
      name: 'idx_script_executions_queued_at'
    },
    {
      fields: ['startedAt'],
      name: 'idx_script_executions_started_at'
    },
    {
      fields: ['completedAt'],
      name: 'idx_script_executions_completed_at'
    },
    {
      fields: ['exitCode'],
      name: 'idx_script_executions_exit_code'
    },
    {
      fields: ['retryCount'],
      name: 'idx_script_executions_retry_count'
    },
    {
      fields: ['parentExecutionId'],
      name: 'idx_script_executions_parent_execution_id'
    },
    {
      fields: ['containerId'],
      name: 'idx_script_executions_container_id'
    },
    {
      fields: ['status', 'queuedAt'],
      name: 'idx_script_executions_status_queued'
    },
    {
      fields: ['scriptId', 'completedAt'],
      name: 'idx_script_executions_script_completed'
    },
    {
      fields: ['executorId', 'createdAt'],
      name: 'idx_script_executions_executor_created'
    },
    {
      fields: ['createdAt'],
      name: 'idx_script_executions_created_at'
    },
    {
      fields: ['updatedAt'],
      name: 'idx_script_executions_updated_at'
    }
  ],
  scopes: {
    running: {
      where: {
        status: [ScriptExecutionStatus.QUEUED, ScriptExecutionStatus.RUNNING]
      }
    },
    terminal: {
      where: {
        status: [
          ScriptExecutionStatus.COMPLETED,
          ScriptExecutionStatus.FAILED,
          ScriptExecutionStatus.CANCELLED,
          ScriptExecutionStatus.TIMEOUT,
          ScriptExecutionStatus.KILLED
        ]
      }
    },
    successful: {
      where: {
        status: ScriptExecutionStatus.COMPLETED,
        exitCode: [0, null]
      }
    },
    failed: {
      where: {
        status: [ScriptExecutionStatus.FAILED, ScriptExecutionStatus.TIMEOUT, ScriptExecutionStatus.KILLED]
      }
    },
    byScript: (scriptId: string) => ({
      where: {
        scriptId: scriptId
      }
    }),
    byExecutor: (executorId: string) => ({
      where: {
        executorId: executorId
      }
    }),
    recent: {
      order: [['createdAt', 'DESC']],
      limit: 100
    }
  }
});

export default ScriptExecution;