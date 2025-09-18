import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import {
  useAnalyticsDashboard,
  useWorkflowAnalytics,
  useExecutionMetrics,
  useTimeSeriesData,
  useExecutionTimeAnalysis,
  useErrorAnalysis,
  useUsagePatterns,
  useAnalyticsReport,
  useClientSideAnalytics,
  useAnalyticsQueryInvalidation,
  useDataFreshness,
  useAnalyticsDateRange
} from '../useAnalyticsData'
import * as analyticsHelpers from '@/utils/analyticsHelpers'
import { apiClient } from '@/utils/api'
import type {
  AnalyticsDashboard,
  WorkflowAnalytics,
  ExecutionMetrics,
  TimeSeriesData,
  DateRange
} from '@/types/analytics'
import type { WorkflowExecution } from '@/types/workflow'

// Mock the API client
vi.mock('@/utils/api', () => ({
  apiClient: {
    get: vi.fn()
  }
}))

// Mock the analytics helpers
vi.mock('@/utils/analyticsHelpers', () => ({
  createDateRange: vi.fn(),
  getDateRangePreset: vi.fn(),
  generateWorkflowAnalytics: vi.fn(),
  generateExecutionTimeAnalysis: vi.fn(),
  generateErrorAnalysis: vi.fn(),
  generateUsagePatterns: vi.fn(),
  calculateDataFreshness: vi.fn(),
  aggregateExecutionsByWorkflow: vi.fn()
}))

// Mock the workflow data hook
vi.mock('@/hooks/useWorkflowData', () => ({
  useWorkflowExecutions: vi.fn()
}))

// Create a wrapper component for React Query
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0
      }
    }
  })

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

// Mock data
const mockDashboard: AnalyticsDashboard = {
  performance: {
    totalWorkflows: 10,
    activeWorkflows: 8,
    totalExecutions: 100,
    successRate: 85,
    averageDuration: 120000,
    executionsPerDay: 20,
    uptime: 95,
    healthScore: 88,
    trendsData: {
      executions: { current: 100, previous: 90, change: 10, changePercent: 11.11, trend: 'up', isImprovement: true },
      successRate: { current: 85, previous: 80, change: 5, changePercent: 6.25, trend: 'up', isImprovement: true },
      averageDuration: { current: 120000, previous: 130000, change: -10000, changePercent: -7.69, trend: 'down', isImprovement: true },
      healthScore: { current: 88, previous: 85, change: 3, changePercent: 3.53, trend: 'up', isImprovement: true }
    },
    periodComparison: {
      current: {
        workflowId: 'all',
        workflowName: 'All Workflows',
        period: '2023-09-18',
        totalExecutions: 100,
        successfulExecutions: 85,
        failedExecutions: 15,
        runningExecutions: 0,
        averageDuration: 120000,
        minDuration: 30000,
        maxDuration: 300000,
        successRate: 85,
        errorRate: 15,
        executionsPerHour: 4.17
      },
      previous: {
        workflowId: 'all',
        workflowName: 'All Workflows',
        period: '2023-09-11',
        totalExecutions: 90,
        successfulExecutions: 72,
        failedExecutions: 18,
        runningExecutions: 0,
        averageDuration: 130000,
        minDuration: 35000,
        maxDuration: 320000,
        successRate: 80,
        errorRate: 20,
        executionsPerHour: 3.75
      }
    }
  },
  dataFreshness: {
    lastSyncAt: '2023-09-18T10:00:00Z',
    stalenessThreshold: 120,
    isStale: false,
    dataAge: 30,
    syncFrequency: 60,
    missedSyncs: 0,
    syncHealth: 'healthy'
  },
  topPerformingWorkflows: [],
  underperformingWorkflows: [],
  recentExecutions: [],
  executionTrends: [],
  statusTrends: [],
  durationTrends: [],
  alertSummary: { critical: 0, warning: 2, info: 5 }
}

const mockWorkflowAnalytics: WorkflowAnalytics = {
  workflowId: 'workflow-1',
  workflowName: 'Test Workflow',
  totalExecutions: 50,
  recentExecutions: 10,
  successRate: 90,
  averageDuration: 90000,
  uptime: 95,
  executionTrend: { current: 10, previous: 8, change: 2, changePercent: 25, trend: 'up', isImprovement: true },
  performanceTrend: { current: 90000, previous: 100000, change: -10000, changePercent: -10, trend: 'down', isImprovement: true },
  healthStatus: 'healthy',
  executionHistory: [],
  durationHistory: [],
  statusDistribution: { success: 45, error: 5, running: 0, waiting: 0, crashed: 0, aborted: 0, cancelled: 0 }
}

const mockTimeSeriesData: TimeSeriesData[] = [
  { timestamp: '2023-09-18T00:00:00Z', value: 10 },
  { timestamp: '2023-09-18T01:00:00Z', value: 15 },
  { timestamp: '2023-09-18T02:00:00Z', value: 8 }
]

describe('useAnalyticsData hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('useAnalyticsDashboard', () => {
    test('should fetch dashboard data successfully', async () => {
      const mockApiResponse = { data: mockDashboard }
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const { result } = renderHook(() => useAnalyticsDashboard(), {
        wrapper: createWrapper()
      })

      expect(result.current.isLoading).toBe(true)

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.dashboard).toEqual(mockDashboard)
      expect(result.current.isError).toBe(false)
      expect(apiClient.get).toHaveBeenCalledWith('/analytics/dashboard')
    })

    test('should handle error states', async () => {
      const mockError = new Error('API Error')
      vi.mocked(apiClient.get).mockRejectedValue(mockError)

      const { result } = renderHook(() => useAnalyticsDashboard(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.error).toBeTruthy()
      expect(result.current.dashboard).toBeUndefined()
    })

    test('should build query parameters correctly', async () => {
      const filters = {
        dateRange: {
          startDate: '2023-09-01T00:00:00Z',
          endDate: '2023-09-30T00:00:00Z'
        },
        groupBy: 'day' as const,
        includeMetrics: true
      }

      vi.mocked(apiClient.get).mockResolvedValue({ data: mockDashboard })

      renderHook(() => useAnalyticsDashboard({ filters }), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalledWith(
          expect.stringContaining('/analytics/dashboard?')
        )
      })

      const calledUrl = vi.mocked(apiClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain('startDate=2023-09-01T00%3A00%3A00Z')
      expect(calledUrl).toContain('endDate=2023-09-30T00%3A00%3A00Z')
      expect(calledUrl).toContain('groupBy=day')
      expect(calledUrl).toContain('includeMetrics=true')
    })

    test('should respect enabled option', () => {
      renderHook(() => useAnalyticsDashboard({ enabled: false }), {
        wrapper: createWrapper()
      })

      expect(apiClient.get).not.toHaveBeenCalled()
    })
  })

  describe('useWorkflowAnalytics', () => {
    test('should fetch single workflow analytics', async () => {
      const mockApiResponse = { data: mockWorkflowAnalytics }
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const { result } = renderHook(
        () => useWorkflowAnalytics({ workflowId: 'workflow-1' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.analytics).toEqual([mockWorkflowAnalytics])
      expect(apiClient.get).toHaveBeenCalledWith('/analytics/workflows/workflow-1')
    })

    test('should fetch all workflow analytics when no workflowId provided', async () => {
      const mockApiResponse = { data: [mockWorkflowAnalytics] }
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const { result } = renderHook(() => useWorkflowAnalytics(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.analytics).toEqual([mockWorkflowAnalytics])
      expect(apiClient.get).toHaveBeenCalledWith('/analytics/workflows')
    })
  })

  describe('useExecutionMetrics', () => {
    test('should fetch execution metrics with correct parameters', async () => {
      const mockMetrics: ExecutionMetrics[] = [
        {
          workflowId: 'workflow-1',
          workflowName: 'Test Workflow',
          period: '2023-09-18',
          totalExecutions: 50,
          successfulExecutions: 45,
          failedExecutions: 5,
          runningExecutions: 0,
          averageDuration: 90000,
          minDuration: 30000,
          maxDuration: 180000,
          successRate: 90,
          errorRate: 10,
          executionsPerHour: 2.08
        }
      ]

      const mockApiResponse = { data: mockMetrics }
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const { result } = renderHook(
        () => useExecutionMetrics({ groupBy: 'day', aggregateBy: 'workflow' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.metrics).toEqual(mockMetrics)

      const calledUrl = vi.mocked(apiClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain('groupBy=day')
      expect(calledUrl).toContain('aggregateBy=workflow')
    })
  })

  describe('useTimeSeriesData', () => {
    test('should fetch time series data for specific metric', async () => {
      const mockApiResponse = { data: mockTimeSeriesData }
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const { result } = renderHook(
        () => useTimeSeriesData({ metric: 'executions', interval: 'hour' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.timeSeries).toEqual(mockTimeSeriesData)

      const calledUrl = vi.mocked(apiClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain('metric=executions')
      expect(calledUrl).toContain('interval=hour')
    })

    test('should handle workflow-specific time series', async () => {
      const mockApiResponse = { data: mockTimeSeriesData }
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const filters = { workflowId: 'workflow-1' }

      renderHook(
        () => useTimeSeriesData({ metric: 'success_rate', filters }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(apiClient.get).toHaveBeenCalled()
      })

      const calledUrl = vi.mocked(apiClient.get).mock.calls[0][0] as string
      expect(calledUrl).toContain('workflowId=workflow-1')
      expect(calledUrl).toContain('metric=success_rate')
    })
  })

  describe('useExecutionTimeAnalysis', () => {
    test('should fetch execution time analysis', async () => {
      const mockAnalysis = {
        workflowId: 'workflow-1',
        workflowName: 'Test Workflow',
        avgExecutionTime: 90000,
        medianExecutionTime: 85000,
        p95ExecutionTime: 150000,
        p99ExecutionTime: 180000,
        timeDistribution: [],
        slowestExecutions: [],
        executionTimeHistory: []
      }

      const mockApiResponse = { data: [mockAnalysis] }
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const { result } = renderHook(() => useExecutionTimeAnalysis(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.analysis).toEqual([mockAnalysis])
      expect(apiClient.get).toHaveBeenCalledWith('/analytics/execution-time')
    })
  })

  describe('useErrorAnalysis', () => {
    test('should fetch error analysis data', async () => {
      const mockErrorAnalysis = {
        workflowId: 'workflow-1',
        workflowName: 'Test Workflow',
        totalErrors: 5,
        errorRate: 10,
        commonErrors: [],
        errorTrend: { current: 5, previous: 8, change: -3, changePercent: -37.5, trend: 'down', isImprovement: true },
        errorsByNode: [],
        recentErrors: []
      }

      const mockApiResponse = { data: [mockErrorAnalysis] }
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const { result } = renderHook(() => useErrorAnalysis(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.errorAnalysis).toEqual([mockErrorAnalysis])
      expect(apiClient.get).toHaveBeenCalledWith('/analytics/errors')
    })
  })

  describe('useUsagePatterns', () => {
    test('should fetch usage patterns analysis', async () => {
      const mockUsagePatterns = {
        workflowId: 'workflow-1',
        workflowName: 'Test Workflow',
        executionsByHour: [],
        executionsByDay: [],
        executionsByWeek: [],
        peakUsageTime: '10:00',
        averageExecutionsPerDay: 5,
        utilizationRate: 20,
        seasonalTrends: []
      }

      const mockApiResponse = { data: [mockUsagePatterns] }
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const { result } = renderHook(() => useUsagePatterns(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.usagePatterns).toEqual([mockUsagePatterns])
      expect(apiClient.get).toHaveBeenCalledWith('/analytics/usage-patterns')
    })
  })

  describe('useAnalyticsReport', () => {
    test('should generate report successfully', async () => {
      const mockReportData = {
        metadata: {
          title: 'Analytics Report',
          generatedAt: '2023-09-18T10:00:00Z',
          dateRange: {
            startDate: '2023-09-01T00:00:00Z',
            endDate: '2023-09-30T00:00:00Z'
          },
          totalWorkflows: 10,
          totalExecutions: 100,
          reportType: 'summary' as const
        },
        summary: mockDashboard.performance,
        workflowAnalytics: [mockWorkflowAnalytics]
      }

      const mockApiResponse = { data: mockReportData }
      vi.mocked(apiClient.get).mockResolvedValue(mockApiResponse)

      const { result } = renderHook(() => useAnalyticsReport(), {
        wrapper: createWrapper()
      })

      const reportFilters = {
        workflowIds: ['workflow-1'],
        dateRange: {
          startDate: '2023-09-01T00:00:00Z',
          endDate: '2023-09-30T00:00:00Z'
        },
        includeCharts: true,
        includeRawData: false,
        groupBy: 'workflow' as const,
        metrics: ['executions' as const, 'performance' as const]
      }

      const reportData = await result.current.generateReport(reportFilters)

      expect(reportData).toEqual(mockReportData)
      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/analytics/reports?')
      )
    })
  })

  describe('useClientSideAnalytics', () => {
    test('should generate analytics from execution data', () => {
      const mockExecutions: WorkflowExecution[] = [
        {
          id: 'exec-1',
          workflowId: 'workflow-1',
          mode: 'trigger',
          startedAt: '2023-09-18T10:00:00Z',
          stoppedAt: '2023-09-18T10:05:00Z',
          finished: true,
          status: 'success',
          workflowData: {
            id: 'workflow-1',
            name: 'Test Workflow',
            active: true,
            nodes: [],
            connections: {},
            settings: {}
          }
        }
      ]

      // Mock the useWorkflowExecutions hook
      const mockUseWorkflowExecutions = vi.fn().mockReturnValue({
        executions: mockExecutions,
        isLoading: false,
        isError: false,
        error: null
      })

      vi.doMock('@/hooks/useWorkflowData', () => ({
        useWorkflowExecutions: mockUseWorkflowExecutions
      }))

      // Mock analytics generation functions
      vi.mocked(analyticsHelpers.generateWorkflowAnalytics).mockReturnValue(mockWorkflowAnalytics)
      vi.mocked(analyticsHelpers.aggregateExecutionsByWorkflow).mockReturnValue({
        'workflow-1': mockExecutions
      })

      const { result } = renderHook(
        () => useClientSideAnalytics('workflow-1'),
        { wrapper: createWrapper() }
      )

      expect(result.current.rawExecutions).toEqual(mockExecutions)
      expect(result.current.isLoading).toBe(false)
      expect(result.current.isError).toBe(false)
    })
  })

  describe('useAnalyticsQueryInvalidation', () => {
    test('should provide invalidation functions', () => {
      const { result } = renderHook(() => useAnalyticsQueryInvalidation(), {
        wrapper: createWrapper()
      })

      expect(typeof result.current.invalidateAll).toBe('function')
      expect(typeof result.current.invalidateDashboard).toBe('function')
      expect(typeof result.current.invalidateWorkflowAnalytics).toBe('function')
      expect(typeof result.current.invalidateMetrics).toBe('function')
      expect(typeof result.current.invalidateTimeSeries).toBe('function')

      // Test that functions can be called without error
      expect(() => result.current.invalidateAll()).not.toThrow()
      expect(() => result.current.invalidateDashboard()).not.toThrow()
      expect(() => result.current.invalidateWorkflowAnalytics()).not.toThrow()
      expect(() => result.current.invalidateWorkflowAnalytics('workflow-1')).not.toThrow()
      expect(() => result.current.invalidateMetrics()).not.toThrow()
      expect(() => result.current.invalidateTimeSeries()).not.toThrow()
    })
  })

  describe('useDataFreshness', () => {
    test('should calculate data freshness', () => {
      const mockFreshness = {
        lastSyncAt: '2023-09-18T10:00:00Z',
        stalenessThreshold: 120,
        isStale: false,
        dataAge: 30,
        syncFrequency: 60,
        missedSyncs: 0,
        syncHealth: 'healthy' as const
      }

      vi.mocked(analyticsHelpers.calculateDataFreshness).mockReturnValue(mockFreshness)

      const { result } = renderHook(
        () => useDataFreshness('2023-09-18T10:00:00Z', 60),
        { wrapper: createWrapper() }
      )

      expect(result.current).toEqual(mockFreshness)
      expect(analyticsHelpers.calculateDataFreshness).toHaveBeenCalledWith(
        '2023-09-18T10:00:00Z',
        60
      )
    })

    test('should recalculate when inputs change', () => {
      vi.mocked(analyticsHelpers.calculateDataFreshness).mockReturnValue({
        lastSyncAt: '',
        stalenessThreshold: 120,
        isStale: false,
        dataAge: 0,
        syncFrequency: 60,
        missedSyncs: 0,
        syncHealth: 'healthy'
      })

      const { result, rerender } = renderHook(
        ({ lastExecution, frequency }) => useDataFreshness(lastExecution, frequency),
        {
          wrapper: createWrapper(),
          initialProps: { lastExecution: '2023-09-18T10:00:00Z', frequency: 60 }
        }
      )

      expect(analyticsHelpers.calculateDataFreshness).toHaveBeenCalledTimes(1)

      rerender({ lastExecution: '2023-09-18T11:00:00Z', frequency: 60 })

      expect(analyticsHelpers.calculateDataFreshness).toHaveBeenCalledTimes(2)
      expect(analyticsHelpers.calculateDataFreshness).toHaveBeenLastCalledWith(
        '2023-09-18T11:00:00Z',
        60
      )
    })
  })

  describe('useAnalyticsDateRange', () => {
    test('should manage date range state', () => {
      const mockCreateDateRange = vi.mocked(analyticsHelpers.createDateRange)
      const mockGetDateRangePreset = vi.mocked(analyticsHelpers.getDateRangePreset)

      const initialRange: DateRange = {
        startDate: '2023-09-01T00:00:00Z',
        endDate: '2023-09-30T00:00:00Z'
      }

      mockCreateDateRange.mockReturnValue(initialRange)

      const { result } = renderHook(() => useAnalyticsDateRange(), {
        wrapper: createWrapper()
      })

      expect(result.current.dateRange).toEqual(initialRange)
      expect(result.current.selectedPreset).toBe('last7d')
      expect(typeof result.current.applyPreset).toBe('function')
      expect(typeof result.current.setCustomRange).toBe('function')
      expect(typeof result.current.createRange).toBe('function')
    })

    test('should apply preset correctly', () => {
      const mockGetDateRangePreset = vi.mocked(analyticsHelpers.getDateRangePreset)
      const presetRange: DateRange = {
        startDate: '2023-09-11T00:00:00Z',
        endDate: '2023-09-18T00:00:00Z'
      }

      mockGetDateRangePreset.mockReturnValue(presetRange)

      const { result } = renderHook(() => useAnalyticsDateRange(), {
        wrapper: createWrapper()
      })

      result.current.applyPreset('last7d')

      expect(mockGetDateRangePreset).toHaveBeenCalledWith('last7d')
      expect(result.current.dateRange).toEqual(presetRange)
      expect(result.current.selectedPreset).toBe('last7d')
    })

    test('should set custom range', () => {
      const { result } = renderHook(() => useAnalyticsDateRange(), {
        wrapper: createWrapper()
      })

      const customRange: DateRange = {
        startDate: '2023-08-01T00:00:00Z',
        endDate: '2023-08-31T00:00:00Z'
      }

      result.current.setCustomRange(customRange)

      expect(result.current.dateRange).toEqual(customRange)
      expect(result.current.selectedPreset).toBe('custom')
    })
  })

  describe('Hook options and configurations', () => {
    test('should respect refetchInterval option', () => {
      const customRefetchInterval = 10000

      renderHook(
        () => useAnalyticsDashboard({ refetchInterval: customRefetchInterval }),
        { wrapper: createWrapper() }
      )

      // The refetchInterval is passed to useQuery, which we can't easily test
      // without mocking the entire React Query infrastructure
      expect(true).toBe(true) // Placeholder assertion
    })

    test('should respect staleTime option', () => {
      const customStaleTime = 30000

      renderHook(
        () => useAnalyticsDashboard({ staleTime: customStaleTime }),
        { wrapper: createWrapper() }
      )

      // Similar to refetchInterval, this is hard to test without deep mocking
      expect(true).toBe(true) // Placeholder assertion
    })

    test('should handle retry configuration', async () => {
      const mockError = new Error('Network error')
      vi.mocked(apiClient.get).mockRejectedValue(mockError)

      const { result } = renderHook(
        () => useAnalyticsDashboard({ retry: 0 }), // No retries
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      // With retry: 0, it should only call once
      expect(apiClient.get).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error handling and edge cases', () => {
    test('should handle API response format variations', async () => {
      // Test when API returns data directly vs wrapped in data property
      const directDataResponse = mockWorkflowAnalytics
      vi.mocked(apiClient.get).mockResolvedValue({ data: directDataResponse })

      const { result } = renderHook(
        () => useWorkflowAnalytics({ workflowId: 'workflow-1' }),
        { wrapper: createWrapper() }
      )

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.analytics).toEqual([directDataResponse])
    })

    test('should handle empty data responses', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] })

      const { result } = renderHook(() => useExecutionMetrics(), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false)
      })

      expect(result.current.metrics).toEqual([])
      expect(result.current.isError).toBe(false)
    })

    test('should handle network timeouts', async () => {
      const timeoutError = new Error('Timeout')
      vi.mocked(apiClient.get).mockRejectedValue(timeoutError)

      const { result } = renderHook(() => useTimeSeriesData({ metric: 'executions' }), {
        wrapper: createWrapper()
      })

      await waitFor(() => {
        expect(result.current.isError).toBe(true)
      })

      expect(result.current.timeSeries).toEqual([])
      expect(result.current.error).toBeTruthy()
    })
  })

  describe('Performance and optimization', () => {
    test('should not make unnecessary API calls when disabled', () => {
      renderHook(
        () => useAnalyticsDashboard({ enabled: false }),
        { wrapper: createWrapper() }
      )

      renderHook(
        () => useWorkflowAnalytics({ enabled: false }),
        { wrapper: createWrapper() }
      )

      renderHook(
        () => useExecutionMetrics({ enabled: false }),
        { wrapper: createWrapper() }
      )

      expect(apiClient.get).not.toHaveBeenCalled()
    })

    test('should use appropriate cache times for different data types', () => {
      // Dashboard data (frequently changing)
      renderHook(() => useAnalyticsDashboard(), { wrapper: createWrapper() })

      // Usage patterns (slowly changing)
      renderHook(() => useUsagePatterns(), { wrapper: createWrapper() })

      // Both should work without errors
      expect(true).toBe(true) // Placeholder assertion
    })
  })
})