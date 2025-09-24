/**
 * Report Types and Interfaces for Frontend
 * Defines client-side types for the reporting system
 */

// ===================== CORE REPORT TYPES =====================

export type ReportCategory = 'inventory' | 'compliance' | 'utilization' | 'security' | 'custom';
export type ExportFormat = 'pdf' | 'excel' | 'csv' | 'json' | 'html';
export type ChartType = 'bar' | 'line' | 'pie' | 'donut' | 'gauge' | 'area' | 'scatter' | 'heatmap';
export type AggregationType = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';
export type ResourceType = 'vpc' | 'subnet' | 'transitGateway' | 'customerGateway' | 'vpcEndpoint';
export type FilterOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'startsWith' | 'endsWith';

// ===================== REPORT INTERFACES =====================

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  fields: string[];
  defaultFilters?: ReportFilter[];
  defaultGrouping?: string[];
  defaultSorting?: ReportSort[];
}

export interface ReportFilter {
  field: string;
  operator: FilterOperator;
  value: any;
  values?: any[];
  logicalOperator?: 'AND' | 'OR' | 'NOT';
}

export interface ReportSort {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface DateRange {
  start: Date;
  end: Date;
  preset?: 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom';
}

export interface ReportQuery {
  resourceTypes: ResourceType[];
  fields: string[];
  filters?: ReportFilter[];
  groupBy?: string[];
  orderBy?: ReportSort[];
  limit?: number;
  includeDeleted?: boolean;
  dateRange?: DateRange;
}

export interface ChartConfiguration {
  type: ChartType;
  title: string;
  description?: string;
  dataSource: string;
  aggregation: AggregationType;
  groupBy?: string;
  filterBy?: ReportFilter[];
  colors?: string[];
  options?: Record<string, any>;
}

export interface ReportDefinition {
  id?: number;
  name: string;
  description?: string;
  category: ReportCategory;
  query: ReportQuery;
  visualization?: {
    type: 'table' | 'chart' | 'both';
    chart?: ChartConfiguration;
    layout?: 'horizontal' | 'vertical';
  };
  schedule?: ReportSchedule;
  permissions: ReportPermissions;
  createdBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ReportSchedule {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';
  cronExpression?: string;
  startDate?: Date;
  endDate?: Date;
  timezone: string;
  parameters?: Record<string, any>;
  delivery: {
    method: ('email' | 'webhook' | 'storage' | 'dashboard')[];
    email?: {
      recipients: string[];
      subject?: string;
      body?: string;
      formats: ExportFormat[];
      includeCharts?: boolean;
    };
  };
}

export interface ReportPermissions {
  isPublic: boolean;
  owner: number;
  viewers: number[];
  editors: number[];
}

export interface ReportExecution {
  id?: number;
  reportId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  executionTime?: number;
  recordCount?: number;
  fileSize?: number;
  filePath?: string;
  executedBy?: number;
  parameters?: Record<string, any>;
  errors?: string[];
}

// ===================== DASHBOARD TYPES =====================

export interface DashboardData {
  resourceCounts: {
    totalResources: number;
    vpcs: number;
    subnets: number;
    transitGateways: number;
    customerGateways: number;
    vpcEndpoints: number;
  };
  utilizationMetrics: {
    averageUtilization: number;
    highUtilizationResources: number;
    lowUtilizationResources: number;
  };
  healthStatus: {
    healthy: number;
    warning: number;
    critical: number;
  };
  recentActivity: Array<{
    id: string;
    type: string;
    resource: string;
    action: string;
    timestamp: Date;
    status: 'success' | 'warning' | 'error';
  }>;
}

export interface ReportWidgetData {
  metrics?: {
    resourceCounts: DashboardData['resourceCounts'];
    utilizationMetrics: DashboardData['utilizationMetrics'];
  };
  status?: {
    healthStatus: DashboardData['healthStatus'];
  };
  activity?: {
    recentActivity: DashboardData['recentActivity'];
  };
}

// ===================== BUILDER TYPES =====================

export type BuilderStep = 'datasource' | 'fields' | 'filters' | 'grouping' | 'sorting' | 'visualization' | 'schedule' | 'permissions';

export interface ReportBuilderState {
  step: BuilderStep;
  configuration: {
    name?: string;
    description?: string;
    category?: ReportCategory;
    query?: ReportQuery;
    visualization?: ReportDefinition['visualization'];
    schedule?: ReportSchedule;
    permissions?: ReportPermissions;
  };
  preview?: {
    data: any[];
    totalCount: number;
    executionTime: number;
    query: string;
    warnings?: string[];
  };
  isValid: boolean;
  validationErrors: string[];
}

// ===================== EXPORT TYPES =====================

export interface ExportOptions {
  format: ExportFormat;
  includeCharts?: boolean;
  includeMetadata?: boolean;
  compression?: boolean;
  password?: string;
  template?: string;
}

export interface ExportResult {
  success: boolean;
  downloadUrl?: string;
  fileName?: string;
  size?: number;
  errors?: string[];
}

// ===================== API RESPONSE TYPES =====================

export interface ReportApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{
    code: string;
    message: string;
    field?: string;
    details?: any;
  }>;
  metadata?: {
    timestamp: string;
    executionTime: number;
    version: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
      hasNext: boolean;
      hasPrev: boolean;
    };
  };
}

// ===================== HOOK OPTIONS =====================

export interface UseReportsOptions {
  enabled?: boolean;
  refetchInterval?: number;
  retry?: number;
  staleTime?: number;
  gcTime?: number;
}

export interface UseReportExecutionOptions extends UseReportsOptions {
  pollInterval?: number;
  autoRefresh?: boolean;
}

// ===================== SCHEDULED REPORTS =====================

export interface ScheduledReport {
  id: number;
  reportId: number;
  reportName: string;
  frequency: string;
  nextRun: Date;
  lastRun?: Date;
  enabled: boolean;
  recipients?: string[];
  format: ExportFormat;
  status: 'active' | 'paused' | 'error';
  createdBy: number;
  createdAt: Date;
}

// ===================== REPORT ANALYTICS =====================

export interface ReportAnalytics {
  reportId: number;
  totalExecutions: number;
  lastExecuted?: Date;
  averageExecutionTime: number;
  popularityScore: number;
  viewCount: number;
  shareCount: number;
  errorRate: number;
  trends: Array<{
    date: Date;
    executions: number;
    avgTime: number;
    errors: number;
  }>;
}

// ===================== UTILITY TYPES =====================

export interface ReportField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'json';
  source: string;
  required?: boolean;
  aggregatable?: boolean;
  aggregations?: AggregationType[];
  groupable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  description?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code?: string;
}