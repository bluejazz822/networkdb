/**
 * Excel Generator Tests
 * Comprehensive tests for Excel generation with ExcelJS
 */

import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { ExcelGenerator } from '../../../src/templates/generators/ExcelGenerator';
import { ExportFormat } from '../../../src/types/export';
import { FormatGeneratorOptions, TemplateRenderResult } from '../../../src/templates/formatters/ReportFormatters';
import ExcelJS from 'exceljs';

// Mock ExcelJS
jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => ({
    creator: '',
    lastModifiedBy: '',
    created: new Date(),
    modified: new Date(),
    title: '',
    subject: '',
    company: '',
    category: '',
    addWorksheet: jest.fn().mockReturnValue({
      addRow: jest.fn().mockReturnValue({
        eachCell: jest.fn()
      }),
      getColumn: jest.fn().mockReturnValue({
        width: 0
      }),
      views: [],
      autoFilter: '',
      addConditionalFormatting: jest.fn(),
      protect: jest.fn()
    }),
    xlsx: {
      writeBuffer: jest.fn().mockResolvedValue(Buffer.from('fake-excel-content'))
    }
  })),
  stream: {
    xlsx: {
      WorkbookWriter: jest.fn().mockImplementation(() => ({
        creator: '',
        lastModifiedBy: '',
        created: new Date(),
        modified: new Date(),
        title: '',
        subject: '',
        company: '',
        category: '',
        addWorksheet: jest.fn().mockReturnValue({
          addRow: jest.fn().mockReturnValue({
            eachCell: jest.fn()
          }),
          getColumn: jest.fn().mockReturnValue({
            width: 0
          }),
          commit: jest.fn().mockResolvedValue(undefined)
        }),
        commit: jest.fn().mockResolvedValue(undefined),
        stream: {
          on: jest.fn(),
          pipe: jest.fn()
        }
      }))
    }
  }
}));

describe('ExcelGenerator', () => {
  let generator: ExcelGenerator;
  let mockTemplateResult: TemplateRenderResult;

  beforeEach(() => {
    generator = new ExcelGenerator();

    mockTemplateResult = {
      success: true,
      output: '<html><body>HTML output not used for Excel</body></html>',
      templateId: 'test-template',
      context: {
        data: [
          { name: 'Product A', price: 99.99, category: 'Electronics', inStock: true, lastUpdated: new Date('2023-01-15') },
          { name: 'Product B', price: 149.50, category: 'Clothing', inStock: false, lastUpdated: new Date('2023-02-20') },
          { name: 'Product C', price: 75.25, category: 'Electronics', inStock: true, lastUpdated: new Date('2023-03-10') },
          { name: 'Product D', price: 200.00, category: 'Home', inStock: true, lastUpdated: new Date('2023-04-05') }
        ]
      },
      compiledAt: new Date(),
      renderTime: 50,
      cacheHit: false,
      metadata: { templateVersion: '1.0', dependencies: [], renderOptions: {} }
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Properties', () => {
    test('should have correct format and properties', () => {
      expect(generator.format).toBe(ExportFormat.EXCEL);
      expect(generator.supportedMimeTypes).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(generator.supportsStreaming()).toBe(true);
    });

    test('should return correct default config', () => {
      expect(generator.defaultConfig.maxFileSize).toBeGreaterThan(0);
      expect(generator.defaultConfig.encoding).toBe('binary');
      expect(generator.defaultConfig.streamingThreshold).toBeGreaterThan(0);
    });

    test('should return compression options', () => {
      const options = generator.getCompressionOptions();
      expect(options).toMatchObject({
        level: expect.any(Number),
        algorithm: 'zip'
      });
    });
  });

  describe('Excel Generation - Standard Mode', () => {
    test('should generate Excel file successfully with default options', async () => {
      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.metadata.format).toBe(ExportFormat.EXCEL);
      expect(result.metadata.mimeType).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      expect(result.metadata.sheets).toBe(1);
      expect(result.metadata.records).toBe(4);
    });

    test('should generate Excel with custom options', async () => {
      const customExcelOptions = {
        workbookName: 'Custom Report',
        sheetName: 'Products',
        freezeHeader: true,
        autoFilter: true,
        columnWidths: {
          name: 25,
          price: 15,
          category: 20
        },
        headerStyle: {
          font: { bold: true, color: { argb: 'FFFFFFFF' } },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0066CC' } }
        },
        metadata: {
          title: 'Product Report',
          author: 'Test User',
          company: 'Test Company'
        }
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test',
          customOptions: {
            excel: customExcelOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    test('should handle conditional formatting options', async () => {
      const conditionalFormattingOptions = {
        conditionalFormatting: [
          {
            range: 'B2:B10',
            type: 'cellIs' as const,
            operator: 'greaterThan' as const,
            value: 100,
            style: {
              fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } }
            }
          },
          {
            range: 'D2:D10',
            type: 'colorScale' as const,
            colorScale: {
              min: 'FFFF0000',
              max: 'FF00FF00'
            }
          }
        ]
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test',
          customOptions: {
            excel: conditionalFormattingOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    test('should handle chart configuration', async () => {
      const chartOptions = {
        includeCharts: true,
        charts: [
          {
            type: 'column' as const,
            title: 'Product Prices',
            position: { row: 10, col: 1, width: 400, height: 300 },
            dataRange: 'B2:B5',
            categoryRange: 'A2:A5',
            xAxisTitle: 'Products',
            yAxisTitle: 'Price ($)'
          }
        ]
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test',
          customOptions: {
            excel: chartOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    test('should handle protection options', async () => {
      const protectionOptions = {
        protection: {
          password: 'test123',
          lockStructure: true,
          lockWindows: false
        }
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test',
          customOptions: {
            excel: protectionOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });
  });

  describe('Excel Generation - Streaming Mode', () => {
    test('should generate Excel with streaming for large datasets', async () => {
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        id: i + 1,
        name: `Product ${i + 1}`,
        price: Math.random() * 1000,
        category: ['Electronics', 'Clothing', 'Home'][i % 3],
        inStock: Math.random() > 0.5,
        lastUpdated: new Date()
      }));

      const largeMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: largeDataset }
      };

      const options: FormatGeneratorOptions = {
        templateData: largeMockResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test'
        },
        streamingEnabled: true
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.metadata.records).toBe(10000);
    });

    test('should handle streaming with custom batch size', async () => {
      const dataset = Array.from({ length: 5000 }, (_, i) => ({
        id: i + 1,
        value: Math.random() * 100
      }));

      const mockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: dataset }
      };

      const options: FormatGeneratorOptions = {
        templateData: mockResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test',
          batchSize: 500
        },
        streamingEnabled: true
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(5000);
    });
  });

  describe('Progress Tracking', () => {
    test('should call progress callback during generation', async () => {
      const progressCallback = jest.fn();

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test'
        },
        progressCallback
      };

      await generator.generate(options);

      expect(progressCallback).toHaveBeenCalledWith(10, 'Creating Excel workbook...');
      expect(progressCallback).toHaveBeenCalledWith(20, 'Processing data sheets...');
      expect(progressCallback).toHaveBeenCalledWith(90, 'Finalizing Excel file...');
      expect(progressCallback).toHaveBeenCalledWith(100, 'Excel generation completed');
    });

    test('should track progress during streaming', async () => {
      const progressCallback = jest.fn();
      const largeDataset = Array.from({ length: 2000 }, (_, i) => ({ id: i }));

      const largeMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: largeDataset }
      };

      const options: FormatGeneratorOptions = {
        templateData: largeMockResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test'
        },
        streamingEnabled: true,
        progressCallback
      };

      await generator.generate(options);

      expect(progressCallback).toHaveBeenCalledWith(10, 'Initializing streaming Excel generation...');
      expect(progressCallback).toHaveBeenCalledWith(20, 'Streaming data to Excel...');
      expect(progressCallback).toHaveBeenCalledWith(90, 'Finalizing streaming Excel file...');
    });
  });

  describe('Data Handling', () => {
    test('should handle empty dataset', async () => {
      const emptyMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: [] }
      };

      const options: FormatGeneratorOptions = {
        templateData: emptyMockResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(0);
    });

    test('should handle various data types correctly', async () => {
      const mixedDataTypes = [
        {
          stringField: 'Test String',
          numberField: 123.45,
          booleanField: true,
          dateField: new Date('2023-05-15'),
          nullField: null,
          undefinedField: undefined,
          emptyStringField: ''
        }
      ];

      const mixedMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: mixedDataTypes }
      };

      const options: FormatGeneratorOptions = {
        templateData: mixedMockResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(1);
    });

    test('should handle nested objects by flattening', async () => {
      const nestedData = [
        {
          id: 1,
          user: { name: 'John', email: 'john@example.com' },
          preferences: { theme: 'dark', notifications: true }
        }
      ];

      const nestedMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: nestedData }
      };

      const options: FormatGeneratorOptions = {
        templateData: nestedMockResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(1);
    });
  });

  describe('Validation', () => {
    test('should validate options correctly', () => {
      const validOptions: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test'
        }
      };

      expect(() => generator.validateOptions(validOptions)).not.toThrow();
    });

    test('should reject missing template data', () => {
      const invalidOptions: FormatGeneratorOptions = {
        templateData: null as any,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test'
        }
      };

      expect(() => generator.validateOptions(invalidOptions))
        .toThrow('Template data is required for Excel generation');
    });

    test('should reject missing export options', () => {
      const invalidOptions: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: null as any
      };

      expect(() => generator.validateOptions(invalidOptions))
        .toThrow('Export options are required');
    });

    test('should validate charts configuration', () => {
      const invalidChartsOptions: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test',
          customOptions: {
            excel: { charts: 'invalid' }
          }
        }
      };

      expect(() => generator.validateOptions(invalidChartsOptions))
        .toThrow('Charts must be an array');
    });

    test('should validate conditional formatting configuration', () => {
      const invalidFormattingOptions: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test',
          customOptions: {
            excel: { conditionalFormatting: 'invalid' }
          }
        }
      };

      expect(() => generator.validateOptions(invalidFormattingOptions))
        .toThrow('Conditional formatting must be an array');
    });
  });

  describe('Size Estimation', () => {
    test('should estimate output size accurately', () => {
      const smallSize = generator.estimateOutputSize(100, 3);
      const mediumSize = generator.estimateOutputSize(1000, 5);
      const largeSize = generator.estimateOutputSize(10000, 10);

      expect(smallSize).toBeGreaterThan(0);
      expect(mediumSize).toBeGreaterThan(smallSize);
      expect(largeSize).toBeGreaterThan(mediumSize);

      // Excel should have significant overhead due to XML structure
      expect(smallSize).toBeGreaterThan(100000); // At least 100KB for basic Excel
    });

    test('should include fixed overhead in estimates', () => {
      const size = generator.estimateOutputSize(0, 0);
      expect(size).toBeGreaterThan(100000); // Fixed overhead for Excel structure
    });
  });

  describe('Error Handling', () => {
    test('should handle generation errors gracefully', async () => {
      // Mock ExcelJS to throw an error
      const ExcelJS = require('exceljs');
      ExcelJS.Workbook.mockImplementationOnce(() => {
        throw new Error('Workbook creation failed');
      });

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Workbook creation failed');
      expect(result.buffer.length).toBe(0);
    });

    test('should emit events during generation', async () => {
      const startedHandler = jest.fn();
      const completedHandler = jest.fn();
      const failedHandler = jest.fn();

      generator.on('generation:started', startedHandler);
      generator.on('generation:completed', completedHandler);
      generator.on('generation:failed', failedHandler);

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test'
        }
      };

      await generator.generate(options);

      expect(startedHandler).toHaveBeenCalledWith({ format: ExportFormat.EXCEL });
      expect(completedHandler).toHaveBeenCalledWith({
        format: ExportFormat.EXCEL,
        size: expect.any(Number),
        sheets: expect.any(Number),
        processingTime: expect.any(Number)
      });
      expect(failedHandler).not.toHaveBeenCalled();
    });

    test('should handle streaming errors', async () => {
      // Mock streaming workbook to fail
      const ExcelJS = require('exceljs');
      const mockStreamWorkbook = {
        addWorksheet: jest.fn().mockReturnValue({
          addRow: jest.fn().mockImplementation(() => {
            throw new Error('Row addition failed');
          }),
          commit: jest.fn()
        }),
        commit: jest.fn(),
        stream: {
          on: jest.fn(),
          pipe: jest.fn()
        }
      };

      ExcelJS.stream.xlsx.WorkbookWriter.mockReturnValueOnce(mockStreamWorkbook);

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test'
        },
        streamingEnabled: true
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Performance', () => {
    test('should complete generation within reasonable time', async () => {
      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test'
        }
      };

      const startTime = Date.now();
      const result = await generator.generate(options);
      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });

    test('should handle large datasets efficiently with streaming', async () => {
      const largeDataset = Array.from({ length: 50000 }, (_, i) => ({
        id: i + 1,
        name: `Item ${i + 1}`,
        value: Math.random() * 1000,
        category: ['A', 'B', 'C', 'D', 'E'][i % 5]
      }));

      const largeMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: largeDataset }
      };

      const options: FormatGeneratorOptions = {
        templateData: largeMockResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test'
        },
        streamingEnabled: true
      };

      const startTime = Date.now();
      const result = await generator.generate(options);
      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(50000);
      expect(processingTime).toBeLessThan(30000); // Should complete within 30 seconds
    });
  });

  describe('Formatting and Styling', () => {
    test('should apply custom header and data styles', async () => {
      const customStyles = {
        headerStyle: {
          font: { bold: true, size: 14, color: { argb: 'FF000000' } },
          fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCCCCCC' } }
        },
        dataStyle: {
          font: { size: 11 },
          alignment: { horizontal: 'left' }
        }
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test',
          customOptions: {
            excel: customStyles
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    test('should handle column width customization', async () => {
      const columnOptions = {
        columnWidths: {
          name: 30,
          price: 12,
          category: 20,
          inStock: 10
        }
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.EXCEL,
          resourceType: 'test',
          customOptions: {
            excel: columnOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });
  });
});