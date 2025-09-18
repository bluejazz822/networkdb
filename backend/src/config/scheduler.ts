/**
 * Scheduler Configuration
 * Centralized configuration for cron jobs and polling services
 * Handles job locking, scheduling patterns, and service lifecycle
 */

export interface SchedulerConfig {
  enabled: boolean;
  timezone: string;
  jobs: {
    workflowPolling: {
      enabled: boolean;
      schedule: string;
      maxDurationMinutes: number;
      lockTimeoutMinutes: number;
      retryAttempts: number;
      batchSize: number;
      maxConcurrentPolls: number;
    };
  };
  lockMechanism: {
    type: 'memory' | 'redis' | 'database';
    ttlMinutes: number;
    cleanupIntervalMinutes: number;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
    logJobStart: boolean;
    logJobEnd: boolean;
    logJobErrors: boolean;
  };
}

/**
 * Default scheduler configuration
 */
export const defaultSchedulerConfig: SchedulerConfig = {
  enabled: process.env.SCHEDULER_ENABLED !== 'false',
  timezone: process.env.SCHEDULER_TIMEZONE || 'UTC',
  jobs: {
    workflowPolling: {
      enabled: process.env.WORKFLOW_POLLING_ENABLED !== 'false',
      schedule: process.env.WORKFLOW_POLLING_SCHEDULE || '0 */1 * * *', // Every hour
      maxDurationMinutes: parseInt(process.env.WORKFLOW_POLLING_MAX_DURATION || '30', 10),
      lockTimeoutMinutes: parseInt(process.env.WORKFLOW_POLLING_LOCK_TIMEOUT || '35', 10),
      retryAttempts: parseInt(process.env.WORKFLOW_POLLING_RETRY_ATTEMPTS || '3', 10),
      batchSize: parseInt(process.env.WORKFLOW_POLLING_BATCH_SIZE || '10', 10),
      maxConcurrentPolls: parseInt(process.env.WORKFLOW_POLLING_MAX_CONCURRENT || '5', 10)
    }
  },
  lockMechanism: {
    type: (process.env.SCHEDULER_LOCK_TYPE as 'memory' | 'redis' | 'database') || 'memory',
    ttlMinutes: parseInt(process.env.SCHEDULER_LOCK_TTL_MINUTES || '60', 10),
    cleanupIntervalMinutes: parseInt(process.env.SCHEDULER_LOCK_CLEANUP_INTERVAL || '30', 10)
  },
  logging: {
    level: (process.env.SCHEDULER_LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || 'info',
    logJobStart: process.env.SCHEDULER_LOG_JOB_START !== 'false',
    logJobEnd: process.env.SCHEDULER_LOG_JOB_END !== 'false',
    logJobErrors: process.env.SCHEDULER_LOG_JOB_ERRORS !== 'false'
  }
};

/**
 * Job lock interface for preventing overlapping executions
 */
export interface JobLock {
  jobName: string;
  lockedAt: Date;
  lockedBy: string;
  expiresAt: Date;
  metadata?: any;
}

/**
 * Job execution result interface
 */
export interface JobExecutionResult {
  jobName: string;
  startTime: Date;
  endTime: Date;
  success: boolean;
  error?: string;
  metadata?: any;
  duration: number;
}

/**
 * In-memory job lock manager
 * Simple implementation for single-instance deployments
 */
export class MemoryJobLockManager {
  private locks = new Map<string, JobLock>();
  private readonly instanceId: string;

  constructor() {
    this.instanceId = `instance-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.startCleanupTimer();
  }

  /**
   * Acquire a job lock
   */
  async acquireLock(jobName: string, ttlMinutes: number = 60): Promise<boolean> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes * 60 * 1000);

    // Check if lock already exists and is not expired
    const existingLock = this.locks.get(jobName);
    if (existingLock && existingLock.expiresAt > now) {
      return false; // Lock is held by someone else
    }

    // Acquire the lock
    const lock: JobLock = {
      jobName,
      lockedAt: now,
      lockedBy: this.instanceId,
      expiresAt
    };

    this.locks.set(jobName, lock);
    return true;
  }

  /**
   * Release a job lock
   */
  async releaseLock(jobName: string): Promise<boolean> {
    const lock = this.locks.get(jobName);
    if (lock && lock.lockedBy === this.instanceId) {
      this.locks.delete(jobName);
      return true;
    }
    return false;
  }

  /**
   * Check if a job is currently locked
   */
  async isLocked(jobName: string): Promise<boolean> {
    const lock = this.locks.get(jobName);
    if (!lock) return false;

    const now = new Date();
    if (lock.expiresAt <= now) {
      this.locks.delete(jobName);
      return false;
    }

    return true;
  }

  /**
   * Get lock information
   */
  async getLockInfo(jobName: string): Promise<JobLock | null> {
    const lock = this.locks.get(jobName);
    if (!lock) return null;

    const now = new Date();
    if (lock.expiresAt <= now) {
      this.locks.delete(jobName);
      return null;
    }

    return lock;
  }

  /**
   * Get all active locks
   */
  async getActiveLocks(): Promise<JobLock[]> {
    const now = new Date();
    const activeLocks: JobLock[] = [];

    for (const [jobName, lock] of this.locks.entries()) {
      if (lock.expiresAt > now) {
        activeLocks.push(lock);
      } else {
        this.locks.delete(jobName);
      }
    }

    return activeLocks;
  }

  /**
   * Clean up expired locks periodically
   */
  private startCleanupTimer(): void {
    const cleanupInterval = defaultSchedulerConfig.lockMechanism.cleanupIntervalMinutes * 60 * 1000;

    setInterval(() => {
      const now = new Date();
      let cleanedCount = 0;

      for (const [jobName, lock] of this.locks.entries()) {
        if (lock.expiresAt <= now) {
          this.locks.delete(jobName);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0 && defaultSchedulerConfig.logging.level === 'debug') {
        console.log(`[SchedulerLockManager] Cleaned up ${cleanedCount} expired locks`);
      }
    }, cleanupInterval);
  }

  /**
   * Cleanup all locks for graceful shutdown
   */
  async cleanup(): Promise<void> {
    // Release all locks held by this instance
    for (const [jobName, lock] of this.locks.entries()) {
      if (lock.lockedBy === this.instanceId) {
        this.locks.delete(jobName);
      }
    }
  }
}

/**
 * Create job lock manager based on configuration
 */
export function createJobLockManager(): MemoryJobLockManager {
  // For now, only implement memory-based locking
  // TODO: Add Redis and database-based locking for distributed deployments
  return new MemoryJobLockManager();
}

/**
 * Utility functions for cron expressions
 */
export const CronExpressions = {
  EVERY_MINUTE: '*/1 * * * *',
  EVERY_5_MINUTES: '*/5 * * * *',
  EVERY_15_MINUTES: '*/15 * * * *',
  EVERY_30_MINUTES: '*/30 * * * *',
  EVERY_HOUR: '0 */1 * * *',
  EVERY_2_HOURS: '0 */2 * * *',
  EVERY_6_HOURS: '0 */6 * * *',
  EVERY_12_HOURS: '0 */12 * * *',
  DAILY_AT_MIDNIGHT: '0 0 * * *',
  DAILY_AT_2AM: '0 2 * * *',
  WEEKLY_SUNDAY_2AM: '0 2 * * 0',
  MONTHLY_FIRST_2AM: '0 2 1 * *'
};

/**
 * Validate cron expression
 */
export function validateCronExpression(expression: string): boolean {
  // Basic validation for cron expression format
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) {
    return false;
  }

  // This is a simplified validation - in production, you might want to use a proper cron validator
  return parts.every(part => {
    return /^(\*|[0-9,-/]+)$/.test(part);
  });
}

/**
 * Get scheduler configuration with environment overrides
 */
export function getSchedulerConfig(): SchedulerConfig {
  return {
    ...defaultSchedulerConfig,
    // Environment overrides can be added here if needed
  };
}

/**
 * Log scheduler operations based on configuration
 */
export function logSchedulerOperation(
  level: 'debug' | 'info' | 'warn' | 'error',
  operation: string,
  details: any = {}
): void {
  const config = getSchedulerConfig();
  const logLevels = ['debug', 'info', 'warn', 'error'];
  const configLevel = logLevels.indexOf(config.logging.level);
  const messageLevel = logLevels.indexOf(level);

  if (messageLevel >= configLevel) {
    const timestamp = new Date().toISOString();
    const message = `[Scheduler] ${operation}`;

    switch (level) {
      case 'debug':
        console.debug(`${timestamp} DEBUG ${message}:`, details);
        break;
      case 'info':
        console.log(`${timestamp} INFO ${message}:`, details);
        break;
      case 'warn':
        console.warn(`${timestamp} WARN ${message}:`, details);
        break;
      case 'error':
        console.error(`${timestamp} ERROR ${message}:`, details);
        break;
    }
  }
}