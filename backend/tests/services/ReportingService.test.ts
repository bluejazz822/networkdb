/**
 * ReportingService Unit Tests
 * Comprehensive tests for the ReportingService class
 */

import { ReportingService } from '../../src/services/reporting/ReportingService';
import {
  createTestDatabase,
  setupTestModels,
  generateMockVpcs,
  generateMockTransitGateways,
  generateMockCustomerGateways,
  generateMockVpcEndpoints,
  createSampleReportQuery,
  createSampleFilters,
  assertApiResponse,
  assertReportData,
  assertPerformanceMetrics,
  createMockSequelize,
  createDatabaseError,
  cleanupTestDatabase
} from '../utils/testHelpers';
import { Sequelize, QueryTypes } from 'sequelize';
import { ResourceType } from '../../src/types/search';
import { AggregationType, FilterOperator } from '../../src/types/reports';

describe('ReportingService', () => {
  let sequelize: Sequelize;
  let reportingService: ReportingService;
  let models: any;

  beforeAll(async () => {
    sequelize = createTestDatabase();
    models = await setupTestModels(sequelize);
    reportingService = new ReportingService(sequelize);
  });

  afterAll(async () => {
    await cleanupTestDatabase(sequelize);
  });

  beforeEach(async () => {
    // Clean database before each test
    await sequelize.sync({ force: true });
  });

  // ===================== DASHBOARD TESTS =====================

  describe('getDashboardData', () => {
    beforeEach(async () => {
      // Seed test data
      await models.Vpc.bulkCreate(generateMockVpcs(10));
      await models.TransitGateway.bulkCreate(generateMockTransitGateways(5));
      await models.CustomerGateway.bulkCreate(generateMockCustomerGateways(3));
      await models.VpcEndpoint.bulkCreate(generateMockVpcEndpoints(8));
    });

    it('should return dashboard data successfully', async () => {
      const result = await reportingService.getDashboardData();

      assertApiResponse(result, true);
      expect(result.data).toHaveProperty('resourceCounts');
      expect(result.data).toHaveProperty('healthStatus');
      expect(result.data).toHaveProperty('recentActivity');
      expect(result.data).toHaveProperty('utilizationMetrics');
      expect(result.data).toHaveProperty('lastUpdated');

      // Verify resource counts
      expect(result.data.resourceCounts).toHaveProperty('vpc', 10);
      expect(result.data.resourceCounts).toHaveProperty('transitGateway', 5);
      expect(result.data.resourceCounts).toHaveProperty('customerGateway', 3);
      expect(result.data.resourceCounts).toHaveProperty('vpcEndpoint', 8);
      expect(result.data.resourceCounts).toHaveProperty('total', 26);

      // Verify metadata
      expect(result.metadata).toHaveProperty('timestamp');
      expect(result.metadata).toHaveProperty('executionTime');
      assertPerformanceMetrics(result.metadata.executionTime);
    });

    it('should handle empty database gracefully', async () => {
      // Clear all data
      await sequelize.sync({ force: true });

      const result = await reportingService.getDashboardData();

      assertApiResponse(result, true);
      expect(result.data.resourceCounts.total).toBe(0);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      const mockSequelize = createMockSequelize();
      mockSequelize.query.mockRejectedValue(createDatabaseError());

      const errorReportingService = new ReportingService(mockSequelize as any);
      const result = await errorReportingService.getDashboardData();

      assertApiResponse(result, false);
      expect(result.errors[0]).toHaveProperty('code', 'DASHBOARD_ERROR');
    });

    it('should include health status summary', async () => {
      const result = await reportingService.getDashboardData();

      expect(result.data.healthStatus).toHaveProperty('healthy');
      expect(result.data.healthStatus).toHaveProperty('warning');
      expect(result.data.healthStatus).toHaveProperty('critical');
      expect(result.data.healthStatus).toHaveProperty('total');
      expect(result.data.healthStatus).toHaveProperty('healthPercentage');
    });

    it('should include recent activity', async () => {
      const result = await reportingService.getDashboardData();

      expect(Array.isArray(result.data.recentActivity)).toBe(true);
      if (result.data.recentActivity.length > 0) {
        expect(result.data.recentActivity[0]).toHaveProperty('type');
        expect(result.data.recentActivity[0]).toHaveProperty('id');
        expect(result.data.recentActivity[0]).toHaveProperty('action');
        expect(result.data.recentActivity[0]).toHaveProperty('timestamp');
      }
    });

    it('should calculate utilization metrics', async () => {
      const result = await reportingService.getDashboardData();

      expect(result.data.utilizationMetrics).toHaveProperty('vpc');
      expect(result.data.utilizationMetrics.vpc).toHaveProperty('total');
      expect(result.data.utilizationMetrics.vpc).toHaveProperty('active');
      expect(result.data.utilizationMetrics.vpc).toHaveProperty('utilization');
    });

    it('should complete within performance threshold', async () => {
      const startTime = Date.now();
      await reportingService.getDashboardData();
      const executionTime = Date.now() - startTime;

      // Should complete within 2 seconds for small dataset
      expect(executionTime).toBeLessThan(2000);
    });
  });

  // ===================== REPORT EXECUTION TESTS =====================

  describe('executeReport', () => {
    beforeEach(async () => {
      await models.Vpc.bulkCreate(generateMockVpcs(20));
    });

    it('should execute simple VPC report successfully', async () => {
      const query = createSampleReportQuery();
      const result = await reportingService.executeReport(query);

      assertApiResponse(result, true);
      expect(result.data).toHaveProperty('results');
      expect(result.data).toHaveProperty('totalCount');
      expect(result.data).toHaveProperty('executionTime');
      expect(result.data).toHaveProperty('query');
      expect(result.data).toHaveProperty('generatedAt');

      assertReportData(result.data.results, ['vpc_id', 'cidr_block', 'state', 'region']);
      assertPerformanceMetrics(result.data.executionTime);
    });

    it('should apply filters correctly', async () => {
      const filters = [
        {
          field: 'state',
          operator: 'equals' as FilterOperator,
          value: 'available'
        }
      ];

      const query = createSampleReportQuery({ filters });
      const result = await reportingService.executeReport(query);

      assertApiResponse(result, true);

      // All results should have state 'available'
      result.data.results.forEach((vpc: any) => {
        expect(vpc.state).toBe('available');
      });
    });

    it('should apply limit correctly', async () => {
      const query = createSampleReportQuery({ limit: 5 });
      const result = await reportingService.executeReport(query);

      assertApiResponse(result, true);
      expect(result.data.results.length).toBeLessThanOrEqual(5);
    });

    it('should handle multiple resource types', async () => {
      await models.TransitGateway.bulkCreate(generateMockTransitGateways(5));

      const query = createSampleReportQuery({
        resourceTypes: ['transitGateway'],
        fields: ['transit_gateway_id', 'state', 'region']
      });

      const result = await reportingService.executeReport(query);
      assertApiResponse(result, true);
      assertReportData(result.data.results, ['transit_gateway_id', 'state', 'region']);
    });

    it('should handle empty results gracefully', async () => {
      const filters = [
        {
          field: 'state',
          operator: 'equals' as FilterOperator,
          value: 'nonexistent-state'
        }
      ];

      const query = createSampleReportQuery({ filters });
      const result = await reportingService.executeReport(query);

      assertApiResponse(result, true);
      expect(result.data.results).toEqual([]);
      expect(result.data.totalCount).toBe(0);
    });

    it('should handle SQL injection attempts safely', async () => {
      const maliciousFilters = [
        {
          field: 'state',
          operator: 'equals' as FilterOperator,
          value: "'; DROP TABLE vpcs; --"
        }
      ];

      const query = createSampleReportQuery({ filters: maliciousFilters });

      // Should not throw error and should safely handle the input
      const result = await reportingService.executeReport(query);

      // The query should complete (not throw) and return empty results
      // because the malicious string won't match any real state values
      assertApiResponse(result, true);
    });

    it('should handle complex filter combinations', async () => {
      const complexFilters = createSampleFilters();
      const query = createSampleReportQuery({ filters: complexFilters });

      const result = await reportingService.executeReport(query);
      assertApiResponse(result, true);

      // Verify filters were applied correctly
      result.data.results.forEach((vpc: any) => {
        expect(vpc.state).toBe('available');
        expect(['us-east-1', 'us-west-2']).toContain(vpc.region);
        expect(vpc.cidr_block).toBeTruthy();
      });
    });
  });

  // ===================== REPORT PREVIEW TESTS =====================

  describe('generateReportPreview', () => {
    beforeEach(async () => {
      await models.Vpc.bulkCreate(generateMockVpcs(100));
    });

    it('should generate preview with limited results', async () => {
      const query = createSampleReportQuery({ limit: 1000 }); // Request more than preview limit
      const result = await reportingService.generateReportPreview(query);

      assertApiResponse(result, true);
      expect(result.data).toHaveProperty('data');
      expect(result.data).toHaveProperty('totalCount');
      expect(result.data).toHaveProperty('executionTime');

      // Preview should be limited to 50 rows
      expect(result.data.data.length).toBeLessThanOrEqual(50);

      // Total count should reflect actual count
      expect(result.data.totalCount).toBeGreaterThanOrEqual(result.data.data.length);
    });

    it('should include warning for large datasets', async () => {
      // Create query that would return large dataset
      const query = createSampleReportQuery();

      // Mock large total count
      jest.spyOn(sequelize, 'query')
        .mockResolvedValueOnce(generateMockVpcs(10).slice(0, 10)) // Preview data
        .mockResolvedValueOnce([{ total: 1500 }]); // Total count

      const result = await reportingService.generateReportPreview(query);

      assertApiResponse(result, true);
      expect(result.data).toHaveProperty('warnings');
      expect(result.data.warnings).toContain('Large dataset detected. Consider adding filters.');
    });

    it('should handle preview generation errors', async () => {
      const mockSequelize = createMockSequelize();
      mockSequelize.query.mockRejectedValue(createDatabaseError());

      const errorReportingService = new ReportingService(mockSequelize as any);
      const query = createSampleReportQuery();
      const result = await errorReportingService.generateReportPreview(query);

      assertApiResponse(result, false);
      expect(result.errors[0]).toHaveProperty('code', 'PREVIEW_ERROR');
    });
  });

  // ===================== AGGREGATION TESTS =====================

  describe('getAggregatedData', () => {
    beforeEach(async () => {
      await models.Vpc.bulkCreate(generateMockVpcs(30));
    });

    it('should aggregate data by count', async () => {
      const result = await reportingService.getAggregatedData(
        'vpc' as ResourceType,
        'count' as AggregationType,
        'region'
      );

      assertApiResponse(result, true);
      expect(result.data).toHaveProperty('aggregation');
      expect(result.data.aggregation).toHaveProperty('type', 'count');
      expect(result.data.aggregation).toHaveProperty('groupBy', 'region');
      expect(result.data.aggregation).toHaveProperty('data');
      expect(Array.isArray(result.data.aggregation.data)).toBe(true);
    });

    it('should handle different aggregation types', async () => {
      const aggregationTypes: AggregationType[] = ['count', 'sum', 'avg', 'min', 'max'];

      for (const aggregationType of aggregationTypes) {
        const result = await reportingService.getAggregatedData(
          'vpc' as ResourceType,
          aggregationType,
          'region'
        );

        assertApiResponse(result, true);
        expect(result.data.aggregation.type).toBe(aggregationType);
      }
    });

    it('should apply filters to aggregation', async () => {
      const filters = [
        {
          field: 'state',
          operator: 'equals' as FilterOperator,
          value: 'available'
        }
      ];

      const result = await reportingService.getAggregatedData(
        'vpc' as ResourceType,
        'count' as AggregationType,
        'region',
        filters
      );

      assertApiResponse(result, true);
      expect(result.data).toHaveProperty('totalGroups');
      expect(typeof result.data.totalGroups).toBe('number');
    });

    it('should handle invalid resource type', async () => {
      const result = await reportingService.getAggregatedData(
        'invalid' as ResourceType,
        'count' as AggregationType,
        'region'
      );

      assertApiResponse(result, false);
      expect(result.errors[0]).toHaveProperty('code', 'INVALID_RESOURCE_TYPE');
    });

    it('should handle aggregation errors gracefully', async () => {
      // Mock aggregation error by making findAll fail
      jest.spyOn(models.Vpc, 'findAll').mockRejectedValue(createDatabaseError());

      const result = await reportingService.getAggregatedData(
        'vpc' as ResourceType,
        'count' as AggregationType,
        'region'
      );

      assertApiResponse(result, false);
      expect(result.errors[0]).toHaveProperty('code', 'AGGREGATION_ERROR');
    });
  });

  // ===================== ANALYTICS TESTS =====================

  describe('getReportAnalytics', () => {
    it('should return analytics data', async () => {
      const result = await reportingService.getReportAnalytics(1);

      assertApiResponse(result, true);
      expect(Array.isArray(result.data)).toBe(true);

      if (result.data.length > 0) {
        const analytics = result.data[0];
        expect(analytics).toHaveProperty('reportId');
        expect(analytics).toHaveProperty('totalExecutions');
        expect(analytics).toHaveProperty('lastExecuted');
        expect(analytics).toHaveProperty('averageExecutionTime');
        expect(analytics).toHaveProperty('popularityScore');
        expect(analytics).toHaveProperty('viewCount');
        expect(analytics).toHaveProperty('shareCount');
        expect(analytics).toHaveProperty('errorRate');
        expect(analytics).toHaveProperty('trends');
        expect(Array.isArray(analytics.trends)).toBe(true);
      }
    });

    it('should handle analytics without report ID', async () => {
      const result = await reportingService.getReportAnalytics();

      assertApiResponse(result, true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  // ===================== PERFORMANCE TESTS =====================

  describe('Performance Tests', () => {
    it('should handle large datasets efficiently', async () => {
      // Create larger dataset
      const largeMockData = generateMockVpcs(1000);
      await models.Vpc.bulkCreate(largeMockData);

      const startTime = Date.now();
      const query = createSampleReportQuery({ limit: 500 });
      const result = await reportingService.executeReport(query);
      const executionTime = Date.now() - startTime;

      assertApiResponse(result, true);
      // Should complete within 5 seconds for 1000 records
      expect(executionTime).toBeLessThan(5000);
    });

    it('should handle concurrent requests efficiently', async () => {
      await models.Vpc.bulkCreate(generateMockVpcs(100));

      const promises = Array(10).fill(null).map(() => {
        const query = createSampleReportQuery();
        return reportingService.executeReport(query);
      });

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      results.forEach(result => assertApiResponse(result, true));

      // Should complete all requests within reasonable time
      expect(totalTime).toBeLessThan(10000);
    });
  });

  // ===================== EDGE CASES =====================

  describe('Edge Cases', () => {
    it('should handle null and undefined values in data', async () => {
      const vpcWithNulls = generateMockVpcs(1);
      vpcWithNulls[0].cidr_block = null;
      vpcWithNulls[0].name = undefined;

      await models.Vpc.bulkCreate(vpcWithNulls);

      const query = createSampleReportQuery();
      const result = await reportingService.executeReport(query);

      assertApiResponse(result, true);
      expect(result.data.results.length).toBeGreaterThan(0);
    });

    it('should handle special characters in filter values', async () => {
      const specialCharsFilter = [
        {
          field: 'name',
          operator: 'like' as FilterOperator,
          value: "test-vpc's & \"special\" chars"
        }
      ];

      const query = createSampleReportQuery({ filters: specialCharsFilter });

      // Should not throw error
      const result = await reportingService.executeReport(query);
      assertApiResponse(result, true);
    });

    it('should handle very long field names', async () => {
      const longFieldQuery = createSampleReportQuery({
        fields: ['vpc_id', 'very_long_field_name_that_might_cause_issues']
      });

      // Should handle gracefully (field doesn't exist but shouldn't crash)
      const result = await reportingService.executeReport(longFieldQuery);

      // Might succeed or fail depending on implementation, but shouldn't crash
      expect(result).toHaveProperty('success');
    });
  });
});