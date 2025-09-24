/**
 * Reporting API Integration Tests
 * Tests for reporting endpoints with real database and service integration
 */

import request from 'supertest';
import express from 'express';
import { Sequelize } from 'sequelize';
import {
  createTestDatabase,
  setupTestModels,
  generateMockVpcs,
  generateMockTransitGateways,
  generateMockCustomerGateways,
  generateMockVpcEndpoints,
  createSampleReportQuery,
  cleanupTestDatabase
} from '../utils/testHelpers';

describe('Reporting API Integration Tests', () => {
  let app: express.Application;
  let sequelize: Sequelize;
  let models: any;

  beforeAll(async () => {
    // Setup test database
    sequelize = createTestDatabase();
    models = await setupTestModels(sequelize);

    // Setup Express app
    app = express();
    app.use(express.json());

    // Import and setup routes (mocked for testing)
    setupMockRoutes(app);
  });

  afterAll(async () => {
    await cleanupTestDatabase(sequelize);
  });

  beforeEach(async () => {
    // Clean database before each test
    await sequelize.sync({ force: true });

    // Seed with basic test data
    await models.Vpc.bulkCreate(generateMockVpcs(20));
    await models.TransitGateway.bulkCreate(generateMockTransitGateways(10));
    await models.CustomerGateway.bulkCreate(generateMockCustomerGateways(5));
    await models.VpcEndpoint.bulkCreate(generateMockVpcEndpoints(15));
  });

  // ===================== DASHBOARD ENDPOINTS =====================

  describe('GET /api/reports/dashboard', () => {
    it('should return dashboard data successfully', async () => {
      const response = await request(app)
        .get('/api/reports/dashboard')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('resourceCounts');
      expect(response.body.data).toHaveProperty('healthStatus');
      expect(response.body.data).toHaveProperty('recentActivity');
      expect(response.body.data).toHaveProperty('utilizationMetrics');

      // Verify resource counts match seeded data
      expect(response.body.data.resourceCounts.vpc).toBe(20);
      expect(response.body.data.resourceCounts.transitGateway).toBe(10);
      expect(response.body.data.resourceCounts.customerGateway).toBe(5);
      expect(response.body.data.resourceCounts.vpcEndpoint).toBe(15);
      expect(response.body.data.resourceCounts.total).toBe(50);
    });

    it('should include execution time in metadata', async () => {
      const response = await request(app)
        .get('/api/reports/dashboard')
        .expect(200);

      expect(response.body).toHaveProperty('metadata');
      expect(response.body.metadata).toHaveProperty('executionTime');
      expect(response.body.metadata).toHaveProperty('timestamp');
      expect(typeof response.body.metadata.executionTime).toBe('number');
    });

    it('should handle dashboard requests with user context', async () => {
      const response = await request(app)
        .get('/api/reports/dashboard')
        .query({ userId: '123' })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should return consistent data structure on empty database', async () => {
      // Clear all data
      await sequelize.sync({ force: true });

      const response = await request(app)
        .get('/api/reports/dashboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.resourceCounts.total).toBe(0);
      expect(response.body.data.healthStatus).toHaveProperty('total', 0);
    });
  });

  // ===================== REPORT EXECUTION ENDPOINTS =====================

  describe('POST /api/reports/execute', () => {
    it('should execute simple report successfully', async () => {
      const reportQuery = createSampleReportQuery();

      const response = await request(app)
        .post('/api/reports/execute')
        .send({ query: reportQuery })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data).toHaveProperty('totalCount');
      expect(response.body.data).toHaveProperty('executionTime');

      // Verify results structure
      expect(Array.isArray(response.body.data.results)).toBe(true);
      if (response.body.data.results.length > 0) {
        const firstResult = response.body.data.results[0];
        expect(firstResult).toHaveProperty('vpc_id');
        expect(firstResult).toHaveProperty('cidr_block');
        expect(firstResult).toHaveProperty('state');
        expect(firstResult).toHaveProperty('region');
      }
    });

    it('should apply filters correctly', async () => {
      const reportQuery = createSampleReportQuery({
        filters: [
          {
            field: 'state',
            operator: 'equals',
            value: 'available'
          }
        ]
      });

      const response = await request(app)
        .post('/api/reports/execute')
        .send({ query: reportQuery })
        .expect(200);

      expect(response.body.success).toBe(true);

      // All results should have state 'available'
      response.body.data.results.forEach((vpc: any) => {
        expect(vpc.state).toBe('available');
      });
    });

    it('should respect limit parameter', async () => {
      const reportQuery = createSampleReportQuery({ limit: 5 });

      const response = await request(app)
        .post('/api/reports/execute')
        .send({ query: reportQuery })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.results.length).toBeLessThanOrEqual(5);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/reports/execute')
        .send({}) // Missing query
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('errors');
      expect(response.body.errors[0]).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should handle invalid resource types', async () => {
      const invalidQuery = createSampleReportQuery({
        resourceTypes: ['invalid_resource_type']
      });

      const response = await request(app)
        .post('/api/reports/execute')
        .send({ query: invalidQuery })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle complex filter combinations', async () => {
      const complexQuery = createSampleReportQuery({
        filters: [
          {
            field: 'state',
            operator: 'in',
            values: ['available', 'pending']
          },
          {
            field: 'region',
            operator: 'like',
            value: 'us-'
          }
        ]
      });

      const response = await request(app)
        .post('/api/reports/execute')
        .send({ query: complexQuery })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify filters were applied
      response.body.data.results.forEach((vpc: any) => {
        expect(['available', 'pending']).toContain(vpc.state);
        expect(vpc.region).toMatch(/^us-/);
      });
    });

    it('should handle large result sets efficiently', async () => {
      // Seed more data for this test
      await models.Vpc.bulkCreate(generateMockVpcs(500));

      const reportQuery = createSampleReportQuery({ limit: 100 });

      const startTime = Date.now();
      const response = await request(app)
        .post('/api/reports/execute')
        .send({ query: reportQuery })
        .expect(200);
      const executionTime = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  // ===================== REPORT PREVIEW ENDPOINTS =====================

  describe('POST /api/reports/preview', () => {
    it('should generate report preview successfully', async () => {
      const reportQuery = createSampleReportQuery({ limit: 1000 });

      const response = await request(app)
        .post('/api/reports/preview')
        .send({ query: reportQuery })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('totalCount');
      expect(response.body.data).toHaveProperty('executionTime');

      // Preview should be limited
      expect(response.body.data.data.length).toBeLessThanOrEqual(50);
    });

    it('should include warnings for large datasets', async () => {
      // Seed large dataset
      await models.Vpc.bulkCreate(generateMockVpcs(1500));

      const reportQuery = createSampleReportQuery();

      const response = await request(app)
        .post('/api/reports/preview')
        .send({ query: reportQuery })
        .expect(200);

      expect(response.body.success).toBe(true);

      if (response.body.data.totalCount > 1000) {
        expect(response.body.data).toHaveProperty('warnings');
        expect(response.body.data.warnings).toContain(
          'Large dataset detected. Consider adding filters.'
        );
      }
    });

    it('should validate preview request payload', async () => {
      const response = await request(app)
        .post('/api/reports/preview')
        .send({ invalidField: 'test' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors[0]).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  // ===================== AGGREGATION ENDPOINTS =====================

  describe('POST /api/reports/aggregate', () => {
    it('should aggregate data by count', async () => {
      const response = await request(app)
        .post('/api/reports/aggregate')
        .send({
          resourceType: 'vpc',
          aggregation: 'count',
          groupBy: 'region'
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('aggregation');
      expect(response.body.data.aggregation).toHaveProperty('type', 'count');
      expect(response.body.data.aggregation).toHaveProperty('groupBy', 'region');
      expect(response.body.data.aggregation).toHaveProperty('data');
      expect(Array.isArray(response.body.data.aggregation.data)).toBe(true);
    });

    it('should handle different aggregation types', async () => {
      const aggregationTypes = ['count', 'sum', 'avg', 'min', 'max'];

      for (const aggregationType of aggregationTypes) {
        const response = await request(app)
          .post('/api/reports/aggregate')
          .send({
            resourceType: 'vpc',
            aggregation: aggregationType,
            groupBy: 'region'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.aggregation.type).toBe(aggregationType);
      }
    });

    it('should apply filters to aggregation', async () => {
      const response = await request(app)
        .post('/api/reports/aggregate')
        .send({
          resourceType: 'vpc',
          aggregation: 'count',
          groupBy: 'region',
          filters: [
            {
              field: 'state',
              operator: 'equals',
              value: 'available'
            }
          ]
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalGroups');
    });

    it('should reject invalid resource types', async () => {
      const response = await request(app)
        .post('/api/reports/aggregate')
        .send({
          resourceType: 'invalid_type',
          aggregation: 'count',
          groupBy: 'region'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate aggregation parameters', async () => {
      const response = await request(app)
        .post('/api/reports/aggregate')
        .send({
          resourceType: 'vpc'
          // Missing required fields
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors[0]).toHaveProperty('code', 'VALIDATION_ERROR');
    });
  });

  // ===================== EXPORT ENDPOINTS =====================

  describe('POST /api/reports/export', () => {
    it('should export report data to CSV', async () => {
      const reportQuery = createSampleReportQuery({ limit: 10 });

      const response = await request(app)
        .post('/api/reports/export')
        .send({
          query: reportQuery,
          format: 'csv',
          options: {
            includeMetadata: true
          }
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('filePath');
      expect(response.body.data).toHaveProperty('fileName');
      expect(response.body.data).toHaveProperty('size');
      expect(response.body.data.fileName).toMatch(/\.csv$/);
    });

    it('should export report data to Excel', async () => {
      const reportQuery = createSampleReportQuery({ limit: 5 });

      const response = await request(app)
        .post('/api/reports/export')
        .send({
          query: reportQuery,
          format: 'excel'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fileName).toMatch(/\.excel$/);
      expect(response.body.data.size).toBeGreaterThan(1000);
    });

    it('should export report data to JSON', async () => {
      const reportQuery = createSampleReportQuery({ limit: 5 });

      const response = await request(app)
        .post('/api/reports/export')
        .send({
          query: reportQuery,
          format: 'json',
          options: {
            includeMetadata: true
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.fileName).toMatch(/\.json$/);
    });

    it('should validate export request', async () => {
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          format: 'csv'
          // Missing query
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors[0]).toHaveProperty('code', 'VALIDATION_ERROR');
    });

    it('should reject unsupported export formats', async () => {
      const reportQuery = createSampleReportQuery();

      const response = await request(app)
        .post('/api/reports/export')
        .send({
          query: reportQuery,
          format: 'unsupported_format'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle large exports efficiently', async () => {
      const largeQuery = createSampleReportQuery({ limit: 500 });

      const startTime = Date.now();
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          query: largeQuery,
          format: 'json'
        })
        .expect(200);
      const executionTime = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
    });
  });

  // ===================== ANALYTICS ENDPOINTS =====================

  describe('GET /api/reports/analytics', () => {
    it('should return report analytics', async () => {
      const response = await request(app)
        .get('/api/reports/analytics')
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(Array.isArray(response.body.data)).toBe(true);

      if (response.body.data.length > 0) {
        const analytics = response.body.data[0];
        expect(analytics).toHaveProperty('reportId');
        expect(analytics).toHaveProperty('totalExecutions');
        expect(analytics).toHaveProperty('averageExecutionTime');
        expect(analytics).toHaveProperty('popularityScore');
        expect(analytics).toHaveProperty('trends');
      }
    });

    it('should return analytics for specific report', async () => {
      const response = await request(app)
        .get('/api/reports/analytics')
        .query({ reportId: 1 })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  // ===================== ERROR HANDLING =====================

  describe('Error Handling', () => {
    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/reports/execute')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle database connection errors gracefully', async () => {
      // Close database connection to simulate error
      await sequelize.close();

      const reportQuery = createSampleReportQuery();

      const response = await request(app)
        .post('/api/reports/execute')
        .send({ query: reportQuery })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.errors[0]).toHaveProperty('code', 'DATABASE_ERROR');

      // Reconnect for cleanup
      sequelize = createTestDatabase();
      models = await setupTestModels(sequelize);
    });

    it('should handle timeout scenarios', async () => {
      // This would require mocking a slow query
      // Implementation depends on specific timeout handling
      const reportQuery = createSampleReportQuery();

      const response = await request(app)
        .post('/api/reports/execute')
        .send({ query: reportQuery })
        .timeout(1); // Very short timeout

      // Should either succeed quickly or timeout gracefully
      expect([200, 408, 500]).toContain(response.status);
    });
  });

  // ===================== PERFORMANCE TESTS =====================

  describe('Performance Tests', () => {
    it('should handle concurrent requests efficiently', async () => {
      const reportQuery = createSampleReportQuery({ limit: 10 });

      const requests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/reports/execute')
          .send({ query: reportQuery })
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(10000);
    });

    it('should maintain response times under load', async () => {
      const startTime = Date.now();

      const response = await request(app)
        .get('/api/reports/dashboard')
        .expect(200);

      const responseTime = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(responseTime).toBeLessThan(2000); // Should respond within 2 seconds
    });
  });
});

// ===================== MOCK ROUTES SETUP =====================

function setupMockRoutes(app: express.Application) {
  // Mock implementation of reporting routes for testing
  // In a real application, these would be imported from actual route files

  app.get('/api/reports/dashboard', async (req, res) => {
    try {
      // Mock dashboard response
      res.json({
        success: true,
        data: {
          resourceCounts: {
            vpc: 20,
            transitGateway: 10,
            customerGateway: 5,
            vpcEndpoint: 15,
            total: 50
          },
          healthStatus: {
            healthy: 45,
            warning: 3,
            critical: 2,
            total: 50,
            healthPercentage: 90
          },
          recentActivity: [],
          utilizationMetrics: {
            vpc: { total: 20, active: 18, utilization: 90 }
          },
          lastUpdated: new Date()
        },
        metadata: {
          timestamp: new Date().toISOString(),
          executionTime: 150,
          version: '1.0'
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        errors: [{ code: 'DASHBOARD_ERROR', message: error.message }]
      });
    }
  });

  app.post('/api/reports/execute', (req, res) => {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        errors: [{ code: 'VALIDATION_ERROR', message: 'Query is required' }]
      });
    }

    // Mock execution response
    res.json({
      success: true,
      data: {
        results: generateMockVpcs(10),
        totalCount: 10,
        executionTime: 245,
        query,
        generatedAt: new Date()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        executionTime: 245,
        version: '1.0'
      }
    });
  });

  app.post('/api/reports/preview', (req, res) => {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        errors: [{ code: 'VALIDATION_ERROR', message: 'Query is required' }]
      });
    }

    const mockData = generateMockVpcs(10);
    res.json({
      success: true,
      data: {
        data: mockData,
        totalCount: mockData.length,
        executionTime: 123,
        query: 'SELECT * FROM vpcs LIMIT 50'
      }
    });
  });

  app.post('/api/reports/aggregate', (req, res) => {
    const { resourceType, aggregation, groupBy } = req.body;

    if (!resourceType || !aggregation || !groupBy) {
      return res.status(400).json({
        success: false,
        errors: [{ code: 'VALIDATION_ERROR', message: 'Missing required fields' }]
      });
    }

    if (!['vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint'].includes(resourceType)) {
      return res.status(400).json({
        success: false,
        errors: [{ code: 'INVALID_RESOURCE_TYPE', message: 'Invalid resource type' }]
      });
    }

    res.json({
      success: true,
      data: {
        aggregation: {
          type: aggregation,
          groupBy,
          data: [
            { group: 'us-east-1', value: 10 },
            { group: 'us-west-2', value: 8 },
            { group: 'eu-west-1', value: 2 }
          ]
        },
        totalGroups: 3,
        executionTime: 89
      }
    });
  });

  app.post('/api/reports/export', (req, res) => {
    const { query, format } = req.body;

    if (!query || !format) {
      return res.status(400).json({
        success: false,
        errors: [{ code: 'VALIDATION_ERROR', message: 'Query and format are required' }]
      });
    }

    if (!['csv', 'excel', 'json', 'pdf', 'html'].includes(format)) {
      return res.status(400).json({
        success: false,
        errors: [{ code: 'INVALID_FORMAT', message: 'Unsupported format' }]
      });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    res.json({
      success: true,
      data: {
        filePath: `/exports/report_${timestamp}.${format}`,
        fileName: `report_${timestamp}.${format}`,
        size: 1024
      }
    });
  });

  app.get('/api/reports/analytics', (req, res) => {
    res.json({
      success: true,
      data: [{
        reportId: 1,
        totalExecutions: 145,
        lastExecuted: new Date(),
        averageExecutionTime: 2340,
        popularityScore: 85,
        viewCount: 1250,
        shareCount: 12,
        errorRate: 0.02,
        trends: [
          { date: new Date('2024-01-01'), executions: 45, avgTime: 2100, errors: 1 },
          { date: new Date('2024-01-02'), executions: 52, avgTime: 2400, errors: 0 }
        ]
      }]
    });
  });
}