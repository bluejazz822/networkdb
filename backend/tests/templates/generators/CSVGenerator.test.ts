/**
 * CSV Generator Tests
 * Comprehensive tests for CSV generation with streaming support
 */

import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { CSVGenerator } from '../../../src/templates/generators/CSVGenerator';
import { ExportFormat } from '../../../src/types/export';
import { FormatGeneratorOptions, TemplateRenderResult } from '../../../src/templates/formatters/ReportFormatters';

// Mock csv-stringify
jest.mock('csv-stringify', () => ({
  stringify: jest.fn().mockImplementation((options) => {
    const mockStringifier = {
      write: jest.fn(),
      end: jest.fn(),
      read: jest.fn().mockReturnValue(null),
      on: jest.fn().mockImplementation((event, callback) => {
        if (event === 'end') {
          setTimeout(callback, 0);
        }
        return mockStringifier;
      })
    };

    // Simulate writing some CSV data
    setTimeout(() => {
      const readCallback = mockStringifier.on.mock.calls.find(call => call[0] === 'readable')?.[1];
      if (readCallback) {
        mockStringifier.read.mockReturnValueOnce('name,price,category,inStock\n');
        mockStringifier.read.mockReturnValueOnce('Product A,99.99,Electronics,true\n');
        mockStringifier.read.mockReturnValueOnce(null);
        readCallback();
      }
    }, 0);

    return mockStringifier;
  })
}));

describe('CSVGenerator', () => {
  let generator: CSVGenerator;
  let mockTemplateResult: TemplateRenderResult;

  beforeEach(() => {
    generator = new CSVGenerator();

    mockTemplateResult = {
      success: true,
      output: '<html><body>HTML output not used for CSV</body></html>',
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
      expect(generator.format).toBe(ExportFormat.CSV);
      expect(generator.supportedMimeTypes).toContain('text/csv');
      expect(generator.supportedMimeTypes).toContain('application/csv');
      expect(generator.supportsStreaming()).toBe(true);
    });

    test('should return correct default config', () => {
      expect(generator.defaultConfig.maxFileSize).toBeGreaterThan(0);
      expect(generator.defaultConfig.encoding).toBe('utf8');
      expect(generator.defaultConfig.streamingThreshold).toBeGreaterThan(0);
    });

    test('should return compression options', () => {
      const options = generator.getCompressionOptions();
      expect(options).toMatchObject({
        level: expect.any(Number),
        algorithm: 'gzip'
      });
    });
  });

  describe('CSV Generation - Standard Mode', () => {
    test('should generate CSV file successfully with default options', async () => {
      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.metadata.format).toBe(ExportFormat.CSV);
      expect(result.metadata.mimeType).toBe('text/csv');
      expect(result.metadata.encoding).toBe('utf8');
      expect(result.metadata.records).toBe(4);
    });

    test('should generate CSV with custom delimiters', async () => {
      const customCSVOptions = {
        delimiter: ';',
        quote: "'",
        escape: '\\',
        lineEnding: '\r\n' as const
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test',
          customOptions: {
            csv: customCSVOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    test('should generate CSV with custom formatting options', async () => {
      const formattingOptions = {
        formatting: {
          dateFormat: 'MM/DD/YYYY',
          numberFormat: {
            decimalSeparator: '.',
            thousandsSeparator: ',',
            decimalPlaces: 2
          },
          booleanFormat: {
            trueValue: 'YES',
            falseValue: 'NO'
          },
          nullValue: 'N/A',
          emptyValue: '-'
        }
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test',
          customOptions: {
            csv: formattingOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    test('should generate CSV with BOM for UTF-8', async () => {
      const bomOptions = {
        bom: true,
        encoding: 'utf8' as BufferEncoding
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test',
          customOptions: {
            csv: bomOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
      // BOM should be added to the beginning
      expect(result.buffer.toString('utf8').charCodeAt(0)).toBe(0xFEFF);
    });

    test('should handle custom column definitions', async () => {
      const columnOptions = {
        columns: [
          {
            key: 'name',
            header: 'Product Name',
            formatter: (value: any) => value.toUpperCase(),
            required: true
          },
          {
            key: 'price',
            header: 'Price ($)',
            dataType: 'currency' as const,
            formatter: (value: any) => `$${value.toFixed(2)}`
          },
          {
            key: 'inStock',
            header: 'Available',
            dataType: 'boolean' as const
          }
        ]
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test',
          customOptions: {
            csv: columnOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });
  });

  describe('CSV Generation - Streaming Mode', () => {
    test('should generate CSV with streaming for large datasets', async () => {
      const largeDataset = Array.from({ length: 15000 }, (_, i) => ({
        id: i + 1,
        name: `Product ${i + 1}`,
        price: Math.random() * 1000,
        category: ['Electronics', 'Clothing', 'Home'][i % 3],
        inStock: Math.random() > 0.5
      }));

      const largeMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: largeDataset }
      };

      const options: FormatGeneratorOptions = {
        templateData: largeMockResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test'
        },
        streamingEnabled: true
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.metadata.records).toBe(15000);
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
          format: ExportFormat.CSV,
          resourceType: 'test',
          batchSize: 1000
        },
        streamingEnabled: true
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(5000);
    });
  });

  describe('Data Type Handling', () => {
    test('should handle various data types correctly', async () => {
      const mixedDataTypes = [
        {
          stringField: 'Test String',
          numberField: 123.456,
          booleanField: true,
          dateField: new Date('2023-05-15'),
          nullField: null,
          undefinedField: undefined,
          emptyStringField: '',
          currencyField: 99.99
        }
      ];

      const mixedMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: mixedDataTypes }
      };

      const columnDefinitions = {
        columns: [
          { key: 'stringField', dataType: 'string' as const },
          { key: 'numberField', dataType: 'number' as const },
          { key: 'booleanField', dataType: 'boolean' as const },
          { key: 'dateField', dataType: 'date' as const },
          { key: 'currencyField', dataType: 'currency' as const },
          { key: 'nullField', defaultValue: 'DEFAULT' },
          { key: 'undefinedField' },
          { key: 'emptyStringField' }
        ]
      };

      const options: FormatGeneratorOptions = {
        templateData: mixedMockResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test',
          customOptions: {
            csv: columnDefinitions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(1);
    });

    test('should format dates correctly', async () => {
      const dateData = [
        { eventDate: new Date('2023-01-15T10:30:00Z') },
        { eventDate: new Date('2023-12-31T23:59:59Z') }
      ];

      const dateMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: dateData }
      };

      const dateFormattingOptions = {
        formatting: {
          dateFormat: 'DD/MM/YYYY',
          timeFormat: 'HH:mm',
          dateTimeFormat: 'DD/MM/YYYY HH:mm'
        },
        columns: [
          { key: 'eventDate', dataType: 'date' as const }
        ]
      };

      const options: FormatGeneratorOptions = {
        templateData: dateMockResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test',
          customOptions: {
            csv: dateFormattingOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(2);
    });

    test('should format numbers with custom separators', async () => {
      const numberData = [
        { value: 1234567.89 },
        { value: 0.12345 },
        { value: 1000000 }
      ];

      const numberMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: numberData }
      };

      const numberFormattingOptions = {
        formatting: {
          numberFormat: {
            decimalSeparator: ',',
            thousandsSeparator: '.',
            decimalPlaces: 3
          }
        },
        columns: [
          { key: 'value', dataType: 'number' as const }
        ]
      };

      const options: FormatGeneratorOptions = {
        templateData: numberMockResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test',
          customOptions: {
            csv: numberFormattingOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(3);
    });
  });

  describe('Filtering and Validation', () => {
    test('should apply text filters correctly', async () => {
      const textData = [
        { name: '  Product A  \n', description: 'Line 1\nLine 2\nLine 3' },
        { name: '\tProduct B\r\n', description: 'Single line' }
      ];

      const textMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: textData }
      };

      const filterOptions = {
        filters: {
          trimWhitespace: true,
          removeLineBreaks: true,
          skipEmptyRows: true
        }
      };

      const options: FormatGeneratorOptions = {
        templateData: textMockResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test',
          customOptions: {
            csv: filterOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(2);
    });

    test('should validate field lengths', async () => {
      const longTextData = [
        { name: 'A'.repeat(50000) }, // Very long field
        { name: 'Normal name' }
      ];

      const longTextMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: longTextData }
      };

      const validationOptions = {
        validation: {
          maxFieldLength: 1000,
          maxRowLength: 10
        }
      };

      const options: FormatGeneratorOptions = {
        templateData: longTextMockResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test',
          customOptions: {
            csv: validationOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(2);
    });

    test('should validate headers for duplicates', async () => {
      const duplicateHeaderOptions = {
        columns: [
          { key: 'field1', header: 'Name' },
          { key: 'field2', header: 'Name' } // Duplicate header
        ],
        validation: {
          validateHeaders: true
        }
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test',
          customOptions: {
            csv: duplicateHeaderOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Duplicate column headers detected');
    });
  });

  describe('Progress Tracking', () => {
    test('should call progress callback during generation', async () => {
      const progressCallback = jest.fn();

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test'
        },
        progressCallback
      };

      await generator.generate(options);

      expect(progressCallback).toHaveBeenCalledWith(10, 'Initializing CSV generation...');
      expect(progressCallback).toHaveBeenCalledWith(20, 'Preparing data transformation...');
      expect(progressCallback).toHaveBeenCalledWith(30, 'Writing data...');
      expect(progressCallback).toHaveBeenCalledWith(100, 'CSV generation completed');
    });

    test('should track progress during streaming', async () => {
      const progressCallback = jest.fn();
      const largeDataset = Array.from({ length: 5000 }, (_, i) => ({ id: i }));

      const largeMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: largeDataset }
      };

      const options: FormatGeneratorOptions = {
        templateData: largeMockResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test'
        },
        streamingEnabled: true,
        progressCallback
      };

      await generator.generate(options);

      expect(progressCallback).toHaveBeenCalledWith(10, 'Initializing streaming CSV generation...');
      expect(progressCallback).toHaveBeenCalledWith(20, 'Starting data stream...');
      expect(progressCallback).toHaveBeenCalledWith(100, 'Streaming CSV generation completed');
    });
  });

  describe('Validation', () => {
    test('should validate options correctly', () => {
      const validOptions: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test'
        }
      };

      expect(() => generator.validateOptions(validOptions)).not.toThrow();
    });

    test('should reject missing template data', () => {
      const invalidOptions: FormatGeneratorOptions = {
        templateData: null as any,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test'
        }
      };

      expect(() => generator.validateOptions(invalidOptions))
        .toThrow('Template data is required for CSV generation');
    });

    test('should reject missing export options', () => {
      const invalidOptions: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: null as any
      };

      expect(() => generator.validateOptions(invalidOptions))
        .toThrow('Export options are required');
    });

    test('should validate CSV-specific options', () => {
      const invalidDelimiterOptions: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test',
          customOptions: {
            csv: { delimiter: 'TOO_LONG' }
          }
        }
      };

      expect(() => generator.validateOptions(invalidDelimiterOptions))
        .toThrow('CSV delimiter must be a single character');

      const invalidQuoteOptions: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test',
          customOptions: {
            csv: { quote: 'TOO_LONG' }
          }
        }
      };

      expect(() => generator.validateOptions(invalidQuoteOptions))
        .toThrow('CSV quote character must be a single character');

      const invalidEncodingOptions: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test',
          customOptions: {
            csv: { encoding: 'invalid-encoding' as BufferEncoding }
          }
        }
      };

      expect(() => generator.validateOptions(invalidEncodingOptions))
        .toThrow('Invalid encoding: invalid-encoding');
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

      // CSV should be the most compact format
      expect(smallSize).toBeLessThan(50000); // Should be relatively small
    });

    test('should scale size estimates appropriately', () => {
      const size1 = generator.estimateOutputSize(1000, 5);
      const size2 = generator.estimateOutputSize(2000, 5);
      const size3 = generator.estimateOutputSize(1000, 10);

      // Double records should roughly double size
      expect(size2).toBeGreaterThan(size1 * 1.5);
      expect(size2).toBeLessThan(size1 * 2.5);

      // Double fields should roughly double size
      expect(size3).toBeGreaterThan(size1 * 1.5);
      expect(size3).toBeLessThan(size1 * 2.5);
    });
  });

  describe('Error Handling', () => {
    test('should handle generation errors gracefully', async () => {
      const { stringify } = require('csv-stringify');
      stringify.mockImplementationOnce(() => {
        const mockStringifier = {
          write: jest.fn(),
          end: jest.fn(),
          read: jest.fn(),
          on: jest.fn().mockImplementation((event, callback) => {
            if (event === 'error') {
              setTimeout(() => callback(new Error('CSV generation failed')), 0);
            }
            return mockStringifier;
          })
        };
        return mockStringifier;
      });

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('CSV generation failed');
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
          format: ExportFormat.CSV,
          resourceType: 'test'
        }
      };

      await generator.generate(options);

      expect(startedHandler).toHaveBeenCalledWith({ format: ExportFormat.CSV });
      expect(completedHandler).toHaveBeenCalledWith({
        format: ExportFormat.CSV,
        size: expect.any(Number),
        records: expect.any(Number),
        processingTime: expect.any(Number)
      });
      expect(failedHandler).not.toHaveBeenCalled();
    });

    test('should handle custom formatter errors', async () => {
      const faultyFormatterOptions = {
        columns: [
          {
            key: 'name',
            formatter: () => {
              throw new Error('Formatter error');
            }
          }
        ]
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test',
          customOptions: {
            csv: faultyFormatterOptions
          }
        }
      };

      // Should not fail completely, but log warnings
      const result = await generator.generate(options);
      expect(result.success).toBe(true);
    });
  });

  describe('Performance', () => {
    test('should complete generation within reasonable time', async () => {
      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test'
        }
      };

      const startTime = Date.now();
      const result = await generator.generate(options);
      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });

    test('should handle large datasets efficiently with streaming', async () => {
      const largeDataset = Array.from({ length: 100000 }, (_, i) => ({
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
          format: ExportFormat.CSV,
          resourceType: 'test'
        },
        streamingEnabled: true
      };

      const startTime = Date.now();
      const result = await generator.generate(options);
      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(100000);
      expect(processingTime).toBeLessThan(15000); // Should complete within 15 seconds
    });
  });

  describe('Edge Cases', () => {
    test('should handle empty dataset', async () => {
      const emptyMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: [] }
      };

      const options: FormatGeneratorOptions = {
        templateData: emptyMockResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(0);
    });

    test('should handle records with missing fields', async () => {
      const inconsistentData = [
        { name: 'Product A', price: 99.99, category: 'Electronics' },
        { name: 'Product B', price: 149.50 }, // Missing category
        { name: 'Product C', category: 'Home' }, // Missing price
        { price: 75.25, category: 'Electronics' } // Missing name
      ];

      const inconsistentMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: inconsistentData }
      };

      const options: FormatGeneratorOptions = {
        templateData: inconsistentMockResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(4);
    });

    test('should handle special characters in data', async () => {
      const specialCharData = [
        { name: 'Product "A"', description: 'Contains, commas and "quotes"' },
        { name: 'Product\nB', description: 'Contains\nnewlines' },
        { name: 'Product\tC', description: 'Contains\ttabs' }
      ];

      const specialCharMockResult = {
        ...mockTemplateResult,
        context: { ...mockTemplateResult.context, data: specialCharData }
      };

      const options: FormatGeneratorOptions = {
        templateData: specialCharMockResult,
        exportOptions: {
          format: ExportFormat.CSV,
          resourceType: 'test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.metadata.records).toBe(3);
    });
  });
});