import { useQuery } from '@tanstack/react-query'
import { apiClient } from '@/utils/api'
import type {
  WorkflowDashboard,
  WorkflowDashboardResponse,
  WorkflowHealth,
  WorkflowHealthResponse,
  UseWorkflowStatusOptions
} from '@/types/workflow'

// Query keys for status-related queries
const WORKFLOW_STATUS_QUERY_KEYS = {
  all: ['workflow-status'] as const,
  dashboard: () => [...WORKFLOW_STATUS_QUERY_KEYS.all, 'dashboard'] as const,
  health: () => [...WORKFLOW_STATUS_QUERY_KEYS.all, 'health'] as const,
} as const

/**
 * Hook for fetching workflow dashboard summary data
 * Provides total counts, recent executions, and overall health status
 */
export function useWorkflowDashboard(options: UseWorkflowStatusOptions = {}) {
  const {
    enabled = true,
    refetchInterval = 120000, // 2 minutes (reduced to avoid rate limiting)
    retry = 2
  } = options

  const fetchDashboard = async (): Promise<WorkflowDashboard> => {
    try {
      console.log('🔍 Fetching workflow dashboard from /workflows/status...')
      const response = await apiClient.get<any>('/workflows/status')
      console.log('✅ Dashboard response:', response)
      console.log('📊 Response data structure:', response.data)

      // Handle different response structures
      const apiData = response.data?.data || response.data || {}
      console.log('🎯 API data extracted:', apiData)

      if (!apiData || typeof apiData !== 'object') {
        throw new Error('Invalid API response structure')
      }

      // Map actual API response to expected WorkflowDashboard interface
      const mappedData: WorkflowDashboard = {
        totalWorkflows: apiData.totalWorkflows || 0,
        activeWorkflows: apiData.activeWorkflows || 0,
        inactiveWorkflows: Math.max(0, (apiData.totalWorkflows || 0) - (apiData.activeWorkflows || 0)),
        errorWorkflows: apiData.failedExecutions || 0,
        totalExecutions: (apiData.successfulExecutions || 0) + (apiData.failedExecutions || 0),
        recentExecutions: [],
        healthStatus: apiData.systemHealth === 'healthy' ? 'healthy' : 'warning',
        lastSyncAt: apiData.lastSyncTime,
        syncInProgress: false
      }

      console.log('🔄 Mapped dashboard data:', mappedData)
      return mappedData
    } catch (error) {
      console.error('❌ Dashboard fetch error:', error)
      throw error
    }
  }

  const query = useQuery({
    queryKey: WORKFLOW_STATUS_QUERY_KEYS.dashboard(),
    queryFn: fetchDashboard,
    enabled,
    refetchInterval,
    retry: 1, // Reduced retry attempts
    staleTime: 60 * 1000, // 1 minute stale time
    gcTime: 5 * 60 * 1000, // 5 minutes cache
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
 * Hook for fetching workflow system health status
 * Provides detailed health checks for various system components
 */
export function useWorkflowHealth(options: UseWorkflowStatusOptions = {}) {
  const {
    enabled = true,
    refetchInterval = 60000, // 1 minute
    retry = 3
  } = options

  const fetchHealth = async (): Promise<WorkflowHealth> => {
    const response = await apiClient.get<WorkflowHealthResponse>('/workflows/health')
    return response.data.data
  }

  const query = useQuery({
    queryKey: WORKFLOW_STATUS_QUERY_KEYS.health(),
    queryFn: fetchHealth,
    enabled,
    refetchInterval,
    retry,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
  })

  return {
    health: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

/**
 * Combined hook that provides both dashboard and health data
 * Useful for main dashboard components that need both datasets
 */
export function useWorkflowOverview(options: UseWorkflowStatusOptions = {}) {
  const dashboardQuery = useWorkflowDashboard(options)
  const healthQuery = useWorkflowHealth(options)

  return {
    // Dashboard data
    dashboard: dashboardQuery.dashboard,
    isDashboardLoading: dashboardQuery.isLoading,
    isDashboardError: dashboardQuery.isError,
    dashboardError: dashboardQuery.error,
    refetchDashboard: dashboardQuery.refetch,

    // Health data
    health: healthQuery.health,
    isHealthLoading: healthQuery.isLoading,
    isHealthError: healthQuery.isError,
    healthError: healthQuery.error,
    refetchHealth: healthQuery.refetch,

    // Combined states
    isLoading: dashboardQuery.isLoading || healthQuery.isLoading,
    isError: dashboardQuery.isError || healthQuery.isError,
    isFetching: dashboardQuery.isFetching || healthQuery.isFetching,

    // Combined actions
    refetchAll: () => {
      dashboardQuery.refetch()
      healthQuery.refetch()
    },
  }
}

/**
 * Hook for real-time workflow status monitoring
 * Provides more frequent updates for critical status information
 */
export function useWorkflowMonitoring(options: {
  enabled?: boolean
  fastRefresh?: boolean
} = {}) {
  const {
    enabled = true,
    fastRefresh = false
  } = options

  // Use faster refresh intervals for monitoring
  const refetchInterval = fastRefresh ? 10000 : 30000 // 10s or 30s

  const dashboardQuery = useWorkflowDashboard({
    enabled,
    refetchInterval,
    retry: 1 // Faster retry for monitoring
  })

  const healthQuery = useWorkflowHealth({
    enabled,
    refetchInterval: refetchInterval * 2, // Health updates can be less frequent
    retry: 1
  })

  // Derived status indicators
  const isSystemHealthy = healthQuery.health?.status === 'healthy'
  const hasActiveWorkflows = (dashboardQuery.dashboard?.activeWorkflows || 0) > 0
  const hasErrors = (dashboardQuery.dashboard?.errorWorkflows || 0) > 0
  const isSyncInProgress = dashboardQuery.dashboard?.syncInProgress || false

  return {
    // Raw data
    dashboard: dashboardQuery.dashboard,
    health: healthQuery.health,

    // Status indicators
    isSystemHealthy,
    hasActiveWorkflows,
    hasErrors,
    isSyncInProgress,

    // Loading states
    isLoading: dashboardQuery.isLoading || healthQuery.isLoading,
    isError: dashboardQuery.isError || healthQuery.isError,
    error: dashboardQuery.error || healthQuery.error,

    // Actions
    refetch: () => {
      dashboardQuery.refetch()
      healthQuery.refetch()
    },

    // Real-time status
    lastUpdate: new Date().getTime(),
  }
}

/**
 * Hook for workflow metrics and statistics
 * Provides calculated metrics from dashboard data
 */
export function useWorkflowMetrics(enabled = true) {
  const { dashboard, isLoading, isError, error } = useWorkflowDashboard({ enabled })

  // Calculate derived metrics
  const metrics = dashboard ? {
    totalWorkflows: dashboard.totalWorkflows,
    activeWorkflows: dashboard.activeWorkflows,
    inactiveWorkflows: dashboard.inactiveWorkflows,
    errorWorkflows: dashboard.errorWorkflows,
    totalExecutions: dashboard.totalExecutions,

    // Calculated percentages
    activePercentage: dashboard.totalWorkflows > 0
      ? Math.round((dashboard.activeWorkflows / dashboard.totalWorkflows) * 100)
      : 0,
    errorPercentage: dashboard.totalWorkflows > 0
      ? Math.round((dashboard.errorWorkflows / dashboard.totalWorkflows) * 100)
      : 0,
    healthPercentage: dashboard.totalWorkflows > 0
      ? Math.round(((dashboard.totalWorkflows - dashboard.errorWorkflows) / dashboard.totalWorkflows) * 100)
      : 100,

    // Status indicators
    hasWorkflows: dashboard.totalWorkflows > 0,
    allWorkflowsHealthy: dashboard.errorWorkflows === 0,
    mostWorkflowsActive: dashboard.activeWorkflows > dashboard.inactiveWorkflows,
    recentActivityCount: dashboard.recentExecutions?.length || 0,

    // Health status mapping
    overallStatus: dashboard.errorWorkflows > 0
      ? 'warning' as const
      : dashboard.activeWorkflows === 0
      ? 'inactive' as const
      : 'healthy' as const,
  } : null

  return {
    metrics,
    isLoading,
    isError,
    error,
    hasData: !!metrics,
  }
}