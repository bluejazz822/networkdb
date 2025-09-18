import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/utils/api'
import {
  generateWorkflowAnalytics,
  generateExecutionTimeAnalysis,
  generateErrorAnalysis,
  generateUsagePatterns,
  calculateDataFreshness,
  aggregateExecutionsByWorkflow,
  createDateRange,
  getDateRangePreset
} from '@/utils/analyticsHelpers'
import { useWorkflowExecutions } from '@/hooks/useWorkflowData'
import type {
  AnalyticsFilters,
  DateRange,
  WorkflowAnalytics,
  ExecutionMetrics,
  TimeSeriesData,
  PerformanceMetrics,
  DataFreshnessMetrics,
  ExecutionTimeAnalysis,
  ErrorAnalysis,
  UsagePatterns,
  AnalyticsDashboard,
  ReportData,
  ReportFilters,
  UseAnalyticsOptions,
  UseWorkflowAnalyticsOptions,
  UseMetricsOptions,
  UseTimeSeriesOptions,
  ANALYTICS_QUERY_KEYS,
  AnalyticsResponse,
  WorkflowAnalyticsResponse,
  MetricsResponse,
  TimeSeriesResponse,
  ExecutionTimeAnalysisResponse,
  ErrorAnalysisResponse,
  UsagePatternsResponse,
  ReportResponse
} from '@/types/analytics'
import type {
  WorkflowExecution,
  ExecutionFilters,
  Workflow
} from '@/types/workflow'

/**
 * Hook for fetching comprehensive analytics dashboard data
 */
export function useAnalyticsDashboard(options: UseAnalyticsOptions = {}) {
  const {
    filters = {},
    enabled = true,
    refetchInterval = 5 * 60 * 1000, // 5 minutes
    retry = 2,
    staleTime = 2 * 60 * 1000 // 2 minutes
  } = options

  const buildQueryParams = (filters: AnalyticsFilters): string => {
    const params = new URLSearchParams()

    // Include base execution filters
    if (filters.workflowId) params.append('workflowId', filters.workflowId)
    if (filters.status?.length) {
      filters.status.forEach(status => params.append('status', status))
    }
    if (filters.startedAfter) params.append('startedAfter', filters.startedAfter)
    if (filters.startedBefore) params.append('startedBefore', filters.startedBefore)

    // Analytics-specific filters
    if (filters.dateRange) {
      params.append('startDate', filters.dateRange.startDate)
      params.append('endDate', filters.dateRange.endDate)
    }
    if (filters.groupBy) params.append('groupBy', filters.groupBy)
    if (filters.includeMetrics !== undefined) {
      params.append('includeMetrics', String(filters.includeMetrics))
    }
    if (filters.aggregateBy) params.append('aggregateBy', filters.aggregateBy)

    return params.toString()
  }

  const fetchAnalyticsDashboard = async (): Promise<AnalyticsDashboard> => {
    const queryParams = buildQueryParams(filters)
    const url = `/analytics/dashboard${queryParams ? `?${queryParams}` : ''}`
    const response = await apiClient.get<AnalyticsResponse>(url)
    return response.data
  }

  const query = useQuery({
    queryKey: ANALYTICS_QUERY_KEYS.dashboard(),
    queryFn: fetchAnalyticsDashboard,
    enabled,
    refetchInterval,
    retry,
    staleTime,
    gcTime: 10 * 60 * 1000, // 10 minutes
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
 * Hook for fetching workflow analytics data
 */
export function useWorkflowAnalytics(options: UseWorkflowAnalyticsOptions = {}) {
  const {
    workflowId,
    filters = {},
    enabled = true,
    refetchInterval = 5 * 60 * 1000,
    retry = 2,
    staleTime = 2 * 60 * 1000
  } = options

  const buildQueryParams = (filters: AnalyticsFilters): string => {
    const params = new URLSearchParams()

    if (filters.dateRange) {
      params.append('startDate', filters.dateRange.startDate)
      params.append('endDate', filters.dateRange.endDate)
    }
    if (filters.groupBy) params.append('groupBy', filters.groupBy)
    if (filters.includeMetrics !== undefined) {
      params.append('includeMetrics', String(filters.includeMetrics))
    }

    return params.toString()
  }

  const fetchWorkflowAnalytics = async (): Promise<WorkflowAnalytics[]> => {
    const queryParams = buildQueryParams(filters)
    let url = '/analytics/workflows'

    if (workflowId) {
      url = `/analytics/workflows/${workflowId}`
    }

    url += queryParams ? `?${queryParams}` : ''

    const response = await apiClient.get<WorkflowAnalyticsResponse>(url)
    return Array.isArray(response.data) ? response.data : [response.data]
  }

  const query = useQuery({
    queryKey: workflowId
      ? ANALYTICS_QUERY_KEYS.workflowAnalytic(workflowId, filters)
      : ANALYTICS_QUERY_KEYS.workflowAnalytics(),
    queryFn: fetchWorkflowAnalytics,
    enabled,
    refetchInterval,
    retry,
    staleTime,
    gcTime: 10 * 60 * 1000,
  })

  return {
    analytics: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

/**
 * Hook for fetching execution metrics with aggregation
 */
export function useExecutionMetrics(options: UseMetricsOptions = {}) {
  const {
    filters = {},
    groupBy = 'day',
    aggregateBy = 'workflow',
    enabled = true,
    refetchInterval = 5 * 60 * 1000,
    retry = 2,
    staleTime = 2 * 60 * 1000
  } = options

  const buildQueryParams = (filters: AnalyticsFilters): string => {
    const params = new URLSearchParams()

    if (filters.workflowId) params.append('workflowId', filters.workflowId)
    if (filters.dateRange) {
      params.append('startDate', filters.dateRange.startDate)
      params.append('endDate', filters.dateRange.endDate)
    }
    params.append('groupBy', groupBy)
    params.append('aggregateBy', aggregateBy)

    return params.toString()
  }

  const fetchMetrics = async (): Promise<ExecutionMetrics[]> => {
    const queryParams = buildQueryParams(filters)
    const url = `/analytics/metrics${queryParams ? `?${queryParams}` : ''}`
    const response = await apiClient.get<MetricsResponse>(url)
    return response.data
  }

  const query = useQuery({
    queryKey: ANALYTICS_QUERY_KEYS.metric({ ...filters, groupBy, aggregateBy }),
    queryFn: fetchMetrics,
    enabled,
    refetchInterval,
    retry,
    staleTime,
    gcTime: 10 * 60 * 1000,
  })

  return {
    metrics: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

/**
 * Hook for fetching time series data for charts
 */
export function useTimeSeriesData(options: UseTimeSeriesOptions) {
  const {
    metric,
    interval = 'day',
    filters = {},
    enabled = true,
    refetchInterval = 5 * 60 * 1000,
    retry = 2,
    staleTime = 2 * 60 * 1000
  } = options

  const buildQueryParams = (filters: AnalyticsFilters): string => {
    const params = new URLSearchParams()

    if (filters.workflowId) params.append('workflowId', filters.workflowId)
    if (filters.dateRange) {
      params.append('startDate', filters.dateRange.startDate)
      params.append('endDate', filters.dateRange.endDate)
    }
    params.append('metric', metric)
    params.append('interval', interval)

    return params.toString()
  }

  const fetchTimeSeries = async (): Promise<TimeSeriesData[]> => {
    const queryParams = buildQueryParams(filters)
    const url = `/analytics/time-series${queryParams ? `?${queryParams}` : ''}`
    const response = await apiClient.get<TimeSeriesResponse>(url)
    return response.data
  }

  const query = useQuery({
    queryKey: ANALYTICS_QUERY_KEYS.timeSeriesData(metric, { ...filters, groupBy: interval }),
    queryFn: fetchTimeSeries,
    enabled,
    refetchInterval,
    retry,
    staleTime,
    gcTime: 10 * 60 * 1000,
  })

  return {
    timeSeries: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

/**
 * Hook for fetching execution time analysis
 */
export function useExecutionTimeAnalysis(options: UseAnalyticsOptions = {}) {
  const {
    filters = {},
    enabled = true,
    refetchInterval = 10 * 60 * 1000, // 10 minutes
    retry = 2,
    staleTime = 5 * 60 * 1000 // 5 minutes
  } = options

  const buildQueryParams = (filters: AnalyticsFilters): string => {
    const params = new URLSearchParams()

    if (filters.workflowId) params.append('workflowId', filters.workflowId)
    if (filters.dateRange) {
      params.append('startDate', filters.dateRange.startDate)
      params.append('endDate', filters.dateRange.endDate)
    }

    return params.toString()
  }

  const fetchExecutionTimeAnalysis = async (): Promise<ExecutionTimeAnalysis[]> => {
    const queryParams = buildQueryParams(filters)
    const url = `/analytics/execution-time${queryParams ? `?${queryParams}` : ''}`
    const response = await apiClient.get<ExecutionTimeAnalysisResponse>(url)
    return response.data
  }

  const query = useQuery({
    queryKey: ANALYTICS_QUERY_KEYS.executionAnalysisData(filters),
    queryFn: fetchExecutionTimeAnalysis,
    enabled,
    refetchInterval,
    retry,
    staleTime,
    gcTime: 15 * 60 * 1000,
  })

  return {
    analysis: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

/**
 * Hook for fetching error analysis data
 */
export function useErrorAnalysis(options: UseAnalyticsOptions = {}) {
  const {
    filters = {},
    enabled = true,
    refetchInterval = 10 * 60 * 1000,
    retry = 2,
    staleTime = 5 * 60 * 1000
  } = options

  const buildQueryParams = (filters: AnalyticsFilters): string => {
    const params = new URLSearchParams()

    if (filters.workflowId) params.append('workflowId', filters.workflowId)
    if (filters.dateRange) {
      params.append('startDate', filters.dateRange.startDate)
      params.append('endDate', filters.dateRange.endDate)
    }

    return params.toString()
  }

  const fetchErrorAnalysis = async (): Promise<ErrorAnalysis[]> => {
    const queryParams = buildQueryParams(filters)
    const url = `/analytics/errors${queryParams ? `?${queryParams}` : ''}`
    const response = await apiClient.get<ErrorAnalysisResponse>(url)
    return response.data
  }

  const query = useQuery({
    queryKey: ANALYTICS_QUERY_KEYS.errorAnalysisData(filters),
    queryFn: fetchErrorAnalysis,
    enabled,
    refetchInterval,
    retry,
    staleTime,
    gcTime: 15 * 60 * 1000,
  })

  return {
    errorAnalysis: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

/**
 * Hook for fetching usage patterns analysis
 */
export function useUsagePatterns(options: UseAnalyticsOptions = {}) {
  const {
    filters = {},
    enabled = true,
    refetchInterval = 15 * 60 * 1000, // 15 minutes
    retry = 2,
    staleTime = 10 * 60 * 1000 // 10 minutes
  } = options

  const buildQueryParams = (filters: AnalyticsFilters): string => {
    const params = new URLSearchParams()

    if (filters.workflowId) params.append('workflowId', filters.workflowId)
    if (filters.dateRange) {
      params.append('startDate', filters.dateRange.startDate)
      params.append('endDate', filters.dateRange.endDate)
    }

    return params.toString()
  }

  const fetchUsagePatterns = async (): Promise<UsagePatterns[]> => {
    const queryParams = buildQueryParams(filters)
    const url = `/analytics/usage-patterns${queryParams ? `?${queryParams}` : ''}`
    const response = await apiClient.get<UsagePatternsResponse>(url)
    return response.data
  }

  const query = useQuery({
    queryKey: ANALYTICS_QUERY_KEYS.usagePatternsData(filters),
    queryFn: fetchUsagePatterns,
    enabled,
    refetchInterval,
    retry,
    staleTime,
    gcTime: 20 * 60 * 1000,
  })

  return {
    usagePatterns: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

/**
 * Hook for generating and downloading analytics reports
 */
export function useAnalyticsReport() {
  const generateReport = async (reportFilters: ReportFilters): Promise<ReportData> => {
    const queryParams = new URLSearchParams()

    if (reportFilters.workflowIds?.length) {
      reportFilters.workflowIds.forEach(id => queryParams.append('workflowIds', id))
    }
    queryParams.append('startDate', reportFilters.dateRange.startDate)
    queryParams.append('endDate', reportFilters.dateRange.endDate)
    queryParams.append('includeCharts', String(reportFilters.includeCharts))
    queryParams.append('includeRawData', String(reportFilters.includeRawData))
    queryParams.append('groupBy', reportFilters.groupBy)
    reportFilters.metrics.forEach(metric => queryParams.append('metrics', metric))

    const url = `/analytics/reports?${queryParams.toString()}`
    const response = await apiClient.get<ReportResponse>(url)
    return response.data
  }

  return { generateReport }
}

/**
 * Client-side analytics generation hook using existing execution data
 * Useful when API analytics endpoints are not available or for real-time local analysis
 */
export function useClientSideAnalytics(
  workflowId?: string,
  dateRange: DateRange = createDateRange(30)
) {
  // Fetch execution data using existing hooks
  const executionFilters: ExecutionFilters = {
    workflowId,
    startedAfter: dateRange.startDate,
    startedBefore: dateRange.endDate,
    sortBy: 'startedAt',
    sortOrder: 'desc',
    limit: 1000 // Get a reasonable amount of data
  }

  const {
    executions,
    isLoading: executionsLoading,
    isError: executionsError,
    error: executionsErrorDetails
  } = useWorkflowExecutions({
    filters: executionFilters,
    enabled: true,
    refetchInterval: 5 * 60 * 1000
  })

  // Generate analytics from execution data
  const analytics = React.useMemo(() => {
    if (!executions || executions.length === 0) return null

    if (workflowId) {
      // Single workflow analytics
      const workflow = executions[0]?.workflowData
      const workflowName = workflow?.name || `Workflow ${workflowId}`

      return generateWorkflowAnalytics(workflowId, workflowName, executions, dateRange)
    } else {
      // Multi-workflow analytics
      const workflowGroups = aggregateExecutionsByWorkflow(executions)

      return Object.entries(workflowGroups).map(([id, workflowExecutions]) => {
        const workflow = workflowExecutions[0]?.workflowData
        const workflowName = workflow?.name || `Workflow ${id}`

        return generateWorkflowAnalytics(id, workflowName, workflowExecutions, dateRange)
      })
    }
  }, [executions, workflowId, dateRange])

  const executionTimeAnalysis = React.useMemo(() => {
    if (!executions || executions.length === 0 || !workflowId) return null

    const workflow = executions[0]?.workflowData
    const workflowName = workflow?.name || `Workflow ${workflowId}`

    return generateExecutionTimeAnalysis(workflowId, workflowName, executions)
  }, [executions, workflowId])

  const errorAnalysis = React.useMemo(() => {
    if (!executions || executions.length === 0 || !workflowId) return null

    const workflow = executions[0]?.workflowData
    const workflowName = workflow?.name || `Workflow ${workflowId}`

    return generateErrorAnalysis(workflowId, workflowName, executions)
  }, [executions, workflowId])

  const usagePatterns = React.useMemo(() => {
    if (!executions || executions.length === 0 || !workflowId) return null

    const workflow = executions[0]?.workflowData
    const workflowName = workflow?.name || `Workflow ${workflowId}`

    return generateUsagePatterns(workflowId, workflowName, executions)
  }, [executions, workflowId])

  return {
    analytics,
    executionTimeAnalysis,
    errorAnalysis,
    usagePatterns,
    rawExecutions: executions,
    isLoading: executionsLoading,
    isError: executionsError,
    error: executionsErrorDetails,
  }
}

/**
 * Utility hook for invalidating analytics queries
 */
export function useAnalyticsQueryInvalidation() {
  const queryClient = useQueryClient()

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEYS.all })
  }

  const invalidateDashboard = () => {
    queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEYS.dashboard() })
  }

  const invalidateWorkflowAnalytics = (workflowId?: string) => {
    if (workflowId) {
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey
          return queryKey.includes('workflow-analytics') && queryKey.includes(workflowId)
        }
      })
    } else {
      queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEYS.workflowAnalytics() })
    }
  }

  const invalidateMetrics = () => {
    queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEYS.metrics() })
  }

  const invalidateTimeSeries = () => {
    queryClient.invalidateQueries({ queryKey: ANALYTICS_QUERY_KEYS.timeSeries() })
  }

  return {
    invalidateAll,
    invalidateDashboard,
    invalidateWorkflowAnalytics,
    invalidateMetrics,
    invalidateTimeSeries,
  }
}

/**
 * Hook for data freshness monitoring
 */
export function useDataFreshness(
  lastSuccessfulExecution?: string,
  expectedFrequencyMinutes = 60
) {
  const freshness = React.useMemo(() => {
    return calculateDataFreshness(lastSuccessfulExecution, expectedFrequencyMinutes)
  }, [lastSuccessfulExecution, expectedFrequencyMinutes])

  return freshness
}

/**
 * Hook for managing analytics date ranges with presets
 */
export function useAnalyticsDateRange(initialRange?: DateRange) {
  const [dateRange, setDateRange] = React.useState<DateRange>(
    initialRange || createDateRange(7) // Default to last 7 days
  )
  const [selectedPreset, setSelectedPreset] = React.useState<string>('last7d')

  const applyPreset = React.useCallback((presetKey: string) => {
    const preset = getDateRangePreset(presetKey)
    if (preset) {
      setDateRange(preset)
      setSelectedPreset(presetKey)
    }
  }, [])

  const setCustomRange = React.useCallback((range: DateRange) => {
    setDateRange(range)
    setSelectedPreset('custom')
  }, [])

  return {
    dateRange,
    selectedPreset,
    applyPreset,
    setCustomRange,
    createRange: createDateRange,
  }
}

// Re-export React for the useMemo/useCallback hooks
import React from 'react'