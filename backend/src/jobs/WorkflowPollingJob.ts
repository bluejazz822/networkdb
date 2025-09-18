/**
 * Workflow Polling Job
 * Implements the core logic for polling n8n workflow status and updating execution history
 * Handles batch processing, error recovery, and alert triggering
 */

import { N8nService } from '../services/N8nService';
import { WorkflowService } from '../services/WorkflowService';
import { AlertService } from '../services/AlertService';
import { WorkflowRegistry } from '../models/WorkflowRegistry';
import { WorkflowExecution } from '../models/WorkflowExecution';
import { WorkflowAlert } from '../models/WorkflowAlert';
import { Op } from 'sequelize';
import {
  JobExecutionResult,
  logSchedulerOperation,
  getSchedulerConfig
} from '../config/scheduler';

export interface WorkflowPollingOptions {
  batchSize?: number;
  maxConcurrent?: number;
  includeInactive?: boolean;
  workflowIds?: string[];
  skipAlerts?: boolean;
}

export interface PollingResult {
  totalWorkflows: number;
  polledWorkflows: number;
  updatedExecutions: number;
  triggeredAlerts: number;
  errors: PollingError[];
  duration: number;
}

export interface PollingError {
  workflowId?: string;
  executionId?: string;
  error: string;
  type: 'workflow_poll' | 'execution_update' | 'alert_trigger' | 'database_error';
}

export interface ExecutionStatusUpdate {
  workflowId: string;
  executionId: string;
  oldStatus: string;
  newStatus: string;
  shouldAlert: boolean;
  alertType?: 'failure' | 'success';
}

/**
 * WorkflowPollingJob - Core polling logic for workflow status monitoring
 */
export class WorkflowPollingJob {
  private n8nService: N8nService;
  private workflowService: WorkflowService;
  private alertService: AlertService;
  private isRunning = false;
  private lastRunTime?: Date;
  private lastRunResult?: PollingResult;

  constructor() {
    this.n8nService = new N8nService();
    this.workflowService = new WorkflowService();
    this.alertService = new AlertService();
  }

  /**
   * Execute the polling job
   */
  async execute(options: WorkflowPollingOptions = {}): Promise<JobExecutionResult> {
    const startTime = new Date();
    const jobName = 'WorkflowPollingJob';

    if (this.isRunning) {
      const error = 'Job already running - skipping execution';
      logSchedulerOperation('warn', 'execute.skipped', { jobName, error });

      return {
        jobName,
        startTime,
        endTime: new Date(),
        success: false,
        error,
        duration: 0
      };
    }

    this.isRunning = true;
    this.lastRunTime = startTime;

    try {
      logSchedulerOperation('info', 'execute.start', {
        jobName,
        options,
        n8nReady: this.n8nService.isReady()
      });

      const result = await this.performPolling(options);
      this.lastRunResult = result;

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      logSchedulerOperation('info', 'execute.success', {
        jobName,
        duration,
        result
      });

      return {
        jobName,
        startTime,
        endTime,
        success: true,
        duration,
        metadata: result
      };

    } catch (error) {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logSchedulerOperation('error', 'execute.error', {
        jobName,
        duration,
        error: errorMessage,
        stack: error instanceof Error ? error.stack : undefined
      });

      return {
        jobName,
        startTime,
        endTime,
        success: false,
        error: errorMessage,
        duration,
        metadata: { error: errorMessage }
      };

    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Core polling logic
   */
  private async performPolling(options: WorkflowPollingOptions): Promise<PollingResult> {
    const config = getSchedulerConfig();
    const {
      batchSize = config.jobs.workflowPolling.batchSize,
      maxConcurrent = config.jobs.workflowPolling.maxConcurrentPolls,
      includeInactive = false,
      workflowIds,
      skipAlerts = false
    } = options;

    const result: PollingResult = {
      totalWorkflows: 0,
      polledWorkflows: 0,
      updatedExecutions: 0,
      triggeredAlerts: 0,
      errors: [],
      duration: 0
    };

    const startTime = Date.now();

    try {
      // 1. Get workflows to poll
      const targetWorkflows = await this.getWorkflowsToPool(workflowIds, includeInactive);
      result.totalWorkflows = targetWorkflows.length;

      if (targetWorkflows.length === 0) {
        logSchedulerOperation('info', 'performPolling.noWorkflows', { includeInactive, workflowIds });
        return result;
      }

      // 2. Poll workflows in batches
      const pollingResults = await this.pollWorkflowsInBatches(
        targetWorkflows,
        batchSize,
        maxConcurrent
      );

      result.polledWorkflows = pollingResults.successCount;
      result.errors.push(...pollingResults.errors);

      // 3. Process execution status updates
      const executionUpdates = await this.processExecutionUpdates(pollingResults.executions);
      result.updatedExecutions = executionUpdates.updateCount;
      result.errors.push(...executionUpdates.errors);

      // 4. Trigger alerts if enabled
      if (!skipAlerts) {
        const alertResults = await this.processAlerts(executionUpdates.statusChanges);
        result.triggeredAlerts = alertResults.alertCount;
        result.errors.push(...alertResults.errors);
      }

      result.duration = Date.now() - startTime;

      return result;

    } catch (error) {
      result.duration = Date.now() - startTime;
      result.errors.push({
        error: error instanceof Error ? error.message : 'Unknown polling error',
        type: 'workflow_poll'
      });

      throw error;
    }
  }

  /**
   * Get workflows that should be polled
   */
  private async getWorkflowsToPool(workflowIds?: string[], includeInactive = false): Promise<WorkflowRegistry[]> {
    try {
      const whereClause: any = {};

      if (workflowIds && workflowIds.length > 0) {
        whereClause.workflow_id = { [Op.in]: workflowIds };
      }

      if (!includeInactive) {
        whereClause.is_active = true;
      }

      const workflows = await WorkflowRegistry.findAll({
        where: whereClause,
        order: [['updated_at', 'DESC']]
      });

      logSchedulerOperation('debug', 'getWorkflowsToPool', {
        total: workflows.length,
        includeInactive,
        workflowIds: workflowIds?.length || 0
      });

      return workflows;

    } catch (error) {
      logSchedulerOperation('error', 'getWorkflowsToPool.error', { error });
      throw error;
    }
  }

  /**
   * Poll workflows in batches with concurrency control
   */
  private async pollWorkflowsInBatches(
    workflows: WorkflowRegistry[],
    batchSize: number,
    maxConcurrent: number
  ): Promise<{
    successCount: number;
    executions: any[];
    errors: PollingError[];
  }> {
    const result = {
      successCount: 0,
      executions: [] as any[],
      errors: [] as PollingError[]
    };

    // Process workflows in batches
    for (let i = 0; i < workflows.length; i += batchSize) {
      const batch = workflows.slice(i, i + batchSize);

      logSchedulerOperation('debug', 'pollWorkflowsInBatches.batch', {
        batchNumber: Math.floor(i / batchSize) + 1,
        batchSize: batch.length,
        totalBatches: Math.ceil(workflows.length / batchSize)
      });

      // Create polling promises for this batch with concurrency limit
      const batchPromises = batch.map(async (workflow) => {
        try {
          const statusResponse = await this.n8nService.getWorkflowStatus(workflow.workflow_id);

          if (!statusResponse.success) {
            result.errors.push({
              workflowId: workflow.workflow_id,
              error: statusResponse.error?.message || 'Failed to get workflow status',
              type: 'workflow_poll'
            });
            return null;
          }

          result.successCount++;

          // Handle both single execution and execution array responses
          if (Array.isArray(statusResponse.data)) {
            return statusResponse.data;
          } else if (statusResponse.data) {
            return [statusResponse.data];
          }

          return [];

        } catch (error) {
          result.errors.push({
            workflowId: workflow.workflow_id,
            error: error instanceof Error ? error.message : 'Unknown error',
            type: 'workflow_poll'
          });
          return null;
        }
      });

      // Execute batch with concurrency control
      const batchResults = await this.executeBatchWithConcurrency(batchPromises, maxConcurrent);

      // Collect executions from successful polls
      for (const batchResult of batchResults) {
        if (batchResult && Array.isArray(batchResult)) {
          result.executions.push(...batchResult);
        }
      }

      // Add delay between batches to avoid overwhelming n8n API
      if (i + batchSize < workflows.length) {
        await this.delay(1000); // 1 second delay
      }
    }

    return result;
  }

  /**
   * Execute promises with concurrency control
   */
  private async executeBatchWithConcurrency<T>(promises: Promise<T>[], maxConcurrent: number): Promise<T[]> {
    const results: T[] = [];

    for (let i = 0; i < promises.length; i += maxConcurrent) {
      const batch = promises.slice(i, i + maxConcurrent);
      const batchResults = await Promise.all(batch);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Process execution updates and detect status changes
   */
  private async processExecutionUpdates(executions: any[]): Promise<{
    updateCount: number;
    statusChanges: ExecutionStatusUpdate[];
    errors: PollingError[];
  }> {
    const result = {
      updateCount: 0,
      statusChanges: [] as ExecutionStatusUpdate[],
      errors: [] as PollingError[]
    };

    for (const execution of executions) {
      try {
        // Get current execution record from database
        const existingExecution = await WorkflowExecution.findOne({
          where: { execution_id: execution.id }
        });

        const newStatus = this.mapN8nStatusToDb(execution.status);
        const oldStatus = existingExecution?.status;

        // Update or create execution record
        const [updatedExecution, created] = await WorkflowExecution.upsert({
          workflow_id: execution.workflowId,
          execution_id: execution.id,
          status: newStatus,
          start_time: new Date(execution.startedAt),
          end_time: execution.stoppedAt ? new Date(execution.stoppedAt) : null,
          duration_ms: execution.stoppedAt && execution.startedAt
            ? new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime()
            : null,
          error_message: execution.data?.resultData?.error?.message || null,
          execution_data: execution.data,
          resources_created: 0, // TODO: Extract from execution data
          resources_updated: 0, // TODO: Extract from execution data
          resources_failed: execution.status === 'failed' ? 1 : 0
        });

        result.updateCount++;

        // Detect status changes that should trigger alerts
        if (!created && oldStatus !== newStatus) {
          const shouldAlert = this.shouldTriggerAlert(oldStatus!, newStatus);

          if (shouldAlert) {
            result.statusChanges.push({
              workflowId: execution.workflowId,
              executionId: execution.id,
              oldStatus: oldStatus!,
              newStatus,
              shouldAlert: true,
              alertType: newStatus === 'failure' ? 'failure' : 'success'
            });
          }
        }

      } catch (error) {
        result.errors.push({
          workflowId: execution.workflowId,
          executionId: execution.id,
          error: error instanceof Error ? error.message : 'Unknown error',
          type: 'execution_update'
        });
      }
    }

    logSchedulerOperation('debug', 'processExecutionUpdates', {
      totalExecutions: executions.length,
      updateCount: result.updateCount,
      statusChanges: result.statusChanges.length,
      errors: result.errors.length
    });

    return result;
  }

  /**
   * Process alerts for status changes
   */
  private async processAlerts(statusChanges: ExecutionStatusUpdate[]): Promise<{
    alertCount: number;
    errors: PollingError[];
  }> {
    const result = {
      alertCount: 0,
      errors: [] as PollingError[]
    };

    for (const change of statusChanges) {
      try {
        if (!change.shouldAlert || !change.alertType) {
          continue;
        }

        let alertResponse;

        if (change.alertType === 'failure') {
          alertResponse = await this.alertService.sendFailureAlert(change.executionId);
        } else if (change.alertType === 'success') {
          alertResponse = await this.alertService.sendSuccessAlert(change.executionId);
        }

        if (alertResponse?.success) {
          result.alertCount++;

          logSchedulerOperation('info', 'processAlerts.sent', {
            workflowId: change.workflowId,
            executionId: change.executionId,
            alertType: change.alertType,
            alertId: alertResponse.alertId
          });
        } else if (alertResponse && !alertResponse.skipped) {
          result.errors.push({
            workflowId: change.workflowId,
            executionId: change.executionId,
            error: alertResponse.error || 'Unknown alert error',
            type: 'alert_trigger'
          });
        }

      } catch (error) {
        result.errors.push({
          workflowId: change.workflowId,
          executionId: change.executionId,
          error: error instanceof Error ? error.message : 'Unknown error',
          type: 'alert_trigger'
        });
      }
    }

    logSchedulerOperation('debug', 'processAlerts', {
      totalStatusChanges: statusChanges.length,
      alertCount: result.alertCount,
      errors: result.errors.length
    });

    return result;
  }

  /**
   * Map n8n execution status to database status
   */
  private mapN8nStatusToDb(status: string): 'success' | 'failure' | 'running' | 'cancelled' {
    switch (status) {
      case 'succeeded':
        return 'success';
      case 'failed':
      case 'crashed':
        return 'failure';
      case 'running':
      case 'new':
      case 'waiting':
        return 'running';
      case 'canceled':
        return 'cancelled';
      default:
        return 'failure';
    }
  }

  /**
   * Determine if status change should trigger alert
   */
  private shouldTriggerAlert(oldStatus: string, newStatus: string): boolean {
    // Alert on failure
    if (newStatus === 'failure' && oldStatus !== 'failure') {
      return true;
    }

    // Alert on recovery (failure to success)
    if (newStatus === 'success' && oldStatus === 'failure') {
      return true;
    }

    return false;
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get job status information
   */
  getStatus(): {
    isRunning: boolean;
    lastRunTime?: Date;
    lastRunResult?: PollingResult;
  } {
    return {
      isRunning: this.isRunning,
      lastRunTime: this.lastRunTime,
      lastRunResult: this.lastRunResult
    };
  }

  /**
   * Health check for the polling job
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    services: {
      n8n: boolean;
      database: boolean;
      alerts: boolean;
    };
    lastRun?: {
      time: Date;
      success: boolean;
      duration: number;
    };
  }> {
    const services = {
      n8n: this.n8nService.isReady(),
      database: true, // Assume healthy if we can run this check
      alerts: this.alertService.getServiceHealth().status !== 'unhealthy'
    };

    // Test database connectivity
    try {
      await WorkflowRegistry.count({ limit: 1 });
    } catch (error) {
      services.database = false;
    }

    const healthy = Object.values(services).every(service => service);

    const result: any = {
      healthy,
      services
    };

    if (this.lastRunTime && this.lastRunResult) {
      result.lastRun = {
        time: this.lastRunTime,
        success: this.lastRunResult.errors.length === 0,
        duration: this.lastRunResult.duration
      };
    }

    return result;
  }
}