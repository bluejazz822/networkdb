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

// Advanced filtering options
export interface FilterCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'starts_with' | 'ends_with' | 
           'greater_than' | 'less_than' | 'greater_than_or_equal' | 'less_than_or_equal' |
           'in' | 'not_in' | 'is_null' | 'is_not_null' | 'between' | 'regex';
  value?: any;
  values?: any[]; // for 'in', 'not_in' operators
  caseSensitive?: boolean;
}

export interface AdvancedFilters {
  conditions: FilterCondition[];
  logic: 'AND' | 'OR';
  groups?: {
    conditions: FilterCondition[];
    logic: 'AND' | 'OR';
  }[];
}

export interface ExportOptions {
  format: FileFormat;
  resourceType: 'vpc' | 'transitGateway' | 'customerGateway' | 'vpcEndpoint' | 'all';
  fields?: string[];
  fieldOrder?: string[];
  filters?: any; // Legacy simple filters
  advancedFilters?: AdvancedFilters; // New advanced filtering
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
    field?: string; // Which date field to filter on
  };
  customFieldMappings?: Record<string, string>;
  // Custom field transformations
  fieldTransformations?: Record<string, (value: any) => any>;
  // Sorting options
  sortBy?: {
    field: string;
    direction: 'asc' | 'desc';
  }[];
  // Aggregation options
  aggregations?: {
    groupBy?: string[];
    functions?: {
      field: string;
      function: 'count' | 'sum' | 'avg' | 'min' | 'max';
      alias?: string;
    }[];
  };
  // Template-based export
  templateId?: string;
  templateConfig?: any;
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
    let allData: any[] = [];

    // Build filters for database query
    const dbFilters = this.buildDatabaseFilters(options);

    if (options.resourceType === 'all') {
      // Export all resource types
      const resourceTypes = ['vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint'];
      
      for (const resourceType of resourceTypes) {
        const service = this.getServiceForResourceType(resourceType);
        const result = await service.findAll({
          limit: 10000, // Large limit for export
          filters: dbFilters,
          includeDeleted: options.includeDeleted
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
          filters: dbFilters,
          includeDeleted: options.includeDeleted
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

    // Apply advanced client-side filtering if needed
    if (options.advancedFilters) {
      allData = this.applyAdvancedFilters(allData, options.advancedFilters);
    }

    // Apply date range filtering
    if (options.dateRange && (options.dateRange.startDate || options.dateRange.endDate)) {
      allData = this.applyDateRangeFilter(allData, options.dateRange);
    }

    // Apply sorting
    if (options.sortBy && options.sortBy.length > 0) {
      allData = this.applySorting(allData, options.sortBy);
    }

    // Apply aggregations if specified
    if (options.aggregations) {
      allData = this.applyAggregations(allData, options.aggregations);
    }

    return allData;
  }

  /**
   * Build database filters from options
   */
  private buildDatabaseFilters(options: ExportOptions): any {
    const filters: any = { ...options.filters };

    // Convert some advanced filters to database filters for efficiency
    if (options.advancedFilters) {
      options.advancedFilters.conditions.forEach(condition => {
        if (this.canConvertToDatabaseFilter(condition)) {
          filters[condition.field] = this.convertToDatabaseFilter(condition);
        }
      });
    }

    return filters;
  }

  /**
   * Check if a condition can be converted to database filter
   */
  private canConvertToDatabaseFilter(condition: FilterCondition): boolean {
    // Simple operators that can be handled by the database
    const dbSupportedOperators = ['equals', 'not_equals', 'greater_than', 'less_than', 
                                  'greater_than_or_equal', 'less_than_or_equal', 'in', 'not_in'];
    return dbSupportedOperators.includes(condition.operator);
  }

  /**
   * Convert condition to database filter format
   */
  private convertToDatabaseFilter(condition: FilterCondition): any {
    switch (condition.operator) {
      case 'equals':
        return condition.value;
      case 'not_equals':
        return { $ne: condition.value };
      case 'greater_than':
        return { $gt: condition.value };
      case 'less_than':
        return { $lt: condition.value };
      case 'greater_than_or_equal':
        return { $gte: condition.value };
      case 'less_than_or_equal':
        return { $lte: condition.value };
      case 'in':
        return { $in: condition.values };
      case 'not_in':
        return { $nin: condition.values };
      default:
        return condition.value;
    }
  }

  /**
   * Apply advanced filters to data
   */
  private applyAdvancedFilters(data: any[], filters: AdvancedFilters): any[] {
    return data.filter(record => this.evaluateFilters(record, filters));
  }

  /**
   * Evaluate filters against a record
   */
  private evaluateFilters(record: any, filters: AdvancedFilters): boolean {
    const conditionResults = filters.conditions.map(condition => 
      this.evaluateCondition(record, condition)
    );

    let mainResult = filters.logic === 'AND' 
      ? conditionResults.every(result => result)
      : conditionResults.some(result => result);

    // Evaluate groups if present
    if (filters.groups && filters.groups.length > 0) {
      const groupResults = filters.groups.map(group => {
        const groupConditionResults = group.conditions.map(condition =>
          this.evaluateCondition(record, condition)
        );
        
        return group.logic === 'AND'
          ? groupConditionResults.every(result => result)
          : groupConditionResults.some(result => result);
      });

      // Combine main conditions with group results using AND
      mainResult = mainResult && groupResults.every(result => result);
    }

    return mainResult;
  }

  /**
   * Evaluate a single condition against a record
   */
  private evaluateCondition(record: any, condition: FilterCondition): boolean {
    const fieldValue = this.getNestedFieldValue(record, condition.field);
    const { operator, value, values, caseSensitive = true } = condition;

    switch (operator) {
      case 'equals':
        return this.compareValues(fieldValue, value, caseSensitive, (a, b) => a === b);
      
      case 'not_equals':
        return this.compareValues(fieldValue, value, caseSensitive, (a, b) => a !== b);
      
      case 'contains':
        return this.stringContains(fieldValue, value, caseSensitive);
      
      case 'not_contains':
        return !this.stringContains(fieldValue, value, caseSensitive);
      
      case 'starts_with':
        return this.stringStartsWith(fieldValue, value, caseSensitive);
      
      case 'ends_with':
        return this.stringEndsWith(fieldValue, value, caseSensitive);
      
      case 'greater_than':
        return fieldValue > value;
      
      case 'less_than':
        return fieldValue < value;
      
      case 'greater_than_or_equal':
        return fieldValue >= value;
      
      case 'less_than_or_equal':
        return fieldValue <= value;
      
      case 'in':
        return values ? values.includes(fieldValue) : false;
      
      case 'not_in':
        return values ? !values.includes(fieldValue) : true;
      
      case 'is_null':
        return fieldValue == null;
      
      case 'is_not_null':
        return fieldValue != null;
      
      case 'between':
        return Array.isArray(value) && value.length >= 2 
          ? fieldValue >= value[0] && fieldValue <= value[1]
          : false;
      
      case 'regex':
        try {
          const regex = new RegExp(value, caseSensitive ? '' : 'i');
          return regex.test(String(fieldValue || ''));
        } catch {
          return false;
        }
      
      default:
        return false;
    }
  }

  /**
   * Get nested field value from record
   */
  private getNestedFieldValue(record: any, field: string): any {
    return field.split('.').reduce((obj, key) => obj?.[key], record);
  }

  /**
   * Compare values with case sensitivity option
   */
  private compareValues(a: any, b: any, caseSensitive: boolean, compareFn: (a: any, b: any) => boolean): boolean {
    if (!caseSensitive && typeof a === 'string' && typeof b === 'string') {
      return compareFn(a.toLowerCase(), b.toLowerCase());
    }
    return compareFn(a, b);
  }

  /**
   * Check if string contains value
   */
  private stringContains(str: any, value: any, caseSensitive: boolean): boolean {
    const strVal = String(str || '');
    const searchVal = String(value || '');
    
    if (!caseSensitive) {
      return strVal.toLowerCase().includes(searchVal.toLowerCase());
    }
    return strVal.includes(searchVal);
  }

  /**
   * Check if string starts with value
   */
  private stringStartsWith(str: any, value: any, caseSensitive: boolean): boolean {
    const strVal = String(str || '');
    const searchVal = String(value || '');
    
    if (!caseSensitive) {
      return strVal.toLowerCase().startsWith(searchVal.toLowerCase());
    }
    return strVal.startsWith(searchVal);
  }

  /**
   * Check if string ends with value
   */
  private stringEndsWith(str: any, value: any, caseSensitive: boolean): boolean {
    const strVal = String(str || '');
    const searchVal = String(value || '');
    
    if (!caseSensitive) {
      return strVal.toLowerCase().endsWith(searchVal.toLowerCase());
    }
    return strVal.endsWith(searchVal);
  }

  /**
   * Apply date range filter
   */
  private applyDateRangeFilter(data: any[], dateRange: { startDate?: Date; endDate?: Date; field?: string }): any[] {
    const dateField = dateRange.field || 'createdAt';
    
    return data.filter(record => {
      const recordDate = new Date(record[dateField]);
      
      if (isNaN(recordDate.getTime())) {
        return false; // Invalid date
      }

      if (dateRange.startDate && recordDate < dateRange.startDate) {
        return false;
      }

      if (dateRange.endDate && recordDate > dateRange.endDate) {
        return false;
      }

      return true;
    });
  }

  /**
   * Apply sorting to data
   */
  private applySorting(data: any[], sortBy: { field: string; direction: 'asc' | 'desc' }[]): any[] {
    return data.sort((a, b) => {
      for (const sort of sortBy) {
        const aVal = this.getNestedFieldValue(a, sort.field);
        const bVal = this.getNestedFieldValue(b, sort.field);
        
        let comparison = 0;
        
        if (aVal < bVal) comparison = -1;
        else if (aVal > bVal) comparison = 1;
        
        if (comparison !== 0) {
          return sort.direction === 'asc' ? comparison : -comparison;
        }
      }
      
      return 0;
    });
  }

  /**
   * Apply aggregations to data
   */
  private applyAggregations(data: any[], aggregations: { groupBy?: string[]; functions?: { field: string; function: 'count' | 'sum' | 'avg' | 'min' | 'max'; alias?: string; }[]; }): any[] {
    if (!aggregations.groupBy || aggregations.groupBy.length === 0) {
      // Global aggregation
      if (!aggregations.functions || aggregations.functions.length === 0) {
        return data;
      }

      const result: any = {};
      
      aggregations.functions.forEach(func => {
        const alias = func.alias || `${func.function}_${func.field}`;
        result[alias] = this.calculateAggregateFunction(data, func.field, func.function);
      });

      return [result];
    }

    // Group by aggregation
    const groups = new Map<string, any[]>();
    
    data.forEach(record => {
      const groupKey = aggregations.groupBy!.map(field => 
        this.getNestedFieldValue(record, field)
      ).join('|');
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(record);
    });

    const aggregatedData: any[] = [];
    
    groups.forEach((groupData, groupKey) => {
      const result: any = {};
      
      // Add group by fields
      const groupValues = groupKey.split('|');
      aggregations.groupBy!.forEach((field, index) => {
        result[field] = groupValues[index];
      });

      // Add aggregate functions
      if (aggregations.functions) {
        aggregations.functions.forEach(func => {
          const alias = func.alias || `${func.function}_${func.field}`;
          result[alias] = this.calculateAggregateFunction(groupData, func.field, func.function);
        });
      }

      aggregatedData.push(result);
    });

    return aggregatedData;
  }

  /**
   * Calculate aggregate function
   */
  private calculateAggregateFunction(data: any[], field: string, func: 'count' | 'sum' | 'avg' | 'min' | 'max'): any {
    const values = data.map(record => this.getNestedFieldValue(record, field)).filter(val => val != null);
    
    switch (func) {
      case 'count':
        return values.length;
      
      case 'sum':
        return values.reduce((sum, val) => sum + (Number(val) || 0), 0);
      
      case 'avg':
        return values.length > 0 ? values.reduce((sum, val) => sum + (Number(val) || 0), 0) / values.length : 0;
      
      case 'min':
        return values.length > 0 ? Math.min(...values.map(val => Number(val) || 0)) : null;
      
      case 'max':
        return values.length > 0 ? Math.max(...values.map(val => Number(val) || 0)) : null;
      
      default:
        return null;
    }
  }

  /**
   * Process batch of records for export
   */
  private async processBatch(records: any[], options: ExportOptions): Promise<any[]> {
    return records.map(record => {
      let processedRecord = { ...record };

      // Apply field transformations first
      if (options.fieldTransformations) {
        Object.entries(options.fieldTransformations).forEach(([field, transform]) => {
          if (processedRecord[field] !== undefined) {
            try {
              processedRecord[field] = transform(processedRecord[field]);
            } catch (error) {
              console.warn(`Field transformation failed for ${field}:`, error);
            }
          }
        });
      }

      // Apply custom field mappings
      if (options.customFieldMappings) {
        const mappedRecord: any = {};
        Object.entries(processedRecord).forEach(([key, value]) => {
          const mappedKey = options.customFieldMappings![key] || key;
          mappedRecord[mappedKey] = value;
        });
        processedRecord = mappedRecord;
      }

      // Apply field selection and ordering
      if (options.fields && options.fields.length > 0) {
        const orderedRecord: any = {};
        
        // Use fieldOrder if specified, otherwise use fields order
        const fieldOrder = options.fieldOrder || options.fields;
        
        fieldOrder.forEach(field => {
          if (processedRecord[field] !== undefined) {
            orderedRecord[field] = processedRecord[field];
          }
        });
        
        // Add any remaining fields not in the order specification
        Object.keys(processedRecord).forEach(key => {
          if (!fieldOrder.includes(key) && options.fields!.includes(key)) {
            orderedRecord[key] = processedRecord[key];
          }
        });
        
        processedRecord = orderedRecord;
      } else if (options.fieldOrder) {
        // Apply field ordering without filtering
        const orderedRecord: any = {};
        
        options.fieldOrder.forEach(field => {
          if (processedRecord[field] !== undefined) {
            orderedRecord[field] = processedRecord[field];
          }
        });
        
        // Add any remaining fields
        Object.keys(processedRecord).forEach(key => {
          if (!options.fieldOrder!.includes(key)) {
            orderedRecord[key] = processedRecord[key];
          }
        });
        
        processedRecord = orderedRecord;
      }

      // Add audit info if requested
      if (options.includeAuditInfo) {
        processedRecord._auditInfo = {
          exportedAt: new Date().toISOString(),
          exportedBy: options.userId,
          originalId: record.id
        };
      }

      return processedRecord;
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