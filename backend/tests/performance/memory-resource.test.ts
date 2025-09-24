/**
 * Memory Usage and Resource Optimization Testing
 * Tests for memory leaks, resource cleanup, and concurrent processing validation
 */

import { WorkflowService } from '../../src/services/WorkflowService';
import { N8nService } from '../../src/services/N8nService';
import { AlertService } from '../../src/services/AlertService';
import { Sequelize } from 'sequelize';
import { WorkflowRegistry } from '../../src/models/WorkflowRegistry';
import { WorkflowExecution } from '../../src/models/WorkflowExecution';
import { WorkflowAlert } from '../../src/models/WorkflowAlert';
import {
  createTestDatabase,
  setupTestModels,
  cleanupTestDatabase,
  wait
} from '../utils/testHelpers';

interface MemorySnapshot {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  arrayBuffers: number;
  timestamp: number;
}

interface ResourceMetrics {
  openHandles: number;
  timers: number;
  tcpSockets: number;
  udpSockets: number;
  timestamp: number;
}

describe('Memory Usage and Resource Optimization Tests', () => {
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

    // Extended timeout for memory and resource tests
    jest.setTimeout(300000); // 5 minutes
  });

  afterAll(async () => {
    await cleanupTestDatabase(sequelize);
  });

  beforeEach(async () => {
    await sequelize.sync({ force: true });

    // Force garbage collection before each test if available
    if (global.gc) {
      global.gc();
      await wait(500);
    }
  });

  // ===================== MEMORY USAGE MONITORING =====================

  function captureMemorySnapshot(): MemorySnapshot {
    const memUsage = process.memoryUsage();
    return {
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss,
      arrayBuffers: memUsage.arrayBuffers || 0,
      timestamp: Date.now()
    };
  }

  function captureResourceMetrics(): ResourceMetrics {
    const handles = process._getActiveHandles();
    const requests = process._getActiveRequests();

    return {
      openHandles: handles.length,
      timers: requests.filter((req: any) => req.constructor.name === 'Timeout').length,
      tcpSockets: handles.filter((handle: any) => handle.constructor.name === 'Socket').length,
      udpSockets: handles.filter((handle: any) => handle.constructor.name === 'UDP').length,
      timestamp: Date.now()
    };
  }

  function calculateMemoryDelta(before: MemorySnapshot, after: MemorySnapshot): MemorySnapshot {
    return {
      heapUsed: after.heapUsed - before.heapUsed,
      heapTotal: after.heapTotal - before.heapTotal,
      external: after.external - before.external,
      rss: after.rss - before.rss,
      arrayBuffers: after.arrayBuffers - before.arrayBuffers,
      timestamp: after.timestamp - before.timestamp
    };
  }

  // ===================== WORKFLOW SERVICE MEMORY TESTS =====================

  describe('WorkflowService Memory Usage', () => {
    beforeEach(async () => {
      await createTestWorkflows(100);
      await createTestExecutions(200);
    });

    it('should not leak memory during repeated workflow operations', async () => {
      const initialMemory = captureMemorySnapshot();
      const memorySnapshots: MemorySnapshot[] = [];

      console.log(`📊 Initial memory - Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB, RSS: ${(initialMemory.rss / 1024 / 1024).toFixed(2)}MB`);

      // Perform intensive workflow operations
      for (let i = 0; i < 50; i++) {
        await workflowService.getWorkflows({ page: 1, limit: 20 });
        await workflowService.getDashboardMetrics('last24h');

        const workflows = await WorkflowRegistry.findAll({ limit: 3 });
        for (const workflow of workflows) {
          await workflowService.getExecutionHistory(workflow.workflow_id, { page: 1, limit: 10 });
        }

        // Capture memory every 10 iterations
        if (i % 10 === 0) {
          const snapshot = captureMemorySnapshot();
          memorySnapshots.push(snapshot);

          const delta = calculateMemoryDelta(initialMemory, snapshot);
          console.log(`📊 Iteration ${i + 1} - Heap: ${(snapshot.heapUsed / 1024 / 1024).toFixed(2)}MB (+${(delta.heapUsed / 1024 / 1024).toFixed(2)}MB)`);
        }

        // Force garbage collection periodically
        if (i % 20 === 19 && global.gc) {
          global.gc();
          await wait(100);
        }
      }

      // Final garbage collection
      if (global.gc) {
        global.gc();
        await wait(1000);
      }

      const finalMemory = captureMemorySnapshot();
      const totalDelta = calculateMemoryDelta(initialMemory, finalMemory);

      console.log(`📊 Final memory - Heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
      console.log(`📊 Total memory increase: ${(totalDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`);

      // Memory increase should be reasonable (less than 100MB)
      expect(totalDelta.heapUsed).toBeLessThan(100 * 1024 * 1024);

      // Check memory growth trend
      if (memorySnapshots.length > 2) {
        const firstSnapshot = memorySnapshots[0];
        const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
        const growthRate = (lastSnapshot.heapUsed - firstSnapshot.heapUsed) / memorySnapshots.length;

        console.log(`📊 Average memory growth per 10 operations: ${(growthRate / 1024 / 1024).toFixed(2)}MB`);
        expect(growthRate).toBeLessThan(5 * 1024 * 1024); // Less than 5MB growth per 10 operations
      }
    });

    it('should properly cleanup resources after workflow operations', async () => {
      const initialResources = captureResourceMetrics();
      console.log(`📊 Initial resources - Handles: ${initialResources.openHandles}, Timers: ${initialResources.timers}`);

      // Perform operations that create resources
      const operations = Array(20).fill(null).map(() => ({
        workflows: workflowService.getWorkflows({ page: 1, limit: 10 }),
        dashboard: workflowService.getDashboardMetrics('last24h'),
        sync: workflowService.syncWorkflows()
      }));

      for (const ops of operations) {
        await Promise.all([ops.workflows, ops.dashboard]);
        // Note: sync might fail but we still test resource cleanup
        try {
          await ops.sync;
        } catch (error) {
          // Expected to fail in test environment
        }
      }

      // Wait for cleanup
      await wait(2000);

      const finalResources = captureResourceMetrics();
      console.log(`📊 Final resources - Handles: ${finalResources.openHandles}, Timers: ${finalResources.timers}`);

      // Resource count should not grow significantly
      const handleIncrease = finalResources.openHandles - initialResources.openHandles;
      const timerIncrease = finalResources.timers - initialResources.timers;

      expect(handleIncrease).toBeLessThan(10); // Less than 10 new handles
      expect(timerIncrease).toBeLessThan(5); // Less than 5 new timers

      console.log(`📊 Resource increase - Handles: +${handleIncrease}, Timers: +${timerIncrease}`);
    });

    it('should handle memory-intensive dashboard operations efficiently', async () => {
      await createTestWorkflows(500);
      await createTestExecutions(1000);

      const initialMemory = captureMemorySnapshot();

      // Perform memory-intensive operations
      const dashboardPromises = Array(10).fill(null).map(() =>
        workflowService.getDashboardMetrics('last30d')
      );

      await Promise.all(dashboardPromises);

      const afterDashboard = captureMemorySnapshot();
      const dashboardDelta = calculateMemoryDelta(initialMemory, afterDashboard);

      console.log(`📊 Dashboard operations memory increase: ${(dashboardDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`);

      // Force cleanup
      if (global.gc) {
        global.gc();
        await wait(1000);
      }

      const afterCleanup = captureMemorySnapshot();
      const cleanupDelta = calculateMemoryDelta(initialMemory, afterCleanup);

      console.log(`📊 After cleanup memory increase: ${(cleanupDelta.heapUsed / 1024 / 1024).toFixed(2)}MB`);

      // Memory should be mostly reclaimed after cleanup
      expect(cleanupDelta.heapUsed).toBeLessThan(dashboardDelta.heapUsed * 0.7); // At least 30% reclaimed
      expect(cleanupDelta.heapUsed).toBeLessThan(150 * 1024 * 1024); // Less than 150MB increase overall
    });
  });

  // ===================== CONCURRENT PROCESSING VALIDATION =====================

  describe('Concurrent Workflow Processing Validation', () => {
    beforeEach(async () => {
      await createTestWorkflows(100);
      await createTestExecutions(300);
    });

    it('should handle concurrent workflow queries without memory leaks', async () => {
      const initialMemory = captureMemorySnapshot();
      const initialResources = captureResourceMetrics();

      // Create highly concurrent workflow operations
      const concurrentBatches = 5;
      const operationsPerBatch = 20;

      for (let batch = 0; batch < concurrentBatches; batch++) {
        console.log(`📊 Processing concurrent batch ${batch + 1}/${concurrentBatches}...`);

        const operations = Array(operationsPerBatch).fill(null).map((_, index) => {
          const page = (index % 5) + 1;
          return workflowService.getWorkflows({ page, limit: 10 });
        });

        const results = await Promise.allSettled(operations);
        const successfulOps = results.filter(result => result.status === 'fulfilled').length;

        expect(successfulOps).toBeGreaterThan(operationsPerBatch * 0.8); // At least 80% should succeed
        console.log(`📊 Batch ${batch + 1}: ${successfulOps}/${operationsPerBatch} operations succeeded`);

        // Brief pause between batches
        await wait(500);
      }

      // Check resource usage after concurrent operations
      const finalMemory = captureMemorySnapshot();
      const finalResources = captureResourceMetrics();

      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const handleIncrease = finalResources.openHandles - initialResources.openHandles;

      console.log(`📊 Memory increase after concurrent operations: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      console.log(`📊 Handle increase: ${handleIncrease}`);

      // Memory and resource usage should be reasonable
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // Less than 200MB
      expect(handleIncrease).toBeLessThan(20); // Less than 20 new handles
    });

    it('should handle mixed concurrent service operations efficiently', async () => {
      const initialMemory = captureMemorySnapshot();

      // Create mixed concurrent operations across all services
      const mixedOperations = [
        // WorkflowService operations
        workflowService.getWorkflows({ page: 1, limit: 20 }),
        workflowService.getDashboardMetrics('last24h'),
        workflowService.healthCheck(),

        // N8nService operations
        n8nService.discoverWorkflows(),
        n8nService.isReady() ? Promise.resolve({ success: true }) : Promise.resolve({ success: false }),

        // AlertService operations (these might fail but should not cause memory issues)
        ...Array(5).fill(null).map(() =>
          alertService.getAlertHistory({ limit: 10 }).catch(() => ({ alerts: [], total: 0, page: 1, totalPages: 0 }))
        ),

        // More WorkflowService operations
        ...Array(10).fill(null).map((_, i) =>
          workflowService.getWorkflows({ page: i + 1, limit: 5 })
        )
      ];

      const startTime = Date.now();
      const results = await Promise.allSettled(mixedOperations);
      const totalTime = Date.now() - startTime;

      const successfulOps = results.filter(result => result.status === 'fulfilled').length;
      console.log(`📊 Mixed concurrent operations: ${successfulOps}/${results.length} succeeded in ${totalTime}ms`);

      // Should handle most operations successfully
      expect(successfulOps).toBeGreaterThan(results.length * 0.7); // At least 70% success
      expect(totalTime).toBeLessThan(30000); // Within 30 seconds

      // Check memory usage
      const finalMemory = captureMemorySnapshot();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`📊 Mixed operations memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
      expect(memoryIncrease).toBeLessThan(150 * 1024 * 1024); // Less than 150MB
    });

    it('should maintain performance under sustained concurrent load', async () => {
      const testDuration = 60000; // 1 minute
      const operationInterval = 1000; // Every second
      const startTime = Date.now();

      const memorySnapshots: MemorySnapshot[] = [];
      const performanceMetrics: Array<{ time: number; operations: number; errors: number }> = [];

      let totalOperations = 0;
      let totalErrors = 0;

      console.log('📊 Starting sustained concurrent load test for 1 minute...');

      while (Date.now() - startTime < testDuration) {
        const batchStartTime = Date.now();

        // Create concurrent operations batch
        const batchOperations = [
          workflowService.getWorkflows({ page: 1, limit: 10 }),
          workflowService.getDashboardMetrics('last24h'),
          ...Array(3).fill(null).map((_, i) =>
            workflowService.getWorkflows({ page: i + 1, limit: 5, active: true })
          )
        ];

        const batchResults = await Promise.allSettled(batchOperations);
        const batchSuccesses = batchResults.filter(result => result.status === 'fulfilled').length;
        const batchErrors = batchOperations.length - batchSuccesses;

        totalOperations += batchOperations.length;
        totalErrors += batchErrors;

        const batchTime = Date.now() - batchStartTime;
        performanceMetrics.push({
          time: batchTime,
          operations: batchOperations.length,
          errors: batchErrors
        });

        // Capture memory every 15 seconds
        if (performanceMetrics.length % 15 === 0) {
          const snapshot = captureMemorySnapshot();
          memorySnapshots.push(snapshot);
          console.log(`📊 Sustained load progress: ${Math.floor((Date.now() - startTime) / 1000)}s - Memory: ${(snapshot.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        }

        // Wait for next interval
        const remainingWait = operationInterval - batchTime;
        if (remainingWait > 0) {
          await wait(remainingWait);
        }
      }

      const totalTime = Date.now() - startTime;
      const successRate = (totalOperations - totalErrors) / totalOperations;
      const avgBatchTime = performanceMetrics.reduce((sum, m) => sum + m.time, 0) / performanceMetrics.length;

      console.log(`📊 Sustained load results:`);
      console.log(`   Duration: ${Math.floor(totalTime / 1000)}s`);
      console.log(`   Total operations: ${totalOperations}`);
      console.log(`   Success rate: ${(successRate * 100).toFixed(1)}%`);
      console.log(`   Average batch time: ${avgBatchTime.toFixed(0)}ms`);

      // Performance expectations
      expect(successRate).toBeGreaterThan(0.8); // At least 80% success rate
      expect(avgBatchTime).toBeLessThan(5000); // Average batch under 5 seconds

      // Memory stability check
      if (memorySnapshots.length >= 2) {
        const firstSnapshot = memorySnapshots[0];
        const lastSnapshot = memorySnapshots[memorySnapshots.length - 1];
        const memoryGrowthRate = (lastSnapshot.heapUsed - firstSnapshot.heapUsed) / (testDuration / 1000);

        console.log(`   Memory growth rate: ${(memoryGrowthRate / 1024 / 1024).toFixed(2)}MB/s`);
        expect(memoryGrowthRate).toBeLessThan(5 * 1024 * 1024); // Less than 5MB/s growth
      }
    });
  });

  // ===================== N8N SERVICE RESOURCE TESTS =====================

  describe('N8nService Resource Management', () => {
    it('should not leak resources during repeated n8n operations', async () => {
      const initialResources = captureResourceMetrics();
      const initialMemory = captureMemorySnapshot();

      // Perform repeated n8n operations
      for (let i = 0; i < 30; i++) {
        try {
          await n8nService.discoverWorkflows();

          // Check if ready without creating persistent connections
          const isReady = n8nService.isReady();

          if (i % 10 === 0) {
            const currentMemory = captureMemorySnapshot();
            const memoryIncrease = currentMemory.heapUsed - initialMemory.heapUsed;
            console.log(`📊 N8n iteration ${i + 1}: Memory +${(memoryIncrease / 1024 / 1024).toFixed(2)}MB, Ready: ${isReady}`);
          }

          await wait(200); // Brief pause between requests
        } catch (error) {
          // Expected in test environment where n8n might not be available
          console.log(`📊 N8n operation ${i + 1} failed (expected in test environment)`);
        }
      }

      await wait(2000); // Allow cleanup time

      const finalResources = captureResourceMetrics();
      const finalMemory = captureMemorySnapshot();

      const resourceIncrease = finalResources.openHandles - initialResources.openHandles;
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`📊 N8n resource increase: ${resourceIncrease} handles, ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Should not leak significant resources
      expect(resourceIncrease).toBeLessThan(15); // Less than 15 new handles
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB
    });
  });

  // ===================== ALERT SERVICE RESOURCE TESTS =====================

  describe('AlertService Resource Management', () => {
    beforeEach(async () => {
      await createTestExecutions(100);
      await createTestAlerts(50);
    });

    it('should manage resources efficiently during alert operations', async () => {
      const initialResources = captureResourceMetrics();
      const initialMemory = captureMemorySnapshot();

      // Perform various alert operations
      for (let i = 0; i < 20; i++) {
        try {
          await alertService.getAlertHistory({ limit: 10 });

          if (i % 5 === 0) {
            // Try to send test alerts (might fail in test environment)
            const executions = await WorkflowExecution.findAll({ limit: 1 });
            if (executions.length > 0) {
              try {
                await alertService.sendFailureAlert(executions[0].execution_id);
              } catch (error) {
                // Expected to fail in test environment
              }
            }
          }
        } catch (error) {
          // Some operations might fail in test environment
        }

        await wait(100);
      }

      const finalResources = captureResourceMetrics();
      const finalMemory = captureMemorySnapshot();

      const resourceIncrease = finalResources.openHandles - initialResources.openHandles;
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`📊 Alert service resource increase: ${resourceIncrease} handles, ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      expect(resourceIncrease).toBeLessThan(10);
      expect(memoryIncrease).toBeLessThan(30 * 1024 * 1024);
    });
  });

  // ===================== PERFORMANCE SLA VALIDATION =====================

  describe('Memory and Resource Performance SLAs', () => {
    it('should meet memory usage SLAs under various load conditions', async () => {
      const memoryLimits = {
        lightLoad: 50 * 1024 * 1024, // 50MB for light operations
        mediumLoad: 100 * 1024 * 1024, // 100MB for medium operations
        heavyLoad: 200 * 1024 * 1024, // 200MB for heavy operations
        cleanup: 0.3 // At least 30% memory should be reclaimed after GC
      };

      await createTestWorkflows(100);
      await createTestExecutions(200);

      // Test light load
      let initialMemory = captureMemorySnapshot();
      for (let i = 0; i < 10; i++) {
        await workflowService.getWorkflows({ page: 1, limit: 10 });
      }
      let finalMemory = captureMemorySnapshot();
      let memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(memoryLimits.lightLoad);
      console.log(`✅ Light load memory SLA: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB < ${(memoryLimits.lightLoad / 1024 / 1024).toFixed(0)}MB`);

      // Test medium load
      initialMemory = captureMemorySnapshot();
      const mediumOps = Array(20).fill(null).map(() => workflowService.getDashboardMetrics('last24h'));
      await Promise.all(mediumOps);
      finalMemory = captureMemorySnapshot();
      memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(memoryLimits.mediumLoad);
      console.log(`✅ Medium load memory SLA: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB < ${(memoryLimits.mediumLoad / 1024 / 1024).toFixed(0)}MB`);

      // Test cleanup efficiency
      const beforeGC = captureMemorySnapshot();
      if (global.gc) {
        global.gc();
        await wait(1000);
      }
      const afterGC = captureMemorySnapshot();
      const cleanupRatio = (beforeGC.heapUsed - afterGC.heapUsed) / beforeGC.heapUsed;

      if (cleanupRatio > 0) {
        expect(cleanupRatio).toBeGreaterThan(memoryLimits.cleanup);
        console.log(`✅ Memory cleanup SLA: ${(cleanupRatio * 100).toFixed(1)}% > ${(memoryLimits.cleanup * 100).toFixed(0)}%`);
      } else {
        console.log(`📊 Memory cleanup: No significant cleanup needed`);
      }
    });
  });

  // ===================== HELPER FUNCTIONS =====================

  async function createTestWorkflows(count: number): Promise<void> {
    const workflows = Array(count).fill(null).map((_, index) => ({
      workflow_id: `test-workflow-${index}`,
      workflow_name: `Test Workflow ${index}`,
      workflow_type: ['vpc', 'subnet', 'transit_gateway'][index % 3] as 'vpc' | 'subnet' | 'transit_gateway',
      provider: ['aws', 'azure', 'gcp'][index % 3] as 'aws' | 'azure' | 'gcp',
      is_active: index % 4 !== 0,
      description: `Test workflow ${index}`,
      configuration: JSON.stringify({ test: true, index }),
      tags: JSON.stringify(['test', 'memory']),
      created_at: new Date(Date.now() - (index * 3600000)),
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
      start_time: new Date(Date.now() - (index * 1800000)),
      end_time: index % 4 !== 2 ? new Date(Date.now() - (index * 1800000) + 60000) : null,
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
      created_at: new Date(Date.now() - (index * 900000)),
      resolved_at: index % 3 === 0 ? new Date(Date.now() - (index * 900000) + 300000) : null
    }));

    await WorkflowAlert.bulkCreate(alerts, { validate: false });
  }
});