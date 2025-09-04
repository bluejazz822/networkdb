/**
 * Tests for JSON Processor
 * Comprehensive tests covering JSON parsing, schema validation, and streaming
 */

import { Readable } from 'stream';
import { JsonProcessor } from '../json-processor';
import { FileFormat, FileMetadata, NetworkDevice } from '../types';

describe('JsonProcessor', () => {
  let processor: JsonProcessor;
  let mockMetadata: FileMetadata;

  beforeEach(() => {
    processor = new JsonProcessor();
    mockMetadata = {
      filename: 'test.json',
      originalName: 'test.json',
      size: 1024,
      mimetype: 'application/json',
      encoding: 'utf8',
      uploadedAt: new Date()
    };
  });

  describe('format property', () => {
    test('should return JSON format', () => {
      expect(processor.format).toBe(FileFormat.JSON);
    });
  });

  describe('validateFile', () => {
    test('should pass validation for valid JSON array', async () => {
      const jsonContent = JSON.stringify([
        { hostname: 'switch01', ipAddress: '192.168.1.1', deviceType: 'switch' },
        { hostname: 'router01', ipAddress: '192.168.1.2', deviceType: 'router' }
      ]);
      const buffer = Buffer.from(jsonContent, 'utf8');

      const errors = await processor.validateFile(buffer, mockMetadata);
      
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0);
    });

    test('should pass validation for single JSON object', async () => {
      const jsonContent = JSON.stringify({
        hostname: 'switch01',
        ipAddress: '192.168.1.1',
        deviceType: 'switch'
      });
      const buffer = Buffer.from(jsonContent, 'utf8');

      const errors = await processor.validateFile(buffer, mockMetadata);
      
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0);
    });

    test('should detect empty file', async () => {
      const buffer = Buffer.from('', 'utf8');

      const errors = await processor.validateFile(buffer, mockMetadata);
      
      expect(errors.some(e => e.code === 'EMPTY_FILE')).toBe(true);
    });

    test('should detect invalid JSON syntax', async () => {
      const buffer = Buffer.from('{ invalid json }', 'utf8');

      const errors = await processor.validateFile(buffer, mockMetadata);
      
      expect(errors.some(e => e.code === 'INVALID_JSON_SYNTAX')).toBe(true);
    });

    test('should detect invalid JSON structure', async () => {
      const jsonContent = JSON.stringify('just a string');
      const buffer = Buffer.from(jsonContent, 'utf8');

      const errors = await processor.validateFile(buffer, mockMetadata);
      
      expect(errors.some(e => e.code === 'INVALID_JSON_STRUCTURE')).toBe(true);
    });

    test('should handle empty array', async () => {
      const jsonContent = JSON.stringify([]);
      const buffer = Buffer.from(jsonContent, 'utf8');

      const errors = await processor.validateFile(buffer, mockMetadata);
      
      expect(errors.some(e => e.code === 'NO_DATA_RECORDS')).toBe(true);
      expect(errors.find(e => e.code === 'NO_DATA_RECORDS')?.severity).toBe('warning');
    });

    test('should validate nested JSON path', async () => {
      const jsonContent = JSON.stringify({
        metadata: { count: 2 },
        devices: [
          { hostname: 'switch01', ipAddress: '192.168.1.1' },
          { hostname: 'router01', ipAddress: '192.168.1.2' }
        ]
      });
      const buffer = Buffer.from(jsonContent, 'utf8');

      const errors = await processor.validateFile(buffer, mockMetadata, { arrayPath: '$.devices' });
      
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0);
    });

    test('should detect invalid array path', async () => {
      const jsonContent = JSON.stringify({
        devices: [{ hostname: 'switch01', ipAddress: '192.168.1.1' }]
      });
      const buffer = Buffer.from(jsonContent, 'utf8');

      const errors = await processor.validateFile(buffer, mockMetadata, { arrayPath: '$.nonexistent' });
      
      expect(errors.some(e => e.code === 'INVALID_ARRAY_PATH')).toBe(true);
    });

    test('should perform schema validation on sample records', async () => {
      const jsonContent = JSON.stringify([
        { hostname: 'switch01', ipAddress: '999.999.999.999' }, // Invalid IP
        { hostname: 'router01', ipAddress: '192.168.1.2' }
      ]);
      const buffer = Buffer.from(jsonContent, 'utf8');

      const errors = await processor.validateFile(buffer, mockMetadata);
      
      expect(errors.some(e => e.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
    });

    test('should handle large JSON files', async () => {
      const devices = [];
      for (let i = 1; i <= 100; i++) {
        devices.push({
          hostname: `device${i.toString().padStart(3, '0')}`,
          ipAddress: `192.168.1.${i}`,
          deviceType: 'switch'
        });
      }
      const jsonContent = JSON.stringify(devices);
      const buffer = Buffer.from(jsonContent, 'utf8');

      const errors = await processor.validateFile(buffer, mockMetadata);
      
      expect(errors.filter(e => e.severity === 'error')).toHaveLength(0);
    });

    test('should warn about non-standard MIME type', async () => {
      const jsonContent = JSON.stringify([{ hostname: 'test', ipAddress: '192.168.1.1' }]);
      const buffer = Buffer.from(jsonContent, 'utf8');
      const textMetadata = { ...mockMetadata, mimetype: 'text/plain' };

      const errors = await processor.validateFile(buffer, textMetadata);
      
      // Should be warning, not error for JSON files
      expect(errors.some(e => e.code === 'INVALID_MIME_TYPE' && e.severity === 'warning')).toBe(true);
    });
  });

  describe('processFile', () => {
    test('should process valid JSON array successfully', async () => {
      const jsonData = [
        { hostname: 'switch01', ipAddress: '192.168.1.1', deviceType: 'switch', status: 'active' },
        { hostname: 'router01', ipAddress: '192.168.1.2', deviceType: 'router', status: 'active' }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

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

    test('should process single JSON object', async () => {
      const jsonData = { hostname: 'switch01', ipAddress: '192.168.1.1', deviceType: 'switch' };
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(1);
      expect(result.validRecords).toBe(1);
    });

    test('should handle JSON with nested array path', async () => {
      const jsonData = {
        metadata: { version: '1.0' },
        devices: [
          { hostname: 'switch01', ipAddress: '192.168.1.1' },
          { hostname: 'router01', ipAddress: '192.168.1.2' }
        ]
      };
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata, { arrayPath: '$.devices' });

      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(2);
      expect(result.validRecords).toBe(2);
    });

    test('should handle records with missing required fields', async () => {
      const jsonData = [
        { hostname: 'switch01', ipAddress: '192.168.1.1' },
        { hostname: 'router01' }, // Missing ipAddress
        { ipAddress: '192.168.1.3' } // Missing hostname
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.totalRecords).toBe(3);
      expect(result.validRecords).toBe(1);
      expect(result.invalidRecords).toBe(2);
      expect(result.summary.errors.some(e => e.code === 'REQUIRED_FIELD_MISSING')).toBe(true);
    });

    test('should handle records with invalid IP addresses', async () => {
      const jsonData = [
        { hostname: 'switch01', ipAddress: '999.999.999.999' },
        { hostname: 'router01', ipAddress: 'not-an-ip' },
        { hostname: 'switch02', ipAddress: '192.168.1.1' }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.validRecords).toBe(1);
      expect(result.invalidRecords).toBe(2);
      expect(result.summary.errors.some(e => e.code === 'INVALID_IP_ADDRESS')).toBe(true);
    });

    test('should handle records with invalid MAC addresses', async () => {
      const jsonData = [
        { hostname: 'switch01', ipAddress: '192.168.1.1', macAddress: 'invalid-mac' },
        { hostname: 'router01', ipAddress: '192.168.1.2', macAddress: '00:11:22:33:44:55' }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.validRecords).toBe(1);
      expect(result.invalidRecords).toBe(1);
      expect(result.summary.errors.some(e => e.code === 'INVALID_MAC_ADDRESS')).toBe(true);
    });

    test('should handle custom fields in JSON records', async () => {
      const jsonData = [
        {
          hostname: 'switch01',
          ipAddress: '192.168.1.1',
          customField1: 'value1',
          customField2: { nested: 'value' }
        }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      expect(device.customFields).toBeDefined();
      expect(device.customFields!['customField1']).toBe('value1');
      expect(device.customFields!['customField2']).toEqual({ nested: 'value' });
    });

    test('should handle JSON with tags array', async () => {
      const jsonData = [
        {
          hostname: 'switch01',
          ipAddress: '192.168.1.1',
          tags: ['production', 'critical', 'network']
        }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      expect(device.tags).toEqual(['production', 'critical', 'network']);
    });

    test('should handle JSON with date fields', async () => {
      const now = new Date();
      const jsonData = [
        {
          hostname: 'switch01',
          ipAddress: '192.168.1.1',
          lastSeen: now.toISOString()
        }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      expect(device.lastSeen).toEqual(now);
    });

    test('should respect maxRecords limit', async () => {
      const jsonData = [
        { hostname: 'switch01', ipAddress: '192.168.1.1' },
        { hostname: 'switch02', ipAddress: '192.168.1.2' },
        { hostname: 'switch03', ipAddress: '192.168.1.3' }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata, { maxRecords: 2 });

      expect(result.totalRecords).toBe(2);
      expect(result.summary.warnings.some(w => w.includes('Processing stopped at 2 records limit'))).toBe(true);
    });

    test('should handle strict schema validation mode', async () => {
      const jsonData = [
        { hostname: 'switch01', ipAddress: '192.168.1.1', invalidField: 'should cause error in strict mode' }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata, { strict: true });

      // In strict mode, schema violations should cause record to fail
      expect(result.invalidRecords).toBeGreaterThan(0);
    });

    test('should handle non-strict schema validation mode', async () => {
      const jsonData = [
        { hostname: 'switch01', ipAddress: '192.168.1.1', extraField: 'allowed in non-strict mode' }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata, { strict: false });

      // In non-strict mode, schema violations should be warnings only
      expect(result.validRecords).toBe(1);
    });

    test('should handle custom schema validation', async () => {
      const customSchema = {
        type: 'object',
        required: ['hostname', 'ipAddress', 'requiredCustomField'],
        properties: {
          hostname: { type: 'string' },
          ipAddress: { type: 'string', format: 'ipv4' },
          requiredCustomField: { type: 'string' }
        }
      };

      const jsonData = [
        { hostname: 'switch01', ipAddress: '192.168.1.1' } // Missing requiredCustomField
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata, { schema: customSchema, strict: true });

      expect(result.invalidRecords).toBe(1);
      expect(result.summary.errors.some(e => e.code === 'SCHEMA_VALIDATION_ERROR')).toBe(true);
    });

    test('should disable schema validation when requested', async () => {
      const jsonData = [
        { hostname: 'switch01', ipAddress: 'invalid-ip' } // Would normally fail schema validation
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata, { schema: false });

      // Should still fail basic validation but not schema validation
      expect(result.invalidRecords).toBe(1);
      expect(result.summary.errors.some(e => e.code === 'INVALID_IP_ADDRESS')).toBe(true);
      expect(result.summary.errors.some(e => e.code === 'SCHEMA_VALIDATION_ERROR')).toBe(false);
    });

    test('should handle empty JSON array', async () => {
      const buffer = Buffer.from('[]', 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      expect(result.totalRecords).toBe(0);
      expect(result.summary.warnings.some(w => w.includes('No data records found'))).toBe(true);
    });

    test('should handle malformed JSON gracefully', async () => {
      const buffer = Buffer.from('{ invalid json }', 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.summary.errors.some(e => e.code === 'PROCESSING_ERROR')).toBe(true);
    });
  });

  describe('createStream', () => {
    test('should create streaming processor for JSON array', (done) => {
      const jsonData = [
        { hostname: 'switch01', ipAddress: '192.168.1.1', deviceType: 'switch' },
        { hostname: 'router01', ipAddress: '192.168.1.2', deviceType: 'router' }
      ];
      const jsonContent = JSON.stringify(jsonData);
      const source = Readable.from([jsonContent]);

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
      const invalidJsonContent = '{ invalid json content }';
      const source = Readable.from([invalidJsonContent]);

      const stream = processor.createStream(source, mockMetadata);

      stream.on('error', (error) => {
        expect(error).toBeDefined();
        done();
      });

      stream.on('end', () => {
        done(new Error('Should have thrown an error'));
      });
    });

    test('should provide progress updates in streaming mode', (done) => {
      // Create JSON with more records to trigger progress updates
      const devices = [];
      for (let i = 1; i <= 2500; i++) {
        devices.push({
          hostname: `switch${i.toString().padStart(4, '0')}`,
          ipAddress: `192.168.${Math.floor(i/256)}.${i%256}`,
          deviceType: 'switch'
        });
      }

      const jsonContent = JSON.stringify(devices);
      const source = Readable.from([jsonContent]);
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

    test('should handle streaming with record limit', (done) => {
      const devices = [];
      for (let i = 1; i <= 100; i++) {
        devices.push({
          hostname: `switch${i}`,
          ipAddress: `192.168.1.${i}`,
          deviceType: 'switch'
        });
      }

      const jsonContent = JSON.stringify(devices);
      const source = Readable.from([jsonContent]);

      const stream = processor.createStream(source, mockMetadata, { maxRecords: 50 });

      const results: any[] = [];
      stream.on('data', (result) => {
        results.push(result);
      });

      stream.on('end', () => {
        expect(results.length).toBeLessThanOrEqual(50);
        done();
      });

      stream.on('error', done);
    });
  });

  describe('generateTemplate', () => {
    test('should generate JSON template with default fields', async () => {
      const fields = [
        { name: 'hostname', type: 'string' as const, required: true },
        { name: 'ipAddress', type: 'ip' as const, required: true },
        { name: 'deviceType', type: 'string' as const, required: false }
      ];

      const templateBuffer = await processor.generateTemplate(fields);
      const templateContent = JSON.parse(templateBuffer.toString('utf8'));

      expect(Array.isArray(templateContent)).toBe(true);
      expect(templateContent).toHaveLength(2);
      expect(templateContent[0]).toHaveProperty('hostname');
      expect(templateContent[0]).toHaveProperty('ipAddress');
      expect(templateContent[0]).toHaveProperty('deviceType');
    });

    test('should generate template with custom examples', async () => {
      const fields = [
        { name: 'hostname', type: 'string' as const, required: true, example: 'my-switch' },
        { name: 'ipAddress', type: 'ip' as const, required: true, example: '10.0.0.1' }
      ];

      const templateBuffer = await processor.generateTemplate(fields);
      const templateContent = JSON.parse(templateBuffer.toString('utf8'));

      expect(templateContent[0].hostname).toBe('my-switch');
      expect(templateContent[0].ipAddress).toBe('10.0.0.1');
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
      const templateContent = JSON.parse(templateBuffer.toString('utf8'));

      expect(typeof templateContent[0].port).toBe('number');
      expect(typeof templateContent[0].active).toBe('boolean');
      expect(templateContent[0].email).toContain('@');
      expect(templateContent[0].macAddress).toBe('00:11:22:33:44:55');
    });

    test('should generate valid JSON structure', async () => {
      const fields = [
        { name: 'hostname', type: 'string' as const, required: true },
        { name: 'ipAddress', type: 'ip' as const, required: true }
      ];

      const templateBuffer = await processor.generateTemplate(fields);
      const templateString = templateBuffer.toString('utf8');

      // Should be valid JSON
      expect(() => JSON.parse(templateString)).not.toThrow();
      
      // Should be properly formatted
      expect(templateString).toContain('[\n');
      expect(templateString).toContain('  {');
    });
  });

  describe('detectEncoding', () => {
    test('should detect UTF-8 encoding for JSON', async () => {
      const jsonContent = JSON.stringify({ hostname: 'test', ipAddress: '192.168.1.1' });
      const buffer = Buffer.from(jsonContent, 'utf8');

      const encoding = await processor.detectEncoding(buffer);

      expect(encoding).toBe('utf8');
    });

    test('should handle JSON with Unicode characters', async () => {
      const jsonContent = JSON.stringify({ hostname: 'tést', ipAddress: '192.168.1.1', description: 'Test with émojis 😀' });
      const buffer = Buffer.from(jsonContent, 'utf8');

      const encoding = await processor.detectEncoding(buffer);

      expect(encoding).toBe('utf8');
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle deeply nested JSON objects', async () => {
      const jsonData = [
        {
          hostname: 'switch01',
          ipAddress: '192.168.1.1',
          metadata: {
            location: {
              building: 'A',
              floor: 1,
              room: '101'
            }
          }
        }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      expect(device.customFields?.metadata).toEqual({
        location: {
          building: 'A',
          floor: 1,
          room: '101'
        }
      });
    });

    test('should handle JSON with null values', async () => {
      const jsonData = [
        {
          hostname: 'switch01',
          ipAddress: '192.168.1.1',
          description: null,
          tags: null
        }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      expect(device.description).toBeUndefined();
      expect(device.tags).toBeUndefined();
    });

    test('should handle JSON with mixed data types', async () => {
      const jsonData = [
        {
          hostname: 'switch01',
          ipAddress: '192.168.1.1',
          port: '22', // String that should be converted to number if needed
          active: 'true', // String boolean
          priority: 1.5 // Float number
        }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      expect(device.customFields?.port).toBe('22');
      expect(device.customFields?.active).toBe('true');
      expect(device.customFields?.priority).toBe(1.5);
    });

    test('should handle very large JSON records', async () => {
      const largeDescription = 'x'.repeat(100000);
      const jsonData = [
        {
          hostname: 'switch01',
          ipAddress: '192.168.1.1',
          description: largeDescription
        }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      expect(device.description).toBe(largeDescription);
    });

    test('should handle JSON with empty string values', async () => {
      const jsonData = [
        {
          hostname: 'switch01',
          ipAddress: '192.168.1.1',
          description: '',
          location: '   ', // Whitespace only
          model: null
        }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      expect(device.description).toBeUndefined();
      expect(device.location).toBeUndefined();
      expect(device.model).toBeUndefined();
    });

    test('should handle JSON with array fields containing mixed types', async () => {
      const jsonData = [
        {
          hostname: 'switch01',
          ipAddress: '192.168.1.1',
          tags: ['string', 123, true, null, ''] // Mixed array
        }
      ];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(true);
      const device = result.results[0].data as NetworkDevice;
      // Should filter out non-string or empty values
      expect(device.tags).toEqual(['string']);
    });

    test('should handle processing errors gracefully', async () => {
      const jsonData = [{ hostname: 'switch01', ipAddress: '192.168.1.1' }];
      const buffer = Buffer.from(JSON.stringify(jsonData), 'utf8');

      // Mock the processRecord method to throw an error
      const originalProcessRecord = (processor as any).processRecord;
      (processor as any).processRecord = jest.fn().mockImplementation(() => {
        throw new Error('Processing error');
      });

      const result = await processor.processFile(buffer, mockMetadata);

      expect(result.success).toBe(false);
      expect(result.summary.errors.some(e => e.code === 'PROCESSING_ERROR')).toBe(true);

      // Restore original method
      (processor as any).processRecord = originalProcessRecord;
    });
  });
});