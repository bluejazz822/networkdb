/**
 * Performance and Load Testing
 * Tests for handling large datasets and high-load scenarios
 */

import { Sequelize } from 'sequelize';
import { ReportingService } from '../../src/services/reporting/ReportingService';
import { ExportService } from '../../src/services/reporting/ExportService';
import {
  createTestDatabase,
  setupTestModels,
  generateLargeDataset,
  createSampleReportQuery,
  assertApiResponse,
  assertPerformanceMetrics,
  cleanupTestDatabase,
  wait
} from '../utils/testHelpers';
import { ResourceType } from '../../src/types/search';
import { ExportFormat } from '../../src/types/reports';

describe('Performance and Load Testing', () => {
  let sequelize: Sequelize;
  let reportingService: ReportingService;
  let exportService: ExportService;
  let models: any;

  beforeAll(async () => {
    sequelize = createTestDatabase();
    models = await setupTestModels(sequelize);
    reportingService = new ReportingService(sequelize);
    exportService = new ExportService('./temp-performance-exports');

    // Increase timeout for performance tests
    jest.setTimeout(120000); // 2 minutes
  });

  afterAll(async () => {
    await cleanupTestDatabase(sequelize);
  });

  beforeEach(async () => {
    await sequelize.sync({ force: true });
  });

  // ===================== LARGE DATASET TESTS =====================

  describe('Large Dataset Performance', () => {
    it('should handle 3000 VPCs efficiently', async () => {
      console.log('🚀 Testing with 3000 VPCs...');

      const largeDataset = generateLargeDataset('vpc', 3000);

      // Measure insertion time
      const insertStartTime = Date.now();
      await models.Vpc.bulkCreate(largeDataset, {
        validate: false, // Skip validation for performance
        logging: false
      });
      const insertTime = Date.now() - insertStartTime;
      console.log(`📊 Inserted 3000 VPCs in ${insertTime}ms`);

      // Test dashboard performance
      const dashboardStartTime = Date.now();
      const dashboardResult = await reportingService.getDashboardData();
      const dashboardTime = Date.now() - dashboardStartTime;

      assertApiResponse(dashboardResult, true);
      expect(dashboardResult.data.resourceCounts.vpc).toBe(3000);
      expect(dashboardTime).toBeLessThan(10000); // Should complete within 10 seconds
      console.log(`📊 Dashboard loaded in ${dashboardTime}ms`);

      // Test report execution performance
      const reportQuery = createSampleReportQuery({ limit: 1000 });
      const reportStartTime = Date.now();
      const reportResult = await reportingService.executeReport(reportQuery);
      const reportTime = Date.now() - reportStartTime;

      assertApiResponse(reportResult, true);
      expect(reportResult.data.results.length).toBeLessThanOrEqual(1000);
      expect(reportTime).toBeLessThan(15000); // Should complete within 15 seconds
      console.log(`📊 Report executed in ${reportTime}ms`);

      // Performance thresholds
      expect(insertTime).toBeLessThan(30000); // 30 seconds for bulk insert
      expect(dashboardTime).toBeLessThan(10000); // 10 seconds for dashboard
      expect(reportTime).toBeLessThan(15000); // 15 seconds for report
    });

    it('should handle mixed large datasets efficiently', async () => {
      console.log('🚀 Testing with mixed large datasets...');

      // Create mixed dataset
      await Promise.all([
        models.Vpc.bulkCreate(generateLargeDataset('vpc', 2000), { validate: false }),
        models.TransitGateway.bulkCreate(generateLargeDataset('transitGateway', 500), { validate: false }),
        models.CustomerGateway.bulkCreate(generateLargeDataset('customerGateway', 300), { validate: false }),
        models.VpcEndpoint.bulkCreate(generateLargeDataset('vpcEndpoint', 1200), { validate: false })
      ]);

      const startTime = Date.now();
      const result = await reportingService.getDashboardData();
      const executionTime = Date.now() - startTime;

      assertApiResponse(result, true);
      expect(result.data.resourceCounts.total).toBe(4000);
      expect(executionTime).toBeLessThan(15000); // Should handle 4000 resources within 15 seconds
      console.log(`📊 Mixed dataset dashboard loaded in ${executionTime}ms`);
    });

    it('should handle large result sets with pagination', async () => {
      await models.Vpc.bulkCreate(generateLargeDataset('vpc', 5000), { validate: false });

      // Test different page sizes
      const pageSizes = [100, 500, 1000, 2000];

      for (const pageSize of pageSizes) {
        const query = createSampleReportQuery({ limit: pageSize });
        const startTime = Date.now();
        const result = await reportingService.executeReport(query);
        const executionTime = Date.now() - startTime;

        assertApiResponse(result, true);
        expect(result.data.results.length).toBeLessThanOrEqual(pageSize);

        // Performance should degrade gracefully with larger page sizes
        const expectedMaxTime = Math.min(20000, pageSize * 10); // 10ms per record, max 20s
        expect(executionTime).toBeLessThan(expectedMaxTime);

        console.log(`📊 Page size ${pageSize}: ${executionTime}ms`);
      }
    });
  });

  // ===================== CONCURRENT ACCESS TESTS =====================

  describe('Concurrent Access Performance', () => {
    beforeEach(async () => {
      // Seed moderate dataset for concurrent tests
      await models.Vpc.bulkCreate(generateLargeDataset('vpc', 1000), { validate: false });
    });

    it('should handle concurrent dashboard requests', async () => {
      const concurrentRequests = 10;
      const requests = Array(concurrentRequests).fill(null).map(() =>
        reportingService.getDashboardData()
      );

      const startTime = Date.now();
      const results = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      results.forEach(result => {
        assertApiResponse(result, true);
        expect(result.data.resourceCounts.vpc).toBe(1000);
      });

      // Average time per request should be reasonable
      const avgTimePerRequest = totalTime / concurrentRequests;
      expect(avgTimePerRequest).toBeLessThan(5000); // 5 seconds average

      console.log(`📊 ${concurrentRequests} concurrent dashboard requests: ${totalTime}ms total, ${avgTimePerRequest}ms average`);
    });

    it('should handle concurrent report executions', async () => {
      const concurrentReports = 5;
      const reportQueries = Array(concurrentReports).fill(null).map((_, index) =>
        createSampleReportQuery({
          limit: 100,
          filters: [
            {
              field: 'region',
              operator: 'equals',
              value: index % 2 === 0 ? 'us-east-1' : 'us-west-2'
            }
          ]
        })
      );

      const startTime = Date.now();
      const results = await Promise.all(
        reportQueries.map(query => reportingService.executeReport(query))
      );
      const totalTime = Date.now() - startTime;

      // All reports should succeed
      results.forEach(result => {
        assertApiResponse(result, true);
        expect(result.data.results.length).toBeLessThanOrEqual(100);
      });

      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
      console.log(`📊 ${concurrentReports} concurrent reports: ${totalTime}ms`);
    });

    it('should handle mixed concurrent operations', async () => {
      const operations = [
        () => reportingService.getDashboardData(),
        () => reportingService.executeReport(createSampleReportQuery({ limit: 50 })),
        () => reportingService.generateReportPreview(createSampleReportQuery()),
        () => reportingService.getAggregatedData('vpc', 'count', 'region'),
        () => reportingService.getReportAnalytics()
      ];

      const promises = Array(10).fill(null).map((_, index) =>
        operations[index % operations.length]()
      );

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All operations should succeed
      results.forEach(result => assertApiResponse(result, true));

      expect(totalTime).toBeLessThan(20000); // Should complete within 20 seconds
      console.log(`📊 10 mixed concurrent operations: ${totalTime}ms`);
    });
  });

  // ===================== EXPORT PERFORMANCE TESTS =====================

  describe('Export Performance', () => {
    beforeEach(async () => {
      await models.Vpc.bulkCreate(generateLargeDataset('vpc', 2000), { validate: false });
    });

    it('should export large datasets to different formats efficiently', async () => {
      const data = generateLargeDataset('vpc', 1000);
      const formats: ExportFormat[] = ['json', 'csv', 'excel'];

      for (const format of formats) {
        const startTime = Date.now();
        const result = await exportService.exportData(data, format);
        const executionTime = Date.now() - startTime;

        assertApiResponse(result, true);
        expect(result.data.size).toBeGreaterThan(1000);

        // Performance thresholds by format
        let maxTime: number;
        switch (format) {
          case 'json':
          case 'csv':
            maxTime = 10000; // 10 seconds
            break;
          case 'excel':
            maxTime = 30000; // 30 seconds (Excel is more complex)
            break;
          default:
            maxTime = 15000;
        }

        expect(executionTime).toBeLessThan(maxTime);
        console.log(`📊 Export 1000 records to ${format}: ${executionTime}ms`);
      }
    });

    it('should handle concurrent exports', async () => {
      const data = generateLargeDataset('vpc', 500);
      const formats: ExportFormat[] = ['json', 'csv'];

      const exportPromises = formats.map(format =>
        exportService.exportData(data, format)
      );

      const startTime = Date.now();
      const results = await Promise.all(exportPromises);
      const totalTime = Date.now() - startTime;

      results.forEach(result => {
        assertApiResponse(result, true);
        expect(result.data.size).toBeGreaterThan(500);
      });

      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds
      console.log(`📊 Concurrent exports: ${totalTime}ms`);
    });

    it('should maintain performance with very large exports', async () => {
      const largeData = generateLargeDataset('vpc', 5000);

      const startTime = Date.now();
      const result = await exportService.exportData(largeData, 'json');
      const executionTime = Date.now() - startTime;

      assertApiResponse(result, true);
      expect(result.data.size).toBeGreaterThan(100000); // Should be substantial

      // Should complete within 30 seconds for 5000 records
      expect(executionTime).toBeLessThan(30000);
      console.log(`📊 Export 5000 records to JSON: ${executionTime}ms`);
    });
  });

  // ===================== MEMORY USAGE TESTS =====================

  describe('Memory Usage Performance', () => {
    it('should maintain reasonable memory usage with large datasets', async () => {
      const initialMemory = process.memoryUsage();
      console.log(`📊 Initial memory usage: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);

      // Load large dataset
      await models.Vpc.bulkCreate(generateLargeDataset('vpc', 3000), { validate: false });

      const afterLoadMemory = process.memoryUsage();
      console.log(`📊 Memory after loading 3000 VPCs: ${Math.round(afterLoadMemory.heapUsed / 1024 / 1024)}MB`);

      // Execute multiple operations
      const operations = [
        reportingService.getDashboardData(),
        reportingService.executeReport(createSampleReportQuery({ limit: 1000 })),
        reportingService.getAggregatedData('vpc', 'count', 'region')
      ];

      await Promise.all(operations);

      const afterOperationsMemory = process.memoryUsage();
      console.log(`📊 Memory after operations: ${Math.round(afterOperationsMemory.heapUsed / 1024 / 1024)}MB`);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
        await wait(1000); // Wait for GC to complete
      }

      const afterGCMemory = process.memoryUsage();
      console.log(`📊 Memory after GC: ${Math.round(afterGCMemory.heapUsed / 1024 / 1024)}MB`);

      // Memory increase should be reasonable (less than 200MB)
      const memoryIncrease = afterOperationsMemory.heapUsed - initialMemory.heapUsed;
      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // 200MB
    });

    it('should not have memory leaks with repeated operations', async () => {
      await models.Vpc.bulkCreate(generateLargeDataset('vpc', 1000), { validate: false });

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform operations multiple times
      for (let i = 0; i < 10; i++) {
        await reportingService.getDashboardData();
        await reportingService.executeReport(createSampleReportQuery({ limit: 100 }));

        if (i % 3 === 0 && global.gc) {
          global.gc(); // Periodic garbage collection
        }
      }

      if (global.gc) {
        global.gc();
        await wait(1000);
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
      console.log(`📊 Memory increase after 10 iterations: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    });
  });

  // ===================== QUERY OPTIMIZATION TESTS =====================

  describe('Query Optimization Performance', () => {
    beforeEach(async () => {
      await models.Vpc.bulkCreate(generateLargeDataset('vpc', 2000), { validate: false });
    });

    it('should optimize queries with filters', async () => {
      const queries = [
        // Simple filter
        createSampleReportQuery({
          filters: [{ field: 'state', operator: 'equals', value: 'available' }]
        }),
        // Multiple filters
        createSampleReportQuery({
          filters: [
            { field: 'state', operator: 'equals', value: 'available' },
            { field: 'region', operator: 'in', values: ['us-east-1', 'us-west-2'] }
          ]
        }),
        // Complex filters
        createSampleReportQuery({
          filters: [
            { field: 'cidr_block', operator: 'like', value: '10.%' },
            { field: 'created_at', operator: 'greater_than', value: new Date('2024-01-01') }
          ]
        })
      ];

      for (const [index, query] of queries.entries()) {
        const startTime = Date.now();
        const result = await reportingService.executeReport(query);
        const executionTime = Date.now() - startTime;

        assertApiResponse(result, true);

        // Filtered queries should be faster than full scans
        expect(executionTime).toBeLessThan(10000); // 10 seconds
        console.log(`📊 Query ${index + 1} with filters: ${executionTime}ms`);
      }
    });

    it('should optimize aggregation queries', async () => {
      const aggregations = [
        { type: 'count', groupBy: 'region' },
        { type: 'count', groupBy: 'state' },
        { type: 'count', groupBy: 'provider' }
      ];

      for (const agg of aggregations) {
        const startTime = Date.now();
        const result = await reportingService.getAggregatedData(
          'vpc' as ResourceType,
          agg.type as any,
          agg.groupBy
        );
        const executionTime = Date.now() - startTime;

        assertApiResponse(result, true);
        expect(executionTime).toBeLessThan(5000); // 5 seconds
        console.log(`📊 Aggregation ${agg.type} by ${agg.groupBy}: ${executionTime}ms`);
      }
    });

    it('should handle sorting efficiently', async () => {
      const sortFields = ['vpc_id', 'created_at', 'region', 'state'];

      for (const field of sortFields) {
        const query = createSampleReportQuery({
          orderBy: [{ field, direction: 'DESC' }],
          limit: 500
        });

        const startTime = Date.now();
        const result = await reportingService.executeReport(query);
        const executionTime = Date.now() - startTime;

        assertApiResponse(result, true);
        expect(result.data.results.length).toBeLessThanOrEqual(500);
        expect(executionTime).toBeLessThan(8000); // 8 seconds
        console.log(`📊 Sort by ${field}: ${executionTime}ms`);
      }
    });
  });

  // ===================== SCALABILITY TESTS =====================

  describe('Scalability Tests', () => {
    it('should scale linearly with data size', async () => {
      const dataSizes = [500, 1000, 2000, 3000];
      const results: Array<{ size: number; time: number }> = [];

      for (const size of dataSizes) {
        // Clear and reload with specific size
        await sequelize.sync({ force: true });
        await models.Vpc.bulkCreate(generateLargeDataset('vpc', size), { validate: false });

        const startTime = Date.now();
        const result = await reportingService.getDashboardData();
        const executionTime = Date.now() - startTime;

        assertApiResponse(result, true);
        expect(result.data.resourceCounts.vpc).toBe(size);

        results.push({ size, time: executionTime });
        console.log(`📊 Dataset size ${size}: ${executionTime}ms`);
      }

      // Check that performance scales reasonably
      // Larger datasets should not be exponentially slower
      for (let i = 1; i < results.length; i++) {
        const prevResult = results[i - 1];
        const currentResult = results[i];
        const sizeRatio = currentResult.size / prevResult.size;
        const timeRatio = currentResult.time / prevResult.time;

        // Time ratio should not be much larger than size ratio
        expect(timeRatio).toBeLessThan(sizeRatio * 2);
      }
    });

    it('should handle resource type diversity', async () => {
      const resourceCounts = {
        vpc: 1000,
        transitGateway: 500,
        customerGateway: 300,
        vpcEndpoint: 800
      };

      // Load different resource types
      await Promise.all([
        models.Vpc.bulkCreate(generateLargeDataset('vpc', resourceCounts.vpc), { validate: false }),
        models.TransitGateway.bulkCreate(generateLargeDataset('transitGateway', resourceCounts.transitGateway), { validate: false }),
        models.CustomerGateway.bulkCreate(generateLargeDataset('customerGateway', resourceCounts.customerGateway), { validate: false }),
        models.VpcEndpoint.bulkCreate(generateLargeDataset('vpcEndpoint', resourceCounts.vpcEndpoint), { validate: false })
      ]);

      // Test queries for each resource type
      const resourceTypes: ResourceType[] = ['vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint'];

      for (const resourceType of resourceTypes) {
        const query = createSampleReportQuery({
          resourceTypes: [resourceType],
          limit: 100
        });

        const startTime = Date.now();
        const result = await reportingService.executeReport(query);
        const executionTime = Date.now() - startTime;

        assertApiResponse(result, true);
        expect(result.data.results.length).toBeLessThanOrEqual(100);
        expect(executionTime).toBeLessThan(5000); // 5 seconds
        console.log(`📊 Query ${resourceType}: ${executionTime}ms`);
      }
    });
  });

  // ===================== PERFORMANCE BENCHMARKS =====================

  describe('Performance Benchmarks', () => {
    it('should meet performance SLAs', async () => {
      // Define SLAs (Service Level Agreements)
      const SLAs = {
        dashboardLoad: 3000, // 3 seconds
        reportExecution: 10000, // 10 seconds
        dataExport: 15000, // 15 seconds
        aggregation: 5000 // 5 seconds
      };

      // Load test dataset
      await models.Vpc.bulkCreate(generateLargeDataset('vpc', 1500), { validate: false });

      // Test dashboard SLA
      let startTime = Date.now();
      let result = await reportingService.getDashboardData();
      let executionTime = Date.now() - startTime;
      assertApiResponse(result, true);
      expect(executionTime).toBeLessThan(SLAs.dashboardLoad);
      console.log(`✅ Dashboard SLA: ${executionTime}ms < ${SLAs.dashboardLoad}ms`);

      // Test report execution SLA
      startTime = Date.now();
      result = await reportingService.executeReport(createSampleReportQuery({ limit: 500 }));
      executionTime = Date.now() - startTime;
      assertApiResponse(result, true);
      expect(executionTime).toBeLessThan(SLAs.reportExecution);
      console.log(`✅ Report execution SLA: ${executionTime}ms < ${SLAs.reportExecution}ms`);

      // Test aggregation SLA
      startTime = Date.now();
      result = await reportingService.getAggregatedData('vpc', 'count', 'region');
      executionTime = Date.now() - startTime;
      assertApiResponse(result, true);
      expect(executionTime).toBeLessThan(SLAs.aggregation);
      console.log(`✅ Aggregation SLA: ${executionTime}ms < ${SLAs.aggregation}ms`);

      // Test export SLA
      const exportData = generateLargeDataset('vpc', 500);
      startTime = Date.now();
      const exportResult = await exportService.exportData(exportData, 'json');
      executionTime = Date.now() - startTime;
      assertApiResponse(exportResult, true);
      expect(executionTime).toBeLessThan(SLAs.dataExport);
      console.log(`✅ Export SLA: ${executionTime}ms < ${SLAs.dataExport}ms`);
    });
  });
});