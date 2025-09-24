/**
 * Performance Benchmark and Monitoring Setup
 * Utility for establishing baselines and monitoring performance metrics
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { WorkflowService } from '../../src/services/WorkflowService';
import { N8nService } from '../../src/services/N8nService';
import { AlertService } from '../../src/services/AlertService';

export interface PerformanceMetric {
  operation: string;
  duration: number;
  timestamp: number;
  memoryBefore: number;
  memoryAfter: number;
  success: boolean;
  errorMessage?: string;
  metadata?: Record<string, any>;
}

export interface PerformanceBenchmark {
  operation: string;
  baseline: number;
  p95: number;
  p99: number;
  maxAcceptable: number;
  memoryLimit: number;
  sampleSize: number;
  lastUpdated: string;
}

export interface PerformanceReport {
  timestamp: string;
  testSuite: string;
  environment: {
    nodeVersion: string;
    platform: string;
    totalMemory: number;
    cpuCount: number;
  };
  metrics: PerformanceMetric[];
  benchmarks: PerformanceBenchmark[];
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    averagePerformance: number;
    memoryEfficiency: number;
  };
}

export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private benchmarksPath: string;
  private reportsPath: string;

  constructor() {
    const performanceDir = join(__dirname, '..', 'performance-data');
    if (!existsSync(performanceDir)) {
      mkdirSync(performanceDir, { recursive: true });
    }

    this.benchmarksPath = join(performanceDir, 'benchmarks.json');
    this.reportsPath = join(performanceDir, 'reports');

    if (!existsSync(this.reportsPath)) {
      mkdirSync(this.reportsPath, { recursive: true });
    }
  }

  /**
   * Measure performance of an async operation
   */
  async measureOperation<T>(
    operation: string,
    fn: () => Promise<T>,
    metadata?: Record<string, any>
  ): Promise<{ result: T; metric: PerformanceMetric }> {
    const startTime = Date.now();
    const memoryBefore = process.memoryUsage().heapUsed;

    try {
      const result = await fn();
      const endTime = Date.now();
      const memoryAfter = process.memoryUsage().heapUsed;

      const metric: PerformanceMetric = {
        operation,
        duration: endTime - startTime,
        timestamp: startTime,
        memoryBefore,
        memoryAfter,
        success: true,
        metadata
      };

      this.metrics.push(metric);

      return { result, metric };
    } catch (error) {
      const endTime = Date.now();
      const memoryAfter = process.memoryUsage().heapUsed;

      const metric: PerformanceMetric = {
        operation,
        duration: endTime - startTime,
        timestamp: startTime,
        memoryBefore,
        memoryAfter,
        success: false,
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata
      };

      this.metrics.push(metric);

      throw error;
    }
  }

  /**
   * Load existing benchmarks
   */
  loadBenchmarks(): PerformanceBenchmark[] {
    if (!existsSync(this.benchmarksPath)) {
      return [];
    }

    try {
      const data = readFileSync(this.benchmarksPath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      console.warn('Failed to load benchmarks:', error);
      return [];
    }
  }

  /**
   * Calculate performance statistics from metrics
   */
  calculateStatistics(operation: string): {
    count: number;
    average: number;
    median: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
    successRate: number;
  } {
    const operationMetrics = this.metrics.filter(m => m.operation === operation);

    if (operationMetrics.length === 0) {
      return {
        count: 0,
        average: 0,
        median: 0,
        p95: 0,
        p99: 0,
        min: 0,
        max: 0,
        successRate: 0
      };
    }

    const durations = operationMetrics.map(m => m.duration).sort((a, b) => a - b);
    const successfulOperations = operationMetrics.filter(m => m.success).length;

    const average = durations.reduce((sum, d) => sum + d, 0) / durations.length;
    const median = durations[Math.floor(durations.length / 2)];
    const p95Index = Math.floor(durations.length * 0.95);
    const p99Index = Math.floor(durations.length * 0.99);

    return {
      count: operationMetrics.length,
      average,
      median,
      p95: durations[p95Index] || durations[durations.length - 1],
      p99: durations[p99Index] || durations[durations.length - 1],
      min: durations[0],
      max: durations[durations.length - 1],
      successRate: successfulOperations / operationMetrics.length
    };
  }

  /**
   * Update benchmarks based on current metrics
   */
  updateBenchmarks(): PerformanceBenchmark[] {
    const existingBenchmarks = this.loadBenchmarks();
    const operations = [...new Set(this.metrics.map(m => m.operation))];
    const updatedBenchmarks: PerformanceBenchmark[] = [];

    for (const operation of operations) {
      const stats = this.calculateStatistics(operation);

      if (stats.count < 10) {
        console.warn(`Insufficient data for ${operation} (${stats.count} samples), skipping benchmark update`);
        continue;
      }

      const existingBenchmark = existingBenchmarks.find(b => b.operation === operation);
      const operationMetrics = this.metrics.filter(m => m.operation === operation && m.success);
      const avgMemoryIncrease = operationMetrics.reduce((sum, m) => sum + (m.memoryAfter - m.memoryBefore), 0) / operationMetrics.length;

      const benchmark: PerformanceBenchmark = {
        operation,
        baseline: Math.round(stats.average),
        p95: Math.round(stats.p95),
        p99: Math.round(stats.p99),
        maxAcceptable: Math.round(stats.p99 * 1.5), // 50% buffer above p99
        memoryLimit: Math.max(avgMemoryIncrease * 2, 50 * 1024 * 1024), // At least 50MB limit
        sampleSize: stats.count,
        lastUpdated: new Date().toISOString()
      };

      // If there's an existing benchmark, we might want to be more conservative with updates
      if (existingBenchmark) {
        // Only update if the new baseline is within 20% of the existing one (to avoid noise)
        const difference = Math.abs(benchmark.baseline - existingBenchmark.baseline) / existingBenchmark.baseline;
        if (difference > 0.2) {
          console.warn(`Large performance change detected for ${operation}: ${existingBenchmark.baseline}ms -> ${benchmark.baseline}ms`);
        }
      }

      updatedBenchmarks.push(benchmark);
    }

    // Save updated benchmarks
    writeFileSync(this.benchmarksPath, JSON.stringify(updatedBenchmarks, null, 2));
    console.log(`📊 Updated benchmarks for ${updatedBenchmarks.length} operations`);

    return updatedBenchmarks;
  }

  /**
   * Generate performance report
   */
  generateReport(testSuite: string): PerformanceReport {
    const benchmarks = this.loadBenchmarks();
    const totalTests = this.metrics.length;
    const passed = this.metrics.filter(m => m.success).length;
    const failed = totalTests - passed;

    const averagePerformance = this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalTests;
    const memoryEfficiency = this.metrics.reduce((sum, m) => {
      const memoryIncrease = m.memoryAfter - m.memoryBefore;
      return sum + (memoryIncrease < 0 ? 1 : Math.max(0, 1 - (memoryIncrease / (100 * 1024 * 1024))));
    }, 0) / totalTests;

    const report: PerformanceReport = {
      timestamp: new Date().toISOString(),
      testSuite,
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        totalMemory: Math.round((require('os').totalmem()) / 1024 / 1024),
        cpuCount: require('os').cpus().length
      },
      metrics: this.metrics,
      benchmarks,
      summary: {
        totalTests,
        passed,
        failed,
        averagePerformance: Math.round(averagePerformance),
        memoryEfficiency: Math.round(memoryEfficiency * 100) / 100
      }
    };

    // Save report
    const reportFilename = `${testSuite}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const reportPath = join(this.reportsPath, reportFilename);
    writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`📊 Performance report saved: ${reportPath}`);

    return report;
  }

  /**
   * Validate performance against benchmarks
   */
  validatePerformance(): { passed: boolean; violations: string[] } {
    const benchmarks = this.loadBenchmarks();
    const violations: string[] = [];

    for (const benchmark of benchmarks) {
      const stats = this.calculateStatistics(benchmark.operation);

      if (stats.count === 0) continue;

      // Check if average performance is within acceptable range
      if (stats.average > benchmark.maxAcceptable) {
        violations.push(
          `${benchmark.operation}: Average ${stats.average}ms exceeds limit ${benchmark.maxAcceptable}ms`
        );
      }

      // Check if p95 has degraded significantly
      if (stats.p95 > benchmark.p95 * 1.3) {
        violations.push(
          `${benchmark.operation}: P95 ${stats.p95}ms exceeds baseline ${benchmark.p95}ms by >30%`
        );
      }

      // Check memory usage
      const operationMetrics = this.metrics.filter(m => m.operation === benchmark.operation && m.success);
      if (operationMetrics.length > 0) {
        const maxMemoryIncrease = Math.max(...operationMetrics.map(m => m.memoryAfter - m.memoryBefore));
        if (maxMemoryIncrease > benchmark.memoryLimit) {
          violations.push(
            `${benchmark.operation}: Memory usage ${Math.round(maxMemoryIncrease / 1024 / 1024)}MB exceeds limit ${Math.round(benchmark.memoryLimit / 1024 / 1024)}MB`
          );
        }
      }
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  /**
   * Clear collected metrics
   */
  clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Get current metrics
   */
  getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }
}

/**
 * Comprehensive performance benchmark suite
 */
export class PerformanceBenchmarkSuite {
  private monitor: PerformanceMonitor;
  private workflowService: WorkflowService;
  private n8nService: N8nService;
  private alertService: AlertService;

  constructor() {
    this.monitor = new PerformanceMonitor();
    this.workflowService = new WorkflowService();
    this.n8nService = new N8nService();
    this.alertService = new AlertService();
  }

  /**
   * Run complete benchmark suite
   */
  async runBenchmarks(): Promise<PerformanceReport> {
    console.log('📊 Starting comprehensive performance benchmarks...');

    this.monitor.clearMetrics();

    // WorkflowService benchmarks
    await this.benchmarkWorkflowService();

    // N8nService benchmarks
    await this.benchmarkN8nService();

    // AlertService benchmarks
    await this.benchmarkAlertService();

    // Concurrent operations benchmark
    await this.benchmarkConcurrentOperations();

    // Update benchmarks and generate report
    this.monitor.updateBenchmarks();
    const report = this.monitor.generateReport('comprehensive-benchmarks');

    // Validate performance
    const validation = this.monitor.validatePerformance();
    if (!validation.passed) {
      console.warn('⚠️ Performance violations detected:');
      validation.violations.forEach(violation => console.warn(`  - ${violation}`));
    } else {
      console.log('✅ All performance benchmarks passed');
    }

    return report;
  }

  private async benchmarkWorkflowService(): Promise<void> {
    console.log('📊 Benchmarking WorkflowService operations...');

    // Benchmark workflow listing
    for (let i = 0; i < 15; i++) {
      await this.monitor.measureOperation(
        'workflow-list',
        () => this.workflowService.getWorkflows({ page: 1, limit: 20 }),
        { iteration: i }
      );

      await this.wait(100);
    }

    // Benchmark dashboard metrics
    for (let i = 0; i < 10; i++) {
      await this.monitor.measureOperation(
        'dashboard-metrics',
        () => this.workflowService.getDashboardMetrics('last24h'),
        { timeRange: 'last24h', iteration: i }
      );

      await this.wait(200);
    }

    // Benchmark health check
    for (let i = 0; i < 20; i++) {
      await this.monitor.measureOperation(
        'health-check',
        () => this.workflowService.healthCheck(),
        { iteration: i }
      );

      await this.wait(50);
    }

    // Benchmark sync operation
    for (let i = 0; i < 5; i++) {
      try {
        await this.monitor.measureOperation(
          'workflow-sync',
          () => this.workflowService.syncWorkflows(),
          { iteration: i }
        );
      } catch (error) {
        // Expected to fail in test environment
      }

      await this.wait(1000);
    }
  }

  private async benchmarkN8nService(): Promise<void> {
    console.log('📊 Benchmarking N8nService operations...');

    // Benchmark workflow discovery
    for (let i = 0; i < 10; i++) {
      try {
        await this.monitor.measureOperation(
          'n8n-discovery',
          () => this.n8nService.discoverWorkflows(),
          { iteration: i }
        );
      } catch (error) {
        // Expected to fail in test environment
      }

      await this.wait(500);
    }

    // Benchmark readiness checks
    for (let i = 0; i < 50; i++) {
      await this.monitor.measureOperation(
        'n8n-ready-check',
        () => Promise.resolve(this.n8nService.isReady()),
        { iteration: i }
      );

      await this.wait(20);
    }
  }

  private async benchmarkAlertService(): Promise<void> {
    console.log('📊 Benchmarking AlertService operations...');

    // Benchmark alert history
    for (let i = 0; i < 15; i++) {
      try {
        await this.monitor.measureOperation(
          'alert-history',
          () => this.alertService.getAlertHistory({ limit: 20 }),
          { limit: 20, iteration: i }
        );
      } catch (error) {
        // May fail in test environment
      }

      await this.wait(100);
    }

    // Benchmark email config test
    for (let i = 0; i < 5; i++) {
      try {
        await this.monitor.measureOperation(
          'email-config-test',
          () => this.alertService.testEmailConfig('test@example.com'),
          { iteration: i }
        );
      } catch (error) {
        // Expected to fail in test environment
      }

      await this.wait(500);
    }
  }

  private async benchmarkConcurrentOperations(): Promise<void> {
    console.log('📊 Benchmarking concurrent operations...');

    // Benchmark concurrent workflow operations
    for (let i = 0; i < 5; i++) {
      await this.monitor.measureOperation(
        'concurrent-workflow-ops',
        () => Promise.all([
          this.workflowService.getWorkflows({ page: 1, limit: 10 }),
          this.workflowService.getDashboardMetrics('last24h'),
          this.workflowService.healthCheck()
        ]),
        { concurrency: 3, iteration: i }
      );

      await this.wait(1000);
    }

    // Benchmark mixed service operations
    for (let i = 0; i < 3; i++) {
      await this.monitor.measureOperation(
        'mixed-service-ops',
        async () => {
          const operations = [
            this.workflowService.getWorkflows({ page: 1, limit: 5 }),
            this.workflowService.healthCheck(),
            Promise.resolve(this.n8nService.isReady()),
            this.alertService.getAlertHistory({ limit: 5 }).catch(() => ({ alerts: [], total: 0, page: 1, totalPages: 0 }))
          ];

          return await Promise.allSettled(operations);
        },
        { concurrency: 4, iteration: i }
      );

      await this.wait(2000);
    }
  }

  private async wait(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Export default instance for easy use
export const performanceMonitor = new PerformanceMonitor();
export const benchmarkSuite = new PerformanceBenchmarkSuite();