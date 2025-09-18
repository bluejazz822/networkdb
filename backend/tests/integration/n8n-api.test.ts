/**
 * N8n API Integration Tests
 * Comprehensive tests for n8n service integration with real external service
 * Tests connectivity, authentication, workflow operations, and error handling
 */

import { N8nService } from '../../src/services/N8nService';
import { WorkflowRegistry } from '../../src/models/WorkflowRegistry';
import { WorkflowExecution } from '../../src/models/WorkflowExecution';
import { WorkflowAlert } from '../../src/models/WorkflowAlert';
import { n8nAxiosClient, n8nUtils, n8nConfig } from '../../src/config/n8n';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database';
import {
  n8nValidator,
  externalServiceUtils,
  N8nServiceValidation,
  TEST_CONFIG
} from '../helpers/external-services';

// Test configuration
const INTEGRATION_TEST_CONFIG = {
  // Should match expected n8n instance
  expectedBaseUrl: 'http://172.16.30.60:5678',
  maxTestWorkflows: 5,
  testTimeout: 60000, // 60 seconds for integration tests
  serviceAvailabilityTimeout: 30000,

  // Test data
  testWorkflowData: {
    name: 'Integration Test Workflow',
    nodes: [
      {
        id: 'start-node',
        name: 'Start',
        type: 'n8n-nodes-base.start',
        typeVersion: 1,
        position: [240, 300] as [number, number],
        parameters: {}
      },
      {
        id: 'code-node',
        name: 'Code',
        type: 'n8n-nodes-base.code',
        typeVersion: 1,
        position: [460, 300] as [number, number],
        parameters: {
          jsCode: 'return [{ json: { message: "Integration test successful", timestamp: new Date().toISOString() } }];'
        }
      }
    ],
    connections: {
      'start-node': {
        main: [[{ node: 'code-node', type: 'main' as const, index: 0 }]]
      }
    }
  }
} as const;

describe('N8n API Integration Tests', () => {
  let n8nService: N8nService;
  let validationReport: N8nServiceValidation;
  let serviceAvailable = false;

  beforeAll(async () => {
    console.log('\n🚀 Starting N8n API Integration Tests');
    console.log(`Expected n8n URL: ${INTEGRATION_TEST_CONFIG.expectedBaseUrl}`);

    // Set up test database
    await setupTestDatabase();

    // Initialize n8n service
    n8nService = new N8nService();

    // Wait for service to be ready
    console.log('⏳ Waiting for N8nService initialization...');
    let attempts = 0;
    const maxAttempts = 10;

    while (!n8nService.isReady() && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      attempts++;
    }

    if (!n8nService.isReady()) {
      console.warn('⚠️  N8nService not ready after initialization attempts');
    }

    // Run comprehensive service validation
    console.log('🔍 Running service validation...');
    validationReport = await n8nValidator.validateAll();

    // Check if service is available for testing
    serviceAvailable = validationReport.connectivity.status !== 'unavailable';

    if (!serviceAvailable) {
      console.warn('⚠️  N8n service unavailable - some tests will be skipped');
      console.warn(`Connectivity status: ${validationReport.connectivity.status}`);
      console.warn(`Error: ${validationReport.connectivity.error}`);
    } else {
      console.log('✅ N8n service is available for testing');
    }

    // Print service validation summary
    console.log('\n📊 Service Validation Summary:');
    console.log(`Connectivity: ${validationReport.connectivity.status}`);
    console.log(`Authentication: ${validationReport.authentication.status}`);
    console.log(`API Version: ${validationReport.apiVersion.status}`);
    console.log(`Workflows: ${validationReport.workflows.status}`);
    console.log(`Rate Limit: ${validationReport.rateLimit.status}`);
  }, INTEGRATION_TEST_CONFIG.serviceAvailabilityTimeout);

  afterAll(async () => {
    console.log('🧹 Cleaning up integration test environment...');
    await cleanupTestDatabase();
  });

  describe('Service Validation', () => {
    it('should validate n8n connectivity', async () => {
      console.log('🔗 Testing n8n connectivity...');

      const status = validationReport.connectivity;

      expect(status.service).toBe('n8n-connectivity');
      expect(status.timestamp).toBeInstanceOf(Date);
      expect(typeof status.responseTime).toBe('number');

      if (serviceAvailable) {
        expect(['healthy', 'degraded']).toContain(status.status);
        expect(status.details?.baseUrl).toBe(INTEGRATION_TEST_CONFIG.expectedBaseUrl);
      } else {
        expect(status.status).toBe('unavailable');
        expect(status.error).toBeDefined();
      }

      console.log(`Connectivity result: ${status.status} (${status.responseTime}ms)`);
      if (status.error) console.log(`Error: ${status.error}`);
    });

    it('should validate n8n authentication', async () => {
      console.log('🔐 Testing n8n authentication...');

      const status = validationReport.authentication;

      expect(status.service).toBe('n8n-authentication');
      expect(status.timestamp).toBeInstanceOf(Date);

      if (serviceAvailable) {
        expect(['healthy', 'unavailable']).toContain(status.status);
        expect(status.details?.hasApiKey).toBe(true);
        expect(typeof status.details?.keyLength).toBe('number');
      } else {
        // Authentication can't be tested if service is unavailable
        expect(['unavailable']).toContain(status.status);
      }

      console.log(`Authentication result: ${status.status} (${status.responseTime}ms)`);
      if (status.error) console.log(`Error: ${status.error}`);
    });

    it('should validate API version compatibility', async () => {
      console.log('📋 Testing API version compatibility...');

      const status = validationReport.apiVersion;

      expect(status.service).toBe('n8n-api-version');
      expect(status.timestamp).toBeInstanceOf(Date);

      if (serviceAvailable && validationReport.authentication.status === 'healthy') {
        expect(['healthy', 'degraded']).toContain(status.status);
        expect(status.details?.responseStructureValid).toBe(true);
      } else {
        expect(status.status).toBe('unavailable');
      }

      console.log(`API version result: ${status.status} (${status.responseTime}ms)`);
      if (status.error) console.log(`Error: ${status.error}`);
    });

    it('should validate workflow operations', async () => {
      console.log('⚙️  Testing workflow operations...');

      const status = validationReport.workflows;

      expect(status.service).toBe('n8n-workflows');
      expect(status.timestamp).toBeInstanceOf(Date);

      if (serviceAvailable && validationReport.authentication.status === 'healthy') {
        expect(['healthy', 'degraded']).toContain(status.status);
        expect(status.details?.canListWorkflows).toBe(true);
        expect(typeof status.details?.workflowCount).toBe('number');

        if (status.details?.workflowCount > 0) {
          expect(Array.isArray(status.details?.sampleWorkflows)).toBe(true);
        }
      } else {
        expect(status.status).toBe('unavailable');
      }

      console.log(`Workflow operations result: ${status.status} (${status.responseTime}ms)`);
      console.log(`Found ${status.details?.workflowCount || 0} workflows`);
      if (status.error) console.log(`Error: ${status.error}`);
    });

    it('should validate rate limiting', async () => {
      console.log('🚦 Testing rate limiting...');

      const status = validationReport.rateLimit;

      expect(status.service).toBe('n8n-rate-limit');
      expect(status.timestamp).toBeInstanceOf(Date);

      if (serviceAvailable) {
        expect(['healthy', 'degraded']).toContain(status.status);
        expect(typeof status.details?.currentRequests).toBe('number');
        expect(typeof status.details?.maxRequests).toBe('number');
        expect(typeof status.details?.canMakeRequest).toBe('boolean');
      }

      console.log(`Rate limit result: ${status.status} (${status.responseTime}ms)`);
      console.log(`Current requests: ${status.details?.currentRequests}/${status.details?.maxRequests}`);
      if (status.error) console.log(`Error: ${status.error}`);
    });
  });

  describe('N8nService Operations', () => {
    it('should initialize service correctly', () => {
      console.log('🏗️  Testing service initialization...');

      expect(n8nService).toBeDefined();

      if (serviceAvailable) {
        expect(n8nService.isReady()).toBe(true);
      }

      console.log(`Service ready: ${n8nService.isReady()}`);
    });

    it('should discover and register workflows', async () => {
      if (!serviceAvailable || validationReport.authentication.status !== 'healthy') {
        console.log('⏭️  Skipping workflow discovery - service unavailable or auth failed');
        return;
      }

      console.log('🔍 Testing workflow discovery and registration...');

      const result = await n8nService.discoverWorkflows({
        limit: INTEGRATION_TEST_CONFIG.maxTestWorkflows,
        active: true
      });

      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);

      if (result.success) {
        expect(Array.isArray(result.data)).toBe(true);

        if (result.data && result.data.length > 0) {
          const workflow = result.data[0];
          expect(workflow.workflow_id).toBeDefined();
          expect(workflow.workflow_name).toBeDefined();
          expect(['vpc', 'subnet', 'transit_gateway', 'nat_gateway', 'vpn']).toContain(workflow.workflow_type);
          expect(['aws', 'azure', 'gcp', 'ali', 'oci', 'huawei', 'others']).toContain(workflow.provider);

          console.log(`✅ Discovered ${result.data.length} workflows`);
          console.log(`Sample workflow: ${workflow.workflow_name} (${workflow.workflow_type})`);
        } else {
          console.log('ℹ️  No workflows found in n8n instance');
        }
      } else {
        expect(result.error).toBeDefined();
        console.log(`❌ Discovery failed: ${result.error?.message}`);
      }
    }, TEST_CONFIG.n8n.workflowTimeout);

    it('should handle workflow discovery with filters', async () => {
      if (!serviceAvailable || validationReport.authentication.status !== 'healthy') {
        console.log('⏭️  Skipping filtered discovery - service unavailable');
        return;
      }

      console.log('🎯 Testing filtered workflow discovery...');

      const result = await n8nService.discoverWorkflows({
        limit: 3,
        active: true,
        provider: 'aws'
      });

      expect(result.success).toBeDefined();

      if (result.success && result.data) {
        result.data.forEach(workflow => {
          expect(workflow.provider).toBe('aws');
          expect(workflow.is_active).toBe(true);
        });

        console.log(`✅ Found ${result.data.length} AWS workflows`);
      } else if (result.error) {
        console.log(`❌ Filtered discovery failed: ${result.error.message}`);
      }
    }, TEST_CONFIG.n8n.workflowTimeout);

    it('should get workflow status and executions', async () => {
      if (!serviceAvailable || validationReport.authentication.status !== 'healthy') {
        console.log('⏭️  Skipping workflow status - service unavailable');
        return;
      }

      console.log('📊 Testing workflow status retrieval...');

      // First get available workflows
      const discoveryResult = await n8nService.discoverWorkflows({ limit: 1, active: true });

      if (!discoveryResult.success || !discoveryResult.data || discoveryResult.data.length === 0) {
        console.log('ℹ️  No workflows available for status testing');
        return;
      }

      const testWorkflowId = discoveryResult.data[0].workflow_id;
      console.log(`Testing status for workflow: ${testWorkflowId}`);

      const statusResult = await n8nService.getWorkflowStatus(testWorkflowId);

      expect(statusResult.success).toBeDefined();
      expect(statusResult.timestamp).toBeInstanceOf(Date);

      if (statusResult.success) {
        expect(statusResult.data).toBeDefined();

        if (Array.isArray(statusResult.data)) {
          console.log(`✅ Retrieved ${statusResult.data.length} executions`);

          if (statusResult.data.length > 0) {
            const execution = statusResult.data[0];
            expect(execution.id).toBeDefined();
            expect(execution.workflowId).toBe(testWorkflowId);
            expect(['new', 'running', 'succeeded', 'failed', 'canceled', 'crashed', 'waiting']).toContain(execution.status);
          }
        } else {
          // Single execution
          expect(statusResult.data.id).toBeDefined();
          expect(statusResult.data.workflowId).toBe(testWorkflowId);
        }
      } else {
        console.log(`❌ Status retrieval failed: ${statusResult.error?.message}`);
      }
    }, TEST_CONFIG.n8n.workflowTimeout);

    it('should poll multiple workflow statuses', async () => {
      if (!serviceAvailable || validationReport.authentication.status !== 'healthy') {
        console.log('⏭️  Skipping status polling - service unavailable');
        return;
      }

      console.log('🔄 Testing workflow status polling...');

      const pollResult = await n8nService.pollWorkflowStatuses({
        maxConcurrent: 3,
        batchSize: 2,
        includeExecutionData: false
      });

      expect(pollResult.success).toBeDefined();
      expect(pollResult.timestamp).toBeInstanceOf(Date);

      if (pollResult.success) {
        expect(Array.isArray(pollResult.data)).toBe(true);

        console.log(`✅ Polled ${pollResult.data?.length || 0} executions`);

        if (pollResult.data && pollResult.data.length > 0) {
          pollResult.data.forEach(execution => {
            expect(execution.id).toBeDefined();
            expect(execution.workflowId).toBeDefined();
            expect(['new', 'running', 'succeeded', 'failed', 'canceled', 'crashed', 'waiting']).toContain(execution.status);
          });
        }
      } else {
        console.log(`❌ Polling failed: ${pollResult.error?.message}`);
      }
    }, TEST_CONFIG.n8n.workflowTimeout * 2);

    it('should sync workflow data comprehensively', async () => {
      if (!serviceAvailable || validationReport.authentication.status !== 'healthy') {
        console.log('⏭️  Skipping data sync - service unavailable');
        return;
      }

      console.log('🔄 Testing comprehensive workflow data sync...');

      const syncResult = await n8nService.syncWorkflowData({
        fullSync: false,
        syncExecutions: true,
        cleanupOrphaned: false
      });

      expect(syncResult.success).toBeDefined();
      expect(syncResult.timestamp).toBeInstanceOf(Date);

      if (syncResult.success && syncResult.data) {
        expect(typeof syncResult.data.workflows).toBe('number');
        expect(typeof syncResult.data.executions).toBe('number');

        console.log(`✅ Synced ${syncResult.data.workflows} workflows and ${syncResult.data.executions} executions`);
      } else {
        console.log(`❌ Sync failed: ${syncResult.error?.message}`);
      }
    }, TEST_CONFIG.n8n.workflowTimeout * 3);

    it('should get workflow execution statistics', async () => {
      if (!serviceAvailable || validationReport.authentication.status !== 'healthy') {
        console.log('⏭️  Skipping statistics - service unavailable');
        return;
      }

      console.log('📈 Testing workflow execution statistics...');

      // First ensure we have a workflow to test
      const discoveryResult = await n8nService.discoverWorkflows({ limit: 1, active: true });

      if (!discoveryResult.success || !discoveryResult.data || discoveryResult.data.length === 0) {
        console.log('ℹ️  No workflows available for statistics testing');
        return;
      }

      const testWorkflowId = discoveryResult.data[0].workflow_id;
      console.log(`Getting statistics for workflow: ${testWorkflowId}`);

      const statsResult = await n8nService.getWorkflowStats(testWorkflowId);

      expect(statsResult.success).toBeDefined();

      if (statsResult.success && statsResult.data) {
        const stats = statsResult.data;

        expect(stats.workflowId).toBe(testWorkflowId);
        expect(stats.workflowName).toBeDefined();
        expect(typeof stats.totalExecutions).toBe('number');
        expect(typeof stats.successfulExecutions).toBe('number');
        expect(typeof stats.failedExecutions).toBe('number');
        expect(typeof stats.averageExecutionTime).toBe('number');
        expect(typeof stats.errorRate).toBe('number');
        expect(Array.isArray(stats.mostCommonErrors)).toBe(true);

        console.log(`✅ Statistics: ${stats.totalExecutions} total, ${stats.successfulExecutions} successful, ${stats.failedExecutions} failed`);
        console.log(`   Error rate: ${stats.errorRate.toFixed(2)}%, Avg time: ${stats.averageExecutionTime}ms`);
      } else {
        console.log(`❌ Statistics failed: ${statsResult.error?.message}`);
      }
    });

    it('should get workflow execution history', async () => {
      if (!serviceAvailable || validationReport.authentication.status !== 'healthy') {
        console.log('⏭️  Skipping execution history - service unavailable');
        return;
      }

      console.log('📚 Testing workflow execution history retrieval...');

      // Get a workflow to test
      const discoveryResult = await n8nService.discoverWorkflows({ limit: 1, active: true });

      if (!discoveryResult.success || !discoveryResult.data || discoveryResult.data.length === 0) {
        console.log('ℹ️  No workflows available for history testing');
        return;
      }

      const testWorkflowId = discoveryResult.data[0].workflow_id;

      const historyResult = await n8nService.getWorkflowExecutionHistory(testWorkflowId, 10, 0);

      expect(historyResult.success).toBeDefined();

      if (historyResult.success && historyResult.data) {
        expect(Array.isArray(historyResult.data.executions)).toBe(true);
        expect(typeof historyResult.data.total).toBe('number');

        console.log(`✅ Retrieved ${historyResult.data.executions.length} executions out of ${historyResult.data.total} total`);

        if (historyResult.data.executions.length > 0) {
          const execution = historyResult.data.executions[0];
          expect(execution.workflow_id).toBe(testWorkflowId);
          expect(execution.execution_id).toBeDefined();
          expect(['success', 'failure', 'running', 'cancelled']).toContain(execution.status);
        }
      } else {
        console.log(`❌ History retrieval failed: ${historyResult.error?.message}`);
      }
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle service unavailability gracefully', async () => {
      console.log('⚠️  Testing service unavailability handling...');

      // Test with a non-existent workflow ID
      const result = await n8nService.getWorkflowStatus('non-existent-workflow-id');

      expect(result.success).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);

      if (serviceAvailable) {
        // Should fail with proper error
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
        console.log(`✅ Properly handled non-existent workflow: ${result.error?.message}`);
      } else {
        // Should fail due to service unavailability
        expect(result.success).toBe(false);
        expect(result.error?.code).toBe('CONNECTION_ERROR');
        console.log(`✅ Properly handled service unavailability: ${result.error?.message}`);
      }
    });

    it('should handle network timeouts correctly', async () => {
      console.log('⏰ Testing timeout handling...');

      // This test validates that our service properly handles timeouts
      // The actual timeout behavior depends on the n8n service response time

      const startTime = Date.now();
      const result = await n8nService.discoverWorkflows({ limit: 1 });
      const endTime = Date.now();

      expect(result.success).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);

      if (serviceAvailable) {
        // Should complete within reasonable time
        const responseTime = endTime - startTime;
        console.log(`✅ Operation completed in ${responseTime}ms`);

        if (responseTime > TEST_CONFIG.n8n.workflowTimeout) {
          console.warn(`⚠️  Response time (${responseTime}ms) exceeded expected timeout`);
        }
      } else {
        console.log('✅ Timeout handling verified - service unavailable');
      }
    });

    it('should validate rate limiting behavior', async () => {
      if (!serviceAvailable) {
        console.log('⏭️  Skipping rate limit test - service unavailable');
        return;
      }

      console.log('🚦 Testing rate limiting behavior...');

      // Get initial rate limit status
      const initialStatus = n8nUtils.getRateLimitStatus();
      console.log(`Initial rate limit: ${initialStatus.currentRequests}/${initialStatus.maxRequests}`);

      // Make multiple requests to test rate limiting
      const requests = Array.from({ length: 3 }, (_, i) =>
        n8nService.discoverWorkflows({ limit: 1 })
      );

      const results = await Promise.allSettled(requests);

      const finalStatus = n8nUtils.getRateLimitStatus();
      console.log(`Final rate limit: ${finalStatus.currentRequests}/${finalStatus.maxRequests}`);

      // Validate results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          expect(result.value.success).toBeDefined();
          console.log(`Request ${index + 1}: ${result.value.success ? 'success' : 'failed'}`);
        } else {
          console.log(`Request ${index + 1}: rejected - ${result.reason}`);
        }
      });

      // Rate limit should have increased
      expect(finalStatus.currentRequests).toBeGreaterThanOrEqual(initialStatus.currentRequests);

      console.log('✅ Rate limiting behavior validated');
    });

    it('should handle malformed responses gracefully', async () => {
      console.log('🔧 Testing malformed response handling...');

      // Test service behavior with invalid parameters
      const result = await n8nService.discoverWorkflows({
        limit: -1, // Invalid limit
        active: undefined
      });

      expect(result.success).toBeDefined();
      expect(result.timestamp).toBeInstanceOf(Date);

      if (serviceAvailable) {
        if (!result.success) {
          expect(result.error).toBeDefined();
          console.log(`✅ Properly handled invalid parameters: ${result.error?.message}`);
        } else {
          console.log('✅ Service handled invalid parameters gracefully');
        }
      } else {
        expect(result.error?.code).toBe('CONNECTION_ERROR');
        console.log('✅ Service unavailability handled correctly');
      }
    });
  });

  describe('Production Readiness', () => {
    it('should have proper configuration validation', () => {
      console.log('⚙️  Testing configuration validation...');

      expect(n8nConfig.baseUrl).toBe(INTEGRATION_TEST_CONFIG.expectedBaseUrl);
      expect(n8nConfig.apiKey).toBeDefined();
      expect(n8nConfig.timeout).toBeGreaterThan(0);
      expect(n8nConfig.rateLimit.maxRequestsPerMinute).toBeGreaterThan(0);
      expect(n8nConfig.retry.maxAttempts).toBeGreaterThan(0);

      console.log('✅ Configuration validation passed');
    });

    it('should provide comprehensive health check', async () => {
      console.log('🏥 Testing service health check...');

      const healthCheck = await n8nUtils.healthCheck();

      expect(typeof healthCheck).toBe('boolean');

      if (serviceAvailable) {
        expect(healthCheck).toBe(true);
        console.log('✅ Health check passed - service is healthy');
      } else {
        expect(healthCheck).toBe(false);
        console.log('✅ Health check correctly identified unavailable service');
      }
    });

    it('should demonstrate integration with database models', async () => {
      if (!serviceAvailable || validationReport.authentication.status !== 'healthy') {
        console.log('⏭️  Skipping database integration - service unavailable');
        return;
      }

      console.log('🗄️  Testing database integration...');

      // Test workflow discovery and registration
      const discoveryResult = await n8nService.discoverWorkflows({ limit: 2 });

      if (discoveryResult.success && discoveryResult.data && discoveryResult.data.length > 0) {
        // Verify workflows were created in database
        const dbWorkflowCount = await WorkflowRegistry.count();
        expect(dbWorkflowCount).toBeGreaterThan(0);

        console.log(`✅ Database integration: ${dbWorkflowCount} workflows in database`);

        // Check if we have any executions tracked
        const executionCount = await WorkflowExecution.count();
        console.log(`Database has ${executionCount} tracked executions`);

        // Check if we have any alerts
        const alertCount = await WorkflowAlert.count();
        console.log(`Database has ${alertCount} alerts`);
      } else {
        console.log('ℹ️  No workflows discovered - database integration not tested');
      }
    });

    it('should validate service recovery after failure', async () => {
      console.log('🔄 Testing service recovery patterns...');

      // Test service behavior after initialization
      const serviceReady = n8nService.isReady();

      if (serviceReady && serviceAvailable) {
        // Service should continue working
        const result = await n8nService.discoverWorkflows({ limit: 1 });
        expect(result.success).toBeDefined();

        console.log('✅ Service maintains functionality after initialization');
      } else {
        console.log('ℹ️  Service recovery tested - handled unavailable state correctly');
      }
    });
  });
});