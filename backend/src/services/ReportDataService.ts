/**
 * Report Data Service
 *
 * Comprehensive service for report data management, query execution, and aggregation.
 * Integrates with the reporting connection pool and caching layer for optimized performance.
 * Provides data access patterns for report generation with intelligent caching and
 * query optimization.
 */

import { BaseService, ServiceResponse, PaginatedResponse, QueryOptions } from './BaseService';
import { reportingPool, ReportingPoolMetrics, MaterializedViewInfo } from '../database/connections/ReportingConnectionPool';
import { reportCache, CacheStats } from '../database/cache/ReportCache';
import { ReportQueries, VPCInventoryQueries, PerformanceQueries, QueryResult, QueryExecutionOptions } from '../database/queries/ReportQueries';
import {
  ReportsTable,
  ReportExecutionsTable,
  ReportType,
  ReportCategory,
  CloudProvider,
  ExecutionStatus,
  TriggerType,
  ReportFilters,
  ExecutionFilters,
  PaginationOptions,
  PaginatedResult,
  QueryConfiguration,
  ExecutionParameters,
  ResultSummary,
  ErrorDetails,
  ExecutionMetadata,
  CreateReportInput,
  UpdateReportInput,
  CreateExecutionInput,
  UpdateExecutionInput,
} from '../database/schema/reports';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

// Logger specifically for report data service
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.label({ label: 'ReportDataService' }),
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

// Service-specific types
export interface ReportDataOptions {
  useCache?: boolean;
  cacheTtl?: number;
  timeout?: number;
  maxRows?: number;
  explain?: boolean;
  refreshViews?: boolean;
}

export interface DataAggregationOptions {
  groupBy?: string[];
  aggregations?: Array<{
    field: string;
    function: 'SUM' | 'AVG' | 'COUNT' | 'MIN' | 'MAX' | 'DISTINCT';
    alias?: string;
  }>;
  filters?: Record<string, any>;
  timeRange?: {
    start: Date;
    end: Date;
    granularity?: 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';
  };
}

export interface ReportExecutionContext {
  userId?: number;
  userRole?: string;
  source?: string;
  correlationId?: string;
  priority?: 'low' | 'normal' | 'high' | 'critical';
}

export interface ServiceMetrics {
  reporting: ReportingPoolMetrics;
  cache: CacheStats;
  service: {
    totalQueries: number;
    averageResponseTime: number;
    cacheHitRatio: number;
    errorRate: number;
    activeExecutions: number;
    lastHealthCheck: Date | null;
  };
}

/**
 * Comprehensive Report Data Service
 *
 * Provides optimized data access patterns for report generation with
 * built-in caching, performance monitoring, and materialized view management.
 */
export class ReportDataService extends BaseService<ReportsTable, any> {
  private isInitialized = false;
  private serviceMetrics = {
    totalQueries: 0,
    averageResponseTime: 0,
    cacheHitRatio: 0,
    errorRate: 0,
    activeExecutions: 0,
    lastHealthCheck: null as Date | null,
  };
  private responseTimeHistory: number[] = [];

  constructor() {
    // ReportDataService doesn't use a traditional repository pattern
    // It directly interfaces with the database through the reporting pool
    super(null as any);
  }

  /**
   * Initialize the report data service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Report data service already initialized');
      return;
    }

    try {
      logger.info('Initializing report data service...');

      // Initialize the reporting connection pool
      await reportingPool.initialize();

      // Initialize the report cache
      await reportCache.initialize();

      // Start health monitoring
      this.startHealthMonitoring();

      this.isInitialized = true;
      logger.info('Report data service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize report data service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  // ===================== REPORT MANAGEMENT =====================

  /**
   * Get reports with filtering and pagination
   */
  public async getReports(
    filters?: ReportFilters,
    pagination?: PaginationOptions,
    options?: ReportDataOptions
  ): Promise<ServiceResponse<PaginatedResult<ReportsTable>>> {
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      logger.debug('Fetching reports', { filters, pagination });

      const queryOptions: QueryExecutionOptions = {
        useCache: options?.useCache,
        cacheTtl: options?.cacheTtl,
        timeout: options?.timeout,
        maxRows: options?.maxRows,
      };

      const result = await ReportQueries.getReports(filters, pagination, queryOptions);

      this.updateServiceMetrics(Date.now() - startTime, true);

      return this.createSuccessResponse(result.data, 'Reports fetched successfully');

    } catch (error) {
      this.updateServiceMetrics(Date.now() - startTime, false);

      logger.error('Failed to fetch reports', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
        pagination,
      });

      return this.createSingleErrorResponse(
        'QUERY_ERROR',
        'Failed to fetch reports',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Get a single report by ID
   */
  public async getReportById(
    reportId: string,
    options?: ReportDataOptions
  ): Promise<ServiceResponse<ReportsTable>> {
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      logger.debug('Fetching report by ID', { reportId });

      const queryOptions: QueryExecutionOptions = {
        useCache: options?.useCache !== false,
        cacheTtl: options?.cacheTtl || 300000, // 5 minutes default
        timeout: options?.timeout,
      };

      const result = await ReportQueries.getReportById(reportId, queryOptions);

      if (!result.data) {
        return this.createSingleErrorResponse(
          'NOT_FOUND',
          `Report with ID ${reportId} not found`
        );
      }

      this.updateServiceMetrics(Date.now() - startTime, true);

      return this.createSuccessResponse(result.data, 'Report fetched successfully');

    } catch (error) {
      this.updateServiceMetrics(Date.now() - startTime, false);

      logger.error('Failed to fetch report by ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });

      return this.createSingleErrorResponse(
        'QUERY_ERROR',
        'Failed to fetch report',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== EXECUTION MANAGEMENT =====================

  /**
   * Get report executions with filtering and pagination
   */
  public async getExecutions(
    filters?: ExecutionFilters,
    pagination?: PaginationOptions,
    options?: ReportDataOptions
  ): Promise<ServiceResponse<PaginatedResult<ReportExecutionsTable>>> {
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      logger.debug('Fetching executions', { filters, pagination });

      const queryOptions: QueryExecutionOptions = {
        useCache: options?.useCache,
        cacheTtl: options?.cacheTtl,
        timeout: options?.timeout,
        maxRows: options?.maxRows,
      };

      const result = await ReportQueries.getExecutions(filters, pagination, queryOptions);

      this.updateServiceMetrics(Date.now() - startTime, true);

      return this.createSuccessResponse(result.data, 'Executions fetched successfully');

    } catch (error) {
      this.updateServiceMetrics(Date.now() - startTime, false);

      logger.error('Failed to fetch executions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        filters,
        pagination,
      });

      return this.createSingleErrorResponse(
        'QUERY_ERROR',
        'Failed to fetch executions',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Get execution by ID
   */
  public async getExecutionById(
    executionId: string,
    options?: ReportDataOptions
  ): Promise<ServiceResponse<ReportExecutionsTable>> {
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      logger.debug('Fetching execution by ID', { executionId });

      const queryOptions: QueryExecutionOptions = {
        useCache: options?.useCache !== false,
        cacheTtl: options?.cacheTtl || 180000, // 3 minutes default
        timeout: options?.timeout,
      };

      const result = await ReportQueries.getExecutionById(executionId, queryOptions);

      if (!result.data) {
        return this.createSingleErrorResponse(
          'NOT_FOUND',
          `Execution with ID ${executionId} not found`
        );
      }

      this.updateServiceMetrics(Date.now() - startTime, true);

      return this.createSuccessResponse(result.data, 'Execution fetched successfully');

    } catch (error) {
      this.updateServiceMetrics(Date.now() - startTime, false);

      logger.error('Failed to fetch execution by ID', {
        error: error instanceof Error ? error.message : 'Unknown error',
        executionId,
      });

      return this.createSingleErrorResponse(
        'QUERY_ERROR',
        'Failed to fetch execution',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== ANALYTICS AND AGGREGATION =====================

  /**
   * Get execution statistics for dashboard
   */
  public async getExecutionStatistics(
    timeRange?: { start: Date; end: Date },
    options?: ReportDataOptions
  ): Promise<ServiceResponse<any>> {
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      logger.debug('Fetching execution statistics', { timeRange });

      const queryOptions: QueryExecutionOptions = {
        useCache: options?.useCache !== false,
        cacheTtl: options?.cacheTtl || 120000, // 2 minutes default
        timeout: options?.timeout,
      };

      const result = await ReportQueries.getExecutionStatistics(timeRange, queryOptions);

      this.updateServiceMetrics(Date.now() - startTime, true);

      return this.createSuccessResponse(result.data, 'Execution statistics fetched successfully');

    } catch (error) {
      this.updateServiceMetrics(Date.now() - startTime, false);

      logger.error('Failed to fetch execution statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timeRange,
      });

      return this.createSingleErrorResponse(
        'QUERY_ERROR',
        'Failed to fetch execution statistics',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Get performance metrics for reports
   */
  public async getPerformanceMetrics(
    reportId?: string,
    options?: ReportDataOptions
  ): Promise<ServiceResponse<any>> {
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      logger.debug('Fetching performance metrics', { reportId });

      const queryOptions: QueryExecutionOptions = {
        useCache: options?.useCache !== false,
        cacheTtl: options?.cacheTtl || 300000, // 5 minutes default
        timeout: options?.timeout,
      };

      const result = await ReportQueries.getPerformanceMetrics(reportId, queryOptions);

      this.updateServiceMetrics(Date.now() - startTime, true);

      return this.createSuccessResponse(result.data, 'Performance metrics fetched successfully');

    } catch (error) {
      this.updateServiceMetrics(Date.now() - startTime, false);

      logger.error('Failed to fetch performance metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId,
      });

      return this.createSingleErrorResponse(
        'QUERY_ERROR',
        'Failed to fetch performance metrics',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== VPC INVENTORY QUERIES =====================

  /**
   * Get VPC inventory by provider
   */
  public async getVPCsByProvider(
    provider?: CloudProvider,
    options?: ReportDataOptions
  ): Promise<ServiceResponse<any[]>> {
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      logger.debug('Fetching VPCs by provider', { provider });

      const queryOptions: QueryExecutionOptions = {
        useCache: options?.useCache !== false,
        cacheTtl: options?.cacheTtl || 600000, // 10 minutes default for inventory
        timeout: options?.timeout,
        maxRows: options?.maxRows,
      };

      const result = await VPCInventoryQueries.getVPCsByProvider(provider, queryOptions);

      this.updateServiceMetrics(Date.now() - startTime, true);

      return this.createSuccessResponse(result.data, 'VPCs fetched successfully');

    } catch (error) {
      this.updateServiceMetrics(Date.now() - startTime, false);

      logger.error('Failed to fetch VPCs by provider', {
        error: error instanceof Error ? error.message : 'Unknown error',
        provider,
      });

      return this.createSingleErrorResponse(
        'QUERY_ERROR',
        'Failed to fetch VPCs',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Get subnet utilization data
   */
  public async getSubnetUtilization(
    vpcId?: string,
    options?: ReportDataOptions
  ): Promise<ServiceResponse<any[]>> {
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      logger.debug('Fetching subnet utilization', { vpcId });

      const queryOptions: QueryExecutionOptions = {
        useCache: options?.useCache !== false,
        cacheTtl: options?.cacheTtl || 300000, // 5 minutes default
        timeout: options?.timeout,
        maxRows: options?.maxRows,
      };

      const result = await VPCInventoryQueries.getSubnetUtilization(vpcId, queryOptions);

      this.updateServiceMetrics(Date.now() - startTime, true);

      return this.createSuccessResponse(result.data, 'Subnet utilization fetched successfully');

    } catch (error) {
      this.updateServiceMetrics(Date.now() - startTime, false);

      logger.error('Failed to fetch subnet utilization', {
        error: error instanceof Error ? error.message : 'Unknown error',
        vpcId,
      });

      return this.createSingleErrorResponse(
        'QUERY_ERROR',
        'Failed to fetch subnet utilization',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== PERFORMANCE MONITORING =====================

  /**
   * Get slow queries analysis
   */
  public async getSlowQueries(
    thresholdMs: number = 1000,
    limit: number = 50,
    options?: ReportDataOptions
  ): Promise<ServiceResponse<any[]>> {
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      logger.debug('Fetching slow queries', { thresholdMs, limit });

      const queryOptions: QueryExecutionOptions = {
        useCache: options?.useCache !== false,
        cacheTtl: options?.cacheTtl || 300000, // 5 minutes default
        timeout: options?.timeout,
      };

      const result = await PerformanceQueries.getSlowQueries(thresholdMs, limit, queryOptions);

      this.updateServiceMetrics(Date.now() - startTime, true);

      return this.createSuccessResponse(result.data, 'Slow queries fetched successfully');

    } catch (error) {
      this.updateServiceMetrics(Date.now() - startTime, false);

      logger.error('Failed to fetch slow queries', {
        error: error instanceof Error ? error.message : 'Unknown error',
        thresholdMs,
        limit,
      });

      return this.createSingleErrorResponse(
        'QUERY_ERROR',
        'Failed to fetch slow queries',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== CUSTOM QUERY EXECUTION =====================

  /**
   * Execute custom SQL query with caching and optimization
   */
  public async executeCustomQuery(
    query: string,
    replacements?: Record<string, any>,
    options?: ReportDataOptions
  ): Promise<ServiceResponse<any>> {
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      logger.debug('Executing custom query', {
        query: query.substring(0, 100),
        hasReplacements: !!replacements,
      });

      // Validate query (basic security check)
      if (!this.isQuerySafe(query)) {
        return this.createSingleErrorResponse(
          'INVALID_QUERY',
          'Query contains potentially dangerous operations'
        );
      }

      const queryOptions: QueryExecutionOptions = {
        useCache: options?.useCache,
        cacheTtl: options?.cacheTtl,
        timeout: options?.timeout,
        maxRows: options?.maxRows,
      };

      const result = await reportingPool.executeReportQuery(query, replacements, queryOptions);

      this.updateServiceMetrics(Date.now() - startTime, true);

      return this.createSuccessResponse(result, 'Custom query executed successfully');

    } catch (error) {
      this.updateServiceMetrics(Date.now() - startTime, false);

      logger.error('Failed to execute custom query', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: query.substring(0, 100),
      });

      return this.createSingleErrorResponse(
        'QUERY_ERROR',
        'Failed to execute custom query',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== DATA AGGREGATION =====================

  /**
   * Aggregate data with flexible grouping and functions
   */
  public async aggregateData(
    tableName: string,
    aggregationOptions: DataAggregationOptions,
    options?: ReportDataOptions
  ): Promise<ServiceResponse<any[]>> {
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      logger.debug('Aggregating data', { tableName, aggregationOptions });

      const query = this.buildAggregationQuery(tableName, aggregationOptions);
      const cacheKey = this.generateCacheKey('aggregation', tableName, aggregationOptions);

      // Check cache first
      if (options?.useCache !== false) {
        const cached = await reportCache.get(cacheKey);
        if (cached) {
          this.updateServiceMetrics(Date.now() - startTime, true);
          return this.createSuccessResponse(cached, 'Aggregated data fetched from cache');
        }
      }

      const result = await reportingPool.executeReportQuery(query.sql, query.replacements, {
        useCache: false, // We're handling cache manually
        timeout: options?.timeout,
        maxRows: options?.maxRows,
      });

      // Cache the result
      if (options?.useCache !== false) {
        await reportCache.set(cacheKey, result, {
          ttl: options?.cacheTtl || 300, // 5 minutes default
        });
      }

      this.updateServiceMetrics(Date.now() - startTime, true);

      return this.createSuccessResponse(result, 'Data aggregated successfully');

    } catch (error) {
      this.updateServiceMetrics(Date.now() - startTime, false);

      logger.error('Failed to aggregate data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        tableName,
        aggregationOptions,
      });

      return this.createSingleErrorResponse(
        'AGGREGATION_ERROR',
        'Failed to aggregate data',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== MATERIALIZED VIEW MANAGEMENT =====================

  /**
   * Refresh materialized views
   */
  public async refreshMaterializedViews(
    viewNames?: string[],
    options?: { force?: boolean; timeout?: number }
  ): Promise<ServiceResponse<MaterializedViewInfo[]>> {
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      logger.info('Refreshing materialized views', { viewNames, options });

      const refreshedViews: MaterializedViewInfo[] = [];

      if (viewNames && viewNames.length > 0) {
        // Refresh specific views
        for (const viewName of viewNames) {
          const viewInfo = await reportingPool.refreshMaterializedView(viewName, options);
          refreshedViews.push(viewInfo);
        }
      } else {
        // Refresh all discovered views
        const allViews = reportingPool.getMaterializedViews();
        for (const view of allViews) {
          if (view.isStale || options?.force) {
            const viewInfo = await reportingPool.refreshMaterializedView(view.viewName, options);
            refreshedViews.push(viewInfo);
          }
        }
      }

      // Invalidate related cache entries
      if (refreshedViews.length > 0) {
        await reportCache.triggerInvalidation('data_change', {
          views: refreshedViews.map(v => v.viewName),
        });
      }

      this.updateServiceMetrics(Date.now() - startTime, true);

      return this.createSuccessResponse(
        refreshedViews,
        `Successfully refreshed ${refreshedViews.length} materialized views`
      );

    } catch (error) {
      this.updateServiceMetrics(Date.now() - startTime, false);

      logger.error('Failed to refresh materialized views', {
        error: error instanceof Error ? error.message : 'Unknown error',
        viewNames,
      });

      return this.createSingleErrorResponse(
        'VIEW_REFRESH_ERROR',
        'Failed to refresh materialized views',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== CACHE MANAGEMENT =====================

  /**
   * Clear cache by pattern
   */
  public async clearCache(
    pattern?: string,
    reason?: string
  ): Promise<ServiceResponse<{ cleared: number }>> {
    await this.ensureInitialized();

    try {
      logger.info('Clearing cache', { pattern, reason });

      const cleared = await reportCache.invalidate(pattern || '*', { reason });

      return this.createSuccessResponse(
        { cleared },
        `Successfully cleared ${cleared} cache entries`
      );

    } catch (error) {
      logger.error('Failed to clear cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pattern,
      });

      return this.createSingleErrorResponse(
        'CACHE_ERROR',
        'Failed to clear cache',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== SERVICE METRICS =====================

  /**
   * Get comprehensive service metrics
   */
  public async getServiceMetrics(): Promise<ServiceResponse<ServiceMetrics>> {
    await this.ensureInitialized();

    try {
      const reportingMetrics = reportingPool.getMetrics();
      const cacheMetrics = reportCache.getStats();

      const metrics: ServiceMetrics = {
        reporting: reportingMetrics,
        cache: cacheMetrics,
        service: { ...this.serviceMetrics },
      };

      return this.createSuccessResponse(metrics, 'Service metrics fetched successfully');

    } catch (error) {
      logger.error('Failed to fetch service metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return this.createSingleErrorResponse(
        'METRICS_ERROR',
        'Failed to fetch service metrics',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== HEALTH CHECK =====================

  /**
   * Check service health
   */
  public async checkHealth(): Promise<ServiceResponse<{
    healthy: boolean;
    components: {
      reportingPool: boolean;
      cache: boolean;
      service: boolean;
    };
    details: any;
  }>> {
    try {
      const poolHealth = await reportingPool.checkHealth();
      const cacheStats = reportCache.getStats();

      const components = {
        reportingPool: poolHealth.healthy,
        cache: cacheStats.redisCache.connectionStatus === 'ready' ||
               cacheStats.redisCache.connectionStatus === 'connected',
        service: this.isInitialized,
      };

      const healthy = Object.values(components).every(status => status);

      this.serviceMetrics.lastHealthCheck = new Date();

      return this.createSuccessResponse({
        healthy,
        components,
        details: {
          reportingPool: poolHealth,
          cache: cacheStats,
          service: this.serviceMetrics,
        },
      }, healthy ? 'Service is healthy' : 'Service has health issues');

    } catch (error) {
      logger.error('Health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return this.createSingleErrorResponse(
        'HEALTH_CHECK_ERROR',
        'Health check failed',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== UTILITY METHODS =====================

  /**
   * Close service and cleanup resources
   */
  public async close(): Promise<void> {
    logger.info('Closing report data service...');

    this.stopHealthMonitoring();

    if (this.isInitialized) {
      await reportingPool.close();
      await reportCache.close();
      this.isInitialized = false;
    }

    logger.info('Report data service closed');
  }

  // ===================== PRIVATE METHODS =====================

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private isQuerySafe(query: string): boolean {
    const dangerousPatterns = [
      /\b(DROP|DELETE|TRUNCATE|ALTER|CREATE|INSERT|UPDATE)\b/i,
      /\b(EXEC|EXECUTE|xp_)\b/i,
      /--;/,
      /\/\*.*\*\//,
    ];

    return !dangerousPatterns.some(pattern => pattern.test(query));
  }

  private buildAggregationQuery(
    tableName: string,
    options: DataAggregationOptions
  ): { sql: string; replacements: Record<string, any> } {
    const { groupBy = [], aggregations = [], filters = {}, timeRange } = options;

    let selectFields: string[] = [...groupBy];
    const replacements: Record<string, any> = {};

    // Build aggregation fields
    aggregations.forEach((agg, index) => {
      const alias = agg.alias || `${agg.function.toLowerCase()}_${agg.field}`;
      selectFields.push(`${agg.function}(${agg.field}) as ${alias}`);
    });

    // Handle time granularity
    if (timeRange?.granularity && groupBy.includes('created_at')) {
      const granularityMap = {
        hour: 'DATE_TRUNC(\'hour\', created_at)',
        day: 'DATE_TRUNC(\'day\', created_at)',
        week: 'DATE_TRUNC(\'week\', created_at)',
        month: 'DATE_TRUNC(\'month\', created_at)',
        quarter: 'DATE_TRUNC(\'quarter\', created_at)',
        year: 'DATE_TRUNC(\'year\', created_at)',
      };

      selectFields = selectFields.map(field =>
        field === 'created_at' ? `${granularityMap[timeRange.granularity!]} as created_at` : field
      );
    }

    let sql = `SELECT ${selectFields.join(', ')} FROM ${tableName}`;

    // Build WHERE clause
    const whereConditions: string[] = [];
    Object.entries(filters).forEach(([key, value]) => {
      whereConditions.push(`${key} = :${key}`);
      replacements[key] = value;
    });

    if (timeRange) {
      whereConditions.push('created_at BETWEEN :startDate AND :endDate');
      replacements.startDate = timeRange.start;
      replacements.endDate = timeRange.end;
    }

    if (whereConditions.length > 0) {
      sql += ` WHERE ${whereConditions.join(' AND ')}`;
    }

    // Add GROUP BY
    if (groupBy.length > 0) {
      sql += ` GROUP BY ${groupBy.join(', ')}`;
    }

    // Add ORDER BY
    if (groupBy.length > 0) {
      sql += ` ORDER BY ${groupBy[0]}`;
    }

    return { sql, replacements };
  }

  private generateCacheKey(type: string, ...args: any[]): string {
    const keyData = [type, ...args].map(arg =>
      typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
    ).join(':');

    return crypto.createHash('md5').update(keyData).digest('hex');
  }

  private updateServiceMetrics(responseTime: number, success: boolean): void {
    this.serviceMetrics.totalQueries++;

    // Update response time (exponential moving average)
    if (this.serviceMetrics.averageResponseTime === 0) {
      this.serviceMetrics.averageResponseTime = responseTime;
    } else {
      this.serviceMetrics.averageResponseTime =
        this.serviceMetrics.averageResponseTime * 0.9 + responseTime * 0.1;
    }

    // Track response time history
    this.responseTimeHistory.push(responseTime);
    if (this.responseTimeHistory.length > 1000) {
      this.responseTimeHistory = this.responseTimeHistory.slice(-500);
    }

    // Update error rate
    if (!success) {
      this.serviceMetrics.errorRate =
        this.serviceMetrics.errorRate * 0.95 + 0.05;
    } else {
      this.serviceMetrics.errorRate =
        this.serviceMetrics.errorRate * 0.95;
    }
  }

  private healthCheckInterval: NodeJS.Timeout | null = null;

  private startHealthMonitoring(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkHealth();
      } catch (error) {
        logger.error('Automated health check failed', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, 60000); // Check every minute
  }

  private stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // ===================== ABSTRACT METHOD IMPLEMENTATIONS =====================
  // These are required by BaseService but not used in ReportDataService

  async create(data: any): Promise<ServiceResponse<ReportsTable>> {
    throw new Error('Direct CRUD operations not supported. Use report management APIs.');
  }

  async findById(id: string | number): Promise<ServiceResponse<ReportsTable>> {
    return this.getReportById(String(id));
  }

  async update(id: string | number, data: any): Promise<ServiceResponse<ReportsTable>> {
    throw new Error('Direct CRUD operations not supported. Use report management APIs.');
  }

  async delete(id: string | number): Promise<ServiceResponse<boolean>> {
    throw new Error('Direct CRUD operations not supported. Use report management APIs.');
  }

  async findAll(options?: QueryOptions): Promise<ServiceResponse<PaginatedResponse<ReportsTable>>> {
    const result = await this.getReports(undefined, {
      page: options?.page,
      limit: options?.limit,
    });

    if (result.success && result.data) {
      return this.createSuccessResponse({
        data: result.data.data,
        totalCount: result.data.pagination.total,
        page: result.data.pagination.page,
        limit: result.data.pagination.limit,
        hasNextPage: result.data.pagination.hasNext,
        hasPrevPage: result.data.pagination.hasPrev,
      });
    }

    return result as any;
  }
}

// Export singleton instance
export const reportDataService = new ReportDataService();

// Convenience functions
export const initializeReportDataService = async (): Promise<void> => {
  return reportDataService.initialize();
};

export const getReportDataService = (): ReportDataService => {
  return reportDataService;
};

export const closeReportDataService = async (): Promise<void> => {
  return reportDataService.close();
};