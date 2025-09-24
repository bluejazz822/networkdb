/**
 * Optimized Query Patterns for Reporting Operations
 *
 * This module provides pre-built, optimized SQL queries for common reporting
 * patterns with prepared statements, performance monitoring, and query building utilities.
 */

import { QueryTypes, Op } from 'sequelize';
import { executeReportQuery } from '../connections/ReportingConnectionPool';
import {
  ReportType,
  ReportCategory,
  CloudProvider,
  ExecutionStatus,
  TriggerType,
  ReportFilters,
  ExecutionFilters,
  PaginationOptions,
  PaginatedResult,
  ReportsTable,
  ReportExecutionsTable,
} from '../schema/reports';
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.label({ label: 'ReportQueries' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Query execution options
export interface QueryExecutionOptions {
  useCache?: boolean;
  cacheTtl?: number;
  timeout?: number;
  maxRows?: number;
  explain?: boolean;
}

// Common query response metadata
export interface QueryMetadata {
  executionTime: number;
  recordCount: number;
  fromCache: boolean;
  queryComplexity: 'simple' | 'moderate' | 'complex';
  optimizationHints?: string[];
}

// Query result wrapper
export interface QueryResult<T> {
  data: T;
  metadata: QueryMetadata;
}

/**
 * Core Report Queries Class
 *
 * Provides optimized queries for report and execution management
 * with built-in performance monitoring and caching.
 */
export class ReportQueries {

  // ===================== REPORT CRUD OPERATIONS =====================

  /**
   * Get all reports with optional filtering and pagination
   */
  static async getReports(
    filters?: ReportFilters,
    pagination?: PaginationOptions,
    options?: QueryExecutionOptions
  ): Promise<QueryResult<PaginatedResult<ReportsTable>>> {
    const startTime = Date.now();

    // Build WHERE clause
    const { whereClause, replacements } = this.buildReportFilters(filters);

    // Build ORDER BY clause
    const orderClause = this.buildOrderClause(
      pagination?.sort || 'updated_at',
      pagination?.order || 'DESC'
    );

    // Build pagination
    const limit = Math.min(pagination?.limit || 50, 1000); // Cap at 1000
    const offset = ((pagination?.page || 1) - 1) * limit;

    // Main query
    const query = `
      SELECT
        r.*,
        u1.username as created_by_username,
        u2.username as last_modified_by_username,
        COUNT(re.id) as execution_count,
        MAX(re.start_time) as last_execution,
        COUNT(CASE WHEN re.status = 'completed' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN re.status = 'failed' THEN 1 END) as failed_executions
      FROM reports r
      LEFT JOIN users u1 ON r.created_by = u1.id
      LEFT JOIN users u2 ON r.last_modified_by = u2.id
      LEFT JOIN report_executions re ON r.report_id = re.report_id
      ${whereClause}
      GROUP BY r.id, u1.username, u2.username
      ${orderClause}
      LIMIT :limit OFFSET :offset
    `;

    // Count query for pagination
    const countQuery = `
      SELECT COUNT(DISTINCT r.id) as total
      FROM reports r
      LEFT JOIN users u1 ON r.created_by = u1.id
      LEFT JOIN users u2 ON r.last_modified_by = u2.id
      ${whereClause}
    `;

    try {
      // Execute queries in parallel
      const [dataResult, countResult] = await Promise.all([
        executeReportQuery(query, { ...replacements, limit, offset }, options),
        executeReportQuery(countQuery, replacements, { ...options, useCache: true, cacheTtl: 60000 }),
      ]);

      const total = (countResult as { total: number }[])[0]?.total || 0;
      const pages = Math.ceil(total / limit);
      const currentPage = pagination?.page || 1;

      const result: PaginatedResult<ReportsTable> = {
        data: dataResult as ReportsTable[],
        pagination: {
          page: currentPage,
          limit,
          total,
          pages,
          hasNext: currentPage < pages,
          hasPrev: currentPage > 1,
        },
      };

      return {
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          recordCount: result.data.length,
          fromCache: false,
          queryComplexity: this.assessQueryComplexity(whereClause, true), // Has joins
        },
      };

    } catch (error) {
      logger.error('Failed to execute getReports query', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
        pagination,
      });
      throw error;
    }
  }

  /**
   * Get a single report by ID with execution summary
   */
  static async getReportById(
    reportId: string,
    options?: QueryExecutionOptions
  ): Promise<QueryResult<ReportsTable | null>> {
    const startTime = Date.now();

    const query = `
      SELECT
        r.*,
        u1.username as created_by_username,
        u2.username as last_modified_by_username,
        COUNT(re.id) as execution_count,
        MAX(re.start_time) as last_execution,
        AVG(re.duration_ms) as avg_execution_time,
        COUNT(CASE WHEN re.status = 'completed' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN re.status = 'failed' THEN 1 END) as failed_executions,
        COUNT(CASE WHEN re.status = 'running' THEN 1 END) as running_executions
      FROM reports r
      LEFT JOIN users u1 ON r.created_by = u1.id
      LEFT JOIN users u2 ON r.last_modified_by = u2.id
      LEFT JOIN report_executions re ON r.report_id = re.report_id
      WHERE r.report_id = :reportId
      GROUP BY r.id, u1.username, u2.username
    `;

    try {
      const result = await executeReportQuery(
        query,
        { reportId },
        { ...options, useCache: true, cacheTtl: 300000 } // 5 min cache
      );

      const data = (result as ReportsTable[])[0] || null;

      return {
        data,
        metadata: {
          executionTime: Date.now() - startTime,
          recordCount: data ? 1 : 0,
          fromCache: false,
          queryComplexity: 'moderate',
        },
      };

    } catch (error) {
      logger.error('Failed to execute getReportById query', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      throw error;
    }
  }

  // ===================== EXECUTION QUERIES =====================

  /**
   * Get report executions with filtering and pagination
   */
  static async getExecutions(
    filters?: ExecutionFilters,
    pagination?: PaginationOptions,
    options?: QueryExecutionOptions
  ): Promise<QueryResult<PaginatedResult<ReportExecutionsTable>>> {
    const startTime = Date.now();

    const { whereClause, replacements } = this.buildExecutionFilters(filters);
    const orderClause = this.buildOrderClause(
      pagination?.sort || 'start_time',
      pagination?.order || 'DESC'
    );

    const limit = Math.min(pagination?.limit || 50, 1000);
    const offset = ((pagination?.page || 1) - 1) * limit;

    const query = `
      SELECT
        re.*,
        r.name as report_name,
        r.report_type,
        r.category,
        u.username as started_by_username
      FROM report_executions re
      INNER JOIN reports r ON re.report_id = r.report_id
      LEFT JOIN users u ON re.started_by = u.id
      ${whereClause}
      ${orderClause}
      LIMIT :limit OFFSET :offset
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM report_executions re
      INNER JOIN reports r ON re.report_id = r.report_id
      ${whereClause}
    `;

    try {
      const [dataResult, countResult] = await Promise.all([
        executeReportQuery(query, { ...replacements, limit, offset }, options),
        executeReportQuery(countQuery, replacements, { ...options, useCache: true, cacheTtl: 60000 }),
      ]);

      const total = (countResult as { total: number }[])[0]?.total || 0;
      const pages = Math.ceil(total / limit);
      const currentPage = pagination?.page || 1;

      const result: PaginatedResult<ReportExecutionsTable> = {
        data: dataResult as ReportExecutionsTable[],
        pagination: {
          page: currentPage,
          limit,
          total,
          pages,
          hasNext: currentPage < pages,
          hasPrev: currentPage > 1,
        },
      };

      return {
        data: result,
        metadata: {
          executionTime: Date.now() - startTime,
          recordCount: result.data.length,
          fromCache: false,
          queryComplexity: this.assessQueryComplexity(whereClause, true),
        },
      };

    } catch (error) {
      logger.error('Failed to execute getExecutions query', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
        pagination,
      });
      throw error;
    }
  }

  /**
   * Get execution details by ID
   */
  static async getExecutionById(
    executionId: string,
    options?: QueryExecutionOptions
  ): Promise<QueryResult<ReportExecutionsTable | null>> {
    const startTime = Date.now();

    const query = `
      SELECT
        re.*,
        r.name as report_name,
        r.report_type,
        r.category,
        r.provider,
        u.username as started_by_username
      FROM report_executions re
      INNER JOIN reports r ON re.report_id = r.report_id
      LEFT JOIN users u ON re.started_by = u.id
      WHERE re.execution_id = :executionId
    `;

    try {
      const result = await executeReportQuery(
        query,
        { executionId },
        { ...options, useCache: true, cacheTtl: 180000 } // 3 min cache
      );

      const data = (result as ReportExecutionsTable[])[0] || null;

      return {
        data,
        metadata: {
          executionTime: Date.now() - startTime,
          recordCount: data ? 1 : 0,
          fromCache: false,
          queryComplexity: 'simple',
        },
      };

    } catch (error) {
      logger.error('Failed to execute getExecutionById query', {
        error: error instanceof Error ? error.message : 'Unknown error',
        executionId,
      });
      throw error;
    }
  }

  // ===================== ANALYTICS QUERIES =====================

  /**
   * Get execution statistics for dashboard
   */
  static async getExecutionStatistics(
    timeRange?: { start: Date; end: Date },
    options?: QueryExecutionOptions
  ): Promise<QueryResult<{
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    runningExecutions: number;
    averageExecutionTime: number;
    slowestExecution: number;
    fastestExecution: number;
    executionsByStatus: Array<{ status: ExecutionStatus; count: number }>;
    executionsByType: Array<{ report_type: ReportType; count: number }>;
    dailyExecutions: Array<{ date: string; count: number }>;
  }>> {
    const startTime = Date.now();

    let timeFilter = '';
    const replacements: Record<string, any> = {};

    if (timeRange) {
      timeFilter = 'WHERE re.start_time BETWEEN :startDate AND :endDate';
      replacements.startDate = timeRange.start;
      replacements.endDate = timeRange.end;
    }

    const query = `
      SELECT
        COUNT(*) as total_executions,
        COUNT(CASE WHEN re.status = 'completed' THEN 1 END) as successful_executions,
        COUNT(CASE WHEN re.status = 'failed' THEN 1 END) as failed_executions,
        COUNT(CASE WHEN re.status = 'running' THEN 1 END) as running_executions,
        AVG(re.duration_ms) as average_execution_time,
        MAX(re.duration_ms) as slowest_execution,
        MIN(CASE WHEN re.status = 'completed' THEN re.duration_ms END) as fastest_execution
      FROM report_executions re
      ${timeFilter}
    `;

    const statusQuery = `
      SELECT
        re.status,
        COUNT(*) as count
      FROM report_executions re
      ${timeFilter}
      GROUP BY re.status
      ORDER BY count DESC
    `;

    const typeQuery = `
      SELECT
        r.report_type,
        COUNT(*) as count
      FROM report_executions re
      INNER JOIN reports r ON re.report_id = r.report_id
      ${timeFilter}
      GROUP BY r.report_type
      ORDER BY count DESC
    `;

    const dailyQuery = `
      SELECT
        DATE(re.start_time) as date,
        COUNT(*) as count
      FROM report_executions re
      ${timeFilter}
      GROUP BY DATE(re.start_time)
      ORDER BY date DESC
      LIMIT 30
    `;

    try {
      const [statsResult, statusResult, typeResult, dailyResult] = await Promise.all([
        executeReportQuery(query, replacements, { ...options, useCache: true, cacheTtl: 120000 }),
        executeReportQuery(statusQuery, replacements, { ...options, useCache: true, cacheTtl: 60000 }),
        executeReportQuery(typeQuery, replacements, { ...options, useCache: true, cacheTtl: 300000 }),
        executeReportQuery(dailyQuery, replacements, { ...options, useCache: true, cacheTtl: 180000 }),
      ]);

      const stats = (statsResult as any[])[0] || {};
      const data = {
        totalExecutions: parseInt(stats.total_executions) || 0,
        successfulExecutions: parseInt(stats.successful_executions) || 0,
        failedExecutions: parseInt(stats.failed_executions) || 0,
        runningExecutions: parseInt(stats.running_executions) || 0,
        averageExecutionTime: parseFloat(stats.average_execution_time) || 0,
        slowestExecution: parseInt(stats.slowest_execution) || 0,
        fastestExecution: parseInt(stats.fastest_execution) || 0,
        executionsByStatus: statusResult as Array<{ status: ExecutionStatus; count: number }>,
        executionsByType: typeResult as Array<{ report_type: ReportType; count: number }>,
        dailyExecutions: dailyResult as Array<{ date: string; count: number }>,
      };

      return {
        data,
        metadata: {
          executionTime: Date.now() - startTime,
          recordCount: 1,
          fromCache: false,
          queryComplexity: 'complex',
          optimizationHints: [
            'Consider indexing on start_time for time-range queries',
            'Execution statistics queries benefit from materialized views',
          ],
        },
      };

    } catch (error) {
      logger.error('Failed to execute getExecutionStatistics query', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timeRange,
      });
      throw error;
    }
  }

  /**
   * Get performance metrics for reports
   */
  static async getPerformanceMetrics(
    reportId?: string,
    options?: QueryExecutionOptions
  ): Promise<QueryResult<{
    reportMetrics: Array<{
      reportId: string;
      reportName: string;
      totalExecutions: number;
      averageTime: number;
      successRate: number;
      lastExecution: Date;
    }>;
    systemMetrics: {
      avgConcurrentExecutions: number;
      peakConcurrentExecutions: number;
      systemLoad: number;
    };
  }>> {
    const startTime = Date.now();

    let reportFilter = '';
    const replacements: Record<string, any> = {};

    if (reportId) {
      reportFilter = 'AND r.report_id = :reportId';
      replacements.reportId = reportId;
    }

    const reportMetricsQuery = `
      SELECT
        r.report_id,
        r.name as report_name,
        COUNT(re.id) as total_executions,
        AVG(re.duration_ms) as average_time,
        (COUNT(CASE WHEN re.status = 'completed' THEN 1 END) * 100.0 / COUNT(*)) as success_rate,
        MAX(re.start_time) as last_execution
      FROM reports r
      LEFT JOIN report_executions re ON r.report_id = re.report_id
      WHERE r.is_active = true ${reportFilter}
      GROUP BY r.report_id, r.name
      HAVING COUNT(re.id) > 0
      ORDER BY total_executions DESC, average_time ASC
      LIMIT 50
    `;

    const systemMetricsQuery = `
      SELECT
        AVG(concurrent_count) as avg_concurrent_executions,
        MAX(concurrent_count) as peak_concurrent_executions
      FROM (
        SELECT
          DATE(start_time) as execution_date,
          HOUR(start_time) as execution_hour,
          COUNT(*) as concurrent_count
        FROM report_executions
        WHERE start_time >= DATE_SUB(NOW(), INTERVAL 7 DAY)
        AND status IN ('running', 'completed')
        GROUP BY DATE(start_time), HOUR(start_time)
      ) hourly_stats
    `;

    try {
      const [reportResult, systemResult] = await Promise.all([
        executeReportQuery(reportMetricsQuery, replacements, options),
        executeReportQuery(systemMetricsQuery, {}, { ...options, useCache: true, cacheTtl: 300000 }),
      ]);

      const systemStats = (systemResult as any[])[0] || {};
      const data = {
        reportMetrics: reportResult as Array<{
          reportId: string;
          reportName: string;
          totalExecutions: number;
          averageTime: number;
          successRate: number;
          lastExecution: Date;
        }>,
        systemMetrics: {
          avgConcurrentExecutions: parseFloat(systemStats.avg_concurrent_executions) || 0,
          peakConcurrentExecutions: parseInt(systemStats.peak_concurrent_executions) || 0,
          systemLoad: 0, // Would calculate based on current running executions
        },
      };

      return {
        data,
        metadata: {
          executionTime: Date.now() - startTime,
          recordCount: data.reportMetrics.length,
          fromCache: false,
          queryComplexity: 'complex',
          optimizationHints: [
            'Performance metrics queries should use materialized views',
            'Consider partitioning execution tables by date',
          ],
        },
      };

    } catch (error) {
      logger.error('Failed to execute getPerformanceMetrics query', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });
      throw error;
    }
  }

  // ===================== HELPER METHODS =====================

  /**
   * Build WHERE clause for report filtering
   */
  private static buildReportFilters(filters?: ReportFilters): {
    whereClause: string;
    replacements: Record<string, any>;
  } {
    if (!filters) {
      return { whereClause: '', replacements: {} };
    }

    const conditions: string[] = [];
    const replacements: Record<string, any> = {};

    if (filters.report_type) {
      if (Array.isArray(filters.report_type)) {
        conditions.push('r.report_type IN (:reportTypes)');
        replacements.reportTypes = filters.report_type;
      } else {
        conditions.push('r.report_type = :reportType');
        replacements.reportType = filters.report_type;
      }
    }

    if (filters.category) {
      if (Array.isArray(filters.category)) {
        conditions.push('r.category IN (:categories)');
        replacements.categories = filters.category;
      } else {
        conditions.push('r.category = :category');
        replacements.category = filters.category;
      }
    }

    if (filters.provider) {
      if (Array.isArray(filters.provider)) {
        conditions.push('r.provider IN (:providers)');
        replacements.providers = filters.provider;
      } else {
        conditions.push('r.provider = :provider');
        replacements.provider = filters.provider;
      }
    }

    if (filters.is_active !== undefined) {
      conditions.push('r.is_active = :isActive');
      replacements.isActive = filters.is_active;
    }

    if (filters.is_public !== undefined) {
      conditions.push('r.is_public = :isPublic');
      replacements.isPublic = filters.is_public;
    }

    if (filters.created_by) {
      conditions.push('r.created_by = :createdBy');
      replacements.createdBy = filters.created_by;
    }

    if (filters.search) {
      conditions.push('(r.name LIKE :search OR r.description LIKE :search)');
      replacements.search = `%${filters.search}%`;
    }

    if (filters.created_after) {
      conditions.push('r.created_at >= :createdAfter');
      replacements.createdAfter = filters.created_after;
    }

    if (filters.created_before) {
      conditions.push('r.created_at <= :createdBefore');
      replacements.createdBefore = filters.created_before;
    }

    if (filters.updated_after) {
      conditions.push('r.updated_at >= :updatedAfter');
      replacements.updatedAfter = filters.updated_after;
    }

    if (filters.updated_before) {
      conditions.push('r.updated_at <= :updatedBefore');
      replacements.updatedBefore = filters.updated_before;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return { whereClause, replacements };
  }

  /**
   * Build WHERE clause for execution filtering
   */
  private static buildExecutionFilters(filters?: ExecutionFilters): {
    whereClause: string;
    replacements: Record<string, any>;
  } {
    if (!filters) {
      return { whereClause: '', replacements: {} };
    }

    const conditions: string[] = [];
    const replacements: Record<string, any> = {};

    if (filters.report_id) {
      if (Array.isArray(filters.report_id)) {
        conditions.push('re.report_id IN (:reportIds)');
        replacements.reportIds = filters.report_id;
      } else {
        conditions.push('re.report_id = :reportId');
        replacements.reportId = filters.report_id;
      }
    }

    if (filters.status) {
      if (Array.isArray(filters.status)) {
        conditions.push('re.status IN (:statuses)');
        replacements.statuses = filters.status;
      } else {
        conditions.push('re.status = :status');
        replacements.status = filters.status;
      }
    }

    if (filters.trigger_type) {
      if (Array.isArray(filters.trigger_type)) {
        conditions.push('re.trigger_type IN (:triggerTypes)');
        replacements.triggerTypes = filters.trigger_type;
      } else {
        conditions.push('re.trigger_type = :triggerType');
        replacements.triggerType = filters.trigger_type;
      }
    }

    if (filters.started_by) {
      conditions.push('re.started_by = :startedBy');
      replacements.startedBy = filters.started_by;
    }

    if (filters.started_after) {
      conditions.push('re.start_time >= :startedAfter');
      replacements.startedAfter = filters.started_after;
    }

    if (filters.started_before) {
      conditions.push('re.start_time <= :startedBefore');
      replacements.startedBefore = filters.started_before;
    }

    if (filters.ended_after) {
      conditions.push('re.end_time >= :endedAfter');
      replacements.endedAfter = filters.ended_after;
    }

    if (filters.ended_before) {
      conditions.push('re.end_time <= :endedBefore');
      replacements.endedBefore = filters.ended_before;
    }

    if (filters.min_duration) {
      conditions.push('re.duration_ms >= :minDuration');
      replacements.minDuration = filters.min_duration;
    }

    if (filters.max_duration) {
      conditions.push('re.duration_ms <= :maxDuration');
      replacements.maxDuration = filters.max_duration;
    }

    if (filters.has_errors !== undefined) {
      if (filters.has_errors) {
        conditions.push('re.error_message IS NOT NULL');
      } else {
        conditions.push('re.error_message IS NULL');
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return { whereClause, replacements };
  }

  /**
   * Build ORDER BY clause
   */
  private static buildOrderClause(sort: string, order: 'ASC' | 'DESC'): string {
    const validSortFields = [
      'id', 'name', 'report_type', 'category', 'provider', 'created_at', 'updated_at',
      'execution_id', 'status', 'start_time', 'end_time', 'duration_ms', 'records_processed',
    ];

    const sanitizedSort = validSortFields.includes(sort) ? sort : 'updated_at';
    const sanitizedOrder = order === 'ASC' ? 'ASC' : 'DESC';

    return `ORDER BY ${sanitizedSort} ${sanitizedOrder}`;
  }

  /**
   * Assess query complexity for optimization hints
   */
  private static assessQueryComplexity(
    whereClause: string,
    hasJoins: boolean = false
  ): 'simple' | 'moderate' | 'complex' {
    let complexity = 0;

    if (hasJoins) complexity += 1;
    if (whereClause.includes('LIKE')) complexity += 1;
    if (whereClause.includes('IN')) complexity += 1;
    if (whereClause.includes('BETWEEN')) complexity += 1;
    if ((whereClause.match(/AND/g) || []).length > 2) complexity += 1;

    if (complexity <= 1) return 'simple';
    if (complexity <= 3) return 'moderate';
    return 'complex';
  }
}

// ===================== SPECIALIZED QUERY BUILDERS =====================

/**
 * VPC Inventory Report Queries
 */
export class VPCInventoryQueries {

  static async getVPCsByProvider(
    provider?: CloudProvider,
    options?: QueryExecutionOptions
  ): Promise<QueryResult<any[]>> {
    const startTime = Date.now();

    let providerFilter = '';
    const replacements: Record<string, any> = {};

    if (provider) {
      providerFilter = 'WHERE v.provider = :provider';
      replacements.provider = provider;
    }

    const query = `
      SELECT
        v.provider,
        v.vpc_id,
        v.name,
        v.cidr_block,
        v.region,
        v.availability_zone,
        v.state,
        COUNT(s.id) as subnet_count,
        COUNT(tga.id) as tgw_attachment_count,
        v.created_at
      FROM vpcs v
      LEFT JOIN subnets s ON v.vpc_id = s.vpc_id
      LEFT JOIN transit_gateway_attachments tga ON v.vpc_id = tga.vpc_id
      ${providerFilter}
      GROUP BY v.id, v.provider, v.vpc_id, v.name, v.cidr_block, v.region, v.availability_zone, v.state, v.created_at
      ORDER BY v.provider, v.region, v.name
    `;

    try {
      const result = await executeReportQuery(query, replacements, options);

      return {
        data: result as any[],
        metadata: {
          executionTime: Date.now() - startTime,
          recordCount: Array.isArray(result) ? result.length : 0,
          fromCache: false,
          queryComplexity: 'moderate',
          optimizationHints: [
            'Consider indexing on (provider, region) for better performance',
            'Subnet and TGW attachment counts could be pre-calculated in materialized view',
          ],
        },
      };

    } catch (error) {
      logger.error('Failed to execute VPC inventory query', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider,
      });
      throw error;
    }
  }

  static async getSubnetUtilization(
    vpcId?: string,
    options?: QueryExecutionOptions
  ): Promise<QueryResult<any[]>> {
    const startTime = Date.now();

    let vpcFilter = '';
    const replacements: Record<string, any> = {};

    if (vpcId) {
      vpcFilter = 'WHERE s.vpc_id = :vpcId';
      replacements.vpcId = vpcId;
    }

    const query = `
      SELECT
        s.subnet_id,
        s.name,
        s.cidr_block,
        s.availability_zone,
        s.state,
        v.name as vpc_name,
        v.provider,
        v.region,
        -- Calculate IP utilization (this would need actual instance/resource data)
        NULL as available_ips,
        NULL as used_ips,
        NULL as utilization_percentage,
        s.created_at
      FROM subnets s
      INNER JOIN vpcs v ON s.vpc_id = v.vpc_id
      ${vpcFilter}
      ORDER BY v.provider, v.region, v.name, s.name
    `;

    try {
      const result = await executeReportQuery(query, replacements, options);

      return {
        data: result as any[],
        metadata: {
          executionTime: Date.now() - startTime,
          recordCount: Array.isArray(result) ? result.length : 0,
          fromCache: false,
          queryComplexity: 'moderate',
          optimizationHints: [
            'IP utilization calculation requires additional resource tables',
            'Consider creating a materialized view for subnet utilization metrics',
          ],
        },
      };

    } catch (error) {
      logger.error('Failed to execute subnet utilization query', {
        error: error instanceof Error ? error.message : 'Unknown error',
        vpcId,
      });
      throw error;
    }
  }
}

/**
 * Performance Monitoring Queries
 */
export class PerformanceQueries {

  static async getSlowQueries(
    thresholdMs: number = 1000,
    limit: number = 50,
    options?: QueryExecutionOptions
  ): Promise<QueryResult<any[]>> {
    const startTime = Date.now();

    const query = `
      SELECT
        re.execution_id,
        r.name as report_name,
        r.report_type,
        re.duration_ms,
        re.records_processed,
        re.start_time,
        re.end_time,
        u.username as started_by_username,
        re.error_message
      FROM report_executions re
      INNER JOIN reports r ON re.report_id = r.report_id
      LEFT JOIN users u ON re.started_by = u.id
      WHERE re.duration_ms >= :thresholdMs
      AND re.status IN ('completed', 'failed')
      ORDER BY re.duration_ms DESC
      LIMIT :limit
    `;

    try {
      const result = await executeReportQuery(
        query,
        { thresholdMs, limit },
        { ...options, useCache: true, cacheTtl: 300000 }
      );

      return {
        data: result as any[],
        metadata: {
          executionTime: Date.now() - startTime,
          recordCount: Array.isArray(result) ? result.length : 0,
          fromCache: false,
          queryComplexity: 'simple',
          optimizationHints: [
            'Index on duration_ms would improve slow query detection',
            'Consider alerting on queries exceeding critical thresholds',
          ],
        },
      };

    } catch (error) {
      logger.error('Failed to execute slow queries analysis', {
        error: error instanceof Error ? error.message : 'Unknown error',
        thresholdMs,
        limit,
      });
      throw error;
    }
  }
}

// Export main classes
export default ReportQueries;