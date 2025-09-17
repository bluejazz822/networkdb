/**
 * Workflow Repository Implementation
 * Handles CRUD operations and specialized queries for workflow data
 */

import { WhereOptions, Op, fn, col, literal, Sequelize, FindOptions, Order } from 'sequelize';
import { BaseRepository } from './BaseRepository';
import { WorkflowRegistry, WorkflowRegistryCreationAttributes } from '../models/WorkflowRegistry';
import { WorkflowExecution } from '../models/WorkflowExecution';
import { WorkflowAlert } from '../models/WorkflowAlert';
import { 
  IWorkflowRepository, 
  WorkflowFilters, 
  ExecutionFilters, 
  TimeRangeFilter, 
  WorkflowMetrics, 
  ExecutionStatistics, 
  WorkflowPerformanceMetrics,
  WorkflowRegistryUpdateInput
} from './interfaces/IWorkflowRepository';
import { QueryOptions, PaginatedResult } from './interfaces/IBaseRepository';

/**
 * WorkflowRepository class implementing workflow-specific data access operations
 */
export class WorkflowRepository extends BaseRepository<
  WorkflowRegistry, 
  WorkflowRegistryCreationAttributes, 
  WorkflowRegistryUpdateInput
> implements IWorkflowRepository {
  
  constructor() {
    super(WorkflowRegistry);
  }

  /**
   * Find workflow by workflow ID
   */
  async findByWorkflowId(workflowId: string): Promise<WorkflowRegistry | null> {
    try {
      return await this.model.findOne({
        where: { workflow_id: workflowId }
      });
    } catch (error) {
      throw new Error(`Failed to find workflow by ID ${workflowId}: ${error.message}`);
    }
  }

  /**
   * Find workflows by type with pagination
   */
  async findByType(
    workflowType: 'vpc' | 'subnet' | 'transit_gateway' | 'nat_gateway' | 'vpn',
    options?: QueryOptions
  ): Promise<PaginatedResult<WorkflowRegistry>> {
    try {
      return await this.findBy({ workflow_type: workflowType }, options);
    } catch (error) {
      throw new Error(`Failed to find workflows by type ${workflowType}: ${error.message}`);
    }
  }

  /**
   * Find workflows by provider with pagination
   */
  async findByProvider(
    provider: 'aws' | 'azure' | 'gcp' | 'ali' | 'oci' | 'huawei' | 'others',
    options?: QueryOptions
  ): Promise<PaginatedResult<WorkflowRegistry>> {
    try {
      return await this.findBy({ provider }, options);
    } catch (error) {
      throw new Error(`Failed to find workflows by provider ${provider}: ${error.message}`);
    }
  }

  /**
   * Find active/inactive workflows
   */
  async findByActiveStatus(isActive: boolean, options?: QueryOptions): Promise<PaginatedResult<WorkflowRegistry>> {
    try {
      return await this.findBy({ is_active: isActive }, options);
    } catch (error) {
      throw new Error(`Failed to find workflows by active status ${isActive}: ${error.message}`);
    }
  }

  /**
   * Advanced workflow search with multiple filters
   */
  async searchWorkflows(filters: WorkflowFilters, options?: QueryOptions): Promise<PaginatedResult<WorkflowRegistry>> {
    try {
      const where: WhereOptions = {};

      if (filters.workflowId) {
        where.workflow_id = filters.workflowId;
      }

      if (filters.workflowName) {
        where.workflow_name = { [Op.iLike]: `%${filters.workflowName}%` };
      }

      if (filters.workflowType) {
        where.workflow_type = filters.workflowType;
      }

      if (filters.provider) {
        where.provider = filters.provider;
      }

      if (filters.isActive !== undefined) {
        where.is_active = filters.isActive;
      }

      if (filters.createdAfter || filters.createdBefore) {
        where.created_at = {};
        if (filters.createdAfter) {
          where.created_at[Op.gte] = filters.createdAfter;
        }
        if (filters.createdBefore) {
          where.created_at[Op.lte] = filters.createdBefore;
        }
      }

      if (filters.updatedAfter || filters.updatedBefore) {
        where.updated_at = {};
        if (filters.updatedAfter) {
          where.updated_at[Op.gte] = filters.updatedAfter;
        }
        if (filters.updatedBefore) {
          where.updated_at[Op.lte] = filters.updatedBefore;
        }
      }

      return await this.findBy(where, options);
    } catch (error) {
      throw new Error(`Failed to search workflows: ${error.message}`);
    }
  }

  /**
   * Get workflow execution history with pagination
   */
  async getExecutionHistory(
    workflowId: string, 
    options?: QueryOptions
  ): Promise<PaginatedResult<WorkflowExecution>> {
    try {
      const { page, pageSize, pagination } = this.buildPaginationOptions(options);
      
      const findOptions: FindOptions = {
        where: { workflow_id: workflowId },
        order: [['start_time', 'DESC']],
        ...pagination
      };

      if (options?.include) {
        findOptions.include = options.include;
      }

      const { count, rows } = await WorkflowExecution.findAndCountAll(findOptions);
      
      return this.buildPaginatedResult(rows, count, page, pageSize);
    } catch (error) {
      throw new Error(`Failed to get execution history for workflow ${workflowId}: ${error.message}`);
    }
  }

  /**
   * Get all executions with filters and pagination
   */
  async getExecutions(
    filters?: ExecutionFilters,
    options?: QueryOptions
  ): Promise<PaginatedResult<WorkflowExecution>> {
    try {
      const { page, pageSize, pagination } = this.buildPaginationOptions(options);
      const where: WhereOptions = {};

      if (filters) {
        if (filters.workflowId) {
          where.workflow_id = filters.workflowId;
        }

        if (filters.status) {
          where.status = filters.status;
        }

        if (filters.startTimeAfter || filters.startTimeBefore) {
          where.start_time = {};
          if (filters.startTimeAfter) {
            where.start_time[Op.gte] = filters.startTimeAfter;
          }
          if (filters.startTimeBefore) {
            where.start_time[Op.lte] = filters.startTimeBefore;
          }
        }

        if (filters.endTimeAfter || filters.endTimeBefore) {
          where.end_time = {};
          if (filters.endTimeAfter) {
            where.end_time[Op.gte] = filters.endTimeAfter;
          }
          if (filters.endTimeBefore) {
            where.end_time[Op.lte] = filters.endTimeBefore;
          }
        }

        if (filters.minDuration || filters.maxDuration) {
          where.duration_ms = {};
          if (filters.minDuration) {
            where.duration_ms[Op.gte] = filters.minDuration;
          }
          if (filters.maxDuration) {
            where.duration_ms[Op.lte] = filters.maxDuration;
          }
        }

        if (filters.hasErrors !== undefined) {
          if (filters.hasErrors) {
            where.error_message = { [Op.ne]: null };
          } else {
            where.error_message = { [Op.is]: null };
          }
        }
      }

      const findOptions: FindOptions = {
        where,
        order: [['start_time', 'DESC']],
        ...pagination,
        include: options?.include
      };

      const { count, rows } = await WorkflowExecution.findAndCountAll(findOptions);
      
      return this.buildPaginatedResult(rows, count, page, pageSize);
    } catch (error) {
      throw new Error(`Failed to get executions: ${error.message}`);
    }
  }

  /**
   * Get failed executions within a time range
   */
  async getFailedExecutions(
    timeRange?: TimeRangeFilter,
    options?: QueryOptions
  ): Promise<PaginatedResult<WorkflowExecution>> {
    try {
      const filters: ExecutionFilters = { status: 'failure' };
      
      if (timeRange) {
        filters.startTimeAfter = timeRange.startDate;
        filters.startTimeBefore = timeRange.endDate;
      }

      return await this.getExecutions(filters, options);
    } catch (error) {
      throw new Error(`Failed to get failed executions: ${error.message}`);
    }
  }

  /**
   * Get running executions
   */
  async getRunningExecutions(options?: QueryOptions): Promise<PaginatedResult<WorkflowExecution>> {
    try {
      return await this.getExecutions({ status: 'running' }, options);
    } catch (error) {
      throw new Error(`Failed to get running executions: ${error.message}`);
    }
  }

  /**
   * Get comprehensive workflow metrics for dashboard
   */
  async getWorkflowMetrics(
    timeRange?: TimeRangeFilter,
    filters?: WorkflowFilters
  ): Promise<WorkflowMetrics> {
    try {
      // Build base where conditions
      let workflowWhere: WhereOptions = {};
      let executionWhere: WhereOptions = {};

      if (filters) {
        if (filters.workflowType) workflowWhere.workflow_type = filters.workflowType;
        if (filters.provider) workflowWhere.provider = filters.provider;
        if (filters.isActive !== undefined) workflowWhere.is_active = filters.isActive;
      }

      if (timeRange) {
        executionWhere.start_time = {
          [Op.between]: [timeRange.startDate, timeRange.endDate]
        };
      }

      // Get workflow counts
      const totalWorkflows = await this.model.count({ where: workflowWhere });
      const activeWorkflows = await this.model.count({ 
        where: { ...workflowWhere, is_active: true } 
      });
      const inactiveWorkflows = totalWorkflows - activeWorkflows;

      // Get workflows by type
      const typeStats = await this.model.findAll({
        attributes: [
          'workflow_type',
          [fn('COUNT', '*'), 'count']
        ],
        where: workflowWhere,
        group: ['workflow_type'],
        raw: true
      }) as any[];

      const workflowsByType = typeStats.reduce((acc, stat) => {
        acc[stat.workflow_type] = parseInt(stat.count);
        return acc;
      }, {} as Record<string, number>);

      // Get workflows by provider
      const providerStats = await this.model.findAll({
        attributes: [
          'provider',
          [fn('COUNT', '*'), 'count']
        ],
        where: workflowWhere,
        group: ['provider'],
        raw: true
      }) as any[];

      const workflowsByProvider = providerStats.reduce((acc, stat) => {
        acc[stat.provider] = parseInt(stat.count);
        return acc;
      }, {} as Record<string, number>);

      // Get execution statistics
      const executionStats = await WorkflowExecution.findAll({
        attributes: [
          'status',
          [fn('COUNT', '*'), 'count'],
          [fn('AVG', col('duration_ms')), 'avg_duration']
        ],
        where: executionWhere,
        group: ['status'],
        raw: true
      }) as any[];

      let totalExecutions = 0;
      let successfulExecutions = 0;
      let failedExecutions = 0;
      let runningExecutions = 0;
      let cancelledExecutions = 0;
      let averageExecutionTime = 0;

      executionStats.forEach(stat => {
        const count = parseInt(stat.count);
        totalExecutions += count;
        
        switch (stat.status) {
          case 'success':
            successfulExecutions = count;
            break;
          case 'failure':
            failedExecutions = count;
            break;
          case 'running':
            runningExecutions = count;
            break;
          case 'cancelled':
            cancelledExecutions = count;
            break;
        }
      });

      // Calculate average execution time from all completed executions
      const avgResult = await WorkflowExecution.findOne({
        attributes: [[fn('AVG', col('duration_ms')), 'avg_duration']],
        where: {
          ...executionWhere,
          duration_ms: { [Op.ne]: null }
        },
        raw: true
      }) as any;

      averageExecutionTime = avgResult?.avg_duration ? parseFloat(avgResult.avg_duration) : 0;

      const executionSuccessRate = totalExecutions > 0 ? 
        (successfulExecutions / totalExecutions) * 100 : 0;

      // Get recent executions
      const recentExecutions = await WorkflowExecution.findAll({
        where: executionWhere,
        order: [['start_time', 'DESC']],
        limit: 10,
        include: [{
          model: WorkflowRegistry,
          attributes: ['workflow_name']
        }]
      });

      // Get top failed workflows
      const failedWorkflowsQuery = `
        SELECT 
          wr.workflow_id,
          wr.workflow_name,
          COUNT(we.id) as failure_count,
          MAX(we.start_time) as last_failure
        FROM workflow_registry wr
        JOIN workflow_executions we ON wr.workflow_id = we.workflow_id
        WHERE we.status = 'failure'
        ${timeRange ? `AND we.start_time BETWEEN '${timeRange.startDate.toISOString()}' AND '${timeRange.endDate.toISOString()}'` : ''}
        GROUP BY wr.workflow_id, wr.workflow_name
        ORDER BY failure_count DESC
        LIMIT 5
      `;

      const topFailedWorkflows = await this.model.sequelize!.query(
        failedWorkflowsQuery,
        { type: Sequelize.QueryTypes.SELECT }
      ) as Array<{
        workflow_id: string;
        workflow_name: string;
        failure_count: string;
        last_failure: string;
      }>;

      return {
        totalWorkflows,
        activeWorkflows,
        inactiveWorkflows,
        workflowsByType,
        workflowsByProvider,
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        runningExecutions,
        cancelledExecutions,
        averageExecutionTime,
        executionSuccessRate,
        recentExecutions,
        topFailedWorkflows: topFailedWorkflows.map(wf => ({
          workflowId: wf.workflow_id,
          workflowName: wf.workflow_name,
          failureCount: parseInt(wf.failure_count),
          lastFailure: new Date(wf.last_failure)
        }))
      };
    } catch (error) {
      throw new Error(`Failed to get workflow metrics: ${error.message}`);
    }
  }

  /**
   * Get execution statistics within a time range
   */
  async getExecutionStatistics(
    timeRange?: TimeRangeFilter,
    filters?: ExecutionFilters
  ): Promise<ExecutionStatistics> {
    try {
      const where: WhereOptions = {};

      if (timeRange) {
        where.start_time = {
          [Op.between]: [timeRange.startDate, timeRange.endDate]
        };
      }

      if (filters) {
        if (filters.workflowId) where.workflow_id = filters.workflowId;
        if (filters.status) where.status = filters.status;
      }

      // Basic execution counts and statistics
      const basicStats = await WorkflowExecution.findOne({
        attributes: [
          [fn('COUNT', '*'), 'total'],
          [fn('COUNT', literal("CASE WHEN status = 'success' THEN 1 END")), 'success'],
          [fn('COUNT', literal("CASE WHEN status = 'failure' THEN 1 END")), 'failure'],
          [fn('COUNT', literal("CASE WHEN status = 'running' THEN 1 END")), 'running'],
          [fn('COUNT', literal("CASE WHEN status = 'cancelled' THEN 1 END")), 'cancelled'],
          [fn('AVG', col('duration_ms')), 'avg_duration'],
          [fn('MIN', col('duration_ms')), 'min_duration'],
          [fn('MAX', col('duration_ms')), 'max_duration'],
          [fn('SUM', col('resources_created')), 'total_created'],
          [fn('SUM', col('resources_updated')), 'total_updated'],
          [fn('SUM', col('resources_failed')), 'total_failed']
        ],
        where,
        raw: true
      }) as any;

      const totalExecutions = parseInt(basicStats.total) || 0;
      const successCount = parseInt(basicStats.success) || 0;
      const failureCount = parseInt(basicStats.failure) || 0;
      const runningCount = parseInt(basicStats.running) || 0;
      const cancelledCount = parseInt(basicStats.cancelled) || 0;
      const averageDuration = parseFloat(basicStats.avg_duration) || 0;
      const minDuration = parseFloat(basicStats.min_duration) || 0;
      const maxDuration = parseFloat(basicStats.max_duration) || 0;
      const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;

      // Executions per day
      const dailyStatsQuery = `
        SELECT 
          DATE(start_time) as date,
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'success' THEN 1 END) as success,
          COUNT(CASE WHEN status = 'failure' THEN 1 END) as failure
        FROM workflow_executions
        WHERE ${timeRange ? `start_time BETWEEN '${timeRange.startDate.toISOString()}' AND '${timeRange.endDate.toISOString()}'` : '1=1'}
        ${filters?.workflowId ? `AND workflow_id = '${filters.workflowId}'` : ''}
        GROUP BY DATE(start_time)
        ORDER BY date DESC
        LIMIT 30
      `;

      const dailyStats = await this.model.sequelize!.query(
        dailyStatsQuery,
        { type: Sequelize.QueryTypes.SELECT }
      ) as any[];

      const executionsPerDay = dailyStats.map(day => ({
        date: day.date,
        total: parseInt(day.total),
        success: parseInt(day.success),
        failure: parseInt(day.failure)
      }));

      // Executions by workflow type
      const typeStatsQuery = `
        SELECT 
          wr.workflow_type,
          COUNT(we.*) as total,
          COUNT(CASE WHEN we.status = 'success' THEN 1 END) as success,
          COUNT(CASE WHEN we.status = 'failure' THEN 1 END) as failure,
          AVG(we.duration_ms) as avg_duration
        FROM workflow_executions we
        JOIN workflow_registry wr ON we.workflow_id = wr.workflow_id
        WHERE ${timeRange ? `we.start_time BETWEEN '${timeRange.startDate.toISOString()}' AND '${timeRange.endDate.toISOString()}'` : '1=1'}
        GROUP BY wr.workflow_type
      `;

      const typeStats = await this.model.sequelize!.query(
        typeStatsQuery,
        { type: Sequelize.QueryTypes.SELECT }
      ) as any[];

      const executionsByWorkflowType = typeStats.reduce((acc, stat) => {
        acc[stat.workflow_type] = {
          total: parseInt(stat.total),
          success: parseInt(stat.success),
          failure: parseInt(stat.failure),
          averageDuration: parseFloat(stat.avg_duration) || 0
        };
        return acc;
      }, {} as Record<string, any>);

      // Executions by provider
      const providerStatsQuery = `
        SELECT 
          wr.provider,
          COUNT(we.*) as total,
          COUNT(CASE WHEN we.status = 'success' THEN 1 END) as success,
          COUNT(CASE WHEN we.status = 'failure' THEN 1 END) as failure,
          AVG(we.duration_ms) as avg_duration
        FROM workflow_executions we
        JOIN workflow_registry wr ON we.workflow_id = wr.workflow_id
        WHERE ${timeRange ? `we.start_time BETWEEN '${timeRange.startDate.toISOString()}' AND '${timeRange.endDate.toISOString()}'` : '1=1'}
        GROUP BY wr.provider
      `;

      const providerStats = await this.model.sequelize!.query(
        providerStatsQuery,
        { type: Sequelize.QueryTypes.SELECT }
      ) as any[];

      const executionsByProvider = providerStats.reduce((acc, stat) => {
        acc[stat.provider] = {
          total: parseInt(stat.total),
          success: parseInt(stat.success),
          failure: parseInt(stat.failure),
          averageDuration: parseFloat(stat.avg_duration) || 0
        };
        return acc;
      }, {} as Record<string, any>);

      // Resource processing statistics
      const totalResourcesCreated = parseInt(basicStats.total_created) || 0;
      const totalResourcesUpdated = parseInt(basicStats.total_updated) || 0;
      const totalResourcesFailed = parseInt(basicStats.total_failed) || 0;
      const averageResourcesPerExecution = totalExecutions > 0 ? 
        (totalResourcesCreated + totalResourcesUpdated) / totalExecutions : 0;

      return {
        totalExecutions,
        successCount,
        failureCount,
        runningCount,
        cancelledCount,
        averageDuration,
        minDuration,
        maxDuration,
        successRate,
        executionsPerDay,
        executionsByWorkflowType,
        executionsByProvider,
        resourceProcessingStats: {
          totalResourcesCreated,
          totalResourcesUpdated,
          totalResourcesFailed,
          averageResourcesPerExecution
        }
      };
    } catch (error) {
      throw new Error(`Failed to get execution statistics: ${error.message}`);
    }
  }

  /**
   * Get performance metrics for a specific workflow
   */
  async getWorkflowPerformanceMetrics(
    workflowId: string,
    timeRange?: TimeRangeFilter
  ): Promise<WorkflowPerformanceMetrics> {
    try {
      // Get workflow info
      const workflow = await this.findByWorkflowId(workflowId);
      if (!workflow) {
        throw new Error(`Workflow ${workflowId} not found`);
      }

      const where: WhereOptions = { workflow_id: workflowId };
      if (timeRange) {
        where.start_time = {
          [Op.between]: [timeRange.startDate, timeRange.endDate]
        };
      }

      // Basic performance stats
      const basicStats = await WorkflowExecution.findOne({
        attributes: [
          [fn('COUNT', '*'), 'total'],
          [fn('COUNT', literal("CASE WHEN status = 'success' THEN 1 END")), 'success'],
          [fn('COUNT', literal("CASE WHEN status = 'failure' THEN 1 END")), 'failure'],
          [fn('AVG', col('duration_ms')), 'avg_duration'],
          [fn('MIN', col('duration_ms')), 'min_duration'],
          [fn('MAX', col('duration_ms')), 'max_duration'],
          [fn('MAX', col('start_time')), 'last_execution'],
          [fn('MAX', literal("CASE WHEN status = 'success' THEN start_time END")), 'last_success'],
          [fn('MAX', literal("CASE WHEN status = 'failure' THEN start_time END")), 'last_failure']
        ],
        where,
        raw: true
      }) as any;

      const totalExecutions = parseInt(basicStats.total) || 0;
      const successfulExecutions = parseInt(basicStats.success) || 0;
      const failedExecutions = parseInt(basicStats.failure) || 0;
      const averageExecutionTime = parseFloat(basicStats.avg_duration) || 0;
      const minExecutionTime = parseFloat(basicStats.min_duration) || 0;
      const maxExecutionTime = parseFloat(basicStats.max_duration) || 0;
      const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
      const errorRate = 100 - successRate;

      // Most common errors
      const errorStats = await WorkflowExecution.findAll({
        attributes: [
          'error_message',
          [fn('COUNT', '*'), 'count']
        ],
        where: {
          ...where,
          status: 'failure',
          error_message: { [Op.ne]: null }
        },
        group: ['error_message'],
        order: [[fn('COUNT', '*'), 'DESC']],
        limit: 5,
        raw: true
      }) as any[];

      const totalErrors = errorStats.reduce((sum, error) => sum + parseInt(error.count), 0);
      const mostCommonErrors = errorStats.map(error => ({
        error: error.error_message,
        count: parseInt(error.count),
        percentage: totalErrors > 0 ? (parseInt(error.count) / totalErrors) * 100 : 0
      }));

      // Execution trend (daily aggregates)
      const trendQuery = `
        SELECT 
          DATE(start_time) as date,
          COUNT(*) as executions,
          CASE WHEN COUNT(*) > 0 
            THEN (COUNT(CASE WHEN status = 'success' THEN 1 END) * 100.0 / COUNT(*))
            ELSE 0 
          END as success_rate
        FROM workflow_executions
        WHERE workflow_id = :workflowId
        ${timeRange ? 'AND start_time BETWEEN :startDate AND :endDate' : ''}
        GROUP BY DATE(start_time)
        ORDER BY date DESC
        LIMIT 30
      `;

      const trendData = await this.model.sequelize!.query(
        trendQuery,
        { 
          type: Sequelize.QueryTypes.SELECT,
          replacements: {
            workflowId,
            ...(timeRange && {
              startDate: timeRange.startDate.toISOString(),
              endDate: timeRange.endDate.toISOString()
            })
          }
        }
      ) as any[];

      const executionTrend = trendData.map(trend => ({
        date: trend.date,
        executions: parseInt(trend.executions),
        successRate: parseFloat(trend.success_rate)
      }));

      return {
        workflowId,
        workflowName: workflow.workflow_name,
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        averageExecutionTime,
        minExecutionTime,
        maxExecutionTime,
        lastExecutionTime: basicStats.last_execution ? new Date(basicStats.last_execution) : undefined,
        lastSuccessTime: basicStats.last_success ? new Date(basicStats.last_success) : undefined,
        lastFailureTime: basicStats.last_failure ? new Date(basicStats.last_failure) : undefined,
        successRate,
        errorRate,
        mostCommonErrors,
        executionTrend
      };
    } catch (error) {
      throw new Error(`Failed to get performance metrics for workflow ${workflowId}: ${error.message}`);
    }
  }

  /**
   * Get workflow alerts with pagination
   */
  async getWorkflowAlerts(
    workflowId?: string,
    options?: QueryOptions
  ): Promise<PaginatedResult<WorkflowAlert>> {
    try {
      const { page, pageSize, pagination } = this.buildPaginationOptions(options);
      const where: WhereOptions = {};

      if (workflowId) {
        // Join with executions to filter by workflow_id
        const executions = await WorkflowExecution.findAll({
          attributes: ['execution_id'],
          where: { workflow_id: workflowId },
          raw: true
        });
        
        const executionIds = executions.map(exec => exec.execution_id);
        where.execution_id = { [Op.in]: executionIds };
      }

      const findOptions: FindOptions = {
        where,
        order: [['sent_at', 'DESC']],
        ...pagination,
        include: options?.include
      };

      const { count, rows } = await WorkflowAlert.findAndCountAll(findOptions);
      
      return this.buildPaginatedResult(rows, count, page, pageSize);
    } catch (error) {
      throw new Error(`Failed to get workflow alerts: ${error.message}`);
    }
  }

  /**
   * Get unresolved alerts
   */
  async getUnresolvedAlerts(options?: QueryOptions): Promise<PaginatedResult<WorkflowAlert>> {
    try {
      const { page, pageSize, pagination } = this.buildPaginationOptions(options);
      
      const findOptions: FindOptions = {
        where: { resolved_at: null },
        order: [['sent_at', 'DESC']],
        ...pagination,
        include: options?.include
      };

      const { count, rows } = await WorkflowAlert.findAndCountAll(findOptions);
      
      return this.buildPaginatedResult(rows, count, page, pageSize);
    } catch (error) {
      throw new Error(`Failed to get unresolved alerts: ${error.message}`);
    }
  }

  /**
   * Mark alert as resolved
   */
  async resolveAlert(alertId: number): Promise<boolean> {
    try {
      const [updatedCount] = await WorkflowAlert.update(
        { resolved_at: new Date() },
        { where: { id: alertId } }
      );
      return updatedCount > 0;
    } catch (error) {
      throw new Error(`Failed to resolve alert ${alertId}: ${error.message}`);
    }
  }

  /**
   * Get workflow statistics grouped by various dimensions
   */
  async getWorkflowStatistics(): Promise<{
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
  }> {
    try {
      // Basic workflow counts
      const totalWorkflows = await this.count();
      const activeWorkflows = await this.count({ is_active: true });

      // Workflows by type and provider
      const [typeStats, providerStats] = await Promise.all([
        this.model.findAll({
          attributes: ['workflow_type', [fn('COUNT', '*'), 'count']],
          group: ['workflow_type'],
          raw: true
        }),
        this.model.findAll({
          attributes: ['provider', [fn('COUNT', '*'), 'count']],
          group: ['provider'],
          raw: true
        })
      ]);

      const workflowsByType = typeStats.reduce((acc: Record<string, number>, stat: any) => {
        acc[stat.workflow_type] = parseInt(stat.count);
        return acc;
      }, {});

      const workflowsByProvider = providerStats.reduce((acc: Record<string, number>, stat: any) => {
        acc[stat.provider] = parseInt(stat.count);
        return acc;
      }, {});

      // Execution statistics for different time periods
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const thisWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisMonth = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      const [todayStats, weekStats, monthStats] = await Promise.all([
        WorkflowExecution.findOne({
          attributes: [
            [fn('COUNT', '*'), 'total'],
            [fn('COUNT', literal("CASE WHEN status = 'success' THEN 1 END")), 'success'],
            [fn('COUNT', literal("CASE WHEN status = 'failure' THEN 1 END")), 'failure']
          ],
          where: { start_time: { [Op.gte]: today } },
          raw: true
        }),
        WorkflowExecution.findOne({
          attributes: [
            [fn('COUNT', '*'), 'total'],
            [fn('COUNT', literal("CASE WHEN status = 'success' THEN 1 END")), 'success'],
            [fn('COUNT', literal("CASE WHEN status = 'failure' THEN 1 END")), 'failure']
          ],
          where: { start_time: { [Op.gte]: thisWeek } },
          raw: true
        }),
        WorkflowExecution.findOne({
          attributes: [
            [fn('COUNT', '*'), 'total'],
            [fn('COUNT', literal("CASE WHEN status = 'success' THEN 1 END")), 'success'],
            [fn('COUNT', literal("CASE WHEN status = 'failure' THEN 1 END")), 'failure']
          ],
          where: { start_time: { [Op.gte]: thisMonth } },
          raw: true
        })
      ]);

      const executionStats = {
        today: {
          total: parseInt((todayStats as any)?.total) || 0,
          success: parseInt((todayStats as any)?.success) || 0,
          failure: parseInt((todayStats as any)?.failure) || 0
        },
        thisWeek: {
          total: parseInt((weekStats as any)?.total) || 0,
          success: parseInt((weekStats as any)?.success) || 0,
          failure: parseInt((weekStats as any)?.failure) || 0
        },
        thisMonth: {
          total: parseInt((monthStats as any)?.total) || 0,
          success: parseInt((monthStats as any)?.success) || 0,
          failure: parseInt((monthStats as any)?.failure) || 0
        }
      };

      // Top workflows by execution count
      const topWorkflowsQuery = `
        SELECT 
          wr.workflow_id,
          wr.workflow_name,
          COUNT(we.id) as execution_count
        FROM workflow_registry wr
        LEFT JOIN workflow_executions we ON wr.workflow_id = we.workflow_id
        WHERE we.start_time >= :monthAgo
        GROUP BY wr.workflow_id, wr.workflow_name
        ORDER BY execution_count DESC
        LIMIT 10
      `;

      const topWorkflows = await this.model.sequelize!.query(
        topWorkflowsQuery,
        { 
          type: Sequelize.QueryTypes.SELECT,
          replacements: { monthAgo: thisMonth.toISOString() }
        }
      ) as any[];

      const topWorkflowsByExecutions = topWorkflows.map(wf => ({
        workflowId: wf.workflow_id,
        workflowName: wf.workflow_name,
        executionCount: parseInt(wf.execution_count)
      }));

      // Recent failures
      const recentFailuresQuery = `
        SELECT 
          wr.workflow_id,
          wr.workflow_name,
          we.execution_id,
          we.start_time as failure_time,
          we.error_message
        FROM workflow_executions we
        JOIN workflow_registry wr ON we.workflow_id = wr.workflow_id
        WHERE we.status = 'failure'
        ORDER BY we.start_time DESC
        LIMIT 20
      `;

      const failures = await this.model.sequelize!.query(
        recentFailuresQuery,
        { type: Sequelize.QueryTypes.SELECT }
      ) as any[];

      const recentFailures = failures.map(failure => ({
        workflowId: failure.workflow_id,
        workflowName: failure.workflow_name,
        executionId: failure.execution_id,
        failureTime: new Date(failure.failure_time),
        errorMessage: failure.error_message
      }));

      return {
        totalWorkflows,
        activeWorkflows,
        workflowsByType,
        workflowsByProvider,
        executionStats,
        topWorkflowsByExecutions,
        recentFailures
      };
    } catch (error) {
      throw new Error(`Failed to get workflow statistics: ${error.message}`);
    }
  }

  /**
   * Update workflow active status
   */
  async updateActiveStatus(workflowId: string, isActive: boolean): Promise<WorkflowRegistry | null> {
    try {
      const workflow = await this.findByWorkflowId(workflowId);
      if (!workflow) {
        return null;
      }

      return await this.updateById(workflow.id, { is_active: isActive });
    } catch (error) {
      throw new Error(`Failed to update active status for workflow ${workflowId}: ${error.message}`);
    }
  }

  /**
   * Get workflows that haven't run recently (stale workflows)
   */
  async getStaleWorkflows(
    olderThan: Date,
    options?: QueryOptions
  ): Promise<PaginatedResult<WorkflowRegistry>> {
    try {
      const { page, pageSize, pagination } = this.buildPaginationOptions(options);
      
      // Find workflows that either have no executions or last execution is older than specified date
      const staleWorkflowsQuery = `
        SELECT DISTINCT wr.*
        FROM workflow_registry wr
        LEFT JOIN workflow_executions we ON wr.workflow_id = we.workflow_id
        WHERE wr.is_active = true
        AND (
          we.workflow_id IS NULL 
          OR wr.workflow_id NOT IN (
            SELECT DISTINCT workflow_id 
            FROM workflow_executions 
            WHERE start_time > :olderThan
          )
        )
        ORDER BY wr.updated_at DESC
        ${pagination.limit ? `LIMIT ${pagination.limit}` : ''}
        ${pagination.offset ? `OFFSET ${pagination.offset}` : ''}
      `;

      const workflows = await this.model.sequelize!.query(
        staleWorkflowsQuery,
        { 
          type: Sequelize.QueryTypes.SELECT,
          replacements: { olderThan: olderThan.toISOString() },
          model: this.model,
          mapToModel: true
        }
      ) as WorkflowRegistry[];

      // Get count for pagination
      const countQuery = `
        SELECT COUNT(DISTINCT wr.workflow_id) as count
        FROM workflow_registry wr
        LEFT JOIN workflow_executions we ON wr.workflow_id = we.workflow_id
        WHERE wr.is_active = true
        AND (
          we.workflow_id IS NULL 
          OR wr.workflow_id NOT IN (
            SELECT DISTINCT workflow_id 
            FROM workflow_executions 
            WHERE start_time > :olderThan
          )
        )
      `;

      const countResult = await this.model.sequelize!.query(
        countQuery,
        { 
          type: Sequelize.QueryTypes.SELECT,
          replacements: { olderThan: olderThan.toISOString() }
        }
      ) as any[];

      const total = parseInt(countResult[0]?.count) || 0;

      return this.buildPaginatedResult(workflows, total, page, pageSize);
    } catch (error) {
      throw new Error(`Failed to get stale workflows: ${error.message}`);
    }
  }

  /**
   * Get execution summary for a workflow
   */
  async getWorkflowExecutionSummary(workflowId: string): Promise<{
    totalExecutions: number;
    successCount: number;
    failureCount: number;
    runningCount: number;
    lastExecution?: WorkflowExecution;
    averageDuration: number;
    successRate: number;
  }> {
    try {
      const [stats, lastExecution] = await Promise.all([
        WorkflowExecution.findOne({
          attributes: [
            [fn('COUNT', '*'), 'total'],
            [fn('COUNT', literal("CASE WHEN status = 'success' THEN 1 END")), 'success'],
            [fn('COUNT', literal("CASE WHEN status = 'failure' THEN 1 END")), 'failure'],
            [fn('COUNT', literal("CASE WHEN status = 'running' THEN 1 END")), 'running'],
            [fn('AVG', col('duration_ms')), 'avg_duration']
          ],
          where: { workflow_id: workflowId },
          raw: true
        }),
        WorkflowExecution.findOne({
          where: { workflow_id: workflowId },
          order: [['start_time', 'DESC']]
        })
      ]);

      const totalExecutions = parseInt((stats as any)?.total) || 0;
      const successCount = parseInt((stats as any)?.success) || 0;
      const failureCount = parseInt((stats as any)?.failure) || 0;
      const runningCount = parseInt((stats as any)?.running) || 0;
      const averageDuration = parseFloat((stats as any)?.avg_duration) || 0;
      const successRate = totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;

      return {
        totalExecutions,
        successCount,
        failureCount,
        runningCount,
        lastExecution: lastExecution || undefined,
        averageDuration,
        successRate
      };
    } catch (error) {
      throw new Error(`Failed to get execution summary for workflow ${workflowId}: ${error.message}`);
    }
  }

  /**
   * Enhanced search that includes workflow name, ID, and type searching
   */
  protected buildSearchWhere(search: string, existingWhere: WhereOptions): WhereOptions {
    const searchPattern = `%${search}%`;
    
    return {
      ...existingWhere,
      [Op.or]: [
        { workflow_name: { [Op.iLike]: searchPattern } },
        { workflow_id: { [Op.iLike]: searchPattern } },
        { workflow_type: { [Op.iLike]: searchPattern } },
        { provider: { [Op.iLike]: searchPattern } }
      ]
    };
  }
}

export default WorkflowRepository;