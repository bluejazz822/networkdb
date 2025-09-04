/**
 * Database Performance Monitoring Utilities for Network CMDB
 * 
 * Provides comprehensive monitoring for:
 * - Query performance tracking
 * - Connection pool metrics  
 * - Slow query detection and logging
 * - Resource usage monitoring
 * - Performance baseline establishment
 * 
 * Target: <2 second response time for 100K+ records
 */

export interface QueryMetrics {
  queryId: string;
  sql: string;
  executionTime: number;
  startTime: Date;
  endTime: Date;
  rowsAffected: number;
  connectionId?: string;
  userId?: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE' | 'OTHER';
  tableName?: string;
}

export interface ConnectionPoolMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  pendingRequests: number;
  poolUtilization: number;
  averageWaitTime: number;
  maxWaitTime: number;
  connectionErrors: number;
  timestamp: Date;
}

export interface PerformanceAlert {
  id: string;
  type: 'SLOW_QUERY' | 'HIGH_POOL_USAGE' | 'CONNECTION_LEAK' | 'ERROR_THRESHOLD';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  details: any;
  timestamp: Date;
  resolved: boolean;
}

/**
 * Performance monitoring class for database operations
 */
export class DatabaseMonitor {
  private queryMetrics: QueryMetrics[] = [];
  private poolMetrics: ConnectionPoolMetrics[] = [];
  private activeQueries: Map<string, { startTime: Date; sql: string }> = new Map();
  private alerts: PerformanceAlert[] = [];
  private metricsRetentionPeriod = 24 * 60 * 60 * 1000; // 24 hours
  
  // Performance thresholds (from pool-config.ts)
  private slowQueryThreshold = 1000; // 1 second
  private criticalQueryThreshold = 2000; // 2 seconds
  private poolUtilizationThreshold = 0.8; // 80%
  private connectionLeakThreshold = 300000; // 5 minutes

  /**
   * Start monitoring a query
   */
  startQueryMonitoring(queryId: string, sql: string): void {
    this.activeQueries.set(queryId, {
      startTime: new Date(),
      sql: sql.trim()
    });
  }

  /**
   * End query monitoring and record metrics
   */
  endQueryMonitoring(
    queryId: string, 
    rowsAffected: number = 0, 
    connectionId?: string,
    userId?: string
  ): QueryMetrics | null {
    const queryInfo = this.activeQueries.get(queryId);
    if (!queryInfo) {
      return null;
    }

    const endTime = new Date();
    const executionTime = endTime.getTime() - queryInfo.startTime.getTime();
    
    const metrics: QueryMetrics = {
      queryId,
      sql: queryInfo.sql,
      executionTime,
      startTime: queryInfo.startTime,
      endTime,
      rowsAffected,
      connectionId,
      userId,
      operation: this.extractOperation(queryInfo.sql),
      tableName: this.extractTableName(queryInfo.sql)
    };

    // Store metrics
    this.queryMetrics.push(metrics);
    this.activeQueries.delete(queryId);

    // Check for performance alerts
    this.checkQueryPerformance(metrics);

    // Clean up old metrics
    this.cleanupMetrics();

    return metrics;
  }

  /**
   * Record connection pool metrics
   */
  recordPoolMetrics(poolInfo: {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    pendingRequests: number;
    connectionErrors?: number;
  }): void {
    const metrics: ConnectionPoolMetrics = {
      totalConnections: poolInfo.totalConnections,
      activeConnections: poolInfo.activeConnections,
      idleConnections: poolInfo.idleConnections,
      pendingRequests: poolInfo.pendingRequests,
      poolUtilization: poolInfo.activeConnections / poolInfo.totalConnections,
      averageWaitTime: this.calculateAverageWaitTime(),
      maxWaitTime: this.calculateMaxWaitTime(),
      connectionErrors: poolInfo.connectionErrors || 0,
      timestamp: new Date()
    };

    this.poolMetrics.push(metrics);
    this.checkPoolPerformance(metrics);
    this.cleanupMetrics();
  }

  /**
   * Get slow queries above threshold
   */
  getSlowQueries(limit: number = 10): QueryMetrics[] {
    return this.queryMetrics
      .filter(query => query.executionTime > this.slowQueryThreshold)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, limit);
  }

  /**
   * Get performance statistics
   */
  getPerformanceStats(): {
    totalQueries: number;
    averageResponseTime: number;
    slowQueries: number;
    criticalQueries: number;
    poolEfficiency: number;
    activeAlerts: number;
  } {
    const totalQueries = this.queryMetrics.length;
    const averageResponseTime = totalQueries > 0 
      ? this.queryMetrics.reduce((sum, query) => sum + query.executionTime, 0) / totalQueries 
      : 0;
    
    const slowQueries = this.queryMetrics.filter(
      query => query.executionTime > this.slowQueryThreshold
    ).length;
    
    const criticalQueries = this.queryMetrics.filter(
      query => query.executionTime > this.criticalQueryThreshold
    ).length;

    const latestPoolMetrics = this.getLatestPoolMetrics();
    const poolEfficiency = latestPoolMetrics?.poolUtilization || 0;
    
    const activeAlerts = this.alerts.filter(alert => !alert.resolved).length;

    return {
      totalQueries,
      averageResponseTime,
      slowQueries,
      criticalQueries,
      poolEfficiency,
      activeAlerts
    };
  }

  /**
   * Get performance report for dashboard
   */
  generatePerformanceReport(): {
    summary: any;
    topSlowQueries: QueryMetrics[];
    poolMetrics: ConnectionPoolMetrics | null;
    activeAlerts: PerformanceAlert[];
    recommendations: string[];
  } {
    const stats = this.getPerformanceStats();
    const slowQueries = this.getSlowQueries(5);
    const poolMetrics = this.getLatestPoolMetrics();
    const activeAlerts = this.alerts.filter(alert => !alert.resolved);
    const recommendations = this.generateRecommendations(stats);

    return {
      summary: stats,
      topSlowQueries: slowQueries,
      poolMetrics,
      activeAlerts,
      recommendations
    };
  }

  /**
   * Check connection leaks (long-running queries)
   */
  checkConnectionLeaks(): PerformanceAlert[] {
    const now = new Date();
    const leaks: PerformanceAlert[] = [];

    this.activeQueries.forEach((queryInfo, queryId) => {
      const duration = now.getTime() - queryInfo.startTime.getTime();
      if (duration > this.connectionLeakThreshold) {
        leaks.push({
          id: `leak_${queryId}_${now.getTime()}`,
          type: 'CONNECTION_LEAK',
          severity: 'HIGH',
          message: `Query running for ${Math.round(duration / 1000)} seconds`,
          details: { queryId, sql: queryInfo.sql, duration },
          timestamp: now,
          resolved: false
        });
      }
    });

    return leaks;
  }

  /**
   * Private helper methods
   */
  private extractOperation(sql: string): QueryMetrics['operation'] {
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith('SELECT')) return 'SELECT';
    if (trimmed.startsWith('INSERT')) return 'INSERT';
    if (trimmed.startsWith('UPDATE')) return 'UPDATE';
    if (trimmed.startsWith('DELETE')) return 'DELETE';
    return 'OTHER';
  }

  private extractTableName(sql: string): string | undefined {
    const match = sql.match(/(?:FROM|INTO|UPDATE|JOIN)\s+([`\w]+)/i);
    return match?.[1]?.replace(/`/g, '');
  }

  private checkQueryPerformance(metrics: QueryMetrics): void {
    if (metrics.executionTime > this.criticalQueryThreshold) {
      this.alerts.push({
        id: `critical_query_${metrics.queryId}_${Date.now()}`,
        type: 'SLOW_QUERY',
        severity: 'CRITICAL',
        message: `Critical slow query: ${metrics.executionTime}ms execution time`,
        details: metrics,
        timestamp: new Date(),
        resolved: false
      });
    } else if (metrics.executionTime > this.slowQueryThreshold) {
      this.alerts.push({
        id: `slow_query_${metrics.queryId}_${Date.now()}`,
        type: 'SLOW_QUERY',
        severity: 'MEDIUM',
        message: `Slow query detected: ${metrics.executionTime}ms execution time`,
        details: metrics,
        timestamp: new Date(),
        resolved: false
      });
    }
  }

  private checkPoolPerformance(metrics: ConnectionPoolMetrics): void {
    if (metrics.poolUtilization > this.poolUtilizationThreshold) {
      this.alerts.push({
        id: `high_pool_usage_${Date.now()}`,
        type: 'HIGH_POOL_USAGE',
        severity: 'HIGH',
        message: `High connection pool utilization: ${Math.round(metrics.poolUtilization * 100)}%`,
        details: metrics,
        timestamp: new Date(),
        resolved: false
      });
    }
  }

  private calculateAverageWaitTime(): number {
    // Placeholder for actual wait time calculation
    // Will be enhanced when integrated with actual pool
    return 0;
  }

  private calculateMaxWaitTime(): number {
    // Placeholder for actual max wait time calculation
    // Will be enhanced when integrated with actual pool
    return 0;
  }

  private getLatestPoolMetrics(): ConnectionPoolMetrics | null {
    return this.poolMetrics.length > 0 
      ? this.poolMetrics[this.poolMetrics.length - 1] 
      : null;
  }

  private generateRecommendations(stats: any): string[] {
    const recommendations: string[] = [];

    if (stats.averageResponseTime > 1500) {
      recommendations.push('Consider adding database indexes for frequently queried columns');
    }

    if (stats.slowQueries > stats.totalQueries * 0.1) {
      recommendations.push('High percentage of slow queries detected - review query optimization');
    }

    if (stats.poolEfficiency < 0.7) {
      recommendations.push('Connection pool efficiency is low - consider adjusting pool size');
    }

    if (stats.criticalQueries > 0) {
      recommendations.push('Critical slow queries detected - immediate optimization needed');
    }

    return recommendations;
  }

  private cleanupMetrics(): void {
    const cutoffTime = new Date(Date.now() - this.metricsRetentionPeriod);
    
    this.queryMetrics = this.queryMetrics.filter(
      metric => metric.startTime > cutoffTime
    );
    
    this.poolMetrics = this.poolMetrics.filter(
      metric => metric.timestamp > cutoffTime
    );
    
    this.alerts = this.alerts.filter(
      alert => alert.timestamp > cutoffTime
    );
  }
}

/**
 * Global database monitor instance
 */
export const dbMonitor = new DatabaseMonitor();

/**
 * Utility functions for performance monitoring
 */
export const performanceUtils = {
  /**
   * Generate unique query ID
   */
  generateQueryId(): string {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  },

  /**
   * Format execution time for display
   */
  formatExecutionTime(timeMs: number): string {
    if (timeMs < 1000) {
      return `${timeMs}ms`;
    }
    return `${(timeMs / 1000).toFixed(2)}s`;
  },

  /**
   * Get performance grade based on response time
   */
  getPerformanceGrade(timeMs: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (timeMs < 500) return 'A';
    if (timeMs < 1000) return 'B';
    if (timeMs < 2000) return 'C';
    if (timeMs < 5000) return 'D';
    return 'F';
  },

  /**
   * Log performance metrics to console (development)
   */
  logPerformanceMetrics(metrics: QueryMetrics): void {
    const grade = performanceUtils.getPerformanceGrade(metrics.executionTime);
    const time = performanceUtils.formatExecutionTime(metrics.executionTime);
    
    console.log(`[DB-MONITOR] ${grade} | ${time} | ${metrics.operation} | ${metrics.tableName || 'N/A'} | ${metrics.rowsAffected} rows`);
  }
};

export default {
  DatabaseMonitor,
  dbMonitor,
  performanceUtils
};