/**
 * File Processors Export Module
 * Central export point for all Network CMDB file processing utilities
 */

// Core Types and Interfaces
export * from './types';

// Base Processor
export { BaseFileProcessor } from './base-processor';

// Specific Processors
export { CsvProcessor } from './csv-processor';
export { ExcelProcessor } from './excel-processor';
export { JsonProcessor } from './json-processor';

// Factory and Utilities
export { FileProcessorFactory } from './file-processor-factory';
export { FileValidator, FileFormatDetector } from './file-validator';

// Convenience re-exports for common usage patterns
export { FileFormat } from './types';

/**
 * Create a file processor factory instance
 * @returns FileProcessorFactory instance ready for use
 */
export function createFileProcessorFactory(): FileProcessorFactory {
  return new FileProcessorFactory();
}

/**
 * Create a specific processor by format
 * @param format The file format to create processor for
 * @returns FileProcessor instance or null if format not supported
 */
export function createProcessor(format: FileFormat) {
  const factory = new FileProcessorFactory();
  return factory.getProcessor(format);
}

/**
 * Validate a file buffer with automatic format detection
 * @param buffer File buffer to validate
 * @param metadata File metadata
 * @param options Processing options
 * @returns Array of validation errors
 */
export async function validateFileBuffer(
  buffer: Buffer,
  metadata: import('./types').FileMetadata,
  options?: import('./types').FileProcessingOptions
) {
  const factory = new FileProcessorFactory();
  return await factory.validateFile(buffer, metadata, undefined, options);
}

/**
 * Process a file buffer with automatic format detection
 * @param buffer File buffer to process
 * @param metadata File metadata
 * @param options Processing options
 * @returns Processing result
 */
export async function processFileBuffer(
  buffer: Buffer,
  metadata: import('./types').FileMetadata,
  options?: import('./types').FileProcessingOptions
) {
  const factory = new FileProcessorFactory();
  return await factory.processFile(buffer, metadata, options);
}

/**
 * Create a streaming processor for large files
 * @param source Readable stream source
 * @param metadata File metadata
 * @param options Streaming processing options
 * @returns Streaming processing result with cleanup function
 */
export function createStreamProcessor(
  source: import('stream').Readable,
  metadata: import('./types').FileMetadata,
  options?: import('./file-processor-factory').StreamingProcessingOptions
) {
  const factory = new FileProcessorFactory();
  return factory.createStreamingProcessor(source, metadata, options);
}

/**
 * Generate a template file for a specific format
 * @param format File format to generate template for
 * @param fields Optional field definitions (uses defaults if not provided)
 * @param options Processing options
 * @returns Template buffer
 */
export async function generateTemplate(
  format: FileFormat,
  fields?: import('./types').FieldDefinition[],
  options?: import('./types').FileProcessingOptions
) {
  const factory = new FileProcessorFactory();
  return await factory.generateTemplate(format, fields, options);
}

/**
 * Default field definitions for network devices
 * Commonly used field definitions that can be extended
 */
export const defaultNetworkDeviceFields: import('./types').FieldDefinition[] = [
  {
    name: 'hostname',
    type: 'string',
    required: true,
    description: 'Device hostname or name',
    example: 'sw01-floor1'
  },
  {
    name: 'ipAddress',
    type: 'ip',
    required: true,
    description: 'Primary IP address',
    example: '192.168.1.10'
  },
  {
    name: 'macAddress',
    type: 'mac',
    required: false,
    description: 'MAC address',
    example: '00:11:22:33:44:55'
  },
  {
    name: 'deviceType',
    type: 'string',
    required: false,
    description: 'Type of device',
    example: 'switch',
    validation: {
      enum: ['switch', 'router', 'firewall', 'server', 'workstation', 'printer', 'other']
    }
  },
  {
    name: 'manufacturer',
    type: 'string',
    required: false,
    description: 'Device manufacturer',
    example: 'Cisco'
  },
  {
    name: 'model',
    type: 'string',
    required: false,
    description: 'Device model',
    example: 'Catalyst 2960'
  },
  {
    name: 'serialNumber',
    type: 'string',
    required: false,
    description: 'Serial number',
    example: 'FOC1234567'
  },
  {
    name: 'location',
    type: 'string',
    required: false,
    description: 'Physical location',
    example: 'Building A, Floor 1, Room 101'
  },
  {
    name: 'status',
    type: 'string',
    required: false,
    description: 'Operational status',
    example: 'active',
    validation: {
      enum: ['active', 'inactive', 'maintenance', 'decommissioned']
    }
  },
  {
    name: 'description',
    type: 'string',
    required: false,
    description: 'Additional description',
    example: 'Main distribution switch'
  },
  {
    name: 'operatingSystem',
    type: 'string',
    required: false,
    description: 'Operating system',
    example: 'IOS 15.2'
  },
  {
    name: 'firmwareVersion',
    type: 'string',
    required: false,
    description: 'Firmware version',
    example: '15.2(4)S7'
  },
  {
    name: 'managementIP',
    type: 'ip',
    required: false,
    description: 'Management IP address',
    example: '192.168.100.10'
  }
];

/**
 * Common file processing options with sensible defaults
 */
export const defaultProcessingOptions: import('./types').FileProcessingOptions = {
  format: FileFormat.CSV, // Default to CSV
  encoding: 'utf8',
  skipValidation: false,
  maxFileSize: 100 * 1024 * 1024, // 100MB
  maxRecords: 100000, // 100K records
  chunkSize: 1000
};

/**
 * Streaming processing options with sensible defaults for large files
 */
export const defaultStreamingOptions: import('./file-processor-factory').StreamingProcessingOptions = {
  ...defaultProcessingOptions,
  enableStreaming: true,
  progressInterval: 1000, // Update every 1000 records
  errorThreshold: 100, // Stop after 100 errors
  memoryLimit: 512 // 512MB memory limit
};

/**
 * Utility function to detect if a file should use streaming based on size
 * @param fileSize File size in bytes
 * @returns True if streaming should be used
 */
export function shouldUseStreaming(fileSize: number): boolean {
  const STREAMING_THRESHOLD = 50 * 1024 * 1024; // 50MB
  return fileSize > STREAMING_THRESHOLD;
}

/**
 * Utility function to estimate processing time based on file size and format
 * @param fileSize File size in bytes
 * @param format File format
 * @returns Estimated processing time in milliseconds
 */
export function estimateProcessingTime(fileSize: number, format: FileFormat): number {
  // Processing rates in MB/second (rough estimates)
  const processingRates = {
    [FileFormat.CSV]: 10, // 10 MB/s
    [FileFormat.JSON]: 8, // 8 MB/s
    [FileFormat.EXCEL]: 5 // 5 MB/s (binary format is slower)
  };

  const fileSizeMB = fileSize / (1024 * 1024);
  const rate = processingRates[format] || 5;
  return (fileSizeMB / rate) * 1000; // Convert to milliseconds
}

/**
 * Utility function to get recommended chunk size for streaming based on format
 * @param format File format
 * @returns Recommended chunk size
 */
export function getRecommendedChunkSize(format: FileFormat): number {
  const chunkSizes = {
    [FileFormat.CSV]: 1000, // 1000 records per chunk
    [FileFormat.JSON]: 500, // 500 records per chunk (more complex parsing)
    [FileFormat.EXCEL]: 500 // 500 records per chunk (binary format overhead)
  };

  return chunkSizes[format] || 1000;
}

/**
 * Utility function to get supported file extensions for a format
 * @param format File format
 * @returns Array of supported extensions
 */
export function getSupportedExtensions(format: FileFormat): string[] {
  const extensions = {
    [FileFormat.CSV]: ['csv', 'txt'],
    [FileFormat.EXCEL]: ['xlsx', 'xls', 'xlsm', 'xlsb'],
    [FileFormat.JSON]: ['json', 'txt']
  };

  return extensions[format] || [];
}

/**
 * Utility function to get supported MIME types for a format
 * @param format File format
 * @returns Array of supported MIME types
 */
export function getSupportedMimeTypes(format: FileFormat): string[] {
  const mimeTypes = {
    [FileFormat.CSV]: [
      'text/csv',
      'application/csv',
      'text/plain',
      'application/vnd.ms-excel'
    ],
    [FileFormat.EXCEL]: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/vnd.ms-excel.sheet.macroEnabled.12',
      'application/vnd.ms-excel.sheet.binary.macroEnabled.12',
      'application/octet-stream'
    ],
    [FileFormat.JSON]: [
      'application/json',
      'text/json',
      'application/x-json',
      'text/plain'
    ]
  };

  return mimeTypes[format] || [];
}