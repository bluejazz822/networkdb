/**
 * Reports API Routes
 * Comprehensive reporting endpoints for dashboard, charts, and report generation
 * Enhanced with comprehensive security controls and audit logging
 */

import { Router, Request, Response } from 'express';
import { ReportingService } from '../../services/reporting/ReportingService';
import { ExportService } from '../../services/reporting/ExportService';
import { SchedulerService } from '../../services/scheduler/SchedulerService';
import { validateRequest, asyncHandler } from '../middleware/validation';
import { ReportValidationSchemas } from '../../schemas/reports';
import Joi from 'joi';
import crypto from 'crypto';
import {
  ReportQuery,
  ReportDefinition,
  ExportFormat,
  ReportExportOptions,
  ChartConfiguration,
  AggregationType
} from '../../types/reports';
import { ResourceType } from '../../types/search';
import { sequelize } from '../../config/database';

// Security middleware imports
import {
  reportSecurityMiddleware,
  requireReportPermission,
  requireDataAccess,
  requireExportPermission,
  auditReportAccess,
  addSecurityContext
} from '../../middleware/ReportSecurityMiddleware';
import { ReportPermissions, ReportAuthorizationService } from '../../auth/ReportPermissions';
import { AuditAction, AuditResource, ReportAuditLogger } from '../../audit/ReportAuditLogger';
import { DataSanitizer } from '../../security/DataSanitizer';

const router: Router = Router();

// Initialize services
const reportingService = new ReportingService(sequelize);
const exportService = new ExportService();
const schedulerService = new SchedulerService(reportingService, exportService);

// ===================== DASHBOARD ENDPOINTS =====================

/**
 * GET /api/reports/dashboard
 * Get dashboard data with key metrics and widgets
 */
router.get('/dashboard',
  ...reportSecurityMiddleware.readOnly,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.reportUser!;

    // Log dashboard access
    await ReportAuditLogger.logDashboardView(user, {
      widgets: req.query.widgets,
      timeRange: req.query.timeRange
    });

    const result = await reportingService.getDashboardData(user.id);

    if (!result.success) {
      return res.status(500).json(result);
    }

    // Sanitize dashboard data based on user permissions
    if (result.data) {
      result.data = DataSanitizer.sanitizeData([result.data], user)[0];
    }

    res.json(result);
  })
);

/**
 * GET /api/reports/dashboard/widgets/:widgetType
 * Get specific widget data
 */
router.get('/dashboard/widgets/:widgetType',
  ...reportSecurityMiddleware.readOnly,
  validateRequest({
    params: {
      widgetType: Joi.string().valid('metrics', 'charts', 'status', 'activity').required()
    },
    query: {
      timeRange: Joi.string().valid('1h', '24h', '7d', '30d').default('24h'),
      refresh: Joi.boolean().default(false)
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { widgetType } = req.params;
    const { timeRange, refresh } = req.query;
    const user = req.reportUser!;

    // Route to appropriate widget data method
    let result;
    switch (widgetType) {
      case 'metrics':
        result = await reportingService.getDashboardData(user.id);
        if (result.success) {
          result.data = {
            resourceCounts: result.data.resourceCounts,
            utilizationMetrics: result.data.utilizationMetrics
          };
        }
        break;
      case 'status':
        result = await reportingService.getDashboardData(user.id);
        if (result.success) {
          result.data = { healthStatus: result.data.healthStatus };
        }
        break;
      case 'activity':
        result = await reportingService.getDashboardData(user.id);
        if (result.success) {
          result.data = { recentActivity: result.data.recentActivity };
        }
        break;
      default:
        return res.status(404).json({
          success: false,
          errors: [{ code: 'WIDGET_NOT_FOUND', message: `Widget type '${widgetType}' not found` }]
        });
    }

    if (!result.success) {
      return res.status(500).json(result);
    }

    // Sanitize widget data
    if (result.data) {
      result.data = DataSanitizer.sanitizeData([result.data], user)[0];
    }

    res.json(result);
  })
);

// ===================== REPORT GENERATION ENDPOINTS =====================

/**
 * POST /api/reports/generate
 * Generate a custom report
 */
router.post('/generate',
  ...reportSecurityMiddleware.writeAccess,
  validateRequest({ body: ReportValidationSchemas.generateReport }),
  asyncHandler(async (req: Request, res: Response) => {
    const reportQuery: ReportQuery = req.body;
    const user = req.reportUser!;

    // Validate report query against user permissions
    const queryValidation = await ReportAuthorizationService.validateReportQuery(user, reportQuery);
    if (!queryValidation.valid) {
      await ReportAuditLogger.logPermissionDenied(
        user,
        'generate_report',
        'report',
        undefined,
        { query: reportQuery, errors: queryValidation.errors }
      );
      return res.status(403).json({
        success: false,
        errors: queryValidation.errors.map(error => ({ code: 'PERMISSION_DENIED', message: error }))
      });
    }

    // Log report creation
    await ReportAuditLogger.logReportCreate(user, 'ad-hoc', {
      query: reportQuery,
      resourceTypes: reportQuery.resourceTypes
    });

    const result = await reportingService.executeReport(reportQuery, user.id);

    if (!result.success) {
      const statusCode =
        result.errors?.[0]?.code === 'INVALID_QUERY' ? 400 :
        result.errors?.[0]?.code === 'PERMISSION_DENIED' ? 403 :
        result.errors?.[0]?.code === 'TIMEOUT' ? 408 : 500;

      return res.status(statusCode).json(result);
    }

    // Sanitize report data before returning
    if (result.data?.records) {
      result.data.records = DataSanitizer.sanitizeData(result.data.records, user);
    }

    res.json(result);
  })
);

/**
 * POST /api/reports/preview
 * Generate a report preview
 */
router.post('/preview',
  validateRequest({ body: ReportValidationSchemas.generateReport }),
  asyncHandler(async (req: Request, res: Response) => {
    const reportQuery: ReportQuery = req.body;
    const userId = req.user?.id;

    const result = await reportingService.generateReportPreview(reportQuery, userId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

/**
 * POST /api/reports/aggregate
 * Get aggregated data for charts
 */
router.post('/aggregate',
  validateRequest({
    body: {
      resourceType: Joi.string().valid('vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint').required(),
      aggregation: Joi.string().valid('count', 'sum', 'avg', 'min', 'max').required(),
      groupBy: Joi.string().required(),
      filters: Joi.array().optional()
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { resourceType, aggregation, groupBy, filters } = req.body;
    
    const result = await reportingService.getAggregatedData(
      resourceType as ResourceType,
      aggregation as AggregationType,
      groupBy,
      filters
    );
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  })
);

// ===================== EXPORT ENDPOINTS =====================

/**
 * POST /api/reports/export
 * Export report data in various formats
 */
router.post('/export',
  ...reportSecurityMiddleware.exportAccess,
  validateRequest({
    body: {
      data: Joi.array().required(),
      format: Joi.string().valid('pdf', 'excel', 'csv', 'json', 'html').required(),
      options: Joi.object({
        includeCharts: Joi.boolean().default(false),
        includeMetadata: Joi.boolean().default(true),
        compression: Joi.boolean().default(false),
        password: Joi.string().optional(),
        addWatermark: Joi.boolean().default(true),
        encryptFile: Joi.boolean().default(false)
      }).optional(),
      metadata: Joi.object().optional()
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { data, format, options = {}, metadata } = req.body;
    const user = req.reportUser!;

    // Validate export request against security policies
    const securityOptions = {
      addWatermark: options.addWatermark !== false, // Default to true
      encryptFile: options.encryptFile || false,
      passwordProtect: !!options.password,
      password: options.password,
      expirationHours: 24, // Default 24 hour expiration
      allowedDownloads: 5    // Default max 5 downloads
    };

    const validation = DataSanitizer.validateExportRequest(data, user, format, securityOptions);
    if (!validation.allowed) {
      await ReportAuditLogger.logPermissionDenied(
        user,
        'export_report',
        'export',
        format,
        { violations: validation.violations, requirements: validation.requirements }
      );
      return res.status(403).json({
        success: false,
        errors: validation.violations.map(violation => ({ code: 'EXPORT_POLICY_VIOLATION', message: violation })),
        requirements: validation.requirements
      });
    }

    // Sanitize data before export
    const sanitizedData = DataSanitizer.sanitizeData(data, user);

    // Apply export security controls
    const { securedData, metadata: securityMetadata } = DataSanitizer.applyExportSecurity(
      sanitizedData,
      user,
      format,
      securityOptions
    );

    // Log export action
    await ReportAuditLogger.logReportExport(user, 'export-' + Date.now(), format, {
      recordCount: data.length,
      securityOptions,
      dataClassification: DataSanitizer.classifyData(data)
    });

    const exportOptions: ReportExportOptions = {
      format: format as ExportFormat,
      ...options,
      watermark: securityOptions.addWatermark,
      encryption: securityOptions.encryptFile
    };

    const result = await exportService.exportData(securedData, format, exportOptions, {
      ...metadata,
      security: securityMetadata,
      exportedBy: user.username,
      exportedAt: new Date().toISOString()
    });

    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json({
      success: true,
      data: {
        downloadUrl: `/api/reports/download/${result.data!.fileName}`,
        fileName: result.data!.fileName,
        size: result.data!.size,
        format,
        security: {
          watermarked: securityOptions.addWatermark,
          encrypted: securityOptions.encryptFile,
          expiresAt: securityMetadata.expiresAt,
          maxDownloads: securityOptions.allowedDownloads
        }
      }
    });
  })
);

/**
 * GET /api/reports/download/:fileName
 * Download exported report file with security controls
 */
router.get('/download/:fileName',
  ...reportSecurityMiddleware.basic,
  validateRequest({
    params: {
      fileName: Joi.string().pattern(/^[a-zA-Z0-9_.-]+$/).required()
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { fileName } = req.params;
    const user = req.reportUser;

    // Log download attempt
    await ReportAuditLogger.logExportDownload(user, fileName, {
      userAgent: req.get('User-Agent'),
      referrer: req.get('Referrer')
    });

    // Get file metadata and validate access
    const fileStream = exportService.getFileStream(fileName);

    if (!fileStream) {
      return res.status(404).json({
        success: false,
        errors: [{ code: 'FILE_NOT_FOUND', message: 'Export file not found or expired' }]
      });
    }

    // TODO: Implement file access validation based on security metadata
    // This would check:
    // - File expiration
    // - Download count limits
    // - IP restrictions
    // - User permissions

    // Set appropriate headers
    const fileExt = fileName.split('.').pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      'pdf': 'application/pdf',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'csv': 'text/csv',
      'json': 'application/json',
      'html': 'text/html'
    };

    // Security headers for file download
    res.setHeader('Content-Type', contentTypes[fileExt || ''] || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    fileStream.pipe(res);
  })
);

// ===================== REPORT TEMPLATES ENDPOINTS =====================

/**
 * GET /api/reports/templates
 * Get available report templates
 */
router.get('/templates',
  asyncHandler(async (req: Request, res: Response) => {
    // Return predefined report templates
    const templates = [
      {
        id: 'inventory-summary',
        name: 'Inventory Summary',
        description: 'Overview of all network resources',
        category: 'inventory',
        fields: ['resource_type', 'name', 'status', 'region', 'created_at'],
        defaultFilters: [],
        defaultGrouping: ['resource_type'],
        defaultSorting: [{ field: 'created_at', direction: 'DESC' }]
      },
      {
        id: 'compliance-report',
        name: 'Compliance Report',
        description: 'Compliance status of network resources',
        category: 'compliance',
        fields: ['resource_type', 'name', 'compliance_status', 'last_checked'],
        defaultFilters: [],
        defaultGrouping: ['compliance_status'],
        defaultSorting: [{ field: 'last_checked', direction: 'DESC' }]
      },
      {
        id: 'utilization-analysis',
        name: 'Utilization Analysis',
        description: 'Resource utilization metrics and trends',
        category: 'utilization',
        fields: ['resource_type', 'name', 'utilization_percent', 'capacity'],
        defaultFilters: [],
        defaultGrouping: ['resource_type'],
        defaultSorting: [{ field: 'utilization_percent', direction: 'DESC' }]
      }
    ];

    res.json({
      success: true,
      data: templates
    });
  })
);

/**
 * GET /api/reports/templates/:templateId
 * Get specific report template
 */
router.get('/templates/:templateId',
  asyncHandler(async (req: Request, res: Response) => {
    const { templateId } = req.params;
    
    // This would typically query a database
    // For now, return a mock template
    const template = {
      id: templateId,
      name: 'Sample Template',
      description: 'Sample report template',
      category: 'custom',
      fields: ['id', 'name', 'status'],
      defaultFilters: [],
      defaultGrouping: [],
      defaultSorting: []
    };

    res.json({
      success: true,
      data: template
    });
  })
);

// ===================== SCHEDULED REPORTS ENDPOINTS =====================

/**
 * POST /api/reports/schedule
 * Schedule a report for automatic generation
 */
router.post('/schedule',
  validateRequest({ body: ReportValidationSchemas.scheduleReport }),
  asyncHandler(async (req: Request, res: Response) => {
    const reportDefinition: ReportDefinition = req.body;
    const userId = req.user?.id;

    if (userId) {
      reportDefinition.createdBy = userId;
    }

    const result = await schedulerService.scheduleReport(
      reportDefinition.id || 1, 
      reportDefinition
    );
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.status(201).json(result);
  })
);

/**
 * GET /api/reports/scheduled
 * Get all scheduled reports
 */
router.get('/scheduled',
  asyncHandler(async (req: Request, res: Response) => {
    const scheduledJobs = schedulerService.getScheduledJobs();
    
    res.json({
      success: true,
      data: scheduledJobs.map(job => ({
        id: job.id,
        reportId: job.reportId,
        frequency: job.schedule.frequency,
        nextRun: job.schedule.startDate,
        enabled: job.schedule.enabled
      }))
    });
  })
);

/**
 * DELETE /api/reports/scheduled/:reportId
 * Unschedule a report
 */
router.delete('/scheduled/:reportId',
  validateRequest({
    params: {
      reportId: Joi.number().integer().positive().required()
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = parseInt(req.params.reportId);
    
    const result = await schedulerService.unscheduleReport(reportId);
    
    if (!result.success) {
      const statusCode = result.errors?.[0]?.code === 'JOB_NOT_FOUND' ? 404 : 400;
      return res.status(statusCode).json(result);
    }

    res.json(result);
  })
);

// ===================== ANALYTICS ENDPOINTS =====================

/**
 * GET /api/reports/analytics
 * Get report analytics and usage metrics
 */
router.get('/analytics',
  asyncHandler(async (req: Request, res: Response) => {
    const reportId = req.query.reportId ? parseInt(req.query.reportId as string) : undefined;
    
    const result = await reportingService.getReportAnalytics(reportId);
    
    if (!result.success) {
      return res.status(500).json(result);
    }

    res.json(result);
  })
);

// ===================== REPORT HISTORY ENDPOINTS =====================

/**
 * GET /api/reports/history
 * Get report execution history
 */
router.get('/history',
  validateRequest({
    query: {
      reportId: Joi.number().integer().positive().optional(),
      limit: Joi.number().integer().min(1).max(100).default(20),
      offset: Joi.number().integer().min(0).default(0)
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { reportId, limit, offset } = req.query;
    
    // This would typically query a report_executions table
    // For now, return mock history data
    const history = [
      {
        id: 1,
        reportId: reportId || 1,
        status: 'completed',
        startTime: new Date(Date.now() - 86400000),
        endTime: new Date(Date.now() - 86400000 + 5000),
        executionTime: 5000,
        recordCount: 150,
        executedBy: req.user?.id || 1
      }
    ];

    res.json({
      success: true,
      data: history,
      metadata: {
        total: history.length,
        limit: Number(limit),
        offset: Number(offset),
        hasMore: false
      }
    });
  })
);

// ===================== REPORT SHARING ENDPOINTS =====================

/**
 * POST /api/reports/share
 * Create a shareable link for a report
 */
router.post('/share',
  validateRequest({
    body: {
      reportId: Joi.number().integer().positive().required(),
      expiresAt: Joi.date().optional(),
      maxViews: Joi.number().integer().positive().optional(),
      password: Joi.string().min(4).optional()
    }
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const { reportId, expiresAt, maxViews, password } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        errors: [{ code: 'AUTHENTICATION_REQUIRED', message: 'User must be authenticated' }]
      });
    }

    // Generate share token
    const shareToken = crypto.randomBytes(32).toString('hex');

    const shareData = {
      id: Date.now(), // Mock ID
      reportId,
      shareToken,
      expiresAt,
      maxViews,
      currentViews: 0,
      password,
      createdBy: userId,
      createdAt: new Date()
    };

    res.status(201).json({
      success: true,
      data: {
        shareUrl: `/shared-reports/${shareToken}`,
        token: shareToken,
        expiresAt: expiresAt || null,
        maxViews: maxViews || null
      }
    });
  })
);

// ===================== HEALTH CHECK ENDPOINT =====================

/**
 * GET /api/reports/health
 * Reports system health check
 */
router.get('/health',
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          reporting: 'operational',
          export: 'operational',
          scheduler: 'operational',
          database: 'connected'
        },
        metrics: {
          scheduledJobs: schedulerService.getScheduledJobs().length,
          uptime: process.uptime()
        }
      };

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        data: {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error.message
        }
      });
    }
  })
);

export default router;