/**
 * Import Service
 * Handles file import operations with preview, validation, and batch processing
 */

import { EventEmitter } from 'events';
import { 
  processFileBuffer, 
  createStreamProcessor, 
  FileFormat, 
  shouldUseStreaming,
  defaultStreamingOptions 
} from '../../utils/file-processors';
import { ServiceFactory } from '../index';
import type { FileMetadata, FileProcessingOptions } from '../../utils/file-processors/types';

export interface ImportPreviewData {
  totalRecords: number;
  validRecords: number;
  invalidRecords: number;
  sampleRecords: any[];
  validationErrors: any[];
  fieldMapping: Record<string, string>;
  estimatedProcessingTime: number;
}

export interface ImportProgress {
  processedRecords: number;
  totalRecords: number;
  validRecords: number;
  errorRecords: number;
  currentRecord?: any;
  progress: number; // 0-100
  status: 'initializing' | 'processing' | 'completed' | 'failed' | 'cancelled';
  message: string;
  startTime: Date;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
}

export interface ImportResult {
  success: boolean;
  processedRecords: number;
  createdRecords: number;
  updatedRecords: number;
  errorRecords: number;
  errors: any[];
  processingTime: number;
  importId: string;
}

export interface ImportOptions extends FileProcessingOptions {
  mode: 'create' | 'update' | 'upsert';
  resourceType: 'vpc' | 'transitGateway' | 'customerGateway' | 'vpcEndpoint';
  batchSize?: number;
  continueOnError?: boolean;
  rollbackOnFailure?: boolean;
  fieldMapping?: Record<string, string>;
  skipValidation?: boolean;
  userId?: string;
}

export class ImportService extends EventEmitter {
  private activeImports = new Map<string, ImportProgress>();
  private importResults = new Map<string, ImportResult>();

  /**
   * Generate preview of import operation
   */
  async generatePreview(
    buffer: Buffer, 
    metadata: FileMetadata, 
    options: ImportOptions
  ): Promise<ImportPreviewData> {
    try {
      // Use small chunk size for preview to avoid processing entire file
      const previewOptions: FileProcessingOptions = {
        ...options,
        maxRecords: 100, // Only preview first 100 records
        skipValidation: false
      };

      const result = await processFileBuffer(buffer, metadata, previewOptions);

      if (!result.success) {
        throw new Error(`Preview generation failed: ${result.errors?.[0]?.message}`);
      }

      // Field mapping analysis
      const fieldMapping = this.analyzeFieldMapping(result.records || [], options.resourceType);

      // Estimate processing time for full file
      const totalRecords = this.estimateTotalRecords(buffer, metadata.format);
      const estimatedTime = this.estimateProcessingTime(totalRecords, metadata.format);

      return {
        totalRecords,
        validRecords: result.validRecords,
        invalidRecords: result.invalidRecords,
        sampleRecords: (result.records || []).slice(0, 10), // Show first 10 as sample
        validationErrors: result.errors || [],
        fieldMapping,
        estimatedProcessingTime: estimatedTime
      };

    } catch (error) {
      throw new Error(`Preview generation failed: ${error.message}`);
    }
  }

  /**
   * Execute import operation with progress tracking
   */
  async executeImport(
    buffer: Buffer,
    metadata: FileMetadata,
    options: ImportOptions
  ): Promise<{ importId: string; promise: Promise<ImportResult> }> {
    const importId = this.generateImportId();
    const useStreaming = shouldUseStreaming(buffer.length);

    // Initialize progress tracking
    const progress: ImportProgress = {
      processedRecords: 0,
      totalRecords: 0,
      validRecords: 0,
      errorRecords: 0,
      progress: 0,
      status: 'initializing',
      message: 'Starting import operation',
      startTime: new Date(),
      elapsedTime: 0
    };

    this.activeImports.set(importId, progress);

    const importPromise = useStreaming 
      ? this.executeStreamingImport(buffer, metadata, options, importId)
      : this.executeBatchImport(buffer, metadata, options, importId);

    return { importId, promise: importPromise };
  }

  /**
   * Get import progress
   */
  getImportProgress(importId: string): ImportProgress | null {
    return this.activeImports.get(importId) || null;
  }

  /**
   * Get import result
   */
  getImportResult(importId: string): ImportResult | null {
    return this.importResults.get(importId) || null;
  }

  /**
   * Cancel an active import
   */
  async cancelImport(importId: string): Promise<boolean> {
    const progress = this.activeImports.get(importId);
    if (!progress || progress.status === 'completed' || progress.status === 'failed') {
      return false;
    }

    progress.status = 'cancelled';
    progress.message = 'Import cancelled by user';
    this.emit('progress', importId, progress);

    return true;
  }

  /**
   * Execute streaming import for large files
   */
  private async executeStreamingImport(
    buffer: Buffer,
    metadata: FileMetadata,
    options: ImportOptions,
    importId: string
  ): Promise<ImportResult> {
    return new Promise((resolve, reject) => {
      const progress = this.activeImports.get(importId)!;
      const errors: any[] = [];
      let createdRecords = 0;
      let updatedRecords = 0;
      const batchSize = options.batchSize || 100;
      let currentBatch: any[] = [];

      try {
        const { readable } = require('stream');
        const source = new readable();
        source.push(buffer);
        source.push(null);

        const streamProcessor = createStreamProcessor(source, metadata, {
          ...defaultStreamingOptions,
          ...options,
          progressInterval: batchSize
        });

        streamProcessor.streamProcessor.on('data', async (record: any) => {
          currentBatch.push(record);

          if (currentBatch.length >= batchSize) {
            const batchResult = await this.processBatch(currentBatch, options);
            createdRecords += batchResult.created;
            updatedRecords += batchResult.updated;
            errors.push(...batchResult.errors);

            currentBatch = [];
            
            // Update progress
            progress.processedRecords += batchSize;
            progress.validRecords = createdRecords + updatedRecords;
            progress.errorRecords = errors.length;
            progress.progress = Math.min(95, (progress.processedRecords / progress.totalRecords) * 100);
            progress.elapsedTime = Date.now() - progress.startTime.getTime();
            progress.message = `Processed ${progress.processedRecords} records`;

            this.emit('progress', importId, progress);
          }
        });

        streamProcessor.streamProcessor.on('progress', (stats) => {
          progress.totalRecords = stats.totalRecords;
          progress.status = 'processing';
        });

        streamProcessor.streamProcessor.on('end', async () => {
          // Process remaining records in batch
          if (currentBatch.length > 0) {
            const batchResult = await this.processBatch(currentBatch, options);
            createdRecords += batchResult.created;
            updatedRecords += batchResult.updated;
            errors.push(...batchResult.errors);
          }

          // Complete the import
          const result = this.createImportResult(
            importId,
            progress.processedRecords,
            createdRecords,
            updatedRecords,
            errors,
            progress.elapsedTime
          );

          resolve(result);
        });

        streamProcessor.streamProcessor.on('error', (error) => {
          progress.status = 'failed';
          progress.message = `Import failed: ${error.message}`;
          this.emit('progress', importId, progress);
          reject(error);
        });

      } catch (error) {
        progress.status = 'failed';
        progress.message = `Import failed: ${error.message}`;
        this.emit('progress', importId, progress);
        reject(error);
      }
    });
  }

  /**
   * Execute batch import for smaller files
   */
  private async executeBatchImport(
    buffer: Buffer,
    metadata: FileMetadata,
    options: ImportOptions,
    importId: string
  ): Promise<ImportResult> {
    const progress = this.activeImports.get(importId)!;
    const startTime = Date.now();

    try {
      progress.status = 'processing';
      progress.message = 'Processing file';
      this.emit('progress', importId, progress);

      // Process the file
      const result = await processFileBuffer(buffer, metadata, options);
      
      if (!result.success) {
        throw new Error(`File processing failed: ${result.errors?.[0]?.message}`);
      }

      const records = result.records || [];
      progress.totalRecords = records.length;
      progress.message = `Processing ${records.length} records`;
      this.emit('progress', importId, progress);

      // Process records in batches
      const batchSize = options.batchSize || 100;
      const errors: any[] = [];
      let createdRecords = 0;
      let updatedRecords = 0;

      for (let i = 0; i < records.length; i += batchSize) {
        if (progress.status === 'cancelled') {
          throw new Error('Import cancelled');
        }

        const batch = records.slice(i, i + batchSize);
        const batchResult = await this.processBatch(batch, options);
        
        createdRecords += batchResult.created;
        updatedRecords += batchResult.updated;
        errors.push(...batchResult.errors);

        // Update progress
        progress.processedRecords = i + batch.length;
        progress.validRecords = createdRecords + updatedRecords;
        progress.errorRecords = errors.length;
        progress.progress = (progress.processedRecords / progress.totalRecords) * 100;
        progress.elapsedTime = Date.now() - progress.startTime.getTime();
        progress.message = `Processed ${progress.processedRecords} of ${progress.totalRecords} records`;

        this.emit('progress', importId, progress);
      }

      // Complete the import
      const processingTime = Date.now() - startTime;
      return this.createImportResult(
        importId,
        progress.processedRecords,
        createdRecords,
        updatedRecords,
        errors,
        processingTime
      );

    } catch (error) {
      progress.status = 'failed';
      progress.message = `Import failed: ${error.message}`;
      this.emit('progress', importId, progress);
      throw error;
    }
  }

  /**
   * Process a batch of records
   */
  private async processBatch(
    records: any[],
    options: ImportOptions
  ): Promise<{ created: number; updated: number; errors: any[] }> {
    let created = 0;
    let updated = 0;
    const errors: any[] = [];

    const service = this.getServiceForResourceType(options.resourceType);

    for (const record of records) {
      try {
        if (options.mode === 'create') {
          const result = await service.create(record, options.userId);
          if (result.success) {
            created++;
          } else {
            errors.push({ record, errors: result.errors });
          }
        } else if (options.mode === 'update') {
          // Implementation depends on having an identifier
          // This is a simplified version
          errors.push({ record, errors: [{ message: 'Update mode not implemented' }] });
        } else if (options.mode === 'upsert') {
          // Try to find existing record, then create or update
          errors.push({ record, errors: [{ message: 'Upsert mode not implemented' }] });
        }

        if (!options.continueOnError && errors.length > 0) {
          break;
        }
      } catch (error) {
        errors.push({ record, errors: [{ message: error.message }] });
        
        if (!options.continueOnError) {
          break;
        }
      }
    }

    return { created, updated, errors };
  }

  /**
   * Analyze field mapping
   */
  private analyzeFieldMapping(records: any[], resourceType: string): Record<string, string> {
    if (records.length === 0) return {};

    const sampleRecord = records[0];
    const fieldMapping: Record<string, string> = {};

    // Simple field mapping based on common patterns
    const fieldMappings = {
      vpc: {
        'vpc_id': 'vpcId',
        'vpc-id': 'vpcId',
        'id': 'vpcId',
        'cidr': 'cidrBlock',
        'cidr_block': 'cidrBlock'
      },
      transitGateway: {
        'tgw_id': 'transitGatewayId',
        'transit_gateway_id': 'transitGatewayId',
        'tgw-id': 'transitGatewayId'
      }
    };

    const mappings = fieldMappings[resourceType] || {};
    Object.keys(sampleRecord).forEach(field => {
      fieldMapping[field] = mappings[field.toLowerCase()] || field;
    });

    return fieldMapping;
  }

  /**
   * Estimate total records in file
   */
  private estimateTotalRecords(buffer: Buffer, format: FileFormat): number {
    // Simple estimation based on file size and format
    const fileSizeKB = buffer.length / 1024;
    
    const estimates = {
      [FileFormat.CSV]: fileSizeKB * 20, // ~20 records per KB
      [FileFormat.JSON]: fileSizeKB * 5, // ~5 records per KB
      [FileFormat.EXCEL]: fileSizeKB * 15 // ~15 records per KB
    };

    return Math.round(estimates[format] || fileSizeKB * 10);
  }

  /**
   * Estimate processing time
   */
  private estimateProcessingTime(totalRecords: number, format: FileFormat): number {
    // Processing rates in records per second
    const rates = {
      [FileFormat.CSV]: 1000,
      [FileFormat.JSON]: 500,
      [FileFormat.EXCEL]: 300
    };

    const rate = rates[format] || 500;
    return Math.ceil(totalRecords / rate) * 1000; // milliseconds
  }

  /**
   * Get service for resource type
   */
  private getServiceForResourceType(resourceType: string) {
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
   * Create import result
   */
  private createImportResult(
    importId: string,
    processedRecords: number,
    createdRecords: number,
    updatedRecords: number,
    errors: any[],
    processingTime: number
  ): ImportResult {
    const result: ImportResult = {
      success: errors.length === 0,
      processedRecords,
      createdRecords,
      updatedRecords,
      errorRecords: errors.length,
      errors,
      processingTime,
      importId
    };

    // Update progress to completed
    const progress = this.activeImports.get(importId);
    if (progress) {
      progress.status = result.success ? 'completed' : 'failed';
      progress.progress = 100;
      progress.message = result.success 
        ? `Import completed: ${createdRecords} created, ${updatedRecords} updated`
        : `Import completed with ${errors.length} errors`;
      this.emit('progress', importId, progress);
    }

    // Store result
    this.importResults.set(importId, result);

    // Clean up active imports after some time
    setTimeout(() => {
      this.activeImports.delete(importId);
    }, 24 * 60 * 60 * 1000); // 24 hours

    return result;
  }

  /**
   * Generate unique import ID
   */
  private generateImportId(): string {
    return `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}