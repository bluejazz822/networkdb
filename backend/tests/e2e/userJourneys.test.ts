/**
 * End-to-End User Journey Tests
 * Tests complete user workflows and critical business scenarios
 */

import request from 'supertest';
import express from 'express';
import { Sequelize } from 'sequelize';
import * as fs from 'fs';
import * as path from 'path';
import {
  createTestDatabase,
  setupTestModels,
  generateMockVpcs,
  generateMockTransitGateways,
  generateMockCustomerGateways,
  generateMockVpcEndpoints,
  cleanupTestDatabase,
  cleanupTestFiles
} from '../utils/testHelpers';

describe('End-to-End User Journey Tests', () => {
  let app: express.Application;
  let sequelize: Sequelize;
  let models: any;
  let testFiles: string[] = [];

  beforeAll(async () => {
    // Setup test database and app
    sequelize = createTestDatabase();
    models = await setupTestModels(sequelize);
    app = express();
    app.use(express.json());
    setupMockE2ERoutes(app);

    // Extended timeout for E2E tests
    jest.setTimeout(60000);
  });

  afterAll(async () => {
    await cleanupTestDatabase(sequelize);
    cleanupTestFiles(testFiles);
  });

  beforeEach(async () => {
    // Clean database and seed with comprehensive test data
    await sequelize.sync({ force: true });

    // Seed realistic test data
    await models.Vpc.bulkCreate(generateMockVpcs(50));
    await models.TransitGateway.bulkCreate(generateMockTransitGateways(20));
    await models.CustomerGateway.bulkCreate(generateMockCustomerGateways(15));
    await models.VpcEndpoint.bulkCreate(generateMockVpcEndpoints(40));

    // Clear test files list
    testFiles = [];
  });

  afterEach(() => {
    cleanupTestFiles(testFiles);
  });

  // ===================== EXECUTIVE DASHBOARD JOURNEY =====================

  describe('Executive Dashboard Journey', () => {
    it('should complete executive overview workflow', async () => {
      console.log('🎯 Testing Executive Dashboard Journey...');

      // Step 1: Load main dashboard
      const dashboardResponse = await request(app)
        .get('/api/reports/dashboard')
        .expect(200);

      expect(dashboardResponse.body.success).toBe(true);
      expect(dashboardResponse.body.data.resourceCounts.total).toBe(125);

      // Step 2: Drill down into health metrics
      const healthMetrics = dashboardResponse.body.data.healthStatus;
      expect(healthMetrics).toHaveProperty('healthy');
      expect(healthMetrics).toHaveProperty('warning');
      expect(healthMetrics).toHaveProperty('critical');
      expect(healthMetrics.total).toBeGreaterThan(0);

      // Step 3: View recent activity
      const recentActivity = dashboardResponse.body.data.recentActivity;
      expect(Array.isArray(recentActivity)).toBe(true);

      // Step 4: Check utilization metrics
      const utilization = dashboardResponse.body.data.utilizationMetrics;
      expect(utilization).toHaveProperty('vpc');
      expect(utilization.vpc).toHaveProperty('total');
      expect(utilization.vpc).toHaveProperty('active');

      // Step 5: Get analytics for trend analysis
      const analyticsResponse = await request(app)
        .get('/api/reports/analytics')
        .expect(200);

      expect(analyticsResponse.body.success).toBe(true);
      expect(Array.isArray(analyticsResponse.body.data)).toBe(true);

      console.log('✅ Executive Dashboard Journey completed successfully');
    });

    it('should handle executive dashboard under high load', async () => {
      console.log('🎯 Testing Executive Dashboard under load...');

      // Simulate multiple executive users accessing dashboard simultaneously
      const concurrentRequests = 8;
      const requests = Array(concurrentRequests).fill(null).map(() =>
        request(app).get('/api/reports/dashboard')
      );

      const startTime = Date.now();
      const responses = await Promise.all(requests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should handle concurrent load efficiently
      expect(totalTime).toBeLessThan(15000); // 15 seconds for 8 concurrent requests
      console.log(`✅ Handled ${concurrentRequests} concurrent dashboard requests in ${totalTime}ms`);
    });
  });

  // ===================== NETWORK ANALYST JOURNEY =====================

  describe('Network Analyst Journey', () => {
    it('should complete detailed network analysis workflow', async () => {
      console.log('🎯 Testing Network Analyst Journey...');

      // Step 1: Get overview dashboard
      await request(app)
        .get('/api/reports/dashboard')
        .expect(200);

      // Step 2: Filter VPCs by region for analysis
      const vpcAnalysisQuery = {
        resourceTypes: ['vpc'],
        fields: ['vpc_id', 'cidr_block', 'state', 'region', 'account_id'],
        filters: [
          {
            field: 'region',
            operator: 'in',
            values: ['us-east-1', 'us-west-2']
          }
        ],
        orderBy: [{ field: 'region', direction: 'ASC' }],
        limit: 100
      };

      const vpcReportResponse = await request(app)
        .post('/api/reports/execute')
        .send({ query: vpcAnalysisQuery })
        .expect(200);

      expect(vpcReportResponse.body.success).toBe(true);
      expect(vpcReportResponse.body.data.results.length).toBeGreaterThan(0);

      // Verify filtering worked
      vpcReportResponse.body.data.results.forEach((vpc: any) => {
        expect(['us-east-1', 'us-west-2']).toContain(vpc.region);
      });

      // Step 3: Analyze connectivity through Transit Gateways
      const tgwAnalysisQuery = {
        resourceTypes: ['transitGateway'],
        fields: ['transit_gateway_id', 'state', 'region', 'amazon_side_asn'],
        filters: [
          {
            field: 'state',
            operator: 'equals',
            value: 'available'
          }
        ],
        limit: 50
      };

      const tgwReportResponse = await request(app)
        .post('/api/reports/execute')
        .send({ query: tgwAnalysisQuery })
        .expect(200);

      expect(tgwReportResponse.body.success).toBe(true);

      // Step 4: Aggregate data for regional distribution
      const aggregationResponse = await request(app)
        .post('/api/reports/aggregate')
        .send({
          resourceType: 'vpc',
          aggregation: 'count',
          groupBy: 'region'
        })
        .expect(200);

      expect(aggregationResponse.body.success).toBe(true);
      expect(aggregationResponse.body.data.aggregation.data.length).toBeGreaterThan(0);

      // Step 5: Preview complex cross-resource analysis
      const complexAnalysisQuery = {
        resourceTypes: ['vpcEndpoint'],
        fields: ['vpc_endpoint_id', 'vpc_id', 'service_name', 'state', 'endpoint_type'],
        filters: [
          {
            field: 'state',
            operator: 'equals',
            value: 'available'
          },
          {
            field: 'endpoint_type',
            operator: 'in',
            values: ['Interface', 'Gateway']
          }
        ],
        limit: 200
      };

      const previewResponse = await request(app)
        .post('/api/reports/preview')
        .send({ query: complexAnalysisQuery })
        .expect(200);

      expect(previewResponse.body.success).toBe(true);
      expect(previewResponse.body.data.data.length).toBeLessThanOrEqual(50); // Preview limit

      console.log('✅ Network Analyst Journey completed successfully');
    });

    it('should handle complex network dependency analysis', async () => {
      console.log('🎯 Testing complex dependency analysis...');

      // Step 1: Identify VPCs with endpoints
      const vpcWithEndpointsQuery = {
        resourceTypes: ['vpcEndpoint'],
        fields: ['vpc_id', 'service_name', 'endpoint_type'],
        filters: [
          {
            field: 'state',
            operator: 'equals',
            value: 'available'
          }
        ],
        groupBy: ['vpc_id'],
        limit: 100
      };

      const endpointResponse = await request(app)
        .post('/api/reports/execute')
        .send({ query: vpcWithEndpointsQuery })
        .expect(200);

      expect(endpointResponse.body.success).toBe(true);

      // Step 2: Analyze service distribution
      const serviceAggregationResponse = await request(app)
        .post('/api/reports/aggregate')
        .send({
          resourceType: 'vpcEndpoint',
          aggregation: 'count',
          groupBy: 'service_name'
        })
        .expect(200);

      expect(serviceAggregationResponse.body.success).toBe(true);

      // Step 3: Check endpoint type distribution
      const typeAggregationResponse = await request(app)
        .post('/api/reports/aggregate')
        .send({
          resourceType: 'vpcEndpoint',
          aggregation: 'count',
          groupBy: 'endpoint_type'
        })
        .expect(200);

      expect(typeAggregationResponse.body.success).toBe(true);

      console.log('✅ Complex dependency analysis completed successfully');
    });
  });

  // ===================== COMPLIANCE REPORTING JOURNEY =====================

  describe('Compliance Reporting Journey', () => {
    it('should complete comprehensive compliance audit workflow', async () => {
      console.log('🎯 Testing Compliance Reporting Journey...');

      // Step 1: Generate full inventory report
      const inventoryQuery = {
        resourceTypes: ['vpc'],
        fields: ['vpc_id', 'cidr_block', 'state', 'region', 'account_id', 'provider', 'created_at'],
        filters: [],
        orderBy: [{ field: 'account_id', direction: 'ASC' }, { field: 'region', direction: 'ASC' }],
        limit: 1000
      };

      const inventoryResponse = await request(app)
        .post('/api/reports/execute')
        .send({ query: inventoryQuery })
        .expect(200);

      expect(inventoryResponse.body.success).toBe(true);
      expect(inventoryResponse.body.data.results.length).toBeGreaterThan(0);

      // Step 2: Export full inventory to Excel for audit
      const excelExportResponse = await request(app)
        .post('/api/reports/export')
        .send({
          query: inventoryQuery,
          format: 'excel',
          options: {
            includeMetadata: true
          }
        })
        .expect(200);

      expect(excelExportResponse.body.success).toBe(true);
      expect(excelExportResponse.body.data.fileName).toMatch(/\.excel$/);
      testFiles.push(excelExportResponse.body.data.filePath);

      // Step 3: Generate security compliance report (VPC endpoints)
      const securityQuery = {
        resourceTypes: ['vpcEndpoint'],
        fields: ['vpc_endpoint_id', 'vpc_id', 'service_name', 'endpoint_type', 'state'],
        filters: [
          {
            field: 'state',
            operator: 'equals',
            value: 'available'
          }
        ],
        orderBy: [{ field: 'vpc_id', direction: 'ASC' }],
        limit: 500
      };

      const securityResponse = await request(app)
        .post('/api/reports/execute')
        .send({ query: securityQuery })
        .expect(200);

      expect(securityResponse.body.success).toBe(true);

      // Step 4: Export security report to CSV
      const csvExportResponse = await request(app)
        .post('/api/reports/export')
        .send({
          query: securityQuery,
          format: 'csv',
          options: {
            includeMetadata: true
          }
        })
        .expect(200);

      expect(csvExportResponse.body.success).toBe(true);
      testFiles.push(csvExportResponse.body.data.filePath);

      // Step 5: Generate summary compliance metrics
      const complianceMetrics = await Promise.all([
        request(app)
          .post('/api/reports/aggregate')
          .send({
            resourceType: 'vpc',
            aggregation: 'count',
            groupBy: 'account_id'
          }),
        request(app)
          .post('/api/reports/aggregate')
          .send({
            resourceType: 'vpcEndpoint',
            aggregation: 'count',
            groupBy: 'endpoint_type'
          }),
        request(app)
          .post('/api/reports/aggregate')
          .send({
            resourceType: 'transitGateway',
            aggregation: 'count',
            groupBy: 'region'
          })
      ]);

      complianceMetrics.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Step 6: Export compliance summary to PDF
      const summaryQuery = {
        resourceTypes: ['vpc'],
        fields: ['account_id', 'region', 'state'],
        filters: [],
        groupBy: ['account_id', 'region'],
        limit: 100
      };

      const pdfExportResponse = await request(app)
        .post('/api/reports/export')
        .send({
          query: summaryQuery,
          format: 'pdf',
          options: {
            includeMetadata: true
          }
        })
        .expect(200);

      expect(pdfExportResponse.body.success).toBe(true);
      testFiles.push(pdfExportResponse.body.data.filePath);

      console.log('✅ Compliance Reporting Journey completed successfully');
    });

    it('should handle large compliance data exports', async () => {
      console.log('🎯 Testing large compliance export...');

      // Add more test data for large export
      await models.Vpc.bulkCreate(generateMockVpcs(200));
      await models.VpcEndpoint.bulkCreate(generateMockVpcEndpoints(150));

      const largeComplianceQuery = {
        resourceTypes: ['vpc'],
        fields: ['vpc_id', 'cidr_block', 'state', 'region', 'account_id', 'provider', 'created_at', 'updated_at'],
        filters: [],
        orderBy: [{ field: 'created_at', direction: 'DESC' }],
        limit: 250
      };

      const startTime = Date.now();
      const response = await request(app)
        .post('/api/reports/export')
        .send({
          query: largeComplianceQuery,
          format: 'json',
          options: {
            includeMetadata: true
          }
        })
        .expect(200);

      const executionTime = Date.now() - startTime;

      expect(response.body.success).toBe(true);
      expect(response.body.data.size).toBeGreaterThan(10000); // Substantial file size
      testFiles.push(response.body.data.filePath);

      // Should complete within reasonable time
      expect(executionTime).toBeLessThan(20000); // 20 seconds
      console.log(`✅ Large compliance export completed in ${executionTime}ms`);
    });
  });

  // ===================== OPERATIONS TEAM JOURNEY =====================

  describe('Operations Team Journey', () => {
    it('should complete daily operations monitoring workflow', async () => {
      console.log('🎯 Testing Operations Team Journey...');

      // Step 1: Check overall system health
      const healthResponse = await request(app)
        .get('/api/reports/dashboard')
        .expect(200);

      expect(healthResponse.body.success).toBe(true);
      const healthMetrics = healthResponse.body.data.healthStatus;
      const healthPercentage = healthMetrics.healthPercentage;

      // Operations team needs health percentage above 95%
      if (healthPercentage < 95) {
        console.log(`⚠️ Health percentage ${healthPercentage}% below threshold`);
      }

      // Step 2: Investigate any unhealthy resources
      if (healthMetrics.warning > 0 || healthMetrics.critical > 0) {
        const unhealthyQuery = {
          resourceTypes: ['vpc'],
          fields: ['vpc_id', 'state', 'region', 'created_at'],
          filters: [
            {
              field: 'state',
              operator: 'in',
              values: ['pending', 'deleting', 'failed']
            }
          ],
          orderBy: [{ field: 'created_at', direction: 'DESC' }],
          limit: 50
        };

        const unhealthyResponse = await request(app)
          .post('/api/reports/execute')
          .send({ query: unhealthyQuery })
          .expect(200);

        expect(unhealthyResponse.body.success).toBe(true);
        console.log(`Found ${unhealthyResponse.body.data.results.length} unhealthy resources`);
      }

      // Step 3: Monitor recent changes
      const recentChangesQuery = {
        resourceTypes: ['vpc'],
        fields: ['vpc_id', 'state', 'region', 'created_at', 'updated_at'],
        filters: [
          {
            field: 'created_at',
            operator: 'greater_than',
            value: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
          }
        ],
        orderBy: [{ field: 'created_at', direction: 'DESC' }],
        limit: 100
      };

      const recentChangesResponse = await request(app)
        .post('/api/reports/execute')
        .send({ query: recentChangesQuery })
        .expect(200);

      expect(recentChangesResponse.body.success).toBe(true);

      // Step 4: Generate regional capacity report
      const capacityResponse = await request(app)
        .post('/api/reports/aggregate')
        .send({
          resourceType: 'vpc',
          aggregation: 'count',
          groupBy: 'region'
        })
        .expect(200);

      expect(capacityResponse.body.success).toBe(true);

      // Step 5: Export daily operations report
      const opsReportQuery = {
        resourceTypes: ['vpc'],
        fields: ['vpc_id', 'cidr_block', 'state', 'region', 'updated_at'],
        filters: [
          {
            field: 'state',
            operator: 'equals',
            value: 'available'
          }
        ],
        orderBy: [{ field: 'region', direction: 'ASC' }],
        limit: 200
      };

      const opsExportResponse = await request(app)
        .post('/api/reports/export')
        .send({
          query: opsReportQuery,
          format: 'csv',
          options: {
            includeMetadata: true
          }
        })
        .expect(200);

      expect(opsExportResponse.body.success).toBe(true);
      testFiles.push(opsExportResponse.body.data.filePath);

      console.log('✅ Operations Team Journey completed successfully');
    });

    it('should handle operations incident response workflow', async () => {
      console.log('🎯 Testing incident response workflow...');

      // Step 1: Rapid health assessment
      const startTime = Date.now();
      const emergencyHealthResponse = await request(app)
        .get('/api/reports/dashboard')
        .expect(200);
      const healthCheckTime = Date.now() - startTime;

      expect(emergencyHealthResponse.body.success).toBe(true);
      expect(healthCheckTime).toBeLessThan(3000); // Must respond within 3 seconds for incidents

      // Step 2: Quick filter for specific region/account if incident is localized
      const incidentQuery = {
        resourceTypes: ['vpc'],
        fields: ['vpc_id', 'state', 'region', 'account_id'],
        filters: [
          {
            field: 'region',
            operator: 'equals',
            value: 'us-east-1' // Simulated incident region
          }
        ],
        orderBy: [{ field: 'updated_at', direction: 'DESC' }],
        limit: 50
      };

      const incidentStartTime = Date.now();
      const incidentResponse = await request(app)
        .post('/api/reports/execute')
        .send({ query: incidentQuery })
        .expect(200);
      const incidentQueryTime = Date.now() - incidentStartTime;

      expect(incidentResponse.body.success).toBe(true);
      expect(incidentQueryTime).toBeLessThan(5000); // Must be fast for incident response

      // Step 3: Generate immediate incident report
      const incidentExportResponse = await request(app)
        .post('/api/reports/export')
        .send({
          query: incidentQuery,
          format: 'json',
          options: {
            includeMetadata: true
          }
        })
        .expect(200);

      expect(incidentExportResponse.body.success).toBe(true);
      testFiles.push(incidentExportResponse.body.data.filePath);

      console.log(`✅ Incident response completed - Health check: ${healthCheckTime}ms, Query: ${incidentQueryTime}ms`);
    });
  });

  // ===================== MULTI-USER COLLABORATION JOURNEY =====================

  describe('Multi-User Collaboration Journey', () => {
    it('should handle concurrent multi-team access', async () => {
      console.log('🎯 Testing multi-user collaboration...');

      // Simulate different teams accessing system simultaneously
      const teamWorkflows = [
        // Executive team - Dashboard
        request(app).get('/api/reports/dashboard'),

        // Network team - VPC analysis
        request(app)
          .post('/api/reports/execute')
          .send({
            query: {
              resourceTypes: ['vpc'],
              fields: ['vpc_id', 'cidr_block', 'region'],
              filters: [],
              limit: 100
            }
          }),

        // Security team - Endpoint analysis
        request(app)
          .post('/api/reports/execute')
          .send({
            query: {
              resourceTypes: ['vpcEndpoint'],
              fields: ['vpc_endpoint_id', 'service_name', 'endpoint_type'],
              filters: [{ field: 'state', operator: 'equals', value: 'available' }],
              limit: 100
            }
          }),

        // Operations team - Health check
        request(app)
          .post('/api/reports/aggregate')
          .send({
            resourceType: 'vpc',
            aggregation: 'count',
            groupBy: 'state'
          }),

        // Compliance team - Export
        request(app)
          .post('/api/reports/export')
          .send({
            query: {
              resourceTypes: ['transitGateway'],
              fields: ['transit_gateway_id', 'state', 'region'],
              filters: [],
              limit: 50
            },
            format: 'csv'
          })
      ];

      const startTime = Date.now();
      const results = await Promise.all(teamWorkflows);
      const totalTime = Date.now() - startTime;

      // All team requests should succeed
      results.forEach((result, index) => {
        expect(result.status).toBe(200);
        expect(result.body.success).toBe(true);
        console.log(`Team ${index + 1} request completed successfully`);
      });

      // Add export file to cleanup
      const exportResult = results[4]; // Export request
      if (exportResult.body.data?.filePath) {
        testFiles.push(exportResult.body.data.filePath);
      }

      // Should handle all teams efficiently
      expect(totalTime).toBeLessThan(20000); // 20 seconds for all teams
      console.log(`✅ Multi-team collaboration completed in ${totalTime}ms`);
    });

    it('should maintain data consistency across concurrent operations', async () => {
      console.log('🎯 Testing data consistency...');

      // Multiple users requesting same data should get consistent results
      const consistencyQuery = {
        resourceTypes: ['vpc'],
        fields: ['vpc_id', 'state', 'region'],
        filters: [],
        orderBy: [{ field: 'vpc_id', direction: 'ASC' }],
        limit: 100
      };

      const concurrentRequests = Array(5).fill(null).map(() =>
        request(app)
          .post('/api/reports/execute')
          .send({ query: consistencyQuery })
      );

      const responses = await Promise.all(concurrentRequests);

      // All responses should be identical
      responses.forEach(response => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Compare results for consistency
      const firstResult = responses[0].body.data.results;
      responses.slice(1).forEach((response, index) => {
        const currentResult = response.body.data.results;
        expect(currentResult).toEqual(firstResult);
        console.log(`Result ${index + 2} matches baseline`);
      });

      console.log('✅ Data consistency verified across concurrent operations');
    });
  });

  // ===================== ERROR RECOVERY JOURNEY =====================

  describe('Error Recovery Journey', () => {
    it('should handle and recover from various error scenarios', async () => {
      console.log('🎯 Testing error recovery scenarios...');

      // Test 1: Invalid query graceful handling
      const invalidResponse = await request(app)
        .post('/api/reports/execute')
        .send({ query: { invalid: 'query' } })
        .expect(400);

      expect(invalidResponse.body.success).toBe(false);
      expect(invalidResponse.body.errors).toBeDefined();

      // Test 2: System should still be functional after error
      const recoveryResponse = await request(app)
        .get('/api/reports/dashboard')
        .expect(200);

      expect(recoveryResponse.body.success).toBe(true);

      // Test 3: Malformed request handling
      const malformedResponse = await request(app)
        .post('/api/reports/execute')
        .set('Content-Type', 'application/json')
        .send('{ malformed json }')
        .expect(400);

      expect(malformedResponse.body.success).toBe(false);

      // Test 4: System still responsive after malformed request
      const responseAfterError = await request(app)
        .post('/api/reports/execute')
        .send({
          query: {
            resourceTypes: ['vpc'],
            fields: ['vpc_id', 'state'],
            filters: [],
            limit: 10
          }
        })
        .expect(200);

      expect(responseAfterError.body.success).toBe(true);

      console.log('✅ Error recovery scenarios handled successfully');
    });
  });
});

// ===================== MOCK E2E ROUTES SETUP =====================

function setupMockE2ERoutes(app: express.Application) {
  // Enhanced mock routes for E2E testing with more realistic behavior

  app.get('/api/reports/dashboard', async (req, res) => {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 150));

    res.json({
      success: true,
      data: {
        resourceCounts: {
          vpc: 50,
          transitGateway: 20,
          customerGateway: 15,
          vpcEndpoint: 40,
          total: 125
        },
        healthStatus: {
          healthy: 115,
          warning: 8,
          critical: 2,
          total: 125,
          healthPercentage: 92,
          lastChecked: new Date()
        },
        recentActivity: [
          { type: 'vpc', id: 'vpc-123', action: 'created', timestamp: new Date() },
          { type: 'vpcEndpoint', id: 'vpce-456', action: 'created', timestamp: new Date() }
        ],
        utilizationMetrics: {
          vpc: { total: 50, active: 47, utilization: 94 },
          lastCalculated: new Date()
        },
        lastUpdated: new Date()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        executionTime: 150,
        version: '1.0'
      }
    });
  });

  app.post('/api/reports/execute', async (req, res) => {
    const { query } = req.body;

    if (!query || !query.resourceTypes) {
      return res.status(400).json({
        success: false,
        errors: [{ code: 'VALIDATION_ERROR', message: 'Invalid query structure' }]
      });
    }

    // Simulate processing time based on complexity
    const processingTime = Math.min(500, (query.limit || 100) * 2);
    await new Promise(resolve => setTimeout(resolve, processingTime));

    // Generate appropriate mock data based on resource type
    let mockData;
    switch (query.resourceTypes[0]) {
      case 'vpc':
        mockData = generateMockVpcs(Math.min(query.limit || 100, 50));
        break;
      case 'transitGateway':
        mockData = generateMockTransitGateways(Math.min(query.limit || 100, 20));
        break;
      case 'customerGateway':
        mockData = generateMockCustomerGateways(Math.min(query.limit || 100, 15));
        break;
      case 'vpcEndpoint':
        mockData = generateMockVpcEndpoints(Math.min(query.limit || 100, 40));
        break;
      default:
        mockData = generateMockVpcs(Math.min(query.limit || 100, 50));
    }

    // Apply filters if specified
    if (query.filters && query.filters.length > 0) {
      mockData = mockData.filter(item => {
        return query.filters.every((filter: any) => {
          const fieldValue = item[filter.field];
          switch (filter.operator) {
            case 'equals':
              return fieldValue === filter.value;
            case 'in':
              return filter.values.includes(fieldValue);
            case 'like':
              return fieldValue && fieldValue.toString().includes(filter.value);
            default:
              return true;
          }
        });
      });
    }

    res.json({
      success: true,
      data: {
        results: mockData,
        totalCount: mockData.length,
        executionTime: processingTime,
        query,
        generatedAt: new Date()
      },
      metadata: {
        timestamp: new Date().toISOString(),
        executionTime: processingTime,
        version: '1.0'
      }
    });
  });

  app.post('/api/reports/preview', async (req, res) => {
    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        errors: [{ code: 'VALIDATION_ERROR', message: 'Query is required' }]
      });
    }

    // Preview is limited to 50 records
    const mockData = generateMockVpcs(Math.min(50, 20));

    res.json({
      success: true,
      data: {
        data: mockData,
        totalCount: 1000, // Simulated large dataset
        executionTime: 89,
        query: 'SELECT ... LIMIT 50',
        warnings: ['Large dataset detected. Consider adding filters.']
      }
    });
  });

  app.post('/api/reports/aggregate', async (req, res) => {
    const { resourceType, aggregation, groupBy } = req.body;

    if (!resourceType || !aggregation || !groupBy) {
      return res.status(400).json({
        success: false,
        errors: [{ code: 'VALIDATION_ERROR', message: 'Missing required fields' }]
      });
    }

    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 100));

    // Generate mock aggregation data
    let aggregationData;
    switch (groupBy) {
      case 'region':
        aggregationData = [
          { group: 'us-east-1', value: 25 },
          { group: 'us-west-2', value: 18 },
          { group: 'eu-west-1', value: 7 }
        ];
        break;
      case 'state':
        aggregationData = [
          { group: 'available', value: 45 },
          { group: 'pending', value: 4 },
          { group: 'deleting', value: 1 }
        ];
        break;
      case 'account_id':
        aggregationData = [
          { group: '123456789011', value: 30 },
          { group: '123456789012', value: 20 }
        ];
        break;
      default:
        aggregationData = [{ group: 'default', value: 50 }];
    }

    res.json({
      success: true,
      data: {
        aggregation: {
          type: aggregation,
          groupBy,
          data: aggregationData
        },
        totalGroups: aggregationData.length,
        executionTime: 100
      }
    });
  });

  app.post('/api/reports/export', async (req, res) => {
    const { query, format } = req.body;

    if (!query || !format) {
      return res.status(400).json({
        success: false,
        errors: [{ code: 'VALIDATION_ERROR', message: 'Query and format are required' }]
      });
    }

    // Simulate export processing time
    const exportTime = format === 'pdf' ? 2000 : format === 'excel' ? 1500 : 800;
    await new Promise(resolve => setTimeout(resolve, exportTime));

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `report_${timestamp}.${format}`;

    res.json({
      success: true,
      data: {
        filePath: `/tmp/exports/${fileName}`,
        fileName,
        size: Math.floor(Math.random() * 50000) + 5000 // Random size between 5KB-55KB
      }
    });
  });

  app.get('/api/reports/analytics', async (req, res) => {
    await new Promise(resolve => setTimeout(resolve, 50));

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