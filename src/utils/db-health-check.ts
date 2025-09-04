#!/usr/bin/env node

import { dbConnection, DatabaseHealthStatus, ConnectionMetrics } from './db-connection';
import { environment } from '../config/environment';
import winston from 'winston';

// Logger for health check utility
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console(),
  ],
});

/**
 * Database health monitoring utility
 * Can be run as a standalone script or integrated into health check endpoints
 */
export class DatabaseHealthMonitor {
  private static instance: DatabaseHealthMonitor;
  private healthHistory: DatabaseHealthStatus[] = [];
  private readonly maxHistorySize = 100;

  private constructor() {}

  public static getInstance(): DatabaseHealthMonitor {
    if (!DatabaseHealthMonitor.instance) {
      DatabaseHealthMonitor.instance = new DatabaseHealthMonitor();
    }
    return DatabaseHealthMonitor.instance;
  }

  /**
   * Perform comprehensive health check
   */
  public async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      status: 'healthy',
      timestamp: new Date(),
      checks: {
        connection: { status: 'unknown', message: '', latency: 0 },
        pool: { status: 'unknown', message: '', details: null },
        query: { status: 'unknown', message: '', latency: 0 },
      },
      metrics: null,
      totalTime: 0,
      recommendations: [],
    };

    try {
      // 1. Connection health check
      result.checks.connection = await this.checkConnection();
      
      // 2. Connection pool health check
      result.checks.pool = await this.checkConnectionPool();
      
      // 3. Query execution health check
      result.checks.query = await this.checkQueryExecution();
      
      // 4. Get connection metrics
      result.metrics = dbConnection.getConnectionMetrics();
      
      // 5. Calculate overall status
      result.status = this.calculateOverallStatus(result.checks);
      
      // 6. Generate recommendations
      result.recommendations = this.generateRecommendations(result);
      
      result.totalTime = Date.now() - startTime;
      
      // Store in history
      const healthStatus: DatabaseHealthStatus = {
        connected: result.status !== 'unhealthy',
        latency: result.totalTime,
        timestamp: result.timestamp,
        connectionInfo: result.metrics,
        error: result.status === 'unhealthy' ? this.getErrorSummary(result.checks) : null,
      };
      
      this.addToHistory(healthStatus);
      
      logger.info(`Health check completed: ${result.status} (${result.totalTime}ms)`);
      
    } catch (error) {
      result.status = 'unhealthy';
      result.totalTime = Date.now() - startTime;
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.checks.connection = { status: 'unhealthy', message: errorMessage, latency: 0 };
      
      logger.error('Health check failed', { error: errorMessage });
    }

    return result;
  }

  /**
   * Check database connection
   */
  private async checkConnection(): Promise<HealthCheckItem> {
    const startTime = Date.now();
    
    try {
      const healthStatus = await dbConnection.checkHealth();
      const latency = Date.now() - startTime;
      
      if (healthStatus.connected) {
        return {
          status: latency < 1000 ? 'healthy' : 'warning',
          message: `Connection established (${latency}ms)`,
          latency,
        };
      } else {
        return {
          status: 'unhealthy',
          message: healthStatus.error || 'Connection failed',
          latency,
        };
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Connection check failed',
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * Check connection pool status
   */
  private async checkConnectionPool(): Promise<HealthCheckItem> {
    try {
      const metrics = dbConnection.getConnectionMetrics();
      const sequelize = dbConnection.getSequelize();
      const poolConfig = (sequelize.options.pool as any) || {};
      
      const poolInfo = {
        current: metrics.currentConnections,
        max: poolConfig.max || 0,
        min: poolConfig.min || 0,
        utilization: poolConfig.max ? (metrics.currentConnections / poolConfig.max) * 100 : 0,
      };

      let status: 'healthy' | 'warning' | 'unhealthy';
      let message: string;

      if (poolInfo.utilization > 90) {
        status = 'unhealthy';
        message = `Pool utilization critical: ${poolInfo.utilization.toFixed(1)}%`;
      } else if (poolInfo.utilization > 70) {
        status = 'warning';
        message = `Pool utilization high: ${poolInfo.utilization.toFixed(1)}%`;
      } else {
        status = 'healthy';
        message = `Pool utilization normal: ${poolInfo.utilization.toFixed(1)}%`;
      }

      return {
        status,
        message,
        latency: 0,
        details: poolInfo,
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Pool check failed',
        latency: 0,
      };
    }
  }

  /**
   * Check query execution
   */
  private async checkQueryExecution(): Promise<HealthCheckItem> {
    const startTime = Date.now();
    
    try {
      // Execute a simple query to test database responsiveness
      await dbConnection.executeQuery('SELECT 1 as health_check', {}, {
        timeout: environment.healthCheck.timeout,
      });
      
      const latency = Date.now() - startTime;
      
      return {
        status: latency < 100 ? 'healthy' : latency < 1000 ? 'warning' : 'unhealthy',
        message: `Query executed successfully (${latency}ms)`,
        latency,
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Query execution failed',
        latency: Date.now() - startTime,
      };
    }
  }

  /**
   * Calculate overall health status
   */
  private calculateOverallStatus(checks: HealthChecks): HealthStatus {
    const statuses = Object.values(checks).map(check => check.status);
    
    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    }
    
    if (statuses.includes('warning')) {
      return 'warning';
    }
    
    return 'healthy';
  }

  /**
   * Generate recommendations based on health check results
   */
  private generateRecommendations(result: HealthCheckResult): string[] {
    const recommendations: string[] = [];
    
    // Connection recommendations
    if (result.checks.connection.latency > 1000) {
      recommendations.push('Consider optimizing network connectivity to database');
    }
    
    // Pool recommendations
    if (result.checks.pool.details && result.checks.pool.details.utilization > 70) {
      recommendations.push('Consider increasing connection pool size');
    }
    
    // Query performance recommendations
    if (result.checks.query.latency > 100) {
      recommendations.push('Monitor slow query log for performance optimization opportunities');
    }
    
    // Metrics-based recommendations
    if (result.metrics) {
      const failureRate = result.metrics.failedConnections / result.metrics.totalConnections;
      if (failureRate > 0.1) {
        recommendations.push('High connection failure rate detected - investigate connection parameters');
      }
      
      if (result.metrics.averageConnectionTime > 1000) {
        recommendations.push('Connection establishment time is high - check network and database server performance');
      }
    }
    
    return recommendations;
  }

  /**
   * Get error summary from checks
   */
  private getErrorSummary(checks: HealthChecks): string {
    const errors = Object.entries(checks)
      .filter(([_, check]) => check.status === 'unhealthy')
      .map(([name, check]) => `${name}: ${check.message}`);
    
    return errors.join('; ');
  }

  /**
   * Add health status to history
   */
  private addToHistory(status: DatabaseHealthStatus): void {
    this.healthHistory.push(status);
    
    if (this.healthHistory.length > this.maxHistorySize) {
      this.healthHistory.shift();
    }
  }

  /**
   * Get health history
   */
  public getHealthHistory(): DatabaseHealthStatus[] {
    return [...this.healthHistory];
  }

  /**
   * Get health statistics from history
   */
  public getHealthStatistics(): HealthStatistics {
    if (this.healthHistory.length === 0) {
      return {
        totalChecks: 0,
        averageLatency: 0,
        uptime: 0,
        recentFailures: 0,
      };
    }

    const recentChecks = this.healthHistory.slice(-10);
    const totalLatency = this.healthHistory.reduce((sum, check) => sum + check.latency, 0);
    const connectedChecks = this.healthHistory.filter(check => check.connected).length;
    const recentFailures = recentChecks.filter(check => !check.connected).length;

    return {
      totalChecks: this.healthHistory.length,
      averageLatency: totalLatency / this.healthHistory.length,
      uptime: (connectedChecks / this.healthHistory.length) * 100,
      recentFailures,
    };
  }
}

// Type definitions
export type HealthStatus = 'healthy' | 'warning' | 'unhealthy';

export interface HealthCheckItem {
  status: HealthStatus;
  message: string;
  latency: number;
  details?: any;
}

export interface HealthChecks {
  connection: HealthCheckItem;
  pool: HealthCheckItem;
  query: HealthCheckItem;
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  checks: HealthChecks;
  metrics: ConnectionMetrics | null;
  totalTime: number;
  recommendations: string[];
}

export interface HealthStatistics {
  totalChecks: number;
  averageLatency: number;
  uptime: number;
  recentFailures: number;
}

// Export singleton instance
export const healthMonitor = DatabaseHealthMonitor.getInstance();

// CLI execution
if (require.main === module) {
  async function runHealthCheck() {
    try {
      const result = await healthMonitor.performHealthCheck();
      
      console.log('\n=== Database Health Check ===');
      console.log(`Status: ${result.status.toUpperCase()}`);
      console.log(`Total Time: ${result.totalTime}ms`);
      console.log(`Timestamp: ${result.timestamp.toISOString()}`);
      
      console.log('\n--- Connection Checks ---');
      Object.entries(result.checks).forEach(([name, check]) => {
        console.log(`${name}: ${check.status} - ${check.message}`);
        if (check.latency) console.log(`  Latency: ${check.latency}ms`);
        if (check.details) console.log(`  Details:`, check.details);
      });
      
      if (result.metrics) {
        console.log('\n--- Connection Metrics ---');
        console.log(`Total Connections: ${result.metrics.totalConnections}`);
        console.log(`Successful: ${result.metrics.successfulConnections}`);
        console.log(`Failed: ${result.metrics.failedConnections}`);
        console.log(`Average Connection Time: ${result.metrics.averageConnectionTime}ms`);
        console.log(`Current Connections: ${result.metrics.currentConnections}`);
      }
      
      if (result.recommendations.length > 0) {
        console.log('\n--- Recommendations ---');
        result.recommendations.forEach((rec, index) => {
          console.log(`${index + 1}. ${rec}`);
        });
      }
      
      // Exit with appropriate code
      process.exit(result.status === 'unhealthy' ? 1 : 0);
      
    } catch (error) {
      console.error('Health check failed:', error);
      process.exit(1);
    }
  }
  
  runHealthCheck();
}