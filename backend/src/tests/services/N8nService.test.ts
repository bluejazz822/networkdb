/**
 * N8nService Unit Tests
 * Comprehensive test suite for N8nService with >90% code coverage
 */

import { N8nService } from '../../services/N8nService';
import { n8nAxiosClient, n8nUtils } from '../../config/n8n';
import { WorkflowRegistry } from '../../models/WorkflowRegistry';
import { WorkflowExecution } from '../../models/WorkflowExecution';
import { WorkflowAlert } from '../../models/WorkflowAlert';
import { AxiosError } from 'axios';
import { 
  N8nWorkflow,
  N8nWorkflowExecution,
  N8nWorkflowListResponse,
  N8nExecutionListResponse,
  N8nErrorResponse,
  WorkflowExecutionStatus 
} from '../../types/workflow';

// Mock dependencies
jest.mock('../../config/n8n');
jest.mock('../../models/WorkflowRegistry');
jest.mock('../../models/WorkflowExecution');
jest.mock('../../models/WorkflowAlert');

describe('N8nService', () => {
  let n8nService: N8nService;
  let mockN8nAxiosClient: jest.Mocked<typeof n8nAxiosClient>;
  let mockN8nUtils: jest.Mocked<typeof n8nUtils>;
  let mockWorkflowRegistry: jest.Mocked<typeof WorkflowRegistry>;
  let mockWorkflowExecutionModel: jest.Mocked<typeof WorkflowExecution>;
  let mockWorkflowAlert: jest.Mocked<typeof WorkflowAlert>;

  // Mock data
  const mockWorkflow: N8nWorkflow = {
    id: 'workflow-123',
    name: 'AWS VPC Discovery',
    active: true,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    nodes: [
      {
        id: 'node-1',
        name: 'AWS Node',
        type: 'aws-ec2',
        typeVersion: 1,
        position: [0, 0],
        parameters: { region: 'us-east-1' }
      }
    ],
    connections: {},
    staticData: {},
    tags: []
  };

  const mockWorkflowExecutionData: N8nWorkflowExecution = {
    id: 'exec-123',
    name: 'Execution 123',
    workflowId: 'workflow-123',
    status: 'succeeded' as WorkflowExecutionStatus,
    mode: 'manual',
    finished: true,
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-01T10:05:00Z',
    startedAt: '2024-01-01T10:00:00Z',
    stoppedAt: '2024-01-01T10:05:00Z',
    data: {
      resultData: {
        runData: {},
        error: null
      }
    }
  };

  const mockWorkflowRegistryInstance = {
    id: 1,
    workflow_id: 'workflow-123',
    workflow_name: 'AWS VPC Discovery',
    workflow_type: 'vpc' as const,
    provider: 'aws' as const,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
    update: jest.fn(),
    destroy: jest.fn()
  };

  const mockWorkflowExecutionInstance = {
    id: 1,
    workflow_id: 'workflow-123',
    execution_id: 'exec-123',
    status: 'success' as const,
    start_time: new Date(),
    end_time: new Date(),
    duration_ms: 300000,
    resources_created: 0,
    resources_updated: 0,
    resources_failed: 0,
    error_message: null as string | null,
    execution_data: {}
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mocks
    mockN8nAxiosClient = n8nAxiosClient as jest.Mocked<typeof n8nAxiosClient>;
    mockN8nUtils = n8nUtils as jest.Mocked<typeof n8nUtils>;
    mockWorkflowRegistry = WorkflowRegistry as jest.Mocked<typeof WorkflowRegistry>;
    mockWorkflowExecutionModel = WorkflowExecution as jest.Mocked<typeof WorkflowExecution>;
    mockWorkflowAlert = WorkflowAlert as jest.Mocked<typeof WorkflowAlert>;

    // Default successful health check
    mockN8nUtils.healthCheck.mockResolvedValue(true);

    // Create new service instance
    n8nService = new N8nService();
  });

  describe('Service Initialization', () => {
    it('should initialize successfully with healthy n8n connection', async () => {
      mockN8nUtils.healthCheck.mockResolvedValue(true);
      
      const service = new N8nService();
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(service.isReady()).toBe(true);
      expect(mockN8nUtils.healthCheck).toHaveBeenCalled();
    });

    it('should handle initialization with unhealthy n8n connection', async () => {
      mockN8nUtils.healthCheck.mockResolvedValue(false);
      
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
      const service = new N8nService();
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(service.isReady()).toBe(true); // Service still initializes but logs warning
      expect(consoleSpy).toHaveBeenCalledWith('[N8nService] n8n API is not accessible during initialization');
      
      consoleSpy.mockRestore();
    });

    it('should handle initialization errors gracefully', async () => {
      const error = new Error('Network error');
      mockN8nUtils.healthCheck.mockRejectedValue(error);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const service = new N8nService();
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(service.isReady()).toBe(false);
      expect(consoleSpy).toHaveBeenCalledWith('[N8nService] Initialization failed:', error);
      
      consoleSpy.mockRestore();
    });
  });

  describe('discoverWorkflows', () => {
    it('should successfully discover and register workflows', async () => {
      const mockResponse: N8nWorkflowListResponse = {
        data: [mockWorkflow],
        nextCursor: null,
        total: 1,
        success: true,
        timestamp: new Date()
      };

      mockN8nAxiosClient.get.mockResolvedValue({ data: mockResponse });
      mockWorkflowRegistry.findOrCreate.mockResolvedValue([mockWorkflowRegistryInstance as any, true]);

      const result = await n8nService.discoverWorkflows();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data![0]).toBe(mockWorkflowRegistryInstance);
      expect(mockN8nAxiosClient.get).toHaveBeenCalledWith('/workflows', {
        params: { active: undefined, limit: 100 }
      });
    });

    it('should handle workflow discovery with options', async () => {
      const options = {
        provider: 'aws' as const,
        workflowType: 'vpc' as const,
        active: true,
        limit: 50
      };

      const mockResponse: N8nWorkflowListResponse = {
        data: [mockWorkflow],
        nextCursor: null,
        total: 1,
        success: true,
        timestamp: new Date()
      };

      mockN8nAxiosClient.get.mockResolvedValue({ data: mockResponse });
      mockWorkflowRegistry.findOrCreate.mockResolvedValue([mockWorkflowRegistryInstance as any, true]);

      const result = await n8nService.discoverWorkflows(options);

      expect(result.success).toBe(true);
      expect(mockN8nAxiosClient.get).toHaveBeenCalledWith('/workflows', {
        params: { active: true, limit: 50 }
      });
    });

    it('should update existing workflows instead of creating duplicates', async () => {
      const mockResponse: N8nWorkflowListResponse = {
        data: [mockWorkflow],
        nextCursor: null,
        total: 1,
        success: true,
        timestamp: new Date()
      };

      mockN8nAxiosClient.get.mockResolvedValue({ data: mockResponse });
      mockWorkflowRegistry.findOrCreate.mockResolvedValue([mockWorkflowRegistryInstance as any, false]);

      const result = await n8nService.discoverWorkflows();

      expect(result.success).toBe(true);
      expect(mockWorkflowRegistryInstance.update).toHaveBeenCalledWith({
        workflow_name: mockWorkflow.name,
        is_active: mockWorkflow.active
      });
    });

    it('should handle database errors during workflow registration', async () => {
      const mockResponse: N8nWorkflowListResponse = {
        data: [mockWorkflow],
        nextCursor: null,
        total: 1,
        success: true,
        timestamp: new Date()
      };

      mockN8nAxiosClient.get.mockResolvedValue({ data: mockResponse });
      mockWorkflowRegistry.findOrCreate.mockRejectedValue(new Error('DB Error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await n8nService.discoverWorkflows();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(0); // No workflows registered due to error
      expect(consoleSpy).toHaveBeenCalledWith(
        '[N8nService] Failed to register workflow workflow-123:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should return error when service not initialized', async () => {
      const uninitializedService = new N8nService();
      // Force uninitialized state
      (uninitializedService as any).isInitialized = false;

      const result = await uninitializedService.discoverWorkflows();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONNECTION_ERROR');
      expect(result.error?.message).toBe('Service not initialized');
    });

    it('should handle n8n API errors', async () => {
      const axiosError: AxiosError = {
        response: {
          status: 401,
          data: { error: { code: 'AUTHENTICATION_FAILED', message: 'Invalid API key' } }
        }
      } as AxiosError;

      mockN8nAxiosClient.get.mockRejectedValue(axiosError);

      const result = await n8nService.discoverWorkflows();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTHENTICATION_FAILED');
    });
  });

  describe('getWorkflowStatus', () => {
    it('should get specific execution status', async () => {
      mockN8nAxiosClient.get.mockResolvedValue({ data: mockWorkflowExecutionData });

      const result = await n8nService.getWorkflowStatus('workflow-123', 'exec-123');

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockWorkflowExecutionData);
      expect(mockN8nAxiosClient.get).toHaveBeenCalledWith('/executions/exec-123');
    });

    it('should get all executions for a workflow', async () => {
      const mockExecutionListResponse: N8nExecutionListResponse = {
        data: [mockWorkflowExecutionData],
        nextCursor: null,
        total: 1,
        success: true,
        timestamp: new Date()
      };

      mockN8nAxiosClient.get.mockResolvedValue({ data: mockExecutionListResponse });

      const result = await n8nService.getWorkflowStatus('workflow-123');

      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockN8nAxiosClient.get).toHaveBeenCalledWith('/executions', {
        params: {
          workflowId: 'workflow-123',
          limit: 50,
          includeData: false
        }
      });
    });

    it('should handle API errors', async () => {
      const axiosError: AxiosError = {
        response: {
          status: 404,
          data: { error: { code: 'WORKFLOW_NOT_FOUND', message: 'Workflow not found' } }
        }
      } as AxiosError;

      mockN8nAxiosClient.get.mockRejectedValue(axiosError);

      const result = await n8nService.getWorkflowStatus('workflow-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('WORKFLOW_NOT_FOUND');
    });

    it('should return error when service not initialized', async () => {
      const uninitializedService = new N8nService();
      (uninitializedService as any).isInitialized = false;

      const result = await uninitializedService.getWorkflowStatus('workflow-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONNECTION_ERROR');
    });
  });

  describe('executeWorkflow', () => {
    it('should execute workflow successfully', async () => {
      mockN8nAxiosClient.post.mockResolvedValue({ data: mockWorkflowExecutionData });
      mockWorkflowExecutionModel.create.mockResolvedValue(mockWorkflowExecutionInstance as any);
      mockWorkflowAlert.create.mockResolvedValue({} as any);

      const result = await n8nService.executeWorkflow('workflow-123', { param: 'value' });

      expect(result.success).toBe(true);
      expect(result.data).toBe(mockWorkflowExecutionData);
      expect(mockN8nAxiosClient.post).toHaveBeenCalledWith(
        '/workflows/workflow-123/execute',
        { runData: { param: 'value' } }
      );
      expect(mockWorkflowExecutionModel.create).toHaveBeenCalled();
      expect(mockWorkflowAlert.create).toHaveBeenCalled();
    });

    it('should execute workflow without data', async () => {
      mockN8nAxiosClient.post.mockResolvedValue({ data: mockWorkflowExecutionData });
      mockWorkflowExecutionModel.create.mockResolvedValue(mockWorkflowExecutionInstance as any);
      mockWorkflowAlert.create.mockResolvedValue({} as any);

      const result = await n8nService.executeWorkflow('workflow-123');

      expect(result.success).toBe(true);
      expect(mockN8nAxiosClient.post).toHaveBeenCalledWith(
        '/workflows/workflow-123/execute',
        {}
      );
    });

    it('should handle database tracking errors gracefully', async () => {
      mockN8nAxiosClient.post.mockResolvedValue({ data: mockWorkflowExecutionData });
      mockWorkflowExecutionModel.create.mockRejectedValue(new Error('DB Error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await n8nService.executeWorkflow('workflow-123');

      expect(result.success).toBe(true); // Execution succeeds even if tracking fails
      expect(consoleSpy).toHaveBeenCalledWith(
        '[N8nService] Failed to track execution exec-123:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('should return error when service not initialized', async () => {
      const uninitializedService = new N8nService();
      (uninitializedService as any).isInitialized = false;

      const result = await uninitializedService.executeWorkflow('workflow-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONNECTION_ERROR');
    });

    it('should handle execution errors', async () => {
      const axiosError: AxiosError = {
        response: {
          status: 500,
          data: { error: { code: 'EXECUTION_ERROR', message: 'Workflow execution failed' } }
        }
      } as AxiosError;

      mockN8nAxiosClient.post.mockRejectedValue(axiosError);

      const result = await n8nService.executeWorkflow('workflow-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('EXECUTION_ERROR');
    });
  });

  describe('pollWorkflowStatuses', () => {
    it('should poll specific workflow statuses', async () => {
      const mockExecutionListResponse: N8nExecutionListResponse = {
        data: [mockWorkflowExecutionData],
        nextCursor: null,
        total: 1,
        success: true,
        timestamp: new Date()
      };

      mockN8nAxiosClient.get.mockResolvedValue({ data: mockExecutionListResponse });
      mockWorkflowExecutionModel.upsert = jest.fn().mockResolvedValue(undefined);

      const result = await n8nService.pollWorkflowStatuses({
        workflowIds: ['workflow-123'],
        maxConcurrent: 2,
        batchSize: 5
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(mockWorkflowExecutionModel.upsert).toHaveBeenCalled();
    });

    it('should poll all active workflows when no specific IDs provided', async () => {
      mockWorkflowRegistry.findAll.mockResolvedValue([
        { workflow_id: 'workflow-123' },
        { workflow_id: 'workflow-456' }
      ] as any);

      const mockExecutionListResponse: N8nExecutionListResponse = {
        data: [mockWorkflowExecutionData],
        nextCursor: null,
        total: 1,
        success: true,
        timestamp: new Date()
      };

      mockN8nAxiosClient.get.mockResolvedValue({ data: mockExecutionListResponse });
      mockWorkflowExecutionModel.upsert = jest.fn().mockResolvedValue(undefined);

      const result = await n8nService.pollWorkflowStatuses();

      expect(result.success).toBe(true);
      expect(mockWorkflowRegistry.findAll).toHaveBeenCalledWith({
        where: { is_active: true },
        attributes: ['workflow_id']
      });
    });

    it('should handle batch processing with rate limiting', async () => {
      const workflowIds = Array.from({ length: 15 }, (_, i) => `workflow-${i}`);
      
      mockWorkflowRegistry.findAll.mockResolvedValue(
        workflowIds.map(id => ({ workflow_id: id })) as any
      );

      const mockExecutionListResponse: N8nExecutionListResponse = {
        data: [mockWorkflowExecutionData],
        nextCursor: null,
        total: 1,
        success: true,
        timestamp: new Date()
      };

      mockN8nAxiosClient.get.mockResolvedValue({ data: mockExecutionListResponse });
      mockWorkflowExecutionModel.upsert = jest.fn().mockResolvedValue(undefined);

      const startTime = Date.now();
      const result = await n8nService.pollWorkflowStatuses({ batchSize: 5 });
      const endTime = Date.now();

      expect(result.success).toBe(true);
      // Should take at least 2 seconds for rate limiting between batches (15 workflows / 5 batch = 3 batches, 2 delays)
      expect(endTime - startTime).toBeGreaterThan(1500);
    });

    it('should handle errors in individual workflow polling', async () => {
      mockWorkflowRegistry.findAll.mockResolvedValue([
        { workflow_id: 'workflow-123' },
        { workflow_id: 'workflow-456' }
      ] as any);

      const mockExecutionListResponse: N8nExecutionListResponse = {
        data: [mockWorkflowExecutionData],
        nextCursor: null,
        total: 1,
        success: true,
        timestamp: new Date()
      };

      mockN8nAxiosClient.get
        .mockResolvedValueOnce({ data: mockExecutionListResponse })
        .mockRejectedValueOnce(new Error('API Error'));

      mockWorkflowExecutionModel.upsert = jest.fn().mockResolvedValue(undefined);

      const result = await n8nService.pollWorkflowStatuses();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1); // Only successful polling result
    });

    it('should return error when service not initialized', async () => {
      const uninitializedService = new N8nService();
      (uninitializedService as any).isInitialized = false;

      const result = await uninitializedService.pollWorkflowStatuses();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONNECTION_ERROR');
    });
  });

  describe('syncWorkflowData', () => {
    it('should perform full synchronization', async () => {
      // Mock discoverWorkflows response
      const discoverSpy = jest.spyOn(n8nService, 'discoverWorkflows').mockResolvedValue({
        success: true,
        data: [mockWorkflowRegistryInstance as any],
        timestamp: new Date()
      });

      // Mock pollWorkflowStatuses response
      const pollSpy = jest.spyOn(n8nService, 'pollWorkflowStatuses').mockResolvedValue({
        success: true,
        data: [mockWorkflowExecutionData],
        timestamp: new Date()
      });

      const result = await n8nService.syncWorkflowData({
        fullSync: true,
        syncExecutions: true,
        cleanupOrphaned: false
      });

      expect(result.success).toBe(true);
      expect(result.data?.workflows).toBe(1);
      expect(result.data?.executions).toBe(1);
      expect(discoverSpy).toHaveBeenCalledWith({ includeInactive: true });
      expect(pollSpy).toHaveBeenCalledWith({
        workflowIds: undefined,
        includeExecutionData: true
      });
    });

    it('should sync without executions when requested', async () => {
      const discoverSpy = jest.spyOn(n8nService, 'discoverWorkflows').mockResolvedValue({
        success: true,
        data: [mockWorkflowRegistryInstance as any],
        timestamp: new Date()
      });

      const pollSpy = jest.spyOn(n8nService, 'pollWorkflowStatuses');

      const result = await n8nService.syncWorkflowData({
        syncExecutions: false
      });

      expect(result.success).toBe(true);
      expect(result.data?.workflows).toBe(1);
      expect(result.data?.executions).toBe(0);
      expect(discoverSpy).toHaveBeenCalled();
      expect(pollSpy).not.toHaveBeenCalled();
    });

    it('should handle cleanup of orphaned records', async () => {
      const discoverSpy = jest.spyOn(n8nService, 'discoverWorkflows').mockResolvedValue({
        success: true,
        data: [],
        timestamp: new Date()
      });

      // Mock cleanup process
      const mockCleanupResponse: N8nWorkflowListResponse = {
        data: [mockWorkflow],
        nextCursor: null,
        total: 1,
        success: true,
        timestamp: new Date()
      };

      mockN8nAxiosClient.get.mockResolvedValue({ data: mockCleanupResponse });

      mockWorkflowRegistry.findAll.mockResolvedValue([
        { id: 1, workflow_id: 'orphan-workflow', destroy: jest.fn() }
      ] as any);

      mockWorkflowExecutionModel.destroy = jest.fn().mockResolvedValue(undefined);

      const result = await n8nService.syncWorkflowData({
        cleanupOrphaned: true
      });

      expect(result.success).toBe(true);
      expect(discoverSpy).toHaveBeenCalled();
    });

    it('should return error when service not initialized', async () => {
      const uninitializedService = new N8nService();
      (uninitializedService as any).isInitialized = false;

      const result = await uninitializedService.syncWorkflowData();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONNECTION_ERROR');
    });
  });

  describe('getWorkflowExecutionHistory', () => {
    it('should retrieve execution history successfully', async () => {
      const mockHistoryData = {
        count: 10,
        rows: [mockWorkflowExecutionInstance]
      };

      mockWorkflowExecutionModel.findAndCountAll.mockResolvedValue(mockHistoryData as any);

      const result = await n8nService.getWorkflowExecutionHistory('workflow-123', 25, 5);

      expect(result.success).toBe(true);
      expect(result.data?.executions).toHaveLength(1);
      expect(result.data?.total).toBe(10);
      expect(mockWorkflowExecutionModel.findAndCountAll).toHaveBeenCalledWith({
        where: { workflow_id: 'workflow-123' },
        order: [['start_time', 'DESC']],
        limit: 25,
        offset: 5
      });
    });

    it('should use default limit and offset', async () => {
      const mockHistoryData = {
        count: 5,
        rows: [mockWorkflowExecutionInstance]
      };

      mockWorkflowExecutionModel.findAndCountAll.mockResolvedValue(mockHistoryData as any);

      const result = await n8nService.getWorkflowExecutionHistory('workflow-123');

      expect(result.success).toBe(true);
      expect(mockWorkflowExecutionModel.findAndCountAll).toHaveBeenCalledWith({
        where: { workflow_id: 'workflow-123' },
        order: [['start_time', 'DESC']],
        limit: 50,
        offset: 0
      });
    });

    it('should handle database errors', async () => {
      mockWorkflowExecutionModel.findAndCountAll.mockRejectedValue(new Error('DB Error'));

      const result = await n8nService.getWorkflowExecutionHistory('workflow-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('WORKFLOW_NOT_FOUND');
    });
  });

  describe('getWorkflowStats', () => {
    it('should calculate workflow statistics correctly', async () => {
      mockWorkflowRegistry.findOne.mockResolvedValue(mockWorkflowRegistryInstance as any);

      const mockExecutions = [
        {
          status: 'success',
          duration_ms: 1000,
          start_time: new Date('2024-01-03'),
          error_message: null
        },
        {
          status: 'failure',
          duration_ms: 2000,
          start_time: new Date('2024-01-02'),
          error_message: 'Timeout error'
        },
        {
          status: 'success',
          duration_ms: 1500,
          start_time: new Date('2024-01-01'),
          error_message: null
        }
      ];

      mockWorkflowExecutionModel.findAll.mockResolvedValue(mockExecutions as any);

      const result = await n8nService.getWorkflowStats('workflow-123');

      expect(result.success).toBe(true);
      expect(result.data?.totalExecutions).toBe(3);
      expect(result.data?.successfulExecutions).toBe(2);
      expect(result.data?.failedExecutions).toBe(1);
      expect(result.data?.averageExecutionTime).toBe(1500); // (1000 + 2000 + 1500) / 3
      expect(result.data?.errorRate).toBe(33.333333333333336); // 1/3 * 100
      expect(result.data?.mostCommonErrors).toEqual([
        { error: 'Timeout error', count: 1 }
      ]);
    });

    it('should handle workflow not found', async () => {
      mockWorkflowRegistry.findOne.mockResolvedValue(null);

      const result = await n8nService.getWorkflowStats('nonexistent-workflow');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('WORKFLOW_NOT_FOUND');
      expect(result.error?.message).toBe('Workflow not found in registry');
    });

    it('should handle empty execution history', async () => {
      mockWorkflowRegistry.findOne.mockResolvedValue(mockWorkflowRegistryInstance as any);
      mockWorkflowExecutionModel.findAll.mockResolvedValue([]);

      const result = await n8nService.getWorkflowStats('workflow-123');

      expect(result.success).toBe(true);
      expect(result.data?.totalExecutions).toBe(0);
      expect(result.data?.averageExecutionTime).toBe(0);
      expect(result.data?.errorRate).toBe(0);
    });

    it('should handle database errors', async () => {
      mockWorkflowRegistry.findOne.mockRejectedValue(new Error('DB Error'));

      const result = await n8nService.getWorkflowStats('workflow-123');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('WORKFLOW_NOT_FOUND');
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors correctly', async () => {
      const axiosError: AxiosError = {
        response: {
          status: 401,
          data: 'Unauthorized'
        }
      } as AxiosError;

      mockN8nAxiosClient.get.mockRejectedValue(axiosError);

      const result = await n8nService.discoverWorkflows();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('AUTHENTICATION_FAILED');
      expect(result.error?.message).toBe('n8n authentication failed. Check API key.');
      expect(result.error?.httpStatus).toBe(401);
    });

    it('should handle rate limit errors correctly', async () => {
      const axiosError: AxiosError = {
        response: {
          status: 429,
          data: 'Too Many Requests'
        }
      } as AxiosError;

      mockN8nAxiosClient.get.mockRejectedValue(axiosError);

      const result = await n8nService.discoverWorkflows();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(result.error?.message).toBe('Rate limit exceeded. Please retry later.');
      expect(result.error?.httpStatus).toBe(429);
    });

    it('should handle server errors correctly', async () => {
      const axiosError: AxiosError = {
        response: {
          status: 500,
          data: 'Internal Server Error'
        }
      } as AxiosError;

      mockN8nAxiosClient.get.mockRejectedValue(axiosError);

      const result = await n8nService.discoverWorkflows();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONNECTION_ERROR');
      expect(result.error?.message).toBe('n8n server error occurred');
      expect(result.error?.httpStatus).toBe(500);
    });

    it('should handle network errors correctly', async () => {
      const axiosError: AxiosError = {
        message: 'Network Error',
        code: 'ECONNREFUSED'
      } as AxiosError;

      mockN8nAxiosClient.get.mockRejectedValue(axiosError);

      const result = await n8nService.discoverWorkflows();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('CONNECTION_ERROR');
      expect(result.error?.message).toBe('Network Error');
      expect(result.error?.details).toBe('ECONNREFUSED');
    });

    it('should handle n8n error responses correctly', async () => {
      const n8nErrorResponse: N8nErrorResponse = {
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: 'Workflow with ID "123" could not be found.',
          details: { workflowId: '123' }
        },
        success: false,
        timestamp: new Date()
      };

      const axiosError: AxiosError = {
        response: {
          status: 404,
          data: n8nErrorResponse
        }
      } as AxiosError;

      mockN8nAxiosClient.get.mockRejectedValue(axiosError);

      const result = await n8nService.discoverWorkflows();

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('WORKFLOW_NOT_FOUND');
      expect(result.error?.message).toBe('Workflow with ID "123" could not be found.');
      expect(result.error?.details).toEqual({ workflowId: '123' });
      expect(result.error?.httpStatus).toBe(404);
    });
  });

  describe('Helper Methods', () => {
    it('should infer workflow type correctly', async () => {
      const testCases = [
        { name: 'AWS Transit Gateway Discovery', expected: 'transit_gateway' },
        { name: 'VPC Subnet Management', expected: 'subnet' },
        { name: 'NAT Gateway Config', expected: 'nat_gateway' },
        { name: 'VPN Tunnel Setup', expected: 'vpn' },
        { name: 'Basic VPC Discovery', expected: 'vpc' }
      ];

      for (const testCase of testCases) {
        const workflow = { ...mockWorkflow, name: testCase.name };
        const response: N8nWorkflowListResponse = {
          data: [workflow],
          nextCursor: null,
          total: 1,
          success: true,
          timestamp: new Date()
        };

        mockN8nAxiosClient.get.mockResolvedValue({ data: response });
        mockWorkflowRegistry.findOrCreate.mockResolvedValue([
          { ...mockWorkflowRegistryInstance, workflow_type: testCase.expected } as any,
          true
        ]);

        const result = await n8nService.discoverWorkflows();

        expect(result.success).toBe(true);
        expect(mockWorkflowRegistry.findOrCreate).toHaveBeenCalledWith({
          where: { workflow_id: workflow.id },
          defaults: expect.objectContaining({
            workflow_type: testCase.expected
          })
        });

        jest.clearAllMocks();
      }
    });

    it('should infer provider correctly', async () => {
      const testCases = [
        { name: 'AWS EC2 Discovery', expected: 'aws' },
        { name: 'Azure Resource Management', expected: 'azure' },
        { name: 'Google Cloud Platform Setup', expected: 'gcp' },
        { name: 'Alibaba Cloud Config', expected: 'ali' },
        { name: 'Oracle Cloud Infrastructure', expected: 'oci' },
        { name: 'Huawei Cloud Discovery', expected: 'huawei' },
        { name: 'Custom Platform Setup', expected: 'others' }
      ];

      for (const testCase of testCases) {
        const workflow = { ...mockWorkflow, name: testCase.name };
        const response: N8nWorkflowListResponse = {
          data: [workflow],
          nextCursor: null,
          total: 1,
          success: true,
          timestamp: new Date()
        };

        mockN8nAxiosClient.get.mockResolvedValue({ data: response });
        mockWorkflowRegistry.findOrCreate.mockResolvedValue([
          { ...mockWorkflowRegistryInstance, provider: testCase.expected } as any,
          true
        ]);

        const result = await n8nService.discoverWorkflows();

        expect(result.success).toBe(true);
        expect(mockWorkflowRegistry.findOrCreate).toHaveBeenCalledWith({
          where: { workflow_id: workflow.id },
          defaults: expect.objectContaining({
            provider: testCase.expected
          })
        });

        jest.clearAllMocks();
      }
    });

    it('should map n8n status to database status correctly', async () => {
      const statusMappings = [
        { n8nStatus: 'succeeded', dbStatus: 'success' },
        { n8nStatus: 'failed', dbStatus: 'failure' },
        { n8nStatus: 'crashed', dbStatus: 'failure' },
        { n8nStatus: 'running', dbStatus: 'running' },
        { n8nStatus: 'new', dbStatus: 'running' },
        { n8nStatus: 'waiting', dbStatus: 'running' },
        { n8nStatus: 'canceled', dbStatus: 'cancelled' }
      ];

      for (const mapping of statusMappings) {
        const execution = {
          ...mockWorkflowExecutionData,
          status: mapping.n8nStatus as WorkflowExecutionStatus
        };

        mockN8nAxiosClient.post.mockResolvedValue({ data: execution });
        mockWorkflowExecutionModel.create.mockResolvedValue(mockWorkflowExecutionInstance as any);
        mockWorkflowAlert.create.mockResolvedValue({} as any);

        await n8nService.executeWorkflow('workflow-123');

        expect(mockWorkflowExecutionModel.create).toHaveBeenCalledWith(
          expect.objectContaining({
            status: mapping.dbStatus
          })
        );

        jest.clearAllMocks();
      }
    });
  });

  describe('Database Integration', () => {
    it('should create workflow alerts for failed executions', async () => {
      const failedExecution = {
        ...mockWorkflowExecutionData,
        status: 'failed' as WorkflowExecutionStatus,
        data: {
          resultData: {
            runData: {},
            error: { message: 'Connection timeout', name: 'Error', timestamp: new Date().toISOString() }
          }
        }
      };

      mockWorkflowExecutionModel.upsert = jest.fn().mockImplementation(async (data) => {
        // Simulate the updateExecutionInDatabase call
        if (data.status === 'failure') {
          mockWorkflowAlert.findOrCreate.mockResolvedValue([{} as any, true]);
        }
      });

      // Test the pollWorkflowStatuses which calls updateExecutionInDatabase
      mockWorkflowRegistry.findAll.mockResolvedValue([{ workflow_id: 'workflow-123' }] as any);
      mockN8nAxiosClient.get.mockResolvedValue({
        data: { data: [failedExecution], nextCursor: null, total: 1, success: true, timestamp: new Date().toISOString() }
      });

      const result = await n8nService.pollWorkflowStatuses();

      expect(result.success).toBe(true);
      expect(mockWorkflowAlert.findOrCreate).toHaveBeenCalledWith({
        where: { execution_id: failedExecution.id },
        defaults: {
          execution_id: failedExecution.id,
          alert_type: 'failure',
          recipients: 'system@networkdb'
        }
      });
    });

    it('should handle alert creation errors gracefully', async () => {
      const failedExecution = {
        ...mockWorkflowExecutionData,
        status: 'failed' as WorkflowExecutionStatus,
        data: { 
          resultData: { 
            runData: {},
            error: { message: 'Error', name: 'Error', timestamp: new Date().toISOString() } 
          } 
        }
      };

      mockWorkflowExecutionModel.upsert = jest.fn();
      mockWorkflowAlert.findOrCreate.mockRejectedValue(new Error('Alert creation failed'));

      mockWorkflowRegistry.findAll.mockResolvedValue([{ workflow_id: 'workflow-123' }] as any);
      mockN8nAxiosClient.get.mockResolvedValue({
        data: { data: [failedExecution], nextCursor: null, total: 1, success: true, timestamp: new Date().toISOString() }
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      const result = await n8nService.pollWorkflowStatuses();

      expect(result.success).toBe(true); // Should continue despite alert error
      expect(consoleSpy).toHaveBeenCalledWith(
        '[N8nService] Failed to create alert for execution exec-123:',
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Performance and Concurrency', () => {
    it('should handle large datasets efficiently', async () => {
      const largeWorkflowList = Array.from({ length: 100 }, (_, i) => ({
        ...mockWorkflow,
        id: `workflow-${i}`,
        name: `Workflow ${i}`
      }));

      const response: N8nWorkflowListResponse = {
        data: largeWorkflowList,
        nextCursor: null,
        total: 100,
        success: true,
        timestamp: new Date()
      };

      mockN8nAxiosClient.get.mockResolvedValue({ data: response });
      mockWorkflowRegistry.findOrCreate.mockResolvedValue([mockWorkflowRegistryInstance as any, true]);

      const startTime = Date.now();
      const result = await n8nService.discoverWorkflows();
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(100);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent workflow polling', async () => {
      const workflowIds = ['workflow-1', 'workflow-2', 'workflow-3'];
      
      mockWorkflowRegistry.findAll.mockResolvedValue(
        workflowIds.map(id => ({ workflow_id: id })) as any
      );

      mockN8nAxiosClient.get.mockResolvedValue({
        data: { 
          data: [mockWorkflowExecutionData], 
          nextCursor: null, 
          total: 1, 
          success: true, 
          timestamp: new Date() 
        }
      });

      mockWorkflowExecutionModel.upsert = jest.fn().mockResolvedValue(undefined);

      const result = await n8nService.pollWorkflowStatuses({
        maxConcurrent: 3,
        batchSize: 10
      });

      expect(result.success).toBe(true);
      expect(mockN8nAxiosClient.get).toHaveBeenCalledTimes(3); // One call per workflow
    });
  });
});