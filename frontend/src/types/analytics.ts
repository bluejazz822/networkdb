import type {
  WorkflowExecution,
  ExecutionStatus,
  WorkflowStatus,
  HealthStatus,
  ExecutionFilters,
  ApiResponse,
  PaginatedResponse
} from '@/types/workflow'

// Date range types for analytics queries
export interface DateRange {
  startDate: string // ISO string
  endDate: string   // ISO string
}

export interface DateRangePreset {
  key: string
  label: string
  value: DateRange
}

// Analytics filters extending base execution filters
export interface AnalyticsFilters extends ExecutionFilters {
  dateRange?: DateRange
  groupBy?: 'hour' | 'day' | 'week' | 'month'
  includeMetrics?: boolean
  aggregateBy?: 'workflow' | 'status' | 'date'
}

// Core analytics data structures
export interface ExecutionMetrics {
  workflowId: string
  workflowName: string
  period: string // ISO date string for the period
  totalExecutions: number
  successfulExecutions: number
  failedExecutions: number
  runningExecutions: number
  averageDuration: number // in milliseconds
  minDuration: number
  maxDuration: number
  successRate: number // percentage 0-100
  errorRate: number // percentage 0-100
  executionsPerHour: number
}

export interface TimeSeriesData {
  timestamp: string // ISO date string
  value: number
  label?: string
  metadata?: Record<string, any>
}

export interface TrendData {
  current: number
  previous: number
  change: number // absolute change
  changePercent: number // percentage change
  trend: 'up' | 'down' | 'stable'
  isImprovement: boolean // whether the trend is positive for the metric
}

export interface WorkflowAnalytics {
  workflowId: string
  workflowName: string
  totalExecutions: number
  recentExecutions: number
  successRate: number
  averageDuration: number
  uptime: number // percentage
  lastExecution?: WorkflowExecution
  executionTrend: TrendData
  performanceTrend: TrendData
  healthStatus: HealthStatus
  executionHistory: TimeSeriesData[]
  durationHistory: TimeSeriesData[]
  statusDistribution: StatusDistribution
}

export interface StatusDistribution {
  success: number
  error: number
  running: number
  waiting: number
  crashed: number
  aborted: number
  cancelled: number
}

export interface PerformanceMetrics {
  totalWorkflows: number
  activeWorkflows: number
  totalExecutions: number
  successRate: number
  averageDuration: number
  executionsPerDay: number
  uptime: number
  healthScore: number
  trendsData: {
    executions: TrendData
    successRate: TrendData
    averageDuration: TrendData
    healthScore: TrendData
  }
  periodComparison: {
    current: ExecutionMetrics
    previous: ExecutionMetrics
  }
}

export interface DataFreshnessMetrics {
  lastSyncAt: string
  stalenessThreshold: number // in minutes
  isStale: boolean
  dataAge: number // in minutes
  syncFrequency: number // in minutes
  missedSyncs: number
  syncHealth: HealthStatus
}

export interface ExecutionTimeAnalysis {
  workflowId: string
  workflowName: string
  avgExecutionTime: number
  medianExecutionTime: number
  p95ExecutionTime: number
  p99ExecutionTime: number
  timeDistribution: {
    range: string // e.g., "0-1s", "1-5s", "5-30s"
    count: number
    percentage: number
  }[]
  slowestExecutions: WorkflowExecution[]
  executionTimeHistory: TimeSeriesData[]
}

export interface ErrorAnalysis {
  workflowId: string
  workflowName: string
  totalErrors: number
  errorRate: number
  commonErrors: {
    errorType: string
    count: number
    percentage: number
    lastOccurrence: string
    examples: string[]
  }[]
  errorTrend: TrendData
  errorsByNode: {
    nodeId: string
    nodeName: string
    errorCount: number
    errorRate: number
  }[]
  recentErrors: WorkflowExecution[]
}

export interface UsagePatterns {
  workflowId: string
  workflowName: string
  executionsByHour: TimeSeriesData[]
  executionsByDay: TimeSeriesData[]
  executionsByWeek: TimeSeriesData[]
  peakUsageTime: string
  averageExecutionsPerDay: number
  utilizationRate: number // percentage
  seasonalTrends: {
    pattern: 'daily' | 'weekly' | 'monthly'
    confidence: number
    description: string
  }[]
}

// Analytics dashboard data
export interface AnalyticsDashboard {
  performance: PerformanceMetrics
  dataFreshness: DataFreshnessMetrics
  topPerformingWorkflows: WorkflowAnalytics[]
  underperformingWorkflows: WorkflowAnalytics[]
  recentExecutions: WorkflowExecution[]
  executionTrends: TimeSeriesData[]
  statusTrends: {
    status: ExecutionStatus
    data: TimeSeriesData[]
  }[]
  durationTrends: TimeSeriesData[]
  alertSummary: {
    critical: number
    warning: number
    info: number
  }
}

// Export and reporting types
export interface ReportFilters {
  workflowIds?: string[]
  dateRange: DateRange
  includeCharts: boolean
  includeRawData: boolean
  groupBy: 'workflow' | 'date' | 'status'
  metrics: ('executions' | 'performance' | 'errors' | 'usage')[]
}

export interface ExportField {
  key: string
  label: string
  selected: boolean
  format?: 'text' | 'number' | 'date' | 'duration' | 'percentage'
}

export interface ReportData {
  metadata: {
    title: string
    generatedAt: string
    dateRange: DateRange
    totalWorkflows: number
    totalExecutions: number
    reportType: 'summary' | 'detailed' | 'comparison'
  }
  summary: PerformanceMetrics
  workflowAnalytics: WorkflowAnalytics[]
  charts?: {
    type: 'line' | 'bar' | 'pie' | 'area'
    title: string
    data: TimeSeriesData[] | StatusDistribution
  }[]
  rawData?: WorkflowExecution[]
}

// API Response types for analytics
export interface AnalyticsResponse extends ApiResponse<AnalyticsDashboard> {}

export interface WorkflowAnalyticsResponse extends ApiResponse<WorkflowAnalytics[]> {}

export interface MetricsResponse extends ApiResponse<ExecutionMetrics[]> {}

export interface TimeSeriesResponse extends ApiResponse<TimeSeriesData[]> {}

export interface ExecutionTimeAnalysisResponse extends ApiResponse<ExecutionTimeAnalysis[]> {}

export interface ErrorAnalysisResponse extends ApiResponse<ErrorAnalysis[]> {}

export interface UsagePatternsResponse extends ApiResponse<UsagePatterns[]> {}

export interface ReportResponse extends ApiResponse<ReportData> {}

// Hook configuration types
export interface UseAnalyticsOptions {
  filters?: AnalyticsFilters
  enabled?: boolean
  refetchInterval?: number
  retry?: number
  staleTime?: number
}

export interface UseWorkflowAnalyticsOptions extends UseAnalyticsOptions {
  workflowId?: string
}

export interface UseMetricsOptions extends UseAnalyticsOptions {
  groupBy?: 'hour' | 'day' | 'week' | 'month'
  aggregateBy?: 'workflow' | 'status' | 'date'
}

export interface UseTimeSeriesOptions extends UseAnalyticsOptions {
  metric: 'executions' | 'duration' | 'success_rate' | 'error_rate'
  interval?: 'hour' | 'day' | 'week' | 'month'
}

// Query keys for React Query
export const ANALYTICS_QUERY_KEYS = {
  all: ['analytics'] as const,
  dashboard: () => [...ANALYTICS_QUERY_KEYS.all, 'dashboard'] as const,
  workflowAnalytics: () => [...ANALYTICS_QUERY_KEYS.all, 'workflow-analytics'] as const,
  workflowAnalytic: (workflowId: string, filters: AnalyticsFilters) =>
    [...ANALYTICS_QUERY_KEYS.workflowAnalytics(), workflowId, filters] as const,
  metrics: () => [...ANALYTICS_QUERY_KEYS.all, 'metrics'] as const,
  metric: (filters: AnalyticsFilters) => [...ANALYTICS_QUERY_KEYS.metrics(), filters] as const,
  timeSeries: () => [...ANALYTICS_QUERY_KEYS.all, 'time-series'] as const,
  timeSeriesData: (metric: string, filters: AnalyticsFilters) =>
    [...ANALYTICS_QUERY_KEYS.timeSeries(), metric, filters] as const,
  executionAnalysis: () => [...ANALYTICS_QUERY_KEYS.all, 'execution-analysis'] as const,
  executionAnalysisData: (filters: AnalyticsFilters) =>
    [...ANALYTICS_QUERY_KEYS.executionAnalysis(), filters] as const,
  errorAnalysis: () => [...ANALYTICS_QUERY_KEYS.all, 'error-analysis'] as const,
  errorAnalysisData: (filters: AnalyticsFilters) =>
    [...ANALYTICS_QUERY_KEYS.errorAnalysis(), filters] as const,
  usagePatterns: () => [...ANALYTICS_QUERY_KEYS.all, 'usage-patterns'] as const,
  usagePatternsData: (filters: AnalyticsFilters) =>
    [...ANALYTICS_QUERY_KEYS.usagePatterns(), filters] as const,
  reports: () => [...ANALYTICS_QUERY_KEYS.all, 'reports'] as const,
  report: (filters: ReportFilters) => [...ANALYTICS_QUERY_KEYS.reports(), filters] as const,
} as const

// Utility types for data aggregation
export interface AggregationOptions {
  groupBy: 'hour' | 'day' | 'week' | 'month'
  timezone?: string
  fillGaps?: boolean
  defaultValue?: number
}

export interface ComparisonOptions {
  previousPeriod: boolean
  comparisonType: 'absolute' | 'percentage'
  showTrend: boolean
}

// Date preset configurations
export const DATE_RANGE_PRESETS: DateRangePreset[] = [
  {
    key: 'last24h',
    label: 'Last 24 hours',
    value: {
      startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    }
  },
  {
    key: 'last7d',
    label: 'Last 7 days',
    value: {
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    }
  },
  {
    key: 'last30d',
    label: 'Last 30 days',
    value: {
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    }
  },
  {
    key: 'last90d',
    label: 'Last 90 days',
    value: {
      startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString()
    }
  }
] as const

// Export field configurations for reports
export const DEFAULT_ANALYTICS_EXPORT_FIELDS: ExportField[] = [
  { key: 'workflowName', label: 'Workflow Name', selected: true, format: 'text' },
  { key: 'totalExecutions', label: 'Total Executions', selected: true, format: 'number' },
  { key: 'successRate', label: 'Success Rate', selected: true, format: 'percentage' },
  { key: 'averageDuration', label: 'Average Duration', selected: true, format: 'duration' },
  { key: 'lastExecution', label: 'Last Execution', selected: true, format: 'date' },
  { key: 'errorRate', label: 'Error Rate', selected: false, format: 'percentage' },
  { key: 'uptime', label: 'Uptime', selected: false, format: 'percentage' },
  { key: 'executionsPerDay', label: 'Executions/Day', selected: false, format: 'number' },
] as const