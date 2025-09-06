/**
 * Excel File Processor for Network CMDB Import/Export Engine
 * Supports both .xlsx and .xls formats with streaming for large files
 */

import { Readable, Transform } from 'stream';
import * as XLSX from 'xlsx';
import {
  FileProcessor,
  FileFormat,
  FileMetadata,
  FileProcessingOptions,
  ExcelOptions,
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

export class ExcelProcessor extends BaseFileProcessor implements FileProcessor<NetworkData> {
  readonly format = FileFormat.EXCEL;
  
  private defaultExcelOptions: ExcelOptions = {
    sheetIndex: 0,
    headerRow: 1,
    sheetName: undefined,
    range: undefined
  };

  /**
   * Validate Excel file before processing
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

    // Excel-specific validation
    if (!this.isValidExcelMimeType(metadata.mimetype)) {
      errors.push({
        field: 'file',
        value: metadata.mimetype,
        message: `Invalid MIME type for Excel file: ${metadata.mimetype}`,
        code: 'INVALID_MIME_TYPE',
        severity: 'error'
      });
    }

    // Try to read the workbook to validate structure
    try {
      const workbook = XLSX.read(buffer, { 
        type: 'buffer',
        cellDates: true,
        cellNF: false,
        cellText: false
      });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        errors.push({
          field: 'file',
          value: 'no sheets',
          message: 'Excel file contains no worksheets',
          code: 'NO_WORKSHEETS',
          severity: 'error'
        });
        return errors;
      }

      const excelOptions = { ...this.defaultExcelOptions, ...options };
      let targetSheetName: string;

      // Validate sheet selection
      if (excelOptions.sheetName) {
        if (!workbook.SheetNames.includes(excelOptions.sheetName)) {
          errors.push({
            field: 'sheetName',
            value: excelOptions.sheetName,
            message: `Sheet '${excelOptions.sheetName}' not found. Available sheets: ${workbook.SheetNames.join(', ')}`,
            code: 'SHEET_NOT_FOUND',
            severity: 'error'
          });
          return errors;
        }
        targetSheetName = excelOptions.sheetName;
      } else {
        const sheetIndex = excelOptions.sheetIndex || 0;
        if (sheetIndex >= workbook.SheetNames.length) {
          errors.push({
            field: 'sheetIndex',
            value: sheetIndex,
            message: `Sheet index ${sheetIndex} is out of range. File has ${workbook.SheetNames.length} sheets.`,
            code: 'SHEET_INDEX_OUT_OF_RANGE',
            severity: 'error'
          });
          return errors;
        }
        targetSheetName = workbook.SheetNames[sheetIndex];
      }

      // Validate worksheet content
      const worksheet = workbook.Sheets[targetSheetName];
      if (!worksheet || !worksheet['!ref']) {
        errors.push({
          field: 'worksheet',
          value: targetSheetName,
          message: `Worksheet '${targetSheetName}' is empty or invalid`,
          code: 'EMPTY_WORKSHEET',
          severity: 'error'
        });
        return errors;
      }

      // Check if there's data beyond the header row
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      if (range.e.r < (excelOptions.headerRow || 1)) {
        errors.push({
          field: 'data',
          value: range.e.r,
          message: `No data rows found below header row ${excelOptions.headerRow}`,
          code: 'NO_DATA_ROWS',
          severity: 'warning'
        });
      }

      // Validate header row exists
      const headerRowIndex = (excelOptions.headerRow || 1) - 1; // Convert to 0-based
      let hasHeaderData = false;
      for (let col = range.s.c; col <= range.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: col });
        if (worksheet[cellAddress] && worksheet[cellAddress].v) {
          hasHeaderData = true;
          break;
        }
      }

      if (!hasHeaderData) {
        errors.push({
          field: 'headers',
          value: excelOptions.headerRow,
          message: `No header data found in row ${excelOptions.headerRow}`,
          code: 'NO_HEADER_DATA',
          severity: 'error'
        });
      }

    } catch (error) {
      errors.push({
        field: 'file',
        value: error,
        message: `Failed to validate Excel structure: ${error instanceof Error ? error.message : 'Unknown error'}`,
        code: 'VALIDATION_ERROR',
        severity: 'error'
      });
    }

    return errors;
  }

  /**
   * Process entire Excel file at once (memory intensive)
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
      const workbook = XLSX.read(buffer, { 
        type: 'buffer',
        cellDates: true,
        cellNF: false,
        cellText: false
      });

      const excelOptions = { ...this.defaultExcelOptions, ...options };
      
      // Get target worksheet
      let targetSheetName: string;
      if (excelOptions.sheetName) {
        targetSheetName = excelOptions.sheetName;
      } else {
        const sheetIndex = excelOptions.sheetIndex || 0;
        targetSheetName = workbook.SheetNames[sheetIndex];
      }

      const worksheet = workbook.Sheets[targetSheetName];
      
      // Convert worksheet to JSON with proper options
      const jsonOptions: XLSX.Sheet2JSONOpts = {
        header: 1, // Use first row as headers
        defval: '', // Default value for empty cells
        blankrows: false, // Skip blank rows
        range: excelOptions.range, // Use specified range if provided
        raw: false // Convert to strings for consistent processing
      };

      // If headerRow is not 1, adjust the range
      if (excelOptions.headerRow && excelOptions.headerRow !== 1) {
        const range = XLSX.utils.decode_range(worksheet['!ref']!);
        const headerRowIndex = excelOptions.headerRow - 1;
        const adjustedRange = {
          s: { r: headerRowIndex, c: range.s.c },
          e: { r: range.e.r, c: range.e.c }
        };
        jsonOptions.range = XLSX.utils.encode_range(adjustedRange);
      }

      const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, jsonOptions);
      
      if (rawData.length === 0) {
        return {
          success: true,
          totalRecords: 0,
          processedRecords: 0,
          validRecords: 0,
          invalidRecords: 0,
          results: [],
          summary: {
            errors: [],
            warnings: ['No data rows found in Excel file'],
            processingTimeMs: Date.now() - startTime
          }
        };
      }

      // First row contains headers
      const headers = rawData[0] as string[];
      const dataRows = rawData.slice(1);
      
      const errors: ValidationError[] = [];
      const warnings: string[] = [];

      // Process each data row
      for (let i = 0; i < dataRows.length; i++) {
        totalRecords++;
        const rowNumber = i + (excelOptions.headerRow || 1) + 1; // Adjust for Excel row numbers
        
        // Convert array to object using headers
        const rowObject: any = {};
        headers.forEach((header, index) => {
          if (header && header.trim()) {
            const key = this.sanitizeFieldName(header);
            rowObject[key] = dataRows[i][index];
          }
        });

        const result = this.processRow(rowObject, rowNumber);
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
            message: `Failed to process Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
   * Create streaming processor for large Excel files
   * Note: Excel streaming is more complex than CSV due to the binary format
   */
  createStream(
    source: Readable,
    metadata: FileMetadata,
    options?: FileProcessingOptions,
    onProgress?: ProgressCallback
  ): Transform {
    const excelOptions = { ...this.defaultExcelOptions, ...options };
    let rowNumber = 0;
    let recordsProcessed = 0;
    let recordsValid = 0;
    let recordsInvalid = 0;
    let headers: string[] = [];
    let bufferData: Buffer[] = [];
    let isProcessingStarted = false;
    const startTime = Date.now();

    const processor = new Transform({
      objectMode: true,
      transform(chunk: Buffer, encoding, callback) {
        // Collect all chunks first (Excel files must be read completely)
        bufferData.push(chunk);
        callback();
      },
      
      flush(callback) {
        try {
          // Combine all chunks
          const completeBuffer = Buffer.concat(bufferData);
          
          // Process the complete Excel file
          const workbook = XLSX.read(completeBuffer, { 
            type: 'buffer',
            cellDates: true,
            cellNF: false,
            cellText: false
          });

          // Get target worksheet
          let targetSheetName: string;
          if (excelOptions.sheetName) {
            targetSheetName = excelOptions.sheetName;
          } else {
            const sheetIndex = excelOptions.sheetIndex || 0;
            targetSheetName = workbook.SheetNames[sheetIndex];
          }

          const worksheet = workbook.Sheets[targetSheetName];
          
          // Create streaming processor for rows
          const processNextBatch = (startRow: number, batchSize: number = 1000) => {
            const range = XLSX.utils.decode_range(worksheet['!ref']!);
            const endRow = Math.min(startRow + batchSize - 1, range.e.r);
            
            if (startRow > range.e.r) {
              // Finished processing
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
              return;
            }

            // Process batch
            for (let r = startRow; r <= endRow; r++) {
              if (!isProcessingStarted && r === (excelOptions.headerRow || 1) - 1) {
                // Extract headers
                for (let c = range.s.c; c <= range.e.c; c++) {
                  const cellAddress = XLSX.utils.encode_cell({ r, c });
                  const cell = worksheet[cellAddress];
                  const headerValue = cell ? String(cell.v || '').trim() : '';
                  if (headerValue) {
                    headers.push(this.sanitizeFieldName(headerValue));
                  }
                }
                isProcessingStarted = true;
                continue;
              }

              if (r < (excelOptions.headerRow || 1)) {
                continue; // Skip rows before header
              }

              // Process data row
              rowNumber = r + 1; // Excel row numbers are 1-based
              recordsProcessed++;

              const rowObject: any = {};
              for (let c = range.s.c; c <= range.e.c && c - range.s.c < headers.length; c++) {
                const cellAddress = XLSX.utils.encode_cell({ r, c });
                const cell = worksheet[cellAddress];
                const headerIndex = c - range.s.c;
                if (headers[headerIndex]) {
                  rowObject[headers[headerIndex]] = cell ? cell.v : '';
                }
              }

              const result = this.processRow(rowObject, rowNumber);
              
              if (result.success) {
                recordsValid++;
              } else {
                recordsInvalid++;
              }

              // Emit the processed result
              this.push(result);

              // Check limits
              if (options?.maxRecords && recordsProcessed >= options.maxRecords) {
                callback();
                return;
              }
            }

            // Progress update
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

            // Process next batch
            setImmediate(() => processNextBatch(endRow + 1, batchSize));
          };

          // Start processing from header row
          const headerRowIndex = (excelOptions.headerRow || 1) - 1;
          processNextBatch(headerRowIndex);

        } catch (error) {
          callback(new Error(`Excel streaming failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      }.bind(this)
    });

    return source.pipe(processor);
  }

  /**
   * Generate Excel template file
   */
  async generateTemplate(
    fields: FieldDefinition[],
    options?: FileProcessingOptions
  ): Promise<Buffer> {
    const excelOptions = { ...this.defaultExcelOptions, ...options };
    
    // Create a new workbook
    const workbook = XLSX.utils.book_new();
    
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
          return true;
        case 'date':
          return new Date();
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

    // Create worksheet data
    const worksheetData = [headers, exampleRow];
    
    // Add field descriptions as comments (if available)
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    
    // Set column widths
    const colWidths = headers.map(header => ({ wch: Math.max(header.length, 15) }));
    worksheet['!cols'] = colWidths;

    // Add worksheet to workbook
    const sheetName = excelOptions.sheetName || 'NetworkDevices';
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Generate buffer
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      cellDates: true
    });

    return buffer as Buffer;
  }

  /**
   * Process individual Excel row (converted to object)
   */
  private processRow(row: any, rowNumber: number): ProcessingResult<NetworkData> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    try {
      // Basic validation - check for required fields
      if (!this.isNonEmptyString(row.hostname)) {
        errors.push(this.createValidationError(
          'hostname',
          row.hostname,
          'Hostname is required',
          'REQUIRED_FIELD_MISSING'
        ));
      }

      if (!this.isNonEmptyString(row.ipaddress) || !this.isValidIP(row.ipaddress)) {
        errors.push(this.createValidationError(
          'ipAddress',
          row.ipaddress,
          'Valid IP address is required',
          'INVALID_IP_ADDRESS'
        ));
      }

      // MAC address validation (optional field)
      if (row.macaddress && !this.isValidMAC(row.macaddress)) {
        errors.push(this.createValidationError(
          'macAddress',
          row.macaddress,
          'Invalid MAC address format',
          'INVALID_MAC_ADDRESS'
        ));
      }

      // Device type validation
      const validDeviceTypes = ['switch', 'router', 'firewall', 'server', 'workstation', 'printer', 'other'];
      if (row.devicetype && !validDeviceTypes.includes(row.devicetype.toLowerCase())) {
        warnings.push(`Unknown device type: ${row.devicetype}`);
        row.devicetype = 'other';
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
        hostname: this.safeString(row.hostname)!,
        ipAddress: this.safeString(row.ipaddress)!,
        macAddress: this.safeString(row.macaddress),
        deviceType: (this.safeString(row.devicetype)?.toLowerCase() || 'other') as NetworkDevice['deviceType'],
        manufacturer: this.safeString(row.manufacturer),
        model: this.safeString(row.model),
        serialNumber: this.safeString(row.serialnumber),
        location: this.safeString(row.location),
        description: this.safeString(row.description),
        operatingSystem: this.safeString(row.operatingsystem),
        firmwareVersion: this.safeString(row.firmwareversion),
        managementIP: this.safeString(row.managementip),
        snmpCommunity: this.safeString(row.snmpcommunity),
        status: (this.safeString(row.status)?.toLowerCase() || 'active') as NetworkDevice['status'],
        tags: this.parseTags(row.tags),
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
        errors: [this.createValidationError(
          'row',
          row,
          `Row processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          'ROW_PROCESSING_ERROR'
        )],
        rowNumber,
        rawData: row
      };
    }
  }

  /**
   * Check if MIME type is valid for Excel
   */
  private isValidExcelMimeType(mimeType: string): boolean {
    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.ms-excel.sheet.macroEnabled.12', // .xlsm
      'application/vnd.ms-excel.sheet.binary.macroEnabled.12', // .xlsb
      'application/octet-stream' // Sometimes Excel files have this MIME type
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
   * Parse tags from cell value (comma-separated or JSON array)
   */
  private parseTags(tagsValue: any): string[] | undefined {
    if (!tagsValue) return undefined;
    
    const tagsStr = String(tagsValue).trim();
    if (!tagsStr) return undefined;
    
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
      'hostname', 'ipaddress', 'macaddress', 'devicetype', 'manufacturer', 
      'model', 'serialnumber', 'location', 'description', 'operatingsystem',
      'firmwareversion', 'managementip', 'snmpcommunity', 'status', 'tags'
    ];
    
    const customFields: Record<string, any> = {};
    let hasCustomFields = false;

    for (const [key, value] of Object.entries(row)) {
      if (!standardFields.includes(key.toLowerCase()) && value !== null && value !== undefined && value !== '') {
        customFields[key] = value;
        hasCustomFields = true;
      }
    }

    return hasCustomFields ? customFields : undefined;
  }
}