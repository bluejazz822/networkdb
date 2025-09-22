/**
 * Specialized Connection Pool for Reporting Workloads
 *
 * Optimized for read-heavy reporting operations with performance monitoring,
 * connection pooling tuned for long-running queries, and materialized view
 * management capabilities.
 */

import { Sequelize, Pool, QueryTypes, Transaction } from 'sequelize';
import { EventEmitter } from 'events';
import { dbConnection } from '../../utils/db-connection';
import { getPoolConfig, performanceConfig } from '../../config/pool-config';
import winston from 'winston';

// Logger specifically for reporting operations
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.label({ label: 'ReportingPool' }),
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

export interface ReportingPoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  averageQueryTime: number;
  slowQueries: number;
  connectionUtilization: number;
  lastHealthCheck: Date | null;
  poolEfficiency: number;
}

export interface QueryExecutionMetrics {
  queryId: string;
  query: string;
  executionTime: number;
  recordsReturned: number;
  connectionId: string;
  timestamp: Date;
  fromCache: boolean;
  error?: string;
}

export interface MaterializedViewInfo {
  viewName: string;
  lastRefreshed: Date;
  refreshDuration: number;
  recordCount: number;
  isStale: boolean;
  nextScheduledRefresh?: Date;
}

/**
 * Specialized connection pool optimized for reporting workloads
 */
export class ReportingConnectionPool extends EventEmitter {
  private static instance: ReportingConnectionPool;
  private readOnlySequelize: Sequelize | null = null;
  private writeSequelize: Sequelize | null = null;
  private isInitialized = false;
  private poolMetrics: ReportingPoolMetrics;
  private queryCache = new Map<string, { result: any; timestamp: Date; ttl: number }>();
  private queryExecutionHistory: QueryExecutionMetrics[] = [];
  private materializedViews: Map<string, MaterializedViewInfo> = new Map();
  private healthCheckInterval: NodeJS.Timer | null = null;
  private metricsCollectionInterval: NodeJS.Timer | null = null;

  private constructor() {
    super();
    this.poolMetrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      pendingRequests: 0,
      averageQueryTime: 0,
      slowQueries: 0,
      connectionUtilization: 0,
      lastHealthCheck: null,
      poolEfficiency: 0,
    };
  }

  public static getInstance(): ReportingConnectionPool {
    if (!ReportingConnectionPool.instance) {
      ReportingConnectionPool.instance = new ReportingConnectionPool();
    }
    return ReportingConnectionPool.instance;
  }

  /**
   * Initialize the reporting connection pool with read/write separation
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Reporting connection pool already initialized');
      return;
    }

    try {
      logger.info('Initializing reporting connection pool...');

      // Initialize read-only connection pool (optimized for reports)
      await this.initializeReadOnlyPool();

      // Initialize write connection pool (for materialized view refresh)
      await this.initializeWritePool();

      // Start monitoring and health checks
      this.startHealthChecking();
      this.startMetricsCollection();

      // Initialize materialized views
      await this.discoverMaterializedViews();

      this.isInitialized = true;
      this.emit('poolInitialized');

      logger.info('Reporting connection pool initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize reporting connection pool', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  /**
   * Execute a read-only query optimized for reporting
   */
  public async executeReportQuery(
    query: string,
    replacements?: Record<string, any>,
    options?: {
      useCache?: boolean;
      cacheTtl?: number;
      timeout?: number;
      maxRows?: number;
    }
  ): Promise<any> {
    await this.ensureInitialized();

    const queryId = this.generateQueryId(query, replacements);
    const startTime = Date.now();

    // Check cache first if enabled
    if (options?.useCache !== false) {
      const cached = this.getCachedResult(queryId);
      if (cached) {
        this.recordQueryExecution({
          queryId,
          query: query.substring(0, 200),
          executionTime: 0,
          recordsReturned: Array.isArray(cached) ? cached.length : 1,
          connectionId: 'cache',
          timestamp: new Date(),
          fromCache: true,
        });
        return cached;
      }
    }

    const queryOptions = {
      replacements,
      type: QueryTypes.SELECT,
      timeout: options?.timeout || performanceConfig.slowQueryThreshold * 2,
      logging: this.createQueryLogger(queryId),
    };

    try {
      logger.debug('Executing report query', {
        queryId,
        query: query.substring(0, 200),
        hasReplacements: !!replacements,
      });

      const result = await this.readOnlySequelize!.query(query, queryOptions);
      const executionTime = Date.now() - startTime;

      // Apply row limit if specified
      const finalResult = options?.maxRows ?
        (Array.isArray(result) ? result.slice(0, options.maxRows) : result) :
        result;

      // Cache result if enabled
      if (options?.useCache !== false) {
        this.cacheResult(queryId, finalResult, options?.cacheTtl || 300000); // 5 min default
      }

      // Record metrics
      this.recordQueryExecution({
        queryId,
        query: query.substring(0, 200),
        executionTime,
        recordsReturned: Array.isArray(finalResult) ? finalResult.length : 1,
        connectionId: this.getConnectionId(),
        timestamp: new Date(),
        fromCache: false,
      });

      // Emit slow query warning
      if (executionTime > performanceConfig.slowQueryThreshold) {
        this.emit('slowQuery', {
          queryId,
          query: query.substring(0, 200),
          executionTime,
          threshold: performanceConfig.slowQueryThreshold,
        });
      }

      logger.debug(`Report query executed successfully in ${executionTime}ms`, {
        queryId,
        executionTime,
        recordsReturned: Array.isArray(finalResult) ? finalResult.length : 1,
      });

      return finalResult;

    } catch (error) {
      const executionTime = Date.now() - startTime;

      this.recordQueryExecution({
        queryId,
        query: query.substring(0, 200),
        executionTime,
        recordsReturned: 0,
        connectionId: this.getConnectionId(),
        timestamp: new Date(),
        fromCache: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      logger.error('Report query execution failed', {
        queryId,
        query: query.substring(0, 200),
        executionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      this.emit('queryError', {
        queryId,
        query: query.substring(0, 200),
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      });

      throw error;
    }
  }

  /**
   * Refresh a materialized view
   */
  public async refreshMaterializedView(
    viewName: string,
    options?: {
      force?: boolean;
      timeout?: number;
    }
  ): Promise<MaterializedViewInfo> {
    await this.ensureInitialized();

    const startTime = Date.now();

    try {
      logger.info(`Refreshing materialized view: ${viewName}`, {
        viewName,
        force: options?.force,
      });

      // Check if view exists and is stale
      const viewInfo = this.materializedViews.get(viewName);
      if (!options?.force && viewInfo && !viewInfo.isStale) {
        logger.debug(`Materialized view ${viewName} is not stale, skipping refresh`);
        return viewInfo;
      }

      // Execute refresh operation
      const refreshQuery = `REFRESH MATERIALIZED VIEW ${viewName}`;
      await this.writeSequelize!.query(refreshQuery, {
        timeout: options?.timeout || 600000, // 10 minutes default for MV refresh
        logging: (sql: string, timing?: number) => {
          logger.debug('Materialized view refresh query', {
            viewName,
            sql,
            timing,
          });
        },
      });

      // Get updated view information
      const recordCountResult = await this.readOnlySequelize!.query(
        `SELECT COUNT(*) as count FROM ${viewName}`,
        { type: QueryTypes.SELECT }
      ) as { count: number }[];

      const refreshDuration = Date.now() - startTime;
      const recordCount = recordCountResult[0]?.count || 0;

      const updatedViewInfo: MaterializedViewInfo = {
        viewName,
        lastRefreshed: new Date(),
        refreshDuration,
        recordCount,
        isStale: false,
      };

      this.materializedViews.set(viewName, updatedViewInfo);

      logger.info(`Materialized view ${viewName} refreshed successfully`, {
        viewName,
        refreshDuration,
        recordCount,
      });

      this.emit('materializedViewRefreshed', updatedViewInfo);

      return updatedViewInfo;

    } catch (error) {
      const refreshDuration = Date.now() - startTime;

      logger.error(`Failed to refresh materialized view ${viewName}`, {
        viewName,
        refreshDuration,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      this.emit('materializedViewRefreshError', {
        viewName,
        error: error instanceof Error ? error.message : 'Unknown error',
        refreshDuration,
      });

      throw error;
    }
  }

  /**
   * Get current pool metrics
   */
  public getMetrics(): ReportingPoolMetrics {
    this.updatePoolMetrics();
    return { ...this.poolMetrics };
  }

  /**
   * Get query execution history
   */
  public getQueryHistory(limit: number = 100): QueryExecutionMetrics[] {
    return this.queryExecutionHistory
      .slice(-limit)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get materialized view information
   */
  public getMaterializedViews(): MaterializedViewInfo[] {
    return Array.from(this.materializedViews.values());
  }

  /**
   * Clear query cache
   */
  public clearCache(pattern?: string): number {
    let cleared = 0;

    if (pattern) {
      const regex = new RegExp(pattern);
      for (const [key] of this.queryCache) {
        if (regex.test(key)) {
          this.queryCache.delete(key);
          cleared++;
        }
      }
    } else {
      cleared = this.queryCache.size;
      this.queryCache.clear();
    }

    logger.info(`Cleared ${cleared} entries from query cache`, { pattern });
    this.emit('cacheCleared', { cleared, pattern });

    return cleared;
  }

  /**
   * Check pool health
   */
  public async checkHealth(): Promise<{
    healthy: boolean;
    readPool: boolean;
    writePool: boolean;
    latency: number;
    error?: string;
  }> {
    const startTime = Date.now();
    let readPool = false;
    let writePool = false;
    let error: string | undefined;

    try {
      // Test read pool
      if (this.readOnlySequelize) {
        await this.readOnlySequelize.authenticate();
        readPool = true;
      }

      // Test write pool
      if (this.writeSequelize) {
        await this.writeSequelize.authenticate();
        writePool = true;
      }

    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const latency = Date.now() - startTime;
    const healthy = readPool && writePool;

    this.poolMetrics.lastHealthCheck = new Date();

    return {
      healthy,
      readPool,
      writePool,
      latency,
      error,
    };
  }

  /**
   * Close the connection pool
   */
  public async close(): Promise<void> {
    logger.info('Closing reporting connection pool...');

    this.stopHealthChecking();
    this.stopMetricsCollection();

    if (this.readOnlySequelize) {
      await this.readOnlySequelize.close();
      this.readOnlySequelize = null;
    }

    if (this.writeSequelize) {
      await this.writeSequelize.close();
      this.writeSequelize = null;
    }

    this.isInitialized = false;
    this.queryCache.clear();
    this.materializedViews.clear();

    this.emit('poolClosed');
    logger.info('Reporting connection pool closed');
  }

  // Private methods

  private async initializeReadOnlyPool(): Promise<void> {
    const poolConfig = getPoolConfig();

    // Optimize pool configuration for read-heavy workloads
    const readPoolConfig = {
      ...poolConfig,
      max: Math.floor(poolConfig.max * 0.8), // Reserve more connections for reads
      min: Math.floor(poolConfig.min * 0.7),
      acquire: poolConfig.acquire * 1.5, // Allow longer acquisition time for complex queries
      idle: poolConfig.idle * 2, // Keep read connections alive longer
    };

    this.readOnlySequelize = dbConnection.getSequelize().constructor({
      ...dbConnection.getSequelize().config,
      pool: readPoolConfig,
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
      benchmark: true,
    }) as Sequelize;

    await this.readOnlySequelize.authenticate();
    logger.info('Read-only connection pool initialized');
  }

  private async initializeWritePool(): Promise<void> {
    const poolConfig = getPoolConfig();

    // Smaller pool for write operations (materialized view refresh)
    const writePoolConfig = {
      ...poolConfig,
      max: Math.floor(poolConfig.max * 0.2),
      min: Math.max(1, Math.floor(poolConfig.min * 0.3)),
    };

    this.writeSequelize = dbConnection.getSequelize().constructor({
      ...dbConnection.getSequelize().config,
      pool: writePoolConfig,
      logging: process.env.NODE_ENV === 'development' ? console.log : false,
    }) as Sequelize;

    await this.writeSequelize.authenticate();
    logger.info('Write connection pool initialized');
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private generateQueryId(query: string, replacements?: Record<string, any>): string {
    const queryHash = Buffer.from(query).toString('base64').substring(0, 20);
    const replacementHash = replacements ?
      Buffer.from(JSON.stringify(replacements)).toString('base64').substring(0, 10) :
      'no-params';
    return `${queryHash}-${replacementHash}`;
  }

  private getCachedResult(queryId: string): any | null {
    const cached = this.queryCache.get(queryId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp.getTime() > cached.ttl) {
      this.queryCache.delete(queryId);
      return null;
    }

    return cached.result;
  }

  private cacheResult(queryId: string, result: any, ttl: number): void {
    this.queryCache.set(queryId, {
      result,
      timestamp: new Date(),
      ttl,
    });

    // Cleanup old cache entries (keep last 1000)
    if (this.queryCache.size > 1000) {
      const entries = Array.from(this.queryCache.entries())
        .sort((a, b) => b[1].timestamp.getTime() - a[1].timestamp.getTime())
        .slice(100); // Keep newest 100

      this.queryCache.clear();
      entries.forEach(([key, value]) => this.queryCache.set(key, value));
    }
  }

  private recordQueryExecution(metrics: QueryExecutionMetrics): void {
    this.queryExecutionHistory.push(metrics);

    // Keep only last 1000 executions
    if (this.queryExecutionHistory.length > 1000) {
      this.queryExecutionHistory = this.queryExecutionHistory.slice(-1000);
    }

    // Update aggregate metrics
    this.updateAggregateMetrics(metrics);
  }

  private updateAggregateMetrics(metrics: QueryExecutionMetrics): void {
    const recentQueries = this.queryExecutionHistory.slice(-100);

    this.poolMetrics.averageQueryTime = recentQueries.reduce(
      (sum, q) => sum + q.executionTime, 0
    ) / recentQueries.length;

    this.poolMetrics.slowQueries = recentQueries.filter(
      q => q.executionTime > performanceConfig.slowQueryThreshold
    ).length;
  }

  private updatePoolMetrics(): void {
    try {
      if (this.readOnlySequelize) {
        const pool = (this.readOnlySequelize.connectionManager as any).pool;
        if (pool) {
          this.poolMetrics.totalConnections = pool.size || 0;
          this.poolMetrics.activeConnections = pool.used?.length || 0;
          this.poolMetrics.idleConnections = pool.available?.length || 0;
          this.poolMetrics.pendingRequests = pool.pending?.length || 0;

          this.poolMetrics.connectionUtilization = this.poolMetrics.totalConnections > 0 ?
            this.poolMetrics.activeConnections / this.poolMetrics.totalConnections : 0;

          this.poolMetrics.poolEfficiency = this.poolMetrics.totalConnections > 0 ?
            (this.poolMetrics.activeConnections + this.poolMetrics.idleConnections) / this.poolMetrics.totalConnections : 0;
        }
      }
    } catch (error) {
      logger.debug('Failed to update pool metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private async discoverMaterializedViews(): Promise<void> {
    try {
      // This is database-specific - adjust based on your database type
      const views = await this.readOnlySequelize!.query(`
        SELECT table_name as view_name
        FROM information_schema.tables
        WHERE table_type = 'VIEW'
        AND table_name LIKE '%_mv' OR table_name LIKE 'mv_%'
      `, { type: QueryTypes.SELECT }) as { view_name: string }[];

      for (const view of views) {
        const viewInfo: MaterializedViewInfo = {
          viewName: view.view_name,
          lastRefreshed: new Date(), // Placeholder - would query actual refresh time
          refreshDuration: 0,
          recordCount: 0,
          isStale: true, // Assume stale until refreshed
        };

        this.materializedViews.set(view.view_name, viewInfo);
      }

      logger.info(`Discovered ${views.length} materialized views`, {
        views: views.map(v => v.view_name),
      });

    } catch (error) {
      logger.warn('Failed to discover materialized views', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  private getConnectionId(): string {
    return `conn-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  }

  private createQueryLogger(queryId: string) {
    return (sql: string, timing?: number) => {
      if (timing && timing > performanceConfig.slowQueryThreshold) {
        logger.warn('Slow query detected', {
          queryId,
          sql: sql.substring(0, 200),
          timing,
          threshold: performanceConfig.slowQueryThreshold,
        });
      } else {
        logger.debug('Query executed', {
          queryId,
          timing,
        });
      }
    };
  }

  private startHealthChecking(): void {
    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.checkHealth();
        if (!health.healthy) {
          logger.warn('Reporting pool health check failed', health);
          this.emit('healthCheckFailed', health);
        }
      } catch (error) {
        logger.error('Health check error', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, 60000); // Check every minute
  }

  private stopHealthChecking(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  private startMetricsCollection(): void {
    this.metricsCollectionInterval = setInterval(() => {
      this.updatePoolMetrics();
      this.emit('metricsUpdated', this.getMetrics());
    }, performanceConfig.metricsCollectionInterval);
  }

  private stopMetricsCollection(): void {
    if (this.metricsCollectionInterval) {
      clearInterval(this.metricsCollectionInterval);
      this.metricsCollectionInterval = null;
    }
  }
}

// Export singleton instance
export const reportingPool = ReportingConnectionPool.getInstance();

// Convenience functions
export const initializeReportingPool = async (): Promise<void> => {
  return reportingPool.initialize();
};

export const executeReportQuery = async (
  query: string,
  replacements?: Record<string, any>,
  options?: {
    useCache?: boolean;
    cacheTtl?: number;
    timeout?: number;
    maxRows?: number;
  }
): Promise<any> => {
  return reportingPool.executeReportQuery(query, replacements, options);
};

export const refreshMaterializedView = async (
  viewName: string,
  options?: {
    force?: boolean;
    timeout?: number;
  }
): Promise<MaterializedViewInfo> => {
  return reportingPool.refreshMaterializedView(viewName, options);
};

export const getReportingMetrics = (): ReportingPoolMetrics => {
  return reportingPool.getMetrics();
};

export const closeReportingPool = async (): Promise<void> => {
  return reportingPool.close();
};