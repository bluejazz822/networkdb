/**
 * Reports Integration Tests
 * Test the reporting system endpoints and services
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../../index';
import { ReportingService } from '../../services/reporting/ReportingService';
import { ExportService } from '../../services/reporting/ExportService';
import { sequelize } from '../../config/database';

describe('Reports API Integration Tests', () => {
  let reportingService: ReportingService;
  let exportService: ExportService;

  beforeAll(async () => {
    reportingService = new ReportingService(sequelize);
    exportService = new ExportService('./test-exports');
  });

  afterAll(async () => {
    // Clean up test exports
    await exportService.cleanupOldFiles(0); // Delete all test files
  });

  describe('Dashboard Endpoints', () => {
    test('GET /api/reports/dashboard should return dashboard data', async () => {
      const response = await request(app)
        .get('/api/reports/dashboard')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('resourceCounts');
      expect(response.body.data).toHaveProperty('healthStatus');
      expect(response.body.data).toHaveProperty('lastUpdated');
    });

    test('GET /api/reports/dashboard/widgets/metrics should return widget data', async () => {
      const response = await request(app)
        .get('/api/reports/dashboard/widgets/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('Report Generation Endpoints', () => {
    test('POST /api/reports/generate should generate a report', async () => {
      const reportQuery = {
        resourceTypes: ['vpc'],
        fields: ['vpc_id', 'cidr_block', 'state'],
        limit: 10
      };

      const response = await request(app)
        .post('/api/reports/generate')
        .send(reportQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('results');
      expect(response.body.data).toHaveProperty('totalCount');
      expect(response.body.data).toHaveProperty('executionTime');
    });

    test('POST /api/reports/preview should generate a preview', async () => {
      const reportQuery = {
        resourceTypes: ['vpc'],
        fields: ['vpc_id', 'state'],
        limit: 5
      };

      const response = await request(app)
        .post('/api/reports/preview')
        .send(reportQuery)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('totalCount');
      expect(response.body.data.data.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Export Endpoints', () => {
    test('POST /api/reports/export should export data as CSV', async () => {
      const exportData = {
        data: [
          { id: 1, name: 'test-vpc-1', status: 'active' },
          { id: 2, name: 'test-vpc-2', status: 'inactive' }
        ],
        format: 'csv',
        metadata: { reportName: 'Test Report' }
      };

      const response = await request(app)
        .post('/api/reports/export')
        .send(exportData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('downloadUrl');
      expect(response.body.data).toHaveProperty('fileName');
      expect(response.body.data.format).toBe('csv');
    });

    test('POST /api/reports/export should export data as JSON', async () => {
      const exportData = {
        data: [
          { id: 1, name: 'test-vpc-1', status: 'active' }
        ],
        format: 'json',
        options: { includeMetadata: true }
      };

      const response = await request(app)
        .post('/api/reports/export')
        .send(exportData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.format).toBe('json');
    });
  });

  describe('Template Endpoints', () => {
    test('GET /api/reports/templates should return available templates', async () => {
      const response = await request(app)
        .get('/api/reports/templates')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    test('GET /api/reports/templates/:id should return specific template', async () => {
      const response = await request(app)
        .get('/api/reports/templates/inventory-summary')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name');
    });
  });

  describe('Analytics Endpoints', () => {
    test('GET /api/reports/analytics should return report analytics', async () => {
      const response = await request(app)
        .get('/api/reports/analytics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Health Check', () => {
    test('GET /api/reports/health should return system health', async () => {
      const response = await request(app)
        .get('/api/reports/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('status');
      expect(response.body.data).toHaveProperty('services');
      expect(response.body.data.status).toBe('healthy');
    });
  });

  describe('Error Handling', () => {
    test('POST /api/reports/generate with invalid data should return 400', async () => {
      const invalidQuery = {
        resourceTypes: [], // Invalid: empty array
        fields: []
      };

      const response = await request(app)
        .post('/api/reports/generate')
        .send(invalidQuery)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.errors).toBeDefined();
    });

    test('GET /api/reports/dashboard/widgets/invalid should return 404', async () => {
      const response = await request(app)
        .get('/api/reports/dashboard/widgets/invalid')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });
});

describe('ReportingService Unit Tests', () => {
  let reportingService: ReportingService;

  beforeAll(() => {
    reportingService = new ReportingService(sequelize);
  });

  test('should get dashboard data', async () => {
    const result = await reportingService.getDashboardData();
    
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('resourceCounts');
    expect(result.data).toHaveProperty('healthStatus');
    expect(result.data).toHaveProperty('utilizationMetrics');
  });

  test('should generate report preview', async () => {
    const query = {
      resourceTypes: ['vpc' as const],
      fields: ['vpc_id', 'state'],
      limit: 5
    };

    const result = await reportingService.generateReportPreview(query);
    
    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('data');
    expect(result.data).toHaveProperty('totalCount');
    expect(result.data).toHaveProperty('executionTime');
  });

  test('should get aggregated data', async () => {
    const result = await reportingService.getAggregatedData(
      'vpc',
      'count',
      'state'
    );

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('aggregation');
    expect(result.data.aggregation).toHaveProperty('type', 'count');
    expect(result.data.aggregation).toHaveProperty('groupBy', 'state');
  });
});

describe('ExportService Unit Tests', () => {
  let exportService: ExportService;
  const testData = [
    { id: 1, name: 'test-item-1', status: 'active' },
    { id: 2, name: 'test-item-2', status: 'inactive' }
  ];

  beforeAll(() => {
    exportService = new ExportService('./test-exports');
  });

  afterAll(async () => {
    await exportService.cleanupOldFiles(0);
  });

  test('should export data as CSV', async () => {
    const result = await exportService.exportData(
      testData,
      'csv',
      { format: 'csv', includeMetadata: false }
    );

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('filePath');
    expect(result.data).toHaveProperty('fileName');
    expect(result.data?.fileName.endsWith('.csv')).toBe(true);
  });

  test('should export data as JSON', async () => {
    const result = await exportService.exportData(
      testData,
      'json',
      { format: 'json', includeMetadata: true },
      { reportName: 'Test Report' }
    );

    expect(result.success).toBe(true);
    expect(result.data?.fileName.endsWith('.json')).toBe(true);
  });

  test('should handle empty data', async () => {
    const result = await exportService.exportData(
      [],
      'csv',
      { format: 'csv' }
    );

    expect(result.success).toBe(true);
    expect(result.data).toHaveProperty('size');
    expect(result.data?.size).toBe(0);
  });

  test('should handle invalid format', async () => {
    const result = await exportService.exportData(
      testData,
      'invalid' as any,
      { format: 'invalid' as any }
    );

    expect(result.success).toBe(false);
    expect(result.errors?.[0]?.message).toContain('Unsupported export format');
  });
});

describe('Data Validation Tests', () => {
  test('should validate report query structure', async () => {
    const validQuery = {
      resourceTypes: ['vpc'],
      fields: ['vpc_id', 'state'],
      filters: [
        {
          field: 'state',
          operator: 'equals',
          value: 'available'
        }
      ],
      limit: 100
    };

    const response = await request(app)
      .post('/api/reports/generate')
      .send(validQuery)
      .expect(200);

    expect(response.body.success).toBe(true);
  });

  test('should reject invalid filter operators', async () => {
    const invalidQuery = {
      resourceTypes: ['vpc'],
      fields: ['vpc_id'],
      filters: [
        {
          field: 'state',
          operator: 'invalid_operator',
          value: 'test'
        }
      ]
    };

    const response = await request(app)
      .post('/api/reports/generate')
      .send(invalidQuery)
      .expect(400);

    expect(response.body.success).toBe(false);
  });
});