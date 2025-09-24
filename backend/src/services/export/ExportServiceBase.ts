/**
 * Export Service Base Class
 * Core infrastructure for export operations with progress tracking, resource management, and cleanup patterns
 */

import { EventEmitter } from 'events';
import { FileManager, FileManagerConfig } from '../../utils/FileManager';
import {
  ExportFormat,
  ExportStatus,
  ExportProgress,
  ExportResult,
  ExportOptions,
  ExportEventData,
  ExportEventType,
  ExportError,
  ExportServiceConfig,
  ExportQueue,
  ExportResourceUsage,
  ResourceCleanupInfo,
  ProgressCallback
} from '../../types/export';

export abstract class ExportServiceBase extends EventEmitter {
  protected readonly config: ExportServiceConfig;
  protected readonly fileManager: FileManager;
  protected readonly activeExports = new Map<string, ExportProgress>();
  protected readonly exportQueue = new Map<string, ExportQueue>();
  protected readonly exportResults = new Map<string, ExportResult>();
  protected readonly resourceUsage = new Map<string, ExportResourceUsage>();

  private cleanupTimer?: NodeJS.Timeout;
  private currentConcurrentExports = 0;

  constructor(
    config: Partial<ExportServiceConfig> = {},
    fileManagerConfig: Partial<FileManagerConfig> = {}
  ) {
    super();

    this.config = {
      maxConcurrentExports: config.maxConcurrentExports || 3,
      defaultBatchSize: config.defaultBatchSize || 1000,
      maxRecordsPerExport: config.maxRecordsPerExport || 100000,
      tempFileLifetime: config.tempFileLifetime || 24 * 60 * 60 * 1000, // 24 hours
      cleanupInterval: config.cleanupInterval || 60 * 60 * 1000, // 1 hour
      memoryThreshold: config.memoryThreshold || 512 * 1024 * 1024, // 512MB
      compressionEnabled: config.compressionEnabled || false,
      allowedFormats: config.allowedFormats || [
        ExportFormat.CSV,
        ExportFormat.JSON,
        ExportFormat.EXCEL,
        ExportFormat.PDF
      ],
      maxFileSize: config.maxFileSize || 100 * 1024 * 1024 // 100MB
    };

    this.fileManager = new FileManager(fileManagerConfig);
    this.initializeService();
  }

  /**
   * Initialize the export service
   */
  private initializeService(): void {
    this.startCleanupTimer();
    this.setupFileManagerListeners();
    this.emit('service:initialized', { config: this.config });
  }

  /**
   * Abstract methods to be implemented by specific export services
   */
  protected abstract fetchData(options: ExportOptions): Promise<any[]>;
  protected abstract formatData(data: any[], format: ExportFormat, options: ExportOptions): Promise<Buffer>;
  protected abstract validateOptions(options: ExportOptions): void;

  /**
   * Queue an export operation
   */
  async queueExport(options: ExportOptions, priority: number = 1): Promise<string> {
    try {
      this.validateExportOptions(options);

      const exportId = this.generateExportId();
      const queueItem: ExportQueue = {
        id: `queue_${exportId}`,
        exportId,
        priority,
        status: ExportStatus.PENDING,
        queuedAt: new Date(),
        retryCount: 0,
        maxRetries: 3,
        options
      };

      this.exportQueue.set(exportId, queueItem);
      this.processQueue();

      return exportId;
    } catch (error) {
      throw new ExportError(
        `Failed to queue export: ${error.message}`,
        'QUEUE_ERROR',
        undefined,
        { options }
      );
    }
  }

  /**
   * Start export operation immediately (bypassing queue if under limit)
   */
  async startExport(options: ExportOptions, progressCallback?: ProgressCallback): Promise<string> {
    try {
      this.validateExportOptions(options);

      if (this.currentConcurrentExports >= this.config.maxConcurrentExports) {
        // Queue the export if at capacity
        return await this.queueExport(options);
      }

      const exportId = this.generateExportId();
      const startTime = Date.now();

      // Initialize progress tracking
      const progress: ExportProgress = {
        exportId,
        totalRecords: 0,
        processedRecords: 0,
        currentStep: 'Initializing',
        progress: 0,
        status: ExportStatus.INITIALIZING,
        message: 'Starting export operation',
        startTime: new Date(startTime),
        elapsedTime: 0
      };

      this.activeExports.set(exportId, progress);
      this.currentConcurrentExports++;

      // Set up progress callback if provided
      if (progressCallback) {
        this.on(`progress:${exportId}`, progressCallback);
      }

      // Start the export process
      this.performExport(exportId, options, startTime).catch(error => {
        this.handleExportError(exportId, error);
      });

      return exportId;
    } catch (error) {
      throw new ExportError(
        `Failed to start export: ${error.message}`,
        'START_ERROR',
        undefined,
        { options }
      );
    }
  }

  /**
   * Get export progress
   */
  getExportProgress(exportId: string): ExportProgress | null {
    return this.activeExports.get(exportId) || null;
  }

  /**
   * Get export result
   */
  getExportResult(exportId: string): ExportResult | null {
    return this.exportResults.get(exportId) || null;
  }

  /**
   * Cancel an active export
   */
  async cancelExport(exportId: string): Promise<boolean> {
    try {
      const progress = this.activeExports.get(exportId);
      const queueItem = this.exportQueue.get(exportId);

      if (queueItem && queueItem.status === ExportStatus.PENDING) {
        // Cancel queued export
        queueItem.status = ExportStatus.CANCELLED;
        this.exportQueue.delete(exportId);
        return true;
      }

      if (!progress || progress.status === ExportStatus.COMPLETED || progress.status === ExportStatus.FAILED) {
        return false;
      }

      // Cancel active export
      progress.status = ExportStatus.CANCELLED;
      progress.message = 'Export cancelled by user';
      this.updateProgress(exportId, progress);

      return true;
    } catch (error) {
      throw new ExportError(
        `Failed to cancel export: ${error.message}`,
        'CANCEL_ERROR',
        exportId
      );
    }
  }

  /**
   * Get resource usage for an export
   */
  getResourceUsage(exportId: string): ExportResourceUsage | null {
    return this.resourceUsage.get(exportId) || null;
  }

  /**
   * Clean up completed exports and temporary files
   */
  async cleanupResources(): Promise<{
    exportsCleanedUp: number;
    filesCleanedUp: number;
    memoryFreed: number;
  }> {
    try {
      let exportsCleanedUp = 0;
      let memoryFreed = 0;

      // Clean up old export results
      const cutoffTime = new Date(Date.now() - this.config.tempFileLifetime);

      for (const [exportId, result] of this.exportResults.entries()) {
        if (result.createdAt < cutoffTime) {
          // Clean up file if exists
          if (result.filePath) {
            try {
              await this.fileManager.deleteFile(result.filePath);
            } catch (error) {
              // File might already be deleted, continue
            }
          }

          this.exportResults.delete(exportId);
          this.activeExports.delete(exportId);
          this.resourceUsage.delete(exportId);
          exportsCleanedUp++;
        }
      }

      // Clean up file manager
      const fileCleanupResult = await this.fileManager.cleanupFiles('age-based');

      const cleanupInfo: ResourceCleanupInfo = {
        resourceType: 'export',
        resourceId: 'cleanup',
        memoryUsage: memoryFreed,
        duration: 0,
        timestamp: new Date()
      };

      this.emit('cleanup:completed', cleanupInfo);

      return {
        exportsCleanedUp,
        filesCleanedUp: fileCleanupResult.filesDeleted,
        memoryFreed: fileCleanupResult.bytesFreed
      };
    } catch (error) {
      throw new ExportError(
        `Resource cleanup failed: ${error.message}`,
        'CLEANUP_ERROR'
      );
    }
  }

  /**
   * Shutdown the service
   */
  async shutdown(): Promise<void> {
    try {
      // Stop cleanup timer
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
        this.cleanupTimer = undefined;
      }

      // Cancel all active exports
      for (const exportId of this.activeExports.keys()) {
        await this.cancelExport(exportId);
      }

      // Clean up file manager
      await this.fileManager.shutdown();

      this.emit('service:shutdown');
    } catch (error) {
      throw new ExportError(
        `Failed to shutdown service: ${error.message}`,
        'SHUTDOWN_ERROR'
      );
    }
  }

  /**
   * Perform the actual export operation
   */
  private async performExport(exportId: string, options: ExportOptions, startTime: number): Promise<void> {
    const progress = this.activeExports.get(exportId)!;
    const resourceUsage: ExportResourceUsage = {
      peakMemoryUsage: 0,
      averageMemoryUsage: 0,
      totalProcessingTime: 0,
      fileSystemOperations: 0,
      networkOperations: 0
    };

    try {
      // Step 1: Fetch data
      progress.status = ExportStatus.PROCESSING;
      progress.currentStep = 'Fetching data';
      progress.message = 'Retrieving records for export';
      this.updateProgress(exportId, progress);

      const data = await this.fetchData(options);
      progress.totalRecords = data.length;
      progress.progress = 20;
      progress.message = `Retrieved ${data.length} records`;
      this.updateProgress(exportId, progress);

      // Check for cancellation
      if (progress.status === ExportStatus.CANCELLED) {
        return;
      }

      // Step 2: Process data in batches
      progress.currentStep = 'Processing data';
      progress.progress = 40;
      this.updateProgress(exportId, progress);

      const processedData = await this.processDataInBatches(data, options, exportId);
      progress.processedRecords = processedData.length;
      progress.progress = 70;
      progress.message = `Processed ${processedData.length} records`;
      this.updateProgress(exportId, progress);

      // Check for cancellation
      const currentProgress = this.activeExports.get(exportId);
      if (currentProgress && currentProgress.status === ExportStatus.CANCELLED) {
        return;
      }

      // Step 3: Format data
      progress.status = ExportStatus.FORMATTING;
      progress.currentStep = 'Formatting export';
      progress.progress = 80;
      progress.message = 'Formatting data for export';
      this.updateProgress(exportId, progress);

      const formattedData = await this.formatData(processedData, options.format, options);
      progress.progress = 90;
      this.updateProgress(exportId, progress);

      // Step 4: Save file
      progress.currentStep = 'Saving file';
      progress.progress = 95;
      progress.message = 'Saving export file';
      this.updateProgress(exportId, progress);

      const fileName = this.generateFileName(options);
      const fileInfo = await this.fileManager.createTempFile(
        formattedData,
        this.getFileExtension(options.format),
        {
          fileName,
          ttl: this.config.tempFileLifetime,
          metadata: {
            exportId,
            format: options.format,
            resourceType: options.resourceType,
            recordCount: processedData.length
          }
        }
      );

      // Complete export
      const processingTime = Date.now() - startTime;
      resourceUsage.totalProcessingTime = processingTime;

      const result: ExportResult = {
        exportId,
        success: true,
        format: options.format,
        totalRecords: data.length,
        processedRecords: processedData.length,
        fileBuffer: formattedData,
        fileName: fileInfo.fileName,
        fileSize: fileInfo.fileSize,
        filePath: fileInfo.filePath,
        processingTime,
        createdAt: new Date(),
        expiresAt: fileInfo.expiresAt,
        metadata: {
          userId: options.userId,
          resourceType: options.resourceType,
          filters: options.filters,
          fields: options.fields,
          options: options.customOptions,
          exportedAt: new Date(),
          version: '1.0'
        }
      };

      // Store result and cleanup progress
      this.exportResults.set(exportId, result);
      this.resourceUsage.set(exportId, resourceUsage);

      progress.status = ExportStatus.COMPLETED;
      progress.progress = 100;
      progress.message = `Export completed successfully: ${result.processedRecords} records exported`;
      progress.elapsedTime = processingTime;
      this.updateProgress(exportId, progress);

      this.currentConcurrentExports--;
      this.processQueue(); // Process next queued item

      this.emit('export:completed', { exportId, result });

    } catch (error) {
      this.handleExportError(exportId, error);
    }
  }

  /**
   * Process data in batches to avoid memory issues
   */
  private async processDataInBatches(data: any[], options: ExportOptions, exportId: string): Promise<any[]> {
    const batchSize = options.batchSize || this.config.defaultBatchSize;
    const maxRecords = Math.min(data.length, this.config.maxRecordsPerExport);
    const processedData: any[] = [];

    for (let i = 0; i < maxRecords; i += batchSize) {
      const progress = this.activeExports.get(exportId);
      if (progress && progress.status === ExportStatus.CANCELLED) {
        throw new ExportError('Export cancelled', 'CANCELLED', exportId);
      }

      const batch = data.slice(i, Math.min(i + batchSize, maxRecords));
      const processedBatch = await this.processBatch(batch, options);
      processedData.push(...processedBatch);

      // Update progress
      if (progress) {
        const processed = Math.min(i + batchSize, maxRecords);
        progress.processedRecords = processed;
        progress.progress = 20 + (processed / maxRecords) * 20; // 20-40% range for processing
        progress.message = `Processed ${processed} of ${maxRecords} records`;
        this.updateProgress(exportId, progress);
      }

      // Memory check
      if (this.shouldCheckMemory()) {
        await this.checkMemoryUsage();
      }
    }

    return processedData;
  }

  /**
   * Process a batch of records
   */
  protected async processBatch(batch: any[], options: ExportOptions): Promise<any[]> {
    // Default processing - can be overridden by specific services
    return batch.map(record => {
      // Apply field selection if specified
      if (options.fields && options.fields.length > 0) {
        const filteredRecord: any = {};
        options.fields.forEach(field => {
          if (record[field] !== undefined) {
            filteredRecord[field] = record[field];
          }
        });
        return filteredRecord;
      }
      return record;
    });
  }

  /**
   * Handle export errors
   */
  private handleExportError(exportId: string, error: any): void {
    const progress = this.activeExports.get(exportId);
    if (progress) {
      progress.status = ExportStatus.FAILED;
      progress.message = `Export failed: ${error.message}`;
      progress.error = error.message;
      this.updateProgress(exportId, progress);
    }

    this.currentConcurrentExports--;
    this.processQueue(); // Process next queued item

    this.emit('export:failed', { exportId, error });
  }

  /**
   * Process the export queue
   */
  private processQueue(): void {
    if (this.currentConcurrentExports >= this.config.maxConcurrentExports) {
      return;
    }

    // Find highest priority pending export
    const pendingExports = Array.from(this.exportQueue.values())
      .filter(item => item.status === ExportStatus.PENDING)
      .sort((a, b) => b.priority - a.priority);

    if (pendingExports.length > 0) {
      const nextExport = pendingExports[0];
      nextExport.status = ExportStatus.PROCESSING;
      nextExport.startedAt = new Date();

      this.startExport(nextExport.options).catch(error => {
        // Handle queue processing error
        this.emit('queue:error', { exportId: nextExport.exportId, error });
      });
    }
  }

  /**
   * Update and emit progress
   */
  private updateProgress(exportId: string, progress: ExportProgress): void {
    progress.elapsedTime = Date.now() - progress.startTime.getTime();
    this.activeExports.set(exportId, progress);
    this.emit(`progress:${exportId}`, progress);
    this.emit('export:progress', { exportId, progress });
  }

  /**
   * Validation methods
   */
  private validateExportOptions(options: ExportOptions): void {
    if (!options.format || !this.config.allowedFormats.includes(options.format)) {
      throw new ExportError(
        `Invalid or unsupported format: ${options.format}`,
        'INVALID_FORMAT'
      );
    }

    if (!options.resourceType) {
      throw new ExportError('Resource type is required', 'MISSING_RESOURCE_TYPE');
    }

    // Call subclass validation
    this.validateOptions(options);
  }

  /**
   * Utility methods
   */
  private generateExportId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateFileName(options: ExportOptions): string {
    if (options.fileName) {
      return options.fileName;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const extension = this.getFileExtension(options.format);
    return `${options.resourceType}-export-${timestamp}${extension}`;
  }

  private getFileExtension(format: ExportFormat): string {
    const extensions = {
      [ExportFormat.CSV]: '.csv',
      [ExportFormat.JSON]: '.json',
      [ExportFormat.EXCEL]: '.xlsx',
      [ExportFormat.PDF]: '.pdf'
    };
    return extensions[format] || '.txt';
  }

  private shouldCheckMemory(): boolean {
    // Check memory every 100 processed items or so
    return Math.random() < 0.01;
  }

  private async checkMemoryUsage(): Promise<void> {
    const memUsage = process.memoryUsage();
    if (memUsage.heapUsed > this.config.memoryThreshold) {
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
    }
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanupResources();
      } catch (error) {
        this.emit('error', error);
      }
    }, this.config.cleanupInterval);
  }

  private setupFileManagerListeners(): void {
    this.fileManager.on('error', (error) => {
      this.emit('file:error', error);
    });

    this.fileManager.on('file:created', (data) => {
      this.emit('file:created', data);
    });

    this.fileManager.on('file:deleted', (data) => {
      this.emit('file:deleted', data);
    });
  }
}