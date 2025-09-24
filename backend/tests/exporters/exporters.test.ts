/**
 * Tests for Export Services (Format-Specific Exporters)
 * Comprehensive testing of PDF, Excel, and CSV export functionality
 */

import { PdfExporter } from '../../src/exporters/PdfExporter';
import { ExcelExporter } from '../../src/exporters/ExcelExporter';
import { CsvExporter } from '../../src/exporters/CsvExporter';
import { ExportFormat } from '../../src/types/export';

describe('Export Services - Format-Specific Exporters', () => {
  // Sample test data
  const sampleData = [
    {
      id: 1,
      name: 'VPC-001',
      region: 'us-east-1',
      cidr: '10.0.0.0/16',
      status: 'active',
      createdAt: new Date('2023-01-15'),
      isDefault: true
    },
    {
      id: 2,
      name: 'VPC-002',
      region: 'us-west-2',
      cidr: '10.1.0.0/16',
      status: 'inactive',
      createdAt: new Date('2023-02-20'),
      isDefault: false
    },
    {
      id: 3,
      name: 'VPC-003',
      region: 'eu-west-1',
      cidr: '10.2.0.0/16',
      status: 'pending',
      createdAt: new Date('2023-03-10'),
      isDefault: false
    }
  ];

  describe('CsvExporter', () => {
    let csvExporter: CsvExporter;

    beforeEach(() => {
      csvExporter = new CsvExporter();
    });

    test('should export data to CSV format with default options', async () => {
      const options = {
        format: ExportFormat.CSV,
        resourceType: 'vpcs'
      };

      const result = await csvExporter.exportToCsv(sampleData, options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      const csvContent = result.toString();
      // Check for headers (with or without quotes)
      expect(csvContent).toMatch(/Id.*Name.*Region.*Cidr.*Status.*Created At.*Is Default/);
      expect(csvContent).toContain('VPC-001');
      expect(csvContent).toContain('10.0.0.0/16');
      expect(csvContent).toContain('active');
    });

    test('should export with custom delimiter', async () => {
      const options = {
        format: ExportFormat.CSV,
        resourceType: 'vpcs',
        delimiter: ';'
      };

      const result = await csvExporter.exportToCsv(sampleData, options);
      const csvContent = result.toString();

      expect(csvContent).toContain(';');
      // Check that headers are delimited with semicolon
      expect(csvContent.split('\n')[0]).toMatch(/.*;.*;.*/);
      // Check that data contains the semicolon delimiter
      expect(csvContent).toContain('us-east-1');
    });

    test('should handle custom field selection', async () => {
      const options = {
        format: ExportFormat.CSV,
        resourceType: 'vpcs',
        fields: ['name', 'region', 'status']
      };

      const result = await csvExporter.exportToCsv(sampleData, options);
      const csvContent = result.toString();

      expect(csvContent).toMatch(/Name.*Region.*Status/);
      expect(csvContent).not.toContain('Id');
      expect(csvContent).not.toContain('Cidr');
    });

    test('should handle boolean formatting', async () => {
      const options = {
        format: ExportFormat.CSV,
        resourceType: 'vpcs',
        booleanFormat: {
          trueValue: 'YES',
          falseValue: 'NO'
        }
      };

      const result = await csvExporter.exportToCsv(sampleData, options);
      const csvContent = result.toString();

      expect(csvContent).toContain('YES');
      expect(csvContent).toContain('NO');
      expect(csvContent).not.toContain('true');
      expect(csvContent).not.toContain('false');
    });

    test('should handle empty data gracefully', async () => {
      const options = {
        format: ExportFormat.CSV,
        resourceType: 'vpcs'
      };

      await expect(csvExporter.exportToCsv([], options)).rejects.toThrow('No data provided for CSV export');
    });

    test('should validate export options', () => {
      const invalidOptions = {
        format: ExportFormat.CSV,
        resourceType: 'vpcs',
        delimiter: 'invalid' // Should be single character
      };

      expect(() => csvExporter.validateOptions(invalidOptions)).toThrow('CSV delimiter must be a single character');
    });

    test('should create template CSV', async () => {
      const fields = ['name', 'region', 'status'];
      const options = {
        format: ExportFormat.CSV,
        resourceType: 'vpcs'
      };

      const result = await csvExporter.createTemplate(fields, options);
      const csvContent = result.toString();

      expect(csvContent).toMatch(/Name.*Region.*Status/);
      expect(csvContent.split('\n').length).toBe(2); // Header + empty line
    });
  });

  describe('ExcelExporter', () => {
    let excelExporter: ExcelExporter;

    beforeEach(() => {
      excelExporter = new ExcelExporter();
    });

    test('should export data to Excel format', async () => {
      const options = {
        format: ExportFormat.EXCEL,
        resourceType: 'vpcs',
        sheetName: 'VPC Data'
      };

      const result = await excelExporter.exportToExcel(sampleData, options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      // Check Excel file signature (ZIP format)
      expect(result.slice(0, 2)).toEqual(Buffer.from([0x50, 0x4B])); // PK zip header
    });

    test('should export with summary sheet', async () => {
      const options = {
        format: ExportFormat.EXCEL,
        resourceType: 'vpcs',
        summarySheet: true
      };

      const result = await excelExporter.exportToExcel(sampleData, options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle custom field selection', async () => {
      const options = {
        format: ExportFormat.EXCEL,
        resourceType: 'vpcs',
        fields: ['name', 'region', 'status']
      };

      const result = await excelExporter.exportToExcel(sampleData, options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test('should apply auto filter', async () => {
      const options = {
        format: ExportFormat.EXCEL,
        resourceType: 'vpcs',
        includeAutoFilter: true
      };

      const result = await excelExporter.exportToExcel(sampleData, options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });

    test('should handle empty data gracefully', async () => {
      const options = {
        format: ExportFormat.EXCEL,
        resourceType: 'vpcs'
      };

      await expect(excelExporter.exportToExcel([], options)).rejects.toThrow('No data provided for Excel export');
    });

    test('should validate chart configuration', () => {
      const options = {
        format: ExportFormat.EXCEL,
        resourceType: 'vpcs',
        charts: [
          {
            type: 'column' as const,
            title: '', // Missing title
            dataRange: 'A1:B10',
            position: { row: 1, column: 5 },
            size: { width: 400, height: 300 }
          }
        ]
      };

      expect(() => excelExporter.validateOptions(options)).toThrow('Chart 1 is missing required type or title');
    });

    test('should create Excel template', async () => {
      const options = {
        format: ExportFormat.EXCEL,
        resourceType: 'vpcs',
        fields: ['name', 'region', 'status']
      };

      const result = await excelExporter.createTemplate('VPC Template', options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('PdfExporter', () => {
    let pdfExporter: PdfExporter;

    beforeEach(() => {
      pdfExporter = new PdfExporter();
    });

    afterEach(async () => {
      await pdfExporter.close();
    });

    test('should export data to PDF format', async () => {
      const options = {
        format: ExportFormat.PDF,
        resourceType: 'vpcs',
        template: 'default'
      };

      const result = await pdfExporter.exportToPdf(sampleData, options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      // Check PDF file signature
      expect(result.slice(0, 4)).toEqual(Buffer.from('%PDF'));
    }, 30000); // Increase timeout for PDF generation

    test('should handle landscape orientation', async () => {
      const options = {
        format: ExportFormat.PDF,
        resourceType: 'vpcs',
        orientation: 'landscape' as const
      };

      const result = await pdfExporter.exportToPdf(sampleData, options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    }, 30000);

    test('should handle custom page format', async () => {
      const options = {
        format: ExportFormat.PDF,
        resourceType: 'vpcs',
        pageFormat: 'Letter'
      };

      const result = await pdfExporter.exportToPdf(sampleData, options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    }, 30000);

    test('should handle custom field selection', async () => {
      const options = {
        format: ExportFormat.PDF,
        resourceType: 'vpcs',
        fields: ['name', 'region', 'status']
      };

      const result = await pdfExporter.exportToPdf(sampleData, options);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    }, 30000);

    test('should handle empty data gracefully', async () => {
      const options = {
        format: ExportFormat.PDF,
        resourceType: 'vpcs'
      };

      await expect(pdfExporter.exportToPdf([], options)).rejects.toThrow('No data provided for PDF export');
    });

    test('should perform health check', async () => {
      const isHealthy = await pdfExporter.healthCheck();
      expect(typeof isHealthy).toBe('boolean');
    }, 30000);
  });

  describe('Integration Tests', () => {
    test('should handle complex data structures', async () => {
      const complexData = [
        {
          id: 1,
          vpc: {
            name: 'vpc-001',
            cidr: '10.0.0.0/16'
          },
          subnets: [
            { name: 'subnet-001', cidr: '10.0.1.0/24' },
            { name: 'subnet-002', cidr: '10.0.2.0/24' }
          ],
          tags: { Environment: 'prod', Team: 'infra' },
          metrics: {
            cpu: 45.2,
            memory: 78.9,
            network: null
          }
        }
      ];

      const csvExporter = new CsvExporter();
      const excelExporter = new ExcelExporter();

      // Test CSV export
      const csvOptions = {
        format: ExportFormat.CSV,
        resourceType: 'complex-vpcs'
      };

      const csvResult = await csvExporter.exportToCsv(complexData, csvOptions);
      expect(csvResult).toBeInstanceOf(Buffer);
      expect(csvResult.length).toBeGreaterThan(0);

      // Test Excel export
      const excelOptions = {
        format: ExportFormat.EXCEL,
        resourceType: 'complex-vpcs'
      };

      const excelResult = await excelExporter.exportToExcel(complexData, excelOptions);
      expect(excelResult).toBeInstanceOf(Buffer);
      expect(excelResult.length).toBeGreaterThan(0);
    });

    test('should handle large datasets efficiently', async () => {
      // Generate larger dataset
      const largeData = Array.from({ length: 1000 }, (_, index) => ({
        id: index + 1,
        name: `VPC-${String(index + 1).padStart(3, '0')}`,
        region: ['us-east-1', 'us-west-2', 'eu-west-1'][index % 3],
        cidr: `10.${Math.floor(index / 256)}.${index % 256}.0/24`,
        status: ['active', 'inactive', 'pending'][index % 3],
        createdAt: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000)
      }));

      const csvExporter = new CsvExporter();
      const startTime = Date.now();

      const csvOptions = {
        format: ExportFormat.CSV,
        resourceType: 'large-vpcs',
        batchSize: 100
      };

      const result = await csvExporter.exportToCsvStream(
        largeData,
        csvOptions,
        (processed, total) => {
          // Progress callback
          expect(processed).toBeLessThanOrEqual(total);
        }
      );

      const duration = Date.now() - startTime;
      console.log(`Large CSV export took ${duration}ms for ${largeData.length} records`);

      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);

      // Should complete within reasonable time
      expect(duration).toBeLessThan(15000); // Less than 15 seconds
    }, 20000); // 20 second timeout
  });
});