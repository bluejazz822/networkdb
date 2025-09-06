/**
 * Report Types and Interfaces
 * Defines all report-related types for the network CMDB reporting system
 */

import { ResourceType } from './search';

// ===================== CHART AND WIDGET TYPES =====================

export type ChartType = 'bar' | 'line' | 'pie' | 'donut' | 'gauge' | 'area' | 'scatter' | 'heatmap';

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

export type AggregationType = 'count' | 'sum' | 'avg' | 'min' | 'max' | 'distinct';

export interface DashboardWidget {
  id: string;
  type: 'metric' | 'chart' | 'table' | 'status';
  title: string;
  position: { x: number; y: number; width: number; height: number };
  configuration: WidgetConfiguration;
  refreshInterval?: number; // in seconds
}

export interface WidgetConfiguration {
  dataSource: string;
  query?: ReportQuery;
  chart?: ChartConfiguration;
  metric?: MetricConfiguration;
  table?: TableConfiguration;
  status?: StatusConfiguration;
}

export interface MetricConfiguration {
  value: string | number;
  label: string;
  unit?: string;
  format?: 'number' | 'percentage' | 'currency' | 'bytes';
  trend?: TrendData;
  threshold?: ThresholdConfig;
}

export interface TrendData {
  value: number;
  direction: 'up' | 'down' | 'stable';
  period: string;
}

export interface ThresholdConfig {
  warning: number;
  critical: number;
  goodDirection: 'up' | 'down';
}

export interface TableConfiguration {
  columns: TableColumn[];
  pagination?: boolean;
  sorting?: boolean;
  filtering?: boolean;
}

export interface TableColumn {
  field: string;
  title: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'status';
  width?: number;
  sortable?: boolean;
  filterable?: boolean;
}

export interface StatusConfiguration {
  statusField: string;
  statusMap: Record<string, StatusItem>;
}

export interface StatusItem {
  label: string;
  color: string;
  icon?: string;
}

// ===================== REPORT DEFINITION TYPES =====================

export interface ReportDefinition {
  id?: number;
  name: string;
  description?: string;
  category: ReportCategory;
  type: ReportType;
  template?: ReportTemplate;
  query: ReportQuery;
  visualization?: ReportVisualization;
  schedule?: ReportSchedule;
  permissions: ReportPermissions;
  metadata: ReportMetadata;
  createdBy: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ReportCategory = 'inventory' | 'compliance' | 'performance' | 'security' | 'utilization' | 'custom';
export type ReportType = 'tabular' | 'chart' | 'dashboard' | 'hybrid';

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: ReportCategory;
  fields: ReportField[];
  defaultFilters?: ReportFilter[];
  defaultGrouping?: string[];
  defaultSorting?: ReportSort[];
}

export interface ReportField {
  name: string;
  label: string;
  type: 'string' | 'number' | 'date' | 'boolean' | 'json';
  source: string; // database table/field
  required?: boolean;
  aggregatable?: boolean;
  aggregations?: AggregationType[];
  groupable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  description?: string;
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

export interface ReportFilter {
  field: string;
  operator: FilterOperator;
  value: any;
  values?: any[];
  logicalOperator?: 'AND' | 'OR' | 'NOT';
}

export type FilterOperator = 
  | 'equals' | 'not_equals' 
  | 'greater_than' | 'greater_than_equal'
  | 'less_than' | 'less_than_equal'
  | 'in' | 'not_in'
  | 'like' | 'not_like'
  | 'starts_with' | 'ends_with'
  | 'exists' | 'not_exists'
  | 'between';

export interface ReportSort {
  field: string;
  direction: 'ASC' | 'DESC';
}

export interface DateRange {
  start: Date;
  end: Date;
  preset?: DatePreset;
}

export type DatePreset = 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'last_90_days' | 'this_month' | 'last_month' | 'this_year' | 'last_year' | 'custom';

export interface ReportVisualization {
  type: 'table' | 'chart' | 'both';
  chart?: ChartConfiguration;
  table?: TableConfiguration;
  layout?: 'horizontal' | 'vertical';
}

// ===================== REPORT SCHEDULING TYPES =====================

export interface ReportSchedule {
  enabled: boolean;
  frequency: ScheduleFrequency;
  cronExpression?: string;
  startDate?: Date;
  endDate?: Date;
  timezone: string;
  parameters?: Record<string, any>;
  delivery: ReportDelivery;
}

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'custom';

export interface ReportDelivery {
  method: DeliveryMethod[];
  email?: EmailDelivery;
  webhook?: WebhookDelivery;
  storage?: StorageDelivery;
}

export type DeliveryMethod = 'email' | 'webhook' | 'storage' | 'dashboard';

export interface EmailDelivery {
  recipients: string[];
  subject?: string;
  body?: string;
  formats: ExportFormat[];
  includeCharts?: boolean;
}

export interface WebhookDelivery {
  url: string;
  headers?: Record<string, string>;
  format: ExportFormat;
}

export interface StorageDelivery {
  path: string;
  format: ExportFormat;
  retention?: number; // days
}

// ===================== EXPORT AND SHARING TYPES =====================

export type ExportFormat = 'pdf' | 'excel' | 'csv' | 'json' | 'html';

export interface ReportExportOptions {
  format: ExportFormat;
  includeCharts?: boolean;
  includeMetadata?: boolean;
  compression?: boolean;
  password?: string;
  template?: string;
}

export interface ReportPermissions {
  isPublic: boolean;
  owner: number;
  viewers: number[];
  editors: number[];
  groups?: ReportGroupPermissions[];
}

export interface ReportGroupPermissions {
  groupId: number;
  permission: 'view' | 'edit' | 'admin';
}

export interface ReportShare {
  id?: number;
  reportId: number;
  shareToken: string;
  expiresAt?: Date;
  maxViews?: number;
  currentViews: number;
  password?: string;
  createdBy: number;
  createdAt?: Date;
}

// ===================== REPORT EXECUTION TYPES =====================

export interface ReportExecution {
  id?: number;
  reportId: number;
  status: ExecutionStatus;
  startTime: Date;
  endTime?: Date;
  executionTime?: number; // milliseconds
  recordCount?: number;
  fileSize?: number; // bytes
  filePath?: string;
  errorMessage?: string;
  parameters?: Record<string, any>;
  executedBy: number;
  metadata?: ExecutionMetadata;
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ExecutionMetadata {
  version: string;
  queryTime: number;
  renderTime?: number;
  cacheHit?: boolean;
  memoryUsage?: number;
}

// ===================== DASHBOARD TYPES =====================

export interface Dashboard {
  id?: number;
  name: string;
  description?: string;
  layout: DashboardLayout;
  widgets: DashboardWidget[];
  permissions: ReportPermissions;
  settings: DashboardSettings;
  createdBy: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface DashboardLayout {
  columns: number;
  rows: number;
  gap: number;
  responsive?: boolean;
  breakpoints?: Record<string, LayoutBreakpoint>;
}

export interface LayoutBreakpoint {
  columns: number;
  width: number;
}

export interface DashboardSettings {
  refreshInterval?: number; // seconds
  autoRefresh?: boolean;
  theme?: 'light' | 'dark' | 'auto';
  showHeader?: boolean;
  showRefreshButton?: boolean;
  allowWidgetMove?: boolean;
  allowWidgetResize?: boolean;
}

// ===================== ANALYTICS TYPES =====================

export interface ReportAnalytics {
  reportId: number;
  totalExecutions: number;
  lastExecuted?: Date;
  averageExecutionTime: number;
  popularityScore: number;
  viewCount: number;
  shareCount: number;
  errorRate: number;
  trends: AnalyticsTrend[];
}

export interface AnalyticsTrend {
  date: Date;
  executions: number;
  avgTime: number;
  errors: number;
}

// ===================== API RESPONSE TYPES =====================

export interface ReportApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: ReportError[];
  metadata?: ResponseMetadata;
}

export interface ReportError {
  code: string;
  message: string;
  field?: string;
  details?: any;
}

export interface ResponseMetadata {
  timestamp: string;
  executionTime: number;
  version: string;
  pagination?: PaginationMetadata;
}

export interface PaginationMetadata {
  page: number;
  limit: number;
  total: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// ===================== REPORT BUILDER TYPES =====================

export interface ReportBuilder {
  step: BuilderStep;
  configuration: ReportBuilderConfig;
  preview?: ReportPreview;
}

export type BuilderStep = 'datasource' | 'fields' | 'filters' | 'grouping' | 'sorting' | 'visualization' | 'schedule' | 'permissions';

export interface ReportBuilderConfig {
  name?: string;
  description?: string;
  category?: ReportCategory;
  datasource?: ReportQuery;
  visualization?: ReportVisualization;
  schedule?: ReportSchedule;
  permissions?: ReportPermissions;
}

export interface ReportPreview {
  data: any[];
  totalCount: number;
  executionTime: number;
  query: string;
  warnings?: string[];
}

// ===================== REPORT METADATA =====================

export interface ReportMetadata {
  version: string;
  tags: string[];
  source: string;
  lastModifiedBy?: number;
  size?: number;
  complexity: ComplexityLevel;
  dependencies?: string[];
  performance?: PerformanceMetrics;
}

export type ComplexityLevel = 'simple' | 'moderate' | 'complex' | 'advanced';

export interface PerformanceMetrics {
  avgExecutionTime: number;
  maxExecutionTime: number;
  memoryUsage: number;
  resourceIntensive: boolean;
}