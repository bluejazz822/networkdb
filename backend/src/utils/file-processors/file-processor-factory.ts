/**
 * File Processor Factory for Network CMDB Import/Export Engine
 * Manages all file processors with streaming support for large files (100K+ records)
 */

import { Readable, Transform, PassThrough } from 'stream';
import { EventEmitter } from 'events';
import {
  FileProcessor,
  FileFormat,
  FileMetadata,
  FileProcessingOptions,
  BatchProcessingResult,
  ProcessingResult,
  ValidationError,
  StreamingStats,
  ProgressCallback,
  FieldDefinition,
  NetworkData,
  FileProcessorFactory as FactoryType
} from './types';
import { CsvProcessor } from './csv-processor';
import { ExcelProcessor } from './excel-processor';
import { JsonProcessor } from './json-processor';
import { FileValidator, FileFormatDetector } from './file-validator';

export interface StreamingProcessingOptions extends FileProcessingOptions {
  enableStreaming?: boolean;
  chunkSize?: number;
  progressInterval?: number; // Update progress every N records
  errorThreshold?: number; // Stop processing after N errors
  memoryLimit?: number; // Stop processing if memory exceeds limit (in MB)
}

export interface StreamingProcessingResult {
  streamProcessor: Transform;
  cleanup: () => void;
  stats: StreamingStats;
  errors: ValidationError[];
  warnings: string[];
}

export class FileProcessorFactory extends EventEmitter {
  private processors: Map<FileFormat, FileProcessor> = new Map();
  private activeStreams: Set<Transform> = new Set();
  
  constructor() {
    super();
    this.initializeProcessors();
  }

  /**
   * Initialize all file processors
   */
  private initializeProcessors(): void {
    this.processors.set(FileFormat.CSV, new CsvProcessor());
    this.processors.set(FileFormat.EXCEL, new ExcelProcessor());
    this.processors.set(FileFormat.JSON, new JsonProcessor());
  }

  /**
   * Get processor for specific format
   */
  getProcessor(format: FileFormat): FileProcessor | undefined {
    return this.processors.get(format);
  }

  /**
   * Detect file format automatically
   */
  async detectFileFormat(
    buffer: Buffer,
    metadata: FileMetadata
  ): Promise<FileFormat | null> {
    return FileFormatDetector.detectFormat(buffer, metadata);
  }

  /**
   * Validate file comprehensively
   */
  async validateFile(
    buffer: Buffer,
    metadata: FileMetadata,
    format?: FileFormat,
    options?: FileProcessingOptions
  ): Promise<ValidationError[]> {
    const detectedFormat = format || await this.detectFileFormat(buffer, metadata);
    
    if (!detectedFormat) {
      return [{
        field: 'file',
        value: 'unknown',
        message: 'Could not detect file format',
        code: 'UNKNOWN_FILE_FORMAT',
        severity: 'error'
      }];
    }

    // Use comprehensive file validation
    const errors = await FileValidator.validateFile(buffer, metadata, detectedFormat, options);
    
    // Add format-specific validation
    const processor = this.getProcessor(detectedFormat);
    if (processor) {
      const formatErrors = await processor.validateFile(buffer, metadata, options);
      errors.push(...formatErrors);
    }

    return errors;
  }

  /**
   * Process file with automatic format detection
   */
  async processFile(
    buffer: Buffer,
    metadata: FileMetadata,
    options?: FileProcessingOptions
  ): Promise<BatchProcessingResult<NetworkData>> {
    const format = await this.detectFileFormat(buffer, metadata);
    
    if (!format) {
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
            value: 'unknown',
            message: 'Could not detect file format',
            code: 'UNKNOWN_FILE_FORMAT',
            severity: 'error'
          }],
          warnings: [],
          processingTimeMs: 0
        }
      };
    }

    const processor = this.getProcessor(format);
    if (!processor) {
      return {
        success: false,
        totalRecords: 0,
        processedRecords: 0,
        validRecords: 0,
        invalidRecords: 0,
        results: [],
        summary: {
          errors: [{
            field: 'processor',
            value: format,
            message: `No processor available for format: ${format}`,
            code: 'PROCESSOR_NOT_FOUND',
            severity: 'error'
          }],
          warnings: [],
          processingTimeMs: 0
        }
      };
    }

    return processor.processFile(buffer, metadata, options);
  }

  /**
   * Create streaming processor with enhanced features for large files
   */
  createStreamingProcessor(
    source: Readable,
    metadata: FileMetadata,
    options?: StreamingProcessingOptions
  ): StreamingProcessingResult {
    const streamingOptions = {
      enableStreaming: true,
      chunkSize: 1000,
      progressInterval: 1000,
      errorThreshold: 100,
      memoryLimit: 512, // 512MB
      ...options
    };

    let format: FileFormat | null = null;
    let processor: FileProcessor | null = null;
    let recordsProcessed = 0;
    let recordsValid = 0;
    let recordsInvalid = 0;
    let errorCount = 0;
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const startTime = Date.now();
    
    let stats: StreamingStats = {
      recordsProcessed: 0,
      recordsValid: 0,
      recordsInvalid: 0,
      currentMemoryUsageMB: 0,
      processingRatePerSecond: 0
    };

    // Create buffer to collect initial data for format detection
    const bufferChunks: Buffer[] = [];
    let totalBufferSize = 0;
    let formatDetected = false;

    const streamProcessor = new Transform({
      objectMode: true,
      
      transform(chunk: any, encoding, callback) {
        try {
          // Format detection phase
          if (!formatDetected && Buffer.isBuffer(chunk)) {
            bufferChunks.push(chunk);
            totalBufferSize += chunk.length;

            // Once we have enough data or reached end, detect format
            if (totalBufferSize >= 1024) { // 1KB should be enough for detection
              this.detectFormatAndInitialize();
            }
            callback();
            return;
          }

          // Processing phase
          if (processor && formatDetected) {
            this.processRecord(chunk, callback);
          } else {
            callback();
          }

        } catch (error) {
          callback(new Error(`Stream processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`));
        }
      },

      flush(callback) {
        // Final detection attempt if not yet detected
        if (!formatDetected && bufferChunks.length > 0) {
          this.detectFormatAndInitialize();
        }

        // Final progress update
        this.updateProgress(true);
        callback();
      }
    });

    // Bind methods to the transform stream for access to 'this'
    (streamProcessor as any).detectFormatAndInitialize = async function() {
      try {
        const completeBuffer = Buffer.concat(bufferChunks);
        format = await FileFormatDetector.detectFormat(completeBuffer, metadata);
        
        if (!format) {
          errors.push({
            field: 'file',
            value: 'unknown',
            message: 'Could not detect file format from stream',
            code: 'STREAM_FORMAT_DETECTION_FAILED',
            severity: 'error'
          });
          return;
        }

        processor = this.processors.get(format);
        if (!processor) {
          errors.push({
            field: 'processor',
            value: format,
            message: `No processor available for detected format: ${format}`,
            code: 'PROCESSOR_NOT_FOUND',
            severity: 'error'
          });
          return;
        }

        formatDetected = true;

        // Validate the complete buffer
        const validationErrors = await FileValidator.validateFile(completeBuffer, metadata, format, streamingOptions);
        errors.push(...validationErrors);

        // Process the buffered data through the appropriate processor
        const bufferSource = Readable.from([completeBuffer]);
        const processorStream = processor.createStream(
          bufferSource,
          metadata,
          streamingOptions,
          this.updateProgress.bind(this)
        );

        // Pipe processor stream to our transform
        processorStream.on('data', (data: ProcessingResult<NetworkData>) => {
          this.processRecord(data, () => {});
        });

      } catch (error) {
        errors.push({
          field: 'stream',
          value: error,
          message: `Stream initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'STREAM_INIT_ERROR',
          severity: 'error'
        });
      }
    }.bind({ processors: this.processors });

    (streamProcessor as any).processRecord = function(
      result: ProcessingResult<NetworkData>,
      callback: (error?: Error | null, data?: any) => void
    ) {
      recordsProcessed++;
      
      if (result.success) {
        recordsValid++;
      } else {
        recordsInvalid++;
        errorCount++;
        if (result.errors) {
          errors.push(...result.errors);
        }
      }

      // Check error threshold
      if (streamingOptions.errorThreshold && errorCount >= streamingOptions.errorThreshold) {
        warnings.push(`Processing stopped due to error threshold (${streamingOptions.errorThreshold}) being exceeded`);
        callback(new Error('Error threshold exceeded'));
        return;
      }

      // Check memory limit
      const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;
      if (streamingOptions.memoryLimit && currentMemory > streamingOptions.memoryLimit) {
        warnings.push(`Processing stopped due to memory limit (${streamingOptions.memoryLimit}MB) being exceeded`);
        callback(new Error('Memory limit exceeded'));
        return;
      }

      // Update progress
      if (recordsProcessed % (streamingOptions.progressInterval || 1000) === 0) {
        this.updateProgress();
      }

      callback(null, result);
    };

    (streamProcessor as any).updateProgress = function(final = false) {
      const currentTime = Date.now();
      const elapsedSeconds = (currentTime - startTime) / 1000;
      const processingRate = elapsedSeconds > 0 ? recordsProcessed / elapsedSeconds : 0;
      const currentMemory = process.memoryUsage().heapUsed / 1024 / 1024;

      stats = {
        recordsProcessed,
        recordsValid,
        recordsInvalid,
        currentMemoryUsageMB: currentMemory,
        processingRatePerSecond: processingRate,
        estimatedTimeRemainingMs: final ? 0 : undefined
      };

      this.emit('progress', stats);
    }.bind(streamProcessor);

    // Track active stream
    this.activeStreams.add(streamProcessor);

    // Cleanup function
    const cleanup = () => {
      this.activeStreams.delete(streamProcessor);
      streamProcessor.destroy();
    };

    // Auto-cleanup on stream end
    streamProcessor.on('end', cleanup);
    streamProcessor.on('error', cleanup);

    // Connect source to our processor
    source.pipe(streamProcessor);

    return {
      streamProcessor,
      cleanup,
      stats,
      errors,
      warnings
    };
  }

  /**
   * Generate template for specific format
   */
  async generateTemplate(
    format: FileFormat,
    fields?: FieldDefinition[],
    options?: FileProcessingOptions
  ): Promise<Buffer> {
    const processor = this.getProcessor(format);
    if (!processor) {
      throw new Error(`No processor available for format: ${format}`);
    }

    // Use default network device fields if none provided
    const templateFields = fields || this.getDefaultNetworkDeviceFields();
    
    return processor.generateTemplate(templateFields, options);
  }

  /**
   * Get processing statistics from all processors
   */
  getGlobalProcessingStats(): Map<FileFormat, any> {
    const stats = new Map();
    
    for (const [format, processor] of this.processors) {
      stats.set(format, processor.getProcessingStats());
    }

    return stats;
  }

  /**
   * Stop all active streaming operations
   */
  stopAllStreams(): void {
    for (const stream of this.activeStreams) {
      stream.destroy();
    }
    this.activeStreams.clear();
  }

  /**
   * Get number of active streams
   */
  getActiveStreamCount(): number {
    return this.activeStreams.size;
  }

  /**
   * Default network device field definitions for templates
   */
  private getDefaultNetworkDeviceFields(): FieldDefinition[] {
    return [
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
      }
    ];
  }

  /**
   * Create factory function for specific format
   */
  static createFactory(format: FileFormat): FactoryType {
    const factory = new FileProcessorFactory();
    return () => {
      const processor = factory.getProcessor(format);
      if (!processor) {
        throw new Error(`No processor available for format: ${format}`);
      }
      return processor;
    };
  }
}