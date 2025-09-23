/**
 * Export Types
 * Core types for export service infrastructure including formats, progress tracking, and file management
 */

export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json',
  EXCEL = 'excel',
  PDF = 'pdf'
}

export enum ExportStatus {
  PENDING = 'pending',
  INITIALIZING = 'initializing',
  PROCESSING = 'processing',
  FORMATTING = 'formatting',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export interface ExportProgress {
  exportId: string;
  totalRecords: number;
  processedRecords: number;
  currentStep: string;
  progress: number; // 0-100
  status: ExportStatus;
  message: string;
  startTime: Date;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
  error?: string;
}

export interface ExportResult {
  exportId: string;
  success: boolean;
  format: ExportFormat;
  totalRecords: number;
  processedRecords: number;
  fileBuffer?: Buffer;
  fileName: string;
  fileSize: number;
  filePath?: string;
  downloadUrl?: string;
  processingTime: number;
  createdAt: Date;
  expiresAt?: Date;
  metadata: ExportMetadata;
  error?: string;
}

export interface ExportMetadata {
  userId?: string;
  resourceType: string;
  filters?: Record<string, any>;
  fields?: string[];
  options?: Record<string, any>;
  exportedAt: Date;
  version: string;
}

export interface ExportOptions {
  format: ExportFormat;
  resourceType: string;
  fields?: string[];
  filters?: Record<string, any>;
  includeHeaders?: boolean;
  includeMetadata?: boolean;
  batchSize?: number;
  maxRecords?: number;
  fileName?: string;
  userId?: string;
  compressionLevel?: number;
  customOptions?: Record<string, any>;
}

export interface FileInfo {
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: Date;
  expiresAt?: Date;
  isTemporary: boolean;
  metadata?: Record<string, any>;
}

export interface FileCleanupResult {
  filesDeleted: number;
  bytesFreed: number;
  errors: string[];
}

export interface ExportTemplate {
  id: string;
  name: string;
  description?: string;
  format: ExportFormat;
  resourceType: string;
  fields: string[];
  defaultOptions: Partial<ExportOptions>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportQueue {
  id: string;
  exportId: string;
  priority: number;
  status: ExportStatus;
  queuedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  retryCount: number;
  maxRetries: number;
  options: ExportOptions;
}

export interface ExportServiceConfig {
  maxConcurrentExports: number;
  defaultBatchSize: number;
  maxRecordsPerExport: number;
  tempFileLifetime: number; // in milliseconds
  cleanupInterval: number; // in milliseconds
  memoryThreshold: number; // in bytes
  compressionEnabled: boolean;
  allowedFormats: ExportFormat[];
  maxFileSize: number; // in bytes
}

export interface ExportEventData {
  exportId: string;
  progress: ExportProgress;
  result?: ExportResult;
  error?: Error;
}

export type ExportEventType =
  | 'export:started'
  | 'export:progress'
  | 'export:completed'
  | 'export:failed'
  | 'export:cancelled';

export interface ResourceCleanupInfo {
  resourceType: string;
  resourceId: string;
  memoryUsage: number;
  duration: number;
  timestamp: Date;
}

export interface ExportResourceUsage {
  peakMemoryUsage: number;
  averageMemoryUsage: number;
  totalProcessingTime: number;
  fileSystemOperations: number;
  networkOperations: number;
}

// Error types
export class ExportError extends Error {
  public readonly code: string;
  public readonly exportId?: string;
  public readonly details?: Record<string, any>;

  constructor(message: string, code: string, exportId?: string, details?: Record<string, any>) {
    super(message);
    this.name = 'ExportError';
    this.code = code;
    this.exportId = exportId;
    this.details = details;
  }
}

export class FileManagerError extends Error {
  public readonly code: string;
  public readonly filePath?: string;
  public readonly operation?: string;

  constructor(message: string, code: string, filePath?: string, operation?: string) {
    super(message);
    this.name = 'FileManagerError';
    this.code = code;
    this.filePath = filePath;
    this.operation = operation;
  }
}

// Utility types
export type ExportFormatter<T = any> = (data: T[], options: ExportOptions) => Promise<Buffer>;
export type ProgressCallback = (progress: ExportProgress) => void;
export type FileCleanupStrategy = 'age-based' | 'size-based' | 'manual';