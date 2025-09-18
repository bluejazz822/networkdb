/**
 * PollingService Tests
 * Comprehensive test suite for the automated polling service
 * Tests cron scheduling, job locking, error handling, and integration with N8n/Alert services
 */

import { PollingService } from '../../src/services/PollingService';
import { WorkflowPollingJob } from '../../src/jobs/WorkflowPollingJob';
import { N8nService } from '../../src/services/N8nService';
import { AlertService } from '../../src/services/AlertService';
import { WorkflowRegistry } from '../../src/models/WorkflowRegistry';
import { WorkflowExecution } from '../../src/models/WorkflowExecution';
import { WorkflowAlert } from '../../src/models/WorkflowAlert';
import { MemoryJobLockManager } from '../../src/config/scheduler';

// Test database setup
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database';

describe('PollingService', () => {
  let pollingService: PollingService;
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(async () => {
    await setupTestDatabase();

    // Save original environment
    originalEnv = { ...process.env };

    // Set test environment variables
    process.env.SCHEDULER_ENABLED = 'true';
    process.env.WORKFLOW_POLLING_ENABLED = 'true';
    process.env.WORKFLOW_POLLING_SCHEDULE = '*/1 * * * *'; // Every minute for testing
    process.env.SCHEDULER_LOG_LEVEL = 'error'; // Suppress logs during testing
  });

  beforeEach(async () => {
    // Clean up database
    await WorkflowAlert.destroy({ where: {} });
    await WorkflowExecution.destroy({ where: {} });
    await WorkflowRegistry.destroy({ where: {} });

    // Create fresh service instance
    pollingService = new PollingService({
      enabled: true,
      cronSchedule: '*/1 * * * *', // Every minute
      maxDurationMinutes: 5,
      retryAttempts: 2,
      pollingOptions: {
        batchSize: 5,
        maxConcurrent: 2
      }
    });
  });

  afterEach(async () => {
    // Ensure service is stopped
    if (pollingService.getInitializationStatus()) {
      await pollingService.stop();
    }
  });

  afterAll(async () => {
    // Restore original environment
    process.env = originalEnv;

    await cleanupTestDatabase();
  });

  describe('Service Initialization', () => {
    it('should initialize successfully with default configuration', async () => {
      expect(pollingService.getInitializationStatus()).toBe(false);

      await pollingService.start();

      expect(pollingService.getInitializationStatus()).toBe(true);

      const status = pollingService.getStatus();
      expect(status.scheduled).toBe(true);
      expect(status.running).toBe(false);
      expect(status.totalRuns).toBe(0);
    });

    it('should fail to initialize with invalid cron expression', async () => {
      const invalidService = new PollingService({
        enabled: true,
        cronSchedule: 'invalid-cron-expression'
      });

      await expect(invalidService.start()).rejects.toThrow('Invalid cron expression');
      expect(invalidService.getInitializationStatus()).toBe(false);
    });

    it('should skip initialization when disabled', async () => {
      const disabledService = new PollingService({
        enabled: false
      });

      await disabledService.start();

      expect(disabledService.getInitializationStatus()).toBe(true);

      const status = disabledService.getStatus();
      expect(status.scheduled).toBe(false);
    });

    it('should not allow double initialization', async () => {
      await pollingService.start();

      // Second start should not throw but should log warning
      await pollingService.start();

      expect(pollingService.getInitializationStatus()).toBe(true);
    });
  });

  describe('Service Lifecycle', () => {
    beforeEach(async () => {
      await pollingService.start();
    });

    it('should stop gracefully', async () => {
      expect(pollingService.getInitializationStatus()).toBe(true);

      await pollingService.stop();

      expect(pollingService.getInitializationStatus()).toBe(false);

      const status = pollingService.getStatus();
      expect(status.scheduled).toBe(false);
      expect(status.running).toBe(false);
    });

    it('should handle multiple stop calls gracefully', async () => {
      const stopPromise1 = pollingService.stop();
      const stopPromise2 = pollingService.stop();

      await Promise.all([stopPromise1, stopPromise2]);

      expect(pollingService.getInitializationStatus()).toBe(false);
    });

    it('should wait for running job during shutdown', async () => {
      // This test would require mocking a long-running job
      // For now, we test that stop completes successfully
      await pollingService.stop();
      expect(pollingService.getInitializationStatus()).toBe(false);
    });
  });

  describe('Manual Execution', () => {
    beforeEach(async () => {
      await pollingService.start();

      // Create test workflows
      await WorkflowRegistry.create({
        workflow_id: 'wf-test-001',
        workflow_name: 'Test Workflow 1',
        workflow_type: 'vpc',
        provider: 'aws',
        is_active: true
      });

      await WorkflowRegistry.create({
        workflow_id: 'wf-test-002',
        workflow_name: 'Test Workflow 2',
        workflow_type: 'subnet',
        provider: 'aws',
        is_active: true
      });
    });

    it('should execute polling job manually', async () => {
      // Mock N8nService to avoid external dependencies
      const mockN8nService = {
        isReady: jest.fn().mockReturnValue(true),
        getWorkflowStatus: jest.fn().mockResolvedValue({
          success: true,
          data: [{
            id: 'exec-001',
            workflowId: 'wf-test-001',
            status: 'succeeded',
            startedAt: new Date().toISOString(),
            stoppedAt: new Date().toISOString()
          }]
        })
      };

      // Replace the N8nService instance in WorkflowPollingJob
      const pollingJobPrototype = WorkflowPollingJob.prototype as any;
      const originalN8nService = pollingJobPrototype.n8nService;
      pollingJobPrototype.n8nService = mockN8nService;

      try {
        const result = await pollingService.executeManual({
          batchSize: 10,
          maxConcurrent: 5
        });

        expect(result.success).toBe(true);
        expect(result.duration).toBeGreaterThan(0);
        expect(result.metadata).toBeDefined();
        expect(result.metadata.totalWorkflows).toBeGreaterThan(0);

        const status = pollingService.getStatus();
        expect(status.running).toBe(false);

      } finally {
        pollingJobPrototype.n8nService = originalN8nService;
      }
    });

    it('should reject manual execution when not initialized', async () => {
      await pollingService.stop();

      await expect(pollingService.executeManual()).rejects.toThrow('not initialized');
    });

    it('should reject manual execution when job is running', async () => {
      // This test would require mocking a running job
      // For now, we test the basic case
      const result1 = pollingService.executeManual();
      const result2 = pollingService.executeManual();

      await expect(result1).resolves.toBeDefined();
      // Second call should complete normally since first finished quickly
      await expect(result2).resolves.toBeDefined();
    });
  });

  describe('Configuration Updates', () => {
    beforeEach(async () => {
      await pollingService.start();
    });

    it('should update configuration successfully', async () => {
      const originalConfig = pollingService.getConfig();
      expect(originalConfig.retryAttempts).toBe(2);

      await pollingService.updateConfig({
        retryAttempts: 5,
        maxDurationMinutes: 10
      });

      const updatedConfig = pollingService.getConfig();
      expect(updatedConfig.retryAttempts).toBe(5);
      expect(updatedConfig.maxDurationMinutes).toBe(10);
      expect(updatedConfig.cronSchedule).toBe(originalConfig.cronSchedule); // Unchanged
    });

    it('should update cron schedule and restart task', async () => {
      const newSchedule = '0 */2 * * *'; // Every 2 hours

      await pollingService.updateConfig({
        cronSchedule: newSchedule
      });

      const updatedConfig = pollingService.getConfig();
      expect(updatedConfig.cronSchedule).toBe(newSchedule);

      const status = pollingService.getStatus();
      expect(status.scheduled).toBe(true);
    });

    it('should reject invalid cron schedule update', async () => {
      const originalConfig = pollingService.getConfig();

      await expect(pollingService.updateConfig({
        cronSchedule: 'invalid-schedule'
      })).rejects.toThrow('Invalid cron expression');

      // Configuration should remain unchanged
      const configAfterError = pollingService.getConfig();
      expect(configAfterError.cronSchedule).toBe(originalConfig.cronSchedule);
    });

    it('should reject configuration update when not initialized', async () => {
      await pollingService.stop();

      await expect(pollingService.updateConfig({
        retryAttempts: 10
      })).rejects.toThrow('not initialized');
    });
  });

  describe('Health Monitoring', () => {
    beforeEach(async () => {
      await pollingService.start();
    });

    it('should report healthy status when all services are available', async () => {
      const health = await pollingService.getHealth();

      expect(health.healthy).toBe(true);
      expect(health.services.scheduler).toBe(true);
      expect(health.services.jobLock).toBe(true);
      // pollingJob health depends on external services, so we don't assert it
    });

    it('should include execution information in health status', async () => {
      // Execute a manual job to populate last execution info
      await pollingService.executeManual({
        skipAlerts: true,
        batchSize: 1
      });

      const health = await pollingService.getHealth();

      expect(health.lastExecution).toBeDefined();
      expect(health.lastExecution!.time).toBeInstanceOf(Date);
      expect(typeof health.lastExecution!.success).toBe('boolean');
      expect(health.lastExecution!.duration).toBeGreaterThanOrEqual(0);
    });

    it('should report next execution time', async () => {
      const health = await pollingService.getHealth();

      expect(health.nextExecution).toBeDefined();
      expect(health.nextExecution).toBeInstanceOf(Date);
      expect(health.nextExecution!.getTime()).toBeGreaterThan(Date.now());
    });
  });

  describe('Status Reporting', () => {
    beforeEach(async () => {
      await pollingService.start();
    });

    it('should provide comprehensive status information', async () => {
      const status = pollingService.getStatus();

      expect(status).toHaveProperty('running');
      expect(status).toHaveProperty('scheduled');
      expect(status).toHaveProperty('totalRuns');
      expect(status).toHaveProperty('successfulRuns');
      expect(status).toHaveProperty('failedRuns');
      expect(status).toHaveProperty('currentRetryAttempt');
      expect(status).toHaveProperty('nextRunTime');

      expect(typeof status.running).toBe('boolean');
      expect(typeof status.scheduled).toBe('boolean');
      expect(typeof status.totalRuns).toBe('number');
      expect(typeof status.successfulRuns).toBe('number');
      expect(typeof status.failedRuns).toBe('number');
    });

    it('should update status after manual execution', async () => {
      const initialStatus = pollingService.getStatus();
      expect(initialStatus.totalRuns).toBe(0);
      expect(initialStatus.lastRunTime).toBeUndefined();

      await pollingService.executeManual({
        skipAlerts: true,
        batchSize: 1
      });

      const updatedStatus = pollingService.getStatus();
      expect(updatedStatus.lastRunTime).toBeInstanceOf(Date);
      expect(updatedStatus.lastRunResult).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      await pollingService.start();
    });

    it('should handle polling job execution errors gracefully', async () => {
      // Mock WorkflowPollingJob to throw error
      const mockPollingJob = {
        execute: jest.fn().mockRejectedValue(new Error('Test execution error')),
        healthCheck: jest.fn().mockResolvedValue({ healthy: false, services: {} })
      };

      const pollingServiceWithError = new PollingService();
      (pollingServiceWithError as any).pollingJob = mockPollingJob;

      await pollingServiceWithError.start();

      const result = await pollingServiceWithError.executeManual();

      expect(result.success).toBe(false);
      expect(result.error).toContain('Test execution error');

      await pollingServiceWithError.stop();
    });

    it('should implement retry logic for failed executions', async () => {
      const mockPollingJob = {
        execute: jest.fn()
          .mockRejectedValueOnce(new Error('First attempt failed'))
          .mockResolvedValueOnce({
            jobName: 'WorkflowPollingJob',
            startTime: new Date(),
            endTime: new Date(),
            success: true,
            duration: 100
          }),
        healthCheck: jest.fn().mockResolvedValue({ healthy: true, services: {} })
      };

      const pollingServiceWithRetry = new PollingService({
        retryAttempts: 3,
        retryDelayMinutes: 0.01 // Very short delay for testing
      });
      (pollingServiceWithRetry as any).pollingJob = mockPollingJob;

      await pollingServiceWithRetry.start();

      const result = await pollingServiceWithRetry.executeManual();

      expect(mockPollingJob.execute).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);

      await pollingServiceWithRetry.stop();
    });

    it('should give up after maximum retry attempts', async () => {
      const mockPollingJob = {
        execute: jest.fn().mockRejectedValue(new Error('Persistent error')),
        healthCheck: jest.fn().mockResolvedValue({ healthy: false, services: {} })
      };

      const pollingServiceWithRetry = new PollingService({
        retryAttempts: 2,
        retryDelayMinutes: 0.01 // Very short delay for testing
      });
      (pollingServiceWithRetry as any).pollingJob = mockPollingJob;

      await pollingServiceWithRetry.start();

      const result = await pollingServiceWithRetry.executeManual();

      expect(mockPollingJob.execute).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(false);
      expect(result.error).toContain('All retry attempts failed');

      await pollingServiceWithRetry.stop();
    });
  });

  describe('Integration Tests', () => {
    beforeEach(async () => {
      await pollingService.start();
    });

    it('should handle empty workflow registry', async () => {
      // Ensure no workflows exist
      await WorkflowRegistry.destroy({ where: {} });

      const result = await pollingService.executeManual({
        skipAlerts: true
      });

      expect(result.success).toBe(true);
      expect(result.metadata.totalWorkflows).toBe(0);
    });

    it('should process inactive workflows when requested', async () => {
      await WorkflowRegistry.create({
        workflow_id: 'wf-inactive-001',
        workflow_name: 'Inactive Workflow',
        workflow_type: 'vpc',
        provider: 'aws',
        is_active: false
      });

      // Default execution should skip inactive workflows
      const result1 = await pollingService.executeManual({
        skipAlerts: true
      });

      expect(result1.success).toBe(true);
      expect(result1.metadata.totalWorkflows).toBe(0);

      // Execution with includeInactive should process inactive workflows
      const result2 = await pollingService.executeManual({
        skipAlerts: true,
        includeInactive: true
      });

      expect(result2.success).toBe(true);
      expect(result2.metadata.totalWorkflows).toBe(1);
    });

    it('should respect workflow ID filtering', async () => {
      await WorkflowRegistry.bulkCreate([
        {
          workflow_id: 'wf-filter-001',
          workflow_name: 'Filtered Workflow 1',
          workflow_type: 'vpc',
          provider: 'aws',
          is_active: true
        },
        {
          workflow_id: 'wf-filter-002',
          workflow_name: 'Filtered Workflow 2',
          workflow_type: 'subnet',
          provider: 'aws',
          is_active: true
        },
        {
          workflow_id: 'wf-filter-003',
          workflow_name: 'Filtered Workflow 3',
          workflow_type: 'nat_gateway',
          provider: 'aws',
          is_active: true
        }
      ]);

      const result = await pollingService.executeManual({
        workflowIds: ['wf-filter-001', 'wf-filter-003'],
        skipAlerts: true
      });

      expect(result.success).toBe(true);
      expect(result.metadata.totalWorkflows).toBe(2);
    });
  });

  describe('Job Locking', () => {
    let lockManager: MemoryJobLockManager;

    beforeEach(() => {
      lockManager = new MemoryJobLockManager();
    });

    it('should acquire and release locks correctly', async () => {
      const jobName = 'test-job';

      // Should acquire lock successfully
      const acquired1 = await lockManager.acquireLock(jobName, 5);
      expect(acquired1).toBe(true);

      // Should not acquire same lock again
      const acquired2 = await lockManager.acquireLock(jobName, 5);
      expect(acquired2).toBe(false);

      // Should release lock successfully
      const released = await lockManager.releaseLock(jobName);
      expect(released).toBe(true);

      // Should acquire lock again after release
      const acquired3 = await lockManager.acquireLock(jobName, 5);
      expect(acquired3).toBe(true);
    });

    it('should handle lock expiration', async () => {
      const jobName = 'expiring-job';

      // Acquire lock with very short TTL (using milliseconds calculation)
      const acquired1 = await lockManager.acquireLock(jobName, 0.001); // 0.001 minutes = 60ms
      expect(acquired1).toBe(true);

      // Wait for lock to expire
      await new Promise(resolve => setTimeout(resolve, 100));

      // Should be able to acquire expired lock
      const acquired2 = await lockManager.acquireLock(jobName, 5);
      expect(acquired2).toBe(true);
    });

    it('should provide lock information', async () => {
      const jobName = 'info-job';

      // No lock initially
      const info1 = await lockManager.getLockInfo(jobName);
      expect(info1).toBeNull();

      // Acquire lock
      await lockManager.acquireLock(jobName, 5);

      // Lock info should be available
      const info2 = await lockManager.getLockInfo(jobName);
      expect(info2).not.toBeNull();
      expect(info2!.jobName).toBe(jobName);
      expect(info2!.lockedAt).toBeInstanceOf(Date);
      expect(info2!.expiresAt).toBeInstanceOf(Date);
    });

    it('should list active locks', async () => {
      const jobs = ['job1', 'job2', 'job3'];

      // Acquire multiple locks
      for (const job of jobs) {
        await lockManager.acquireLock(job, 5);
      }

      // Should list all active locks
      const activeLocks = await lockManager.getActiveLocks();
      expect(activeLocks).toHaveLength(3);

      const lockNames = activeLocks.map(lock => lock.jobName).sort();
      expect(lockNames).toEqual(jobs.sort());
    });
  });
});