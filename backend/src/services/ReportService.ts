/**
 * Report Service
 * Core report generation service with comprehensive template system,
 * multi-format output support, and integration with data and export services
 */

import { ServiceResponse, PaginatedResponse, QueryOptions, ServiceError } from './BaseService';
import { ReportDataService, reportDataService } from './ReportDataService';
import { ExportServiceBase } from './export/ExportServiceBase';
import { ReportTemplateEngine, reportTemplateEngine, ReportTemplate, TemplateRenderContext, TemplateRenderResult } from '../templates/ReportTemplateEngine';
import { TemplateManager, createTemplateManager, TemplateCreateInput, TemplateUpdateInput, TemplateSearchFilters } from '../templates/managers/TemplateManager';
import { ExportFormat, ExportOptions, ExportResult } from '../types/export';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';

// Logger for report service
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.label({ label: 'ReportService' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
  ],
});

// Report generation interfaces
export interface ReportGenerationOptions {
  templateId: string;
  dataFilters?: Record<string, any>;
  outputFormat?: 'HTML' | 'PDF' | 'EXCEL' | 'CSV' | 'JSON';
  includeMetadata?: boolean;
  customOptions?: Record<string, any>;
  theme?: string;
  locale?: string;
  timezone?: string;
  userId?: string;
  reportTitle?: string;
  compression?: boolean;
}

export interface ReportDefinition {
  id: string;
  name: string;
  description: string;
  templateId: string;
  dataQuery: {
    type: 'vpc' | 'transitGateway' | 'customerGateway' | 'vpcEndpoint' | 'custom';
    filters?: Record<string, any>;
    aggregations?: any[];
    customQuery?: string;
  };
  schedule?: {
    enabled: boolean;
    cron?: string;
    frequency?: 'daily' | 'weekly' | 'monthly';
    timezone?: string;
  };
  distribution?: {
    email?: string[];
    webhook?: string;
    storage?: {
      path: string;
      retention: number; // days
    };
  };
  metadata: {
    author: string;
    createdAt: Date;
    updatedAt: Date;
    tags: string[];
    category: string;
    isActive: boolean;
  };
}

export interface ReportExecution {
  id: string;
  reportDefinitionId: string;
  templateId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress?: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  recordCount?: number;
  outputSize?: number;
  outputPath?: string;
  outputFormat: string;
  error?: string;
  triggeredBy: 'manual' | 'schedule' | 'api';
  userId?: string;
  metadata?: Record<string, any>;
}

export interface ReportGenerationResult {
  executionId: string;
  templateId: string;
  output: string | Buffer;
  metadata: {
    generationTime: number;
    recordCount: number;
    outputSize: number;
    format: string;
    timestamp: Date;
    reportTitle: string;
  };
  exportResult?: ExportResult;
}

/**
 * Network Report Export Service
 * Extends ExportServiceBase to provide network-specific report exports
 */
class NetworkReportExportService extends ExportServiceBase {
  private reportService: ReportService;

  constructor(reportService: ReportService) {
    super({
      allowedFormats: [ExportFormat.PDF, ExportFormat.EXCEL, ExportFormat.CSV, ExportFormat.JSON],
      maxConcurrentExports: 5,
      defaultBatchSize: 1000,
    });
    this.reportService = reportService;
  }

  protected async fetchData(options: ExportOptions): Promise<any[]> {
    // Use report data service to fetch data
    const result = await reportDataService.getVPCsByProvider(undefined, {
      useCache: true,
    });

    if (!result.success || !result.data) {
      throw new Error('Failed to fetch report data');
    }

    return result.data;
  }

  protected async formatData(data: any[], format: ExportFormat, options: ExportOptions): Promise<Buffer> {
    switch (format) {
      case ExportFormat.CSV:
        return this.formatAsCSV(data);
      case ExportFormat.JSON:
        return this.formatAsJSON(data);
      case ExportFormat.EXCEL:
        return this.formatAsExcel(data);
      case ExportFormat.PDF:
        return this.formatAsPDF(data);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  protected validateOptions(options: ExportOptions): void {
    if (!options.resourceType) {
      throw new Error('Resource type is required');
    }
  }

  private formatAsCSV(data: any[]): Buffer {
    if (!data.length) return Buffer.from('');

    const headers = Object.keys(data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(',')),
    ];

    return Buffer.from(csvRows.join('\n'));
  }

  private formatAsJSON(data: any[]): Buffer {
    return Buffer.from(JSON.stringify(data, null, 2));
  }

  private formatAsExcel(data: any[]): Buffer {
    // This would use a library like exceljs in a real implementation
    // For now, return CSV format
    return this.formatAsCSV(data);
  }

  private formatAsPDF(data: any[]): Buffer {
    // This would use a library like puppeteer or pdfkit in a real implementation
    // For now, return formatted text
    const text = data.map(item => JSON.stringify(item, null, 2)).join('\n\n');
    return Buffer.from(text);
  }
}

/**
 * Report Service
 *
 * Comprehensive report generation service providing template-based reports,
 * multi-format output, data integration, and scheduled report execution.
 */
export class ReportService {
  private templateEngine: ReportTemplateEngine;
  private templateManager: TemplateManager;
  private dataService: ReportDataService;
  private exportService: NetworkReportExportService;
  private isInitialized = false;
  private eventEmitter: EventEmitter;

  // In-memory storage for demo (would use database in production)
  private reportDefinitions = new Map<string, ReportDefinition>();
  private reportExecutions = new Map<string, ReportExecution>();

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.templateEngine = reportTemplateEngine;
    this.templateManager = createTemplateManager(this.templateEngine);
    this.dataService = reportDataService;
    this.exportService = new NetworkReportExportService(this);
  }

  /**
   * Initialize the report service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.info('Report service already initialized');
      return;
    }

    try {
      logger.info('Initializing report service...');

      // Initialize template engine and manager
      await this.templateEngine.initialize();
      await this.templateManager.initialize();

      // Initialize data service
      await this.dataService.initialize();

      // Setup event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      logger.info('Report service initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize report service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  // ===================== REPORT GENERATION =====================

  /**
   * Generate report using template
   */
  public async generateReport(options: ReportGenerationOptions): Promise<ServiceResponse<ReportGenerationResult>> {
    await this.ensureInitialized();

    const startTime = Date.now();
    const executionId = this.generateExecutionId();

    try {
      logger.debug('Starting report generation', {
        executionId,
        templateId: options.templateId,
        outputFormat: options.outputFormat,
      });

      // Create execution record
      const execution: ReportExecution = {
        id: executionId,
        reportDefinitionId: '', // For ad-hoc reports
        templateId: options.templateId,
        status: 'running',
        progress: 0,
        startTime: new Date(),
        outputFormat: options.outputFormat || 'HTML',
        triggeredBy: 'manual',
        userId: options.userId,
        metadata: options.customOptions,
      };

      this.reportExecutions.set(executionId, execution);
      this.eventEmitter.emit('execution:started', execution);

      // Get template
      const templateResult = await this.templateManager.findById(options.templateId);
      if (!templateResult.success || !templateResult.data) {
        execution.status = 'failed';
        execution.error = 'Template not found';
        execution.endTime = new Date();
        this.reportExecutions.set(executionId, execution);
        this.eventEmitter.emit('execution:failed', execution);

        return this.createSingleErrorResponse(
          'TEMPLATE_NOT_FOUND',
          `Template not found: ${options.templateId}`
        );
      }

      const template = templateResult.data;
      execution.progress = 20;
      this.reportExecutions.set(executionId, execution);
      this.eventEmitter.emit('execution:progress', execution);

      // Fetch data based on template requirements
      const data = await this.fetchReportData(template, options.dataFilters);
      execution.progress = 50;
      execution.recordCount = Array.isArray(data) ? data.length : 1;
      this.reportExecutions.set(executionId, execution);
      this.eventEmitter.emit('execution:progress', execution);

      // Prepare render context
      const renderContext: TemplateRenderContext = {
        data,
        options: {
          timezone: options.timezone,
          locale: options.locale,
          theme: options.theme,
        },
        metadata: {
          reportTitle: options.reportTitle || template.name,
          reportDate: new Date(),
          generatedBy: options.userId || 'System',
          version: template.version,
        },
      };

      // Render template
      const renderResult = await this.templateEngine.renderTemplate(options.templateId, renderContext);
      execution.progress = 80;
      this.reportExecutions.set(executionId, execution);
      this.eventEmitter.emit('execution:progress', execution);

      // Record template usage
      this.templateManager.recordTemplateUsage(options.templateId, options.userId);

      let finalOutput: string | Buffer = renderResult.output;
      let exportResult: ExportResult | undefined;

      // Handle format conversion if needed
      if (options.outputFormat && options.outputFormat !== template.format) {
        try {
          const exportOptions: ExportOptions = {
            format: this.mapToExportFormat(options.outputFormat),
            resourceType: 'report',
            fileName: `${template.name.replace(/\s+/g, '-')}.${options.outputFormat.toLowerCase()}`,
            userId: options.userId,
          };

          const exportId = await this.exportService.startExport(exportOptions);
          exportResult = this.exportService.getExportResult(exportId) || undefined;

          if (exportResult && exportResult.success) {
            finalOutput = exportResult.fileBuffer;
          }
        } catch (exportError) {
          logger.warn('Format conversion failed, using original format', {
            originalFormat: template.format,
            requestedFormat: options.outputFormat,
            error: exportError instanceof Error ? exportError.message : 'Unknown error',
          });
        }
      }

      // Complete execution
      const generationTime = Date.now() - startTime;
      execution.status = 'completed';
      execution.progress = 100;
      execution.endTime = new Date();
      execution.duration = generationTime;
      execution.outputSize = Buffer.isBuffer(finalOutput) ? finalOutput.length : finalOutput.length;
      this.reportExecutions.set(executionId, execution);
      this.eventEmitter.emit('execution:completed', execution);

      const result: ReportGenerationResult = {
        executionId,
        templateId: options.templateId,
        output: finalOutput,
        metadata: {
          generationTime,
          recordCount: execution.recordCount || 0,
          outputSize: execution.outputSize || 0,
          format: options.outputFormat || template.format,
          timestamp: new Date(),
          reportTitle: renderContext.metadata.reportTitle || template.name,
        },
        exportResult,
      };

      logger.info('Report generated successfully', {
        executionId,
        templateId: options.templateId,
        generationTime,
        recordCount: result.metadata.recordCount,
        outputSize: result.metadata.outputSize,
      });

      return this.createSuccessResponse(result, 'Report generated successfully');

    } catch (error) {
      const execution = this.reportExecutions.get(executionId);
      if (execution) {
        execution.status = 'failed';
        execution.error = error instanceof Error ? error.message : 'Unknown error';
        execution.endTime = new Date();
        execution.duration = Date.now() - startTime;
        this.reportExecutions.set(executionId, execution);
        this.eventEmitter.emit('execution:failed', execution);
      }

      logger.error('Report generation failed', {
        executionId,
        templateId: options.templateId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      });

      return this.createSingleErrorResponse(
        'REPORT_GENERATION_ERROR',
        'Failed to generate report',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== REPORT DEFINITION MANAGEMENT =====================

  /**
   * Create report definition
   */
  public async create(data: Omit<ReportDefinition, 'id' | 'metadata'> & { userId?: string }): Promise<ServiceResponse<ReportDefinition>> {
    await this.ensureInitialized();

    try {
      const reportId = this.generateReportId(data.name);

      const reportDefinition: ReportDefinition = {
        id: reportId,
        name: data.name,
        description: data.description,
        templateId: data.templateId,
        dataQuery: data.dataQuery,
        schedule: data.schedule,
        distribution: data.distribution,
        metadata: {
          author: data.userId || 'system',
          createdAt: new Date(),
          updatedAt: new Date(),
          tags: [],
          category: 'general',
          isActive: true,
        },
      };

      // Validate template exists
      const templateResult = await this.templateManager.findById(data.templateId);
      if (!templateResult.success || !templateResult.data) {
        return this.createSingleErrorResponse(
          'TEMPLATE_NOT_FOUND',
          `Template not found: ${data.templateId}`
        );
      }

      this.reportDefinitions.set(reportId, reportDefinition);

      logger.info('Report definition created', {
        reportId,
        name: data.name,
        templateId: data.templateId,
      });

      return this.createSuccessResponse(reportDefinition, 'Report definition created successfully');

    } catch (error) {
      logger.error('Failed to create report definition', {
        error: error instanceof Error ? error.message : 'Unknown error',
        name: data.name,
      });

      return this.createSingleErrorResponse(
        'REPORT_CREATION_ERROR',
        'Failed to create report definition',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Find report definition by ID
   */
  public async findById(id: string): Promise<ServiceResponse<ReportDefinition>> {
    await this.ensureInitialized();

    try {
      const reportDefinition = this.reportDefinitions.get(id);

      if (!reportDefinition) {
        return this.createSingleErrorResponse(
          'REPORT_NOT_FOUND',
          `Report definition not found: ${id}`
        );
      }

      return this.createSuccessResponse(reportDefinition, 'Report definition retrieved successfully');

    } catch (error) {
      logger.error('Failed to find report definition', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: id,
      });

      return this.createSingleErrorResponse(
        'REPORT_RETRIEVAL_ERROR',
        'Failed to retrieve report definition',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Update report definition
   */
  public async update(id: string, data: Partial<ReportDefinition>, userId?: string): Promise<ServiceResponse<ReportDefinition>> {
    await this.ensureInitialized();

    try {
      const existing = this.reportDefinitions.get(id);
      if (!existing) {
        return this.createSingleErrorResponse(
          'REPORT_NOT_FOUND',
          `Report definition not found: ${id}`
        );
      }

      const updated: ReportDefinition = {
        ...existing,
        ...data,
        id, // Prevent ID changes
        metadata: {
          ...existing.metadata,
          ...data.metadata,
          updatedAt: new Date(),
        },
      };

      // Validate template if changed
      if (data.templateId && data.templateId !== existing.templateId) {
        const templateResult = await this.templateManager.findById(data.templateId);
        if (!templateResult.success || !templateResult.data) {
          return this.createSingleErrorResponse(
            'TEMPLATE_NOT_FOUND',
            `Template not found: ${data.templateId}`
          );
        }
      }

      this.reportDefinitions.set(id, updated);

      logger.info('Report definition updated', {
        reportId: id,
        updatedBy: userId,
      });

      return this.createSuccessResponse(updated, 'Report definition updated successfully');

    } catch (error) {
      logger.error('Failed to update report definition', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: id,
      });

      return this.createSingleErrorResponse(
        'REPORT_UPDATE_ERROR',
        'Failed to update report definition',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Delete report definition
   */
  public async delete(id: string, userId?: string): Promise<ServiceResponse<boolean>> {
    await this.ensureInitialized();

    try {
      const reportDefinition = this.reportDefinitions.get(id);
      if (!reportDefinition) {
        return this.createSingleErrorResponse(
          'REPORT_NOT_FOUND',
          `Report definition not found: ${id}`
        );
      }

      this.reportDefinitions.delete(id);

      logger.info('Report definition deleted', {
        reportId: id,
        deletedBy: userId,
      });

      return this.createSuccessResponse(true, 'Report definition deleted successfully');

    } catch (error) {
      logger.error('Failed to delete report definition', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportId: id,
      });

      return this.createSingleErrorResponse(
        'REPORT_DELETION_ERROR',
        'Failed to delete report definition',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Find all report definitions
   */
  public async findAll(options?: QueryOptions): Promise<ServiceResponse<PaginatedResponse<ReportDefinition>>> {
    await this.ensureInitialized();

    try {
      let reports = Array.from(this.reportDefinitions.values());

      // Apply filtering if needed
      if (options?.filters) {
        reports = this.applyReportFilters(reports, options.filters);
      }

      // Apply sorting
      if (options?.sortBy) {
        reports = this.applyReportSorting(reports, options.sortBy, options.sortOrder || 'ASC');
      }

      // Apply pagination
      const { page, limit, offset } = this.applyPagination(options || {});
      const paginatedReports = reports.slice(offset, offset + limit);

      const response = this.createPaginatedResponse(
        paginatedReports,
        reports.length,
        page,
        limit
      );

      return this.createSuccessResponse(response, 'Report definitions retrieved successfully');

    } catch (error) {
      logger.error('Failed to retrieve report definitions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        options,
      });

      return this.createSingleErrorResponse(
        'REPORTS_RETRIEVAL_ERROR',
        'Failed to retrieve report definitions',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== EXECUTION MANAGEMENT =====================

  /**
   * Get execution status
   */
  public getExecutionStatus(executionId: string): ServiceResponse<ReportExecution | null> {
    try {
      const execution = this.reportExecutions.get(executionId);
      return this.createSuccessResponse(execution || null, 'Execution status retrieved successfully');
    } catch (error) {
      return this.createSingleErrorResponse(
        'EXECUTION_STATUS_ERROR',
        'Failed to get execution status',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Cancel execution
   */
  public async cancelExecution(executionId: string): Promise<ServiceResponse<boolean>> {
    try {
      const execution = this.reportExecutions.get(executionId);
      if (!execution) {
        return this.createSingleErrorResponse(
          'EXECUTION_NOT_FOUND',
          `Execution not found: ${executionId}`
        );
      }

      if (execution.status === 'completed' || execution.status === 'failed') {
        return this.createSingleErrorResponse(
          'EXECUTION_ALREADY_FINISHED',
          'Cannot cancel completed or failed execution'
        );
      }

      execution.status = 'cancelled';
      execution.endTime = new Date();
      this.reportExecutions.set(executionId, execution);
      this.eventEmitter.emit('execution:cancelled', execution);

      return this.createSuccessResponse(true, 'Execution cancelled successfully');

    } catch (error) {
      return this.createSingleErrorResponse(
        'EXECUTION_CANCEL_ERROR',
        'Failed to cancel execution',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Get execution history
   */
  public getExecutionHistory(
    reportDefinitionId?: string,
    limit: number = 50
  ): ServiceResponse<ReportExecution[]> {
    try {
      let executions = Array.from(this.reportExecutions.values());

      if (reportDefinitionId) {
        executions = executions.filter(exec => exec.reportDefinitionId === reportDefinitionId);
      }

      // Sort by start time (newest first)
      executions.sort((a, b) => b.startTime.getTime() - a.startTime.getTime());

      // Apply limit
      executions = executions.slice(0, limit);

      return this.createSuccessResponse(executions, 'Execution history retrieved successfully');

    } catch (error) {
      return this.createSingleErrorResponse(
        'EXECUTION_HISTORY_ERROR',
        'Failed to get execution history',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== TEMPLATE MANAGEMENT DELEGATION =====================

  /**
   * Get available templates
   */
  public async getAvailableTemplates(filters?: TemplateSearchFilters): Promise<ServiceResponse<ReportTemplate[]>> {
    await this.ensureInitialized();

    try {
      if (filters) {
        const result = await this.templateManager.searchTemplates(filters);
        if (result.success && result.data) {
          return this.createSuccessResponse(result.data.data, 'Templates retrieved successfully');
        }
        return result as any;
      } else {
        const result = await this.templateManager.findAll();
        if (result.success && result.data) {
          return this.createSuccessResponse(result.data.data, 'Templates retrieved successfully');
        }
        return result as any;
      }
    } catch (error) {
      return this.createSingleErrorResponse(
        'TEMPLATE_RETRIEVAL_ERROR',
        'Failed to retrieve templates',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Create template
   */
  public async createTemplate(data: TemplateCreateInput, userId?: string): Promise<ServiceResponse<ReportTemplate>> {
    await this.ensureInitialized();
    return this.templateManager.create(data, userId);
  }

  /**
   * Update template
   */
  public async updateTemplate(
    templateId: string,
    data: TemplateUpdateInput,
    userId?: string
  ): Promise<ServiceResponse<ReportTemplate>> {
    await this.ensureInitialized();
    return this.templateManager.update(templateId, data, userId);
  }

  /**
   * Delete template
   */
  public async deleteTemplate(templateId: string, userId?: string): Promise<ServiceResponse<boolean>> {
    await this.ensureInitialized();
    return this.templateManager.delete(templateId, userId);
  }

  // ===================== SERVICE STATISTICS =====================

  /**
   * Get service statistics
   */
  public async getServiceStatistics(): Promise<ServiceResponse<{
    reports: {
      total: number;
      active: number;
      byCategory: Record<string, number>;
    };
    executions: {
      total: number;
      completed: number;
      failed: number;
      running: number;
      recentActivity: { date: string; count: number }[];
    };
    templates: {
      total: number;
      byFormat: Record<string, number>;
      byCategory: Record<string, number>;
    };
  }>> {
    try {
      const reports = Array.from(this.reportDefinitions.values());
      const executions = Array.from(this.reportExecutions.values());

      // Report statistics
      const reportStats = {
        total: reports.length,
        active: reports.filter(r => r.metadata.isActive).length,
        byCategory: {} as Record<string, number>,
      };

      reports.forEach(report => {
        reportStats.byCategory[report.metadata.category] =
          (reportStats.byCategory[report.metadata.category] || 0) + 1;
      });

      // Execution statistics
      const executionStats = {
        total: executions.length,
        completed: executions.filter(e => e.status === 'completed').length,
        failed: executions.filter(e => e.status === 'failed').length,
        running: executions.filter(e => e.status === 'running').length,
        recentActivity: [] as { date: string; count: number }[],
      };

      // Recent activity (last 7 days)
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - i);
        return date.toISOString().split('T')[0];
      }).reverse();

      executionStats.recentActivity = last7Days.map(date => ({
        date,
        count: executions.filter(e =>
          e.startTime.toISOString().split('T')[0] === date
        ).length,
      }));

      // Template statistics
      const templateStatsResult = this.templateManager.getManagerStatistics();
      const templateStats = templateStatsResult.success && templateStatsResult.data ?
        {
          total: templateStatsResult.data.totalTemplates,
          byFormat: templateStatsResult.data.templatesByFormat,
          byCategory: templateStatsResult.data.templatesByCategory,
        } : {
          total: 0,
          byFormat: {},
          byCategory: {},
        };

      const statistics = {
        reports: reportStats,
        executions: executionStats,
        templates: templateStats,
      };

      return this.createSuccessResponse(statistics, 'Service statistics retrieved successfully');

    } catch (error) {
      return this.createSingleErrorResponse(
        'STATISTICS_ERROR',
        'Failed to get service statistics',
        undefined,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  // ===================== EVENT MANAGEMENT =====================

  /**
   * Add event listener
   */
  public on(event: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.on(event, listener);
    return this;
  }

  /**
   * Remove event listener
   */
  public off(event: string, listener: (...args: any[]) => void): this {
    this.eventEmitter.off(event, listener);
    return this;
  }

  /**
   * Emit event
   */
  public emit(event: string, ...args: any[]): boolean {
    return this.eventEmitter.emit(event, ...args);
  }

  // ===================== BASE SERVICE METHODS =====================

  /**
   * Create a success response
   */
  protected createSuccessResponse<T>(data: T, message?: string): ServiceResponse<T> {
    return {
      success: true,
      data,
      message
    };
  }

  /**
   * Create an error response
   */
  protected createErrorResponse(errors: ServiceError[], message?: string): ServiceResponse<any> {
    return {
      success: false,
      errors,
      message
    };
  }

  /**
   * Create a single error response
   */
  protected createSingleErrorResponse(
    code: string,
    message: string,
    field?: string,
    details?: any
  ): ServiceResponse<any> {
    return this.createErrorResponse([{ code, message, field, details }]);
  }

  /**
   * Apply pagination to query options
   */
  protected applyPagination(options: QueryOptions): { page: number; limit: number; offset: number } {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(100, Math.max(1, options.limit || 10));
    const offset = (page - 1) * limit;

    return { page, limit, offset };
  }

  /**
   * Create paginated response
   */
  protected createPaginatedResponse<T>(
    data: T[],
    totalCount: number,
    page: number,
    limit: number
  ): PaginatedResponse<T> {
    return {
      data,
      totalCount,
      page,
      limit,
      hasNextPage: page * limit < totalCount,
      hasPrevPage: page > 1
    };
  }

  // ===================== UTILITY METHODS =====================

  /**
   * Fetch report data based on template requirements
   */
  private async fetchReportData(template: ReportTemplate, filters?: Record<string, any>): Promise<any> {
    // Determine data type based on template category and report types
    const reportTypes = template.metadata.reportTypes;

    if (reportTypes.includes('vpc-inventory') || reportTypes.includes('network-summary')) {
      const result = await this.dataService.getVPCsByProvider(undefined, { useCache: true });
      return result.success ? result.data : [];
    }

    if (reportTypes.includes('tgw-connectivity')) {
      // Would fetch transit gateway data
      return [];
    }

    if (reportTypes.includes('subnet-utilization')) {
      const result = await this.dataService.getSubnetUtilization(undefined, { useCache: true });
      return result.success ? result.data : [];
    }

    // Default: return empty data
    return [];
  }

  /**
   * Map output format to export format
   */
  private mapToExportFormat(outputFormat: string): ExportFormat {
    switch (outputFormat.toUpperCase()) {
      case 'PDF': return ExportFormat.PDF;
      case 'EXCEL': return ExportFormat.EXCEL;
      case 'CSV': return ExportFormat.CSV;
      case 'JSON': return ExportFormat.JSON;
      default: return ExportFormat.JSON;
    }
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Listen to template engine events
    this.templateEngine.on('error', (error) => {
      logger.error('Template engine error', { error });
      this.eventEmitter.emit('template:error', error);
    });

    // Listen to export service events
    this.exportService.on('export:completed', (data) => {
      logger.debug('Export completed', { exportId: data.exportId });
      this.eventEmitter.emit('export:completed', data);
    });

    this.exportService.on('export:failed', (data) => {
      logger.error('Export failed', { exportId: data.exportId, error: data.error });
      this.eventEmitter.emit('export:failed', data);
    });
  }

  /**
   * Apply filters to report list
   */
  private applyReportFilters(reports: ReportDefinition[], filters: Record<string, any>): ReportDefinition[] {
    return reports.filter(report => {
      if (filters.category && report.metadata.category !== filters.category) return false;
      if (filters.isActive !== undefined && report.metadata.isActive !== filters.isActive) return false;
      if (filters.author && report.metadata.author !== filters.author) return false;
      if (filters.templateId && report.templateId !== filters.templateId) return false;

      if (filters.namePattern) {
        const regex = new RegExp(filters.namePattern, 'i');
        if (!regex.test(report.name)) return false;
      }

      return true;
    });
  }

  /**
   * Apply sorting to report list
   */
  private applyReportSorting(
    reports: ReportDefinition[],
    sortBy: string,
    sortOrder: 'ASC' | 'DESC'
  ): ReportDefinition[] {
    return reports.sort((a, b) => {
      let valueA: any;
      let valueB: any;

      switch (sortBy) {
        case 'name':
          valueA = a.name;
          valueB = b.name;
          break;
        case 'createdAt':
          valueA = a.metadata.createdAt;
          valueB = b.metadata.createdAt;
          break;
        case 'updatedAt':
          valueA = a.metadata.updatedAt;
          valueB = b.metadata.updatedAt;
          break;
        case 'category':
          valueA = a.metadata.category;
          valueB = b.metadata.category;
          break;
        default:
          return 0;
      }

      if (valueA < valueB) return sortOrder === 'ASC' ? -1 : 1;
      if (valueA > valueB) return sortOrder === 'ASC' ? 1 : -1;
      return 0;
    });
  }

  /**
   * Generate unique execution ID
   */
  private generateExecutionId(): string {
    return `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique report ID
   */
  private generateReportId(name: string): string {
    const sanitizedName = name.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-');

    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);

    return `rpt_${sanitizedName}_${timestamp}_${random}`;
  }

  /**
   * Ensure service is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Shutdown the service
   */
  public async shutdown(): Promise<void> {
    logger.info('Shutting down report service...');

    try {
      // Shutdown components
      await this.exportService.shutdown();
      await this.templateManager.shutdown();
      await this.templateEngine.shutdown();
      await this.dataService.close();

      // Clear memory
      this.reportDefinitions.clear();
      this.reportExecutions.clear();

      this.isInitialized = false;
      logger.info('Report service shutdown complete');

    } catch (error) {
      logger.error('Error during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

// Export singleton instance
export const reportService = new ReportService();

// Convenience functions
export const initializeReportService = async (): Promise<void> => {
  return reportService.initialize();
};

export const getReportService = (): ReportService => {
  return reportService;
};

export const shutdownReportService = async (): Promise<void> => {
  return reportService.shutdown();
};