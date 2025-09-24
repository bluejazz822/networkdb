/**
 * ReportDataService Test Suite
 *
 * Comprehensive tests for the report data service with >90% coverage.
 * Tests all query methods, data aggregation, caching integration,
 * and error handling scenarios.
 */

import { ReportDataService, reportDataService } from '../../src/services/ReportDataService';
import { reportingPool } from '../../src/database/connections/ReportingConnectionPool';
import { reportCache } from '../../src/database/cache/ReportCache';
import { ReportQueries, VPCInventoryQueries, PerformanceQueries } from '../../src/database/queries/ReportQueries';
import {
  ReportType,
  ReportCategory,
  CloudProvider,
  ExecutionStatus,
  TriggerType,
  ReportsTable,
  ReportExecutionsTable,
} from '../../src/database/schema/reports';

// Mock the database connections and cache
jest.mock('../../src/database/connections/ReportingConnectionPool');
jest.mock('../../src/database/cache/ReportCache');
jest.mock('../../src/database/queries/ReportQueries');

// Mock logger to avoid console output during tests
jest.mock('winston', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  })),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    label: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    colorize: jest.fn(),
    simple: jest.fn(),
  },
  transports: {
    Console: jest.fn(),
  },
}));

// Mock UUID generation
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

describe('ReportDataService', () => {
  let service: ReportDataService;
  let mockReportingPool: jest.Mocked<typeof reportingPool>;
  let mockReportCache: jest.Mocked<typeof reportCache>;
  let mockReportQueries: jest.Mocked<typeof ReportQueries>;

  // Sample test data
  const mockReport: ReportsTable = {
    id: 1,
    report_id: 'test-report-123',
    name: 'Test Report',
    description: 'A test report',
    report_type: ReportType.VPC_INVENTORY,
    category: ReportCategory.INFRASTRUCTURE,
    provider: CloudProvider.AWS,
    query_config: {
      query: 'SELECT * FROM vpcs',
      fields: ['vpc_id', 'name', 'cidr_block'],
    },
    output_format: 'json' as any,
    is_active: true,
    is_public: false,
    version: 1,
    created_at: new Date('2024-01-01'),
    updated_at: new Date('2024-01-01'),
  };

  const mockExecution: ReportExecutionsTable = {
    id: 1,
    execution_id: 'test-execution-123',
    report_id: 'test-report-123',
    status: ExecutionStatus.COMPLETED,
    trigger_type: TriggerType.MANUAL,
    start_time: new Date('2024-01-01T10:00:00Z'),
    end_time: new Date('2024-01-01T10:05:00Z'),
    duration_ms: 300000,
    records_processed: 100,
    created_at: new Date('2024-01-01T10:00:00Z'),
  };

  const mockPaginatedReports = {
    data: [mockReport],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      pages: 1,
      hasNext: false,
      hasPrev: false,
    },
  };

  const mockExecutionStats = {
    totalExecutions: 100,
    successfulExecutions: 95,
    failedExecutions: 5,
    runningExecutions: 0,
    averageExecutionTime: 250000,
    slowestExecution: 500000,
    fastestExecution: 50000,
    executionsByStatus: [
      { status: ExecutionStatus.COMPLETED, count: 95 },
      { status: ExecutionStatus.FAILED, count: 5 },
    ],
    executionsByType: [
      { report_type: ReportType.VPC_INVENTORY, count: 50 },
      { report_type: ReportType.SUBNET_UTILIZATION, count: 50 },
    ],
    dailyExecutions: [
      { date: '2024-01-01', count: 10 },
      { date: '2024-01-02', count: 15 },
    ],
  };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock implementations
    mockReportingPool = reportingPool as jest.Mocked<typeof reportingPool>;
    mockReportCache = reportCache as jest.Mocked<typeof reportCache>;
    mockReportQueries = ReportQueries as jest.Mocked<typeof ReportQueries>;

    // Default mock implementations
    mockReportingPool.initialize = jest.fn().mockResolvedValue(undefined);
    mockReportingPool.executeReportQuery = jest.fn().mockResolvedValue([]);
    mockReportingPool.getMetrics = jest.fn().mockReturnValue({
      totalConnections: 10,
      activeConnections: 5,
      idleConnections: 5,
      pendingRequests: 0,
      averageQueryTime: 100,
      slowQueries: 0,
      connectionUtilization: 0.5,
      lastHealthCheck: new Date(),
      poolEfficiency: 0.9,
    });
    mockReportingPool.checkHealth = jest.fn().mockResolvedValue({
      healthy: true,
      readPool: true,
      writePool: true,
      latency: 50,
    });
    mockReportingPool.getMaterializedViews = jest.fn().mockReturnValue([]);
    mockReportingPool.refreshMaterializedView = jest.fn().mockResolvedValue({
      viewName: 'test_view',
      lastRefreshed: new Date(),
      refreshDuration: 1000,
      recordCount: 100,
      isStale: false,
    });
    mockReportingPool.close = jest.fn().mockResolvedValue(undefined);

    mockReportCache.initialize = jest.fn().mockResolvedValue(undefined);
    mockReportCache.get = jest.fn().mockResolvedValue(null);
    mockReportCache.set = jest.fn().mockResolvedValue(undefined);
    mockReportCache.invalidate = jest.fn().mockResolvedValue(1);
    mockReportCache.triggerInvalidation = jest.fn().mockResolvedValue(undefined);
    mockReportCache.getStats = jest.fn().mockReturnValue({
      memoryCache: {
        entries: 100,
        memoryUsage: 1000000,
        hitRate: 0.8,
        missRate: 0.2,
        evictions: 5,
      },
      redisCache: {
        entries: 500,
        memoryUsage: '50MB',
        hitRate: 0.85,
        missRate: 0.15,
        connectionStatus: 'ready',
      },
      performance: {
        averageRetrievalTime: 10,
        averageStorageTime: 15,
        compressionRatio: 0.3,
        totalRequests: 1000,
        cacheEfficiency: 0.82,
      },
      invalidations: {
        manual: 10,
        ttlExpired: 50,
        memoryPressure: 5,
        patternBased: 20,
      },
    });
    mockReportCache.close = jest.fn().mockResolvedValue(undefined);

    // Setup query mock implementations
    mockReportQueries.getReports = jest.fn().mockResolvedValue({
      data: mockPaginatedReports,
      metadata: {
        executionTime: 100,
        recordCount: 1,
        fromCache: false,
        queryComplexity: 'simple' as const,
      },
    });

    mockReportQueries.getReportById = jest.fn().mockResolvedValue({
      data: mockReport,
      metadata: {
        executionTime: 50,
        recordCount: 1,
        fromCache: false,
        queryComplexity: 'simple' as const,
      },
    });

    mockReportQueries.getExecutions = jest.fn().mockResolvedValue({
      data: {
        data: [mockExecution],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
          hasNext: false,
          hasPrev: false,
        },
      },
      metadata: {
        executionTime: 75,
        recordCount: 1,
        fromCache: false,
        queryComplexity: 'simple' as const,
      },
    });

    mockReportQueries.getExecutionById = jest.fn().mockResolvedValue({
      data: mockExecution,
      metadata: {
        executionTime: 25,
        recordCount: 1,
        fromCache: false,
        queryComplexity: 'simple' as const,
      },
    });

    mockReportQueries.getExecutionStatistics = jest.fn().mockResolvedValue({
      data: mockExecutionStats,
      metadata: {
        executionTime: 200,
        recordCount: 1,
        fromCache: false,
        queryComplexity: 'complex' as const,
      },
    });

    mockReportQueries.getPerformanceMetrics = jest.fn().mockResolvedValue({
      data: {
        reportMetrics: [
          {
            reportId: 'test-report-123',
            reportName: 'Test Report',
            totalExecutions: 10,
            averageTime: 250000,
            successRate: 95,
            lastExecution: new Date(),
          },
        ],
        systemMetrics: {
          avgConcurrentExecutions: 2.5,
          peakConcurrentExecutions: 5,
          systemLoad: 0.3,
        },
      },
      metadata: {
        executionTime: 150,
        recordCount: 1,
        fromCache: false,
        queryComplexity: 'complex' as const,
      },
    });

    // Create new service instance for each test
    service = new ReportDataService();
  });

  describe('Initialization', () => {
    it('should initialize successfully', async () => {
      await service.initialize();

      expect(mockReportingPool.initialize).toHaveBeenCalledTimes(1);
      expect(mockReportCache.initialize).toHaveBeenCalledTimes(1);
    });

    it('should handle initialization errors', async () => {
      const error = new Error('Initialization failed');
      mockReportingPool.initialize.mockRejectedValue(error);

      await expect(service.initialize()).rejects.toThrow('Initialization failed');
    });

    it('should not initialize twice', async () => {
      await service.initialize();
      await service.initialize();

      expect(mockReportingPool.initialize).toHaveBeenCalledTimes(1);
      expect(mockReportCache.initialize).toHaveBeenCalledTimes(1);
    });
  });

  describe('Report Management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('getReports', () => {
      it('should fetch reports successfully', async () => {
        const result = await service.getReports();

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockPaginatedReports);
        expect(mockReportQueries.getReports).toHaveBeenCalledWith(
          undefined,
          undefined,
          expect.any(Object)
        );
      });

      it('should handle filters and pagination', async () => {
        const filters = { report_type: ReportType.VPC_INVENTORY };
        const pagination = { page: 1, limit: 20 };

        await service.getReports(filters, pagination);

        expect(mockReportQueries.getReports).toHaveBeenCalledWith(
          filters,
          pagination,
          expect.any(Object)
        );
      });

      it('should handle query errors', async () => {
        const error = new Error('Database error');
        mockReportQueries.getReports.mockRejectedValue(error);

        const result = await service.getReports();

        expect(result.success).toBe(false);
        expect(result.errors?.[0].code).toBe('QUERY_ERROR');
      });

      it('should respect caching options', async () => {
        const options = { useCache: true, cacheTtl: 600000 };

        await service.getReports(undefined, undefined, options);

        expect(mockReportQueries.getReports).toHaveBeenCalledWith(
          undefined,
          undefined,
          expect.objectContaining({
            useCache: true,
            cacheTtl: 600000,
          })
        );
      });
    });

    describe('getReportById', () => {
      it('should fetch report by ID successfully', async () => {
        const result = await service.getReportById('test-report-123');

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockReport);
        expect(mockReportQueries.getReportById).toHaveBeenCalledWith(
          'test-report-123',
          expect.any(Object)
        );
      });

      it('should handle not found', async () => {
        mockReportQueries.getReportById.mockResolvedValue({
          data: null,
          metadata: {
            executionTime: 50,
            recordCount: 0,
            fromCache: false,
            queryComplexity: 'simple' as const,
          },
        });

        const result = await service.getReportById('nonexistent');

        expect(result.success).toBe(false);
        expect(result.errors?.[0].code).toBe('NOT_FOUND');
      });

      it('should use default cache settings', async () => {
        await service.getReportById('test-report-123');

        expect(mockReportQueries.getReportById).toHaveBeenCalledWith(
          'test-report-123',
          expect.objectContaining({
            useCache: true,
            cacheTtl: 300000,
          })
        );
      });
    });
  });

  describe('Execution Management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('getExecutions', () => {
      it('should fetch executions successfully', async () => {
        const result = await service.getExecutions();

        expect(result.success).toBe(true);
        expect(result.data?.data).toEqual([mockExecution]);
        expect(mockReportQueries.getExecutions).toHaveBeenCalledWith(
          undefined,
          undefined,
          expect.any(Object)
        );
      });

      it('should handle filters', async () => {
        const filters = { status: ExecutionStatus.COMPLETED };

        await service.getExecutions(filters);

        expect(mockReportQueries.getExecutions).toHaveBeenCalledWith(
          filters,
          undefined,
          expect.any(Object)
        );
      });

      it('should handle query errors', async () => {
        const error = new Error('Database error');
        mockReportQueries.getExecutions.mockRejectedValue(error);

        const result = await service.getExecutions();

        expect(result.success).toBe(false);
        expect(result.errors?.[0].code).toBe('QUERY_ERROR');
      });
    });

    describe('getExecutionById', () => {
      it('should fetch execution by ID successfully', async () => {
        const result = await service.getExecutionById('test-execution-123');

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockExecution);
        expect(mockReportQueries.getExecutionById).toHaveBeenCalledWith(
          'test-execution-123',
          expect.any(Object)
        );
      });

      it('should handle not found', async () => {
        mockReportQueries.getExecutionById.mockResolvedValue({
          data: null,
          metadata: {
            executionTime: 25,
            recordCount: 0,
            fromCache: false,
            queryComplexity: 'simple' as const,
          },
        });

        const result = await service.getExecutionById('nonexistent');

        expect(result.success).toBe(false);
        expect(result.errors?.[0].code).toBe('NOT_FOUND');
      });
    });
  });

  describe('Analytics and Aggregation', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('getExecutionStatistics', () => {
      it('should fetch execution statistics successfully', async () => {
        const result = await service.getExecutionStatistics();

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockExecutionStats);
        expect(mockReportQueries.getExecutionStatistics).toHaveBeenCalledWith(
          undefined,
          expect.any(Object)
        );
      });

      it('should handle time range', async () => {
        const timeRange = {
          start: new Date('2024-01-01'),
          end: new Date('2024-01-31'),
        };

        await service.getExecutionStatistics(timeRange);

        expect(mockReportQueries.getExecutionStatistics).toHaveBeenCalledWith(
          timeRange,
          expect.any(Object)
        );
      });

      it('should use cache by default', async () => {
        await service.getExecutionStatistics();

        expect(mockReportQueries.getExecutionStatistics).toHaveBeenCalledWith(
          undefined,
          expect.objectContaining({
            useCache: true,
            cacheTtl: 120000,
          })
        );
      });
    });

    describe('getPerformanceMetrics', () => {
      it('should fetch performance metrics successfully', async () => {
        const result = await service.getPerformanceMetrics();

        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
        expect(mockReportQueries.getPerformanceMetrics).toHaveBeenCalledWith(
          undefined,
          expect.any(Object)
        );
      });

      it('should handle specific report ID', async () => {
        await service.getPerformanceMetrics('test-report-123');

        expect(mockReportQueries.getPerformanceMetrics).toHaveBeenCalledWith(
          'test-report-123',
          expect.any(Object)
        );
      });
    });

    describe('aggregateData', () => {
      it('should aggregate data successfully', async () => {
        const aggregationOptions = {
          groupBy: ['provider'],
          aggregations: [
            { field: 'vpc_count', function: 'COUNT' as const, alias: 'total_vpcs' },
          ],
        };

        mockReportingPool.executeReportQuery.mockResolvedValue([
          { provider: 'aws', total_vpcs: 10 },
          { provider: 'azure', total_vpcs: 5 },
        ]);

        const result = await service.aggregateData('vpcs', aggregationOptions);

        expect(result.success).toBe(true);
        expect(result.data).toEqual([
          { provider: 'aws', total_vpcs: 10 },
          { provider: 'azure', total_vpcs: 5 },
        ]);
        expect(mockReportingPool.executeReportQuery).toHaveBeenCalled();
      });

      it('should handle caching', async () => {
        const aggregationOptions = {
          groupBy: ['provider'],
          aggregations: [
            { field: 'vpc_count', function: 'COUNT' as const },
          ],
        };

        // First call - miss cache
        mockReportCache.get.mockResolvedValue(null);
        mockReportingPool.executeReportQuery.mockResolvedValue([
          { provider: 'aws', count_vpc_count: 10 },
        ]);

        await service.aggregateData('vpcs', aggregationOptions);

        expect(mockReportCache.set).toHaveBeenCalled();

        // Second call - hit cache
        mockReportCache.get.mockResolvedValue([
          { provider: 'aws', count_vpc_count: 10 },
        ]);

        const result = await service.aggregateData('vpcs', aggregationOptions);

        expect(result.success).toBe(true);
        expect(result.data).toEqual([
          { provider: 'aws', count_vpc_count: 10 },
        ]);
      });

      it('should handle time range aggregation', async () => {
        const aggregationOptions = {
          groupBy: ['created_at'],
          aggregations: [
            { field: 'id', function: 'COUNT' as const },
          ],
          timeRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-31'),
            granularity: 'day' as const,
          },
        };

        mockReportingPool.executeReportQuery.mockResolvedValue([
          { created_at: '2024-01-01', count_id: 5 },
        ]);

        const result = await service.aggregateData('reports', aggregationOptions);

        expect(result.success).toBe(true);
        expect(mockReportingPool.executeReportQuery).toHaveBeenCalledWith(
          expect.stringContaining('DATE_TRUNC'),
          expect.objectContaining({
            startDate: aggregationOptions.timeRange.start,
            endDate: aggregationOptions.timeRange.end,
          }),
          expect.any(Object)
        );
      });
    });
  });

  describe('VPC Inventory Queries', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('getVPCsByProvider', () => {
      it('should fetch VPCs by provider successfully', async () => {
        const mockVPCs = [
          {
            provider: 'aws',
            vpc_id: 'vpc-123',
            name: 'Test VPC',
            cidr_block: '10.0.0.0/16',
            subnet_count: 2,
          },
        ];

        (VPCInventoryQueries.getVPCsByProvider as jest.Mock).mockResolvedValue({
          data: mockVPCs,
          metadata: {
            executionTime: 100,
            recordCount: 1,
            fromCache: false,
            queryComplexity: 'moderate' as const,
          },
        });

        const result = await service.getVPCsByProvider(CloudProvider.AWS);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockVPCs);
        expect(VPCInventoryQueries.getVPCsByProvider).toHaveBeenCalledWith(
          CloudProvider.AWS,
          expect.any(Object)
        );
      });

      it('should handle errors', async () => {
        const error = new Error('VPC query failed');
        (VPCInventoryQueries.getVPCsByProvider as jest.Mock).mockRejectedValue(error);

        const result = await service.getVPCsByProvider();

        expect(result.success).toBe(false);
        expect(result.errors?.[0].code).toBe('QUERY_ERROR');
      });
    });

    describe('getSubnetUtilization', () => {
      it('should fetch subnet utilization successfully', async () => {
        const mockSubnets = [
          {
            subnet_id: 'subnet-123',
            name: 'Test Subnet',
            cidr_block: '10.0.1.0/24',
            utilization_percentage: 75,
          },
        ];

        (VPCInventoryQueries.getSubnetUtilization as jest.Mock).mockResolvedValue({
          data: mockSubnets,
          metadata: {
            executionTime: 150,
            recordCount: 1,
            fromCache: false,
            queryComplexity: 'moderate' as const,
          },
        });

        const result = await service.getSubnetUtilization('vpc-123');

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockSubnets);
        expect(VPCInventoryQueries.getSubnetUtilization).toHaveBeenCalledWith(
          'vpc-123',
          expect.any(Object)
        );
      });
    });
  });

  describe('Performance Monitoring', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('getSlowQueries', () => {
      it('should fetch slow queries successfully', async () => {
        const mockSlowQueries = [
          {
            execution_id: 'exec-123',
            report_name: 'Slow Report',
            duration_ms: 5000,
            records_processed: 1000,
          },
        ];

        (PerformanceQueries.getSlowQueries as jest.Mock).mockResolvedValue({
          data: mockSlowQueries,
          metadata: {
            executionTime: 50,
            recordCount: 1,
            fromCache: false,
            queryComplexity: 'simple' as const,
          },
        });

        const result = await service.getSlowQueries(2000, 25);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockSlowQueries);
        expect(PerformanceQueries.getSlowQueries).toHaveBeenCalledWith(
          2000,
          25,
          expect.any(Object)
        );
      });
    });
  });

  describe('Custom Query Execution', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('executeCustomQuery', () => {
      it('should execute safe custom queries successfully', async () => {
        const query = 'SELECT vpc_id, name FROM vpcs WHERE provider = :provider';
        const replacements = { provider: 'aws' };
        const mockResult = [{ vpc_id: 'vpc-123', name: 'Test VPC' }];

        mockReportingPool.executeReportQuery.mockResolvedValue(mockResult);

        const result = await service.executeCustomQuery(query, replacements);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(mockResult);
        expect(mockReportingPool.executeReportQuery).toHaveBeenCalledWith(
          query,
          replacements,
          expect.any(Object)
        );
      });

      it('should reject dangerous queries', async () => {
        const dangerousQuery = 'DROP TABLE vpcs';

        const result = await service.executeCustomQuery(dangerousQuery);

        expect(result.success).toBe(false);
        expect(result.errors?.[0].code).toBe('INVALID_QUERY');
        expect(mockReportingPool.executeReportQuery).not.toHaveBeenCalled();
      });

      it('should handle execution errors', async () => {
        const query = 'SELECT * FROM vpcs';
        const error = new Error('Query execution failed');
        mockReportingPool.executeReportQuery.mockRejectedValue(error);

        const result = await service.executeCustomQuery(query);

        expect(result.success).toBe(false);
        expect(result.errors?.[0].code).toBe('QUERY_ERROR');
      });
    });
  });

  describe('Materialized View Management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('refreshMaterializedViews', () => {
      it('should refresh specific views', async () => {
        const viewNames = ['vpc_summary_mv', 'subnet_stats_mv'];
        const mockViewInfo = {
          viewName: 'vpc_summary_mv',
          lastRefreshed: new Date(),
          refreshDuration: 1000,
          recordCount: 100,
          isStale: false,
        };

        mockReportingPool.refreshMaterializedView.mockResolvedValue(mockViewInfo);

        const result = await service.refreshMaterializedViews(viewNames);

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(2);
        expect(mockReportingPool.refreshMaterializedView).toHaveBeenCalledTimes(2);
        expect(mockReportCache.triggerInvalidation).toHaveBeenCalledWith(
          'data_change',
          expect.objectContaining({
            views: expect.arrayContaining(viewNames),
          })
        );
      });

      it('should refresh all stale views when no specific views provided', async () => {
        const staleViews = [
          {
            viewName: 'stale_view_mv',
            lastRefreshed: new Date(Date.now() - 3600000),
            refreshDuration: 1000,
            recordCount: 50,
            isStale: true,
          },
        ];

        mockReportingPool.getMaterializedViews.mockReturnValue(staleViews);
        mockReportingPool.refreshMaterializedView.mockResolvedValue(staleViews[0]);

        const result = await service.refreshMaterializedViews();

        expect(result.success).toBe(true);
        expect(result.data).toHaveLength(1);
        expect(mockReportingPool.refreshMaterializedView).toHaveBeenCalledWith(
          'stale_view_mv',
          undefined
        );
      });

      it('should handle refresh errors', async () => {
        const viewNames = ['failing_view_mv'];
        const error = new Error('View refresh failed');
        mockReportingPool.refreshMaterializedView.mockRejectedValue(error);

        const result = await service.refreshMaterializedViews(viewNames);

        expect(result.success).toBe(false);
        expect(result.errors?.[0].code).toBe('VIEW_REFRESH_ERROR');
      });
    });
  });

  describe('Cache Management', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('clearCache', () => {
      it('should clear cache by pattern', async () => {
        mockReportCache.invalidate.mockResolvedValue(10);

        const result = await service.clearCache('report:*', 'Manual cleanup');

        expect(result.success).toBe(true);
        expect(result.data?.cleared).toBe(10);
        expect(mockReportCache.invalidate).toHaveBeenCalledWith(
          'report:*',
          { reason: 'Manual cleanup' }
        );
      });

      it('should clear all cache when no pattern provided', async () => {
        mockReportCache.invalidate.mockResolvedValue(50);

        const result = await service.clearCache();

        expect(result.success).toBe(true);
        expect(result.data?.cleared).toBe(50);
        expect(mockReportCache.invalidate).toHaveBeenCalledWith(
          '*',
          { reason: undefined }
        );
      });

      it('should handle cache errors', async () => {
        const error = new Error('Cache clear failed');
        mockReportCache.invalidate.mockRejectedValue(error);

        const result = await service.clearCache();

        expect(result.success).toBe(false);
        expect(result.errors?.[0].code).toBe('CACHE_ERROR');
      });
    });
  });

  describe('Service Metrics', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('getServiceMetrics', () => {
      it('should return comprehensive metrics', async () => {
        const result = await service.getServiceMetrics();

        expect(result.success).toBe(true);
        expect(result.data).toHaveProperty('reporting');
        expect(result.data).toHaveProperty('cache');
        expect(result.data).toHaveProperty('service');
        expect(mockReportingPool.getMetrics).toHaveBeenCalled();
        expect(mockReportCache.getStats).toHaveBeenCalled();
      });

      it('should handle metrics errors', async () => {
        const error = new Error('Metrics collection failed');
        mockReportingPool.getMetrics.mockImplementation(() => {
          throw error;
        });

        const result = await service.getServiceMetrics();

        expect(result.success).toBe(false);
        expect(result.errors?.[0].code).toBe('METRICS_ERROR');
      });
    });
  });

  describe('Health Check', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    describe('checkHealth', () => {
      it('should return healthy status when all components are healthy', async () => {
        const result = await service.checkHealth();

        expect(result.success).toBe(true);
        expect(result.data?.healthy).toBe(true);
        expect(result.data?.components.reportingPool).toBe(true);
        expect(result.data?.components.cache).toBe(true);
        expect(result.data?.components.service).toBe(true);
        expect(mockReportingPool.checkHealth).toHaveBeenCalled();
        expect(mockReportCache.getStats).toHaveBeenCalled();
      });

      it('should return unhealthy status when reporting pool is down', async () => {
        mockReportingPool.checkHealth.mockResolvedValue({
          healthy: false,
          readPool: false,
          writePool: true,
          latency: 1000,
          error: 'Connection failed',
        });

        const result = await service.checkHealth();

        expect(result.success).toBe(true);
        expect(result.data?.healthy).toBe(false);
        expect(result.data?.components.reportingPool).toBe(false);
      });

      it('should handle health check errors', async () => {
        const error = new Error('Health check failed');
        mockReportingPool.checkHealth.mockRejectedValue(error);

        const result = await service.checkHealth();

        expect(result.success).toBe(false);
        expect(result.errors?.[0].code).toBe('HEALTH_CHECK_ERROR');
      });
    });
  });

  describe('Service Lifecycle', () => {
    it('should close service and cleanup resources', async () => {
      await service.initialize();
      await service.close();

      expect(mockReportingPool.close).toHaveBeenCalled();
      expect(mockReportCache.close).toHaveBeenCalled();
    });

    it('should handle close errors gracefully', async () => {
      await service.initialize();

      const error = new Error('Close failed');
      mockReportingPool.close.mockRejectedValue(error);

      // Should not throw
      await expect(service.close()).resolves.not.toThrow();
    });
  });

  describe('Service Metrics Tracking', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should track response times and success rates', async () => {
      // Execute several operations
      await service.getReports();
      await service.getReportById('test-report-123');

      const metricsResult = await service.getServiceMetrics();

      expect(metricsResult.success).toBe(true);
      expect(metricsResult.data?.service.totalQueries).toBeGreaterThan(0);
      expect(metricsResult.data?.service.averageResponseTime).toBeGreaterThan(0);
    });

    it('should track error rates', async () => {
      // Force an error
      mockReportQueries.getReports.mockRejectedValue(new Error('Test error'));

      await service.getReports();

      const metricsResult = await service.getServiceMetrics();

      expect(metricsResult.success).toBe(true);
      expect(metricsResult.data?.service.errorRate).toBeGreaterThan(0);
    });
  });

  describe('Singleton and Utility Functions', () => {
    it('should provide singleton instance', () => {
      expect(reportDataService).toBeInstanceOf(ReportDataService);
    });

    it('should have utility functions', async () => {
      // These would be imported from the module
      // Testing that they exist and work as expected
      const { initializeReportDataService, getReportDataService, closeReportDataService } =
        await import('../../src/services/ReportDataService');

      expect(typeof initializeReportDataService).toBe('function');
      expect(typeof getReportDataService).toBe('function');
      expect(typeof closeReportDataService).toBe('function');

      const serviceInstance = getReportDataService();
      expect(serviceInstance).toBeInstanceOf(ReportDataService);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    beforeEach(async () => {
      await service.initialize();
    });

    it('should handle empty query results gracefully', async () => {
      mockReportQueries.getReports.mockResolvedValue({
        data: {
          data: [],
          pagination: {
            page: 1,
            limit: 10,
            total: 0,
            pages: 0,
            hasNext: false,
            hasPrev: false,
          },
        },
        metadata: {
          executionTime: 50,
          recordCount: 0,
          fromCache: false,
          queryComplexity: 'simple' as const,
        },
      });

      const result = await service.getReports();

      expect(result.success).toBe(true);
      expect(result.data?.data).toEqual([]);
    });

    it('should handle invalid aggregation options', async () => {
      const invalidOptions = {
        groupBy: ['nonexistent_field'],
        aggregations: [
          { field: 'invalid_field', function: 'INVALID' as any },
        ],
      };

      mockReportingPool.executeReportQuery.mockRejectedValue(
        new Error('Column "nonexistent_field" does not exist')
      );

      const result = await service.aggregateData('vpcs', invalidOptions);

      expect(result.success).toBe(false);
      expect(result.errors?.[0].code).toBe('AGGREGATION_ERROR');
    });

    it('should handle network timeouts', async () => {
      const timeoutError = new Error('Query timeout');
      timeoutError.name = 'SequelizeTimeoutError';
      mockReportingPool.executeReportQuery.mockRejectedValue(timeoutError);

      const result = await service.executeCustomQuery('SELECT * FROM vpcs');

      expect(result.success).toBe(false);
      expect(result.errors?.[0].code).toBe('QUERY_ERROR');
    });
  });
});