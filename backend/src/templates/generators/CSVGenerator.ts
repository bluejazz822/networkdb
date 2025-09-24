/**
 * CSV Generator
 * High-performance CSV generation with streaming support, custom formatting,
 * encoding options, and integration with template system
 */

import { stringify, Stringifier, Options as StringifyOptions } from 'csv-stringify';
import { Transform, Readable, PassThrough } from 'stream';
import { EventEmitter } from 'events';
import { ExportFormat } from '../../types/export';
import {
  IFormatGenerator,
  FormatGeneratorOptions,
  FormatGeneratorResult,
  FormatGeneratorConfig
} from '../formatters/ReportFormatters';
import winston from 'winston';

// Logger for CSV generation
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.label({ label: 'CSVGenerator' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

export interface CSVGeneratorOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  lineEnding?: '\n' | '\r\n' | '\r';
  encoding?: BufferEncoding;
  includeHeaders?: boolean;
  quotedString?: boolean;
  quotedEmpty?: boolean;
  bom?: boolean;
  columns?: CSVColumnDefinition[];
  formatting?: {
    dateFormat?: string;
    timeFormat?: string;
    dateTimeFormat?: string;
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
  };
  filters?: {
    skipEmptyRows?: boolean;
    skipEmptyColumns?: boolean;
    trimWhitespace?: boolean;
    removeLineBreaks?: boolean;
  };
  validation?: {
    maxRowLength?: number;
    maxFieldLength?: number;
    allowedCharacters?: RegExp;
    validateHeaders?: boolean;
  };
}

export interface CSVColumnDefinition {
  key: string;
  header?: string;
  formatter?: (value: any, record: any) => string;
  required?: boolean;
  dataType?: 'string' | 'number' | 'date' | 'boolean' | 'currency';
  width?: number;
  align?: 'left' | 'right' | 'center';
  defaultValue?: any;
}

export interface CSVTransformOptions {
  streamingEnabled: boolean;
  batchSize: number;
  memoryLimit: number;
  progressCallback?: (progress: number, message: string) => void;
}

export class CSVGenerator extends EventEmitter implements IFormatGenerator {
  readonly format = ExportFormat.CSV;
  readonly supportedMimeTypes = [
    'text/csv',
    'application/csv',
    'text/comma-separated-values'
  ];
  readonly defaultConfig: FormatGeneratorConfig = {
    maxFileSize: 1024 * 1024 * 1024, // 1GB
    encoding: 'utf8',
    memoryLimit: 256 * 1024 * 1024, // 256MB
    streamingThreshold: 10000,
    compressionLevel: 9
  };

  private defaultOptions: CSVGeneratorOptions;

  constructor() {
    super();

    this.defaultOptions = {
      delimiter: ',',
      quote: '"',
      escape: '"',
      lineEnding: '\n',
      encoding: 'utf8',
      includeHeaders: true,
      quotedString: true,
      quotedEmpty: false,
      bom: false,
      formatting: {
        dateFormat: 'YYYY-MM-DD',
        timeFormat: 'HH:mm:ss',
        dateTimeFormat: 'YYYY-MM-DD HH:mm:ss',
        numberFormat: {
          decimalSeparator: '.',
          thousandsSeparator: '',
          decimalPlaces: 2
        },
        booleanFormat: {
          trueValue: 'true',
          falseValue: 'false'
        },
        nullValue: '',
        emptyValue: ''
      },
      filters: {
        skipEmptyRows: false,
        skipEmptyColumns: false,
        trimWhitespace: true,
        removeLineBreaks: true
      },
      validation: {
        maxRowLength: 100000,
        maxFieldLength: 32767, // Excel limit
        validateHeaders: true
      }
    };
  }

  async generate(options: FormatGeneratorOptions): Promise<FormatGeneratorResult> {
    const startTime = Date.now();

    try {
      this.validateOptions(options);

      this.emit('generation:started', { format: this.format });

      // Extract data from template context
      const data = options.templateData.context.data || [];
      const csvOptions = this.mergeOptions(options.customOptions?.csv || {});

      // Determine if streaming is needed
      const useStreaming = options.streamingEnabled && data.length > this.defaultConfig.streamingThreshold!;

      let buffer: Buffer;
      let recordsProcessed = 0;

      if (useStreaming) {
        const result = await this.generateWithStreaming(data, csvOptions, options.progressCallback);
        buffer = result.buffer;
        recordsProcessed = result.recordsProcessed;
      } else {
        const result = await this.generateStandard(data, csvOptions, options.progressCallback);
        buffer = result.buffer;
        recordsProcessed = result.recordsProcessed;
      }

      const processingTime = Date.now() - startTime;

      this.emit('generation:completed', {
        format: this.format,
        size: buffer.length,
        records: recordsProcessed,
        processingTime
      });

      return {
        success: true,
        buffer,
        metadata: {
          format: this.format,
          size: buffer.length,
          mimeType: this.supportedMimeTypes[0],
          encoding: csvOptions.encoding,
          records: recordsProcessed,
          generatedAt: new Date(),
          processingTime
        }
      };
    } catch (error) {
      this.emit('generation:failed', { format: this.format, error });
      logger.error('CSV generation failed:', error);

      return {
        success: false,
        buffer: Buffer.from(''),
        metadata: {
          format: this.format,
          size: 0,
          mimeType: this.supportedMimeTypes[0],
          generatedAt: new Date(),
          processingTime: Date.now() - startTime
        },
        error: error.message
      };
    }
  }

  private async generateStandard(
    data: any[],
    options: CSVGeneratorOptions,
    progressCallback?: (progress: number, message: string) => void
  ): Promise<{ buffer: Buffer; recordsProcessed: number }> {
    return new Promise((resolve, reject) => {
      try {
        progressCallback?.(10, 'Initializing CSV generation...');

        const chunks: Buffer[] = [];
        let recordsProcessed = 0;

        // Prepare data for CSV generation
        const { headers, transformedData } = this.prepareData(data, options);

        progressCallback?.(20, 'Preparing data transformation...');

        // Create stringify options
        const stringifyOptions: StringifyOptions = {
          delimiter: options.delimiter,
          quote: options.quote,
          escape: options.escape,
          record_delimiter: options.lineEnding,
          header: options.includeHeaders,
          columns: headers,
          quoted_string: options.quotedString,
          quoted_empty: options.quotedEmpty
        };

        // Create CSV stringifier
        const stringifier = stringify(stringifyOptions);

        stringifier.on('readable', () => {
          let chunk;
          while ((chunk = stringifier.read()) !== null) {
            chunks.push(Buffer.from(chunk, options.encoding));
          }
        });

        stringifier.on('error', (error) => {
          reject(error);
        });

        stringifier.on('end', () => {
          try {
            progressCallback?.(90, 'Finalizing CSV...');

            let finalBuffer = Buffer.concat(chunks);

            // Add BOM if requested
            if (options.bom && options.encoding === 'utf8') {
              const bom = Buffer.from('\uFEFF', 'utf8');
              finalBuffer = Buffer.concat([bom, finalBuffer]);
            }

            progressCallback?.(100, 'CSV generation completed');
            resolve({ buffer: finalBuffer, recordsProcessed });
          } catch (error) {
            reject(error);
          }
        });

        // Write data to stringifier
        progressCallback?.(30, 'Writing data...');

        const batchSize = 1000;
        let currentIndex = 0;

        const writeBatch = () => {
          const batch = transformedData.slice(currentIndex, currentIndex + batchSize);

          if (batch.length === 0) {
            stringifier.end();
            return;
          }

          for (const record of batch) {
            stringifier.write(record);
            recordsProcessed++;
          }

          currentIndex += batchSize;
          const progress = 30 + (currentIndex / transformedData.length) * 50;
          progressCallback?.(Math.min(progress, 80), `Processed ${Math.min(currentIndex, transformedData.length)} of ${transformedData.length} records`);

          // Schedule next batch
          setImmediate(writeBatch);
        };

        writeBatch();

      } catch (error) {
        reject(error);
      }
    });
  }

  private async generateWithStreaming(
    data: any[],
    options: CSVGeneratorOptions,
    progressCallback?: (progress: number, message: string) => void
  ): Promise<{ buffer: Buffer; recordsProcessed: number }> {
    return new Promise((resolve, reject) => {
      try {
        progressCallback?.(10, 'Initializing streaming CSV generation...');

        const chunks: Buffer[] = [];
        let recordsProcessed = 0;

        // Prepare headers
        const { headers } = this.prepareData(data.slice(0, 1), options);

        // Create stringify options
        const stringifyOptions: StringifyOptions = {
          delimiter: options.delimiter,
          quote: options.quote,
          escape: options.escape,
          record_delimiter: options.lineEnding,
          header: options.includeHeaders,
          columns: headers,
          quoted_string: options.quotedString,
          quoted_empty: options.quotedEmpty
        };

        // Create streaming stringifier
        const stringifier = stringify(stringifyOptions);

        // Create transform stream for data processing
        const transformStream = new Transform({
          objectMode: true,
          transform: (chunk, encoding, callback) => {
            try {
              const transformedRecord = this.transformRecord(chunk, options);
              callback(null, transformedRecord);
            } catch (error) {
              callback(error);
            }
          }
        });

        // Pipeline setup
        transformStream.pipe(stringifier);

        stringifier.on('readable', () => {
          let chunk;
          while ((chunk = stringifier.read()) !== null) {
            chunks.push(Buffer.from(chunk, options.encoding));
          }
        });

        stringifier.on('error', reject);

        stringifier.on('end', () => {
          try {
            progressCallback?.(90, 'Finalizing streaming CSV...');

            let finalBuffer = Buffer.concat(chunks);

            // Add BOM if requested
            if (options.bom && options.encoding === 'utf8') {
              const bom = Buffer.from('\uFEFF', 'utf8');
              finalBuffer = Buffer.concat([bom, finalBuffer]);
            }

            progressCallback?.(100, 'Streaming CSV generation completed');
            resolve({ buffer: finalBuffer, recordsProcessed });
          } catch (error) {
            reject(error);
          }
        });

        // Stream data in batches
        progressCallback?.(20, 'Starting data stream...');

        const batchSize = 2000;
        let currentIndex = 0;

        const streamBatch = () => {
          const batch = data.slice(currentIndex, currentIndex + batchSize);

          if (batch.length === 0) {
            transformStream.end();
            return;
          }

          for (const record of batch) {
            transformStream.write(record);
            recordsProcessed++;
          }

          currentIndex += batchSize;
          const progress = 20 + (currentIndex / data.length) * 60;
          progressCallback?.(Math.min(progress, 80), `Streamed ${Math.min(currentIndex, data.length)} of ${data.length} records`);

          // Schedule next batch
          setImmediate(streamBatch);
        };

        streamBatch();

      } catch (error) {
        reject(error);
      }
    });
  }

  private prepareData(data: any[], options: CSVGeneratorOptions): { headers: string[]; transformedData: any[] } {
    if (!data || data.length === 0) {
      return { headers: [], transformedData: [] };
    }

    // Determine headers
    let headers: string[];

    if (options.columns && options.columns.length > 0) {
      headers = options.columns.map(col => col.header || col.key);
    } else {
      // Extract headers from first record
      headers = Object.keys(data[0]);
    }

    // Validate headers if required
    if (options.validation?.validateHeaders) {
      this.validateHeaders(headers, options);
    }

    // Transform data
    const transformedData = data.map(record => this.transformRecord(record, options));

    return { headers, transformedData };
  }

  private transformRecord(record: any, options: CSVGeneratorOptions): any {
    if (!record) return {};

    const transformed: any = {};

    // Use column definitions if available
    if (options.columns && options.columns.length > 0) {
      for (const column of options.columns) {
        const value = record[column.key];
        const formattedValue = this.formatValue(value, column, options);
        transformed[column.header || column.key] = formattedValue;
      }
    } else {
      // Transform all fields
      for (const [key, value] of Object.entries(record)) {
        transformed[key] = this.formatValue(value, { key, dataType: 'string' }, options);
      }
    }

    return transformed;
  }

  private formatValue(value: any, column: Partial<CSVColumnDefinition>, options: CSVGeneratorOptions): string {
    // Handle null/undefined
    if (value === null || value === undefined) {
      return column.defaultValue !== undefined ? String(column.defaultValue) : (options.formatting?.nullValue || '');
    }

    // Handle empty values
    if (value === '') {
      return options.formatting?.emptyValue || '';
    }

    // Apply custom formatter if available
    if (column.formatter && typeof column.formatter === 'function') {
      try {
        return String(column.formatter(value, {}));
      } catch (error) {
        logger.warn(`Custom formatter failed for column ${column.key}:`, error);
      }
    }

    // Format based on data type
    let formatted = this.formatByDataType(value, column.dataType || 'string', options);

    // Apply filters
    if (options.filters?.trimWhitespace) {
      formatted = formatted.trim();
    }

    if (options.filters?.removeLineBreaks) {
      formatted = formatted.replace(/[\r\n]+/g, ' ');
    }

    // Validate field length
    if (options.validation?.maxFieldLength && formatted.length > options.validation.maxFieldLength) {
      formatted = formatted.substring(0, options.validation.maxFieldLength);
      logger.warn(`Field truncated to ${options.validation.maxFieldLength} characters`);
    }

    return formatted;
  }

  private formatByDataType(value: any, dataType: string, options: CSVGeneratorOptions): string {
    switch (dataType) {
      case 'date':
        if (value instanceof Date) {
          return this.formatDate(value, options.formatting?.dateFormat || 'YYYY-MM-DD');
        }
        break;

      case 'number':
        if (typeof value === 'number') {
          return this.formatNumber(value, options.formatting?.numberFormat);
        }
        break;

      case 'currency':
        if (typeof value === 'number') {
          const formatted = this.formatNumber(value, options.formatting?.numberFormat);
          return `$${formatted}`;
        }
        break;

      case 'boolean':
        if (typeof value === 'boolean') {
          return value ?
            (options.formatting?.booleanFormat?.trueValue || 'true') :
            (options.formatting?.booleanFormat?.falseValue || 'false');
        }
        break;

      default:
        // string or fallback
        break;
    }

    return String(value);
  }

  private formatDate(date: Date, format: string): string {
    // Simple date formatting - could be enhanced with a proper date library
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  private formatNumber(num: number, format?: CSVGeneratorOptions['formatting']['numberFormat']): string {
    if (!format) {
      return String(num);
    }

    const {
      decimalPlaces = 2,
      decimalSeparator = '.',
      thousandsSeparator = ''
    } = format;

    // Round to specified decimal places
    const rounded = Number(num.toFixed(decimalPlaces));

    // Split into integer and decimal parts
    const parts = rounded.toString().split('.');
    let integerPart = parts[0];
    const decimalPart = parts[1] || '';

    // Add thousands separator
    if (thousandsSeparator) {
      integerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator);
    }

    // Combine parts
    if (decimalPlaces > 0 && decimalPart) {
      return integerPart + decimalSeparator + decimalPart.padEnd(decimalPlaces, '0');
    }

    return integerPart;
  }

  private validateHeaders(headers: string[], options: CSVGeneratorOptions): void {
    if (options.validation?.maxRowLength && headers.length > options.validation.maxRowLength) {
      throw new Error(`Too many columns: ${headers.length} (max: ${options.validation.maxRowLength})`);
    }

    // Check for duplicate headers
    const uniqueHeaders = new Set(headers);
    if (uniqueHeaders.size !== headers.length) {
      throw new Error('Duplicate column headers detected');
    }

    // Validate allowed characters
    if (options.validation?.allowedCharacters) {
      for (const header of headers) {
        if (!options.validation.allowedCharacters.test(header)) {
          throw new Error(`Invalid characters in header: ${header}`);
        }
      }
    }
  }

  private mergeOptions(customOptions: any): CSVGeneratorOptions {
    return {
      ...this.defaultOptions,
      ...customOptions,
      formatting: {
        ...this.defaultOptions.formatting,
        ...customOptions.formatting,
        numberFormat: {
          ...this.defaultOptions.formatting?.numberFormat,
          ...customOptions.formatting?.numberFormat
        },
        booleanFormat: {
          ...this.defaultOptions.formatting?.booleanFormat,
          ...customOptions.formatting?.booleanFormat
        }
      },
      filters: {
        ...this.defaultOptions.filters,
        ...customOptions.filters
      },
      validation: {
        ...this.defaultOptions.validation,
        ...customOptions.validation
      }
    };
  }

  validateOptions(options: FormatGeneratorOptions): void {
    if (!options.templateData) {
      throw new Error('Template data is required for CSV generation');
    }

    if (!options.exportOptions) {
      throw new Error('Export options are required');
    }

    // Validate CSV-specific options
    const csvOptions = options.customOptions?.csv;
    if (csvOptions?.delimiter && csvOptions.delimiter.length !== 1) {
      throw new Error('CSV delimiter must be a single character');
    }

    if (csvOptions?.quote && csvOptions.quote.length !== 1) {
      throw new Error('CSV quote character must be a single character');
    }

    if (csvOptions?.escape && csvOptions.escape.length !== 1) {
      throw new Error('CSV escape character must be a single character');
    }

    if (csvOptions?.encoding && !Buffer.isEncoding(csvOptions.encoding)) {
      throw new Error(`Invalid encoding: ${csvOptions.encoding}`);
    }
  }

  estimateOutputSize(recordCount: number, fieldCount: number): number {
    // CSV is typically the most compact format
    // Estimate: average field size + delimiters + line endings
    const avgFieldSize = 15; // characters
    const delimiterSize = 1;
    const lineEndingSize = 1;

    const recordSize = (avgFieldSize * fieldCount) + (delimiterSize * (fieldCount - 1)) + lineEndingSize;
    return Math.ceil(recordCount * recordSize * 1.2); // 20% overhead for safety
  }

  supportsStreaming(): boolean {
    return true;
  }

  getCompressionOptions(): Record<string, any> {
    return {
      level: this.defaultConfig.compressionLevel,
      algorithm: 'gzip'
    };
  }
}

export default CSVGenerator;