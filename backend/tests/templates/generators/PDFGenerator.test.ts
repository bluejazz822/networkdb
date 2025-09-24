/**
 * PDF Generator Tests
 * Comprehensive tests for PDF generation with Puppeteer
 */

import { describe, beforeEach, afterEach, test, expect, jest } from '@jest/globals';
import { PDFGenerator } from '../../../src/templates/generators/PDFGenerator';
import { ExportFormat } from '../../../src/types/export';
import { FormatGeneratorOptions, TemplateRenderResult } from '../../../src/templates/formatters/ReportFormatters';

// Mock Puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setViewport: jest.fn().mockResolvedValue(undefined),
      setContent: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      waitForTimeout: jest.fn().mockResolvedValue(undefined),
      pdf: jest.fn().mockResolvedValue(Buffer.from('fake-pdf-content')),
      close: jest.fn().mockResolvedValue(undefined)
    }),
    close: jest.fn().mockResolvedValue(undefined),
    connected: true
  })
}));

describe('PDFGenerator', () => {
  let generator: PDFGenerator;
  let mockTemplateResult: TemplateRenderResult;

  beforeEach(() => {
    generator = new PDFGenerator();

    mockTemplateResult = {
      success: true,
      output: `
        <html>
          <head><title>Test Report</title></head>
          <body>
            <h1>Test Report</h1>
            <table>
              <thead>
                <tr><th>Name</th><th>Value</th><th>Category</th></tr>
              </thead>
              <tbody>
                <tr><td>Item 1</td><td>100</td><td>A</td></tr>
                <tr><td>Item 2</td><td>200</td><td>B</td></tr>
                <tr><td>Item 3</td><td>150</td><td>A</td></tr>
              </tbody>
            </table>
          </body>
        </html>
      `,
      templateId: 'test-template',
      context: {
        data: [
          { name: 'Item 1', value: 100, category: 'A' },
          { name: 'Item 2', value: 200, category: 'B' },
          { name: 'Item 3', value: 150, category: 'A' }
        ]
      },
      compiledAt: new Date(),
      renderTime: 50,
      cacheHit: false,
      metadata: { templateVersion: '1.0', dependencies: [], renderOptions: {} }
    };
  });

  afterEach(async () => {
    await generator.shutdown();
    jest.clearAllMocks();
  });

  describe('Basic Properties', () => {
    test('should have correct format and properties', () => {
      expect(generator.format).toBe(ExportFormat.PDF);
      expect(generator.supportedMimeTypes).toContain('application/pdf');
      expect(generator.supportsStreaming()).toBe(false);
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
        algorithm: 'deflate'
      });
    });
  });

  describe('PDF Generation', () => {
    test('should generate PDF successfully with default options', async () => {
      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
      expect(result.metadata.format).toBe(ExportFormat.PDF);
      expect(result.metadata.mimeType).toBe('application/pdf');
      expect(result.metadata.pages).toBeGreaterThan(0);
      expect(result.metadata.records).toBe(3);
    });

    test('should generate PDF with custom options', async () => {
      const customPdfOptions = {
        format: 'Letter',
        orientation: 'landscape',
        margin: {
          top: '2cm',
          right: '2cm',
          bottom: '2cm',
          left: '2cm'
        },
        printBackground: true,
        scale: 0.8
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test',
          customOptions: {
            pdf: customPdfOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    test('should handle custom CSS styling', async () => {
      const customCSS = `
        body { font-family: Arial, sans-serif; }
        .header { color: #2c3e50; background: #ecf0f1; }
        table { border-collapse: collapse; width: 100%; }
      `;

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test',
          customOptions: {
            css: customCSS
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    test('should handle watermark options', async () => {
      const watermarkOptions = {
        watermark: {
          text: 'CONFIDENTIAL',
          opacity: 0.3,
          position: 'center'
        }
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test',
          customOptions: {
            pdf: watermarkOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    test('should handle header and footer templates', async () => {
      const headerFooterOptions = {
        displayHeaderFooter: true,
        headerTemplate: '<div style="font-size: 10px; text-align: center;">Report Header</div>',
        footerTemplate: '<div style="font-size: 10px; text-align: center;">Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>'
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test',
          customOptions: {
            pdf: headerFooterOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });

    test('should handle page break options', async () => {
      const pageBreakOptions = {
        pageBreaks: {
          avoid: ['.chart-container', '.table-row'],
          before: ['.section-break'],
          after: ['.page-end']
        }
      };

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test',
          customOptions: {
            pdf: pageBreakOptions
          }
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(0);
    });
  });

  describe('Progress Tracking', () => {
    test('should call progress callback during generation', async () => {
      const progressCallback = jest.fn();

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test'
        },
        progressCallback
      };

      await generator.generate(options);

      expect(progressCallback).toHaveBeenCalledWith(20, 'Initializing PDF renderer...');
      expect(progressCallback).toHaveBeenCalledWith(30, 'Setting up PDF page...');
      expect(progressCallback).toHaveBeenCalledWith(50, 'Loading content into browser...');
      expect(progressCallback).toHaveBeenCalledWith(80, 'Generating PDF...');
      expect(progressCallback).toHaveBeenCalledWith(100, 'PDF generation completed');
    });

    test('should handle progress callback errors gracefully', async () => {
      const faultyProgressCallback = jest.fn().mockImplementation(() => {
        throw new Error('Progress callback error');
      });

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test'
        },
        progressCallback: faultyProgressCallback
      };

      // Should not throw even if progress callback fails
      const result = await generator.generate(options);
      expect(result.success).toBe(true);
    });
  });

  describe('Validation', () => {
    test('should validate options correctly', () => {
      const validOptions: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test'
        }
      };

      expect(() => generator.validateOptions(validOptions)).not.toThrow();
    });

    test('should reject missing template data', () => {
      const invalidOptions: FormatGeneratorOptions = {
        templateData: null as any,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test'
        }
      };

      expect(() => generator.validateOptions(invalidOptions))
        .toThrow('Template data with HTML output is required');
    });

    test('should reject missing HTML output', () => {
      const invalidOptions: FormatGeneratorOptions = {
        templateData: { ...mockTemplateResult, output: null as any },
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test'
        }
      };

      expect(() => generator.validateOptions(invalidOptions))
        .toThrow('Template data with HTML output is required');
    });

    test('should reject missing export options', () => {
      const invalidOptions: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: null as any
      };

      expect(() => generator.validateOptions(invalidOptions))
        .toThrow('Export options are required');
    });

    test('should reject invalid PDF format', () => {
      const invalidOptions: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test',
          customOptions: {
            pdf: { format: 'INVALID_FORMAT' }
          }
        }
      };

      expect(() => generator.validateOptions(invalidOptions))
        .toThrow('Invalid PDF format: INVALID_FORMAT');
    });

    test('should reject invalid PDF orientation', () => {
      const invalidOptions: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test',
          customOptions: {
            pdf: { orientation: 'invalid' }
          }
        }
      };

      expect(() => generator.validateOptions(invalidOptions))
        .toThrow('Invalid PDF orientation: invalid');
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

      // PDF should have significant overhead
      expect(smallSize).toBeGreaterThan(50000); // At least 50KB for basic PDF
    });

    test('should include fixed overhead in estimates', () => {
      const size = generator.estimateOutputSize(0, 0);
      expect(size).toBeGreaterThan(50000); // Fixed overhead for PDF structure
    });
  });

  describe('Error Handling', () => {
    test('should handle generation errors gracefully', async () => {
      // Mock Puppeteer to throw an error
      const puppeteer = require('puppeteer');
      puppeteer.launch.mockRejectedValueOnce(new Error('Browser launch failed'));

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Browser launch failed');
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
          format: ExportFormat.PDF,
          resourceType: 'test'
        }
      };

      await generator.generate(options);

      expect(startedHandler).toHaveBeenCalledWith({ format: ExportFormat.PDF });
      expect(completedHandler).toHaveBeenCalledWith({
        format: ExportFormat.PDF,
        size: expect.any(Number),
        pages: expect.any(Number),
        processingTime: expect.any(Number)
      });
      expect(failedHandler).not.toHaveBeenCalled();
    });

    test('should handle browser page errors', async () => {
      const puppeteer = require('puppeteer');
      const mockBrowser = {
        newPage: jest.fn().mockRejectedValue(new Error('Page creation failed')),
        close: jest.fn().mockResolvedValue(undefined),
        connected: true
      };
      puppeteer.launch.mockResolvedValueOnce(mockBrowser);

      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Page creation failed');
    });
  });

  describe('Browser Management', () => {
    test('should shutdown browser correctly', async () => {
      const puppeteer = require('puppeteer');
      const mockBrowser = {
        newPage: jest.fn().mockResolvedValue({
          setViewport: jest.fn(),
          setContent: jest.fn(),
          pdf: jest.fn().mockResolvedValue(Buffer.from('test')),
          close: jest.fn()
        }),
        close: jest.fn().mockResolvedValue(undefined),
        connected: true
      };
      puppeteer.launch.mockResolvedValueOnce(mockBrowser);

      // Generate a PDF to initialize browser
      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test'
        }
      };

      await generator.generate(options);

      // Shutdown should close the browser
      await generator.shutdown();

      expect(mockBrowser.close).toHaveBeenCalled();
    });

    test('should handle multiple generations with same browser instance', async () => {
      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test'
        }
      };

      // Generate multiple PDFs
      const result1 = await generator.generate(options);
      const result2 = await generator.generate(options);
      const result3 = await generator.generate(options);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      // Browser should be launched only once
      const puppeteer = require('puppeteer');
      expect(puppeteer.launch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Performance', () => {
    test('should complete generation within reasonable time', async () => {
      const options: FormatGeneratorOptions = {
        templateData: mockTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test'
        }
      };

      const startTime = Date.now();
      const result = await generator.generate(options);
      const processingTime = Date.now() - startTime;

      expect(result.success).toBe(true);
      expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(result.metadata.processingTime).toBeGreaterThan(0);
    });

    test('should handle large HTML content efficiently', async () => {
      const largeHTML = `
        <html>
          <body>
            <h1>Large Report</h1>
            ${Array.from({ length: 1000 }, (_, i) => `
              <div class="section">
                <h2>Section ${i + 1}</h2>
                <p>This is a large section with lots of content to test PDF generation performance.</p>
                <table>
                  <tr><th>Column 1</th><th>Column 2</th><th>Column 3</th></tr>
                  ${Array.from({ length: 10 }, (_, j) => `
                    <tr><td>Data ${i}-${j}-1</td><td>Data ${i}-${j}-2</td><td>Data ${i}-${j}-3</td></tr>
                  `).join('')}
                </table>
              </div>
            `).join('')}
          </body>
        </html>
      `;

      const largeTemplateResult = {
        ...mockTemplateResult,
        output: largeHTML
      };

      const options: FormatGeneratorOptions = {
        templateData: largeTemplateResult,
        exportOptions: {
          format: ExportFormat.PDF,
          resourceType: 'test'
        }
      };

      const result = await generator.generate(options);

      expect(result.success).toBe(true);
      expect(result.buffer.length).toBeGreaterThan(100000); // Should be a substantial PDF
    });
  });
});