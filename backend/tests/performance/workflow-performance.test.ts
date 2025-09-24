/**
 * Workflow Performance and Load Testing
 * Tests for data-synchronization workflow system performance
 */

import { WorkflowService } from '../../src/services/WorkflowService';
import { N8nService } from '../../src/services/N8nService';
import { AlertService } from '../../src/services/AlertService';
import { Sequelize } from 'sequelize';
import {
  createTestDatabase,
  setupTestModels,
  cleanupTestDatabase,
  wait
} from '../utils/testHelpers';
import { WorkflowRegistry } from '../../src/models/WorkflowRegistry';
import { WorkflowExecution } from '../../src/models/WorkflowExecution';
import { WorkflowAlert } from '../../src/models/WorkflowAlert';

describe('Workflow Performance and Load Testing', () => {
  let sequelize: Sequelize;
  let workflowService: WorkflowService;
  let n8nService: N8nService;
  let alertService: AlertService;
  let models: any;

  beforeAll(async () => {
    // Setup test environment
    sequelize = createTestDatabase();
    models = await setupTestModels(sequelize);

    workflowService = new WorkflowService();
    n8nService = new N8nService();
    alertService = new AlertService();

    // Increase timeout for performance tests
    jest.setTimeout(180000); // 3 minutes for comprehensive tests
  });

  afterAll(async () => {
    await cleanupTestDatabase(sequelize);
  });

  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });

  // ===================== WORKFLOW SERVICE PERFORMANCE =====================

  describe('WorkflowService Performance Tests', () => {
    beforeEach(async () => {
      // Create test workflows
      await createTestWorkflows(100);
    });

    it('should handle large workflow listing efficiently', async () => {
      console.log('🚀 Testing workflow listing with 100 workflows...');

      const startTime = Date.now();
      const result = await workflowService.getWorkflows({
        page: 1,
        limit: 50
      });
      const executionTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data!.length).toBeLessThanOrEqual(50);
      expect(result.pagination!.total).toBe(100);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds

      console.log(`📊 Listed workflows in ${executionTime}ms`);
    });

    it('should handle workflow filtering with complex queries efficiently', async () => {
      const filters = [
        { type: 'vpc' as const, active: true },
        { provider: 'aws' as const, search: 'test' },
        { type: 'subnet' as const, provider: 'azure' as const },
        { active: false, tags: ['monitoring', 'sync'] }
      ];

      for (const [index, filter] of filters.entries()) {
        const startTime = Date.now();
        const result = await workflowService.getWorkflows(filter);
        const executionTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(executionTime).toBeLessThan(3000); // Should complete within 3 seconds

        console.log(`📊 Filter ${index + 1} executed in ${executionTime}ms`);
      }
    });

    it('should handle concurrent workflow queries efficiently', async () => {
      const concurrentRequests = 20;
      const requests = Array(concurrentRequests).fill(null).map((_, index) =>
        workflowService.getWorkflows({
          page: Math.floor(index / 10) + 1,
          limit: 10,
          active: index % 2 === 0
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data!.length).toBeLessThanOrEqual(10);
      });

      const avgTimePerRequest = totalTime / concurrentRequests;
      expect(avgTimePerRequest).toBeLessThan(2000); // 2 seconds average per request
      expect(totalTime).toBeLessThan(10000); // Total should complete within 10 seconds

      console.log(`📊 ${concurrentRequests} concurrent workflow queries: ${totalTime}ms total, ${avgTimePerRequest.toFixed(0)}ms average`);
    });

    it('should handle dashboard metrics calculation efficiently with large datasets', async () => {
      // Create execution history for performance testing
      await createTestExecutions(500);

      const timeRanges = ['last24h', 'last7d', 'last30d'] as const;

      for (const timeRange of timeRanges) {
        const startTime = Date.now();
        const result = await workflowService.getDashboardMetrics(timeRange);
        const executionTime = Date.now() - startTime;

        expect(result.success).toBe(true);
        expect(result.data!.totalWorkflows).toBeGreaterThan(0);
        expect(executionTime).toBeLessThan(8000); // Should complete within 8 seconds

        console.log(`📊 Dashboard metrics for ${timeRange}: ${executionTime}ms`);
      }
    });

    it('should maintain performance under memory pressure', async () => {
      const initialMemory = process.memoryUsage();
      console.log(`📊 Initial memory: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);

      // Perform intensive workflow operations
      for (let i = 0; i < 50; i++) {
        await workflowService.getWorkflows({ page: 1, limit: 20 });
        await workflowService.getDashboardMetrics('last24h');

        // Periodic memory check
        if (i % 10 === 0) {
          const currentMemory = process.memoryUsage();
          console.log(`📊 Memory after ${i + 1} iterations: ${Math.round(currentMemory.heapUsed / 1024 / 1024)}MB`);
        }
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        await wait(1000);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
      console.log(`📊 Final memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    });
  });

  // ===================== N8N SERVICE PERFORMANCE =====================

  describe('N8nService Performance Tests', () => {
    it('should handle workflow discovery efficiently', async () => {
      console.log('🚀 Testing N8n workflow discovery performance...');

      const iterations = 10;
      const executionTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const result = await n8nService.discoverWorkflows();
        const executionTime = Date.now() - startTime;

        executionTimes.push(executionTime);

        // Allow for network variability but should generally be fast
        expect(executionTime).toBeLessThan(10000); // 10 seconds max

        if (i % 3 === 0) {
          console.log(`📊 Discovery iteration ${i + 1}: ${executionTime}ms`);
        }

        // Brief pause between requests to avoid overwhelming n8n
        await wait(100);
      }

      const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      const maxTime = Math.max(...executionTimes);
      const minTime = Math.min(...executionTimes);

      expect(avgTime).toBeLessThan(5000); // Average should be under 5 seconds
      console.log(`📊 Discovery performance - Avg: ${avgTime.toFixed(0)}ms, Min: ${minTime}ms, Max: ${maxTime}ms`);
    });

    it('should handle concurrent n8n operations efficiently', async () => {
      const operations = [
        () => n8nService.discoverWorkflows(),
        () => n8nService.isReady() ? Promise.resolve({ success: true, data: 'ready' }) : Promise.resolve({ success: false }),
        () => n8nService.discoverWorkflows(), // Duplicate to test caching
      ];

      const promises = Array(6).fill(null).map((_, index) =>
        operations[index % operations.length]()
      );

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // Most operations should succeed (some might fail due to n8n connectivity)
      const successfulResults = results.filter((result: any) => result && result.success);
      expect(successfulResults.length).toBeGreaterThan(0);

      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
      console.log(`📊 ${results.length} concurrent n8n operations: ${totalTime}ms`);
    });

    it('should maintain connection performance over time', async () => {
      const testDuration = 30000; // 30 seconds
      const interval = 2000; // Check every 2 seconds
      const startTime = Date.now();
      const connectionTimes: number[] = [];

      while (Date.now() - startTime < testDuration) {
        const checkStartTime = Date.now();
        const isReady = n8nService.isReady();
        const checkTime = Date.now() - checkStartTime;

        connectionTimes.push(checkTime);

        if (connectionTimes.length % 5 === 0) {
          console.log(`📊 Connection check ${connectionTimes.length}: ${checkTime}ms, Status: ${isReady ? 'ready' : 'not ready'}`);
        }

        await wait(interval);
      }

      const avgConnectionTime = connectionTimes.reduce((a, b) => a + b, 0) / connectionTimes.length;
      expect(avgConnectionTime).toBeLessThan(100); // Connection checks should be very fast
      console.log(`📊 Average connection check time over 30s: ${avgConnectionTime.toFixed(2)}ms`);
    });
  });

  // ===================== ALERT SERVICE PERFORMANCE =====================

  describe('AlertService Performance Tests', () => {
    beforeEach(async () => {
      await createTestExecutions(50);
    });

    it('should handle alert sending efficiently', async () => {
      console.log('🚀 Testing alert service performance...');

      const executions = await WorkflowExecution.findAll({ limit: 10 });
      const executionTimes: number[] = [];

      for (const execution of executions) {
        const startTime = Date.now();

        try {
          const result = await alertService.sendFailureAlert(execution.execution_id);
          const executionTime = Date.now() - startTime;
          executionTimes.push(executionTime);

          console.log(`📊 Alert sent in ${executionTime}ms, Success: ${result.success}`);
        } catch (error) {
          const executionTime = Date.now() - startTime;
          executionTimes.push(executionTime);
          console.log(`📊 Alert failed in ${executionTime}ms`);
        }

        // Brief pause between alerts
        await wait(200);
      }

      const avgTime = executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length;
      expect(avgTime).toBeLessThan(5000); // Average should be under 5 seconds
      console.log(`📊 Average alert sending time: ${avgTime.toFixed(0)}ms`);
    });

    it('should handle concurrent alert operations', async () => {
      const executions = await WorkflowExecution.findAll({ limit: 5 });

      const alertPromises = executions.map(async (execution, index) => {
        // Mix different alert types
        if (index % 2 === 0) {
          return alertService.sendFailureAlert(execution.execution_id);
        } else {
          return alertService.sendSuccessAlert(execution.execution_id);
        }
      });

      const startTime = Date.now();
      const results = await Promise.allSettled(alertPromises);
      const totalTime = Date.now() - startTime;

      const successfulAlerts = results.filter(result => result.status === 'fulfilled').length;
      console.log(`📊 ${successfulAlerts}/${results.length} alerts sent successfully in ${totalTime}ms`);

      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
    });

    it('should handle alert history retrieval efficiently', async () => {
      // Create some alert history
      await createTestAlerts(100);

      const queries = [
        { page: 1, limit: 20 },
        { page: 2, limit: 50 },
        { alertType: 'failure', limit: 30 },
        { resolved: false, limit: 25 },
        { page: 1, limit: 10, alertType: 'success' }
      ];

      for (const [index, query] of queries.entries()) {
        const startTime = Date.now();
        const result = await alertService.getAlertHistory(query);
        const executionTime = Date.now() - startTime;

        expect(result.alerts).toBeDefined();
        expect(result.alerts.length).toBeLessThanOrEqual(query.limit || 20);
        expect(executionTime).toBeLessThan(3000); // Should complete within 3 seconds

        console.log(`📊 Alert history query ${index + 1}: ${executionTime}ms`);
      }
    });
  });

  // ===================== INTEGRATED WORKFLOW PERFORMANCE =====================

  describe('Integrated Workflow Performance Tests', () => {
    beforeEach(async () => {
      await createTestWorkflows(50);
      await createTestExecutions(200);
    });

    it('should handle complete workflow polling cycle efficiently', async () => {
      console.log('🚀 Testing complete workflow polling cycle...');

      const startTime = Date.now();

      // Simulate complete polling cycle
      const workflowsResult = await workflowService.getWorkflows({ active: true });
      expect(workflowsResult.success).toBe(true);

      const dashboardResult = await workflowService.getDashboardMetrics('last24h');
      expect(dashboardResult.success).toBe(true);

      // Simulate checking a few workflows
      const workflows = workflowsResult.data!.slice(0, 5);
      for (const workflow of workflows) {
        const analyticsResult = await workflowService.getWorkflowAnalytics(workflow.workflow_id);
        // Note: This might fail if n8n is not available, but timing is still measured
      }

      const totalTime = Date.now() - startTime;
      expect(totalTime).toBeLessThan(30000); // Complete cycle within 30 seconds

      console.log(`📊 Complete workflow polling cycle: ${totalTime}ms`);
    });

    it('should handle high-frequency polling efficiently', async () => {
      const pollingInterval = 5000; // 5 seconds
      const testDuration = 30000; // 30 seconds
      const startTime = Date.now();
      const pollResults: number[] = [];

      while (Date.now() - startTime < testDuration) {
        const pollStartTime = Date.now();

        // Simulate lightweight polling
        await Promise.all([
          workflowService.getDashboardMetrics('last24h'),
          workflowService.getWorkflows({ page: 1, limit: 10, active: true })
        ]);

        const pollTime = Date.now() - pollStartTime;
        pollResults.push(pollTime);

        console.log(`📊 Poll ${pollResults.length}: ${pollTime}ms`);

        // Wait for next polling interval
        const remainingWait = pollingInterval - pollTime;
        if (remainingWait > 0) {
          await wait(remainingWait);
        }
      }

      const avgPollTime = pollResults.reduce((a, b) => a + b, 0) / pollResults.length;
      const maxPollTime = Math.max(...pollResults);

      expect(avgPollTime).toBeLessThan(3000); // Average poll should be under 3 seconds
      expect(maxPollTime).toBeLessThan(8000); // No single poll should take more than 8 seconds

      console.log(`📊 High-frequency polling - Avg: ${avgPollTime.toFixed(0)}ms, Max: ${maxPollTime}ms, Polls: ${pollResults.length}`);
    });

    it('should maintain performance under resource contention', async () => {
      console.log('🚀 Testing performance under resource contention...');

      // Simulate multiple concurrent processes
      const concurrentOperations = [
        // Dashboard updates
        ...Array(3).fill(null).map(() =>
          workflowService.getDashboardMetrics('last24h')
        ),
        // Workflow queries
        ...Array(3).fill(null).map((_, i) =>
          workflowService.getWorkflows({ page: i + 1, limit: 20 })
        ),
        // Alert operations
        ...Array(2).fill(null).map(async () => {
          const executions = await WorkflowExecution.findAll({ limit: 1 });
          if (executions.length > 0) {
            return alertService.sendFailureAlert(executions[0].execution_id);
          }
          return Promise.resolve({ success: false });
        })
      ];

      const startTime = Date.now();
      const results = await Promise.allSettled(concurrentOperations);
      const totalTime = Date.now() - startTime;

      const successfulOps = results.filter(result => result.status === 'fulfilled').length;
      console.log(`📊 ${successfulOps}/${results.length} operations succeeded under contention in ${totalTime}ms`);

      expect(totalTime).toBeLessThan(20000); // Should complete within 20 seconds
      expect(successfulOps).toBeGreaterThan(results.length * 0.7); // At least 70% should succeed
    });
  });

  // ===================== PERFORMANCE BENCHMARKS AND SLA VALIDATION =====================

  describe('Performance Benchmarks and SLA Validation', () => {
    it('should meet defined performance SLAs', async () => {
      // Define performance SLAs for workflow system
      const SLAs = {
        workflowListing: 3000, // 3 seconds for workflow listing
        dashboardLoad: 5000, // 5 seconds for dashboard metrics
        alertDelivery: 8000, // 8 seconds for alert delivery
        workflowDiscovery: 10000, // 10 seconds for n8n discovery
        concurrentOperations: 15000 // 15 seconds for multiple concurrent ops
      };

      await createTestWorkflows(100);
      await createTestExecutions(100);

      // Test workflow listing SLA
      let startTime = Date.now();
      let result = await workflowService.getWorkflows({ page: 1, limit: 50 });
      let executionTime = Date.now() - startTime;
      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(SLAs.workflowListing);
      console.log(`✅ Workflow listing SLA: ${executionTime}ms < ${SLAs.workflowListing}ms`);

      // Test dashboard SLA
      startTime = Date.now();
      result = await workflowService.getDashboardMetrics('last24h');
      executionTime = Date.now() - startTime;
      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(SLAs.dashboardLoad);
      console.log(`✅ Dashboard load SLA: ${executionTime}ms < ${SLAs.dashboardLoad}ms`);

      // Test n8n discovery SLA
      startTime = Date.now();
      const discoveryResult = await n8nService.discoverWorkflows();
      executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(SLAs.workflowDiscovery);
      console.log(`✅ N8n discovery SLA: ${executionTime}ms < ${SLAs.workflowDiscovery}ms`);

      // Test concurrent operations SLA
      startTime = Date.now();
      const concurrentOps = await Promise.all([
        workflowService.getWorkflows({ page: 1, limit: 20 }),
        workflowService.getDashboardMetrics('last24h'),
        alertService.getAlertHistory({ limit: 10 })
      ]);
      executionTime = Date.now() - startTime;
      concurrentOps.forEach(op => expect(op).toBeDefined());
      expect(executionTime).toBeLessThan(SLAs.concurrentOperations);
      console.log(`✅ Concurrent operations SLA: ${executionTime}ms < ${SLAs.concurrentOperations}ms`);
    });

    it('should establish performance baselines', async () => {
      await createTestWorkflows(100);
      await createTestExecutions(200);

      const baselines = {
        smallWorkflowQuery: 0,
        mediumWorkflowQuery: 0,
        largeWorkflowQuery: 0,
        dashboardMetrics: 0,
        alertHistory: 0
      };

      // Small query baseline (10 workflows)
      let startTime = Date.now();
      await workflowService.getWorkflows({ page: 1, limit: 10 });
      baselines.smallWorkflowQuery = Date.now() - startTime;

      // Medium query baseline (50 workflows)
      startTime = Date.now();
      await workflowService.getWorkflows({ page: 1, limit: 50 });
      baselines.mediumWorkflowQuery = Date.now() - startTime;

      // Large query baseline (100 workflows)
      startTime = Date.now();
      await workflowService.getWorkflows({ page: 1, limit: 100 });
      baselines.largeWorkflowQuery = Date.now() - startTime;

      // Dashboard metrics baseline
      startTime = Date.now();
      await workflowService.getDashboardMetrics('last30d');
      baselines.dashboardMetrics = Date.now() - startTime;

      // Alert history baseline
      startTime = Date.now();
      await alertService.getAlertHistory({ limit: 50 });
      baselines.alertHistory = Date.now() - startTime;

      console.log('📊 Performance Baselines:');
      Object.entries(baselines).forEach(([operation, time]) => {
        console.log(`   ${operation}: ${time}ms`);
      });

      // Verify baselines are reasonable
      expect(baselines.smallWorkflowQuery).toBeLessThan(2000);
      expect(baselines.mediumWorkflowQuery).toBeLessThan(4000);
      expect(baselines.largeWorkflowQuery).toBeLessThan(6000);
      expect(baselines.dashboardMetrics).toBeLessThan(8000);
      expect(baselines.alertHistory).toBeLessThan(3000);
    });
  });

  // ===================== HELPER FUNCTIONS =====================

  async function createTestWorkflows(count: number): Promise<void> {
    const workflows = Array(count).fill(null).map((_, index) => ({
      workflow_id: `test-workflow-${index}`,
      workflow_name: `Test Workflow ${index}`,
      workflow_type: ['vpc', 'subnet', 'transit_gateway'][index % 3] as 'vpc' | 'subnet' | 'transit_gateway',
      provider: ['aws', 'azure', 'gcp'][index % 3] as 'aws' | 'azure' | 'gcp',
      is_active: index % 4 !== 0, // 75% active
      description: `Test workflow ${index} for performance testing`,
      configuration: JSON.stringify({ test: true, index }),
      tags: JSON.stringify(['test', 'performance', `batch-${Math.floor(index / 10)}`]),
      created_at: new Date(Date.now() - (index * 3600000)), // Spread over time
      updated_at: new Date()
    }));

    await WorkflowRegistry.bulkCreate(workflows, { validate: false });
  }

  async function createTestExecutions(count: number): Promise<void> {
    const workflows = await WorkflowRegistry.findAll();
    if (workflows.length === 0) {
      await createTestWorkflows(10);
    }

    const executions = Array(count).fill(null).map((_, index) => ({
      execution_id: `exec-${index}`,
      workflow_id: workflows[index % workflows.length].workflow_id,
      status: ['success', 'failure', 'running', 'cancelled'][index % 4] as 'success' | 'failure' | 'running' | 'cancelled',
      start_time: new Date(Date.now() - (index * 1800000)), // Spread over time
      end_time: index % 4 !== 2 ? new Date(Date.now() - (index * 1800000) + 60000) : null, // Running executions have no end time
      error_message: index % 4 === 1 ? `Test error ${index}` : null,
      input_data: JSON.stringify({ test: true, index }),
      output_data: index % 4 === 0 ? JSON.stringify({ result: 'success', index }) : null
    }));

    await WorkflowExecution.bulkCreate(executions, { validate: false });
  }

  async function createTestAlerts(count: number): Promise<void> {
    const executions = await WorkflowExecution.findAll();
    if (executions.length === 0) {
      await createTestExecutions(50);
    }

    const alerts = Array(count).fill(null).map((_, index) => ({
      alert_id: `alert-${index}`,
      execution_id: executions[index % executions.length].execution_id,
      alert_type: ['failure', 'success', 'warning'][index % 3] as 'failure' | 'success' | 'warning',
      message: `Test alert ${index}`,
      severity: ['low', 'medium', 'high', 'critical'][index % 4] as 'low' | 'medium' | 'high' | 'critical',
      is_resolved: index % 3 === 0,
      created_at: new Date(Date.now() - (index * 900000)), // Spread over time
      resolved_at: index % 3 === 0 ? new Date(Date.now() - (index * 900000) + 300000) : null
    }));

    await WorkflowAlert.bulkCreate(alerts, { validate: false });
  }
});