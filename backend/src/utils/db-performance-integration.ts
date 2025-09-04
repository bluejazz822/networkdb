/**
 * Integration layer between db-monitor.ts and actual database configuration
 * Connects Stream D performance monitoring with Stream B database connection
 */

import { dbMonitor, performanceUtils } from './db-monitor';
import { DatabaseConfig } from '../config/database';
import { getPoolConfig, performanceConfig } from '../config/pool-config';

/**
 * Performance integration class that bridges monitoring with actual database
 */
export class DatabasePerformanceIntegration {
  private databaseConfig: DatabaseConfig;
  private metricsInterval?: NodeJS.Timeout;
  private isMonitoring = false;

  constructor() {
    this.databaseConfig = DatabaseConfig.getInstance();
  }

  /**
   * Start performance monitoring integration
   */
  public startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    // Collect pool metrics at regular intervals
    this.metricsInterval = setInterval(() => {
      this.collectPoolMetrics();
    }, performanceConfig.metricsCollectionInterval);

    console.log('Database performance monitoring started');
  }

  /**
   * Stop performance monitoring
   */
  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
      this.metricsInterval = undefined;
    }

    console.log('Database performance monitoring stopped');
  }

  /**
   * Collect connection pool metrics from actual database
   */
  private collectPoolMetrics(): void {
    try {
      const connectionInfo = this.databaseConfig.getConnectionInfo() as any;
      
      if (connectionInfo.connected && connectionInfo.pool) {
        const poolInfo = connectionInfo.pool;
        
        dbMonitor.recordPoolMetrics({
          totalConnections: poolInfo.max,
          activeConnections: poolInfo.used || 0,
          idleConnections: Math.max(0, (poolInfo.max - poolInfo.used) || 0),
          pendingRequests: poolInfo.waiting || 0,
          connectionErrors: 0 // Would need to track this separately
        });
      }
    } catch (error) {
      console.error('Error collecting pool metrics:', error);
    }
  }

  /**
   * Create a monitored query wrapper for Sequelize
   */
  public createMonitoredQuery() {
    return {
      /**
       * Wrap a Sequelize query with performance monitoring
       */
      async executeQuery<T>(
        queryFn: () => Promise<T>,
        queryDescription: string,
        tableName?: string
      ): Promise<T> {
        const queryId = performanceUtils.generateQueryId();
        const sql = queryDescription; // In real implementation, would extract actual SQL
        
        // Start monitoring
        dbMonitor.startQueryMonitoring(queryId, sql);
        
        const startTime = Date.now();
        let result: T;
        let error: Error | null = null;
        
        try {
          result = await queryFn();
        } catch (err) {
          error = err as Error;
          throw err;
        } finally {
          const endTime = Date.now();
          const executionTime = endTime - startTime;
          
          // End monitoring with results
          const metrics = dbMonitor.endQueryMonitoring(
            queryId,
            0, // rowsAffected - would need to extract from result
            undefined, // connectionId
            undefined  // userId
          );
          
          if (metrics && process.env.NODE_ENV === 'development') {
            performanceUtils.logPerformanceMetrics(metrics);
          }
          
          // Check for performance alerts
          if (executionTime > performanceConfig.criticalQueryThreshold) {
            console.warn(`Critical slow query detected: ${executionTime}ms - ${queryDescription}`);
          } else if (executionTime > performanceConfig.slowQueryThreshold) {
            console.warn(`Slow query detected: ${executionTime}ms - ${queryDescription}`);
          }
        }
        
        return result!;
      }
    };
  }

  /**
   * Get comprehensive performance report
   */
  public getPerformanceReport() {
    const report = dbMonitor.generatePerformanceReport();
    const connectionInfo = this.databaseConfig.getConnectionInfo();
    
    return {
      ...report,
      connectionInfo,
      timestamp: new Date(),
      environment: process.env.NODE_ENV,
      monitoring: {
        active: this.isMonitoring,
        collectionInterval: performanceConfig.metricsCollectionInterval
      }
    };
  }

  /**
   * Check system health and performance
   */
  public async performHealthCheck(): Promise<{
    healthy: boolean;
    issues: string[];
    metrics: any;
  }> {
    const issues: string[] = [];
    const stats = dbMonitor.getPerformanceStats();
    
    // Check connection health
    const isConnected = await this.databaseConfig.checkConnection();
    if (!isConnected) {
      issues.push('Database connection is not healthy');
    }
    
    // Check performance metrics
    if (stats.averageResponseTime > performanceConfig.targetResponseTime) {
      issues.push(`Average response time (${stats.averageResponseTime}ms) exceeds target (${performanceConfig.targetResponseTime}ms)`);
    }
    
    if (stats.poolEfficiency < performanceConfig.targetPoolEfficiency) {
      issues.push(`Pool efficiency (${stats.poolEfficiency}) below target (${performanceConfig.targetPoolEfficiency})`);
    }
    
    if (stats.criticalQueries > 0) {
      issues.push(`${stats.criticalQueries} critical slow queries detected`);
    }
    
    // Check for connection leaks
    const connectionLeaks = dbMonitor.checkConnectionLeaks();
    if (connectionLeaks.length > 0) {
      issues.push(`${connectionLeaks.length} potential connection leaks detected`);
    }
    
    return {
      healthy: issues.length === 0,
      issues,
      metrics: {
        ...stats,
        connectionInfo: this.databaseConfig.getConnectionInfo()
      }
    };
  }

  /**
   * Apply performance optimizations based on current metrics
   */
  public suggestOptimizations(): string[] {
    const stats = dbMonitor.getPerformanceStats();
    const suggestions: string[] = [];
    
    if (stats.slowQueries > stats.totalQueries * 0.1) {
      suggestions.push('Consider adding indexes for frequently queried columns');
    }
    
    if (stats.averageResponseTime > 1500) {
      suggestions.push('Review slow queries and optimize them');
    }
    
    if (stats.poolEfficiency < 0.7) {
      suggestions.push('Consider adjusting connection pool size or optimizing query patterns');
    }
    
    const connectionInfo = this.databaseConfig.getConnectionInfo() as any;
    if (connectionInfo.pool?.used > connectionInfo.pool?.max * 0.8) {
      suggestions.push('Connection pool utilization is high - consider increasing pool size');
    }
    
    return suggestions;
  }
}

/**
 * Global performance integration instance
 */
export const dbPerformanceIntegration = new DatabasePerformanceIntegration();

/**
 * Enhanced Sequelize hook for automatic query monitoring
 */
export const createSequelizeHooks = () => ({
  beforeQuery: (options: any) => {
    if (options.logging && typeof options.logging === 'function') {
      const originalLogging = options.logging;
      const queryId = performanceUtils.generateQueryId();
      
      options.queryId = queryId;
      dbMonitor.startQueryMonitoring(queryId, options.sql || 'Unknown query');
      
      options.logging = (sql: string, timing?: number) => {
        originalLogging(sql, timing);
        
        if (timing) {
          dbMonitor.endQueryMonitoring(queryId, 0);
        }
      };
    }
  },

  afterQuery: (options: any, result: any) => {
    if (options.queryId) {
      const rowCount = Array.isArray(result) ? result.length : 1;
      dbMonitor.endQueryMonitoring(options.queryId, rowCount);
    }
  }
});

export default {
  DatabasePerformanceIntegration,
  dbPerformanceIntegration,
  createSequelizeHooks
};