/**
 * Bulk Operation Service
 * Handles bulk create, update, delete operations with transaction support
 */

import { EventEmitter } from 'events';
import { ServiceFactory } from '../index';
import {
  BulkOperationType,
  BulkOperationStatus,
  BulkOperationConfig,
  BulkOperationRequest,
  BulkOperationProgress,
  BulkOperationResult,
  BulkOperationError,
  BulkTransaction,
  TransactionOperation,
  RollbackInfo,
  RollbackOperation,
  BulkOperationEmitter,
  DEFAULT_BULK_CONFIG
} from './types';

export class BulkOperationService extends EventEmitter implements BulkOperationEmitter {
  private activeOperations = new Map<string, BulkOperationProgress>();
  private completedOperations = new Map<string, BulkOperationResult>();
  private operationQueue: BulkOperationRequest[] = [];
  private processingOperations = new Set<string>();
  private transactions = new Map<string, BulkTransaction>();
  private isProcessing = false;

  constructor() {
    super();
    this.startQueueProcessor();
  }

  /**
   * Queue a bulk operation
   */
  async queueBulkOperation(
    operationType: BulkOperationType,
    resourceType: string,
    records: any[],
    config: Partial<BulkOperationConfig> = {},
    priority: 'low' | 'normal' | 'high' | 'urgent' = 'normal'
  ): Promise<string> {
    const operationId = this.generateOperationId();
    
    const finalConfig: BulkOperationConfig = {
      ...DEFAULT_BULK_CONFIG,
      ...config,
      operationType,
      resourceType
    };

    const request: BulkOperationRequest = {
      id: operationId,
      config: finalConfig,
      records,
      createdAt: new Date(),
      priority
    };

    // Validate request
    await this.validateBulkRequest(request);

    // Add to queue
    this.addToQueue(request);

    this.emit('operation:queued', operationId, request);
    
    return operationId;
  }

  /**
   * Execute bulk operation immediately (bypassing queue)
   */
  async executeBulkOperation(
    operationType: BulkOperationType,
    resourceType: string,
    records: any[],
    config: Partial<BulkOperationConfig> = {}
  ): Promise<BulkOperationResult> {
    const operationId = await this.queueBulkOperation(
      operationType, 
      resourceType, 
      records, 
      config, 
      'urgent'
    );

    // Wait for completion
    return new Promise((resolve, reject) => {
      const checkCompletion = () => {
        const result = this.getOperationResult(operationId);
        if (result) {
          resolve(result);
          return;
        }

        const progress = this.getOperationProgress(operationId);
        if (progress && (progress.status === 'failed' || progress.status === 'cancelled')) {
          reject(new Error(`Operation ${progress.status}: ${progress.message}`));
          return;
        }

        setTimeout(checkCompletion, 100);
      };

      checkCompletion();
    });
  }

  /**
   * Get operation progress
   */
  getOperationProgress(operationId: string): BulkOperationProgress | null {
    return this.activeOperations.get(operationId) || null;
  }

  /**
   * Get operation result
   */
  getOperationResult(operationId: string): BulkOperationResult | null {
    return this.completedOperations.get(operationId) || null;
  }

  /**
   * Cancel an operation
   */
  async cancelOperation(operationId: string): Promise<boolean> {
    // Remove from queue if not started
    const queueIndex = this.operationQueue.findIndex(req => req.id === operationId);
    if (queueIndex > -1) {
      this.operationQueue.splice(queueIndex, 1);
      this.emit('operation:cancelled', operationId);
      return true;
    }

    // Mark active operation as cancelled
    const progress = this.activeOperations.get(operationId);
    if (progress && progress.status === 'processing') {
      progress.status = 'cancelled';
      progress.message = 'Operation cancelled by user';
      this.emit('operation:cancelled', operationId);
      return true;
    }

    return false;
  }

  /**
   * Get all active operations
   */
  getActiveOperations(): BulkOperationProgress[] {
    return Array.from(this.activeOperations.values());
  }

  /**
   * Get operation statistics
   */
  getOperationStats(): any {
    const completed = Array.from(this.completedOperations.values());
    
    return {
      totalOperations: completed.length,
      successfulOperations: completed.filter(r => r.success).length,
      failedOperations: completed.filter(r => !r.success).length,
      activeOperations: this.activeOperations.size,
      queuedOperations: this.operationQueue.length,
      averageProcessingTime: this.calculateAverageProcessingTime(completed),
      totalRecordsProcessed: completed.reduce((sum, r) => sum + r.processedRecords, 0)
    };
  }

  /**
   * Start queue processor
   */
  private startQueueProcessor(): void {
    const processQueue = async () => {
      if (this.isProcessing || this.operationQueue.length === 0) {
        setTimeout(processQueue, 1000);
        return;
      }

      this.isProcessing = true;

      try {
        // Process high priority operations first
        this.operationQueue.sort((a, b) => {
          const priorities = { urgent: 4, high: 3, normal: 2, low: 1 };
          return priorities[b.priority] - priorities[a.priority];
        });

        const activeCount = this.processingOperations.size;
        const maxConcurrent = 3; // Global max concurrent operations

        if (activeCount < maxConcurrent) {
          const request = this.operationQueue.shift();
          if (request) {
            this.processOperation(request).catch(error => {
              console.error('Error processing bulk operation:', error);
            });
          }
        }
      } finally {
        this.isProcessing = false;
      }

      setTimeout(processQueue, 1000);
    };

    processQueue();
  }

  /**
   * Process a bulk operation
   */
  private async processOperation(request: BulkOperationRequest): Promise<void> {
    const { id: operationId, config, records } = request;
    
    this.processingOperations.add(operationId);

    const progress: BulkOperationProgress = {
      operationId,
      status: 'initializing',
      totalRecords: records.length,
      processedRecords: 0,
      successfulRecords: 0,
      failedRecords: 0,
      skippedRecords: 0,
      currentBatch: 0,
      totalBatches: Math.ceil(records.length / config.batchSize),
      progress: 0,
      startTime: new Date(),
      elapsedTime: 0,
      processingRate: 0,
      message: 'Initializing bulk operation',
      errors: [],
      warnings: []
    };

    this.activeOperations.set(operationId, progress);
    this.emit('operation:started', operationId, progress);

    let transaction: BulkTransaction | null = null;

    try {
      // Create transaction if rollback is enabled
      if (config.enableRollback) {
        transaction = await this.createTransaction(operationId);
      }

      progress.status = 'processing';
      progress.message = 'Processing records';
      this.emit('operation:progress', operationId, progress);

      // Process records in batches
      const batches = this.createBatches(records, config.batchSize);
      const service = this.getServiceForResourceType(config.resourceType);

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        if (progress.status === 'cancelled') {
          throw new Error('Operation cancelled');
        }

        const batch = batches[batchIndex];
        progress.currentBatch = batchIndex + 1;
        
        try {
          const batchResult = await this.processBatch(
            batch,
            batchIndex,
            config,
            service,
            transaction
          );

          progress.successfulRecords += batchResult.successful;
          progress.failedRecords += batchResult.failed;
          progress.processedRecords += batch.length;
          progress.errors.push(...batchResult.errors);

          // Update progress
          progress.progress = (progress.processedRecords / progress.totalRecords) * 100;
          progress.elapsedTime = Date.now() - progress.startTime.getTime();
          progress.processingRate = progress.processedRecords / (progress.elapsedTime / 1000);
          progress.message = `Processed batch ${batchIndex + 1} of ${batches.length}`;

          this.emit('operation:progress', operationId, progress);
          this.emit('operation:batch_completed', operationId, batchIndex, batchResult);

        } catch (batchError) {
          if (!config.continueOnError) {
            throw batchError;
          }
          
          progress.errors.push({
            recordIndex: batchIndex * config.batchSize,
            record: batch[0],
            error: batchError.message,
            errorCode: 'BATCH_PROCESSING_ERROR',
            severity: 'error',
            retryCount: 0,
            timestamp: new Date(),
            batch: batchIndex
          });
          
          progress.failedRecords += batch.length;
        }
      }

      // Commit transaction
      if (transaction && config.enableRollback) {
        await this.commitTransaction(transaction);
      }

      // Create final result
      const result = this.createOperationResult(operationId, progress, config);
      this.completeOperation(operationId, result);

    } catch (error) {
      progress.status = 'failed';
      progress.message = `Operation failed: ${error.message}`;
      
      // Rollback if enabled
      if (transaction && config.enableRollback) {
        await this.rollbackTransaction(transaction, error.message);
      }

      const result = this.createOperationResult(operationId, progress, config, error.message);
      this.completeOperation(operationId, result);
      
      this.emit('operation:failed', operationId, error.message);
    } finally {
      this.processingOperations.delete(operationId);
    }
  }

  /**
   * Process a batch of records
   */
  private async processBatch(
    batch: any[],
    batchIndex: number,
    config: BulkOperationConfig,
    service: any,
    transaction: BulkTransaction | null
  ): Promise<{ successful: number; failed: number; errors: BulkOperationError[] }> {
    const errors: BulkOperationError[] = [];
    let successful = 0;
    let failed = 0;

    for (let i = 0; i < batch.length; i++) {
      const record = batch[i];
      const recordIndex = batchIndex * config.batchSize + i;

      try {
        let result;
        
        switch (config.operationType) {
          case 'create':
            result = await service.create(record, config.userId);
            break;
          case 'update':
            result = await this.updateRecord(service, record, config);
            break;
          case 'upsert':
            result = await this.upsertRecord(service, record, config);
            break;
          case 'delete':
            result = await this.deleteRecord(service, record, config);
            break;
          default:
            throw new Error(`Unsupported operation type: ${config.operationType}`);
        }

        if (result.success) {
          successful++;
          
          // Track transaction operation
          if (transaction) {
            this.addTransactionOperation(transaction, {
              type: config.operationType,
              resourceType: config.resourceType,
              resourceId: result.data?.id || record.id,
              originalData: config.operationType === 'update' ? record : undefined,
              newData: result.data,
              timestamp: new Date()
            });
          }
        } else {
          failed++;
          errors.push({
            recordIndex,
            record,
            error: result.errors?.[0]?.message || 'Unknown error',
            errorCode: 'PROCESSING_ERROR',
            severity: 'error',
            retryCount: 0,
            timestamp: new Date(),
            batch: batchIndex
          });
        }

      } catch (error) {
        failed++;
        errors.push({
          recordIndex,
          record,
          error: error.message,
          errorCode: 'PROCESSING_EXCEPTION',
          severity: 'error',
          retryCount: 0,
          timestamp: new Date(),
          batch: batchIndex
        });
      }
    }

    return { successful, failed, errors };
  }

  /**
   * Update record with proper identification
   */
  private async updateRecord(service: any, record: any, config: BulkOperationConfig): Promise<any> {
    // Implementation depends on having an identifier field
    const id = record.id || record[`${config.resourceType}Id`];
    if (!id) {
      throw new Error('Update operation requires an ID field');
    }

    return await service.update(id, record, config.userId);
  }

  /**
   * Upsert record (update if exists, create if not)
   */
  private async upsertRecord(service: any, record: any, config: BulkOperationConfig): Promise<any> {
    const id = record.id || record[`${config.resourceType}Id`];
    
    if (id) {
      try {
        // Try to find existing record
        const existing = await service.findById(id);
        if (existing) {
          return await service.update(id, record, config.userId);
        }
      } catch (error) {
        // Record doesn't exist, create new one
      }
    }

    return await service.create(record, config.userId);
  }

  /**
   * Delete record
   */
  private async deleteRecord(service: any, record: any, config: BulkOperationConfig): Promise<any> {
    const id = record.id || record[`${config.resourceType}Id`];
    if (!id) {
      throw new Error('Delete operation requires an ID field');
    }

    return await service.delete(id, config.userId);
  }

  /**
   * Create transaction
   */
  private async createTransaction(operationId: string): Promise<BulkTransaction> {
    const transaction: BulkTransaction = {
      id: this.generateTransactionId(),
      operationId,
      startTime: new Date(),
      status: 'active',
      operations: [],
      savepoints: []
    };

    this.transactions.set(transaction.id, transaction);
    return transaction;
  }

  /**
   * Add operation to transaction
   */
  private addTransactionOperation(transaction: BulkTransaction, operation: TransactionOperation): void {
    transaction.operations.push(operation);
  }

  /**
   * Commit transaction
   */
  private async commitTransaction(transaction: BulkTransaction): Promise<void> {
    transaction.status = 'committed';
  }

  /**
   * Rollback transaction
   */
  private async rollbackTransaction(transaction: BulkTransaction, reason: string): Promise<void> {
    this.emit('rollback:started', transaction.operationId);
    
    const rollbackInfo: RollbackInfo = {
      enabled: true,
      triggered: true,
      reason,
      rollbackStartTime: new Date(),
      rollbackSuccess: false,
      rollbackErrors: [],
      affectedRecords: transaction.operations.length,
      rollbackOperations: []
    };

    try {
      // Rollback operations in reverse order
      for (let i = transaction.operations.length - 1; i >= 0; i--) {
        const operation = transaction.operations[i];
        await this.rollbackOperation(operation, rollbackInfo);
      }

      rollbackInfo.rollbackSuccess = true;
      rollbackInfo.rollbackEndTime = new Date();
      transaction.status = 'rolled_back';

    } catch (rollbackError) {
      rollbackInfo.rollbackErrors.push(rollbackError.message);
      rollbackInfo.rollbackEndTime = new Date();
    }

    this.emit('rollback:completed', transaction.operationId, rollbackInfo.rollbackSuccess);
  }

  /**
   * Rollback a single operation
   */
  private async rollbackOperation(
    operation: TransactionOperation, 
    rollbackInfo: RollbackInfo
  ): Promise<void> {
    const service = this.getServiceForResourceType(operation.resourceType);
    const rollbackOp: RollbackOperation = {
      type: operation.type === 'create' ? 'delete' : 
            operation.type === 'delete' ? 'restore' : 'update',
      resourceId: operation.resourceId,
      originalData: operation.originalData,
      rollbackData: operation.newData,
      success: false,
      timestamp: new Date()
    };

    try {
      switch (rollbackOp.type) {
        case 'delete':
          await service.delete(operation.resourceId);
          break;
        case 'update':
          await service.update(operation.resourceId, operation.originalData);
          break;
        case 'restore':
          await service.create(operation.originalData);
          break;
      }
      
      rollbackOp.success = true;
      
    } catch (error) {
      rollbackOp.error = error.message;
      rollbackInfo.rollbackErrors.push(`Failed to rollback ${operation.resourceId}: ${error.message}`);
    }

    rollbackInfo.rollbackOperations.push(rollbackOp);
  }

  /**
   * Complete operation and store result
   */
  private completeOperation(operationId: string, result: BulkOperationResult): void {
    this.activeOperations.delete(operationId);
    this.completedOperations.set(operationId, result);
    
    this.emit('operation:completed', operationId, result);

    // Clean up old results after 24 hours
    setTimeout(() => {
      this.completedOperations.delete(operationId);
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Create batches from records
   */
  private createBatches<T>(records: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < records.length; i += batchSize) {
      batches.push(records.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Add request to queue with priority sorting
   */
  private addToQueue(request: BulkOperationRequest): void {
    this.operationQueue.push(request);
    
    // Sort queue by priority
    this.operationQueue.sort((a, b) => {
      const priorities = { urgent: 4, high: 3, normal: 2, low: 1 };
      return priorities[b.priority] - priorities[a.priority];
    });
  }

  /**
   * Validate bulk request
   */
  private async validateBulkRequest(request: BulkOperationRequest): Promise<void> {
    if (!request.records || request.records.length === 0) {
      throw new Error('No records provided for bulk operation');
    }

    if (request.records.length > 10000) {
      throw new Error('Maximum 10,000 records allowed per bulk operation');
    }

    // Validate resource type is supported
    try {
      this.getServiceForResourceType(request.config.resourceType);
    } catch (error) {
      throw new Error(`Unsupported resource type: ${request.config.resourceType}`);
    }
  }

  /**
   * Get service for resource type
   */
  private getServiceForResourceType(resourceType: string): any {
    switch (resourceType) {
      case 'vpc':
        return ServiceFactory.getVpcService();
      case 'transitGateway':
        return ServiceFactory.getTransitGatewayService();
      case 'customerGateway':
        return ServiceFactory.getCustomerGatewayService();
      case 'vpcEndpoint':
        return ServiceFactory.getVpcEndpointService();
      default:
        throw new Error(`Unsupported resource type: ${resourceType}`);
    }
  }

  /**
   * Create operation result
   */
  private createOperationResult(
    operationId: string,
    progress: BulkOperationProgress,
    config: BulkOperationConfig,
    error?: string
  ): BulkOperationResult {
    const endTime = new Date();
    const processingTime = endTime.getTime() - progress.startTime.getTime();

    return {
      operationId,
      success: !error && progress.failedRecords === 0,
      config,
      totalRecords: progress.totalRecords,
      processedRecords: progress.processedRecords,
      successfulRecords: progress.successfulRecords,
      failedRecords: progress.failedRecords,
      skippedRecords: progress.skippedRecords,
      processingTime,
      throughput: progress.processedRecords / (processingTime / 1000),
      errors: progress.errors,
      warnings: progress.warnings,
      createdResources: [], // TODO: Implement tracking
      updatedResources: [], // TODO: Implement tracking
      deletedResources: [], // TODO: Implement tracking
      metadata: {
        endTime: endTime.toISOString(),
        batchSize: config.batchSize,
        totalBatches: progress.totalBatches
      }
    };
  }

  /**
   * Calculate average processing time
   */
  private calculateAverageProcessingTime(results: BulkOperationResult[]): number {
    if (results.length === 0) return 0;
    
    const total = results.reduce((sum, result) => sum + result.processingTime, 0);
    return total / results.length;
  }

  /**
   * Generate operation ID
   */
  private generateOperationId(): string {
    return `bulk_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate transaction ID
   */
  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}