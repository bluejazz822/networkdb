/**
 * Comprehensive Tests for ReportQueries
 *
 * Tests optimized query patterns, prepared statements, filtering,
 * pagination, and specialized query builders.
 */

import { jest, describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from '@jest/globals';
import ReportQueries, {
  VPCInventoryQueries,
  PerformanceQueries,
  QueryExecutionOptions,
  QueryResult,
  QueryMetadata,
} from '../../../database/queries/ReportQueries';
import {
  ReportType,
  ReportCategory,
  CloudProvider,
  ExecutionStatus,
  TriggerType,
  ReportFilters,
  ExecutionFilters,
  PaginationOptions,
  ReportsTable,
  ReportExecutionsTable,
} from '../../../database/schema/reports';

// Mock the executeReportQuery function
jest.mock('../../../database/connections/ReportingConnectionPool', () => ({
  executeReportQuery: jest.fn(),
}));

describe('ReportQueries', () => {
  let mockExecuteReportQuery: jest.MockedFunction<any>;

  beforeAll(() => {
    mockExecuteReportQuery = require('../../../database/connections/ReportingConnectionPool').executeReportQuery;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Report CRUD Operations', () => {
    describe('getReports', () => {
      it('should retrieve reports with basic pagination', async () => {
        const mockReportsData = [
          {
            id: 1,
            report_id: 'rpt_001',
            name: 'VPC Inventory',
            report_type: ReportType.VPC_INVENTORY,
            category: ReportCategory.INFRASTRUCTURE,
            provider: CloudProvider.AWS,
            execution_count: 5,
            successful_executions: 4,
            failed_executions: 1,
          },
        ];

        const mockCountData = [{ total: 1 }];

        mockExecuteReportQuery
          .mockResolvedValueOnce(mockReportsData)
          .mockResolvedValueOnce(mockCountData);

        const pagination: PaginationOptions = {
          page: 1,
          limit: 10,
          sort: 'name',
          order: 'ASC',
        };

        const result = await ReportQueries.getReports({}, pagination);

        expect(result.data.data).toEqual(mockReportsData);
        expect(result.data.pagination).toEqual({
          page: 1,
          limit: 10,
          total: 1,
          pages: 1,
          hasNext: false,
          hasPrev: false,
        });
        expect(result.metadata.recordCount).toBe(1);
        expect(result.metadata.queryComplexity).toBe('moderate');
      });

      it('should apply filters correctly', async () => {
        const filters: ReportFilters = {
          report_type: ReportType.VPC_INVENTORY,
          category: ReportCategory.INFRASTRUCTURE,
          provider: CloudProvider.AWS,
          is_active: true,
          search: 'vpc',
          created_after: new Date('2023-01-01'),
        };

        mockExecuteReportQuery
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ total: 0 }]);

        await ReportQueries.getReports(filters);

        // Verify the first call (main query) includes proper WHERE clauses
        const firstCall = mockExecuteReportQuery.mock.calls[0];
        const query = firstCall[0];
        const replacements = firstCall[1];

        expect(query).toContain('WHERE');
        expect(query).toContain('r.report_type = :reportType');
        expect(query).toContain('r.category = :category');
        expect(query).toContain('r.provider = :provider');
        expect(query).toContain('r.is_active = :isActive');
        expect(query).toContain('r.name LIKE :search OR r.description LIKE :search');
        expect(query).toContain('r.created_at >= :createdAfter');

        expect(replacements.reportType).toBe(ReportType.VPC_INVENTORY);
        expect(replacements.category).toBe(ReportCategory.INFRASTRUCTURE);
        expect(replacements.provider).toBe(CloudProvider.AWS);
        expect(replacements.isActive).toBe(true);
        expect(replacements.search).toBe('%vpc%');
        expect(replacements.createdAfter).toBeInstanceOf(Date);
      });

      it('should handle array filters correctly', async () => {
        const filters: ReportFilters = {
          report_type: [ReportType.VPC_INVENTORY, ReportType.SUBNET_UTILIZATION],
          provider: [CloudProvider.AWS, CloudProvider.AZURE],
        };

        mockExecuteReportQuery
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ total: 0 }]);

        await ReportQueries.getReports(filters);

        const firstCall = mockExecuteReportQuery.mock.calls[0];
        const query = firstCall[0];
        const replacements = firstCall[1];

        expect(query).toContain('r.report_type IN (:reportTypes)');
        expect(query).toContain('r.provider IN (:providers)');
        expect(replacements.reportTypes).toEqual([ReportType.VPC_INVENTORY, ReportType.SUBNET_UTILIZATION]);
        expect(replacements.providers).toEqual([CloudProvider.AWS, CloudProvider.AZURE]);
      });

      it('should apply proper sorting and pagination limits', async () => {
        const pagination: PaginationOptions = {
          page: 2,
          limit: 25,
          sort: 'created_at',
          order: 'DESC',
        };

        mockExecuteReportQuery
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ total: 100 }]);

        await ReportQueries.getReports({}, pagination);

        const firstCall = mockExecuteReportQuery.mock.calls[0];
        const query = firstCall[0];
        const replacements = firstCall[1];

        expect(query).toContain('ORDER BY created_at DESC');
        expect(query).toContain('LIMIT :limit OFFSET :offset');
        expect(replacements.limit).toBe(25);
        expect(replacements.offset).toBe(25); // (page 2 - 1) * limit 25
      });

      it('should enforce maximum limit of 1000', async () => {
        const pagination: PaginationOptions = {
          page: 1,
          limit: 2000, // Exceeds maximum
        };

        mockExecuteReportQuery
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ total: 0 }]);

        await ReportQueries.getReports({}, pagination);

        const firstCall = mockExecuteReportQuery.mock.calls[0];
        const replacements = firstCall[1];

        expect(replacements.limit).toBe(1000); // Should be capped at 1000
      });

      it('should handle query execution errors', async () => {
        mockExecuteReportQuery.mockRejectedValueOnce(new Error('Database connection failed'));

        await expect(ReportQueries.getReports()).rejects.toThrow('Database connection failed');
      });

      it('should execute queries with proper options', async () => {
        const options: QueryExecutionOptions = {
          useCache: true,
          cacheTtl: 300000,
          timeout: 5000,
        };

        mockExecuteReportQuery
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ total: 0 }]);

        await ReportQueries.getReports({}, {}, options);

        const firstCall = mockExecuteReportQuery.mock.calls[0];
        const secondCall = mockExecuteReportQuery.mock.calls[1];

        expect(firstCall[2]).toEqual(options);
        expect(secondCall[2]).toEqual({ ...options, useCache: true, cacheTtl: 60000 });
      });
    });

    describe('getReportById', () => {
      it('should retrieve a single report with execution summary', async () => {
        const mockReport = {
          id: 1,
          report_id: 'rpt_001',
          name: 'Test Report',
          execution_count: 10,
          avg_execution_time: 2500,
          successful_executions: 8,
          failed_executions: 2,
          running_executions: 0,
        };

        mockExecuteReportQuery.mockResolvedValueOnce([mockReport]);

        const result = await ReportQueries.getReportById('rpt_001');

        expect(result.data).toEqual(mockReport);
        expect(result.metadata.recordCount).toBe(1);
        expect(result.metadata.queryComplexity).toBe('moderate');

        const call = mockExecuteReportQuery.mock.calls[0];
        const query = call[0];
        const replacements = call[1];
        const options = call[2];

        expect(query).toContain('WHERE r.report_id = :reportId');
        expect(replacements.reportId).toBe('rpt_001');
        expect(options.useCache).toBe(true);
        expect(options.cacheTtl).toBe(300000);
      });

      it('should return null for non-existent report', async () => {
        mockExecuteReportQuery.mockResolvedValueOnce([]);

        const result = await ReportQueries.getReportById('non_existent');

        expect(result.data).toBeNull();
        expect(result.metadata.recordCount).toBe(0);
      });

      it('should handle custom options', async () => {
        const options: QueryExecutionOptions = {
          useCache: false,
          timeout: 10000,
        };

        mockExecuteReportQuery.mockResolvedValueOnce([]);

        await ReportQueries.getReportById('rpt_001', options);

        const call = mockExecuteReportQuery.mock.calls[0];
        expect(call[2]).toEqual({ ...options, useCache: true, cacheTtl: 300000 });
      });
    });
  });

  describe('Execution Queries', () => {
    describe('getExecutions', () => {
      it('should retrieve executions with filtering and pagination', async () => {
        const mockExecutions = [
          {
            id: 1,
            execution_id: 'exec_001',
            report_id: 'rpt_001',
            status: ExecutionStatus.COMPLETED,
            trigger_type: TriggerType.MANUAL,
            report_name: 'Test Report',
            report_type: ReportType.VPC_INVENTORY,
          },
        ];

        const filters: ExecutionFilters = {
          report_id: 'rpt_001',
          status: ExecutionStatus.COMPLETED,
          started_after: new Date('2023-01-01'),
        };

        mockExecuteReportQuery
          .mockResolvedValueOnce(mockExecutions)
          .mockResolvedValueOnce([{ total: 1 }]);

        const result = await ReportQueries.getExecutions(filters);

        expect(result.data.data).toEqual(mockExecutions);

        const firstCall = mockExecuteReportQuery.mock.calls[0];
        const query = firstCall[0];
        const replacements = firstCall[1];

        expect(query).toContain('re.report_id = :reportId');
        expect(query).toContain('re.status = :status');
        expect(query).toContain('re.start_time >= :startedAfter');
        expect(replacements.reportId).toBe('rpt_001');
        expect(replacements.status).toBe(ExecutionStatus.COMPLETED);
      });

      it('should handle array filters for executions', async () => {
        const filters: ExecutionFilters = {
          status: [ExecutionStatus.COMPLETED, ExecutionStatus.FAILED],
          trigger_type: [TriggerType.MANUAL, TriggerType.SCHEDULED],
        };

        mockExecuteReportQuery
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ total: 0 }]);

        await ReportQueries.getExecutions(filters);

        const firstCall = mockExecuteReportQuery.mock.calls[0];
        const query = firstCall[0];
        const replacements = firstCall[1];

        expect(query).toContain('re.status IN (:statuses)');
        expect(query).toContain('re.trigger_type IN (:triggerTypes)');
        expect(replacements.statuses).toEqual([ExecutionStatus.COMPLETED, ExecutionStatus.FAILED]);
        expect(replacements.triggerTypes).toEqual([TriggerType.MANUAL, TriggerType.SCHEDULED]);
      });

      it('should handle duration range filters', async () => {
        const filters: ExecutionFilters = {
          min_duration: 1000,
          max_duration: 10000,
        };

        mockExecuteReportQuery
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ total: 0 }]);

        await ReportQueries.getExecutions(filters);

        const firstCall = mockExecuteReportQuery.mock.calls[0];
        const query = firstCall[0];
        const replacements = firstCall[1];

        expect(query).toContain('re.duration_ms >= :minDuration');
        expect(query).toContain('re.duration_ms <= :maxDuration');
        expect(replacements.minDuration).toBe(1000);
        expect(replacements.maxDuration).toBe(10000);
      });

      it('should handle error filtering', async () => {
        const filtersWithErrors: ExecutionFilters = { has_errors: true };
        const filtersWithoutErrors: ExecutionFilters = { has_errors: false };

        mockExecuteReportQuery.mockResolvedValue([]).mockResolvedValue([{ total: 0 }]);

        await ReportQueries.getExecutions(filtersWithErrors);
        const firstCall = mockExecuteReportQuery.mock.calls[0];
        expect(firstCall[0]).toContain('re.error_message IS NOT NULL');

        jest.clearAllMocks();
        mockExecuteReportQuery.mockResolvedValue([]).mockResolvedValue([{ total: 0 }]);

        await ReportQueries.getExecutions(filtersWithoutErrors);
        const secondCall = mockExecuteReportQuery.mock.calls[0];
        expect(secondCall[0]).toContain('re.error_message IS NULL');
      });
    });

    describe('getExecutionById', () => {
      it('should retrieve execution details by ID', async () => {
        const mockExecution = {
          id: 1,
          execution_id: 'exec_001',
          report_id: 'rpt_001',
          status: ExecutionStatus.COMPLETED,
          report_name: 'Test Report',
          report_type: ReportType.VPC_INVENTORY,
        };

        mockExecuteReportQuery.mockResolvedValueOnce([mockExecution]);

        const result = await ReportQueries.getExecutionById('exec_001');

        expect(result.data).toEqual(mockExecution);
        expect(result.metadata.queryComplexity).toBe('simple');

        const call = mockExecuteReportQuery.mock.calls[0];
        expect(call[1].executionId).toBe('exec_001');
        expect(call[2].cacheTtl).toBe(180000); // 3 minutes
      });
    });
  });

  describe('Analytics Queries', () => {
    describe('getExecutionStatistics', () => {
      it('should retrieve comprehensive execution statistics', async () => {
        const mockStats = {
          total_executions: 100,
          successful_executions: 85,
          failed_executions: 10,
          running_executions: 5,
          average_execution_time: 2500,
          slowest_execution: 15000,
          fastest_execution: 500,
        };

        const mockStatusStats = [
          { status: ExecutionStatus.COMPLETED, count: 85 },
          { status: ExecutionStatus.FAILED, count: 10 },
          { status: ExecutionStatus.RUNNING, count: 5 },
        ];

        const mockTypeStats = [
          { report_type: ReportType.VPC_INVENTORY, count: 50 },
          { report_type: ReportType.SUBNET_UTILIZATION, count: 30 },
        ];

        const mockDailyStats = [
          { date: '2023-12-01', count: 25 },
          { date: '2023-12-02', count: 30 },
        ];

        mockExecuteReportQuery
          .mockResolvedValueOnce([mockStats])
          .mockResolvedValueOnce(mockStatusStats)
          .mockResolvedValueOnce(mockTypeStats)
          .mockResolvedValueOnce(mockDailyStats);

        const timeRange = {
          start: new Date('2023-12-01'),
          end: new Date('2023-12-31'),
        };

        const result = await ReportQueries.getExecutionStatistics(timeRange);

        expect(result.data).toEqual({
          totalExecutions: 100,
          successfulExecutions: 85,
          failedExecutions: 10,
          runningExecutions: 5,
          averageExecutionTime: 2500,
          slowestExecution: 15000,
          fastestExecution: 500,
          executionsByStatus: mockStatusStats,
          executionsByType: mockTypeStats,
          dailyExecutions: mockDailyStats,
        });

        expect(result.metadata.queryComplexity).toBe('complex');
        expect(result.metadata.optimizationHints).toContain('Consider indexing on start_time for time-range queries');

        // Verify time range was applied to all queries
        const calls = mockExecuteReportQuery.mock.calls;
        calls.forEach(call => {
          const replacements = call[1];
          if (Object.keys(replacements).length > 0) {
            expect(replacements.startDate).toEqual(timeRange.start);
            expect(replacements.endDate).toEqual(timeRange.end);
          }
        });
      });

      it('should work without time range', async () => {
        mockExecuteReportQuery
          .mockResolvedValueOnce([{}])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]);

        const result = await ReportQueries.getExecutionStatistics();

        expect(result.data.totalExecutions).toBe(0);

        // Verify no time filter was applied
        const calls = mockExecuteReportQuery.mock.calls;
        calls.forEach(call => {
          const query = call[0];
          expect(query).not.toContain('WHERE re.start_time BETWEEN');
        });
      });

      it('should handle missing or null statistics gracefully', async () => {
        mockExecuteReportQuery
          .mockResolvedValueOnce([]) // Empty stats
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]);

        const result = await ReportQueries.getExecutionStatistics();

        expect(result.data).toEqual({
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          runningExecutions: 0,
          averageExecutionTime: 0,
          slowestExecution: 0,
          fastestExecution: 0,
          executionsByStatus: [],
          executionsByType: [],
          dailyExecutions: [],
        });
      });
    });

    describe('getPerformanceMetrics', () => {
      it('should retrieve performance metrics for all reports', async () => {
        const mockReportMetrics = [
          {
            reportId: 'rpt_001',
            reportName: 'VPC Inventory',
            totalExecutions: 50,
            averageTime: 2500,
            successRate: 96.0,
            lastExecution: new Date('2023-12-01'),
          },
        ];

        const mockSystemMetrics = {
          avg_concurrent_executions: 3.5,
          peak_concurrent_executions: 8,
        };

        mockExecuteReportQuery
          .mockResolvedValueOnce(mockReportMetrics)
          .mockResolvedValueOnce([mockSystemMetrics]);

        const result = await ReportQueries.getPerformanceMetrics();

        expect(result.data.reportMetrics).toEqual(mockReportMetrics);
        expect(result.data.systemMetrics).toEqual({
          avgConcurrentExecutions: 3.5,
          peakConcurrentExecutions: 8,
          systemLoad: 0,
        });

        expect(result.metadata.queryComplexity).toBe('complex');
        expect(result.metadata.optimizationHints).toContain('Performance metrics queries should use materialized views');
      });

      it('should filter by specific report ID', async () => {
        const reportId = 'rpt_001';

        mockExecuteReportQuery
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{}]);

        await ReportQueries.getPerformanceMetrics(reportId);

        const firstCall = mockExecuteReportQuery.mock.calls[0];
        const query = firstCall[0];
        const replacements = firstCall[1];

        expect(query).toContain('AND r.report_id = :reportId');
        expect(replacements.reportId).toBe(reportId);
      });

      it('should handle missing system metrics', async () => {
        mockExecuteReportQuery
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([]); // Empty system metrics

        const result = await ReportQueries.getPerformanceMetrics();

        expect(result.data.systemMetrics).toEqual({
          avgConcurrentExecutions: 0,
          peakConcurrentExecutions: 0,
          systemLoad: 0,
        });
      });
    });
  });

  describe('Helper Methods', () => {
    describe('Filter Building', () => {
      it('should build empty filters correctly', async () => {
        mockExecuteReportQuery
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ total: 0 }]);

        await ReportQueries.getReports(); // No filters

        const firstCall = mockExecuteReportQuery.mock.calls[0];
        const query = firstCall[0];

        expect(query).not.toContain('WHERE');
      });

      it('should sanitize sort fields', async () => {
        const pagination: PaginationOptions = {
          sort: 'invalid_field', // Should default to 'updated_at'
          order: 'DESC',
        };

        mockExecuteReportQuery
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ total: 0 }]);

        await ReportQueries.getReports({}, pagination);

        const firstCall = mockExecuteReportQuery.mock.calls[0];
        const query = firstCall[0];

        expect(query).toContain('ORDER BY updated_at DESC');
      });

      it('should sanitize sort order', async () => {
        const pagination: PaginationOptions = {
          sort: 'name',
          order: 'INVALID' as any, // Should default to 'DESC'
        };

        mockExecuteReportQuery
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([{ total: 0 }]);

        await ReportQueries.getReports({}, pagination);

        const firstCall = mockExecuteReportQuery.mock.calls[0];
        const query = firstCall[0];

        expect(query).toContain('ORDER BY name DESC');
      });
    });

    describe('Query Complexity Assessment', () => {
      it('should assess query complexity correctly', async () => {
        // Test different filter combinations
        const simpleFilters: ReportFilters = {
          is_active: true,
        };

        const complexFilters: ReportFilters = {
          report_type: [ReportType.VPC_INVENTORY, ReportType.SUBNET_UTILIZATION],
          category: ReportCategory.INFRASTRUCTURE,
          search: 'vpc network',
          created_after: new Date(),
          created_before: new Date(),
        };

        mockExecuteReportQuery.mockResolvedValue([]).mockResolvedValue([{ total: 0 }]);

        const simpleResult = await ReportQueries.getReports(simpleFilters);
        expect(simpleResult.metadata.queryComplexity).toBe('moderate'); // Has joins

        jest.clearAllMocks();
        mockExecuteReportQuery.mockResolvedValue([]).mockResolvedValue([{ total: 0 }]);

        const complexResult = await ReportQueries.getReports(complexFilters);
        expect(complexResult.metadata.queryComplexity).toBe('complex');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors in getReports', async () => {
      mockExecuteReportQuery.mockRejectedValueOnce(new Error('Database connection lost'));

      await expect(ReportQueries.getReports()).rejects.toThrow('Database connection lost');
    });

    it('should handle database errors in analytics queries', async () => {
      mockExecuteReportQuery.mockRejectedValueOnce(new Error('Query timeout'));

      await expect(ReportQueries.getExecutionStatistics()).rejects.toThrow('Query timeout');
    });

    it('should handle partial failures in parallel queries', async () => {
      // First query succeeds, second fails
      mockExecuteReportQuery
        .mockResolvedValueOnce([{ stats: 'data' }])
        .mockRejectedValueOnce(new Error('Count query failed'));

      await expect(ReportQueries.getReports()).rejects.toThrow('Count query failed');
    });
  });
});

describe('VPCInventoryQueries', () => {
  let mockExecuteReportQuery: jest.MockedFunction<any>;

  beforeAll(() => {
    mockExecuteReportQuery = require('../../../database/connections/ReportingConnectionPool').executeReportQuery;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getVPCsByProvider', () => {
    it('should retrieve VPCs for all providers when no filter is specified', async () => {
      const mockVPCs = [
        {
          provider: CloudProvider.AWS,
          vpc_id: 'vpc-123',
          name: 'Production VPC',
          cidr_block: '10.0.0.0/16',
          region: 'us-east-1',
          subnet_count: 4,
          tgw_attachment_count: 1,
        },
      ];

      mockExecuteReportQuery.mockResolvedValueOnce(mockVPCs);

      const result = await VPCInventoryQueries.getVPCsByProvider();

      expect(result.data).toEqual(mockVPCs);
      expect(result.metadata.queryComplexity).toBe('moderate');
      expect(result.metadata.optimizationHints).toContain('Consider indexing on (provider, region) for better performance');

      const call = mockExecuteReportQuery.mock.calls[0];
      const query = call[0];
      expect(query).not.toContain('WHERE v.provider = :provider');
    });

    it('should filter VPCs by specific provider', async () => {
      const mockVPCs = [
        {
          provider: CloudProvider.AWS,
          vpc_id: 'vpc-123',
          name: 'AWS VPC',
        },
      ];

      mockExecuteReportQuery.mockResolvedValueOnce(mockVPCs);

      const result = await VPCInventoryQueries.getVPCsByProvider(CloudProvider.AWS);

      expect(result.data).toEqual(mockVPCs);

      const call = mockExecuteReportQuery.mock.calls[0];
      const query = call[0];
      const replacements = call[1];

      expect(query).toContain('WHERE v.provider = :provider');
      expect(replacements.provider).toBe(CloudProvider.AWS);
    });

    it('should include subnet and transit gateway attachment counts', async () => {
      mockExecuteReportQuery.mockResolvedValueOnce([]);

      await VPCInventoryQueries.getVPCsByProvider();

      const call = mockExecuteReportQuery.mock.calls[0];
      const query = call[0];

      expect(query).toContain('COUNT(s.id) as subnet_count');
      expect(query).toContain('COUNT(tga.id) as tgw_attachment_count');
      expect(query).toContain('LEFT JOIN subnets s ON v.vpc_id = s.vpc_id');
      expect(query).toContain('LEFT JOIN transit_gateway_attachments tga ON v.vpc_id = tga.vpc_id');
      expect(query).toContain('GROUP BY');
    });

    it('should handle query execution errors', async () => {
      mockExecuteReportQuery.mockRejectedValueOnce(new Error('VPC table not found'));

      await expect(VPCInventoryQueries.getVPCsByProvider(CloudProvider.AWS))
        .rejects.toThrow('VPC table not found');
    });
  });

  describe('getSubnetUtilization', () => {
    it('should retrieve subnet utilization for all VPCs', async () => {
      const mockSubnets = [
        {
          subnet_id: 'subnet-123',
          name: 'Public Subnet 1',
          cidr_block: '10.0.1.0/24',
          availability_zone: 'us-east-1a',
          state: 'available',
          vpc_name: 'Production VPC',
          provider: CloudProvider.AWS,
          region: 'us-east-1',
        },
      ];

      mockExecuteReportQuery.mockResolvedValueOnce(mockSubnets);

      const result = await VPCInventoryQueries.getSubnetUtilization();

      expect(result.data).toEqual(mockSubnets);
      expect(result.metadata.optimizationHints).toContain('IP utilization calculation requires additional resource tables');

      const call = mockExecuteReportQuery.mock.calls[0];
      const query = call[0];
      expect(query).not.toContain('WHERE s.vpc_id = :vpcId');
    });

    it('should filter subnets by specific VPC', async () => {
      const vpcId = 'vpc-123';

      mockExecuteReportQuery.mockResolvedValueOnce([]);

      await VPCInventoryQueries.getSubnetUtilization(vpcId);

      const call = mockExecuteReportQuery.mock.calls[0];
      const query = call[0];
      const replacements = call[1];

      expect(query).toContain('WHERE s.vpc_id = :vpcId');
      expect(replacements.vpcId).toBe(vpcId);
    });

    it('should include VPC information in subnet results', async () => {
      mockExecuteReportQuery.mockResolvedValueOnce([]);

      await VPCInventoryQueries.getSubnetUtilization();

      const call = mockExecuteReportQuery.mock.calls[0];
      const query = call[0];

      expect(query).toContain('v.name as vpc_name');
      expect(query).toContain('v.provider');
      expect(query).toContain('v.region');
      expect(query).toContain('INNER JOIN vpcs v ON s.vpc_id = v.vpc_id');
    });

    it('should indicate IP utilization placeholders', async () => {
      mockExecuteReportQuery.mockResolvedValueOnce([]);

      await VPCInventoryQueries.getSubnetUtilization();

      const call = mockExecuteReportQuery.mock.calls[0];
      const query = call[0];

      expect(query).toContain('NULL as available_ips');
      expect(query).toContain('NULL as used_ips');
      expect(query).toContain('NULL as utilization_percentage');
    });
  });
});

describe('PerformanceQueries', () => {
  let mockExecuteReportQuery: jest.MockedFunction<any>;

  beforeAll(() => {
    mockExecuteReportQuery = require('../../../database/connections/ReportingConnectionPool').executeReportQuery;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getSlowQueries', () => {
    it('should retrieve slow queries with default threshold', async () => {
      const mockSlowQueries = [
        {
          execution_id: 'exec_001',
          report_name: 'Large Report',
          report_type: ReportType.VPC_INVENTORY,
          duration_ms: 5000,
          records_processed: 10000,
          start_time: new Date(),
          end_time: new Date(),
          started_by_username: 'john.doe',
          error_message: null,
        },
      ];

      mockExecuteReportQuery.mockResolvedValueOnce(mockSlowQueries);

      const result = await PerformanceQueries.getSlowQueries();

      expect(result.data).toEqual(mockSlowQueries);
      expect(result.metadata.queryComplexity).toBe('simple');
      expect(result.metadata.optimizationHints).toContain('Index on duration_ms would improve slow query detection');

      const call = mockExecuteReportQuery.mock.calls[0];
      const query = call[0];
      const replacements = call[1];
      const options = call[2];

      expect(query).toContain('WHERE re.duration_ms >= :thresholdMs');
      expect(query).toContain('ORDER BY re.duration_ms DESC');
      expect(query).toContain('LIMIT :limit');
      expect(replacements.thresholdMs).toBe(1000); // Default threshold
      expect(replacements.limit).toBe(50); // Default limit
      expect(options.useCache).toBe(true);
      expect(options.cacheTtl).toBe(300000);
    });

    it('should use custom threshold and limit', async () => {
      const customThreshold = 2000;
      const customLimit = 20;

      mockExecuteReportQuery.mockResolvedValueOnce([]);

      await PerformanceQueries.getSlowQueries(customThreshold, customLimit);

      const call = mockExecuteReportQuery.mock.calls[0];
      const replacements = call[1];

      expect(replacements.thresholdMs).toBe(customThreshold);
      expect(replacements.limit).toBe(customLimit);
    });

    it('should include joins for report and user information', async () => {
      mockExecuteReportQuery.mockResolvedValueOnce([]);

      await PerformanceQueries.getSlowQueries();

      const call = mockExecuteReportQuery.mock.calls[0];
      const query = call[0];

      expect(query).toContain('INNER JOIN reports r ON re.report_id = r.report_id');
      expect(query).toContain('LEFT JOIN users u ON re.started_by = u.id');
      expect(query).toContain('r.name as report_name');
      expect(query).toContain('r.report_type');
      expect(query).toContain('u.username as started_by_username');
    });

    it('should filter by completed and failed statuses only', async () => {
      mockExecuteReportQuery.mockResolvedValueOnce([]);

      await PerformanceQueries.getSlowQueries();

      const call = mockExecuteReportQuery.mock.calls[0];
      const query = call[0];

      expect(query).toContain("re.status IN ('completed', 'failed')");
    });

    it('should handle errors gracefully', async () => {
      mockExecuteReportQuery.mockRejectedValueOnce(new Error('Performance analysis failed'));

      await expect(PerformanceQueries.getSlowQueries(1000, 50))
        .rejects.toThrow('Performance analysis failed');
    });

    it('should pass through custom options', async () => {
      const options: QueryExecutionOptions = {
        useCache: false,
        timeout: 10000,
      };

      mockExecuteReportQuery.mockResolvedValueOnce([]);

      await PerformanceQueries.getSlowQueries(1000, 50, options);

      const call = mockExecuteReportQuery.mock.calls[0];
      const passedOptions = call[2];

      expect(passedOptions).toEqual({ ...options, useCache: true, cacheTtl: 300000 });
    });
  });
});

describe('Query Execution Options', () => {
  let mockExecuteReportQuery: jest.MockedFunction<any>;

  beforeAll(() => {
    mockExecuteReportQuery = require('../../../database/connections/ReportingConnectionPool').executeReportQuery;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should pass through all query execution options correctly', async () => {
    const options: QueryExecutionOptions = {
      useCache: false,
      cacheTtl: 600000,
      timeout: 15000,
      maxRows: 500,
      explain: true,
    };

    mockExecuteReportQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0 }]);

    await ReportQueries.getReports({}, {}, options);

    const firstCall = mockExecuteReportQuery.mock.calls[0];
    expect(firstCall[2]).toEqual(options);
  });

  it('should merge default and custom options appropriately', async () => {
    const options: QueryExecutionOptions = {
      timeout: 5000,
    };

    mockExecuteReportQuery.mockResolvedValueOnce([]);

    await ReportQueries.getReportById('rpt_001', options);

    const call = mockExecuteReportQuery.mock.calls[0];
    const mergedOptions = call[2];

    expect(mergedOptions.timeout).toBe(5000); // Custom option
    expect(mergedOptions.useCache).toBe(true); // Default for getReportById
    expect(mergedOptions.cacheTtl).toBe(300000); // Default for getReportById
  });
});