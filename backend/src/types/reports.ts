/**
 * Report Types and Interfaces
 * Defines all report-related types for the network CMDB reporting system
 *
 * NOTE: Database schema interfaces are defined in /database/schema/reports.ts
 * This file contains application-level types and interfaces that extend the base schema
 */

import { ResourceType, FilterOperator } from './search';
import {
  ReportsTable,
  ReportExecutionsTable,
  ReportType as DbReportType,
  ReportCategory as DbReportCategory,
  CloudProvider as DbCloudProvider,
  OutputFormat as DbOutputFormat,
  ExecutionStatus as DbExecutionStatus,
  TriggerType as DbTriggerType
} from '../database/schema/reports';

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

/**
 * Application-level report definition that extends database schema
 * Maps to ReportsTable but adds application-specific fields
 */
export interface ReportDefinition extends Omit<ReportsTable, 'created_at' | 'updated_at'> {
  // Application-specific fields
  template?: ReportTemplate;
  query: ReportQuery; // Enhanced query interface
  visualization?: ReportVisualization;
  schedule?: ReportSchedule; // Enhanced schedule interface
  permissions: ReportPermissions;
  metadata: ReportMetadata;

  // Renamed fields to match application conventions
  type: ReportDisplayType; // Separate from database report_type
  createdBy: number; // Maps to created_by
  createdAt?: Date; // Maps to created_at
  updatedAt?: Date; // Maps to updated_at
}

// Database-aligned enums
export type ReportCategory = DbReportCategory;
export type ReportType = DbReportType;
export type CloudProvider = DbCloudProvider;
export type ExportFormat = DbOutputFormat;
export type ExecutionStatus = DbExecutionStatus;
export type TriggerType = DbTriggerType;

// Application-level report display types (separate from database report_type)
export type ReportDisplayType = 'tabular' | 'chart' | 'dashboard' | 'hybrid';

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

// FilterOperator is imported from search.ts to avoid duplication

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

// ExportFormat is now imported from database schema as DbOutputFormat

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

/**
 * Application-level report execution that extends database schema
 * Maps to ReportExecutionsTable but adds application-specific fields
 */
export interface ReportExecution extends Omit<ReportExecutionsTable, 'created_at'> {
  // Renamed fields to match application conventions
  reportId: string; // Maps to report_id (keeping string as per DB)
  executionTime?: number; // Maps to duration_ms
  recordCount?: number; // Maps to records_processed
  fileSize?: number; // Maps to output_size_bytes
  filePath?: string; // Maps to output_location
  executedBy?: number; // Maps to started_by
  startTime: Date; // Maps to start_time
  endTime?: Date; // Maps to end_time
  parameters?: Record<string, any>; // Maps to execution_parameters
  createdAt?: Date; // Maps to created_at
}

// Legacy alias for backward compatibility
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