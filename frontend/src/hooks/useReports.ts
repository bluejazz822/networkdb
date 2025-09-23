import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/utils/api'
import type {
  ReportDefinition,
  ReportQuery,
  ReportTemplate,
  DashboardData,
  ReportWidgetData,
  ReportExecution,
  ScheduledReport,
  ReportAnalytics,
  ExportOptions,
  ExportResult,
  ReportApiResponse,
  UseReportsOptions,
  UseReportExecutionOptions,
  ResourceType,
  AggregationType
} from '@/types/reports'

// Query keys for report-related queries
const REPORTS_QUERY_KEYS = {
  all: ['reports'] as const,
  dashboard: () => [...REPORTS_QUERY_KEYS.all, 'dashboard'] as const,
  widgets: (type: string) => [...REPORTS_QUERY_KEYS.all, 'widgets', type] as const,
  templates: () => [...REPORTS_QUERY_KEYS.all, 'templates'] as const,
  template: (id: string) => [...REPORTS_QUERY_KEYS.templates(), id] as const,
  scheduled: () => [...REPORTS_QUERY_KEYS.all, 'scheduled'] as const,
  execution: (id: string) => [...REPORTS_QUERY_KEYS.all, 'execution', id] as const,
  history: (reportId?: number) => [...REPORTS_QUERY_KEYS.all, 'history', reportId] as const,
  analytics: (reportId?: number) => [...REPORTS_QUERY_KEYS.all, 'analytics', reportId] as const,
} as const

// ===================== DASHBOARD HOOKS =====================

/**
 * Hook for fetching dashboard data with key metrics and widgets
 */
export function useReportsDashboard(options: UseReportsOptions = {}) {
  const {
    enabled = true,
    refetchInterval = 300000, // 5 minutes
    retry = 2,
    staleTime = 60000, // 1 minute
    gcTime = 300000 // 5 minutes
  } = options

  const fetchDashboard = async (): Promise<DashboardData> => {
    try {
      console.log('🔍 Fetching reports dashboard from /reports/dashboard...')
      const response = await apiClient.get<ReportApiResponse<DashboardData>>('/reports/dashboard')
      console.log('✅ Dashboard response:', response)

      if (!response.success || !response.data) {
        throw new Error('Invalid dashboard response')
      }

      return response.data
    } catch (error) {
      console.error('❌ Dashboard fetch error:', error)
      throw error
    }
  }

  const query = useQuery({
    queryKey: REPORTS_QUERY_KEYS.dashboard(),
    queryFn: fetchDashboard,
    enabled,
    refetchInterval,
    retry,
    staleTime,
    gcTime,
  })

  return {
    dashboard: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
  }
}

/**
 * Hook for fetching specific widget data
 */
export function useReportsWidget(
  widgetType: 'metrics' | 'charts' | 'status' | 'activity',
  options: UseReportsOptions & {
    timeRange?: '1h' | '24h' | '7d' | '30d';
    refresh?: boolean;
  } = {}
) {
  const {
    enabled = true,
    refetchInterval = 120000, // 2 minutes
    timeRange = '24h',
    refresh = false,
    ...queryOptions
  } = options

  const fetchWidget = async (): Promise<ReportWidgetData> => {
    const params = new URLSearchParams({ timeRange, refresh: refresh.toString() })
    const response = await apiClient.get<ReportApiResponse<ReportWidgetData>>(
      `/reports/dashboard/widgets/${widgetType}?${params}`
    )

    if (!response.success || !response.data) {
      throw new Error(`Failed to fetch ${widgetType} widget data`)
    }

    return response.data
  }

  const query = useQuery({
    queryKey: REPORTS_QUERY_KEYS.widgets(widgetType),
    queryFn: fetchWidget,
    enabled,
    refetchInterval,
    ...queryOptions,
  })

  return {
    widget: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

// ===================== REPORT GENERATION HOOKS =====================

/**
 * Hook for generating reports
 */
export function useGenerateReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reportQuery: ReportQuery): Promise<any> => {
      const response = await apiClient.post<ReportApiResponse<any>>('/reports/generate', reportQuery)

      if (!response.success) {
        throw new Error(response.errors?.[0]?.message || 'Failed to generate report')
      }

      return response.data
    },
    onSuccess: () => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEYS.all })
    },
  })
}

/**
 * Hook for generating report previews
 */
export function useReportPreview() {
  return useMutation({
    mutationFn: async (reportQuery: ReportQuery): Promise<any> => {
      const response = await apiClient.post<ReportApiResponse<any>>('/reports/preview', reportQuery)

      if (!response.success) {
        throw new Error(response.errors?.[0]?.message || 'Failed to generate preview')
      }

      return response.data
    },
  })
}

/**
 * Hook for getting aggregated data for charts
 */
export function useAggregatedData() {
  return useMutation({
    mutationFn: async (params: {
      resourceType: ResourceType;
      aggregation: AggregationType;
      groupBy: string;
      filters?: any[];
    }): Promise<any> => {
      const response = await apiClient.post<ReportApiResponse<any>>('/reports/aggregate', params)

      if (!response.success) {
        throw new Error(response.errors?.[0]?.message || 'Failed to get aggregated data')
      }

      return response.data
    },
  })
}

// ===================== TEMPLATES HOOKS =====================

/**
 * Hook for fetching report templates
 */
export function useReportTemplates(options: UseReportsOptions = {}) {
  const {
    enabled = true,
    staleTime = 300000, // 5 minutes
    gcTime = 600000, // 10 minutes
    ...queryOptions
  } = options

  const fetchTemplates = async (): Promise<ReportTemplate[]> => {
    const response = await apiClient.get<ReportApiResponse<ReportTemplate[]>>('/reports/templates')

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch report templates')
    }

    return response.data
  }

  const query = useQuery({
    queryKey: REPORTS_QUERY_KEYS.templates(),
    queryFn: fetchTemplates,
    enabled,
    staleTime,
    gcTime,
    ...queryOptions,
  })

  return {
    templates: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Hook for fetching a specific report template
 */
export function useReportTemplate(templateId: string, options: UseReportsOptions = {}) {
  const {
    enabled = !!templateId,
    staleTime = 300000, // 5 minutes
    ...queryOptions
  } = options

  const fetchTemplate = async (): Promise<ReportTemplate> => {
    const response = await apiClient.get<ReportApiResponse<ReportTemplate>>(`/reports/templates/${templateId}`)

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch report template')
    }

    return response.data
  }

  const query = useQuery({
    queryKey: REPORTS_QUERY_KEYS.template(templateId),
    queryFn: fetchTemplate,
    enabled,
    staleTime,
    ...queryOptions,
  })

  return {
    template: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

// ===================== SCHEDULED REPORTS HOOKS =====================

/**
 * Hook for fetching scheduled reports
 */
export function useScheduledReports(options: UseReportsOptions = {}) {
  const {
    enabled = true,
    refetchInterval = 60000, // 1 minute
    ...queryOptions
  } = options

  const fetchScheduled = async (): Promise<ScheduledReport[]> => {
    const response = await apiClient.get<ReportApiResponse<ScheduledReport[]>>('/reports/scheduled')

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch scheduled reports')
    }

    return response.data
  }

  const query = useQuery({
    queryKey: REPORTS_QUERY_KEYS.scheduled(),
    queryFn: fetchScheduled,
    enabled,
    refetchInterval,
    ...queryOptions,
  })

  return {
    scheduledReports: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Hook for scheduling a report
 */
export function useScheduleReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reportDefinition: ReportDefinition): Promise<any> => {
      const response = await apiClient.post<ReportApiResponse<any>>('/reports/schedule', reportDefinition)

      if (!response.success) {
        throw new Error(response.errors?.[0]?.message || 'Failed to schedule report')
      }

      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEYS.scheduled() })
    },
  })
}

/**
 * Hook for unscheduling a report
 */
export function useUnscheduleReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (reportId: number): Promise<void> => {
      const response = await apiClient.delete<ReportApiResponse<void>>(`/reports/scheduled/${reportId}`)

      if (!response.success) {
        throw new Error(response.errors?.[0]?.message || 'Failed to unschedule report')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REPORTS_QUERY_KEYS.scheduled() })
    },
  })
}

// ===================== EXPORT HOOKS =====================

/**
 * Hook for exporting report data
 */
export function useExportReport() {
  return useMutation({
    mutationFn: async (params: {
      data: any[];
      format: string;
      options?: ExportOptions;
      metadata?: any;
    }): Promise<ExportResult> => {
      const response = await apiClient.post<ReportApiResponse<ExportResult>>('/reports/export', params)

      if (!response.success) {
        throw new Error(response.errors?.[0]?.message || 'Failed to export report')
      }

      return response.data!
    },
  })
}

// ===================== ANALYTICS HOOKS =====================

/**
 * Hook for fetching report analytics
 */
export function useReportAnalytics(reportId?: number, options: UseReportsOptions = {}) {
  const {
    enabled = true,
    staleTime = 300000, // 5 minutes
    ...queryOptions
  } = options

  const fetchAnalytics = async (): Promise<ReportAnalytics> => {
    const params = reportId ? `?reportId=${reportId}` : ''
    const response = await apiClient.get<ReportApiResponse<ReportAnalytics>>(`/reports/analytics${params}`)

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch report analytics')
    }

    return response.data
  }

  const query = useQuery({
    queryKey: REPORTS_QUERY_KEYS.analytics(reportId),
    queryFn: fetchAnalytics,
    enabled,
    staleTime,
    ...queryOptions,
  })

  return {
    analytics: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Hook for fetching report execution history
 */
export function useReportHistory(
  reportId?: number,
  options: UseReportsOptions & {
    limit?: number;
    offset?: number;
  } = {}
) {
  const {
    enabled = true,
    limit = 20,
    offset = 0,
    ...queryOptions
  } = options

  const fetchHistory = async (): Promise<ReportExecution[]> => {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
    })

    if (reportId) {
      params.append('reportId', reportId.toString())
    }

    const response = await apiClient.get<ReportApiResponse<ReportExecution[]>>(`/reports/history?${params}`)

    if (!response.success || !response.data) {
      throw new Error('Failed to fetch report history')
    }

    return response.data
  }

  const query = useQuery({
    queryKey: REPORTS_QUERY_KEYS.history(reportId),
    queryFn: fetchHistory,
    enabled,
    ...queryOptions,
  })

  return {
    history: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

// ===================== UTILITY HOOKS =====================

/**
 * Combined hook for reports overview
 */
export function useReportsOverview(options: UseReportsOptions = {}) {
  const dashboardQuery = useReportsDashboard(options)
  const templatesQuery = useReportTemplates(options)
  const scheduledQuery = useScheduledReports(options)

  return {
    // Dashboard data
    dashboard: dashboardQuery.dashboard,
    isDashboardLoading: dashboardQuery.isLoading,
    isDashboardError: dashboardQuery.isError,
    dashboardError: dashboardQuery.error,

    // Templates data
    templates: templatesQuery.templates,
    isTemplatesLoading: templatesQuery.isLoading,
    isTemplatesError: templatesQuery.isError,
    templatesError: templatesQuery.error,

    // Scheduled reports data
    scheduledReports: scheduledQuery.scheduledReports,
    isScheduledLoading: scheduledQuery.isLoading,
    isScheduledError: scheduledQuery.isError,
    scheduledError: scheduledQuery.error,

    // Combined states
    isLoading: dashboardQuery.isLoading || templatesQuery.isLoading || scheduledQuery.isLoading,
    isError: dashboardQuery.isError || templatesQuery.isError || scheduledQuery.isError,
    isFetching: dashboardQuery.isFetching || templatesQuery.isFetching || scheduledQuery.isFetching,

    // Combined actions
    refetchAll: () => {
      dashboardQuery.refetch()
      templatesQuery.refetch()
      scheduledQuery.refetch()
    },
  }
}

/**
 * Hook for real-time report monitoring
 */
export function useReportMonitoring(options: {
  enabled?: boolean;
  fastRefresh?: boolean;
} = {}) {
  const {
    enabled = true,
    fastRefresh = false
  } = options

  const refetchInterval = fastRefresh ? 30000 : 120000 // 30s or 2min

  const dashboardQuery = useReportsDashboard({
    enabled,
    refetchInterval,
    retry: 1
  })

  const scheduledQuery = useScheduledReports({
    enabled,
    refetchInterval: refetchInterval * 2, // Less frequent for scheduled reports
    retry: 1
  })

  return {
    dashboard: dashboardQuery.dashboard,
    scheduledReports: scheduledQuery.scheduledReports,

    // Status indicators
    hasReports: dashboardQuery.dashboard?.resourceCounts?.totalResources ?
      dashboardQuery.dashboard.resourceCounts.totalResources > 0 : false,
    hasScheduledReports: scheduledQuery.scheduledReports.length > 0,

    // Loading states
    isLoading: dashboardQuery.isLoading || scheduledQuery.isLoading,
    isError: dashboardQuery.isError || scheduledQuery.isError,
    error: dashboardQuery.error || scheduledQuery.error,

    // Actions
    refetch: () => {
      dashboardQuery.refetch()
      scheduledQuery.refetch()
    },

    lastUpdate: new Date().getTime(),
  }
}