/**
 * CSV Exporter
 * Handles CSV export with proper encoding, delimiter handling, and streaming for large datasets
 */

import { stringify, Options as StringifyOptions } from 'csv-stringify';
import { Transform } from 'stream';
import { ExportOptions, ExportFormat, ExportError } from '../types/export';

export interface CsvExportOptions extends ExportOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  lineEnding?: '\n' | '\r\n' | '\r';
  encoding?: BufferEncoding;
  includeHeaders?: boolean;
  quotedString?: boolean;
  quotedEmpty?: boolean;
  dateFormat?: string;
  numberFormat?: {
    decimalSeparator?: string;
    thousandsSeparator?: string;
    decimalPlaces?: number;
  };
  booleanFormat?: {
    trueValue?: string;
    falseValue?: string;
  };
  nullValue?: string;
  emptyValue?: string;
  trim?: boolean;
  skipEmptyLines?: boolean;
}

export interface CsvColumnMapping {
  sourceField: string;
  targetField?: string;
  formatter?: (value: any) => string;
  required?: boolean;
}

export class CsvExporter {
  private readonly defaultOptions: Required<Pick<CsvExportOptions,
    'delimiter' | 'quote' | 'escape' | 'lineEnding' | 'encoding' | 'includeHeaders' |
    'quotedString' | 'quotedEmpty' | 'nullValue' | 'emptyValue' | 'trim' | 'skipEmptyLines'
  >>;

  constructor() {
    this.defaultOptions = {
      delimiter: ',',
      quote: '"',
      escape: '"',
      lineEnding: '\n',
      encoding: 'utf8',
      includeHeaders: true,
      quotedString: true,
      quotedEmpty: false,
      nullValue: '',
      emptyValue: '',
      trim: true,
      skipEmptyLines: false
    };
  }

  /**
   * Export data to CSV format
   */
  async exportToCsv(data: any[], options: CsvExportOptions): Promise<Buffer> {
    try {
      if (!data || data.length === 0) {
        throw new ExportError('No data provided for CSV export', 'CSV_NO_DATA');
      }

      // Merge options with defaults
      const mergedOptions = { ...this.defaultOptions, ...options };

      // Process data for CSV output
      const processedData = this.processDataForCsv(data, mergedOptions);

      // Generate CSV content
      const csvContent = await this.generateCsvContent(processedData, mergedOptions, data);

      // Convert to buffer with specified encoding
      return Buffer.from(csvContent, mergedOptions.encoding);

    } catch (error) {
      throw new ExportError(
        `CSV export failed: ${error.message}`,
        'CSV_EXPORT_ERROR',
        undefined,
        {
          error: error.message,
          options: {
            delimiter: options.delimiter,
            encoding: options.encoding,
            includeHeaders: options.includeHeaders
          }
        }
      );
    }
  }

  /**
   * Export large datasets using streaming (memory efficient)
   */
  async exportToCsvStream(
    data: any[],
    options: CsvExportOptions,
    onProgress?: (processed: number, total: number) => void
  ): Promise<Buffer> {
    try {
      if (!data || data.length === 0) {
        throw new ExportError('No data provided for CSV stream export', 'CSV_NO_DATA');
      }

      const mergedOptions = { ...this.defaultOptions, ...options };
      const batchSize = options.batchSize || 1000;

      return new Promise((resolve, reject) => {
        const chunks: Buffer[] = [];
        let processedCount = 0;

        // Create stringify stream
        const stringifier = stringify(this.getStringifyOptions(mergedOptions));

        stringifier.on('data', (chunk: string | Buffer) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, mergedOptions.encoding));
        });

        stringifier.on('error', (error) => {
          reject(new ExportError(
            `CSV streaming failed: ${error.message}`,
            'CSV_STREAM_ERROR',
            undefined,
            { error: error.message }
          ));
        });

        stringifier.on('end', () => {
          const result = Buffer.concat(chunks);
          resolve(result);
        });

        // Process data in batches
        const processedData = this.processDataForCsv(data, mergedOptions);

        // Add headers if requested
        if (mergedOptions.includeHeaders && processedData.length > 0) {
          const headers = this.getHeadersFromData(processedData, mergedOptions);
          stringifier.write(headers);
        }

        // Stream data in batches
        const processBatch = (startIndex: number) => {
          const endIndex = Math.min(startIndex + batchSize, processedData.length);
          const batch = processedData.slice(startIndex, endIndex);

          batch.forEach(record => {
            stringifier.write(record);
            processedCount++;

            if (onProgress) {
              onProgress(processedCount, data.length);
            }
          });

          if (endIndex < processedData.length) {
            // Process next batch asynchronously to prevent blocking
            setImmediate(() => processBatch(endIndex));
          } else {
            // All data processed, end the stream
            stringifier.end();
          }
        };

        // Start processing
        processBatch(0);
      });

    } catch (error) {
      throw new ExportError(
        `CSV stream export failed: ${error.message}`,
        'CSV_STREAM_EXPORT_ERROR',
        undefined,
        { error: error.message }
      );
    }
  }

  /**
   * Process data for CSV output with field mapping and formatting
   */
  private processDataForCsv(data: any[], options: CsvExportOptions): any[][] {
    const fields = this.determineFields(data, options);

    return data.map(record => {
      return fields.map(field => {
        const value = record[field];
        return this.formatFieldValue(value, field, options);
      });
    });
  }

  /**
   * Determine which fields to export
   */
  private determineFields(data: any[], options: CsvExportOptions): string[] {
    if (options.fields && options.fields.length > 0) {
      return options.fields;
    }

    if (data.length === 0) {
      return [];
    }

    // Use all fields from the first record
    return Object.keys(data[0]);
  }

  /**
   * Get headers for CSV output
   */
  private getHeadersFromData(processedData: any[][], options: CsvExportOptions): string[] {
    const fields = this.determineFields([], options);

    if (fields.length === 0 && processedData.length > 0) {
      // Generate generic headers if no field names available
      const firstRow = processedData[0];
      return firstRow.map((_, index) => `Column${index + 1}`);
    }

    return fields.map(field => this.formatHeaderName(field, options));
  }

  /**
   * Format individual field values for CSV output
   */
  private formatFieldValue(value: any, fieldName: string, options: CsvExportOptions): string {
    // Handle null and undefined
    if (value === null || value === undefined) {
      return options.nullValue || this.defaultOptions.nullValue;
    }

    // Handle empty strings
    if (value === '') {
      return options.emptyValue || this.defaultOptions.emptyValue;
    }

    // Handle booleans
    if (typeof value === 'boolean') {
      if (options.booleanFormat) {
        return value
          ? (options.booleanFormat.trueValue || 'true')
          : (options.booleanFormat.falseValue || 'false');
      }
      return value ? 'true' : 'false';
    }

    // Handle numbers
    if (typeof value === 'number') {
      return this.formatNumber(value, options);
    }

    // Handle dates
    if (value instanceof Date) {
      return this.formatDate(value, options);
    }

    // Handle date strings
    if (typeof value === 'string' && this.isDateString(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        return this.formatDate(date, options);
      }
    }

    // Handle arrays and objects
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    // Handle strings
    let stringValue = String(value);

    // Trim if requested
    if (options.trim !== false) {
      stringValue = stringValue.trim();
    }

    return stringValue;
  }

  /**
   * Format numbers according to specified format
   */
  private formatNumber(value: number, options: CsvExportOptions): string {
    if (!options.numberFormat) {
      return value.toString();
    }

    const format = options.numberFormat;
    let result = value.toString();

    // Apply decimal places
    if (format.decimalPlaces !== undefined) {
      result = value.toFixed(format.decimalPlaces);
    }

    // Apply decimal separator
    if (format.decimalSeparator && format.decimalSeparator !== '.') {
      result = result.replace('.', format.decimalSeparator);
    }

    // Apply thousands separator
    if (format.thousandsSeparator) {
      const parts = result.split(format.decimalSeparator || '.');
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, format.thousandsSeparator);
      result = parts.join(format.decimalSeparator || '.');
    }

    return result;
  }

  /**
   * Format dates according to specified format
   */
  private formatDate(date: Date, options: CsvExportOptions): string {
    if (options.dateFormat) {
      // Simple date formatting - in a real implementation you might use a library like date-fns
      return this.applyDateFormat(date, options.dateFormat);
    }

    // Default ISO format
    return date.toISOString();
  }

  /**
   * Apply date format string
   */
  private applyDateFormat(date: Date, format: string): string {
    const formatTokens: Record<string, string> = {
      'YYYY': date.getFullYear().toString(),
      'MM': (date.getMonth() + 1).toString().padStart(2, '0'),
      'DD': date.getDate().toString().padStart(2, '0'),
      'HH': date.getHours().toString().padStart(2, '0'),
      'mm': date.getMinutes().toString().padStart(2, '0'),
      'ss': date.getSeconds().toString().padStart(2, '0')
    };

    let result = format;
    Object.entries(formatTokens).forEach(([token, value]) => {
      result = result.replace(new RegExp(token, 'g'), value);
    });

    return result;
  }

  /**
   * Check if string looks like a date
   */
  private isDateString(value: string): boolean {
    const datePatterns = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO date
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}$/ // MM-DD-YYYY
    ];

    return datePatterns.some(pattern => pattern.test(value.trim()));
  }

  /**
   * Format header name for display
   */
  private formatHeaderName(field: string, options: CsvExportOptions): string {
    // Use custom field mapping if available
    if (options.customOptions?.fieldMappings) {
      const mapping = options.customOptions.fieldMappings[field];
      if (mapping && mapping.targetField) {
        return mapping.targetField;
      }
    }

    // Convert camelCase or snake_case to Title Case
    return field
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  /**
   * Generate CSV content using csv-stringify
   */
  private async generateCsvContent(data: any[][], options: CsvExportOptions, originalData: any[] = []): Promise<string> {
    return new Promise((resolve, reject) => {
      const stringifyOptions = this.getStringifyOptions(options);

      // Add headers if requested
      let dataWithHeaders = data;
      if (options.includeHeaders !== false && data.length > 0) {
        const fields = this.determineFields(originalData, options);
        const headers = fields.length > 0 ? fields.map(field => this.formatHeaderName(field, options)) :
          data[0].map((_, index) => `Column${index + 1}`);
        dataWithHeaders = [headers, ...data];
      }

      stringify(dataWithHeaders, stringifyOptions, (error, output) => {
        if (error) {
          reject(new ExportError(
            `CSV generation failed: ${error.message}`,
            'CSV_STRINGIFY_ERROR',
            undefined,
            { error: error.message }
          ));
        } else {
          resolve(output);
        }
      });
    });
  }

  /**
   * Get options for csv-stringify library
   */
  private getStringifyOptions(options: CsvExportOptions): StringifyOptions {
    return {
      delimiter: options.delimiter || this.defaultOptions.delimiter,
      quote: options.quote || this.defaultOptions.quote,
      escape: options.escape || this.defaultOptions.escape,
      header: false, // We handle headers manually for better control
      quoted_string: options.quotedString !== false,
      quoted_empty: options.quotedEmpty || false,
      record_delimiter: options.lineEnding || this.defaultOptions.lineEnding,
      encoding: options.encoding || this.defaultOptions.encoding
    };
  }

  /**
   * Detect encoding of input data (basic implementation)
   */
  detectEncoding(buffer: Buffer): BufferEncoding {
    // Basic encoding detection - in a real implementation you might use a library like jschardet
    const sample = buffer.slice(0, 1000).toString('utf8');

    // Check for UTF-8 BOM
    if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
      return 'utf8';
    }

    // Simple heuristic: if it contains non-ASCII characters, likely UTF-8
    if (/[^\x00-\x7F]/.test(sample)) {
      return 'utf8';
    }

    return 'ascii';
  }

  /**
   * Validate CSV export options
   */
  validateOptions(options: CsvExportOptions): void {
    // Validate delimiter
    if (options.delimiter && options.delimiter.length !== 1) {
      throw new ExportError(
        'CSV delimiter must be a single character',
        'CSV_INVALID_DELIMITER'
      );
    }

    // Validate quote character
    if (options.quote && options.quote.length !== 1) {
      throw new ExportError(
        'CSV quote character must be a single character',
        'CSV_INVALID_QUOTE'
      );
    }

    // Validate escape character
    if (options.escape && options.escape.length !== 1) {
      throw new ExportError(
        'CSV escape character must be a single character',
        'CSV_INVALID_ESCAPE'
      );
    }

    // Validate encoding
    const supportedEncodings: BufferEncoding[] = ['utf8', 'utf16le', 'latin1', 'ascii'];
    if (options.encoding && !supportedEncodings.includes(options.encoding)) {
      throw new ExportError(
        `Unsupported encoding: ${options.encoding}`,
        'CSV_UNSUPPORTED_ENCODING'
      );
    }

    // Validate number format
    if (options.numberFormat) {
      const format = options.numberFormat;
      if (format.decimalPlaces !== undefined && (format.decimalPlaces < 0 || format.decimalPlaces > 10)) {
        throw new ExportError(
          'Decimal places must be between 0 and 10',
          'CSV_INVALID_DECIMAL_PLACES'
        );
      }
    }
  }

  /**
   * Create a template CSV file with headers only
   */
  async createTemplate(fields: string[], options: CsvExportOptions): Promise<Buffer> {
    try {
      const mergedOptions = { ...this.defaultOptions, ...options };
      const headers = fields.map(field => this.formatHeaderName(field, mergedOptions));

      // For template, don't add headers automatically since we're providing them
      const templateOptions = { ...mergedOptions, includeHeaders: false };
      const csvContent = await this.generateCsvContent([headers], templateOptions);
      return Buffer.from(csvContent, mergedOptions.encoding);

    } catch (error) {
      throw new ExportError(
        `Failed to create CSV template: ${error.message}`,
        'CSV_TEMPLATE_ERROR',
        undefined,
        { error: error.message }
      );
    }
  }

  /**
   * Parse CSV content back to data (utility method)
   */
  async parseCsv(buffer: Buffer, options: Partial<CsvExportOptions> = {}): Promise<any[]> {
    // This would require csv-parse library for full implementation
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Get file extension for CSV format
   */
  getFileExtension(): string {
    return '.csv';
  }

  /**
   * Get MIME type for CSV format
   */
  getMimeType(): string {
    return 'text/csv';
  }
}