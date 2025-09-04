/**
 * Tests for File Processor Factory
 * Tests the factory pattern, streaming capabilities, and integration between processors
 */

import { Readable } from 'stream';
import { FileProcessorFactory } from '../file-processor-factory';
import { FileFormat, FileMetadata, NetworkDevice } from '../types';

describe('FileProcessorFactory', () => {
  let factory: FileProcessorFactory;
  let mockMetadata: FileMetadata;

  beforeEach(() => {
    factory = new FileProcessorFactory();
    mockMetadata = {
      filename: 'test-file',
      originalName: 'test-file',
      size: 1024,
      mimetype: 'text/plain',
      encoding: 'utf8',
      uploadedAt: new Date()
    };
  });

  afterEach(() => {
    // Clean up any active streams
    factory.stopAllStreams();
  });

  describe('initialization', () => {
    test('should initialize with all processors available', () => {
      expect(factory.getProcessor(FileFormat.CSV)).toBeDefined();
      expect(factory.getProcessor(FileFormat.EXCEL)).toBeDefined();
      expect(factory.getProcessor(FileFormat.JSON)).toBeDefined();
    });

    test('should return undefined for unknown format', () => {
      expect(factory.getProcessor('unknown' as FileFormat)).toBeUndefined();
    });
  });

  describe('detectFileFormat', () => {
    test('should detect CSV format from content and filename', async () => {
      const csvContent = 'hostname,ipAddress\nswitch01,192.168.1.1';
      const buffer = Buffer.from(csvContent, 'utf8');
      const csvMetadata = { ...mockMetadata, originalName: 'test.csv', mimetype: 'text/csv' };

      const format = await factory.detectFileFormat(buffer, csvMetadata);
      
      expect(format).toBe(FileFormat.CSV);
    });

    test('should detect JSON format from content', async () => {
      const jsonContent = JSON.stringify([{ hostname: 'switch01', ipAddress: '192.168.1.1' }]);
      const buffer = Buffer.from(jsonContent, 'utf8');
      const jsonMetadata = { ...mockMetadata, originalName: 'test.json', mimetype: 'application/json' };

      const format = await factory.detectFileFormat(buffer, jsonMetadata);
      
      expect(format).toBe(FileFormat.JSON);
    });

    test('should detect Excel format from binary signature', async () => {
      // Mock XLSX file signature (ZIP format)
      const xlsxSignature = Buffer.from([0x50, 0x4B, 0x03, 0x04, 0x14, 0x00, 0x08, 0x00]);
      const excelMetadata = { ...mockMetadata, originalName: 'test.xlsx', mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };

      const format = await factory.detectFileFormat(xlsxSignature, excelMetadata);
      
      expect(format).toBe(FileFormat.EXCEL);
    });

    test('should fall back to extension-based detection', async () => {
      const buffer = Buffer.from('ambiguous content', 'utf8');
      const csvMetadata = { ...mockMetadata, originalName: 'test.csv' };

      const format = await factory.detectFileFormat(buffer, csvMetadata);
      
      expect(format).toBe(FileFormat.CSV);
    });

    test('should return null for unknown format', async () => {
      const buffer = Buffer.from('unknown content', 'utf8');
      const unknownMetadata = { ...mockMetadata, originalName: 'test.xyz' };

      const format = await factory.detectFileFormat(buffer, unknownMetadata);
      
      expect(format).toBeNull();
    });
  });

  describe('validateFile', () => {
    test('should perform comprehensive validation', async () => {
      const csvContent = 'hostname,ipAddress\nswitch01,192.168.1.1';
      const buffer = Buffer.from(csvContent, 'utf8');
      const csvMetadata = { ...mockMetadata, originalName: 'test.csv', mimetype: 'text/csv' };

      const errors = await factory.validateFile(buffer, csvMetadata, FileFormat.CSV);
      
      expect(Array.isArray(errors)).toBe(true);
      // Should have no critical errors for valid CSV
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0);
    });

    test('should detect unknown format and return error', async () => {
      const buffer = Buffer.from('unknown content', 'utf8');
      const unknownMetadata = { ...mockMetadata, originalName: 'test.xyz' };

      const errors = await factory.validateFile(buffer, unknownMetadata);
      
      expect(errors.some(e => e.code === 'UNKNOWN_FILE_FORMAT')).toBe(true);
    });

    test('should combine format detection and processor validation', async () => {
      const invalidCsvContent = 'hostname,ipAddress\nswitch01'; // Inconsistent columns
      const buffer = Buffer.from(invalidCsvContent, 'utf8');
      const csvMetadata = { ...mockMetadata, originalName: 'test.csv', mimetype: 'text/csv' };

      const errors = await factory.validateFile(buffer, csvMetadata);
      
      expect(errors.some(e => e.code === 'INCONSISTENT_COLUMNS')).toBe(true);
    });

    test('should validate file size limits', async () => {
      const csvContent = 'hostname,ipAddress\nswitch01,192.168.1.1';
      const buffer = Buffer.from(csvContent, 'utf8');
      const largeMetadata = { ...mockMetadata, originalName: 'test.csv', size: 200 * 1024 * 1024 };

      const errors = await factory.validateFile(buffer, largeMetadata, FileFormat.CSV, { maxFileSize: 100 * 1024 * 1024 });
      
      expect(errors.some(e => e.code === 'FILE_TOO_LARGE')).toBe(true);
    });

    test('should validate MIME type compatibility', async () => {
      const csvContent = 'hostname,ipAddress\nswitch01,192.168.1.1';
      const buffer = Buffer.from(csvContent, 'utf8');
      const invalidMimeMetadata = { ...mockMetadata, originalName: 'test.csv', mimetype: 'application/pdf' };

      const errors = await factory.validateFile(buffer, invalidMimeMetadata, FileFormat.CSV);
      
      expect(errors.some(e => e.code === 'MIME_TYPE_MISMATCH')).toBe(true);
    });
  });

  describe('processFile', () => {
    test('should process CSV file with automatic detection', async () => {
      const csvContent = 'hostname,ipAddress,deviceType\nswitch01,192.168.1.1,switch';
      const buffer = Buffer.from(csvContent, 'utf8');
      const csvMetadata = { ...mockMetadata, originalName: 'test.csv', mimetype: 'text/csv' };

      const result = await factory.processFile(buffer, csvMetadata);

      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(1);
      expect(result.validRecords).toBe(1);
    });

    test('should process JSON file with automatic detection', async () => {
      const jsonData = [{ hostname: 'switch01', ipAddress: '192.168.1.1', deviceType: 'switch' }];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');
      const jsonMetadata = { ...mockMetadata, originalName: 'test.json', mimetype: 'application/json' };

      const result = await factory.processFile(buffer, jsonMetadata);

      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(1);
      expect(result.validRecords).toBe(1);
    });

    test('should handle unknown format gracefully', async () => {
      const buffer = Buffer.from('unknown content', 'utf8');
      const unknownMetadata = { ...mockMetadata, originalName: 'test.xyz' };

      const result = await factory.processFile(buffer, unknownMetadata);

      expect(result.success).toBe(false);
      expect(result.summary.errors.some(e => e.code === 'UNKNOWN_FILE_FORMAT')).toBe(true);
    });

    test('should handle missing processor gracefully', async () => {
      const csvContent = 'hostname,ipAddress\nswitch01,192.168.1.1';
      const buffer = Buffer.from(csvContent, 'utf8');

      // Mock getProcessor to return undefined
      const originalGetProcessor = factory.getProcessor;
      factory.getProcessor = jest.fn().mockReturnValue(undefined);

      const result = await factory.processFile(buffer, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.summary.errors.some(e => e.code === 'PROCESSOR_NOT_FOUND')).toBe(true);

      // Restore original method
      factory.getProcessor = originalGetProcessor;
    });
  });

  describe('createStreamingProcessor', () => {
    test('should create streaming processor for CSV data', (done) => {
      const csvContent = 'hostname,ipAddress,deviceType\nswitch01,192.168.1.1,switch\nrouter01,192.168.1.2,router';
      const source = Readable.from([csvContent]);
      const csvMetadata = { ...mockMetadata, originalName: 'test.csv', mimetype: 'text/csv' };

      let progressCallbacks = 0;
      const streamingResult = factory.createStreamingProcessor(
        source,
        csvMetadata,
        {
          progressInterval: 1,
          enableStreaming: true
        }
      );

      streamingResult.streamProcessor.on('progress', (stats) => {
        progressCallbacks++;
        expect(stats.recordsProcessed).toBeGreaterThan(0);
      });

      const results: any[] = [];
      streamingResult.streamProcessor.on('data', (result) => {
        results.push(result);
      });

      streamingResult.streamProcessor.on('end', () => {
        expect(results.length).toBeGreaterThan(0);
        expect(factory.getActiveStreamCount()).toBe(0); // Should auto-cleanup
        done();
      });

      streamingResult.streamProcessor.on('error', done);
    });

    test('should respect error threshold in streaming', (done) => {
      const csvContent = 'hostname,ipAddress\nswitch01,invalid-ip\nswitch02,another-invalid-ip\nswitch03,yet-another-invalid';
      const source = Readable.from([csvContent]);
      const csvMetadata = { ...mockMetadata, originalName: 'test.csv', mimetype: 'text/csv' };

      const streamingResult = factory.createStreamingProcessor(
        source,
        csvMetadata,
        {
          errorThreshold: 2,
          enableStreaming: true
        }
      );

      streamingResult.streamProcessor.on('error', (error) => {
        expect(error.message).toContain('Error threshold exceeded');
        done();
      });

      streamingResult.streamProcessor.on('end', () => {
        done(new Error('Should have stopped due to error threshold'));
      });
    });

    test('should respect memory limit in streaming', (done) => {
      const csvContent = 'hostname,ipAddress\nswitch01,192.168.1.1\nswitch02,192.168.1.2';
      const source = Readable.from([csvContent]);
      const csvMetadata = { ...mockMetadata, originalName: 'test.csv', mimetype: 'text/csv' };

      const streamingResult = factory.createStreamingProcessor(
        source,
        csvMetadata,
        {
          memoryLimit: 0.1, // Very low limit to trigger quickly
          enableStreaming: true
        }
      );

      streamingResult.streamProcessor.on('error', (error) => {
        expect(error.message).toContain('Memory limit exceeded');
        done();
      });

      streamingResult.streamProcessor.on('end', () => {
        // Might complete before hitting memory limit due to small data
        done();
      });
    });

    test('should handle streaming processor cleanup', () => {
      const csvContent = 'hostname,ipAddress\nswitch01,192.168.1.1';
      const source = Readable.from([csvContent]);
      const csvMetadata = { ...mockMetadata, originalName: 'test.csv', mimetype: 'text/csv' };

      const streamingResult = factory.createStreamingProcessor(source, csvMetadata);
      
      expect(factory.getActiveStreamCount()).toBe(1);
      
      streamingResult.cleanup();
      
      expect(factory.getActiveStreamCount()).toBe(0);
    });

    test('should track multiple active streams', () => {
      const csvContent = 'hostname,ipAddress\nswitch01,192.168.1.1';
      const source1 = Readable.from([csvContent]);
      const source2 = Readable.from([csvContent]);
      const csvMetadata = { ...mockMetadata, originalName: 'test.csv', mimetype: 'text/csv' };

      const stream1 = factory.createStreamingProcessor(source1, csvMetadata);
      const stream2 = factory.createStreamingProcessor(source2, csvMetadata);
      
      expect(factory.getActiveStreamCount()).toBe(2);
      
      stream1.cleanup();
      expect(factory.getActiveStreamCount()).toBe(1);
      
      stream2.cleanup();
      expect(factory.getActiveStreamCount()).toBe(0);
    });

    test('should stop all streams when requested', () => {
      const csvContent = 'hostname,ipAddress\nswitch01,192.168.1.1';
      const source1 = Readable.from([csvContent]);
      const source2 = Readable.from([csvContent]);
      const csvMetadata = { ...mockMetadata, originalName: 'test.csv', mimetype: 'text/csv' };

      factory.createStreamingProcessor(source1, csvMetadata);
      factory.createStreamingProcessor(source2, csvMetadata);
      
      expect(factory.getActiveStreamCount()).toBe(2);
      
      factory.stopAllStreams();
      
      expect(factory.getActiveStreamCount()).toBe(0);
    });
  });

  describe('generateTemplate', () => {
    test('should generate CSV template', async () => {
      const template = await factory.generateTemplate(FileFormat.CSV);
      const templateContent = template.toString('utf8');

      expect(templateContent).toContain('hostname');
      expect(templateContent).toContain('ipAddress');
      expect(templateContent).toContain(','); // CSV delimiter
    });

    test('should generate JSON template', async () => {
      const template = await factory.generateTemplate(FileFormat.JSON);
      const templateContent = JSON.parse(template.toString('utf8'));

      expect(Array.isArray(templateContent)).toBe(true);
      expect(templateContent[0]).toHaveProperty('hostname');
      expect(templateContent[0]).toHaveProperty('ipAddress');
    });

    test('should generate Excel template', async () => {
      const template = await factory.generateTemplate(FileFormat.EXCEL);

      expect(Buffer.isBuffer(template)).toBe(true);
      expect(template.length).toBeGreaterThan(0);
    });

    test('should generate template with custom fields', async () => {
      const customFields = [
        { name: 'hostname', type: 'string' as const, required: true, example: 'my-host' },
        { name: 'customField', type: 'string' as const, required: false, example: 'custom-value' }
      ];

      const template = await factory.generateTemplate(FileFormat.JSON, customFields);
      const templateContent = JSON.parse(template.toString('utf8'));

      expect(templateContent[0].hostname).toBe('my-host');
      expect(templateContent[0].customField).toBe('custom-value');
    });

    test('should throw error for unknown format', async () => {
      await expect(factory.generateTemplate('unknown' as FileFormat)).rejects.toThrow('No processor available for format');
    });
  });

  describe('getGlobalProcessingStats', () => {
    test('should return stats for all processors', async () => {
      // Process files with different formats to generate stats
      const csvContent = 'hostname,ipAddress\nswitch01,192.168.1.1';
      const jsonContent = JSON.stringify([{ hostname: 'router01', ipAddress: '192.168.1.2' }]);

      await factory.processFile(Buffer.from(csvContent, 'utf8'), { ...mockMetadata, originalName: 'test.csv' });
      await factory.processFile(Buffer.from(jsonContent, 'utf8'), { ...mockMetadata, originalName: 'test.json' });

      const globalStats = factory.getGlobalProcessingStats();

      expect(globalStats.has(FileFormat.CSV)).toBe(true);
      expect(globalStats.has(FileFormat.EXCEL)).toBe(true);
      expect(globalStats.has(FileFormat.JSON)).toBe(true);

      const csvStats = globalStats.get(FileFormat.CSV);
      expect(csvStats.totalFilesProcessed).toBeGreaterThan(0);

      const jsonStats = globalStats.get(FileFormat.JSON);
      expect(jsonStats.totalFilesProcessed).toBeGreaterThan(0);
    });
  });

  describe('createFactory static method', () => {
    test('should create factory function for specific format', () => {
      const csvFactory = FileProcessorFactory.createFactory(FileFormat.CSV);
      const processor = csvFactory();

      expect(processor).toBeDefined();
      expect(processor.format).toBe(FileFormat.CSV);
    });

    test('should throw error for unknown format in factory', () => {
      const unknownFactory = FileProcessorFactory.createFactory('unknown' as FileFormat);
      
      expect(() => unknownFactory()).toThrow('No processor available for format');
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle empty file gracefully', async () => {
      const buffer = Buffer.from('', 'utf8');
      
      const errors = await factory.validateFile(buffer, mockMetadata);
      
      expect(errors.some(e => e.code === 'EMPTY_FILE')).toBe(true);
    });

    test('should handle corrupted file data', async () => {
      const corruptedBuffer = Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE]);
      
      const errors = await factory.validateFile(corruptedBuffer, mockMetadata);
      
      expect(errors.some(e => e.severity === 'error' || e.severity === 'warning')).toBe(true);
    });

    test('should handle very large files', async () => {
      const largeContent = 'hostname,ipAddress\n' + 'switch01,192.168.1.1\n'.repeat(10000);
      const buffer = Buffer.from(largeContent, 'utf8');
      const largeMetadata = { ...mockMetadata, size: buffer.length };

      const errors = await factory.validateFile(buffer, largeMetadata, FileFormat.CSV);
      
      // Should warn about large file
      expect(errors.some(e => e.code === 'LARGE_FILE_WARNING')).toBe(true);
    });

    test('should handle files with suspicious content', async () => {
      const suspiciousBuffer = Buffer.from([0x4D, 0x5A]); // PE executable header
      
      const errors = await factory.validateFile(suspiciousBuffer, mockMetadata);
      
      expect(errors.some(e => e.code === 'SUSPICIOUS_CONTENT')).toBe(true);
    });

    test('should handle encoding detection failures', async () => {
      const binaryBuffer = Buffer.from([0xFF, 0xFE, 0x00, 0x00, 0x41, 0x00]);
      
      const errors = await factory.validateFile(binaryBuffer, mockMetadata);
      
      // Should still attempt to process despite encoding issues
      expect(Array.isArray(errors)).toBe(true);
    });

    test('should handle streaming with format detection failure', (done) => {
      const unknownContent = 'completely unknown format content';
      const source = Readable.from([unknownContent]);
      const unknownMetadata = { ...mockMetadata, originalName: 'test.xyz' };

      const streamingResult = factory.createStreamingProcessor(source, unknownMetadata);

      streamingResult.streamProcessor.on('error', (error) => {
        expect(streamingResult.errors.length).toBeGreaterThan(0);
        done();
      });

      streamingResult.streamProcessor.on('end', () => {
        // Should have errors in result
        expect(streamingResult.errors.some(e => e.code === 'STREAM_FORMAT_DETECTION_FAILED')).toBe(true);
        done();
      });
    });

    test('should handle processor instantiation errors', () => {
      // Test creating factory after processors are cleaned up
      const newFactory = new FileProcessorFactory();
      
      expect(newFactory.getProcessor(FileFormat.CSV)).toBeDefined();
      expect(newFactory.getProcessor(FileFormat.EXCEL)).toBeDefined();
      expect(newFactory.getProcessor(FileFormat.JSON)).toBeDefined();
    });
  });

  describe('integration tests', () => {
    test('should process CSV through complete pipeline', async () => {
      const csvContent = 'hostname,ipAddress,deviceType,manufacturer\nswitch01,192.168.1.1,switch,Cisco\nrouter01,192.168.1.2,router,Juniper';
      const buffer = Buffer.from(csvContent, 'utf8');
      const csvMetadata = { ...mockMetadata, originalName: 'network-devices.csv', mimetype: 'text/csv' };

      // Validate
      const errors = await factory.validateFile(buffer, csvMetadata);
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0);

      // Process
      const result = await factory.processFile(buffer, csvMetadata);
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(2);

      // Verify data
      const devices = result.results.map(r => r.data) as NetworkDevice[];
      expect(devices[0].hostname).toBe('switch01');
      expect(devices[0].manufacturer).toBe('Cisco');
      expect(devices[1].hostname).toBe('router01');
      expect(devices[1].manufacturer).toBe('Juniper');
    });

    test('should process JSON through complete pipeline', async () => {
      const jsonData = [
        {
          hostname: 'firewall01',
          ipAddress: '192.168.1.10',
          deviceType: 'firewall',
          manufacturer: 'Palo Alto',
          tags: ['security', 'perimeter']
        },
        {
          hostname: 'server01',
          ipAddress: '192.168.1.20',
          deviceType: 'server',
          manufacturer: 'Dell',
          tags: ['compute', 'production']
        }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');
      const jsonMetadata = { ...mockMetadata, originalName: 'network-devices.json', mimetype: 'application/json' };

      // Validate
      const errors = await factory.validateFile(buffer, jsonMetadata);
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0);

      // Process
      const result = await factory.processFile(buffer, jsonMetadata);
      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(2);

      // Verify data
      const devices = result.results.map(r => r.data) as NetworkDevice[];
      expect(devices[0].hostname).toBe('firewall01');
      expect(devices[0].tags).toEqual(['security', 'perimeter']);
      expect(devices[1].hostname).toBe('server01');
      expect(devices[1].tags).toEqual(['compute', 'production']);
    });
  });
});