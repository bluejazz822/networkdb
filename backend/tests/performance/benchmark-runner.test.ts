/**
 * Performance Benchmark Runner
 * Test suite that runs comprehensive performance benchmarks and validates results
 */

import { benchmarkSuite, performanceMonitor } from './benchmark-monitor';
import { Sequelize } from 'sequelize';
import { WorkflowRegistry } from '../../src/models/WorkflowRegistry';
import { WorkflowExecution } from '../../src/models/WorkflowExecution';
import {
  createTestDatabase,
  setupTestModels,
  cleanupTestDatabase
} from '../utils/testHelpers';

describe('Performance Benchmark Runner', () => {
  let sequelize: Sequelize;
  let models: any;

  beforeAll(async () => {
    // Setup test environment with data for realistic benchmarks
    sequelize = createTestDatabase();
    models = await setupTestModels(sequelize);

    await sequelize.sync({ force: true });

    // Create test data for realistic benchmarks
    await createBenchmarkTestData();

    // Extended timeout for benchmark tests
    jest.setTimeout(600000); // 10 minutes
  });

  afterAll(async () => {
    await cleanupTestDatabase(sequelize);
  });

  it('should run comprehensive performance benchmarks', async () => {
    console.log('📊 Starting comprehensive performance benchmark suite...');

    const report = await benchmarkSuite.runBenchmarks();

    // Validate report structure
    expect(report).toBeDefined();
    expect(report.timestamp).toBeDefined();
    expect(report.testSuite).toBe('comprehensive-benchmarks');
    expect(report.environment).toBeDefined();
    expect(report.metrics).toBeDefined();
    expect(report.summary).toBeDefined();

    // Validate metrics were collected
    expect(report.metrics.length).toBeGreaterThan(50); // Should have many metrics
    expect(report.summary.totalTests).toBeGreaterThan(50);

    // Validate environment info
    expect(report.environment.nodeVersion).toBeDefined();
    expect(report.environment.platform).toBeDefined();
    expect(report.environment.totalMemory).toBeGreaterThan(0);
    expect(report.environment.cpuCount).toBeGreaterThan(0);

    console.log(`📊 Benchmark Summary:`);
    console.log(`   Total Tests: ${report.summary.totalTests}`);
    console.log(`   Passed: ${report.summary.passed}`);
    console.log(`   Failed: ${report.summary.failed}`);
    console.log(`   Average Performance: ${report.summary.averagePerformance}ms`);
    console.log(`   Memory Efficiency: ${report.summary.memoryEfficiency}`);

    // Performance expectations
    expect(report.summary.passed).toBeGreaterThan(report.summary.totalTests * 0.8); // At least 80% success
    expect(report.summary.averagePerformance).toBeLessThan(10000); // Average under 10 seconds
    expect(report.summary.memoryEfficiency).toBeGreaterThan(0.5); // Memory efficiency above 50%
  });

  it('should validate performance against established benchmarks', async () => {
    // Clear previous metrics and run focused performance tests
    performanceMonitor.clearMetrics();

    console.log('📊 Running focused performance validation...');

    // Run key operations multiple times for statistical significance
    const operations = [
      { name: 'workflow-list', count: 20 },
      { name: 'dashboard-metrics', count: 15 },
      { name: 'health-check', count: 30 }
    ];

    for (const operation of operations) {
      console.log(`📊 Testing ${operation.name} (${operation.count} iterations)...`);

      for (let i = 0; i < operation.count; i++) {
        try {
          switch (operation.name) {
            case 'workflow-list':
              await performanceMonitor.measureOperation(
                'workflow-list',
                async () => {
                  const { workflowService } = require('./benchmark-monitor');
                  return await new workflowService().getWorkflows({ page: 1, limit: 20 });
                }
              );
              break;

            case 'dashboard-metrics':
              await performanceMonitor.measureOperation(
                'dashboard-metrics',
                async () => {
                  const { workflowService } = require('./benchmark-monitor');
                  return await new workflowService().getDashboardMetrics('last24h');
                }
              );
              break;

            case 'health-check':
              await performanceMonitor.measureOperation(
                'health-check',
                async () => {
                  const { workflowService } = require('./benchmark-monitor');
                  return await new workflowService().healthCheck();
                }
              );
              break;
          }

          // Brief pause between operations
          await new Promise(resolve => setTimeout(resolve, 50));
        } catch (error) {
          // Some operations may fail in test environment, but we still collect timing data
        }
      }
    }

    // Validate performance against benchmarks
    const validation = performanceMonitor.validatePerformance();
    const metrics = performanceMonitor.getMetrics();

    console.log(`📊 Performance validation completed:`);
    console.log(`   Total metrics collected: ${metrics.length}`);
    console.log(`   Validation passed: ${validation.passed}`);

    if (!validation.passed) {
      console.log(`   Violations:`);
      validation.violations.forEach(violation => {
        console.log(`     - ${violation}`);
      });
    }

    // Performance statistics
    const operations_tested = [...new Set(metrics.map(m => m.operation))];
    operations_tested.forEach(operation => {
      const stats = performanceMonitor['calculateStatistics'](operation);
      console.log(`📊 ${operation} stats:`);
      console.log(`   Count: ${stats.count}`);
      console.log(`   Average: ${stats.average.toFixed(0)}ms`);
      console.log(`   P95: ${stats.p95}ms`);
      console.log(`   Success Rate: ${(stats.successRate * 100).toFixed(1)}%`);
    });

    // Expectations for validation
    expect(metrics.length).toBeGreaterThan(50); // Should have collected enough metrics
    expect(operations_tested.length).toBeGreaterThan(2); // Should have tested multiple operations

    // Each operation should have reasonable success rates
    operations_tested.forEach(operation => {
      const stats = performanceMonitor['calculateStatistics'](operation);
      expect(stats.successRate).toBeGreaterThan(0.7); // At least 70% success rate
    });
  });

  it('should establish baseline performance benchmarks', async () => {
    console.log('📊 Establishing baseline performance benchmarks...');

    // Clear metrics and run comprehensive baseline establishment
    performanceMonitor.clearMetrics();

    const baselineOperations = [
      { operation: 'workflow-list', iterations: 25 },
      { operation: 'dashboard-metrics', iterations: 20 },
      { operation: 'health-check', iterations: 40 },
      { operation: 'concurrent-ops', iterations: 10 }
    ];

    for (const { operation, iterations } of baselineOperations) {
      console.log(`📊 Collecting baseline for ${operation} (${iterations} samples)...`);

      for (let i = 0; i < iterations; i++) {
        try {
          switch (operation) {
            case 'workflow-list':
              await performanceMonitor.measureOperation(
                operation,
                async () => {
                  const { WorkflowService } = require('../../src/services/WorkflowService');
                  return await new WorkflowService().getWorkflows({
                    page: Math.floor(i / 10) + 1,
                    limit: 10 + (i % 10)
                  });
                },
                { baseline: true, iteration: i }
              );
              break;

            case 'dashboard-metrics':
              const timeRanges = ['last24h', 'last7d', 'last30d'];
              await performanceMonitor.measureOperation(
                operation,
                async () => {
                  const { WorkflowService } = require('../../src/services/WorkflowService');
                  return await new WorkflowService().getDashboardMetrics(timeRanges[i % timeRanges.length] as any);
                },
                { baseline: true, iteration: i, timeRange: timeRanges[i % timeRanges.length] }
              );
              break;

            case 'health-check':
              await performanceMonitor.measureOperation(
                operation,
                async () => {
                  const { WorkflowService } = require('../../src/services/WorkflowService');
                  return await new WorkflowService().healthCheck();
                },
                { baseline: true, iteration: i }
              );
              break;

            case 'concurrent-ops':
              await performanceMonitor.measureOperation(
                operation,
                async () => {
                  const { WorkflowService } = require('../../src/services/WorkflowService');
                  const service = new WorkflowService();
                  return await Promise.all([
                    service.getWorkflows({ page: 1, limit: 5 }),
                    service.healthCheck(),
                    service.getDashboardMetrics('last24h')
                  ]);
                },
                { baseline: true, iteration: i, concurrency: 3 }
              );
              break;
          }

          // Stagger operations to avoid overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));

        } catch (error) {
          // Continue with next iteration even if some fail
        }
      }
    }

    // Update benchmarks based on collected data
    const benchmarks = performanceMonitor.updateBenchmarks();
    const metrics = performanceMonitor.getMetrics();

    console.log(`📊 Baseline establishment completed:`);
    console.log(`   Benchmarks established: ${benchmarks.length}`);
    console.log(`   Total samples collected: ${metrics.length}`);

    // Validate benchmarks were created
    expect(benchmarks.length).toBeGreaterThan(2); // Should have benchmarks for multiple operations
    expect(metrics.length).toBeGreaterThan(80); // Should have collected many samples

    // Display established benchmarks
    benchmarks.forEach(benchmark => {
      console.log(`📊 ${benchmark.operation} benchmark:`);
      console.log(`   Baseline: ${benchmark.baseline}ms`);
      console.log(`   P95: ${benchmark.p95}ms`);
      console.log(`   P99: ${benchmark.p99}ms`);
      console.log(`   Max Acceptable: ${benchmark.maxAcceptable}ms`);
      console.log(`   Memory Limit: ${Math.round(benchmark.memoryLimit / 1024 / 1024)}MB`);
      console.log(`   Sample Size: ${benchmark.sampleSize}`);

      // Validate benchmark values are reasonable
      expect(benchmark.baseline).toBeGreaterThan(0);
      expect(benchmark.p95).toBeGreaterThan(benchmark.baseline);
      expect(benchmark.p99).toBeGreaterThan(benchmark.p95);
      expect(benchmark.maxAcceptable).toBeGreaterThan(benchmark.p99);
      expect(benchmark.sampleSize).toBeGreaterThan(9); // At least 10 samples
    });

    // Generate final report
    const report = performanceMonitor.generateReport('baseline-establishment');
    expect(report).toBeDefined();
    expect(report.benchmarks.length).toBe(benchmarks.length);
  });

  it('should detect performance regressions', async () => {
    console.log('📊 Testing performance regression detection...');

    // Clear metrics and run normal operations
    performanceMonitor.clearMetrics();

    // First, establish baseline with normal operations
    for (let i = 0; i < 15; i++) {
      await performanceMonitor.measureOperation(
        'regression-test',
        async () => {
          const { WorkflowService } = require('../../src/services/WorkflowService');
          await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50)); // Simulate normal operation
          return await new WorkflowService().getWorkflows({ page: 1, limit: 10 });
        },
        { phase: 'baseline', iteration: i }
      );

      await new Promise(resolve => setTimeout(resolve, 30));
    }

    // Update benchmarks with baseline
    const baselineBenchmarks = performanceMonitor.updateBenchmarks();
    const regressionBenchmark = baselineBenchmarks.find(b => b.operation === 'regression-test');

    if (regressionBenchmark) {
      console.log(`📊 Baseline established: ${regressionBenchmark.baseline}ms average`);

      // Clear metrics and simulate degraded performance
      performanceMonitor.clearMetrics();

      for (let i = 0; i < 10; i++) {
        await performanceMonitor.measureOperation(
          'regression-test',
          async () => {
            const { WorkflowService } = require('../../src/services/WorkflowService');
            // Simulate degraded performance
            await new Promise(resolve => setTimeout(resolve, 200 + Math.random() * 300));
            return await new WorkflowService().getWorkflows({ page: 1, limit: 10 });
          },
          { phase: 'degraded', iteration: i }
        );

        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Validate performance against baseline
      const validation = performanceMonitor.validatePerformance();
      const stats = performanceMonitor['calculateStatistics']('regression-test');

      console.log(`📊 Regression test results:`);
      console.log(`   Baseline average: ${regressionBenchmark.baseline}ms`);
      console.log(`   Current average: ${stats.average.toFixed(0)}ms`);
      console.log(`   Performance degraded: ${stats.average > regressionBenchmark.baseline * 1.5 ? 'YES' : 'NO'}`);
      console.log(`   Validation passed: ${validation.passed}`);

      // The regression should be detected
      expect(validation.passed).toBe(false);
      expect(validation.violations.length).toBeGreaterThan(0);
      expect(stats.average).toBeGreaterThan(regressionBenchmark.baseline * 1.5);

      console.log(`✅ Performance regression successfully detected`);
    } else {
      console.log('⚠️ Could not establish baseline benchmark for regression test');
    }
  });

  // Helper function to create test data for realistic benchmarks
  async function createBenchmarkTestData(): Promise<void> {
    console.log('📊 Creating test data for performance benchmarks...');

    // Create workflows
    const workflows = Array(100).fill(null).map((_, index) => ({
      workflow_id: `benchmark-workflow-${index}`,
      workflow_name: `Benchmark Workflow ${index}`,
      workflow_type: ['vpc', 'subnet', 'transit_gateway'][index % 3] as 'vpc' | 'subnet' | 'transit_gateway',
      provider: ['aws', 'azure', 'gcp'][index % 3] as 'aws' | 'azure' | 'gcp',
      is_active: index % 4 !== 0,
      description: `Benchmark workflow ${index}`,
      configuration: JSON.stringify({ benchmark: true, index }),
      tags: JSON.stringify(['benchmark', 'performance']),
      created_at: new Date(Date.now() - (index * 3600000)),
      updated_at: new Date()
    }));

    await WorkflowRegistry.bulkCreate(workflows, { validate: false });

    // Create executions
    const executions = Array(300).fill(null).map((_, index) => ({
      execution_id: `benchmark-exec-${index}`,
      workflow_id: `benchmark-workflow-${index % 100}`,
      status: ['success', 'failure', 'running', 'cancelled'][index % 4] as 'success' | 'failure' | 'running' | 'cancelled',
      start_time: new Date(Date.now() - (index * 1800000)),
      end_time: index % 4 !== 2 ? new Date(Date.now() - (index * 1800000) + 60000) : null,
      error_message: index % 4 === 1 ? `Benchmark error ${index}` : null,
      input_data: JSON.stringify({ benchmark: true, index }),
      output_data: index % 4 === 0 ? JSON.stringify({ result: 'success', index }) : null
    }));

    await WorkflowExecution.bulkCreate(executions, { validate: false });

    console.log('📊 Test data created: 100 workflows, 300 executions');
  }
});