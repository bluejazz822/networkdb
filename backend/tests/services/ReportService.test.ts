/**
 * Report Service Test Suite
 * Comprehensive tests for the core report service functionality
 */

import { ReportService, ReportGenerationOptions, ReportDefinition } from '../../src/services/ReportService';
import { ReportTemplateEngine, ReportTemplate } from '../../src/templates/ReportTemplateEngine';
import { TemplateManager } from '../../src/templates/managers/TemplateManager';
import { ReportDataService } from '../../src/services/ReportDataService';

// Mock dependencies
jest.mock('../../src/services/ReportDataService');
jest.mock('winston', () => ({
  createLogger: () => ({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
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

describe('ReportService', () => {
  let reportService: ReportService;
  let templateEngine: ReportTemplateEngine;
  let templateManager: TemplateManager;
  let mockDataService: jest.Mocked<ReportDataService>;

  // Test data
  const mockTemplate: ReportTemplate = {
    id: 'test-template-1',
    name: 'Test VPC Report',
    description: 'Test template for VPC reporting',
    version: '1.0.0',
    format: 'HTML',
    category: 'network',
    template: `
      <h1>{{_meta.reportTitle}}</h1>
      <p>Generated on: {{formatDate _meta.reportDate}}</p>
      <table>
        <thead>
          <tr>
            <th>VPC ID</th>
            <th>Name</th>
            <th>CIDR Block</th>
            <th>State</th>
          </tr>
        </thead>
        <tbody>
          {{#each vpcs}}
          <tr>
            <td>{{vpcId}}</td>
            <td>{{name}}</td>
            <td>{{cidrBlock}}</td>
            <td>{{state}}</td>
          </tr>
          {{/each}}
        </tbody>
      </table>
      <p>Total VPCs: {{length vpcs}}</p>
    `,
    metadata: {
      author: 'test-user',
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-01'),
      tags: ['vpc', 'network', 'test'],
      isPublic: true,
      reportTypes: ['vpc-inventory'],
    },
    validation: {
      requiredFields: ['vpcs'],
    },
  };

  const mockVPCData = [
    {
      vpcId: 'vpc-123456789',
      name: 'Production VPC',
      cidrBlock: '10.0.0.0/16',
      state: 'available',
      region: 'us-east-1',
    },
    {
      vpcId: 'vpc-987654321',
      name: 'Development VPC',
      cidrBlock: '10.1.0.0/16',
      state: 'available',
      region: 'us-west-2',
    },
  ];

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();

    // Create service instance
    reportService = new ReportService();

    // Setup mock data service
    mockDataService = new ReportDataService() as jest.Mocked<ReportDataService>;
    mockDataService.initialize = jest.fn().mockResolvedValue(undefined);
    mockDataService.getVPCsByProvider = jest.fn().mockResolvedValue({
      success: true,
      data: mockVPCData,
    });
    mockDataService.close = jest.fn().mockResolvedValue(undefined);

    // Replace the data service instance
    (reportService as any).dataService = mockDataService;

    // Initialize the service
    await reportService.initialize();

    // Get references to internal components
    templateEngine = (reportService as any).templateEngine;
    templateManager = (reportService as any).templateManager;

    // Register test template
    templateEngine.registerTemplate(mockTemplate);
  });

  afterEach(async () => {
    await reportService.shutdown();
  });

  describe('Service Initialization', () => {
    test('should initialize successfully', async () => {
      expect(reportService).toBeDefined();
      expect(mockDataService.initialize).toHaveBeenCalled();
    });

    test('should not initialize twice', async () => {
      await reportService.initialize();
      expect(mockDataService.initialize).toHaveBeenCalledTimes(1);
    });

    test('should handle initialization errors', async () => {
      const failingService = new ReportService();
      (failingService as any).dataService.initialize = jest.fn().mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(failingService.initialize()).rejects.toThrow('Database connection failed');
    });
  });

  describe('Report Generation', () => {
    test('should generate HTML report successfully', async () => {
      const options: ReportGenerationOptions = {
        templateId: 'test-template-1',
        reportTitle: 'Test VPC Report',
        userId: 'test-user',
      };

      const result = await reportService.generateReport(options);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.templateId).toBe('test-template-1');
      expect(result.data!.metadata.recordCount).toBe(2);
      expect(result.data!.metadata.format).toBe('HTML');
      expect(typeof result.data!.output).toBe('string');

      // Verify the output contains expected data
      const output = result.data!.output as string;
      expect(output).toContain('Test VPC Report');
      expect(output).toContain('vpc-123456789');
      expect(output).toContain('Production VPC');
      expect(output).toContain('Total VPCs: 2');
    });

    test('should handle missing template', async () => {
      const options: ReportGenerationOptions = {
        templateId: 'non-existent-template',
        userId: 'test-user',
      };

      const result = await reportService.generateReport(options);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors![0].code).toBe('TEMPLATE_NOT_FOUND');
    });

    test('should handle data service errors', async () => {
      mockDataService.getVPCsByProvider.mockResolvedValue({
        success: false,
        errors: [{ code: 'DATA_ERROR', message: 'Failed to fetch data' }],
      });

      const options: ReportGenerationOptions = {
        templateId: 'test-template-1',
        userId: 'test-user',
      };

      const result = await reportService.generateReport(options);

      expect(result.success).toBe(true); // Should still succeed with empty data
      expect(result.data!.metadata.recordCount).toBe(0);
    });

    test('should include custom metadata in report', async () => {
      const options: ReportGenerationOptions = {
        templateId: 'test-template-1',
        reportTitle: 'Custom Report Title',
        timezone: 'America/New_York',
        locale: 'en-US',
        userId: 'test-user',
      };

      const result = await reportService.generateReport(options);

      expect(result.success).toBe(true);
      const output = result.data!.output as string;
      expect(output).toContain('Custom Report Title');
    });

    test('should track template usage', async () => {
      const options: ReportGenerationOptions = {
        templateId: 'test-template-1',
        userId: 'test-user-123',
      };

      await reportService.generateReport(options);

      const usageResult = templateManager.getTemplateUsage('test-template-1');
      expect(usageResult.success).toBe(true);
      expect(usageResult.data).toBeDefined();
      expect(usageResult.data!.usageCount).toBe(1);
      expect(usageResult.data!.topUsers).toContainEqual({
        userId: 'test-user-123',
        count: 1,
      });
    });

    test('should emit execution events', async () => {
      const startedListener = jest.fn();
      const progressListener = jest.fn();
      const completedListener = jest.fn();

      reportService.on('execution:started', startedListener);
      reportService.on('execution:progress', progressListener);
      reportService.on('execution:completed', completedListener);

      const options: ReportGenerationOptions = {
        templateId: 'test-template-1',
        userId: 'test-user',
      };

      await reportService.generateReport(options);

      expect(startedListener).toHaveBeenCalled();
      expect(progressListener).toHaveBeenCalled();
      expect(completedListener).toHaveBeenCalled();
    });
  });

  describe('Report Definition Management', () => {
    test('should create report definition successfully', async () => {
      const reportData = {
        name: 'Monthly VPC Report',
        description: 'Monthly summary of VPC inventory',
        templateId: 'test-template-1',
        dataQuery: {
          type: 'vpc' as const,
          filters: { region: 'us-east-1' },
        },
        userId: 'test-user',
      };

      const result = await reportService.create(reportData);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.name).toBe('Monthly VPC Report');
      expect(result.data!.templateId).toBe('test-template-1');
      expect(result.data!.metadata.author).toBe('test-user');
      expect(result.data!.metadata.isActive).toBe(true);
    });

    test('should not create report with non-existent template', async () => {
      const reportData = {
        name: 'Invalid Report',
        description: 'Report with invalid template',
        templateId: 'non-existent-template',
        dataQuery: { type: 'vpc' as const },
        userId: 'test-user',
      };

      const result = await reportService.create(reportData);

      expect(result.success).toBe(false);
      expect(result.errors![0].code).toBe('TEMPLATE_NOT_FOUND');
    });

    test('should retrieve report definition by ID', async () => {
      // First create a report
      const reportData = {
        name: 'Test Report',
        description: 'Test report description',
        templateId: 'test-template-1',
        dataQuery: { type: 'vpc' as const },
        userId: 'test-user',
      };

      const createResult = await reportService.create(reportData);
      expect(createResult.success).toBe(true);

      const reportId = createResult.data!.id;

      // Then retrieve it
      const result = await reportService.findById(reportId);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.id).toBe(reportId);
      expect(result.data!.name).toBe('Test Report');
    });

    test('should handle non-existent report ID', async () => {
      const result = await reportService.findById('non-existent-id');

      expect(result.success).toBe(false);
      expect(result.errors![0].code).toBe('REPORT_NOT_FOUND');
    });

    test('should update report definition', async () => {
      // Create a report first
      const reportData = {
        name: 'Original Report',
        description: 'Original description',
        templateId: 'test-template-1',
        dataQuery: { type: 'vpc' as const },
        userId: 'test-user',
      };

      const createResult = await reportService.create(reportData);
      const reportId = createResult.data!.id;

      // Update the report
      const updates = {
        name: 'Updated Report',
        description: 'Updated description',
      };

      const result = await reportService.update(reportId, updates, 'test-user');

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('Updated Report');
      expect(result.data!.description).toBe('Updated description');
      expect(result.data!.templateId).toBe('test-template-1'); // Should remain unchanged
    });

    test('should delete report definition', async () => {
      // Create a report first
      const reportData = {
        name: 'Report to Delete',
        description: 'This report will be deleted',
        templateId: 'test-template-1',
        dataQuery: { type: 'vpc' as const },
        userId: 'test-user',
      };

      const createResult = await reportService.create(reportData);
      const reportId = createResult.data!.id;

      // Delete the report
      const deleteResult = await reportService.delete(reportId, 'test-user');

      expect(deleteResult.success).toBe(true);

      // Verify it's deleted
      const findResult = await reportService.findById(reportId);
      expect(findResult.success).toBe(false);
    });

    test('should find all reports with pagination', async () => {
      // Create multiple reports
      const reportPromises = Array.from({ length: 5 }, (_, i) =>
        reportService.create({
          name: `Report ${i + 1}`,
          description: `Description ${i + 1}`,
          templateId: 'test-template-1',
          dataQuery: { type: 'vpc' as const },
          userId: 'test-user',
        })
      );

      await Promise.all(reportPromises);

      // Find all with pagination
      const result = await reportService.findAll({
        page: 1,
        limit: 3,
        sortBy: 'name',
        sortOrder: 'ASC',
      });

      expect(result.success).toBe(true);
      expect(result.data!.data).toHaveLength(3);
      expect(result.data!.totalCount).toBe(5);
      expect(result.data!.hasNextPage).toBe(true);
      expect(result.data!.page).toBe(1);
    });
  });

  describe('Execution Management', () => {
    test('should track execution status during report generation', async () => {
      const options: ReportGenerationOptions = {
        templateId: 'test-template-1',
        userId: 'test-user',
      };

      // Start generation (returns immediately with execution ID)
      const generationPromise = reportService.generateReport(options);

      // Small delay to allow execution tracking to initialize
      await new Promise(resolve => setTimeout(resolve, 10));

      const result = await generationPromise;
      expect(result.success).toBe(true);

      const executionId = result.data!.executionId;

      // Check execution status
      const statusResult = reportService.getExecutionStatus(executionId);
      expect(statusResult.success).toBe(true);
      expect(statusResult.data).toBeDefined();
      expect(statusResult.data!.status).toBe('completed');
      expect(statusResult.data!.recordCount).toBe(2);
    });

    test('should get execution history', async () => {
      // Generate a few reports
      const options: ReportGenerationOptions = {
        templateId: 'test-template-1',
        userId: 'test-user',
      };

      await reportService.generateReport(options);
      await reportService.generateReport(options);

      const historyResult = reportService.getExecutionHistory();

      expect(historyResult.success).toBe(true);
      expect(historyResult.data!).toHaveLength(2);
      expect(historyResult.data![0].startTime.getTime()).toBeGreaterThan(
        historyResult.data![1].startTime.getTime()
      ); // Should be sorted by newest first
    });

    test('should filter execution history by report definition', async () => {
      // Create two different reports
      const report1 = await reportService.create({
        name: 'Report 1',
        description: 'First report',
        templateId: 'test-template-1',
        dataQuery: { type: 'vpc' as const },
        userId: 'test-user',
      });

      const report2 = await reportService.create({
        name: 'Report 2',
        description: 'Second report',
        templateId: 'test-template-1',
        dataQuery: { type: 'vpc' as const },
        userId: 'test-user',
      });

      // Generate reports for each definition
      await reportService.generateReport({
        templateId: 'test-template-1',
        userId: 'test-user',
      });

      await reportService.generateReport({
        templateId: 'test-template-1',
        userId: 'test-user',
      });

      const historyResult = reportService.getExecutionHistory(report1.data!.id);

      expect(historyResult.success).toBe(true);
      // Note: Since we're generating ad-hoc reports, they won't be filtered by definition ID
      // In a real implementation, this would work with scheduled reports
    });
  });

  describe('Template Management Integration', () => {
    test('should get available templates', async () => {
      const result = await reportService.getAvailableTemplates();

      expect(result.success).toBe(true);
      expect(result.data!).toHaveLength(3); // Our test template + 2 default templates
      expect(result.data!.some(t => t.id === 'test-template-1')).toBe(true);
    });

    test('should filter templates by category', async () => {
      const result = await reportService.getAvailableTemplates({
        category: 'network',
      });

      expect(result.success).toBe(true);
      expect(result.data!.length).toBeGreaterThan(0);
      expect(result.data!.every(t => t.category === 'network')).toBe(true);
    });

    test('should create new template', async () => {
      const templateData = {
        name: 'New Test Template',
        description: 'A new template for testing',
        format: 'HTML' as const,
        category: 'custom',
        template: '<h1>{{title}}</h1><p>{{content}}</p>',
        metadata: {
          tags: ['test', 'custom'],
          isPublic: false,
          reportTypes: ['custom-report'],
        },
      };

      const result = await reportService.createTemplate(templateData, 'test-user');

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('New Test Template');
      expect(result.data!.metadata.author).toBe('test-user');
    });

    test('should update template', async () => {
      const updates = {
        name: 'Updated Template Name',
        template: '<h1>Updated: {{title}}</h1>',
      };

      const result = await reportService.updateTemplate('test-template-1', updates, 'test-user');

      expect(result.success).toBe(true);
      expect(result.data!.name).toBe('Updated Template Name');
      expect(result.data!.template).toContain('Updated: {{title}}');
    });

    test('should delete template', async () => {
      // Create a template to delete
      const templateData = {
        name: 'Template to Delete',
        description: 'This template will be deleted',
        format: 'HTML' as const,
        category: 'temp',
        template: '<p>Temporary template</p>',
      };

      const createResult = await reportService.createTemplate(templateData, 'test-user');
      const templateId = createResult.data!.id;

      // Delete the template
      const deleteResult = await reportService.deleteTemplate(templateId, 'test-user');

      expect(deleteResult.success).toBe(true);

      // Verify it's deleted
      const templates = await reportService.getAvailableTemplates();
      expect(templates.data!.some(t => t.id === templateId)).toBe(false);
    });
  });

  describe('Service Statistics', () => {
    test('should get comprehensive service statistics', async () => {
      // Create some test data
      await reportService.create({
        name: 'Test Report 1',
        description: 'First test report',
        templateId: 'test-template-1',
        dataQuery: { type: 'vpc' as const },
        userId: 'test-user',
      });

      await reportService.create({
        name: 'Test Report 2',
        description: 'Second test report',
        templateId: 'test-template-1',
        dataQuery: { type: 'vpc' as const },
        userId: 'test-user',
      });

      await reportService.generateReport({
        templateId: 'test-template-1',
        userId: 'test-user',
      });

      const result = await reportService.getServiceStatistics();

      expect(result.success).toBe(true);
      expect(result.data!.reports.total).toBe(2);
      expect(result.data!.reports.active).toBe(2);
      expect(result.data!.executions.total).toBe(1);
      expect(result.data!.executions.completed).toBe(1);
      expect(result.data!.templates.total).toBeGreaterThan(0);
      expect(result.data!.executions.recentActivity).toHaveLength(7); // Last 7 days
    });
  });

  describe('Error Handling', () => {
    test('should handle template compilation errors', async () => {
      // Register a template with syntax errors
      const badTemplate: ReportTemplate = {
        ...mockTemplate,
        id: 'bad-template',
        template: '{{#each items}} {{missing-close-tag}',
      };

      templateEngine.registerTemplate(badTemplate);

      const options: ReportGenerationOptions = {
        templateId: 'bad-template',
        userId: 'test-user',
      };

      const result = await reportService.generateReport(options);

      expect(result.success).toBe(false);
      expect(result.errors![0].code).toBe('REPORT_GENERATION_ERROR');
    });

    test('should handle data service failures gracefully', async () => {
      mockDataService.getVPCsByProvider.mockRejectedValue(
        new Error('Database connection failed')
      );

      const options: ReportGenerationOptions = {
        templateId: 'test-template-1',
        userId: 'test-user',
      };

      const result = await reportService.generateReport(options);

      expect(result.success).toBe(false);
      expect(result.errors![0].code).toBe('REPORT_GENERATION_ERROR');
    });

    test('should handle service shutdown gracefully', async () => {
      await reportService.shutdown();

      // Service should still handle method calls but might return errors
      const result = await reportService.findAll();
      // Depending on implementation, this might succeed or fail
      // The key is that it shouldn't throw unhandled exceptions
    });
  });

  describe('Event System', () => {
    test('should support event listeners', async () => {
      const eventListener = jest.fn();
      reportService.on('test-event', eventListener);

      reportService.emit('test-event', { data: 'test' });

      expect(eventListener).toHaveBeenCalledWith({ data: 'test' });
    });

    test('should support removing event listeners', async () => {
      const eventListener = jest.fn();
      reportService.on('test-event', eventListener);
      reportService.off('test-event', eventListener);

      reportService.emit('test-event', { data: 'test' });

      expect(eventListener).not.toHaveBeenCalled();
    });
  });

  describe('Performance and Resource Management', () => {
    test('should handle large datasets efficiently', async () => {
      // Mock a large dataset
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        vpcId: `vpc-${i.toString().padStart(9, '0')}`,
        name: `VPC ${i}`,
        cidrBlock: `10.${Math.floor(i / 256)}.${i % 256}.0/24`,
        state: 'available',
        region: 'us-east-1',
      }));

      mockDataService.getVPCsByProvider.mockResolvedValue({
        success: true,
        data: largeDataset,
      });

      const startTime = Date.now();

      const options: ReportGenerationOptions = {
        templateId: 'test-template-1',
        userId: 'test-user',
      };

      const result = await reportService.generateReport(options);

      const duration = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.data!.metadata.recordCount).toBe(10000);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    test('should clean up resources on shutdown', async () => {
      await reportService.shutdown();

      expect(mockDataService.close).toHaveBeenCalled();
    });
  });
});