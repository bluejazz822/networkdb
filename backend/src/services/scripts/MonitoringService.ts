/**
 * Script Monitoring Service
 * Provides real-time monitoring, logging, and analytics for script executions
 */

import { EventEmitter } from 'events';
import { Op } from 'sequelize';
import { getDatabase } from '../../config/database';
import { Script } from '../../models/Script';
import { ScriptExecution, ScriptExecutionStatus } from '../../models/ScriptExecution';
import { DEFAULT_SCRIPT_CONFIG, MONITORING_CONFIG } from './config';
import { ScriptError, formatDuration, formatBytes, ERROR_CODES } from './utils';

const sequelize = getDatabase();

export interface ExecutionMetrics {
  totalExecutions: number;
  runningExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  successRate: number;
  resourceUsage: {
    totalCpuHours: number;
    totalMemoryMB: number;
    totalDiskGB: number;
  };
}

export interface ScriptMetrics {
  scriptId: string;
  scriptName: string;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  averageExecutionTime: number;
  lastExecuted?: Date;
  successRate: number;
  averageResourceUsage: {
    memoryMB: number;
    cpuPercent: number;
    diskUsedMB: number;
  };
}

export interface SystemMetrics {
  timestamp: Date;
  activeExecutions: number;
  queuedExecutions: number;
  systemLoad: {
    cpu: number;
    memory: number;
    disk: number;
  };
  performance: {
    avgResponseTime: number;
    throughput: number;
    errorRate: number;
  };
}

export interface ExecutionAlert {
  id: string;
  type: 'timeout' | 'resource_limit' | 'failure' | 'long_running' | 'high_resource';
  severity: 'low' | 'medium' | 'high' | 'critical';
  executionId: string;
  scriptId: string;
  message: string;
  details: Record<string, any>;
  timestamp: Date;
  acknowledged?: boolean;
}

export interface LogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  executionId?: string;
  scriptId?: string;
  message: string;
  details?: Record<string, any>;
}

export class MonitoringService extends EventEmitter {
  private config = DEFAULT_SCRIPT_CONFIG;
  private metrics: Map<string, any> = new Map();
  private alerts: ExecutionAlert[] = [];
  private logs: LogEntry[] = [];
  private maxLogEntries = 10000;
  private maxAlerts = 1000;

  constructor() {
    super();
    this.startPeriodicMetricsCollection();
    this.startSystemHealthChecks();
  }

  /**
   * Start periodic metrics collection
   */
  private startPeriodicMetricsCollection(): void {
    setInterval(async () => {
      try {
        await this.collectExecutionMetrics();
        await this.collectSystemMetrics();
        await this.checkForAlerts();
      } catch (error) {
        this.log('error', 'Failed to collect periodic metrics', { error: error as Error });
      }
    }, MONITORING_CONFIG.RESOURCE_CHECK_INTERVAL);
  }

  /**
   * Start system health checks
   */
  private startSystemHealthChecks(): void {
    setInterval(async () => {
      try {
        await this.performHealthChecks();
      } catch (error) {
        this.log('error', 'Health check failed', { error: error as Error });
      }
    }, MONITORING_CONFIG.HEALTH_CHECK_INTERVAL);
  }

  /**
   * Get overall execution metrics
   */
  async getExecutionMetrics(timeRange?: { from: Date; to: Date }): Promise<ExecutionMetrics> {
    try {
      const whereClause: any = {};
      
      if (timeRange) {
        whereClause.createdAt = {
          [Op.between]: [timeRange.from, timeRange.to]
        };
      }

      const [totalExecutions, executions] = await Promise.all([
        ScriptExecution.count({ where: whereClause }),
        ScriptExecution.findAll({
          where: whereClause,
          attributes: [
            'status',
            'duration',
            'resourceUsage'
          ]
        })
      ]);

      const runningExecutions = executions.filter(e => 
        [ScriptExecutionStatus.QUEUED, ScriptExecutionStatus.RUNNING].includes(e.status)
      ).length;

      const completedExecutions = executions.filter(e => 
        e.status === ScriptExecutionStatus.COMPLETED
      ).length;

      const failedExecutions = executions.filter(e => 
        [ScriptExecutionStatus.FAILED, ScriptExecutionStatus.TIMEOUT, ScriptExecutionStatus.KILLED].includes(e.status)
      ).length;

      const validDurations = executions
        .filter(e => e.duration && e.duration > 0)
        .map(e => e.duration!);

      const averageExecutionTime = validDurations.length > 0
        ? validDurations.reduce((sum, duration) => sum + duration, 0) / validDurations.length
        : 0;

      const successRate = totalExecutions > 0 ? (completedExecutions / totalExecutions) * 100 : 0;

      // Calculate resource usage
      let totalCpuHours = 0;
      let totalMemoryMB = 0;
      let totalDiskGB = 0;

      for (const execution of executions) {
        if (execution.resourceUsage && execution.duration) {
          const durationHours = execution.duration / (1000 * 60 * 60);
          totalCpuHours += (execution.resourceUsage.maxCpuPercent || 0) * durationHours / 100;
          totalMemoryMB += execution.resourceUsage.maxMemoryMB || 0;
          totalDiskGB += (execution.resourceUsage.diskUsedMB || 0) / 1024;
        }
      }

      return {
        totalExecutions,
        runningExecutions,
        completedExecutions,
        failedExecutions,
        averageExecutionTime,
        successRate,
        resourceUsage: {
          totalCpuHours,
          totalMemoryMB,
          totalDiskGB
        }
      };
    } catch (error) {
      throw new ScriptError(
        `Failed to get execution metrics: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { error: error as Error }
      );
    }
  }

  /**
   * Get metrics for a specific script
   */
  async getScriptMetrics(scriptId: string, timeRange?: { from: Date; to: Date }): Promise<ScriptMetrics | null> {
    try {
      const script = await Script.findByPk(scriptId);
      if (!script) {
        return null;
      }

      const whereClause: any = { scriptId };
      
      if (timeRange) {
        whereClause.createdAt = {
          [Op.between]: [timeRange.from, timeRange.to]
        };
      }

      const executions = await ScriptExecution.findAll({
        where: whereClause,
        attributes: [
          'status',
          'duration',
          'resourceUsage',
          'completedAt'
        ],
        order: [['completedAt', 'DESC']]
      });

      const totalExecutions = executions.length;
      const successfulExecutions = executions.filter(e => 
        e.status === ScriptExecutionStatus.COMPLETED
      ).length;
      const failedExecutions = executions.filter(e => 
        [ScriptExecutionStatus.FAILED, ScriptExecutionStatus.TIMEOUT, ScriptExecutionStatus.KILLED].includes(e.status)
      ).length;

      const validDurations = executions
        .filter(e => e.duration && e.duration > 0)
        .map(e => e.duration!);

      const averageExecutionTime = validDurations.length > 0
        ? validDurations.reduce((sum, duration) => sum + duration, 0) / validDurations.length
        : 0;

      const lastExecuted = executions.length > 0 ? executions[0].completedAt : undefined;
      const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

      // Calculate average resource usage
      const resourceStats = executions
        .filter(e => e.resourceUsage)
        .map(e => e.resourceUsage!);

      const averageResourceUsage = {
        memoryMB: resourceStats.length > 0
          ? resourceStats.reduce((sum, r) => sum + (r.maxMemoryMB || 0), 0) / resourceStats.length
          : 0,
        cpuPercent: resourceStats.length > 0
          ? resourceStats.reduce((sum, r) => sum + (r.maxCpuPercent || 0), 0) / resourceStats.length
          : 0,
        diskUsedMB: resourceStats.length > 0
          ? resourceStats.reduce((sum, r) => sum + (r.diskUsedMB || 0), 0) / resourceStats.length
          : 0
      };

      return {
        scriptId,
        scriptName: script.name,
        totalExecutions,
        successfulExecutions,
        failedExecutions,
        averageExecutionTime,
        lastExecuted,
        successRate,
        averageResourceUsage
      };
    } catch (error) {
      throw new ScriptError(
        `Failed to get script metrics: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { scriptId, error: error as Error }
      );
    }
  }

  /**
   * Get system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    try {
      const [activeExecutions, queuedExecutions] = await Promise.all([
        ScriptExecution.count({
          where: { status: ScriptExecutionStatus.RUNNING }
        }),
        ScriptExecution.count({
          where: { status: ScriptExecutionStatus.QUEUED }
        })
      ]);

      // Get recent executions for performance metrics
      const recentExecutions = await ScriptExecution.findAll({
        where: {
          createdAt: {
            [Op.gte]: new Date(Date.now() - 60 * 60 * 1000) // Last hour
          }
        },
        attributes: ['status', 'duration', 'createdAt']
      });

      const completedInLastHour = recentExecutions.filter(e => 
        e.status === ScriptExecutionStatus.COMPLETED
      ).length;
      const failedInLastHour = recentExecutions.filter(e => 
        [ScriptExecutionStatus.FAILED, ScriptExecutionStatus.TIMEOUT, ScriptExecutionStatus.KILLED].includes(e.status)
      ).length;

      const avgResponseTime = recentExecutions
        .filter(e => e.duration && e.duration > 0)
        .reduce((sum, e) => sum + e.duration!, 0) / Math.max(recentExecutions.length, 1);

      const throughput = completedInLastHour; // Executions per hour
      const errorRate = recentExecutions.length > 0 
        ? (failedInLastHour / recentExecutions.length) * 100 
        : 0;

      return {
        timestamp: new Date(),
        activeExecutions,
        queuedExecutions,
        systemLoad: {
          cpu: 0, // Would integrate with system monitoring
          memory: 0, // Would integrate with system monitoring
          disk: 0 // Would integrate with system monitoring
        },
        performance: {
          avgResponseTime,
          throughput,
          errorRate
        }
      };
    } catch (error) {
      throw new ScriptError(
        `Failed to get system metrics: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { error: error as Error }
      );
    }
  }

  /**
   * Get execution history for a script
   */
  async getExecutionHistory(
    scriptId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: ScriptExecutionStatus;
      sortBy?: 'createdAt' | 'duration' | 'status';
      sortOrder?: 'ASC' | 'DESC';
    } = {}
  ): Promise<{
    executions: ScriptExecution[];
    total: number;
    hasMore: boolean;
  }> {
    try {
      const {
        limit = 50,
        offset = 0,
        status,
        sortBy = 'createdAt',
        sortOrder = 'DESC'
      } = options;

      const whereClause: any = { scriptId };
      if (status) {
        whereClause.status = status;
      }

      const { count, rows } = await ScriptExecution.findAndCountAll({
        where: whereClause,
        limit,
        offset,
        order: [[sortBy, sortOrder]],
        attributes: [
          'id',
          'status',
          'priority',
          'queuedAt',
          'startedAt',
          'completedAt',
          'duration',
          'exitCode',
          'error',
          'resourceUsage'
        ]
      });

      return {
        executions: rows,
        total: count,
        hasMore: offset + limit < count
      };
    } catch (error) {
      throw new ScriptError(
        `Failed to get execution history: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { scriptId, error: error as Error }
      );
    }
  }

  /**
   * Get current alerts
   */
  getAlerts(severity?: ExecutionAlert['severity']): ExecutionAlert[] {
    if (severity) {
      return this.alerts.filter(alert => alert.severity === severity);
    }
    return [...this.alerts];
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      this.emit('alert-acknowledged', alert);
      return true;
    }
    return false;
  }

  /**
   * Get recent logs
   */
  getLogs(
    level?: LogEntry['level'],
    executionId?: string,
    limit: number = 100
  ): LogEntry[] {
    let filtered = [...this.logs];
    
    if (level) {
      filtered = filtered.filter(log => log.level === level);
    }
    
    if (executionId) {
      filtered = filtered.filter(log => log.executionId === executionId);
    }
    
    return filtered
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Get execution statistics for dashboard
   */
  async getDashboardStats(): Promise<{
    overview: ExecutionMetrics;
    topScripts: Array<{
      scriptId: string;
      scriptName: string;
      executions: number;
      successRate: number;
    }>;
    recentActivity: ScriptExecution[];
    systemHealth: {
      status: 'healthy' | 'warning' | 'critical';
      issues: string[];
    };
  }> {
    try {
      const [overview, topScriptsData, recentActivity] = await Promise.all([
        this.getExecutionMetrics(),
        this.getTopPerformingScripts(),
        this.getRecentActivity()
      ]);

      const systemHealth = this.getSystemHealth();

      return {
        overview,
        topScripts: topScriptsData,
        recentActivity,
        systemHealth
      };
    } catch (error) {
      throw new ScriptError(
        `Failed to get dashboard stats: ${(error as Error).message}`,
        ERROR_CODES.EXECUTION_ERROR,
        { error: error as Error }
      );
    }
  }

  /**
   * Private methods
   */

  private async collectExecutionMetrics(): Promise<void> {
    const metrics = await this.getExecutionMetrics();
    this.metrics.set('execution_metrics', {
      ...metrics,
      timestamp: new Date()
    });
  }

  private async collectSystemMetrics(): Promise<void> {
    const metrics = await this.getSystemMetrics();
    this.metrics.set('system_metrics', metrics);
  }

  private async checkForAlerts(): Promise<void> {
    // Check for long-running executions
    const longRunningExecutions = await ScriptExecution.findAll({
      where: {
        status: ScriptExecutionStatus.RUNNING,
        startedAt: {
          [Op.lt]: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours ago
        }
      },
      include: ['script']
    });

    for (const execution of longRunningExecutions) {
      this.createAlert({
        type: 'long_running',
        severity: 'medium',
        executionId: execution.id,
        scriptId: execution.scriptId,
        message: 'Execution has been running for over 2 hours',
        details: {
          startedAt: execution.startedAt,
          duration: Date.now() - (execution.startedAt?.getTime() || 0)
        }
      });
    }

    // Check for high failure rate
    const recentFailures = await ScriptExecution.count({
      where: {
        status: [ScriptExecutionStatus.FAILED, ScriptExecutionStatus.TIMEOUT, ScriptExecutionStatus.KILLED],
        createdAt: {
          [Op.gte]: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    });

    const totalRecent = await ScriptExecution.count({
      where: {
        createdAt: {
          [Op.gte]: new Date(Date.now() - 60 * 60 * 1000)
        }
      }
    });

    if (totalRecent > 0 && (recentFailures / totalRecent) > 0.5) {
      this.createAlert({
        type: 'failure',
        severity: 'high',
        executionId: '',
        scriptId: '',
        message: 'High failure rate detected in the last hour',
        details: {
          failureRate: (recentFailures / totalRecent) * 100,
          failures: recentFailures,
          total: totalRecent
        }
      });
    }
  }

  private async performHealthChecks(): Promise<void> {
    // Check database connection
    try {
      await sequelize.authenticate();
      this.log('debug', 'Database health check passed');
    } catch (error) {
      this.log('error', 'Database health check failed', { error: error as Error });
      this.createAlert({
        type: 'failure',
        severity: 'critical',
        executionId: '',
        scriptId: '',
        message: 'Database connection failed',
        details: { error: (error as Error).message }
      });
    }

    // Check disk space (would integrate with system monitoring)
    // Check memory usage (would integrate with system monitoring)
  }

  private async getTopPerformingScripts(): Promise<Array<{
    scriptId: string;
    scriptName: string;
    executions: number;
    successRate: number;
  }>> {
    const results = await sequelize.query(`
      SELECT 
        s.id as "scriptId",
        s.name as "scriptName",
        COUNT(se.id) as executions,
        (COUNT(CASE WHEN se.status = 'COMPLETED' THEN 1 END) * 100.0 / COUNT(se.id)) as "successRate"
      FROM scripts s
      LEFT JOIN script_executions se ON s.id = se."scriptId"
      WHERE se."createdAt" >= NOW() - INTERVAL '7 days'
      GROUP BY s.id, s.name
      HAVING COUNT(se.id) > 0
      ORDER BY executions DESC, "successRate" DESC
      LIMIT 10
    `, { type: 'SELECT' });

    return results as Array<{
      scriptId: string;
      scriptName: string;
      executions: number;
      successRate: number;
    }>;
  }

  private async getRecentActivity(): Promise<ScriptExecution[]> {
    return await ScriptExecution.findAll({
      limit: 20,
      order: [['createdAt', 'DESC']],
      include: ['script'],
      attributes: [
        'id',
        'status',
        'priority',
        'queuedAt',
        'startedAt',
        'completedAt',
        'duration',
        'exitCode'
      ]
    });
  }

  private getSystemHealth(): {
    status: 'healthy' | 'warning' | 'critical';
    issues: string[];
  } {
    const issues: string[] = [];
    const criticalAlerts = this.alerts.filter(a => a.severity === 'critical' && !a.acknowledged);
    const highAlerts = this.alerts.filter(a => a.severity === 'high' && !a.acknowledged);

    if (criticalAlerts.length > 0) {
      issues.push(`${criticalAlerts.length} critical alerts`);
    }

    if (highAlerts.length > 0) {
      issues.push(`${highAlerts.length} high priority alerts`);
    }

    const status = criticalAlerts.length > 0 
      ? 'critical' 
      : highAlerts.length > 0 
        ? 'warning' 
        : 'healthy';

    return { status, issues };
  }

  private createAlert(alertData: Omit<ExecutionAlert, 'id' | 'timestamp' | 'acknowledged'>): void {
    const alert: ExecutionAlert = {
      ...alertData,
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      acknowledged: false
    };

    this.alerts.unshift(alert);

    // Keep only the most recent alerts
    if (this.alerts.length > this.maxAlerts) {
      this.alerts = this.alerts.slice(0, this.maxAlerts);
    }

    this.emit('alert-created', alert);
    this.log('warn', `Alert created: ${alert.type}`, { alert });
  }

  private log(level: LogEntry['level'], message: string, details?: any): void {
    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      details
    };

    this.logs.unshift(entry);

    // Keep only the most recent logs
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(0, this.maxLogEntries);
    }

    this.emit('log-entry', entry);
  }
}

export default MonitoringService;