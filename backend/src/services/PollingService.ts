/**
 * Polling Service
 * High-level service that manages cron-based workflow polling using node-cron
 * Provides job scheduling, lifecycle management, and graceful shutdown handling
 */

import * as cron from 'node-cron';
import { WorkflowPollingJob, WorkflowPollingOptions, PollingResult } from '../jobs/WorkflowPollingJob';
import {
  getSchedulerConfig,
  createJobLockManager,
  MemoryJobLockManager,
  JobExecutionResult,
  logSchedulerOperation,
  validateCronExpression
} from '../config/scheduler';

export interface PollingServiceConfig {
  enabled: boolean;
  cronSchedule: string;
  maxDurationMinutes: number;
  retryAttempts: number;
  retryDelayMinutes: number;
  pollingOptions: WorkflowPollingOptions;
  healthCheckIntervalMinutes?: number;
}

export interface ServiceStatus {
  running: boolean;
  scheduled: boolean;
  nextRunTime?: Date;
  lastRunTime?: Date;
  lastRunResult?: JobExecutionResult;
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  currentRetryAttempt: number;
}

export interface HealthStatus {
  healthy: boolean;
  services: {
    scheduler: boolean;
    jobLock: boolean;
    pollingJob: boolean;
  };
  lastExecution?: {
    time: Date;
    success: boolean;
    duration: number;
    error?: string;
  };
  nextExecution?: Date;
}

/**
 * PollingService - Main service class for automated workflow polling
 */
export class PollingService {
  private config: PollingServiceConfig;
  private schedulerConfig = getSchedulerConfig();
  private lockManager: MemoryJobLockManager;
  private pollingJob: WorkflowPollingJob;
  private cronTask: cron.ScheduledTask | null = null;
  private isInitialized = false;
  private status: ServiceStatus;
  private healthCheckTimer?: NodeJS.Timeout;
  private shutdownPromise?: Promise<void>;

  constructor(customConfig?: Partial<PollingServiceConfig>) {
    // Initialize configuration
    this.config = {
      enabled: this.schedulerConfig.jobs.workflowPolling.enabled,
      cronSchedule: this.schedulerConfig.jobs.workflowPolling.schedule,
      maxDurationMinutes: this.schedulerConfig.jobs.workflowPolling.maxDurationMinutes,
      retryAttempts: this.schedulerConfig.jobs.workflowPolling.retryAttempts,
      retryDelayMinutes: 5,
      pollingOptions: {
        batchSize: this.schedulerConfig.jobs.workflowPolling.batchSize,
        maxConcurrent: this.schedulerConfig.jobs.workflowPolling.maxConcurrentPolls
      },
      healthCheckIntervalMinutes: 30,
      ...customConfig
    };

    // Initialize dependencies
    this.lockManager = createJobLockManager();
    this.pollingJob = new WorkflowPollingJob();

    // Initialize status
    this.status = {
      running: false,
      scheduled: false,
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      currentRetryAttempt: 0
    };

    logSchedulerOperation('info', 'service.initialized', {
      enabled: this.config.enabled,
      cronSchedule: this.config.cronSchedule
    });
  }

  /**
   * Initialize and start the polling service
   */
  async start(): Promise<void> {
    if (this.isInitialized) {
      logSchedulerOperation('warn', 'start.alreadyInitialized');
      return;
    }

    if (!this.config.enabled) {
      logSchedulerOperation('info', 'start.disabled');
      this.isInitialized = true;
      return;
    }

    try {
      // Validate cron expression
      if (!validateCronExpression(this.config.cronSchedule)) {
        throw new Error(`Invalid cron expression: ${this.config.cronSchedule}`);
      }

      // Create and schedule the cron job
      this.cronTask = cron.schedule(this.config.cronSchedule, async () => {
        await this.executePoll();
      }, {
        timezone: this.schedulerConfig.timezone
      });

      // Start the scheduled task
      this.cronTask.start();
      this.status.scheduled = true;

      // Start health check timer if configured
      if (this.config.healthCheckIntervalMinutes) {
        this.startHealthCheckTimer();
      }

      this.isInitialized = true;

      logSchedulerOperation('info', 'start.success', {
        cronSchedule: this.config.cronSchedule,
        timezone: this.schedulerConfig.timezone,
        nextRun: this.getNextRunTime()
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown initialization error';
      logSchedulerOperation('error', 'start.error', { error: errorMessage });
      throw new Error(`Failed to start PollingService: ${errorMessage}`);
    }
  }

  /**
   * Stop the polling service gracefully
   */
  async stop(): Promise<void> {
    if (this.shutdownPromise) {
      return this.shutdownPromise;
    }

    this.shutdownPromise = this._performShutdown();
    return this.shutdownPromise;
  }

  /**
   * Perform the actual shutdown logic
   */
  private async _performShutdown(): Promise<void> {
    logSchedulerOperation('info', 'stop.start');

    try {
      // Stop health check timer
      if (this.healthCheckTimer) {
        clearInterval(this.healthCheckTimer);
        this.healthCheckTimer = undefined;
      }

      // Stop the cron task
      if (this.cronTask) {
        this.cronTask.stop();
        this.cronTask.destroy();
        this.cronTask = null;
        this.status.scheduled = false;
      }

      // Wait for current execution to complete (with timeout)
      if (this.status.running) {
        logSchedulerOperation('info', 'stop.waitingForJob');

        const timeout = this.config.maxDurationMinutes * 60 * 1000;
        const startTime = Date.now();

        while (this.status.running && (Date.now() - startTime) < timeout) {
          await this.delay(1000);
        }

        if (this.status.running) {
          logSchedulerOperation('warn', 'stop.jobStillRunning', {
            timeoutMinutes: this.config.maxDurationMinutes
          });
        }
      }

      // Clean up job locks
      await this.lockManager.cleanup();

      this.isInitialized = false;

      logSchedulerOperation('info', 'stop.success', {
        totalRuns: this.status.totalRuns,
        successfulRuns: this.status.successfulRuns,
        failedRuns: this.status.failedRuns
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown shutdown error';
      logSchedulerOperation('error', 'stop.error', { error: errorMessage });
      throw new Error(`Failed to stop PollingService: ${errorMessage}`);
    }
  }

  /**
   * Execute polling job with locking and retry logic
   */
  private async executePoll(): Promise<void> {
    const jobName = 'workflow-polling';
    const lockTtlMinutes = this.schedulerConfig.jobs.workflowPolling.lockTimeoutMinutes;

    try {
      // Acquire job lock
      const lockAcquired = await this.lockManager.acquireLock(jobName, lockTtlMinutes);

      if (!lockAcquired) {
        logSchedulerOperation('warn', 'executePoll.lockFailed', {
          jobName,
          lockTtlMinutes
        });
        return;
      }

      logSchedulerOperation('info', 'executePoll.lockAcquired', { jobName });

      this.status.running = true;
      this.status.lastRunTime = new Date();
      this.status.totalRuns++;

      try {
        // Execute the polling job
        const result = await this.executeWithRetry();
        this.status.lastRunResult = result;

        if (result.success) {
          this.status.successfulRuns++;
          this.status.currentRetryAttempt = 0;
        } else {
          this.status.failedRuns++;
        }

      } finally {
        this.status.running = false;
        await this.lockManager.releaseLock(jobName);
        logSchedulerOperation('info', 'executePoll.lockReleased', { jobName });
      }

    } catch (error) {
      this.status.running = false;
      this.status.failedRuns++;

      const errorMessage = error instanceof Error ? error.message : 'Unknown execution error';
      logSchedulerOperation('error', 'executePoll.error', { error: errorMessage });

      // Try to release lock in case of error
      try {
        await this.lockManager.releaseLock(jobName);
      } catch (lockError) {
        logSchedulerOperation('error', 'executePoll.lockReleaseError', { error: lockError });
      }
    }
  }

  /**
   * Execute polling job with retry logic
   */
  private async executeWithRetry(): Promise<JobExecutionResult> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      this.status.currentRetryAttempt = attempt;

      try {
        logSchedulerOperation('debug', 'executeWithRetry.attempt', {
          attempt,
          maxAttempts: this.config.retryAttempts
        });

        const result = await this.pollingJob.execute(this.config.pollingOptions);

        if (result.success) {
          logSchedulerOperation('info', 'executeWithRetry.success', {
            attempt,
            duration: result.duration,
            metadata: result.metadata
          });

          return result;
        }

        // Job executed but reported failure
        lastError = new Error(result.error || 'Job execution failed');

        if (attempt < this.config.retryAttempts) {
          logSchedulerOperation('warn', 'executeWithRetry.retrying', {
            attempt,
            error: result.error,
            retryDelayMinutes: this.config.retryDelayMinutes
          });

          await this.delay(this.config.retryDelayMinutes * 60 * 1000);
        }

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown execution error');

        if (attempt < this.config.retryAttempts) {
          logSchedulerOperation('warn', 'executeWithRetry.retrying', {
            attempt,
            error: lastError.message,
            retryDelayMinutes: this.config.retryDelayMinutes
          });

          await this.delay(this.config.retryDelayMinutes * 60 * 1000);
        }
      }
    }

    // All retries failed
    const errorMessage = lastError?.message || 'All retry attempts failed';

    logSchedulerOperation('error', 'executeWithRetry.allFailed', {
      attempts: this.config.retryAttempts,
      error: errorMessage
    });

    return {
      jobName: 'WorkflowPollingJob',
      startTime: new Date(),
      endTime: new Date(),
      success: false,
      error: errorMessage,
      duration: 0
    };
  }

  /**
   * Execute polling job manually (outside of schedule)
   */
  async executeManual(options?: WorkflowPollingOptions): Promise<JobExecutionResult> {
    if (!this.isInitialized) {
      throw new Error('PollingService not initialized');
    }

    if (this.status.running) {
      throw new Error('Polling job is already running');
    }

    logSchedulerOperation('info', 'executeManual.start', { options });

    try {
      const pollingOptions = { ...this.config.pollingOptions, ...options };
      const result = await this.pollingJob.execute(pollingOptions);

      logSchedulerOperation('info', 'executeManual.complete', {
        success: result.success,
        duration: result.duration,
        error: result.error
      });

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Manual execution failed';
      logSchedulerOperation('error', 'executeManual.error', { error: errorMessage });
      throw error;
    }
  }

  /**
   * Update service configuration
   */
  async updateConfig(newConfig: Partial<PollingServiceConfig>): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('PollingService not initialized');
    }

    const oldSchedule = this.config.cronSchedule;
    this.config = { ...this.config, ...newConfig };

    // If schedule changed, restart the cron job
    if (newConfig.cronSchedule && newConfig.cronSchedule !== oldSchedule) {
      if (!validateCronExpression(newConfig.cronSchedule)) {
        this.config.cronSchedule = oldSchedule; // Revert
        throw new Error(`Invalid cron expression: ${newConfig.cronSchedule}`);
      }

      if (this.cronTask) {
        this.cronTask.stop();
        this.cronTask.destroy();
      }

      this.cronTask = cron.schedule(this.config.cronSchedule, async () => {
        await this.executePoll();
      }, {
        timezone: this.schedulerConfig.timezone
      });

      logSchedulerOperation('info', 'updateConfig.scheduleUpdated', {
        oldSchedule,
        newSchedule: this.config.cronSchedule
      });
    }

    logSchedulerOperation('info', 'updateConfig.success', { newConfig });
  }

  /**
   * Get service status
   */
  getStatus(): ServiceStatus {
    return {
      ...this.status,
      nextRunTime: this.getNextRunTime()
    };
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<HealthStatus> {
    const pollingJobHealth = await this.pollingJob.healthCheck();

    const services = {
      scheduler: this.isInitialized && this.status.scheduled,
      jobLock: true, // Memory lock manager is always available
      pollingJob: pollingJobHealth.healthy
    };

    const healthy = Object.values(services).every(service => service);

    const result: HealthStatus = {
      healthy,
      services,
      nextExecution: this.getNextRunTime()
    };

    if (this.status.lastRunTime && this.status.lastRunResult) {
      result.lastExecution = {
        time: this.status.lastRunTime,
        success: this.status.lastRunResult.success,
        duration: this.status.lastRunResult.duration,
        error: this.status.lastRunResult.error
      };
    }

    return result;
  }

  /**
   * Get next scheduled run time
   */
  private getNextRunTime(): Date | undefined {
    if (!this.cronTask || !this.status.scheduled) {
      return undefined;
    }

    try {
      // Note: node-cron doesn't provide direct access to next execution time
      // This is a simplified calculation - in production, you might want to use a more robust solution
      const now = new Date();
      const nextHour = new Date(now);
      nextHour.setHours(now.getHours() + 1, 0, 0, 0);
      return nextHour;
    } catch (error) {
      return undefined;
    }
  }

  /**
   * Start periodic health check
   */
  private startHealthCheckTimer(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    const intervalMs = this.config.healthCheckIntervalMinutes! * 60 * 1000;

    this.healthCheckTimer = setInterval(async () => {
      try {
        const health = await this.getHealth();

        if (!health.healthy) {
          logSchedulerOperation('warn', 'healthCheck.unhealthy', health);
        } else {
          logSchedulerOperation('debug', 'healthCheck.healthy', health);
        }

      } catch (error) {
        logSchedulerOperation('error', 'healthCheck.error', { error });
      }
    }, intervalMs);
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if service is running
   */
  isRunning(): boolean {
    return this.status.running;
  }

  /**
   * Check if service is initialized
   */
  getInitializationStatus(): boolean {
    return this.isInitialized;
  }

  /**
   * Get current configuration
   */
  getConfig(): PollingServiceConfig {
    return { ...this.config };
  }
}

// Export singleton instance
export const pollingService = new PollingService();
export default pollingService;