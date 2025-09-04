/**
 * Bulk Operations Types
 * Defines interfaces and types for bulk operations
 */

import { EventEmitter } from 'events';

// Bulk operation types
export type BulkOperationType = 'create' | 'update' | 'delete' | 'upsert';

// Bulk operation status
export type BulkOperationStatus = 
  | 'queued' 
  | 'initializing' 
  | 'processing' 
  | 'completed' 
  | 'failed' 
  | 'cancelled'
  | 'rolling_back'
  | 'rolled_back';

// Bulk operation configuration
export interface BulkOperationConfig {
  operationType: BulkOperationType;
  resourceType: string;
  batchSize: number;
  maxConcurrent: number;
  continueOnError: boolean;
  enableRollback: boolean;
  timeout: number; // in milliseconds
  retryAttempts: number;
  retryDelay: number; // in milliseconds
  validateBeforeProcess: boolean;
  userId?: string;
  metadata?: Record<string, any>;
}

// Default bulk operation configurations
export const DEFAULT_BULK_CONFIG: BulkOperationConfig = {
  operationType: 'create',
  resourceType: 'unknown',
  batchSize: 50,
  maxConcurrent: 5,
  continueOnError: true,
  enableRollback: false,
  timeout: 300000, // 5 minutes
  retryAttempts: 3,
  retryDelay: 1000, // 1 second
  validateBeforeProcess: true
};

// Bulk operation request
export interface BulkOperationRequest {
  id: string;
  config: BulkOperationConfig;
  records: any[];
  createdAt: Date;
  scheduledFor?: Date;
  priority: 'low' | 'normal' | 'high' | 'urgent';
}

// Bulk operation progress
export interface BulkOperationProgress {
  operationId: string;
  status: BulkOperationStatus;
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  skippedRecords: number;
  currentBatch: number;
  totalBatches: number;
  progress: number; // 0-100
  startTime: Date;
  endTime?: Date;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
  processingRate: number; // records per second
  message: string;
  currentRecord?: any;
  errors: BulkOperationError[];
  warnings: string[];
}

// Bulk operation result
export interface BulkOperationResult {
  operationId: string;
  success: boolean;
  config: BulkOperationConfig;
  totalRecords: number;
  processedRecords: number;
  successfulRecords: number;
  failedRecords: number;
  skippedRecords: number;
  processingTime: number;
  throughput: number; // records per second
  errors: BulkOperationError[];
  warnings: string[];
  createdResources: any[];
  updatedResources: any[];
  deletedResources: any[];
  rollbackInfo?: RollbackInfo;
  metadata?: Record<string, any>;
}

// Bulk operation error
export interface BulkOperationError {
  recordIndex: number;
  record: any;
  error: string;
  errorCode: string;
  severity: 'error' | 'warning';
  retryCount: number;
  timestamp: Date;
  batch?: number;
  operation?: string;
}

// Rollback information
export interface RollbackInfo {
  enabled: boolean;
  triggered: boolean;
  reason?: string;
  rollbackStartTime?: Date;
  rollbackEndTime?: Date;
  rollbackSuccess: boolean;
  rollbackErrors: string[];
  affectedRecords: number;
  rollbackOperations: RollbackOperation[];
}

// Rollback operation
export interface RollbackOperation {
  type: 'delete' | 'update' | 'restore';
  resourceId: string;
  originalData?: any;
  rollbackData?: any;
  success: boolean;
  error?: string;
  timestamp: Date;
}

// Transaction context for bulk operations
export interface BulkTransaction {
  id: string;
  operationId: string;
  startTime: Date;
  status: 'active' | 'committed' | 'rolled_back';
  operations: TransactionOperation[];
  savepoints: Savepoint[];
}

// Transaction operation
export interface TransactionOperation {
  type: 'create' | 'update' | 'delete';
  resourceType: string;
  resourceId: string;
  originalData?: any;
  newData?: any;
  timestamp: Date;
}

// Transaction savepoint
export interface Savepoint {
  name: string;
  timestamp: Date;
  operationIndex: number;
}

// Bulk operation queue item
export interface BulkOperationQueueItem {
  request: BulkOperationRequest;
  retryCount: number;
  lastAttempt?: Date;
  nextAttempt?: Date;
  failureReason?: string;
}

// Bulk operation statistics
export interface BulkOperationStats {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  averageProcessingTime: number;
  averageThroughput: number;
  totalRecordsProcessed: number;
  operationsByType: Record<BulkOperationType, number>;
  operationsByResourceType: Record<string, number>;
  errorSummary: Record<string, number>;
  peakConcurrency: number;
  currentActiveOperations: number;
  queuedOperations: number;
}

// Resource type specific configurations
export interface ResourceTypeConfig {
  resourceType: string;
  batchSize: number;
  maxConcurrent: number;
  supportsTransactions: boolean;
  supportedOperations: BulkOperationType[];
  validationRequired: boolean;
  rollbackCapable: boolean;
  customValidators?: ((record: any) => ValidationResult)[];
  customProcessors?: Record<BulkOperationType, (records: any[]) => Promise<any>>;
  dependencies?: string[]; // Other resource types this depends on
}

// Validation result for bulk operations
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// Bulk operation event types
export interface BulkOperationEvents {
  'operation:queued': (operationId: string, request: BulkOperationRequest) => void;
  'operation:started': (operationId: string, progress: BulkOperationProgress) => void;
  'operation:progress': (operationId: string, progress: BulkOperationProgress) => void;
  'operation:batch_completed': (operationId: string, batchIndex: number, batchResult: any) => void;
  'operation:completed': (operationId: string, result: BulkOperationResult) => void;
  'operation:failed': (operationId: string, error: string) => void;
  'operation:cancelled': (operationId: string) => void;
  'rollback:started': (operationId: string) => void;
  'rollback:completed': (operationId: string, success: boolean) => void;
}

// Bulk operation event emitter interface
export interface BulkOperationEmitter extends EventEmitter {
  on<K extends keyof BulkOperationEvents>(
    event: K,
    listener: BulkOperationEvents[K]
  ): this;
  
  emit<K extends keyof BulkOperationEvents>(
    event: K,
    ...args: Parameters<BulkOperationEvents[K]>
  ): boolean;
}