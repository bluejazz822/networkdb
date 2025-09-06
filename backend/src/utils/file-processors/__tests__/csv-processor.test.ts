/**
 * Tests for CSV Processor
 * Comprehensive tests covering all functionality including edge cases and streaming
 */

import { Readable } from 'stream';
import { CsvProcessor } from '../csv-processor';
import { FileFormat, FileMetadata, NetworkDevice } from '../types';

describe('CsvProcessor', () => {
  let processor: CsvProcessor;
  let mockMetadata: FileMetadata;

  beforeEach(() => {
    processor = new CsvProcessor();
    mockMetadata = {
      filename: 'test.csv',
      originalName: 'test.csv',
      size: 1024,
      mimetype: 'text/csv',
      encoding: 'utf8',
      uploadedAt: new Date()
    };
  });

  describe('format property', () => {
    test('should return CSV format', () => {
      expect(processor.format).toBe(FileFormat.CSV);
    });
  });

  describe('validateFile', () => {
    test('should pass validation for valid CSV file', async () => {
      const csvContent = 'hostname,ipAddress,deviceType\nswitch01,192.168.1.1,switch\nrouter01,192.168.1.2,router';
      const buffer = Buffer.from(csvContent, 'utf8');

      const errors = await processor.validateFile(buffer, mockMetadata);
      
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0);
    });

    test('should detect empty file', async () => {
      const buffer = Buffer.from('', 'utf8');

      const errors = await processor.validateFile(buffer, mockMetadata);
      
      expect(errors.some(e => e.code === 'EMPTY_FILE')).toBe(true);
    });

    test('should detect invalid MIME type', async () => {
      const csvContent = 'hostname,ipAddress\ntest,192.168.1.1';
      const buffer = Buffer.from(csvContent, 'utf8');
      const invalidMetadata = { ...mockMetadata, mimetype: 'application/pdf' };

      const errors = await processor.validateFile(buffer, invalidMetadata);
      
      expect(errors.some(e => e.code === 'INVALID_MIME_TYPE')).toBe(true);
    });

    test('should detect inconsistent column count', async () => {
      const csvContent = 'hostname,ipAddress,deviceType\nswitch01,192.168.1.1,switch\nrouter01,192.168.1.2'; // Missing third column
      const buffer = Buffer.from(csvContent, 'utf8');

      const errors = await processor.validateFile(buffer, mockMetadata);
      
      expect(errors.some(e => e.code === 'INCONSISTENT_COLUMNS')).toBe(true);
    });

    test('should handle CSV with no columns', async () => {
      const csvContent = '\n\n\n';
      const buffer = Buffer.from(csvContent, 'utf8');

      const errors = await processor.validateFile(buffer, mockMetadata);
      
      expect(errors.some(e => e.code === 'NO_COLUMNS')).toBe(true);
    });

    test('should handle large file size validation', async () => {
      const csvContent = 'hostname,ipAddress\ntest,192.168.1.1';
      const buffer = Buffer.from(csvContent, 'utf8');
      const largeMetadata = { ...mockMetadata, size: 200 * 1024 * 1024 }; // 200MB

      const errors = await processor.validateFile(buffer, largeMetadata, { maxFileSize: 100 * 1024 * 1024 });
      
      expect(errors.some(e => e.code === 'FILE_TOO_LARGE')).toBe(true);
    });
  });

  describe('processFile', () => {
    test('should process valid CSV file successfully', async () => {
      const csvContent = 'hostname,ipAddress,deviceType,status\nswitch01,192.168.1.1,switch,active\nrouter01,192.168.1.2,router,active';
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(2);
      expect(result.validRecords).toBe(2);
      expect(result.invalidRecords).toBe(0);
      expect(result.results).toHaveLength(2);

      const firstDevice = result.results[0].data as NetworkDevice;
      expect(firstDevice.hostname).toBe('switch01');
      expect(firstDevice.ipAddress).toBe('192.168.1.1');
      expect(firstDevice.deviceType).toBe('switch');
    });

    test('should handle CSV with missing required fields', async () => {
      const csvContent = 'hostname,deviceType\nswitch01,switch\n,router'; // Missing hostname in second row
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.totalRecords).toBe(2);
      expect(result.validRecords).toBe(0); // Both should fail - missing ipAddress
      expect(result.invalidRecords).toBe(2);
      expect(result.summary.errors.some(e => e.code === 'REQUIRED_FIELD_MISSING')).toBe(true);
    });

    test('should handle CSV with invalid IP addresses', async () => {
      const csvContent = 'hostname,ipAddress\nswitch01,999.999.999.999\nrouter01,not-an-ip';
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.invalidRecords).toBe(2);
      expect(result.summary.errors.some(e => e.code === 'INVALID_IP_ADDRESS')).toBe(true);
    });

    test('should handle CSV with invalid MAC addresses', async () => {
      const csvContent = 'hostname,ipAddress,macAddress\nswitch01,192.168.1.1,invalid-mac\nrouter01,192.168.1.2,00:11:22:33:44:55';
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.validRecords).toBe(1);
      expect(result.invalidRecords).toBe(1);
      expect(result.summary.errors.some(e => e.code === 'INVALID_MAC_ADDRESS')).toBe(true);
    });

    test('should handle CSV with custom fields', async () => {
      const csvContent = 'hostname,ipAddress,customField1,customField2\nswitch01,192.168.1.1,value1,value2';
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      expect(device.customFields).toBeDefined();
      expect(device.customFields!['customField1']).toBe('value1');
      expect(device.customFields!['customField2']).toBe('value2');
    });

    test('should handle CSV with different delimiters', async () => {
      const csvContent = 'hostname;ipAddress;deviceType\nswitch01;192.168.1.1;switch';
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata, { delimiter: ';' });

      expect(result.success).toBe(true);
      expect(result.validRecords).toBe(1);
      const device = result.results[0].data as NetworkDevice;
      expect(device.hostname).toBe('switch01');
    });

    test('should handle CSV with tags', async () => {
      const csvContent = 'hostname,ipAddress,tags\nswitch01,192.168.1.1,"tag1,tag2,tag3"';
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      expect(device.tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    test('should respect maxRecords limit', async () => {
      const csvContent = 'hostname,ipAddress\nswitch01,192.168.1.1\nswitch02,192.168.1.2\nswitch03,192.168.1.3';
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata, { maxRecords: 2 });

      expect(result.totalRecords).toBe(2);
      expect(result.summary.warnings.some(w => w.includes('Processing stopped at 2 records limit'))).toBe(true);
    });

    test('should handle empty CSV file gracefully', async () => {
      const csvContent = '';
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.totalRecords).toBe(0);
    });

    test('should handle CSV with only headers', async () => {
      const csvContent = 'hostname,ipAddress,deviceType';
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(0);
    });

    test('should sanitize and normalize device types and status', async () => {
      const csvContent = 'hostname,ipAddress,deviceType,status\nswitch01,192.168.1.1,UNKNOWN,INVALID';
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      expect(device.deviceType).toBe('other'); // Should default to 'other'
      expect(device.status).toBe('active'); // Should default to 'active'
      expect(result.results[0].warnings).toBeDefined();
    });

    test('should handle processing errors gracefully', async () => {
      const csvContent = 'hostname,ipAddress\nswitch01,192.168.1.1'; 
      const buffer = Buffer.from(csvContent, 'utf8');

      // Mock the processRow method to throw an error
      const originalProcessRow = (processor as any).processRow;
      (processor as any).processRow = jest.fn().mockImplementation(() => {
        throw new Error('Processing error');
      });

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.summary.errors.some(e => e.code === 'PROCESSING_ERROR')).toBe(true);

      // Restore original method
      (processor as any).processRow = originalProcessRow;
    });
  });

  describe('createStream', () => {
    test('should create streaming processor', (done) => {
      const csvContent = 'hostname,ipAddress,deviceType\nswitch01,192.168.1.1,switch\nrouter01,192.168.1.2,router';
      const source = Readable.from([csvContent]);

      const results: any[] = [];
      let progressUpdates = 0;

      const stream = processor.createStream(
        source,
        mockMetadata,
        undefined,
        (stats) => {
          progressUpdates++;
          expect(stats.recordsProcessed).toBeGreaterThan(0);
          expect(stats.processingRatePerSecond).toBeGreaterThanOrEqual(0);
        }
      );

      stream.on('data', (result) => {
        results.push(result);
      });

      stream.on('end', () => {
        expect(results).toHaveLength(2);
        expect(results[0].success).toBe(true);
        expect(results[1].success).toBe(true);
        done();
      });

      stream.on('error', done);
    });

    test('should handle streaming errors', (done) => {
      const invalidCsvContent = 'invalid content that will cause parsing error';
      const source = Readable.from([invalidCsvContent]);

      const stream = processor.createStream(source, mockMetadata);

      stream.on('error', (error) => {
        expect(error.message).toContain('CSV parsing failed');
        done();
      });

      stream.on('end', () => {
        done(new Error('Should have thrown an error'));
      });
    });

    test('should provide progress updates in streaming mode', (done) => {
      // Create CSV with more records to trigger progress updates
      let csvContent = 'hostname,ipAddress,deviceType\n';
      for (let i = 1; i <= 2500; i++) {
        csvContent += `switch${i.toString().padStart(4, '0')},192.168.${Math.floor(i/256)}.${i%256},switch\n`;
      }

      const source = Readable.from([csvContent]);
      let progressCallbacks = 0;

      const stream = processor.createStream(
        source,
        mockMetadata,
        undefined,
        (stats) => {
          progressCallbacks++;
          expect(stats.recordsProcessed).toBeGreaterThan(0);
          expect(stats.currentMemoryUsageMB).toBeGreaterThan(0);
        }
      );

      const results: any[] = [];
      stream.on('data', (result) => {
        results.push(result);
      });

      stream.on('end', () => {
        expect(results.length).toBe(2500);
        expect(progressCallbacks).toBeGreaterThan(0);
        done();
      });

      stream.on('error', done);
    });
  });

  describe('generateTemplate', () => {
    test('should generate CSV template with default fields', async () => {
      const fields = [
        { name: 'hostname', type: 'string' as const, required: true },
        { name: 'ipAddress', type: 'ip' as const, required: true },
        { name: 'deviceType', type: 'string' as const, required: false }
      ];

      const templateBuffer = await processor.generateTemplate(fields);
      const templateContent = templateBuffer.toString('utf8');

      expect(templateContent).toContain('hostname,ipAddress,deviceType');
      expect(templateContent).toContain('example-host,192.168.1.1');
    });

    test('should generate template with custom examples', async () => {
      const fields = [
        { name: 'hostname', type: 'string' as const, required: true, example: 'my-switch' },
        { name: 'ipAddress', type: 'ip' as const, required: true, example: '10.0.0.1' }
      ];

      const templateBuffer = await processor.generateTemplate(fields);
      const templateContent = templateBuffer.toString('utf8');

      expect(templateContent).toContain('my-switch');
      expect(templateContent).toContain('10.0.0.1');
    });

    test('should handle different field types in template', async () => {
      const fields = [
        { name: 'hostname', type: 'string' as const, required: true },
        { name: 'port', type: 'number' as const, required: false, validation: { min: 1 } },
        { name: 'active', type: 'boolean' as const, required: false },
        { name: 'lastSeen', type: 'date' as const, required: false },
        { name: 'email', type: 'email' as const, required: false },
        { name: 'macAddress', type: 'mac' as const, required: false }
      ];

      const templateBuffer = await processor.generateTemplate(fields);
      const templateContent = templateBuffer.toString('utf8');

      expect(templateContent).toContain('hostname,port,active,lastSeen,email,macAddress');
      expect(templateContent).toContain('1'); // number example
      expect(templateContent).toContain('true'); // boolean example
      expect(templateContent).toContain('@'); // email example
      expect(templateContent).toContain('00:11:22:33:44:55'); // MAC example
    });

    test('should respect CSV options in template generation', async () => {
      const fields = [
        { name: 'hostname', type: 'string' as const, required: true },
        { name: 'ipAddress', type: 'ip' as const, required: true }
      ];

      const templateBuffer = await processor.generateTemplate(fields, { delimiter: ';' });
      const templateContent = templateBuffer.toString('utf8');

      expect(templateContent).toContain('hostname;ipAddress');
    });
  });

  describe('detectEncoding', () => {
    test('should detect UTF-8 encoding', async () => {
      const content = 'hostname,ipAddress\ntest,192.168.1.1';
      const buffer = Buffer.from(content, 'utf8');

      const encoding = await processor.detectEncoding(buffer);

      expect(encoding).toBe('utf8');
    });

    test('should handle Latin-1 encoding', async () => {
      const content = 'hostname,ipAddress\ntest,192.168.1.1';
      const buffer = Buffer.from(content, 'latin1');

      const encoding = await processor.detectEncoding(buffer);

      expect(['utf8', 'latin1']).toContain(encoding);
    });

    test('should default to UTF-8 for unknown encoding', async () => {
      const buffer = Buffer.from([0xFF, 0xFE, 0x00, 0x00]); // Invalid UTF-8

      const encoding = await processor.detectEncoding(buffer);

      expect(encoding).toBe('utf8'); // Should default to utf8
    });
  });

  describe('getProcessingStats', () => {
    test('should return processing statistics', async () => {
      const csvContent = 'hostname,ipAddress\nswitch01,192.168.1.1\nrouter01,192.168.1.2';
      const buffer = Buffer.from(csvContent, 'utf8');

      await processor.processFile(buffer, mockMetadata);

      const stats = processor.getProcessingStats();

      expect(stats.totalFilesProcessed).toBe(1);
      expect(stats.totalRecordsProcessed).toBe(2);
      expect(stats.totalProcessingTimeMs).toBeGreaterThan(0);
      expect(stats.averageProcessingRatePerSecond).toBeGreaterThan(0);
    });

    test('should update statistics after multiple processing operations', async () => {
      const csvContent1 = 'hostname,ipAddress\nswitch01,192.168.1.1';
      const csvContent2 = 'hostname,ipAddress\nrouter01,192.168.1.2\nrouter02,192.168.1.3';
      
      await processor.processFile(Buffer.from(csvContent1, 'utf8'), mockMetadata);
      await processor.processFile(Buffer.from(csvContent2, 'utf8'), mockMetadata);

      const stats = processor.getProcessingStats();

      expect(stats.totalFilesProcessed).toBe(2);
      expect(stats.totalRecordsProcessed).toBe(3);
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle CSV with quoted fields containing delimiters', async () => {
      const csvContent = 'hostname,ipAddress,description\nswitch01,192.168.1.1,"This is, a description with commas"';
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      expect(device.description).toBe('This is, a description with commas');
    });

    test('should handle CSV with escaped quotes', async () => {
      const csvContent = 'hostname,ipAddress,description\nswitch01,192.168.1.1,"Description with ""quotes"""';
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      expect(device.description).toBe('Description with "quotes"');
    });

    test('should handle CSV with mixed line endings', async () => {
      const csvContent = 'hostname,ipAddress\r\nswitch01,192.168.1.1\nrouter01,192.168.1.2\r\n';
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      expect(result.validRecords).toBe(2);
    });

    test('should handle CSV with extra whitespace', async () => {
      const csvContent = '  hostname  , ipAddress  ,  deviceType  \n  switch01  , 192.168.1.1  ,  switch  ';
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      expect(device.hostname).toBe('switch01');
      expect(device.ipAddress).toBe('192.168.1.1');
      expect(device.deviceType).toBe('switch');
    });

    test('should handle CSV with BOM (Byte Order Mark)', async () => {
      const csvContent = '\uFEFFhostname,ipAddress\nswitch01,192.168.1.1';
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      expect(result.validRecords).toBe(1);
    });

    test('should handle very large field values', async () => {
      const largeDescription = 'x'.repeat(10000);
      const csvContent = `hostname,ipAddress,description\nswitch01,192.168.1.1,"${largeDescription}"`;
      const buffer = Buffer.from(csvContent, 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      expect(device.description).toBe(largeDescription);
    });
  });
});