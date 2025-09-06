/**
 * Reports API Service
 * Frontend service for interacting with the reports API
 */

import { api } from '../utils/api';
import {
  ReportApiResponse,
  DashboardData,
  ReportQuery,
  ReportDefinition,
  ReportPreview,
  ReportExportOptions,
  ExportFormat,
  ReportTemplate,
  ReportSchedule,
  AggregationType,
  ResourceType
} from '../types/reports';

export class ReportsApiService {
  // ===================== DASHBOARD ENDPOINTS =====================

  /**
   * Get dashboard data with key metrics
   */
  static async getDashboardData(): Promise<ReportApiResponse<DashboardData>> {
    try {
      const response = await api.get('/reports/dashboard');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        errors: [{ 
          code: 'DASHBOARD_ERROR', 
          message: error.response?.data?.message || 'Failed to load dashboard data' 
        }]
      };
    }
  }

  /**
   * Get specific widget data
   */
  static async getWidgetData(
    widgetType: 'metrics' | 'charts' | 'status' | 'activity', 
    options: { timeRange?: string; refresh?: boolean } = {}
  ): Promise<ReportApiResponse> {
    try {
      const params = new URLSearchParams();
      if (options.timeRange) params.set('timeRange', options.timeRange);
      if (options.refresh !== undefined) params.set('refresh', String(options.refresh));

      const response = await api.get(`/reports/dashboard/widgets/${widgetType}?${params}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        errors: [{ 
          code: 'WIDGET_ERROR', 
          message: error.response?.data?.message || 'Failed to load widget data' 
        }]
      };
    }
  }

  // ===================== REPORT GENERATION ENDPOINTS =====================

  /**
   * Generate a custom report
   */
  static async generateReport(reportQuery: ReportQuery): Promise<ReportApiResponse> {
    try {
      const response = await api.post('/reports/generate', reportQuery);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        errors: [{ 
          code: 'REPORT_GENERATION_ERROR', 
          message: error.response?.data?.message || 'Failed to generate report' 
        }]
      };
    }
  }

  /**
   * Generate a report preview
   */
  static async generateReportPreview(reportQuery: ReportQuery): Promise<ReportApiResponse<ReportPreview>> {
    try {
      const response = await api.post('/reports/preview', reportQuery);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        errors: [{ 
          code: 'PREVIEW_ERROR', 
          message: error.response?.data?.message || 'Failed to generate preview' 
        }]
      };
    }
  }

  /**
   * Get aggregated data for charts
   */
  static async getAggregatedData(
    resourceType: ResourceType,
    aggregation: AggregationType,
    groupBy: string,
    filters?: any[]
  ): Promise<ReportApiResponse> {
    try {
      const response = await api.post('/reports/aggregate', {
        resourceType,
        aggregation,
        groupBy,
        filters
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        errors: [{ 
          code: 'AGGREGATION_ERROR', 
          message: error.response?.data?.message || 'Failed to aggregate data' 
        }]
      };
    }
  }

  // ===================== EXPORT ENDPOINTS =====================

  /**
   * Export report data
   */
  static async exportReport(
    data: any[],
    format: ExportFormat,
    options?: ReportExportOptions,
    metadata?: any
  ): Promise<ReportApiResponse<{ downloadUrl: string; fileName: string; size: number; format: ExportFormat }>> {
    try {
      const response = await api.post('/reports/export', {
        data,
        format,
        options,
        metadata
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        errors: [{ 
          code: 'EXPORT_ERROR', 
          message: error.response?.data?.message || 'Failed to export report' 
        }]
      };
    }
  }

  /**
   * Download exported report file
   */
  static getDownloadUrl(fileName: string): string {
    return `${api.defaults.baseURL}/reports/download/${fileName}`;
  }

  // ===================== TEMPLATE ENDPOINTS =====================

  /**
   * Get available report templates
   */
  static async getReportTemplates(): Promise<ReportApiResponse<ReportTemplate[]>> {
    try {
      const response = await api.get('/reports/templates');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        errors: [{ 
          code: 'TEMPLATES_ERROR', 
          message: error.response?.data?.message || 'Failed to load templates' 
        }]
      };
    }
  }

  /**
   * Get specific report template
   */
  static async getReportTemplate(templateId: string): Promise<ReportApiResponse<ReportTemplate>> {
    try {
      const response = await api.get(`/reports/templates/${templateId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        errors: [{ 
          code: 'TEMPLATE_ERROR', 
          message: error.response?.data?.message || 'Failed to load template' 
        }]
      };
    }
  }

  // ===================== SCHEDULED REPORTS ENDPOINTS =====================

  /**
   * Schedule a report
   */
  static async scheduleReport(reportDefinition: ReportDefinition): Promise<ReportApiResponse> {
    try {
      const response = await api.post('/reports/schedule', reportDefinition);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        errors: [{ 
          code: 'SCHEDULE_ERROR', 
          message: error.response?.data?.message || 'Failed to schedule report' 
        }]
      };
    }
  }

  /**
   * Get scheduled reports
   */
  static async getScheduledReports(): Promise<ReportApiResponse> {
    try {
      const response = await api.get('/reports/scheduled');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        errors: [{ 
          code: 'SCHEDULED_REPORTS_ERROR', 
          message: error.response?.data?.message || 'Failed to load scheduled reports' 
        }]
      };
    }
  }

  /**
   * Unschedule a report
   */
  static async unscheduleReport(reportId: number): Promise<ReportApiResponse> {
    try {
      const response = await api.delete(`/reports/scheduled/${reportId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        errors: [{ 
          code: 'UNSCHEDULE_ERROR', 
          message: error.response?.data?.message || 'Failed to unschedule report' 
        }]
      };
    }
  }

  // ===================== ANALYTICS ENDPOINTS =====================

  /**
   * Get report analytics
   */
  static async getReportAnalytics(reportId?: number): Promise<ReportApiResponse> {
    try {
      const params = reportId ? `?reportId=${reportId}` : '';
      const response = await api.get(`/reports/analytics${params}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        errors: [{ 
          code: 'ANALYTICS_ERROR', 
          message: error.response?.data?.message || 'Failed to load analytics' 
        }]
      };
    }
  }

  // ===================== HISTORY ENDPOINTS =====================

  /**
   * Get report execution history
   */
  static async getReportHistory(options: {
    reportId?: number;
    limit?: number;
    offset?: number;
  } = {}): Promise<ReportApiResponse> {
    try {
      const params = new URLSearchParams();
      if (options.reportId) params.set('reportId', String(options.reportId));
      if (options.limit) params.set('limit', String(options.limit));
      if (options.offset) params.set('offset', String(options.offset));

      const response = await api.get(`/reports/history?${params}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        errors: [{ 
          code: 'HISTORY_ERROR', 
          message: error.response?.data?.message || 'Failed to load report history' 
        }]
      };
    }
  }

  // ===================== SHARING ENDPOINTS =====================

  /**
   * Create a shareable link for a report
   */
  static async shareReport(options: {
    reportId: number;
    expiresAt?: Date;
    maxViews?: number;
    password?: string;
  }): Promise<ReportApiResponse<{ shareUrl: string; token: string }>> {
    try {
      const response = await api.post('/reports/share', options);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        errors: [{ 
          code: 'SHARE_ERROR', 
          message: error.response?.data?.message || 'Failed to create share link' 
        }]
      };
    }
  }

  // ===================== HEALTH CHECK =====================

  /**
   * Check reports system health
   */
  static async getHealthStatus(): Promise<ReportApiResponse> {
    try {
      const response = await api.get('/reports/health');
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        errors: [{ 
          code: 'HEALTH_ERROR', 
          message: error.response?.data?.message || 'Failed to check system health' 
        }]
      };
    }
  }

  // ===================== UTILITY METHODS =====================

  /**
   * Build report query from form data
   */
  static buildReportQuery(formData: {
    resourceTypes: string[];
    fields: string[];
    filters?: any[];
    groupBy?: string[];
    orderBy?: any[];
    limit?: number;
    dateRange?: any;
  }): ReportQuery {
    return {
      resourceTypes: formData.resourceTypes as ResourceType[],
      fields: formData.fields,
      filters: formData.filters,
      groupBy: formData.groupBy,
      orderBy: formData.orderBy,
      limit: formData.limit,
      includeDeleted: false,
      dateRange: formData.dateRange
    };
  }

  /**
   * Format export filename
   */
  static formatExportFilename(reportName: string, format: ExportFormat): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const cleanName = reportName.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `${cleanName}_${timestamp}.${format}`;
  }

  /**
   * Get format-specific MIME type
   */
  static getFormatMimeType(format: ExportFormat): string {
    const mimeTypes: Record<ExportFormat, string> = {
      pdf: 'application/pdf',
      excel: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      csv: 'text/csv',
      json: 'application/json',
      html: 'text/html'
    };
    return mimeTypes[format];
  }

  /**
   * Validate report query
   */
  static validateReportQuery(query: ReportQuery): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!query.resourceTypes || query.resourceTypes.length === 0) {
      errors.push('At least one resource type must be selected');
    }

    if (!query.fields || query.fields.length === 0) {
      errors.push('At least one field must be selected');
    }

    if (query.limit && (query.limit < 1 || query.limit > 10000)) {
      errors.push('Limit must be between 1 and 10,000');
    }

    if (query.dateRange) {
      if (query.dateRange.start >= query.dateRange.end) {
        errors.push('End date must be after start date');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}