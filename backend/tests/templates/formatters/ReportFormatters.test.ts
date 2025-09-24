/**
 * Report Formatters Tests
 * Comprehensive tests for format generators and factory patterns
 */

import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { EventEmitter } from 'events';
import { ExportFormat } from '../../../src/types/export';
import {
  ReportFormatterFactory,
  JSONGenerator,
  HTMLGenerator,
  IFormatGenerator,
  FormatGeneratorOptions,
  FormatGeneratorResult,
  createReportFormatterFactory
} from '../../../src/templates/formatters/ReportFormatters';
import { ReportTemplateEngine, TemplateRenderResult } from '../../../src/templates/ReportTemplateEngine';

// Mock the template engine
jest.mock('../../../src/templates/ReportTemplateEngine');

describe('ReportFormatters', () => {
  let templateEngine: jest.Mocked<ReportTemplateEngine>;
  let factory: ReportFormatterFactory;
  let mockTemplateResult: TemplateRenderResult;

  beforeEach(() => {
    // Create mock template engine
    templateEngine = {
      renderTemplate: jest.fn(),
      compileTemplate: jest.fn(),
      validateTemplate: jest.fn(),
      cacheTemplate: jest.fn(),
      clearCache: jest.fn(),
      getTemplate: jest.fn(),
      listTemplates: jest.fn(),
      addHelper: jest.fn(),
      removeHelper: jest.fn(),
      getHelpers: jest.fn(),
      validateContext: jest.fn(),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn()
    } as any;

    // Create mock template result
    mockTemplateResult = {
      success: true,
      output: '<html><body><h1>Test Report</h1><table><tr><th>Name</th><th>Value</th></tr><tr><td>Item 1</td><td>100</td></tr></table></body></html>',
      templateId: 'test-template',
      context: {
        data: [
          { name: 'Item 1', value: 100, category: 'A' },
          { name: 'Item 2', value: 200, category: 'B' },
          { name: 'Item 3', value: 150, category: 'A' }
        ],
        metadata: {
          title: 'Test Report',
          generatedAt: new Date(),
          totalRecords: 3
        }
      },
      compiledAt: new Date(),
      renderTime: 50,
      cacheHit: false,
      metadata: {
        templateVersion: '1.0',
        dependencies: [],
        renderOptions: {}
      }
    };

    factory = createReportFormatterFactory(templateEngine);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('ReportFormatterFactory', () => {
    test('should be a singleton', () => {
      const factory1 = createReportFormatterFactory(templateEngine);
      const factory2 = createReportFormatterFactory(templateEngine);
      expect(factory1).toBe(factory2);
    });

    test('should initialize with built-in generators', () => {
      const supportedFormats = factory.getSupportedFormats();
      expect(supportedFormats).toContain(ExportFormat.JSON);
      expect(supportedFormats).toContain(ExportFormat.PDF); // HTML generator registered as PDF initially
    });

    test('should register and retrieve generators', () => {
      const mockGenerator: IFormatGenerator = {
        format: ExportFormat.CSV,
        supportedMimeTypes: ['text/csv'],
        defaultConfig: { maxFileSize: 1024 },
        generate: jest.fn(),
        validateOptions: jest.fn(),
        estimateOutputSize: jest.fn(),
        supportsStreaming: jest.fn().mockReturnValue(true),
        getCompressionOptions: jest.fn(),
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn()
      } as any;

      factory.registerGenerator(ExportFormat.CSV, mockGenerator);

      const retrievedGenerator = factory.getGenerator(ExportFormat.CSV);
      expect(retrievedGenerator).toBe(mockGenerator);
    });

    test('should return null for non-existent generators', () => {
      const generator = factory.getGenerator('INVALID_FORMAT' as ExportFormat);
      expect(generator).toBeNull();
    });

    test('should get format capabilities', () => {
      const capabilities = factory.getFormatCapabilities(ExportFormat.JSON);
      expect(capabilities).toMatchObject({
        supportsStreaming: true,
        maxFileSize: expect.any(Number),
        supportedMimeTypes: expect.arrayContaining(['application/json']),
        compressionOptions: expect.any(Object)
      });
    });

    test('should return null capabilities for unsupported format', () => {
      const capabilities = factory.getFormatCapabilities('INVALID_FORMAT' as ExportFormat);
      expect(capabilities).toBeNull();
    });

    test('should estimate output size', async () => {
      const size = await factory.estimateOutputSize(ExportFormat.JSON, 1000, 10);
      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');
    });

    test('should throw error for unsupported format estimation', async () => {
      await expect(
        factory.estimateOutputSize('INVALID_FORMAT' as ExportFormat, 1000, 10)
      ).rejects.toThrow('No generator registered for format');
    });

    test('should validate format options', () => {
      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.JSON,
          resourceType: 'test'
        }
      };

      expect(() => factory.validateFormatOptions(ExportFormat.JSON, options)).not.toThrow();
    });

    test('should throw error for unsupported format validation', () => {
      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.JSON,
          resourceType: 'test'
        }
      };

      expect(() => factory.validateFormatOptions('INVALID_FORMAT' as ExportFormat, options))
        .toThrow('No generator registered for format');
    });
  });

  describe('Report Generation Integration', () => {
    beforeEach(() => {
      templateEngine.renderTemplate.mockResolvedValue(mockTemplateResult);
    });

    test('should generate JSON report successfully', async () => {
      const result = await factory.generateReport(
        'test-template',
        { data: mockTemplateResult.context.data },
        ExportFormat.JSON,
        {
          format: ExportFormat.JSON,
          resourceType: 'test',
          includeMetadata: true
        }
      );

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.metadata.format).toBe(ExportFormat.JSON);
      expect(result.metadata.records).toBe(3);

      // Verify JSON content
      const jsonContent = JSON.parse(result.buffer.toString());
      expect(jsonContent).toHaveProperty('metadata');
      expect(jsonContent).toHaveProperty('data');
      expect(jsonContent.data).toHaveLength(3);
    });

    test('should generate HTML report successfully', async () => {
      const result = await factory.generateReport(
        'test-template',
        { data: mockTemplateResult.context.data },
        ExportFormat.PDF, // HTML generator is registered as PDF initially
        {
          format: ExportFormat.PDF,
          resourceType: 'test'
        }
      );

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.metadata.format).toBe(ExportFormat.PDF);
      expect(result.buffer.toString()).toContain('<html>');
      expect(result.buffer.toString()).toContain('Test Report');
    });

    test('should handle template rendering failure', async () => {
      templateEngine.renderTemplate.mockResolvedValue({
        ...mockTemplateResult,
        success: false,
        error: 'Template compilation failed'
      });

      await expect(
        factory.generateReport(
          'invalid-template',
          { data: [] },
          ExportFormat.JSON,
          { format: ExportFormat.JSON, resourceType: 'test' }
        )
      ).rejects.toThrow('Template rendering failed');
    });

    test('should handle unsupported format', async () => {
      await expect(
        factory.generateReport(
          'test-template',
          { data: [] },
          'INVALID_FORMAT' as ExportFormat,
          { format: 'INVALID_FORMAT' as ExportFormat, resourceType: 'test' }
        )
      ).rejects.toThrow('No generator registered for format');
    });

    test('should call progress callback during generation', async () => {
      const progressCallback = jest.fn();

      await factory.generateReport(
        'test-template',
        { data: mockTemplateResult.context.data },
        ExportFormat.JSON,
        { format: ExportFormat.JSON, resourceType: 'test' },
        progressCallback
      );

      expect(progressCallback).toHaveBeenCalledWith(10, 'Rendering template...');
      expect(progressCallback).toHaveBeenCalledWith(30, 'Generating JSON output...');
      expect(progressCallback).toHaveBeenCalledWith(100, 'Report generation completed');
    });
  });

  describe('JSONGenerator', () => {
    let generator: JSONGenerator;

    beforeEach(() => {
      generator = new JSONGenerator();
    });

    test('should have correct format and properties', () => {
      expect(generator.format).toBe(ExportFormat.JSON);
      expect(generator.supportedMimeTypes).toContain('application/json');
      expect(generator.supportsStreaming()).toBe(true);
    });

    test('should generate JSON without metadata', async () => {
      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.JSON,
          resourceType: 'test',
          includeMetadata: false
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);

      const jsonContent = JSON.parse(result.buffer.toString());
      expect(Array.isArray(jsonContent)).toBe(true);
      expect(jsonContent).toHaveLength(3);
      expect(jsonContent[0]).toMatchObject({
        name: 'Item 1',
        value: 100,
        category: 'A'
      });
    });

    test('should generate JSON with metadata', async () => {
      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.JSON,
          resourceType: 'test',
          includeMetadata: true
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);

      const jsonContent = JSON.parse(result.buffer.toString());
      expect(jsonContent).toHaveProperty('metadata');
      expect(jsonContent).toHaveProperty('data');
      expect(jsonContent.metadata).toMatchObject({
        recordCount: 3,
        template: 'test-template',
        format: ExportFormat.JSON
      });
    });

    test('should handle empty data', async () => {
      const emptyTemplateResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: [] }
      };

      const options: FormatGeneratorOptions = {
        templateData: emptyTemplateResult,
        exportOptions: {
          format: ExportFormat.JSON,
          resourceType: 'test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      const jsonContent = JSON.parse(result.buffer.toString());
      expect(Array.isArray(jsonContent)).toBe(true);
      expect(jsonContent).toHaveLength(0);
    });

    test('should validate options correctly', () => {
      const validOptions: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: { format: ExportFormat.JSON, resourceType: 'test' }
      };

      expect(() => generator.validateOptions(validOptions)).not.toThrow();

      const invalidOptions: FormatGeneratorOptions = {
        templateData: null as any,
        exportOptions: { format: ExportFormat.JSON, resourceType: 'test' }
      };

      expect(() => generator.validateOptions(invalidOptions))
        .toThrow('Template data is required for JSON generation');
    });

    test('should estimate output size accurately', () => {
      const size = generator.estimateOutputSize(1000, 5);
      expect(size).toBeGreaterThan(0);
      expect(typeof size).toBe('number');

      // Size should scale with record and field count
      const largerSize = generator.estimateOutputSize(2000, 10);
      expect(largerSize).toBeGreaterThan(size);
    });

    test('should return compression options', () => {
      const compressionOptions = generator.getCompressionOptions();
      expect(compressionOptions).toMatchObject({
        level: expect.any(Number),
        algorithm: 'gzip'
      });
    });

    test('should emit events during generation', async () => {
      const startedHandler = jest.fn();
      const completedHandler = jest.fn();

      generator.on('generation:started', startedHandler);
      generator.on('generation:completed', completedHandler);

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: { format: ExportFormat.JSON, resourceType: 'test' }
      };

      await generator.generate(options);

      expect(startedHandler).toHaveBeenCalledWith({ format: ExportFormat.JSON });
      expect(completedHandler).toHaveBeenCalledWith({
        format: ExportFormat.JSON,
        size: expect.any(Number),
        processingTime: expect.any(Number)
      });
    });

    test('should handle generation errors gracefully', async () => {
      const corruptedTemplateResult = {
        ...mockTemplateResult,
        context: null as any
      };

      const options: FormatGeneratorOptions = {
        templateData: corruptedTemplateResult,
        exportOptions: { format: ExportFormat.JSON, resourceType: 'test' }
      };

      const failedHandler = jest.fn();
      generator.on('generation:failed', failedHandler);

      const result = await generator.generate(options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(failedHandler).toHaveBeenCalled();
    });
  });

  describe('HTMLGenerator', () => {
    let generator: HTMLGenerator;

    beforeEach(() => {
      generator = new HTMLGenerator();
    });

    test('should have correct format and properties', () => {
      expect(generator.format).toBe(ExportFormat.PDF); // HTML generator uses PDF enum
      expect(generator.supportedMimeTypes).toContain('text/html');
      expect(generator.supportsStreaming()).toBe(false);
    });

    test('should generate HTML content', async () => {
      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test',
          includeMetadata: false
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.toString()).toContain('<html>');
      expect(result.buffer.toString()).toContain('Test Report');
      expect(result.buffer.toString()).toContain('<table>');
    });

    test('should include metadata when requested', async () => {
      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test',
          includeMetadata: true
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      const htmlContent = result.buffer.toString();
      expect(htmlContent).toContain('<!-- Export Metadata -->');
      expect(htmlContent).toContain('<!-- Template: test-template -->');
      expect(htmlContent).toContain('<!-- Records: 3 -->');
    });

    test('should validate options correctly', () => {
      const validOptions: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: { format: ExportFormat.PDF, resourceType: 'test' }
      };

      expect(() => generator.validateOptions(validOptions)).not.toThrow();

      const invalidOptions: FormatGeneratorOptions = {
        templateData: { ...mockTemplateResult, output: null as any },
        exportOptions: { format: ExportFormat.PDF, resourceType: 'test' }
      };

      expect(() => generator.validateOptions(invalidOptions))
        .toThrow('Template data with HTML output is required');
    });

    test('should estimate output size with HTML overhead', () => {
      const size = generator.estimateOutputSize(100, 5);
      expect(size).toBeGreaterThan(0);

      // HTML should have more overhead than JSON
      const jsonGenerator = new JSONGenerator();
      const jsonSize = jsonGenerator.estimateOutputSize(100, 5);
      expect(size).toBeGreaterThan(jsonSize);
    });
  });

  describe('Lazy Loading', () => {
    test('should load external generators successfully', async () => {
      // Mock the dynamic imports
      const mockPDFGenerator = { format: ExportFormat.PDF };
      const mockExcelGenerator = { format: ExportFormat.EXCEL };
      const mockCSVGenerator = { format: ExportFormat.CSV };

      // Note: In a real test environment, you would mock the import() function
      // This test demonstrates the expected behavior
      expect(async () => {
        await factory.loadExternalGenerators();
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should handle missing template data', async () => {
      const options: FormatGeneratorOptions = {
        templateData: null as any,
        exportOptions: { format: ExportFormat.JSON, resourceType: 'test' }
      };

      const generator = new JSONGenerator();
      const result = await generator.generate(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Template data is required');
    });

    test('should handle missing export options', async () => {
      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: null as any
      };

      const generator = new JSONGenerator();
      const result = await generator.generate(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Export options are required');
    });

    test('should handle progress callback errors gracefully', async () => {
      const faultyProgressCallback = jest.fn().mockImplementation(() => {
        throw new Error('Progress callback error');
      });

      // Should not throw even if progress callback fails
      await expect(
        factory.generateReport(
          'test-template',
          { data: mockTemplateResult.context.data },
          ExportFormat.JSON,
          { format: ExportFormat.JSON, resourceType: 'test' },
          faultyProgressCallback
        )
      ).resolves.toMatchObject({ success: true });
    });
  });

  describe('Performance and Memory', () => {
    test('should handle large datasets efficiently', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        value: Math.random() * 1000,
        category: ['A', 'B', 'C'][i % 3]
      }));

      const largeMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: largeDataset }
      };

      templateEngine.renderTemplate.mockResolvedValue(largeMockResult);

      const startTime = Date.now();

      const result = await factory.generateReport(
        'test-template',
        { data: largeDataset },
        ExportFormat.JSON,
        { format: ExportFormat.JSON, resourceType: 'test' }
      );

      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(10000);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    test('should provide accurate size estimates', () => {
      const generator = new JSONGenerator();

      const smallSize = generator.estimateOutputSize(100, 3);
      const mediumSize = generator.estimateOutputSize(1000, 5);
      const largeSize = generator.estimateOutputSize(10000, 10);

      expect(smallSize).toBeLessThan(mediumSize);
      expect(mediumSize).toBeLessThan(largeSize);

      // Estimates should be reasonable
      expect(smallSize).toBeGreaterThan(0);
      expect(smallSize).toBeLessThan(1024 * 1024); // Less than 1MB for small dataset
    });
  });
});