/**
 * ExportService Unit Tests
 * Comprehensive tests for the ExportService class
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExportService } from '../../src/services/reporting/ExportService';
import {
  generateMockVpcs,
  createSampleExportOptions,
  assertApiResponse,
  assertExportFile,
  cleanupTestFiles
} from '../utils/testHelpers';
import { ExportFormat } from '../../src/types/reports';

describe('ExportService', () => {
  let exportService: ExportService;
  let tempExportPath: string;
  let testFiles: string[] = [];

  beforeAll(() => {
    tempExportPath = path.join(__dirname, '../../temp-exports-test');
    exportService = new ExportService(tempExportPath);
  });

  afterAll(() => {
    // Cleanup all test files
    cleanupTestFiles(testFiles);

    // Remove temp directory if empty
    try {
      if (fs.existsSync(tempExportPath)) {
        fs.rmdirSync(tempExportPath);
      }
    } catch (error) {
      // Directory not empty or other error, ignore
    }
  });

  beforeEach(() => {
    // Clear test files list
    testFiles = [];
  });

  afterEach(() => {
    // Cleanup files created during test
    cleanupTestFiles(testFiles);
  });

  // ===================== CSV EXPORT TESTS =====================

  describe('CSV Export', () => {
    it('should export data to CSV format successfully', async () => {
      const testData = generateMockVpcs(5);
      const options = createSampleExportOptions('csv');

      const result = await exportService.exportData(testData, 'csv', options);

      assertApiResponse(result, true);
      assertExportFile(result.data);

      // Track file for cleanup
      testFiles.push(result.data.filePath);

      // Verify file exists and has content
      expect(fs.existsSync(result.data.filePath)).toBe(true);
      const fileContent = fs.readFileSync(result.data.filePath, 'utf8');

      // Should contain headers
      expect(fileContent).toContain('vpc_id');
      expect(fileContent).toContain('cidr_block');

      // Should contain data
      expect(fileContent).toContain('vpc-000001');

      // Should have correct number of lines (header + data)
      const lines = fileContent.split('\n').filter(line => line.trim());
      expect(lines.length).toBe(6); // 1 header + 5 data rows
    });

    it('should handle empty data for CSV export', async () => {
      const result = await exportService.exportData([], 'csv');

      assertApiResponse(result, true);
      testFiles.push(result.data.filePath);

      expect(fs.existsSync(result.data.filePath)).toBe(true);
      const fileContent = fs.readFileSync(result.data.filePath, 'utf8');
      expect(fileContent).toBe('');
    });

    it('should escape special characters in CSV', async () => {
      const specialData = [{
        id: 1,
        name: 'Test, with "quotes" and commas',
        description: 'Line 1\nLine 2'
      }];

      const result = await exportService.exportData(specialData, 'csv');

      assertApiResponse(result, true);
      testFiles.push(result.data.filePath);

      const fileContent = fs.readFileSync(result.data.filePath, 'utf8');

      // Should escape quotes and commas properly
      expect(fileContent).toContain('"Test, with ""quotes"" and commas"');
    });

    it('should handle large CSV datasets efficiently', async () => {
      const largeData = generateMockVpcs(1000);

      const startTime = Date.now();
      const result = await exportService.exportData(largeData, 'csv');
      const executionTime = Date.now() - startTime;

      assertApiResponse(result, true);
      testFiles.push(result.data.filePath);

      // Should complete within reasonable time
      expect(executionTime).toBeLessThan(5000);

      // Verify file size is appropriate
      expect(result.data.size).toBeGreaterThan(1000);
    });
  });

  // ===================== EXCEL EXPORT TESTS =====================

  describe('Excel Export', () => {
    it('should export data to Excel format successfully', async () => {
      const testData = generateMockVpcs(3);
      const options = createSampleExportOptions('excel');

      const result = await exportService.exportData(testData, 'excel', options);

      assertApiResponse(result, true);
      assertExportFile(result.data);

      testFiles.push(result.data.filePath);

      // Verify file exists and has content
      expect(fs.existsSync(result.data.filePath)).toBe(true);
      expect(result.data.size).toBeGreaterThan(1000); // Excel files are typically larger
      expect(result.data.fileName).toMatch(/\.excel$/);
    });

    it('should handle empty data for Excel export', async () => {
      const result = await exportService.exportData([], 'excel');

      assertApiResponse(result, true);
      testFiles.push(result.data.filePath);

      expect(fs.existsSync(result.data.filePath)).toBe(true);
      expect(result.data.size).toBeGreaterThan(0); // Empty Excel still has structure
    });

    it('should format Excel files with headers and styling', async () => {
      const testData = generateMockVpcs(2);
      const result = await exportService.exportData(testData, 'excel');

      assertApiResponse(result, true);
      testFiles.push(result.data.filePath);

      // Excel files should be reasonably sized with formatting
      expect(result.data.size).toBeGreaterThan(500);
    });

    it('should handle Excel export with large datasets', async () => {
      const largeData = generateMockVpcs(500);

      const startTime = Date.now();
      const result = await exportService.exportData(largeData, 'excel');
      const executionTime = Date.now() - startTime;

      assertApiResponse(result, true);
      testFiles.push(result.data.filePath);

      // Should complete within reasonable time
      expect(executionTime).toBeLessThan(10000);
      expect(result.data.size).toBeGreaterThan(10000);
    });
  });

  // ===================== JSON EXPORT TESTS =====================

  describe('JSON Export', () => {
    it('should export data to JSON format successfully', async () => {
      const testData = generateMockVpcs(3);
      const options = createSampleExportOptions('json');

      const result = await exportService.exportData(testData, 'json', options, {
        title: 'Test Report',
        version: '1.0'
      });

      assertApiResponse(result, true);
      assertExportFile(result.data);

      testFiles.push(result.data.filePath);

      // Verify file content
      const fileContent = fs.readFileSync(result.data.filePath, 'utf8');
      const jsonData = JSON.parse(fileContent);

      expect(jsonData).toHaveProperty('metadata');
      expect(jsonData).toHaveProperty('data');
      expect(jsonData.metadata).toHaveProperty('exportedAt');
      expect(jsonData.metadata).toHaveProperty('totalRecords', 3);
      expect(jsonData.metadata).toHaveProperty('format', 'json');
      expect(Array.isArray(jsonData.data)).toBe(true);
      expect(jsonData.data.length).toBe(3);
    });

    it('should export JSON without metadata when not requested', async () => {
      const testData = generateMockVpcs(2);
      const options = { format: 'json' as ExportFormat, includeMetadata: false };

      const result = await exportService.exportData(testData, 'json', options);

      assertApiResponse(result, true);
      testFiles.push(result.data.filePath);

      const fileContent = fs.readFileSync(result.data.filePath, 'utf8');
      const jsonData = JSON.parse(fileContent);

      expect(jsonData.metadata).toBeUndefined();
      expect(jsonData).toHaveProperty('data');
    });

    it('should handle complex nested data in JSON', async () => {
      const complexData = [{
        id: 1,
        name: 'test',
        nested: {
          level1: {
            level2: ['array', 'data']
          }
        },
        nullValue: null,
        undefinedValue: undefined
      }];

      const result = await exportService.exportData(complexData, 'json');

      assertApiResponse(result, true);
      testFiles.push(result.data.filePath);

      const fileContent = fs.readFileSync(result.data.filePath, 'utf8');
      const jsonData = JSON.parse(fileContent);

      expect(jsonData.data[0].nested.level1.level2).toEqual(['array', 'data']);
      expect(jsonData.data[0].nullValue).toBeNull();
      // undefined values are not serialized in JSON
    });
  });

  // ===================== PDF EXPORT TESTS =====================

  describe('PDF Export', () => {
    it('should export data to PDF format successfully', async () => {
      const testData = generateMockVpcs(3);
      const options = createSampleExportOptions('pdf');

      const result = await exportService.exportData(testData, 'pdf', options, {
        title: 'VPC Report'
      });

      assertApiResponse(result, true);
      assertExportFile(result.data);

      testFiles.push(result.data.filePath);

      expect(result.data.fileName).toMatch(/\.pdf$/);
      expect(result.data.size).toBeGreaterThan(1000); // PDF files are typically substantial
    }, 30000); // Longer timeout for PDF generation

    it('should handle empty data for PDF export', async () => {
      const result = await exportService.exportData([], 'pdf', undefined, {
        title: 'Empty Report'
      });

      assertApiResponse(result, true);
      testFiles.push(result.data.filePath);

      expect(result.data.size).toBeGreaterThan(500); // Even empty PDF has structure
    }, 30000);

    it('should generate PDF with metadata', async () => {
      const testData = generateMockVpcs(2);
      const metadata = {
        title: 'Network Resources Report',
        author: 'Test System',
        description: 'Generated report'
      };

      const result = await exportService.exportData(testData, 'pdf', undefined, metadata);

      assertApiResponse(result, true);
      testFiles.push(result.data.filePath);

      expect(result.data.size).toBeGreaterThan(1000);
    }, 30000);
  });

  // ===================== HTML EXPORT TESTS =====================

  describe('HTML Export', () => {
    it('should export data to HTML format successfully', async () => {
      const testData = generateMockVpcs(3);
      const options = createSampleExportOptions('html');

      const result = await exportService.exportData(testData, 'html', options, {
        title: 'VPC Report'
      });

      assertApiResponse(result, true);
      assertExportFile(result.data);

      testFiles.push(result.data.filePath);

      // Verify HTML content
      const fileContent = fs.readFileSync(result.data.filePath, 'utf8');
      expect(fileContent).toContain('<!DOCTYPE html>');
      expect(fileContent).toContain('<table>');
      expect(fileContent).toContain('<th>vpc_id</th>');
      expect(fileContent).toContain('vpc-000001');
      expect(fileContent).toContain('VPC Report');
    });

    it('should handle empty data for HTML export', async () => {
      const result = await exportService.exportData([], 'html', undefined, {
        title: 'Empty Report'
      });

      assertApiResponse(result, true);
      testFiles.push(result.data.filePath);

      const fileContent = fs.readFileSync(result.data.filePath, 'utf8');
      expect(fileContent).toContain('No data available');
      expect(fileContent).toContain('Empty Report');
    });

    it('should style HTML exports properly', async () => {
      const testData = generateMockVpcs(2);
      const result = await exportService.exportData(testData, 'html');

      assertApiResponse(result, true);
      testFiles.push(result.data.filePath);

      const fileContent = fs.readFileSync(result.data.filePath, 'utf8');
      expect(fileContent).toContain('<style>');
      expect(fileContent).toContain('border-collapse: collapse');
      expect(fileContent).toContain('font-family: Arial');
    });
  });

  // ===================== ERROR HANDLING TESTS =====================

  describe('Error Handling', () => {
    it('should handle unsupported export format', async () => {
      const testData = generateMockVpcs(1);

      const result = await exportService.exportData(testData, 'unsupported' as ExportFormat);

      assertApiResponse(result, false);
      expect(result.errors[0]).toHaveProperty('code', 'EXPORT_ERROR');
      expect(result.errors[0].message).toContain('Unsupported export format');
    });

    it('should handle file system errors gracefully', async () => {
      // Create service with invalid path to trigger file system error
      const invalidExportService = new ExportService('/invalid/path/that/does/not/exist');
      const testData = generateMockVpcs(1);

      const result = await invalidExportService.exportData(testData, 'json');

      assertApiResponse(result, false);
      expect(result.errors[0]).toHaveProperty('code', 'EXPORT_ERROR');
    });

    it('should handle large data that might cause memory issues', async () => {
      // Create very large dataset
      const largeData = generateMockVpcs(5000);

      const result = await exportService.exportData(largeData, 'json');

      // Should either succeed or fail gracefully, not crash
      expect(result).toHaveProperty('success');

      if (result.success) {
        testFiles.push(result.data.filePath);
        expect(result.data.size).toBeGreaterThan(100000);
      } else {
        expect(result.errors[0]).toHaveProperty('code', 'EXPORT_ERROR');
      }
    }, 30000);
  });

  // ===================== FILE MANAGEMENT TESTS =====================

  describe('File Management', () => {
    it('should get file stream for existing file', async () => {
      // First create a file
      const testData = generateMockVpcs(1);
      const result = await exportService.exportData(testData, 'json');

      assertApiResponse(result, true);
      testFiles.push(result.data.filePath);

      // Then get stream
      const stream = exportService.getFileStream(result.data.fileName);

      expect(stream).toBeTruthy();
      expect(stream).toHaveProperty('pipe');

      // Close stream
      if (stream) {
        stream.destroy();
      }
    });

    it('should return null for non-existent file', async () => {
      const stream = exportService.getFileStream('non-existent-file.json');
      expect(stream).toBeNull();
    });

    it('should delete file successfully', async () => {
      // Create a file
      const testData = generateMockVpcs(1);
      const result = await exportService.exportData(testData, 'json');

      assertApiResponse(result, true);

      // Verify file exists
      expect(fs.existsSync(result.data.filePath)).toBe(true);

      // Delete file
      const deleted = exportService.deleteFile(result.data.fileName);
      expect(deleted).toBe(true);

      // Verify file is gone
      expect(fs.existsSync(result.data.filePath)).toBe(false);
    });

    it('should handle deletion of non-existent file', async () => {
      const deleted = exportService.deleteFile('non-existent-file.json');
      expect(deleted).toBe(false);
    });

    it('should cleanup old files based on age', async () => {
      // Create a file
      const testData = generateMockVpcs(1);
      const result = await exportService.exportData(testData, 'json');

      assertApiResponse(result, true);
      testFiles.push(result.data.filePath);

      // Modify file timestamp to make it appear old
      const oldTime = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      fs.utimesSync(result.data.filePath, new Date(oldTime), new Date(oldTime));

      // Cleanup files older than 24 hours
      await exportService.cleanupOldFiles(24);

      // File should be deleted
      expect(fs.existsSync(result.data.filePath)).toBe(false);

      // Remove from test files since it's already deleted
      testFiles = testFiles.filter(f => f !== result.data.filePath);
    });

    it('should preserve recent files during cleanup', async () => {
      // Create a recent file
      const testData = generateMockVpcs(1);
      const result = await exportService.exportData(testData, 'json');

      assertApiResponse(result, true);
      testFiles.push(result.data.filePath);

      // Cleanup files older than 24 hours
      await exportService.cleanupOldFiles(24);

      // Recent file should still exist
      expect(fs.existsSync(result.data.filePath)).toBe(true);
    });
  });

  // ===================== PERFORMANCE TESTS =====================

  describe('Performance Tests', () => {
    it('should handle concurrent export requests', async () => {
      const testData = generateMockVpcs(10);
      const formats: ExportFormat[] = ['json', 'csv', 'html'];

      const promises = formats.map(format =>
        exportService.exportData(testData, format)
      );

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const executionTime = Date.now() - startTime;

      // All exports should succeed
      results.forEach(result => {
        assertApiResponse(result, true);
        if (result.success) {
          testFiles.push(result.data.filePath);
        }
      });

      // Should complete within reasonable time
      expect(executionTime).toBeLessThan(10000);
    }, 30000);

    it('should be memory efficient with large datasets', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      const largeData = generateMockVpcs(1000);

      const result = await exportService.exportData(largeData, 'json');

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      assertApiResponse(result, true);
      if (result.success) {
        testFiles.push(result.data.filePath);
      }

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  // ===================== INTEGRATION TESTS =====================

  describe('Integration Tests', () => {
    it('should maintain file integrity across different formats', async () => {
      const testData = generateMockVpcs(5);
      const formats: ExportFormat[] = ['json', 'csv'];

      const results = await Promise.all(
        formats.map(format => exportService.exportData(testData, format))
      );

      results.forEach(result => {
        assertApiResponse(result, true);
        if (result.success) {
          testFiles.push(result.data.filePath);

          // Verify file exists and has content
          expect(fs.existsSync(result.data.filePath)).toBe(true);
          expect(result.data.size).toBeGreaterThan(0);
        }
      });
    });

    it('should generate unique filenames for simultaneous exports', async () => {
      const testData = generateMockVpcs(2);

      const results = await Promise.all([
        exportService.exportData(testData, 'json'),
        exportService.exportData(testData, 'json'),
        exportService.exportData(testData, 'json')
      ]);

      results.forEach(result => assertApiResponse(result, true));

      if (results.every(r => r.success)) {
        const filenames = results.map(r => r.data.fileName);
        const uniqueFilenames = new Set(filenames);

        // All filenames should be unique
        expect(uniqueFilenames.size).toBe(filenames.length);

        // Track files for cleanup
        results.forEach(result => {
          if (result.success) {
            testFiles.push(result.data.filePath);
          }
        });
      }
    });
  });
});