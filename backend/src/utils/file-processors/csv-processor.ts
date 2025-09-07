/**
 * CSV File Processor for Network CMDB Import/Export Engine
 * Supports streaming processing for large files (100K+ records)
 */

import { Readable, Transform } from 'stream';
import * as csv from 'csv-parser';
import * as csvStringify from 'csv-stringify/sync';
import { detect } from 'jschardet';
import {
  FileProcessor,
  FileFormat,
  FileMetadata,
  FileProcessingOptions,
  CsvOptions,
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

export class CsvProcessor extends BaseFileProcessor implements FileProcessor<NetworkData> {
  readonly format = FileFormat.CSV;
  
  private defaultCsvOptions: CsvOptions = {
    delimiter: ',',
    quote: '"',
    escape: '"',
    headers: true,
    skipEmptyLines: true,
    skipLinesWithError: false
  };

  /**
   * Validate CSV file before processing
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

    // CSV-specific validation
    if (!this.isValidCsvMimeType(metadata.mimetype)) {
      errors.push({
        field: 'file',
        value: metadata.mimetype,
        message: `Invalid MIME type for CSV file: ${metadata.mimetype}`,
        code: 'INVALID_MIME_TYPE',
        severity: 'error'
      });
    }

    // Try to parse a sample to validate structure
    try {
      const encoding = await this.detectEncoding(buffer);
      const content = buffer.toString(encoding);
      const lines = content.split('\n').slice(0, 5); // Check first 5 lines
      
      if (lines.length === 0) {
        errors.push({
          field: 'file',
          value: 'empty',
          message: 'CSV file is empty',
          code: 'EMPTY_FILE',
          severity: 'error'
        });
        return errors;
      }

      // Validate delimiter consistency
      const csvOptions = { ...this.defaultCsvOptions, ...options };
      const delimiter = csvOptions.delimiter || ',';
      const headerLine = lines[0];
      const headerColumnCount = this.countColumns(headerLine, delimiter);
      
      if (headerColumnCount === 0) {
        errors.push({
          field: 'headers',
          value: headerLine,
          message: 'No columns detected in CSV header',
          code: 'NO_COLUMNS',
          severity: 'error'
        });
      }

      // Check consistency across data rows
      for (let i = 1; i < lines.length && lines[i].trim(); i++) {
        const columnCount = this.countColumns(lines[i], delimiter);
        if (columnCount !== headerColumnCount) {
          errors.push({
            field: 'structure',
            value: `Line ${i + 1}`,
            message: `Inconsistent column count: expected ${headerColumnCount}, got ${columnCount}`,
            code: 'INCONSISTENT_COLUMNS',
            severity: 'warning'
          });
        }
      }

    } catch (error) {
      errors.push({
        field: 'file',
        value: error,
        message: `Failed to validate CSV structure: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'VALIDATION_ERROR',
        severity: 'error'
      });
    }

    return errors;
  }

  /**
   * Process entire CSV file at once (memory intensive)
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
      const csvOptions = { ...this.defaultCsvOptions, ...options };
      
      return new Promise((resolve, reject) => {
        const errors: ValidationError[] = [];
        const warnings: string[] = [];
        let rowNumber = 0;

        const stream = Readable.from([content])
          .pipe(csv({
            separator: csvOptions.delimiter,
            quote: csvOptions.quote,
            escape: csvOptions.escape,
            headers: csvOptions.headers,
            skipEmptyLines: csvOptions.skipEmptyLines,
            skipLinesWithError: csvOptions.skipLinesWithError
          }));

        stream.on('data', (row: any) => {
          rowNumber++;
          totalRecords++;
          
          const result = this.processRow(row, rowNumber);
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
            stream.destroy();
          }
        });

        stream.on('end', () => {
          const processingTimeMs = Date.now() - startTime;
          this.updateStats(totalRecords, processingTimeMs);

          resolve({
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
          });
        });

        stream.on('error', (error) => {
          reject(new Error(`CSV parsing failed: ${error.message}`));
        });
      });

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
            message: `Failed to process CSV: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
   * Create streaming processor for large CSV files
   */
  createStream(
    source: Readable,
    metadata: FileMetadata,
    options?: FileProcessingOptions,
    onProgress?: ProgressCallback
  ): Transform {
    const csvOptions = { ...this.defaultCsvOptions, ...options };
    let rowNumber = 0;
    let recordsProcessed = 0;
    let recordsValid = 0;
    let recordsInvalid = 0;
    const startTime = Date.now();

    const csvParser = csv({
      separator: csvOptions.delimiter,
      quote: csvOptions.quote,
      escape: csvOptions.escape,
      headers: csvOptions.headers,
      skipEmptyLines: csvOptions.skipEmptyLines,
      skipLinesWithError: csvOptions.skipLinesWithError
    });

    const processor = new Transform({
      objectMode: true,
      transform(chunk: any, encoding, callback) {
        rowNumber++;
        recordsProcessed++;

        const result = this.processRow(chunk, rowNumber);
        
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

        callback(null, result);
      }.bind(this),
      
      flush: function(callback) {
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
      }.bind(this)
    });

    return source.pipe(csvParser).pipe(processor);
  }

  /**
   * Generate CSV template file
   */
  async generateTemplate(
    fields: FieldDefinition[],
    options?: FileProcessingOptions
  ): Promise<Buffer> {
    const csvOptions = { ...this.defaultCsvOptions, ...options };
    
    // Create header row
    const headers = fields.map(field => field.name);
    
    // Create example data row
    const exampleRow = fields.map(field => {
      if (field.example !== undefined) {
        return field.example;
      }
      
      // Generate example based on field type
      switch (field.type) {
        case 'string':
          return field.name === 'hostname' ? 'example-host' : 'example-value';
        case 'number':
          return field.validation?.min || 1;
        case 'boolean':
          return 'true';
        case 'date':
          return new Date().toISOString().split('T')[0];
        case 'email':
          return 'admin@example.com';
        case 'ip':
          return '192.168.1.1';
        case 'mac':
          return '00:11:22:33:44:55';
        default:
          return 'example';
      }
    });

    const csvData = [headers, exampleRow];
    const csvContent = csvStringify.stringify(csvData, {
      delimiter: csvOptions.delimiter,
      quote: csvOptions.quote,
      escape: csvOptions.escape,
      header: false // We're providing our own headers
    });

    return Buffer.from(csvContent, 'utf8');
  }

  /**
   * Process individual CSV row
   */
  private processRow(row: any, rowNumber: number): ProcessingResult<NetworkData> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Basic validation - check for required fields
      if (!row.hostname || typeof row.hostname !== 'string' || !row.hostname.trim()) {
        errors.push({
          field: 'hostname',
          value: row.hostname,
          message: 'Hostname is required',
          code: 'REQUIRED_FIELD_MISSING',
          severity: 'error'
        });
      }

      if (!row.ipAddress || typeof row.ipAddress !== 'string' || !this.isValidIP(row.ipAddress)) {
        errors.push({
          field: 'ipAddress',
          value: row.ipAddress,
          message: 'Valid IP address is required',
          code: 'INVALID_IP_ADDRESS',
          severity: 'error'
        });
      }

      // MAC address validation (optional field)
      if (row.macAddress && !this.isValidMAC(row.macAddress)) {
        errors.push({
          field: 'macAddress',
          value: row.macAddress,
          message: 'Invalid MAC address format',
          code: 'INVALID_MAC_ADDRESS',
          severity: 'error'
        });
      }

      // Device type validation
      const validDeviceTypes = ['switch', 'router', 'firewall', 'server', 'workstation', 'printer', 'other'];
      if (row.deviceType && !validDeviceTypes.includes(row.deviceType.toLowerCase())) {
        warnings.push(`Unknown device type: ${row.deviceType}`);
        row.deviceType = 'other';
      }

      // Status validation
      const validStatuses = ['active', 'inactive', 'maintenance', 'decommissioned'];
      if (!row.status || !validStatuses.includes(row.status.toLowerCase())) {
        warnings.push(`Invalid status: ${row.status}, defaulting to 'active'`);
        row.status = 'active';
      }

      // If there are validation errors, return failed result
      if (errors.filter(e => e.severity === 'error').length > 0) {
        return {
          success: false,
          errors,
          warnings,
          rowNumber,
          rawData: row
        };
      }

      // Transform row data to NetworkDevice format
      const networkDevice: NetworkDevice = {
        hostname: row.hostname.trim(),
        ipAddress: row.ipAddress.trim(),
        macAddress: row.macAddress?.trim() || undefined,
        deviceType: (row.deviceType?.toLowerCase() || 'other') as NetworkDevice['deviceType'],
        manufacturer: row.manufacturer?.trim() || undefined,
        model: row.model?.trim() || undefined,
        serialNumber: row.serialNumber?.trim() || undefined,
        location: row.location?.trim() || undefined,
        description: row.description?.trim() || undefined,
        operatingSystem: row.operatingSystem?.trim() || undefined,
        firmwareVersion: row.firmwareVersion?.trim() || undefined,
        managementIP: row.managementIP?.trim() || undefined,
        snmpCommunity: row.snmpCommunity?.trim() || undefined,
        status: row.status.toLowerCase() as NetworkDevice['status'],
        tags: row.tags ? this.parseTags(row.tags) : undefined,
        customFields: this.parseCustomFields(row)
      };

      return {
        success: true,
        data: networkDevice,
        warnings: warnings.length > 0 ? warnings : undefined,
        rowNumber,
        rawData: row
      };

    } catch (error) {
      return {
        success: false,
        errors: [{
          field: 'row',
          value: row,
          message: `Row processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'ROW_PROCESSING_ERROR',
          severity: 'error'
        }],
        rowNumber,
        rawData: row
      };
    }
  }

  /**
   * Count columns in a CSV line considering quotes and escapes
   */
  private countColumns(line: string, delimiter: string): number {
    let count = 1;
    let inQuotes = false;
    let prevChar = '';

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && prevChar !== '\\') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        count++;
      }
      
      prevChar = char;
    }

    return count;
  }

  /**
   * Check if MIME type is valid for CSV
   */
  private isValidCsvMimeType(mimeType: string): boolean {
    const validMimeTypes = [
      'text/csv',
      'application/csv',
      'text/plain',
      'application/vnd.ms-excel' // Sometimes CSV files have this MIME type
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
   * Parse tags from string (comma-separated or JSON array)
   */
  private parseTags(tagsStr: string): string[] | undefined {
    if (!tagsStr || !tagsStr.trim()) return undefined;
    
    try {
      // Try parsing as JSON array first
      const parsed = JSON.parse(tagsStr);
      if (Array.isArray(parsed)) {
        return parsed.map(tag => String(tag).trim()).filter(tag => tag.length > 0);
      }
    } catch {
      // Fall back to comma-separated parsing
      return tagsStr.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }
    
    return undefined;
  }

  /**
   * Parse custom fields from row (fields not in standard schema)
   */
  private parseCustomFields(row: any): Record<string, any> | undefined {
    const standardFields = [
      'hostname', 'ipAddress', 'macAddress', 'deviceType', 'manufacturer', 
      'model', 'serialNumber', 'location', 'description', 'operatingSystem',
      'firmwareVersion', 'managementIP', 'snmpCommunity', 'status', 'tags'
    ];
    
    const customFields: Record<string, any> = {};
    let hasCustomFields = false;

    for (const [key, value] of Object.entries(row)) {
      if (!standardFields.includes(key) && value !== null && value !== undefined && value !== '') {
        customFields[key] = value;
        hasCustomFields = true;
      }
    }

    return hasCustomFields ? customFields : undefined;
  }
}