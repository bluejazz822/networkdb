/**
 * JSON File Processor for Network CMDB Import/Export Engine
 * Supports JSON schema validation and streaming for large files
 */

import { Readable, Transform } from 'stream';
import * as StreamValues from 'stream-json/streamers/StreamValues';
import * as StreamArray from 'stream-json/streamers/StreamArray';
import * as parser from 'stream-json';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  FileProcessor,
  FileFormat,
  FileMetadata,
  FileProcessingOptions,
  JsonOptions,
  BatchProcessingResult,
  ProcessingResult,
  ValidationError,
  StreamingStats,
  ProgressCallback,
  FieldDefinition,
  ProcessingStats,
  NetworkData,
  NetworkDevice
} from './types';
import { BaseFileProcessor } from './base-processor';

export class JsonProcessor extends BaseFileProcessor implements FileProcessor<NetworkData> {
  readonly format = FileFormat.JSON;
  
  private ajv: Ajv;
  private defaultJsonOptions: JsonOptions = {
    arrayPath: '$', // Root array by default
    schema: undefined,
    strict: false
  };

  // Default JSON schema for network devices
  private defaultNetworkDeviceSchema = {
    type: 'object',
    required: ['hostname', 'ipAddress'],
    properties: {
      hostname: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
        pattern: '^[a-zA-Z0-9][a-zA-Z0-9\\-\\.]*[a-zA-Z0-9]$'
      },
      ipAddress: {
        type: 'string',
        format: 'ipv4'
      },
      macAddress: {
        type: 'string',
        pattern: '^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$'
      },
      deviceType: {
        type: 'string',
        enum: ['switch', 'router', 'firewall', 'server', 'workstation', 'printer', 'other']
      },
      manufacturer: {
        type: 'string',
        maxLength: 100
      },
      model: {
        type: 'string',
        maxLength: 100
      },
      serialNumber: {
        type: 'string',
        maxLength: 100
      },
      location: {
        type: 'string',
        maxLength: 255
      },
      description: {
        type: 'string',
        maxLength: 500
      },
      operatingSystem: {
        type: 'string',
        maxLength: 100
      },
      firmwareVersion: {
        type: 'string',
        maxLength: 50
      },
      managementIP: {
        type: 'string',
        format: 'ipv4'
      },
      snmpCommunity: {
        type: 'string',
        maxLength: 50
      },
      status: {
        type: 'string',
        enum: ['active', 'inactive', 'maintenance', 'decommissioned']
      },
      lastSeen: {
        type: 'string',
        format: 'date-time'
      },
      tags: {
        type: 'array',
        items: {
          type: 'string',
          minLength: 1
        }
      },
      customFields: {
        type: 'object',
        additionalProperties: true
      }
    },
    additionalProperties: false
  };

  constructor() {
    super();
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: false
    });
    addFormats(this.ajv);
  }

  /**
   * Validate JSON file before processing
   */
  async validateFile(
    buffer: Buffer,
    metadata: FileMetadata,
    options?: FileProcessingOptions
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    // Basic file validation
    const baseErrors = await super.validateFile(buffer, metadata, options);
    errors.push(...baseErrors);

    // JSON-specific validation
    if (!this.isValidJsonMimeType(metadata.mimetype)) {
      errors.push({
        field: 'file',
        value: metadata.mimetype,
        message: `Invalid MIME type for JSON file: ${metadata.mimetype}`,
        code: 'INVALID_MIME_TYPE',
        severity: 'warning' // JSON files often have generic MIME types
      });
    }

    // Try to parse JSON to validate structure
    try {
      const encoding = await this.detectEncoding(buffer);
      const content = buffer.toString(encoding);
      
      if (!content.trim()) {
        errors.push({
          field: 'file',
          value: 'empty',
          message: 'JSON file is empty',
          code: 'EMPTY_FILE',
          severity: 'error'
        });
        return errors;
      }

      const jsonData = JSON.parse(content);
      const jsonOptions = { ...this.defaultJsonOptions, ...options };

      // Check if data is in expected format
      let dataArray: any[];
      
      if (jsonOptions.arrayPath === '$') {
        // Root level data
        if (Array.isArray(jsonData)) {
          dataArray = jsonData;
        } else if (typeof jsonData === 'object' && jsonData !== null) {
          // Single object - wrap in array
          dataArray = [jsonData];
        } else {
          errors.push({
            field: 'structure',
            value: typeof jsonData,
            message: 'JSON data must be an array or object',
            code: 'INVALID_JSON_STRUCTURE',
            severity: 'error'
          });
          return errors;
        }
      } else {
        // Extract data using arrayPath (basic JSONPath support)
        dataArray = this.extractArrayFromPath(jsonData, jsonOptions.arrayPath);
        if (!dataArray || !Array.isArray(dataArray)) {
          errors.push({
            field: 'arrayPath',
            value: jsonOptions.arrayPath,
            message: `Data at path '${jsonOptions.arrayPath}' is not an array`,
            code: 'INVALID_ARRAY_PATH',
            severity: 'error'
          });
          return errors;
        }
      }

      if (dataArray.length === 0) {
        errors.push({
          field: 'data',
          value: 'empty array',
          message: 'No data records found in JSON file',
          code: 'NO_DATA_RECORDS',
          severity: 'warning'
        });
      }

      // Validate schema if provided
      const schema = jsonOptions.schema || this.defaultNetworkDeviceSchema;
      const validate = this.ajv.compile(schema);
      
      // Validate a sample of records (first 10)
      const sampleSize = Math.min(dataArray.length, 10);
      for (let i = 0; i < sampleSize; i++) {
        const record = dataArray[i];
        const valid = validate(record);
        
        if (!valid && validate.errors) {
          for (const error of validate.errors) {
            errors.push({
              field: error.instancePath || 'record',
              value: error.data,
              message: `Sample record ${i + 1}: ${error.message}`,
              code: 'SCHEMA_VALIDATION_ERROR',
              severity: 'warning'
            });
          }
        }
      }

    } catch (error) {
      if (error instanceof SyntaxError) {
        errors.push({
          field: 'file',
          value: error.message,
          message: `Invalid JSON syntax: ${error.message}`,
          code: 'INVALID_JSON_SYNTAX',
          severity: 'error'
        });
      } else {
        errors.push({
          field: 'file',
          value: error,
          message: `Failed to validate JSON structure: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'VALIDATION_ERROR',
          severity: 'error'
        });
      }
    }

    return errors;
  }

  /**
   * Process entire JSON file at once (memory intensive)
   */
  async processFile(
    buffer: Buffer,
    metadata: FileMetadata,
    options?: FileProcessingOptions
  ): Promise<BatchProcessingResult<NetworkData>> {
    const startTime = Date.now();
    const results: ProcessingResult<NetworkData>[] = [];
    let totalRecords = 0;
    let validRecords = 0;
    let invalidRecords = 0;

    try {
      const encoding = await this.detectEncoding(buffer);
      const content = buffer.toString(encoding);
      const jsonData = JSON.parse(content);
      const jsonOptions = { ...this.defaultJsonOptions, ...options };
      
      // Extract data array
      let dataArray: any[];
      if (jsonOptions.arrayPath === '$') {
        if (Array.isArray(jsonData)) {
          dataArray = jsonData;
        } else {
          dataArray = [jsonData];
        }
      } else {
        dataArray = this.extractArrayFromPath(jsonData, jsonOptions.arrayPath);
      }

      const errors: ValidationError[] = [];
      const warnings: string[] = [];

      // Set up schema validation if enabled
      let validate: Ajv.ValidateFunction | undefined;
      if (jsonOptions.schema !== false) { // Allow disabling schema validation
        const schema = jsonOptions.schema || this.defaultNetworkDeviceSchema;
        validate = this.ajv.compile(schema);
      }

      // Process each record
      for (let i = 0; i < dataArray.length; i++) {
        totalRecords++;
        const record = dataArray[i];
        const rowNumber = i + 1;
        
        const result = this.processRecord(record, rowNumber, validate, jsonOptions.strict);
        results.push(result);
        
        if (result.success) {
          validRecords++;
        } else {
          invalidRecords++;
          if (result.errors) {
            errors.push(...result.errors);
          }
        }

        // Check limits
        if (options?.maxRecords && totalRecords >= options.maxRecords) {
          warnings.push(`Processing stopped at ${options.maxRecords} records limit`);
          break;
        }
      }

      const processingTimeMs = Date.now() - startTime;
      this.updateStats(totalRecords, processingTimeMs);

      return {
        success: errors.filter(e => e.severity === 'error').length === 0,
        totalRecords,
        processedRecords: totalRecords,
        validRecords,
        invalidRecords,
        results,
        summary: {
          errors,
          warnings,
          processingTimeMs,
          memoryUsedMB: process.memoryUsage().heapUsed / 1024 / 1024
        }
      };

    } catch (error) {
      return {
        success: false,
        totalRecords: 0,
        processedRecords: 0,
        validRecords: 0,
        invalidRecords: 0,
        results: [],
        summary: {
          errors: [{
            field: 'file',
            value: error,
            message: `Failed to process JSON file: ${error instanceof Error ? error.message : 'Unknown error'}`,
            code: 'PROCESSING_ERROR',
            severity: 'error'
          }],
          warnings: [],
          processingTimeMs: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Create streaming processor for large JSON files
   */
  createStream(
    source: Readable,
    metadata: FileMetadata,
    options?: FileProcessingOptions,
    onProgress?: ProgressCallback
  ): Transform {
    const jsonOptions = { ...this.defaultJsonOptions, ...options };
    let recordsProcessed = 0;
    let recordsValid = 0;
    let recordsInvalid = 0;
    const startTime = Date.now();

    // Set up schema validation
    let validate: Ajv.ValidateFunction | undefined;
    if (jsonOptions.schema !== false) {
      const schema = jsonOptions.schema || this.defaultNetworkDeviceSchema;
      validate = this.ajv.compile(schema);
    }

    // Create JSON streaming parser
    const pipeline = source
      .pipe(parser())
      .pipe(StreamArray.withParser());

    const processor = new Transform({
      objectMode: true,
      transform: (chunk: any, encoding, callback) => {
        recordsProcessed++;
        const rowNumber = recordsProcessed;

        // Extract the actual data (StreamArray provides { key, value })
        const record = chunk.value || chunk;

        const result = this.processRecord(record, rowNumber, validate, jsonOptions.strict);

        if (result.success) {
          recordsValid++;
        } else {
          recordsInvalid++;
        }

        // Emit progress updates
        if (onProgress && recordsProcessed % 1000 === 0) {
          const currentTime = Date.now();
          const elapsedMs = currentTime - startTime;
          const processingRate = recordsProcessed / (elapsedMs / 1000);

          onProgress({
            recordsProcessed,
            recordsValid,
            recordsInvalid,
            currentMemoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
            processingRatePerSecond: processingRate
          });
        }

        // Check limits
        if (options?.maxRecords && recordsProcessed >= options.maxRecords) {
          this.push(result);
          callback();
          return;
        }

        callback(null, result);
      },

      flush: (callback) => {
        // Final progress update
        if (onProgress) {
          const currentTime = Date.now();
          const elapsedMs = currentTime - startTime;
          const processingRate = recordsProcessed / (elapsedMs / 1000);
          
          onProgress({
            recordsProcessed,
            recordsValid,
            recordsInvalid,
            currentMemoryUsageMB: process.memoryUsage().heapUsed / 1024 / 1024,
            processingRatePerSecond: processingRate
          });
        }
        
        this.updateStats(recordsProcessed, Date.now() - startTime);
        callback();
      }
    });

    return pipeline.pipe(processor);
  }

  /**
   * Generate JSON template file
   */
  async generateTemplate(
    fields: FieldDefinition[],
    options?: FileProcessingOptions
  ): Promise<Buffer> {
    // Create example record based on field definitions
    const exampleRecord: any = {};
    
    for (const field of fields) {
      if (field.example !== undefined) {
        exampleRecord[field.name] = field.example;
      } else {
        // Generate example based on field type
        switch (field.type) {
          case 'string':
            if (field.name === 'hostname') {
              exampleRecord[field.name] = 'example-host';
            } else if (field.name === 'ipAddress') {
              exampleRecord[field.name] = '192.168.1.1';
            } else if (field.name === 'macAddress') {
              exampleRecord[field.name] = '00:11:22:33:44:55';
            } else {
              exampleRecord[field.name] = 'example-value';
            }
            break;
          case 'number':
            exampleRecord[field.name] = field.validation?.min || 1;
            break;
          case 'boolean':
            exampleRecord[field.name] = true;
            break;
          case 'date':
            exampleRecord[field.name] = new Date().toISOString();
            break;
          case 'email':
            exampleRecord[field.name] = 'admin@example.com';
            break;
          case 'ip':
            exampleRecord[field.name] = '192.168.1.1';
            break;
          case 'mac':
            exampleRecord[field.name] = '00:11:22:33:44:55';
            break;
          default:
            exampleRecord[field.name] = 'example';
        }
      }
    }

    // Create template with multiple example records
    const template = [
      exampleRecord,
      { ...exampleRecord, hostname: 'example-host-2', ipAddress: '192.168.1.2' }
    ];

    const jsonContent = JSON.stringify(template, null, 2);
    return Buffer.from(jsonContent, 'utf8');
  }

  /**
   * Process individual JSON record
   */
  private processRecord(
    record: any,
    rowNumber: number,
    validate?: Ajv.ValidateFunction,
    strict = false
  ): ProcessingResult<NetworkData> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Schema validation if provided
      if (validate) {
        const valid = validate(record);
        if (!valid && validate.errors) {
          for (const error of validate.errors) {
            const severity = strict ? 'error' : 'warning';
            errors.push({
              field: error.instancePath || 'record',
              value: error.data,
              message: error.message || 'Schema validation failed',
              code: 'SCHEMA_VALIDATION_ERROR',
              severity
            });
          }
        }
      }

      // Basic field validation
      if (!this.isNonEmptyString(record.hostname)) {
        errors.push(this.createValidationError(
          'hostname',
          record.hostname,
          'Hostname is required',
          'REQUIRED_FIELD_MISSING'
        ));
      }

      if (!this.isNonEmptyString(record.ipAddress) || !this.isValidIP(record.ipAddress)) {
        errors.push(this.createValidationError(
          'ipAddress',
          record.ipAddress,
          'Valid IP address is required',
          'INVALID_IP_ADDRESS'
        ));
      }

      // MAC address validation (optional)
      if (record.macAddress && !this.isValidMAC(record.macAddress)) {
        errors.push(this.createValidationError(
          'macAddress',
          record.macAddress,
          'Invalid MAC address format',
          'INVALID_MAC_ADDRESS'
        ));
      }

      // Device type validation
      const validDeviceTypes = ['switch', 'router', 'firewall', 'server', 'workstation', 'printer', 'other'];
      if (record.deviceType && !validDeviceTypes.includes(record.deviceType)) {
        warnings.push(`Unknown device type: ${record.deviceType}`);
        record.deviceType = 'other';
      }

      // Status validation
      const validStatuses = ['active', 'inactive', 'maintenance', 'decommissioned'];
      if (record.status && !validStatuses.includes(record.status)) {
        warnings.push(`Invalid status: ${record.status}, defaulting to 'active'`);
        record.status = 'active';
      }

      // If strict mode and there are schema errors, fail
      if (strict && errors.filter(e => e.severity === 'error').length > 0) {
        return {
          success: false,
          errors,
          warnings,
          rowNumber,
          rawData: record
        };
      }

      // Transform to NetworkDevice format
      const networkDevice: NetworkDevice = {
        hostname: this.safeString(record.hostname)!,
        ipAddress: this.safeString(record.ipAddress)!,
        macAddress: this.safeString(record.macAddress),
        deviceType: (this.safeString(record.deviceType) || 'other') as NetworkDevice['deviceType'],
        manufacturer: this.safeString(record.manufacturer),
        model: this.safeString(record.model),
        serialNumber: this.safeString(record.serialNumber),
        location: this.safeString(record.location),
        description: this.safeString(record.description),
        operatingSystem: this.safeString(record.operatingSystem),
        firmwareVersion: this.safeString(record.firmwareVersion),
        managementIP: this.safeString(record.managementIP),
        snmpCommunity: this.safeString(record.snmpCommunity),
        status: (this.safeString(record.status) || 'active') as NetworkDevice['status'],
        lastSeen: this.safeDate(record.lastSeen),
        tags: Array.isArray(record.tags) ? record.tags.filter(tag => this.isNonEmptyString(tag)) : undefined,
        customFields: this.parseCustomFields(record)
      };

      return {
        success: true,
        data: networkDevice,
        warnings: warnings.length > 0 ? warnings : undefined,
        rowNumber,
        rawData: record
      };

    } catch (error) {
      return {
        success: false,
        errors: [this.createValidationError(
          'record',
          record,
          `Record processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'RECORD_PROCESSING_ERROR'
        )],
        rowNumber,
        rawData: record
      };
    }
  }

  /**
   * Extract array from JSONPath (basic support)
   */
  private extractArrayFromPath(data: any, path: string): any[] | null {
    if (path === '$') return data;
    
    const parts = path.replace(/^\$\./, '').split('.');
    let current = data;
    
    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return null;
      }
    }
    
    return Array.isArray(current) ? current : null;
  }

  /**
   * Check if MIME type is valid for JSON
   */
  private isValidJsonMimeType(mimeType: string): boolean {
    const validMimeTypes = [
      'application/json',
      'text/json',
      'application/x-json',
      'text/plain' // JSON files are sometimes served as plain text
    ];
    return validMimeTypes.includes(mimeType);
  }

  /**
   * Validate IP address format
   */
  private isValidIP(ip: string): boolean {
    const ipv4Regex = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    const match = ip.match(ipv4Regex);
    if (!match) return false;
    
    return match.slice(1).every(octet => {
      const num = parseInt(octet, 10);
      return num >= 0 && num <= 255;
    });
  }

  /**
   * Validate MAC address format
   */
  private isValidMAC(mac: string): boolean {
    const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
    return macRegex.test(mac);
  }

  /**
   * Parse custom fields from record (fields not in standard schema)
   */
  private parseCustomFields(record: any): Record<string, any> | undefined {
    const standardFields = [
      'hostname', 'ipAddress', 'macAddress', 'deviceType', 'manufacturer', 
      'model', 'serialNumber', 'location', 'description', 'operatingSystem',
      'firmwareVersion', 'managementIP', 'snmpCommunity', 'status', 'lastSeen',
      'tags', 'createdAt', 'updatedAt'
    ];
    
    const customFields: Record<string, any> = {};
    let hasCustomFields = false;

    for (const [key, value] of Object.entries(record)) {
      if (!standardFields.includes(key) && value !== null && value !== undefined && value !== '') {
        customFields[key] = value;
        hasCustomFields = true;
      }
    }

    return hasCustomFields ? customFields : undefined;
  }
}