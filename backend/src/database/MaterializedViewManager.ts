/**
 * Materialized View Management and Scheduling System
 *
 * Handles creation, refresh, and scheduling of materialized views for
 * optimized reporting performance. Includes dependency tracking,
 * incremental refresh capabilities, and automated scheduling.
 */

import { EventEmitter } from 'events';
import { executeReportQuery, refreshMaterializedView } from './connections/ReportingConnectionPool';
import { executeQuery } from '../utils/db-connection';
import { QueryTypes } from 'sequelize';
import winston from 'winston';
import cron from 'node-cron';

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.label({ label: 'MaterializedViewManager' }),
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

// Materialized view definition interfaces
export interface MaterializedViewDefinition {
  name: string;
  description: string;
  sourceQuery: string;
  refreshStrategy: 'full' | 'incremental' | 'smart';
  refreshSchedule?: string; // Cron expression
  dependencies: string[]; // Table names this view depends on
  indexColumns?: string[];
  partitionBy?: string;
  retentionDays?: number;
  isActive: boolean;
  metadata: {
    createdAt: Date;
    lastRefreshed?: Date;
    lastRefreshDuration?: number;
    recordCount?: number;
    sizeBytes?: number;
    refreshCount: number;
    errorCount: number;
    lastError?: string;
  };
}

export interface RefreshResult {
  viewName: string;
  success: boolean;
  startTime: Date;
  endTime: Date;
  duration: number;
  recordsProcessed: number;
  sizeBytes: number;
  refreshType: 'full' | 'incremental';
  error?: string;
  warnings?: string[];
}

export interface ViewDependency {
  viewName: string;
  tableName: string;
  dependencyType: 'direct' | 'indirect';
  lastTableUpdate?: Date;
  refreshRequired: boolean;
}

export interface RefreshSchedule {
  viewName: string;
  cronExpression: string;
  enabled: boolean;
  nextRun: Date;
  lastRun?: Date;
  runCount: number;
  errorCount: number;
}

/**
 * Materialized View Manager
 *
 * Manages the lifecycle of materialized views including creation,
 * refresh scheduling, dependency tracking, and performance monitoring.
 */
export class MaterializedViewManager extends EventEmitter {
  private static instance: MaterializedViewManager;
  private isInitialized = false;
  private viewDefinitions = new Map<string, MaterializedViewDefinition>();
  private refreshSchedules = new Map<string, RefreshSchedule>();
  private activeCronJobs = new Map<string, cron.ScheduledTask>();
  private dependencyGraph = new Map<string, ViewDependency[]>();
  private refreshQueue: string[] = [];
  private isRefreshing = false;
  private refreshHistory: RefreshResult[] = [];

  private constructor() {
    super();
  }

  public static getInstance(): MaterializedViewManager {
    if (!MaterializedViewManager.instance) {
      MaterializedViewManager.instance = new MaterializedViewManager();
    }
    return MaterializedViewManager.instance;
  }

  /**
   * Initialize the materialized view manager
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Materialized view manager already initialized');
      return;
    }

    try {
      logger.info('Initializing materialized view manager...');

      // Load existing view definitions
      await this.loadViewDefinitions();

      // Build dependency graph
      await this.buildDependencyGraph();

      // Start scheduled refresh tasks
      await this.startScheduledTasks();

      // Register for table change events (would integrate with CDC in production)
      this.setupChangeDetection();

      this.isInitialized = true;
      this.emit('managerInitialized');

      logger.info('Materialized view manager initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize materialized view manager', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Create a new materialized view
   */
  public async createMaterializedView(
    definition: Omit<MaterializedViewDefinition, 'metadata'>
  ): Promise<MaterializedViewDefinition> {
    try {
      logger.info(`Creating materialized view: ${definition.name}`);

      // Validate the source query
      await this.validateSourceQuery(definition.sourceQuery);

      // Create the materialized view in database
      await this.createViewInDatabase(definition);

      // Create full definition with metadata
      const fullDefinition: MaterializedViewDefinition = {
        ...definition,
        metadata: {
          createdAt: new Date(),
          refreshCount: 0,
          errorCount: 0,
        },
      };

      // Store definition
      this.viewDefinitions.set(definition.name, fullDefinition);

      // Create indexes if specified
      if (definition.indexColumns) {
        await this.createViewIndexes(definition.name, definition.indexColumns);
      }

      // Setup refresh schedule if provided
      if (definition.refreshSchedule) {
        await this.scheduleRefresh(definition.name, definition.refreshSchedule);
      }

      // Update dependency graph
      await this.updateDependencyGraph(definition.name, definition.dependencies);

      // Perform initial refresh
      await this.refreshView(definition.name, 'full');

      this.emit('viewCreated', fullDefinition);

      logger.info(`Materialized view ${definition.name} created successfully`);

      return fullDefinition;

    } catch (error) {
      logger.error(`Failed to create materialized view ${definition.name}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Refresh a specific materialized view
   */
  public async refreshView(
    viewName: string,
    refreshType: 'full' | 'incremental' | 'auto' = 'auto'
  ): Promise<RefreshResult> {
    const definition = this.viewDefinitions.get(viewName);
    if (!definition) {
      throw new Error(`Materialized view not found: ${viewName}`);
    }

    const startTime = new Date();
    let success = false;
    let recordsProcessed = 0;
    let sizeBytes = 0;
    let error: string | undefined;
    let warnings: string[] = [];

    try {
      logger.info(`Refreshing materialized view: ${viewName}`, {
        refreshType,
        strategy: definition.refreshStrategy,
      });

      // Determine actual refresh type
      const actualRefreshType = this.determineRefreshType(definition, refreshType);

      // Perform the refresh
      if (actualRefreshType === 'incremental' && definition.refreshStrategy === 'incremental') {
        const result = await this.performIncrementalRefresh(definition);
        recordsProcessed = result.recordsProcessed;
        warnings = result.warnings;
      } else {
        // Full refresh
        await this.performFullRefresh(definition);
      }

      // Get updated view statistics
      const stats = await this.getViewStatistics(viewName);
      recordsProcessed = stats.recordCount;
      sizeBytes = stats.sizeBytes;

      success = true;

      // Update metadata
      definition.metadata.lastRefreshed = new Date();
      definition.metadata.lastRefreshDuration = Date.now() - startTime.getTime();
      definition.metadata.recordCount = recordsProcessed;
      definition.metadata.sizeBytes = sizeBytes;
      definition.metadata.refreshCount++;

      this.emit('viewRefreshed', { viewName, success: true, duration: definition.metadata.lastRefreshDuration });

    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
      success = false;

      definition.metadata.errorCount++;
      definition.metadata.lastError = error;

      this.emit('viewRefreshError', { viewName, error });

      logger.error(`Failed to refresh materialized view ${viewName}`, { error });
    }

    const endTime = new Date();
    const duration = endTime.getTime() - startTime.getTime();

    const result: RefreshResult = {
      viewName,
      success,
      startTime,
      endTime,
      duration,
      recordsProcessed,
      sizeBytes,
      refreshType: actualRefreshType,
      error,
      warnings: warnings.length > 0 ? warnings : undefined,
    };

    // Store refresh history
    this.refreshHistory.push(result);
    if (this.refreshHistory.length > 1000) {
      this.refreshHistory = this.refreshHistory.slice(-1000);
    }

    return result;
  }

  /**
   * Schedule a refresh for a materialized view
   */
  public async scheduleRefresh(
    viewName: string,
    cronExpression: string,
    enabled: boolean = true
  ): Promise<void> {
    try {
      logger.info(`Scheduling refresh for materialized view: ${viewName}`, {
        cronExpression,
        enabled,
      });

      // Validate cron expression
      if (!cron.validate(cronExpression)) {
        throw new Error(`Invalid cron expression: ${cronExpression}`);
      }

      // Stop existing schedule if any
      await this.unscheduleRefresh(viewName);

      // Create new schedule
      const schedule: RefreshSchedule = {
        viewName,
        cronExpression,
        enabled,
        nextRun: this.getNextRunTime(cronExpression),
        runCount: 0,
        errorCount: 0,
      };

      this.refreshSchedules.set(viewName, schedule);

      if (enabled) {
        // Start cron job
        const task = cron.schedule(cronExpression, async () => {
          try {
            logger.info(`Scheduled refresh starting for view: ${viewName}`);
            await this.refreshView(viewName, 'auto');
            schedule.runCount++;
            schedule.lastRun = new Date();
            schedule.nextRun = this.getNextRunTime(cronExpression);
          } catch (error) {
            schedule.errorCount++;
            logger.error(`Scheduled refresh failed for view: ${viewName}`, {
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }, {
          scheduled: true,
          timezone: 'UTC',
        });

        this.activeCronJobs.set(viewName, task);
      }

      this.emit('refreshScheduled', schedule);

      logger.info(`Refresh scheduled for materialized view: ${viewName}`);

    } catch (error) {
      logger.error(`Failed to schedule refresh for view ${viewName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Unschedule a refresh for a materialized view
   */
  public async unscheduleRefresh(viewName: string): Promise<void> {
    const existingTask = this.activeCronJobs.get(viewName);
    if (existingTask) {
      existingTask.stop();
      existingTask.destroy();
      this.activeCronJobs.delete(viewName);
    }

    this.refreshSchedules.delete(viewName);

    logger.info(`Refresh unscheduled for materialized view: ${viewName}`);
    this.emit('refreshUnscheduled', { viewName });
  }

  /**
   * Refresh all stale views based on dependencies
   */
  public async refreshStaleViews(): Promise<RefreshResult[]> {
    const results: RefreshResult[] = [];

    try {
      logger.info('Checking for stale materialized views...');

      // Check each view for staleness
      const staleViews: string[] = [];

      for (const [viewName, definition] of this.viewDefinitions) {
        if (!definition.isActive) continue;

        const isStale = await this.isViewStale(viewName);
        if (isStale) {
          staleViews.push(viewName);
        }
      }

      logger.info(`Found ${staleViews.length} stale views to refresh`, { staleViews });

      // Refresh stale views in dependency order
      const orderedViews = this.orderViewsByDependencies(staleViews);

      for (const viewName of orderedViews) {
        try {
          const result = await this.refreshView(viewName, 'auto');
          results.push(result);
        } catch (error) {
          logger.error(`Failed to refresh stale view ${viewName}`, {
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      this.emit('staleViewsRefreshed', { count: results.length, views: staleViews });

    } catch (error) {
      logger.error('Failed to refresh stale views', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return results;
  }

  /**
   * Get all materialized view definitions
   */
  public getViewDefinitions(): MaterializedViewDefinition[] {
    return Array.from(this.viewDefinitions.values());
  }

  /**
   * Get refresh schedules
   */
  public getRefreshSchedules(): RefreshSchedule[] {
    return Array.from(this.refreshSchedules.values());
  }

  /**
   * Get refresh history
   */
  public getRefreshHistory(viewName?: string, limit: number = 100): RefreshResult[] {
    let history = this.refreshHistory;

    if (viewName) {
      history = history.filter(r => r.viewName === viewName);
    }

    return history.slice(-limit).sort((a, b) => b.startTime.getTime() - a.startTime.getTime());
  }

  /**
   * Get view statistics
   */
  public async getViewStatistics(viewName: string): Promise<{
    recordCount: number;
    sizeBytes: number;
    indexCount: number;
    lastUpdated: Date;
  }> {
    try {
      const countResult = await executeReportQuery(
        `SELECT COUNT(*) as count FROM ${viewName}`,
        {},
        { useCache: false }
      ) as { count: number }[];

      const sizeResult = await executeReportQuery(`
        SELECT
          ROUND(((data_length + index_length) / 1024 / 1024), 2) as size_mb,
          table_rows,
          create_time,
          update_time
        FROM information_schema.tables
        WHERE table_name = :viewName
      `, { viewName }, { useCache: false }) as any[];

      const indexResult = await executeReportQuery(`
        SELECT COUNT(*) as index_count
        FROM information_schema.statistics
        WHERE table_name = :viewName
      `, { viewName }, { useCache: false }) as { index_count: number }[];

      const recordCount = countResult[0]?.count || 0;
      const sizeBytes = (sizeResult[0]?.size_mb || 0) * 1024 * 1024;
      const indexCount = indexResult[0]?.index_count || 0;
      const lastUpdated = sizeResult[0]?.update_time || new Date();

      return {
        recordCount,
        sizeBytes,
        indexCount,
        lastUpdated,
      };

    } catch (error) {
      logger.error(`Failed to get statistics for view ${viewName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return {
        recordCount: 0,
        sizeBytes: 0,
        indexCount: 0,
        lastUpdated: new Date(),
      };
    }
  }

  /**
   * Drop a materialized view
   */
  public async dropMaterializedView(viewName: string): Promise<void> {
    try {
      logger.info(`Dropping materialized view: ${viewName}`);

      // Unschedule refresh
      await this.unscheduleRefresh(viewName);

      // Drop from database
      await executeQuery(`DROP VIEW IF EXISTS ${viewName}`, {}, {
        type: QueryTypes.RAW,
      });

      // Remove from definitions
      this.viewDefinitions.delete(viewName);

      // Update dependency graph
      this.dependencyGraph.delete(viewName);

      this.emit('viewDropped', { viewName });

      logger.info(`Materialized view ${viewName} dropped successfully`);

    } catch (error) {
      logger.error(`Failed to drop materialized view ${viewName}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  // Private methods

  private async loadViewDefinitions(): Promise<void> {
    // In production, this would load from a configuration table
    // For now, we'll define some common reporting views

    const commonViews: Omit<MaterializedViewDefinition, 'metadata'>[] = [
      {
        name: 'mv_vpc_summary',
        description: 'VPC summary with subnet and resource counts',
        sourceQuery: `
          SELECT
            v.provider,
            v.region,
            v.vpc_id,
            v.name,
            v.cidr_block,
            v.state,
            COUNT(DISTINCT s.id) as subnet_count,
            COUNT(DISTINCT tga.id) as tgw_attachment_count,
            v.created_at,
            v.updated_at
          FROM vpcs v
          LEFT JOIN subnets s ON v.vpc_id = s.vpc_id
          LEFT JOIN transit_gateway_attachments tga ON v.vpc_id = tga.vpc_id
          GROUP BY v.id, v.provider, v.region, v.vpc_id, v.name, v.cidr_block, v.state, v.created_at, v.updated_at
        `,
        refreshStrategy: 'incremental',
        refreshSchedule: '0 */6 * * *', // Every 6 hours
        dependencies: ['vpcs', 'subnets', 'transit_gateway_attachments'],
        indexColumns: ['provider', 'region', 'vpc_id'],
        isActive: true,
      },
      {
        name: 'mv_daily_execution_stats',
        description: 'Daily report execution statistics',
        sourceQuery: `
          SELECT
            DATE(re.start_time) as execution_date,
            COUNT(*) as total_executions,
            COUNT(CASE WHEN re.status = 'completed' THEN 1 END) as successful_executions,
            COUNT(CASE WHEN re.status = 'failed' THEN 1 END) as failed_executions,
            AVG(re.duration_ms) as avg_duration_ms,
            MAX(re.duration_ms) as max_duration_ms,
            SUM(re.records_processed) as total_records_processed
          FROM report_executions re
          WHERE re.start_time >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
          GROUP BY DATE(re.start_time)
        `,
        refreshStrategy: 'full',
        refreshSchedule: '0 1 * * *', // Daily at 1 AM
        dependencies: ['report_executions'],
        indexColumns: ['execution_date'],
        isActive: true,
      },
    ];

    // Load predefined views (in production, would come from database)
    logger.info(`Loading ${commonViews.length} predefined materialized views`);
  }

  private async buildDependencyGraph(): Promise<void> {
    logger.debug('Building materialized view dependency graph');

    for (const [viewName, definition] of this.viewDefinitions) {
      const dependencies: ViewDependency[] = [];

      for (const tableName of definition.dependencies) {
        dependencies.push({
          viewName,
          tableName,
          dependencyType: 'direct',
          refreshRequired: false,
        });
      }

      this.dependencyGraph.set(viewName, dependencies);
    }

    logger.info(`Dependency graph built for ${this.dependencyGraph.size} views`);
  }

  private async startScheduledTasks(): Promise<void> {
    for (const [viewName, definition] of this.viewDefinitions) {
      if (definition.refreshSchedule && definition.isActive) {
        await this.scheduleRefresh(viewName, definition.refreshSchedule, true);
      }
    }

    logger.info(`Started ${this.activeCronJobs.size} scheduled refresh tasks`);
  }

  private setupChangeDetection(): void {
    // In production, this would integrate with CDC or table triggers
    // For now, we'll set up a periodic check
    setInterval(async () => {
      try {
        await this.checkForTableChanges();
      } catch (error) {
        logger.error('Error in change detection', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }, 300000); // Check every 5 minutes

    logger.info('Change detection setup completed');
  }

  private async validateSourceQuery(query: string): Promise<void> {
    try {
      // Validate query by executing with LIMIT 0
      const validationQuery = `${query} LIMIT 0`;
      await executeReportQuery(validationQuery, {}, { useCache: false, timeout: 10000 });
    } catch (error) {
      throw new Error(`Invalid source query: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createViewInDatabase(
    definition: Omit<MaterializedViewDefinition, 'metadata'>
  ): Promise<void> {
    const createViewQuery = `CREATE VIEW ${definition.name} AS ${definition.sourceQuery}`;

    await executeQuery(createViewQuery, {}, {
      type: QueryTypes.RAW,
    });
  }

  private async createViewIndexes(viewName: string, indexColumns: string[]): Promise<void> {
    for (let i = 0; i < indexColumns.length; i++) {
      const column = indexColumns[i];
      const indexName = `idx_${viewName}_${column}`;

      try {
        await executeQuery(
          `CREATE INDEX ${indexName} ON ${viewName} (${column})`,
          {},
          { type: QueryTypes.RAW }
        );
      } catch (error) {
        logger.warn(`Failed to create index ${indexName}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  private determineRefreshType(
    definition: MaterializedViewDefinition,
    requestedType: 'full' | 'incremental' | 'auto'
  ): 'full' | 'incremental' {
    if (requestedType === 'full') return 'full';
    if (requestedType === 'incremental' && definition.refreshStrategy === 'incremental') {
      return 'incremental';
    }

    // Auto determination
    if (definition.refreshStrategy === 'incremental') {
      return 'incremental';
    }

    return 'full';
  }

  private async performFullRefresh(definition: MaterializedViewDefinition): Promise<void> {
    // For views (not true materialized views), we need to recreate
    await executeQuery(`DROP VIEW IF EXISTS ${definition.name}`, {}, {
      type: QueryTypes.RAW,
    });

    await this.createViewInDatabase(definition);

    if (definition.indexColumns) {
      await this.createViewIndexes(definition.name, definition.indexColumns);
    }
  }

  private async performIncrementalRefresh(
    definition: MaterializedViewDefinition
  ): Promise<{ recordsProcessed: number; warnings: string[] }> {
    // This is a simplified incremental refresh
    // In production, would use change data capture or timestamp-based updates
    const warnings: string[] = [];

    // For now, fall back to full refresh with a warning
    warnings.push('Incremental refresh not implemented, performing full refresh');
    await this.performFullRefresh(definition);

    const stats = await this.getViewStatistics(definition.name);
    return {
      recordsProcessed: stats.recordCount,
      warnings,
    };
  }

  private async isViewStale(viewName: string): Promise<boolean> {
    const definition = this.viewDefinitions.get(viewName);
    if (!definition) return false;

    // Check if any dependent tables have been updated since last refresh
    const lastRefreshed = definition.metadata.lastRefreshed;
    if (!lastRefreshed) return true;

    for (const tableName of definition.dependencies) {
      try {
        const result = await executeReportQuery(`
          SELECT update_time
          FROM information_schema.tables
          WHERE table_name = :tableName
        `, { tableName }, { useCache: false }) as { update_time: Date }[];

        if (result[0]?.update_time && result[0].update_time > lastRefreshed) {
          return true;
        }
      } catch (error) {
        logger.warn(`Failed to check table update time for ${tableName}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return false;
  }

  private orderViewsByDependencies(viewNames: string[]): string[] {
    // Simple topological sort - in production would handle complex dependencies
    return viewNames.sort((a, b) => {
      const depsA = this.viewDefinitions.get(a)?.dependencies.length || 0;
      const depsB = this.viewDefinitions.get(b)?.dependencies.length || 0;
      return depsA - depsB; // Views with fewer dependencies first
    });
  }

  private async checkForTableChanges(): Promise<void> {
    // Check for changes in tables that materialized views depend on
    // This is a simplified implementation
    for (const [viewName, dependencies] of this.dependencyGraph) {
      for (const dependency of dependencies) {
        const isStale = await this.isViewStale(viewName);
        dependency.refreshRequired = isStale;
      }
    }
  }

  private getNextRunTime(cronExpression: string): Date {
    // Simple next run calculation - in production would use a proper cron library
    const now = new Date();
    const nextRun = new Date(now.getTime() + 3600000); // Next hour as placeholder
    return nextRun;
  }

  /**
   * Shutdown the manager
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down materialized view manager...');

    // Stop all cron jobs
    for (const [viewName, task] of this.activeCronJobs) {
      task.stop();
      task.destroy();
    }

    this.activeCronJobs.clear();
    this.refreshSchedules.clear();
    this.isInitialized = false;

    this.emit('managerShutdown');
    logger.info('Materialized view manager shut down');
  }
}

// Export singleton instance
export const materializedViewManager = MaterializedViewManager.getInstance();

// Convenience functions
export const initializeMaterializedViewManager = async (): Promise<void> => {
  return materializedViewManager.initialize();
};

export const createMaterializedView = async (
  definition: Omit<MaterializedViewDefinition, 'metadata'>
): Promise<MaterializedViewDefinition> => {
  return materializedViewManager.createMaterializedView(definition);
};

export const refreshMaterializedViewByName = async (
  viewName: string,
  refreshType: 'full' | 'incremental' | 'auto' = 'auto'
): Promise<RefreshResult> => {
  return materializedViewManager.refreshView(viewName, refreshType);
};

export const refreshAllStaleViews = async (): Promise<RefreshResult[]> => {
  return materializedViewManager.refreshStaleViews();
};

export const getViewDefinitions = (): MaterializedViewDefinition[] => {
  return materializedViewManager.getViewDefinitions();
};

export const getRefreshHistory = (viewName?: string, limit: number = 100): RefreshResult[] => {
  return materializedViewManager.getRefreshHistory(viewName, limit);
};