/**
 * n8n Service
 * Service layer for n8n workflow integration, discovery, execution, and monitoring
 */

import { n8nAxiosClient, n8nUtils } from '../config/n8n';
import { 
  N8nWorkflow,
  N8nWorkflowExecution,
  N8nWorkflowListResponse,
  N8nExecutionListResponse,
  N8nErrorResponse,
  N8nErrorCode,
  WorkflowExecutionStatus,
  N8nExecutionRequest,
  N8nExecutionQueryParams,
  N8nWorkflowQueryParams,
  WorkflowExecutionStats
} from '../types/workflow';
import { ApiResponse } from '../types/common';
import { WorkflowRegistry } from '../models/WorkflowRegistry';
import { WorkflowExecution } from '../models/WorkflowExecution';
import { WorkflowAlert } from '../models/WorkflowAlert';
import { AxiosError } from 'axios';

export interface N8nServiceError {
  code: N8nErrorCode;
  message: string;
  details?: any;
  httpStatus?: number;
}

export interface N8nServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: N8nServiceError;
  timestamp: Date;
}

export interface WorkflowDiscoveryOptions {
  provider?: 'aws' | 'azure' | 'gcp' | 'ali' | 'oci' | 'huawei' | 'others';
  workflowType?: 'vpc' | 'subnet' | 'transit_gateway' | 'nat_gateway' | 'vpn';
  active?: boolean;
  limit?: number;
  includeInactive?: boolean;
}

export interface WorkflowStatusPollOptions {
  workflowIds?: string[];
  maxConcurrent?: number;
  batchSize?: number;
  includeExecutionData?: boolean;
}

export interface WorkflowSyncOptions {
  fullSync?: boolean;
  workflowIds?: string[];
  syncExecutions?: boolean;
  cleanupOrphaned?: boolean;
}

/**
 * n8n Service Class
 * Handles all n8n workflow operations including discovery, execution, monitoring, and database integration
 */
export class N8nService {
  private isInitialized = false;
  private readonly pollIntervalMs = 30000; // 30 seconds
  private readonly maxRetryAttempts = 3;
  private readonly batchSize = 10;

  constructor() {
    this.initialize();
  }

  /**
   * Initialize the service and verify n8n connectivity
   */
  private async initialize(): Promise<void> {
    try {
      const healthCheck = await n8nUtils.healthCheck();
      if (!healthCheck) {
        console.warn('[N8nService] n8n API is not accessible during initialization');
      }
      this.isInitialized = true;
    } catch (error) {
      console.error('[N8nService] Initialization failed:', error);
      this.isInitialized = false;
    }
  }

  /**
   * Check if the service is ready to handle requests
   */
  public isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Convert axios error to service error format
   */
  private handleAxiosError(error: AxiosError): N8nServiceError {
    if (error.response?.data && this.isN8nErrorResponse(error.response.data)) {
      const n8nError = error.response.data as N8nErrorResponse;
      return {
        code: n8nError.error.code,
        message: n8nError.error.message,
        details: n8nError.error.details,
        httpStatus: error.response.status
      };
    }

    // Map common HTTP errors to n8n error codes
    const status = error.response?.status;
    if (status === 401) {
      return {
        code: 'AUTHENTICATION_FAILED',
        message: 'n8n authentication failed. Check API key.',
        httpStatus: status
      };
    }

    if (status === 429) {
      return {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded. Please retry later.',
        httpStatus: status
      };
    }

    if (status && status >= 500) {
      return {
        code: 'CONNECTION_ERROR',
        message: 'n8n server error occurred',
        httpStatus: status
      };
    }

    return {
      code: 'CONNECTION_ERROR',
      message: error.message || 'Unknown connection error',
      details: error.code
    };
  }

  /**
   * Type guard for n8n error responses
   */
  private isN8nErrorResponse(obj: any): obj is N8nErrorResponse {
    return obj && typeof obj.error === 'object' && typeof obj.error.code === 'string';
  }

  /**
   * Create success response
   */
  private createSuccessResponse<T>(data: T): N8nServiceResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date()
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(error: N8nServiceError): N8nServiceResponse<any> {
    return {
      success: false,
      error,
      timestamp: new Date()
    };
  }

  /**
   * Log service operations
   */
  private logOperation(operation: string, details: any): void {
    console.log(`[N8nService] ${operation}:`, {
      timestamp: new Date().toISOString(),
      ...details
    });
  }

  /**
   * Discover workflows from n8n and register them in the database
   */
  async discoverWorkflows(options: WorkflowDiscoveryOptions = {}): Promise<N8nServiceResponse<WorkflowRegistry[]>> {
    try {
      this.logOperation('discoverWorkflows', { options });

      if (!this.isReady()) {
        return this.createErrorResponse({
          code: 'CONNECTION_ERROR',
          message: 'Service not initialized'
        });
      }

      const queryParams: N8nWorkflowQueryParams = {
        active: options.active,
        limit: options.limit || 100
      };

      // Fetch workflows from n8n
      const response = await n8nAxiosClient.get<N8nWorkflowListResponse>('/workflows', {
        params: queryParams
      });

      const workflows = response.data.data;
      const registeredWorkflows: WorkflowRegistry[] = [];

      // Register workflows in database
      for (const workflow of workflows) {
        try {
          // Determine workflow type and provider from workflow data
          const workflowType = this.inferWorkflowType(workflow);
          const provider = options.provider || this.inferProvider(workflow);

          const [workflowRegistry, created] = await WorkflowRegistry.findOrCreate({
            where: { workflow_id: workflow.id },
            defaults: {
              workflow_id: workflow.id,
              workflow_name: workflow.name,
              workflow_type: workflowType,
              provider: provider,
              is_active: workflow.active
            }
          });

          if (!created) {
            // Update existing workflow
            await workflowRegistry.update({
              workflow_name: workflow.name,
              is_active: workflow.active
            });
          }

          registeredWorkflows.push(workflowRegistry);

        } catch (dbError) {
          console.error(`[N8nService] Failed to register workflow ${workflow.id}:`, dbError);
        }
      }

      this.logOperation('discoverWorkflows.success', { 
        discovered: workflows.length, 
        registered: registeredWorkflows.length 
      });

      return this.createSuccessResponse(registeredWorkflows);

    } catch (error) {
      const serviceError = this.handleAxiosError(error as AxiosError);
      this.logOperation('discoverWorkflows.error', serviceError);
      return this.createErrorResponse(serviceError);
    }
  }

  /**
   * Get workflow execution status from n8n
   */
  async getWorkflowStatus(workflowId: string, executionId?: string): Promise<N8nServiceResponse<N8nWorkflowExecution | N8nWorkflowExecution[]>> {
    try {
      this.logOperation('getWorkflowStatus', { workflowId, executionId });

      if (!this.isReady()) {
        return this.createErrorResponse({
          code: 'CONNECTION_ERROR',
          message: 'Service not initialized'
        });
      }

      if (executionId) {
        // Get specific execution
        const response = await n8nAxiosClient.get<N8nWorkflowExecution>(`/executions/${executionId}`);
        return this.createSuccessResponse(response.data);
      } else {
        // Get all executions for workflow
        const queryParams: N8nExecutionQueryParams = {
          workflowId,
          limit: 50,
          includeData: false
        };

        const response = await n8nAxiosClient.get<N8nExecutionListResponse>('/executions', {
          params: queryParams
        });

        return this.createSuccessResponse(response.data.data);
      }

    } catch (error) {
      const serviceError = this.handleAxiosError(error as AxiosError);
      this.logOperation('getWorkflowStatus.error', serviceError);
      return this.createErrorResponse(serviceError);
    }
  }

  /**
   * Execute a workflow manually
   */
  async executeWorkflow(workflowId: string, data?: any): Promise<N8nServiceResponse<N8nWorkflowExecution>> {
    try {
      this.logOperation('executeWorkflow', { workflowId, hasData: !!data });

      if (!this.isReady()) {
        return this.createErrorResponse({
          code: 'CONNECTION_ERROR',
          message: 'Service not initialized'
        });
      }

      // Prepare execution request
      const executionRequest: N8nExecutionRequest = {
        ...(data && { runData: data })
      };

      // Execute workflow
      const response = await n8nAxiosClient.post<N8nWorkflowExecution>(
        `/workflows/${workflowId}/execute`,
        executionRequest
      );

      const execution = response.data;

      // Track execution in database
      try {
        await WorkflowExecution.create({
          workflow_id: workflowId,
          execution_id: execution.id,
          status: this.mapN8nStatusToDb(execution.status),
          start_time: new Date(execution.startedAt),
          resources_created: 0,
          resources_updated: 0,
          resources_failed: 0,
          execution_data: execution.data
        });

        // Create alert for manual trigger
        await WorkflowAlert.create({
          execution_id: execution.id,
          alert_type: 'manual_trigger',
          recipients: 'system@networkdb'
        });

      } catch (dbError) {
        console.error(`[N8nService] Failed to track execution ${execution.id}:`, dbError);
      }

      this.logOperation('executeWorkflow.success', { 
        workflowId, 
        executionId: execution.id,
        status: execution.status 
      });

      return this.createSuccessResponse(execution);

    } catch (error) {
      const serviceError = this.handleAxiosError(error as AxiosError);
      this.logOperation('executeWorkflow.error', serviceError);
      return this.createErrorResponse(serviceError);
    }
  }

  /**
   * Poll workflow statuses in batch with rate limiting
   */
  async pollWorkflowStatuses(options: WorkflowStatusPollOptions = {}): Promise<N8nServiceResponse<N8nWorkflowExecution[]>> {
    try {
      this.logOperation('pollWorkflowStatuses', options);

      if (!this.isReady()) {
        return this.createErrorResponse({
          code: 'CONNECTION_ERROR',
          message: 'Service not initialized'
        });
      }

      const { 
        workflowIds, 
        maxConcurrent = 5, 
        batchSize = this.batchSize,
        includeExecutionData = false 
      } = options;

      let targetWorkflowIds: string[];

      if (workflowIds && workflowIds.length > 0) {
        targetWorkflowIds = workflowIds;
      } else {
        // Get all active workflows from database
        const activeWorkflows = await WorkflowRegistry.findAll({
          where: { is_active: true },
          attributes: ['workflow_id']
        });
        targetWorkflowIds = activeWorkflows.map(w => w.workflow_id);
      }

      const allExecutions: N8nWorkflowExecution[] = [];
      const errors: any[] = [];

      // Process workflows in batches
      for (let i = 0; i < targetWorkflowIds.length; i += batchSize) {
        const batch = targetWorkflowIds.slice(i, i + batchSize);
        const batchPromises = batch.map(async (workflowId) => {
          try {
            const statusResponse = await this.getWorkflowStatus(workflowId);
            if (statusResponse.success && Array.isArray(statusResponse.data)) {
              return statusResponse.data;
            }
            return [];
          } catch (error) {
            errors.push({ workflowId, error });
            return [];
          }
        });

        const batchResults = await Promise.all(batchPromises);
        const batchExecutions = batchResults.flat();
        allExecutions.push(...batchExecutions);

        // Rate limiting delay between batches
        if (i + batchSize < targetWorkflowIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Update execution statuses in database
      for (const execution of allExecutions) {
        try {
          await this.updateExecutionInDatabase(execution);
        } catch (dbError) {
          console.error(`[N8nService] Failed to update execution ${execution.id}:`, dbError);
        }
      }

      this.logOperation('pollWorkflowStatuses.success', { 
        workflows: targetWorkflowIds.length,
        executions: allExecutions.length,
        errors: errors.length
      });

      return this.createSuccessResponse(allExecutions);

    } catch (error) {
      const serviceError = this.handleAxiosError(error as AxiosError);
      this.logOperation('pollWorkflowStatuses.error', serviceError);
      return this.createErrorResponse(serviceError);
    }
  }

  /**
   * Perform full synchronization of workflow data
   */
  async syncWorkflowData(options: WorkflowSyncOptions = {}): Promise<N8nServiceResponse<{ workflows: number; executions: number }>> {
    try {
      this.logOperation('syncWorkflowData', options);

      if (!this.isReady()) {
        return this.createErrorResponse({
          code: 'CONNECTION_ERROR',
          message: 'Service not initialized'
        });
      }

      const { fullSync = false, syncExecutions = true, cleanupOrphaned = false } = options;

      let syncedWorkflows = 0;
      let syncedExecutions = 0;

      // 1. Sync workflows
      const workflowsResponse = await this.discoverWorkflows({
        includeInactive: fullSync
      });

      if (workflowsResponse.success) {
        syncedWorkflows = workflowsResponse.data?.length || 0;
      }

      // 2. Sync executions if requested
      if (syncExecutions) {
        const executionsResponse = await this.pollWorkflowStatuses({
          workflowIds: options.workflowIds,
          includeExecutionData: true
        });

        if (executionsResponse.success) {
          syncedExecutions = executionsResponse.data?.length || 0;
        }
      }

      // 3. Cleanup orphaned records if requested
      if (cleanupOrphaned) {
        await this.cleanupOrphanedRecords();
      }

      const result = {
        workflows: syncedWorkflows,
        executions: syncedExecutions
      };

      this.logOperation('syncWorkflowData.success', result);
      return this.createSuccessResponse(result);

    } catch (error) {
      const serviceError = this.handleAxiosError(error as AxiosError);
      this.logOperation('syncWorkflowData.error', serviceError);
      return this.createErrorResponse(serviceError);
    }
  }

  /**
   * Get workflow execution history from database
   */
  async getWorkflowExecutionHistory(
    workflowId: string, 
    limit = 50, 
    offset = 0
  ): Promise<N8nServiceResponse<{ executions: WorkflowExecution[]; total: number }>> {
    try {
      this.logOperation('getWorkflowExecutionHistory', { workflowId, limit, offset });

      const { count, rows } = await WorkflowExecution.findAndCountAll({
        where: { workflow_id: workflowId },
        order: [['start_time', 'DESC']],
        limit,
        offset
      });

      const result = {
        executions: rows,
        total: count
      };

      return this.createSuccessResponse(result);

    } catch (error) {
      this.logOperation('getWorkflowExecutionHistory.error', { workflowId, error });
      return this.createErrorResponse({
        code: 'WORKFLOW_NOT_FOUND',
        message: 'Failed to retrieve execution history',
        details: error
      });
    }
  }

  /**
   * Get workflow execution statistics
   */
  async getWorkflowStats(workflowId: string): Promise<N8nServiceResponse<WorkflowExecutionStats>> {
    try {
      this.logOperation('getWorkflowStats', { workflowId });

      const workflow = await WorkflowRegistry.findOne({
        where: { workflow_id: workflowId }
      });

      if (!workflow) {
        return this.createErrorResponse({
          code: 'WORKFLOW_NOT_FOUND',
          message: 'Workflow not found in registry'
        });
      }

      const executions = await WorkflowExecution.findAll({
        where: { workflow_id: workflowId },
        attributes: [
          'status',
          'duration_ms',
          'start_time',
          'error_message'
        ]
      });

      const totalExecutions = executions.length;
      const successfulExecutions = executions.filter(e => e.status === 'success').length;
      const failedExecutions = executions.filter(e => e.status === 'failure').length;

      const durations = executions
        .filter(e => e.duration_ms !== null)
        .map(e => e.duration_ms!);

      const averageExecutionTime = durations.length > 0 
        ? durations.reduce((a, b) => a + b, 0) / durations.length 
        : 0;

      const sortedExecutions = executions.sort((a, b) => 
        new Date(b.start_time).getTime() - new Date(a.start_time).getTime()
      );

      const lastExecution = sortedExecutions[0];
      const lastSuccess = sortedExecutions.find(e => e.status === 'success');
      const lastFailure = sortedExecutions.find(e => e.status === 'failure');

      // Count most common errors
      const errorCounts = new Map<string, number>();
      executions
        .filter(e => e.error_message)
        .forEach(e => {
          const count = errorCounts.get(e.error_message!) || 0;
          errorCounts.set(e.error_message!, count + 1);
        });

      const mostCommonErrors = Array.from(errorCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([error, count]) => ({ error, count }));

      const stats: WorkflowExecutionStats = {
        workflowId,
        workflowName: workflow.workflow_name,
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        averageExecutionTime,
        lastExecutionTime: lastExecution?.start_time.toISOString(),
        lastSuccessTime: lastSuccess?.start_time.toISOString(),
        lastFailureTime: lastFailure?.start_time.toISOString(),
        errorRate: totalExecutions > 0 ? (failedExecutions / totalExecutions) * 100 : 0,
        mostCommonErrors
      };

      return this.createSuccessResponse(stats);

    } catch (error) {
      this.logOperation('getWorkflowStats.error', { workflowId, error });
      return this.createErrorResponse({
        code: 'WORKFLOW_NOT_FOUND',
        message: 'Failed to retrieve workflow statistics',
        details: error
      });
    }
  }

  /**
   * Helper: Infer workflow type from workflow data
   */
  private inferWorkflowType(workflow: N8nWorkflow): 'vpc' | 'subnet' | 'transit_gateway' | 'nat_gateway' | 'vpn' {
    const name = workflow.name.toLowerCase();
    const nodes = workflow.nodes.map(n => n.type.toLowerCase()).join(' ');
    const searchText = `${name} ${nodes}`.toLowerCase();

    if (searchText.includes('transit') || searchText.includes('tgw')) {
      return 'transit_gateway';
    }
    if (searchText.includes('nat') || searchText.includes('gateway')) {
      return 'nat_gateway';
    }
    if (searchText.includes('vpn') || searchText.includes('tunnel')) {
      return 'vpn';
    }
    if (searchText.includes('subnet')) {
      return 'subnet';
    }
    return 'vpc'; // Default fallback
  }

  /**
   * Helper: Infer provider from workflow data
   */
  private inferProvider(workflow: N8nWorkflow): 'aws' | 'azure' | 'gcp' | 'ali' | 'oci' | 'huawei' | 'others' {
    const nodes = workflow.nodes.map(n => n.type.toLowerCase()).join(' ');
    const searchText = workflow.name.toLowerCase() + ' ' + nodes;

    if (searchText.includes('aws') || searchText.includes('amazon')) {
      return 'aws';
    }
    if (searchText.includes('azure') || searchText.includes('microsoft')) {
      return 'azure';
    }
    if (searchText.includes('gcp') || searchText.includes('google')) {
      return 'gcp';
    }
    if (searchText.includes('alibaba') || searchText.includes('aliyun')) {
      return 'ali';
    }
    if (searchText.includes('oracle') || searchText.includes('oci')) {
      return 'oci';
    }
    if (searchText.includes('huawei')) {
      return 'huawei';
    }
    return 'others'; // Default fallback
  }

  /**
   * Helper: Map n8n execution status to database status
   */
  private mapN8nStatusToDb(status: WorkflowExecutionStatus): 'success' | 'failure' | 'running' | 'cancelled' {
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
   * Helper: Update execution record in database
   */
  private async updateExecutionInDatabase(execution: N8nWorkflowExecution): Promise<void> {
    const endTime = execution.stoppedAt ? new Date(execution.stoppedAt) : undefined;
    const startTime = new Date(execution.startedAt);
    const durationMs = endTime ? endTime.getTime() - startTime.getTime() : undefined;

    const errorMessage = execution.data?.resultData?.error?.message;

    await WorkflowExecution.upsert({
      workflow_id: execution.workflowId,
      execution_id: execution.id,
      status: this.mapN8nStatusToDb(execution.status),
      start_time: startTime,
      end_time: endTime,
      duration_ms: durationMs,
      resources_created: 0, // TODO: Extract from execution data
      resources_updated: 0, // TODO: Extract from execution data
      resources_failed: execution.status === 'failed' ? 1 : 0,
      error_message: errorMessage,
      execution_data: execution.data
    });

    // Create alerts for failed executions
    if (execution.status === 'failed' && errorMessage) {
      try {
        await WorkflowAlert.findOrCreate({
          where: { execution_id: execution.id },
          defaults: {
            execution_id: execution.id,
            alert_type: 'failure',
            recipients: 'system@networkdb'
          }
        });
      } catch (alertError) {
        console.error(`[N8nService] Failed to create alert for execution ${execution.id}:`, alertError);
      }
    }
  }

  /**
   * Helper: Cleanup orphaned database records
   */
  private async cleanupOrphanedRecords(): Promise<void> {
    try {
      // Get all workflow IDs from n8n
      const workflowsResponse = await n8nAxiosClient.get<N8nWorkflowListResponse>('/workflows', {
        params: { limit: 1000 }
      });

      const activeWorkflowIds = new Set(workflowsResponse.data.data.map(w => w.id));

      // Find orphaned workflows in database
      const dbWorkflows = await WorkflowRegistry.findAll({
        attributes: ['id', 'workflow_id']
      });

      const orphanedWorkflows = dbWorkflows.filter(w => !activeWorkflowIds.has(w.workflow_id));

      // Delete orphaned workflows and their executions
      for (const orphaned of orphanedWorkflows) {
        await WorkflowExecution.destroy({
          where: { workflow_id: orphaned.workflow_id }
        });
        await orphaned.destroy();
      }

      this.logOperation('cleanupOrphanedRecords.success', { 
        cleaned: orphanedWorkflows.length 
      });

    } catch (error) {
      console.error('[N8nService] Cleanup orphaned records failed:', error);
    }
  }
}