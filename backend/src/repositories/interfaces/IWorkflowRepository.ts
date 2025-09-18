/**
 * Workflow Repository Interface
 * Defines specialized methods for workflow data access and management
 */

import { IBaseRepository, QueryOptions, PaginatedResult } from './IBaseRepository';
import { WorkflowRegistry, WorkflowRegistryCreationAttributes, WorkflowRegistryAttributes } from '../../models/WorkflowRegistry';
import { WorkflowExecution } from '../../models/WorkflowExecution';
import { WorkflowAlert } from '../../models/WorkflowAlert';

/**
 * Workflow filters for advanced queries
 */
export interface WorkflowFilters {
  workflowId?: string;
  workflowName?: string;
  workflowType?: 'vpc' | 'subnet' | 'transit_gateway' | 'nat_gateway' | 'vpn';
  provider?: 'aws' | 'azure' | 'gcp' | 'ali' | 'oci' | 'huawei' | 'others';
  isActive?: boolean;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
}

/**
 * Execution filters for history queries
 */
export interface ExecutionFilters {
  workflowId?: string;
  status?: 'success' | 'failure' | 'running' | 'cancelled';
  startTimeAfter?: Date;
  startTimeBefore?: Date;
  endTimeAfter?: Date;
  endTimeBefore?: Date;
  minDuration?: number;
  maxDuration?: number;
  hasErrors?: boolean;
}

/**
 * Time range filter for statistics
 */
export interface TimeRangeFilter {
  startDate: Date;
  endDate: Date;
}

/**
 * Workflow metrics aggregation result
 */
export interface WorkflowMetrics {
  totalWorkflows: number;
  activeWorkflows: number;
  inactiveWorkflows: number;
  workflowsByType: Record<string, number>;
  workflowsByProvider: Record<string, number>;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  runningExecutions: number;
  cancelledExecutions: number;
  averageExecutionTime: number;
  executionSuccessRate: number;
  recentExecutions: WorkflowExecution[];
  topFailedWorkflows: Array<{
    workflowId: string;
    workflowName: string;
    failureCount: number;
    lastFailure: Date;
  }>;
}

/**
 * Execution statistics aggregation result
 */
export interface ExecutionStatistics {
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  runningCount: number;
  cancelledCount: number;
  averageDuration: number;
  minDuration: number;
  maxDuration: number;
  successRate: number;
  executionsPerDay: Array<{
    date: string;
    total: number;
    success: number;
    failure: number;
  }>;
  executionsByWorkflowType: Record<string, {
    total: number;
    success: number;
    failure: number;
    averageDuration: number;
  }>;
  executionsByProvider: Record<string, {
    total: number;
    success: number;
    failure: number;
    averageDuration: number;
  }>;
  resourceProcessingStats: {
    totalResourcesCreated: number;
    totalResourcesUpdated: number;
    totalResourcesFailed: number;
    averageResourcesPerExecution: number;
  };
}

/**
 * Workflow performance metrics
 */
export interface WorkflowPerformanceMetrics {
  workflowId: string;
  workflowName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  lastExecutionTime?: Date;
  lastSuccessTime?: Date;
  lastFailureTime?: Date;
  successRate: number;
  errorRate: number;
  mostCommonErrors: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
  executionTrend: Array<{
    date: string;
    executions: number;
    successRate: number;
  }>;
}

/**
 * Update input types for workflow repository operations
 */
export type WorkflowRegistryUpdateInput = Partial<Omit<WorkflowRegistryAttributes, 'id' | 'created_at' | 'updated_at'>>;

/**
 * Workflow Repository Interface
 * Extends base repository with workflow-specific operations
 */
export interface IWorkflowRepository extends IBaseRepository<
  WorkflowRegistry, 
  WorkflowRegistryCreationAttributes, 
  WorkflowRegistryUpdateInput
> {
  
  /**
   * Find workflow by workflow ID
   */
  findByWorkflowId(workflowId: string): Promise<WorkflowRegistry | null>;

  /**
   * Find workflows by type with pagination
   */
  findByType(
    workflowType: 'vpc' | 'subnet' | 'transit_gateway' | 'nat_gateway' | 'vpn',
    options?: QueryOptions
  ): Promise<PaginatedResult<WorkflowRegistry>>;

  /**
   * Find workflows by provider with pagination
   */
  findByProvider(
    provider: 'aws' | 'azure' | 'gcp' | 'ali' | 'oci' | 'huawei' | 'others',
    options?: QueryOptions
  ): Promise<PaginatedResult<WorkflowRegistry>>;

  /**
   * Find active/inactive workflows
   */
  findByActiveStatus(isActive: boolean, options?: QueryOptions): Promise<PaginatedResult<WorkflowRegistry>>;

  /**
   * Advanced workflow search with multiple filters
   */
  searchWorkflows(filters: WorkflowFilters, options?: QueryOptions): Promise<PaginatedResult<WorkflowRegistry>>;

  /**
   * Get workflow execution history with pagination
   */
  getExecutionHistory(
    workflowId: string, 
    options?: QueryOptions
  ): Promise<PaginatedResult<WorkflowExecution>>;

  /**
   * Get all executions with filters and pagination
   */
  getExecutions(
    filters?: ExecutionFilters,
    options?: QueryOptions
  ): Promise<PaginatedResult<WorkflowExecution>>;

  /**
   * Get failed executions within a time range
   */
  getFailedExecutions(
    timeRange?: TimeRangeFilter,
    options?: QueryOptions
  ): Promise<PaginatedResult<WorkflowExecution>>;

  /**
   * Get running executions
   */
  getRunningExecutions(options?: QueryOptions): Promise<PaginatedResult<WorkflowExecution>>;

  /**
   * Get comprehensive workflow metrics for dashboard
   */
  getWorkflowMetrics(
    timeRange?: TimeRangeFilter,
    filters?: WorkflowFilters
  ): Promise<WorkflowMetrics>;

  /**
   * Get execution statistics within a time range
   */
  getExecutionStatistics(
    timeRange?: TimeRangeFilter,
    filters?: ExecutionFilters
  ): Promise<ExecutionStatistics>;

  /**
   * Get performance metrics for a specific workflow
   */
  getWorkflowPerformanceMetrics(
    workflowId: string,
    timeRange?: TimeRangeFilter
  ): Promise<WorkflowPerformanceMetrics>;

  /**
   * Get workflow alerts with pagination
   */
  getWorkflowAlerts(
    workflowId?: string,
    options?: QueryOptions
  ): Promise<PaginatedResult<WorkflowAlert>>;

  /**
   * Get unresolved alerts
   */
  getUnresolvedAlerts(options?: QueryOptions): Promise<PaginatedResult<WorkflowAlert>>;

  /**
   * Mark alert as resolved
   */
  resolveAlert(alertId: number): Promise<boolean>;

  /**
   * Get workflow statistics grouped by various dimensions
   */
  getWorkflowStatistics(): Promise<{
    totalWorkflows: number;
    activeWorkflows: number;
    workflowsByType: Record<string, number>;
    workflowsByProvider: Record<string, number>;
    executionStats: {
      today: { total: number; success: number; failure: number };
      thisWeek: { total: number; success: number; failure: number };
      thisMonth: { total: number; success: number; failure: number };
    };
    topWorkflowsByExecutions: Array<{
      workflowId: string;
      workflowName: string;
      executionCount: number;
    }>;
    recentFailures: Array<{
      workflowId: string;
      workflowName: string;
      executionId: string;
      failureTime: Date;
      errorMessage?: string;
    }>;
  }>;

  /**
   * Update workflow active status
   */
  updateActiveStatus(workflowId: string, isActive: boolean): Promise<WorkflowRegistry | null>;

  /**
   * Get workflows that haven't run recently (stale workflows)
   */
  getStaleWorkflows(
    olderThan: Date,
    options?: QueryOptions
  ): Promise<PaginatedResult<WorkflowRegistry>>;

  /**
   * Get execution summary for a workflow
   */
  getWorkflowExecutionSummary(workflowId: string): Promise<{
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    runningCount: number;
    lastExecution?: WorkflowExecution;
    averageDuration: number;
    successRate: number;
  }>;
}