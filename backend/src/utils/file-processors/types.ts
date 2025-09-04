/**
 * File Processing Types for Network CMDB Import/Export Engine
 * Defines common interfaces and types for all file processors
 */

import { Readable, Transform } from 'stream';

// Supported file formats
export enum FileFormat {
  CSV = 'csv',
  EXCEL = 'excel',
  JSON = 'json'
}

// File processing options
export interface FileProcessingOptions {
  format: FileFormat;
  encoding?: BufferEncoding;
  skipValidation?: boolean;
  maxFileSize?: number; // in bytes
  maxRecords?: number;
  chunkSize?: number; // for streaming
}

// CSV-specific options
export interface CsvOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  headers?: boolean | string[];
  skipEmptyLines?: boolean;
  skipLinesWithError?: boolean;
}

// Excel-specific options
export interface ExcelOptions {
  sheetName?: string;
  sheetIndex?: number;
  headerRow?: number;
  range?: string; // e.g., 'A1:Z100'
}

// JSON-specific options
export interface JsonOptions {
  arrayPath?: string; // JSONPath to array of records
  schema?: object; // JSON Schema for validation
  strict?: boolean;
}

// File metadata
export interface FileMetadata {
  filename: string;
  originalName: string;
  size: number;
  mimetype: string;
  encoding: string;
  uploadedAt: Date;
  checksum?: string;
}

// Processing result for individual records
export interface ProcessingResult<T = any> {
  success: boolean;
  data?: T;
  errors?: ValidationError[];
  warnings?: string[];
  rowNumber?: number;
  rawData?: any;
}

// Validation error details
export interface ValidationError {
  field: string;
  value: any;
  message: string;
  code: string;
  severity: 'error' | 'warning';
}

// Batch processing result
export interface BatchProcessingResult<T = any> {
  success: boolean;
  totalRecords: number;
  processedRecords: number;
  validRecords: number;
  invalidRecords: number;
  results: ProcessingResult<T>[];
  summary: {
    errors: ValidationError[];
    warnings: string[];
    processingTimeMs: number;
    memoryUsedMB?: number;
  };
}

// Streaming processing stats
export interface StreamingStats {
  recordsProcessed: number;
  recordsValid: number;
  recordsInvalid: number;
  currentMemoryUsageMB: number;
  processingRatePerSecond: number;
  estimatedTimeRemainingMs?: number;
}

// Progress callback for streaming operations
export type ProgressCallback = (stats: StreamingStats) => void;

// Common file processor interface
export interface FileProcessor<T = any> {
  /**
   * Get supported file format
   */
  readonly format: FileFormat;

  /**
   * Validate file before processing
   */
  validateFile(
    buffer: Buffer,
    metadata: FileMetadata,
    options?: FileProcessingOptions
  ): Promise<ValidationError[]>;

  /**
   * Process file and return all records at once (memory intensive)
   */
  processFile(
    buffer: Buffer,
    metadata: FileMetadata,
    options?: FileProcessingOptions
  ): Promise<BatchProcessingResult<T>>;

  /**
   * Create a streaming processor for large files
   */
  createStream(
    source: Readable,
    metadata: FileMetadata,
    options?: FileProcessingOptions,
    onProgress?: ProgressCallback
  ): Transform;

  /**
   * Generate template file for the format
   */
  generateTemplate(
    fields: FieldDefinition[],
    options?: FileProcessingOptions
  ): Promise<Buffer>;

  /**
   * Detect file encoding
   */
  detectEncoding(buffer: Buffer): Promise<BufferEncoding>;

  /**
   * Get file processing statistics
   */
  getProcessingStats(): ProcessingStats;
}

// Field definition for template generation
export interface FieldDefinition {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'date' | 'email' | 'ip' | 'mac';
  required: boolean;
  description?: string;
  example?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: any[];
  };
}

// Processing statistics
export interface ProcessingStats {
  totalFilesProcessed: number;
  totalRecordsProcessed: number;
  totalProcessingTimeMs: number;
  averageProcessingRatePerSecond: number;
  memoryUsage: {
    current: number;
    peak: number;
    average: number;
  };
  errorCounts: Map<string, number>;
}

// Network-specific data types for CMDB
export interface NetworkDevice {
  id?: string;
  hostname: string;
  ipAddress: string;
  macAddress?: string;
  deviceType: 'switch' | 'router' | 'firewall' | 'server' | 'workstation' | 'printer' | 'other';
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  location?: string;
  description?: string;
  operatingSystem?: string;
  firmwareVersion?: string;
  managementIP?: string;
  snmpCommunity?: string;
  status: 'active' | 'inactive' | 'maintenance' | 'decommissioned';
  lastSeen?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  tags?: string[];
  customFields?: Record<string, any>;
}

// Network interface/port information
export interface NetworkInterface {
  id?: string;
  deviceId: string;
  name: string;
  ifIndex?: number;
  type: 'ethernet' | 'wifi' | 'fiber' | 'serial' | 'virtual' | 'other';
  speed?: number; // in Mbps
  duplex?: 'full' | 'half';
  status: 'up' | 'down' | 'testing' | 'unknown';
  adminStatus: 'up' | 'down' | 'testing';
  macAddress?: string;
  ipAddress?: string;
  subnetMask?: string;
  vlan?: number;
  description?: string;
  lastChange?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// VLAN information
export interface Vlan {
  id?: string;
  vlanId: number;
  name: string;
  description?: string;
  subnet?: string;
  gateway?: string;
  type: 'access' | 'trunk' | 'management' | 'voice' | 'other';
  status: 'active' | 'inactive';
  createdAt?: Date;
  updatedAt?: Date;
}

// Network connection/link information
export interface NetworkConnection {
  id?: string;
  sourceDeviceId: string;
  sourceInterface: string;
  targetDeviceId: string;
  targetInterface: string;
  connectionType: 'ethernet' | 'fiber' | 'wifi' | 'serial' | 'virtual';
  speed?: number;
  status: 'active' | 'inactive' | 'down';
  lastVerified?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Union type for all network data types
export type NetworkData = NetworkDevice | NetworkInterface | Vlan | NetworkConnection;

// File processor factory type
export type FileProcessorFactory = () => FileProcessor<NetworkData>;

// Export common options type
export type CommonFileOptions = CsvOptions & ExcelOptions & JsonOptions;