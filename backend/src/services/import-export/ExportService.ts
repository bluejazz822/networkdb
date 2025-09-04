/**
 * Export Service
 * Handles data export operations with filtering, formatting, and large dataset support
 */

import { EventEmitter } from 'events';
import { 
  generateTemplate, 
  FileFormat,
  defaultNetworkDeviceFields 
} from '../../utils/file-processors';
import { ServiceFactory } from '../index';
import type { FieldDefinition } from '../../utils/file-processors/types';

export interface ExportProgress {
  totalRecords: number;
  exportedRecords: number;
  progress: number; // 0-100
  status: 'initializing' | 'exporting' | 'formatting' | 'completed' | 'failed' | 'cancelled';
  message: string;
  startTime: Date;
  elapsedTime: number;
  estimatedTimeRemaining?: number;
}

export interface ExportResult {
  success: boolean;
  exportId: string;
  totalRecords: number;
  exportedRecords: number;
  format: FileFormat;
  fileBuffer: Buffer;
  fileName: string;
  fileSize: number;
  processingTime: number;
  metadata: {
    filters: any;
    fields: string[];
    resourceType: string;
    exportedAt: Date;
    userId?: string;
  };
}

export interface ExportOptions {
  format: FileFormat;
  resourceType: 'vpc' | 'transitGateway' | 'customerGateway' | 'vpcEndpoint' | 'all';
  fields?: string[];
  filters?: any;
  includeHeaders?: boolean;
  includeMetadata?: boolean;
  batchSize?: number;
  fileName?: string;
  userId?: string;
  // Advanced options
  includeDeleted?: boolean;
  includeAuditInfo?: boolean;
  dateRange?: {
    startDate?: Date;
    endDate?: Date;
  };
  customFieldMappings?: Record<string, string>;
}

export class ExportService extends EventEmitter {
  private activeExports = new Map<string, ExportProgress>();
  private exportResults = new Map<string, ExportResult>();

  /**
   * Generate export template
   */
  async generateExportTemplate(
    format: FileFormat,
    resourceType: string,
    customFields?: FieldDefinition[]
  ): Promise<Buffer> {
    try {
      const fields = customFields || this.getDefaultFieldsForResourceType(resourceType);
      const template = await generateTemplate(format, fields);
      return template;
    } catch (error) {
      throw new Error(`Template generation failed: ${error.message}`);
    }
  }

  /**
   * Execute export operation
   */
  async executeExport(options: ExportOptions): Promise<{ exportId: string; promise: Promise<ExportResult> }> {
    const exportId = this.generateExportId();

    // Initialize progress tracking
    const progress: ExportProgress = {
      totalRecords: 0,
      exportedRecords: 0,
      progress: 0,
      status: 'initializing',
      message: 'Starting export operation',
      startTime: new Date(),
      elapsedTime: 0
    };

    this.activeExports.set(exportId, progress);

    const exportPromise = this.performExport(options, exportId);

    return { exportId, promise: exportPromise };
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
   * Cancel active export
   */
  async cancelExport(exportId: string): Promise<boolean> {
    const progress = this.activeExports.get(exportId);
    if (!progress || progress.status === 'completed' || progress.status === 'failed') {
      return false;
    }

    progress.status = 'cancelled';
    progress.message = 'Export cancelled by user';
    this.emit('progress', exportId, progress);

    return true;
  }

  /**
   * Perform the actual export
   */
  private async performExport(options: ExportOptions, exportId: string): Promise<ExportResult> {
    const progress = this.activeExports.get(exportId)!;
    const startTime = Date.now();

    try {
      progress.status = 'exporting';
      progress.message = 'Fetching data';
      this.emit('progress', exportId, progress);

      // Fetch data based on resource type and filters
      const data = await this.fetchExportData(options);
      progress.totalRecords = data.length;
      progress.message = `Exporting ${data.length} records`;
      this.emit('progress', exportId, progress);

      // Process data in batches to avoid memory issues
      const batchSize = options.batchSize || 1000;
      const processedData: any[] = [];

      for (let i = 0; i < data.length; i += batchSize) {
        if (progress.status === 'cancelled') {
          throw new Error('Export cancelled');
        }

        const batch = data.slice(i, i + batchSize);
        const processedBatch = await this.processBatch(batch, options);
        processedData.push(...processedBatch);

        // Update progress
        progress.exportedRecords = Math.min(i + batchSize, data.length);
        progress.progress = (progress.exportedRecords / progress.totalRecords) * 80; // Reserve 20% for formatting
        progress.elapsedTime = Date.now() - progress.startTime.getTime();
        progress.message = `Processed ${progress.exportedRecords} of ${progress.totalRecords} records`;

        this.emit('progress', exportId, progress);
      }

      // Format data
      progress.status = 'formatting';
      progress.message = 'Formatting export file';
      progress.progress = 80;
      this.emit('progress', exportId, progress);

      const fileBuffer = await this.formatExportData(processedData, options);
      const fileName = this.generateFileName(options);

      // Complete export
      const processingTime = Date.now() - startTime;
      const result: ExportResult = {
        success: true,
        exportId,
        totalRecords: data.length,
        exportedRecords: processedData.length,
        format: options.format,
        fileBuffer,
        fileName,
        fileSize: fileBuffer.length,
        processingTime,
        metadata: {
          filters: options.filters || {},
          fields: options.fields || [],
          resourceType: options.resourceType,
          exportedAt: new Date(),
          userId: options.userId
        }
      };

      // Update progress
      progress.status = 'completed';
      progress.progress = 100;
      progress.message = `Export completed: ${result.exportedRecords} records exported`;
      progress.elapsedTime = processingTime;
      this.emit('progress', exportId, progress);

      // Store result
      this.exportResults.set(exportId, result);

      // Clean up after 24 hours
      setTimeout(() => {
        this.activeExports.delete(exportId);
        this.exportResults.delete(exportId);
      }, 24 * 60 * 60 * 1000);

      return result;

    } catch (error) {
      progress.status = 'failed';
      progress.message = `Export failed: ${error.message}`;
      this.emit('progress', exportId, progress);
      throw error;
    }
  }

  /**
   * Fetch data for export
   */
  private async fetchExportData(options: ExportOptions): Promise<any[]> {
    const allData: any[] = [];

    if (options.resourceType === 'all') {
      // Export all resource types
      const resourceTypes = ['vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint'];
      
      for (const resourceType of resourceTypes) {
        const service = this.getServiceForResourceType(resourceType);
        const result = await service.findAll({
          limit: 10000, // Large limit for export
          filters: options.filters
        });

        if (result.success && result.data) {
          const records = result.data.data.map(record => ({
            ...record,
            resourceType
          }));
          allData.push(...records);
        }
      }
    } else {
      // Export single resource type
      const service = this.getServiceForResourceType(options.resourceType);
      let page = 1;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const result = await service.findAll({
          page,
          limit,
          filters: options.filters
        });

        if (result.success && result.data) {
          allData.push(...result.data.data);
          hasMore = result.data.hasNextPage;
          page++;
        } else {
          hasMore = false;
        }
      }
    }

    return allData;
  }

  /**
   * Process batch of records for export
   */
  private async processBatch(records: any[], options: ExportOptions): Promise<any[]> {
    return records.map(record => {
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

      // Apply custom field mappings if specified
      if (options.customFieldMappings) {
        const mappedRecord: any = {};
        Object.entries(record).forEach(([key, value]) => {
          const mappedKey = options.customFieldMappings![key] || key;
          mappedRecord[mappedKey] = value;
        });
        return mappedRecord;
      }

      return record;
    });
  }

  /**
   * Format data for export
   */
  private async formatExportData(data: any[], options: ExportOptions): Promise<Buffer> {
    try {
      switch (options.format) {
        case FileFormat.CSV:
          return this.formatAsCSV(data, options);
        
        case FileFormat.JSON:
          return this.formatAsJSON(data, options);
        
        case FileFormat.EXCEL:
          return this.formatAsExcel(data, options);
        
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }
    } catch (error) {
      throw new Error(`Data formatting failed: ${error.message}`);
    }
  }

  /**
   * Format data as CSV
   */
  private async formatAsCSV(data: any[], options: ExportOptions): Promise<Buffer> {
    const { stringify } = require('csv-stringify');
    
    return new Promise((resolve, reject) => {
      const csvOptions = {
        header: options.includeHeaders !== false,
        columns: options.fields || (data.length > 0 ? Object.keys(data[0]) : [])
      };

      stringify(data, csvOptions, (err, output) => {
        if (err) {
          reject(err);
        } else {
          resolve(Buffer.from(output, 'utf8'));
        }
      });
    });
  }

  /**
   * Format data as JSON
   */
  private formatAsJSON(data: any[], options: ExportOptions): Buffer {
    const exportData = {
      metadata: options.includeMetadata ? {
        exportedAt: new Date().toISOString(),
        totalRecords: data.length,
        resourceType: options.resourceType,
        filters: options.filters
      } : undefined,
      data
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    return Buffer.from(jsonString, 'utf8');
  }

  /**
   * Format data as Excel
   */
  private async formatAsExcel(data: any[], options: ExportOptions): Promise<Buffer> {
    const XLSX = require('xlsx');

    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    
    const sheetName = options.resourceType === 'all' ? 'NetworkResources' : 
                     options.resourceType.charAt(0).toUpperCase() + options.resourceType.slice(1);
    
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

    // Add metadata sheet if requested
    if (options.includeMetadata) {
      const metadata = [{
        exportedAt: new Date().toISOString(),
        totalRecords: data.length,
        resourceType: options.resourceType,
        filters: JSON.stringify(options.filters)
      }];
      
      const metadataSheet = XLSX.utils.json_to_sheet(metadata);
      XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata');
    }

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    return Buffer.from(buffer);
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
   * Get default fields for resource type
   */
  private getDefaultFieldsForResourceType(resourceType: string): FieldDefinition[] {
    // This could be expanded based on specific resource types
    return defaultNetworkDeviceFields;
  }

  /**
   * Generate file name
   */
  private generateFileName(options: ExportOptions): string {
    if (options.fileName) {
      return options.fileName;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const extension = options.format.toLowerCase();
    
    return `${options.resourceType}-export-${timestamp}.${extension}`;
  }

  /**
   * Generate unique export ID
   */
  private generateExportId(): string {
    return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}