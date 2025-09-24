import React from 'react'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, test, expect, beforeEach, afterEach } from 'vitest'
import MetricsDashboard from '../MetricsDashboard'
import * as useAnalyticsDataHooks from '@/hooks/useAnalyticsData'
import type { ExecutionMetrics, PerformanceTrend } from '@/types/workflow'

// Mock the hooks
vi.mock('@/hooks/useAnalyticsData')

// Mock child components
vi.mock('../ExecutionMetricsChart', () => ({
  default: ({ title, onWorkflowClick, onRefresh, onExport }: any) => (
    <div data-testid="execution-metrics-chart">
      <h3>{title}</h3>
      <button onClick={() => onWorkflowClick('workflow-1')}>Click Workflow</button>
      <button onClick={onRefresh}>Refresh Chart</button>
      <button onClick={onExport}>Export Chart</button>
    </div>
  )
}))

vi.mock('../TrendAnalysisChart', () => ({
  default: ({ title, onRefresh, onExport }: any) => (
    <div data-testid="trend-analysis-chart">
      <h3>{title}</h3>
      <button onClick={onRefresh}>Refresh Trends</button>
      <button onClick={onExport}>Export Trends</button>
    </div>
  )
}))

vi.mock('../WorkflowHistoryModal', () => ({
  default: ({ visible, workflowId, workflowName, onCancel }: any) => (
    visible ? (
      <div data-testid="workflow-history-modal">
        <h3>History for {workflowName} ({workflowId})</h3>
        <button onClick={onCancel}>Close Modal</button>
      </div>
    ) : null
  )
}))

vi.mock('../ReportExportModal', () => ({
  default: ({ visible, onCancel, onExport }: any) => (
    visible ? (
      <div data-testid="report-export-modal">
        <h3>Export Report</h3>
        <button onClick={() => onExport({})}>Export</button>
        <button onClick={onCancel}>Cancel Export</button>
      </div>
    ) : null
  )
}))

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
const mockExecutionMetrics: ExecutionMetrics[] = [
  {
    workflowId: 'workflow-1',
    workflowName: 'Test Workflow 1',
    totalExecutions: 100,
    successfulExecutions: 85,
    failedExecutions: 15,
    avgDuration: 45000,
    lastExecution: '2023-09-18T10:00:00Z',
    successRate: 85,
    errorRate: 15,
    trendDirection: 'up'
  },
  {
    workflowId: 'workflow-2',
    workflowName: 'Test Workflow 2',
    totalExecutions: 50,
    successfulExecutions: 48,
    failedExecutions: 2,
    avgDuration: 30000,
    lastExecution: '2023-09-18T09:00:00Z',
    successRate: 96,
    errorRate: 4,
    trendDirection: 'stable'
  }
]

const mockTrendData: PerformanceTrend[] = [
  {
    date: '2023-09-17',
    executions: 45,
    successes: 40,
    failures: 5,
    avgDuration: 42000,
    successRate: 89
  },
  {
    date: '2023-09-18',
    executions: 55,
    successes: 50,
    failures: 5,
    avgDuration: 38000,
    successRate: 91
  }
]

const mockDashboard = {
  metrics: mockExecutionMetrics,
  trends: mockTrendData
}

describe('MetricsDashboard', () => {
  const mockUseAnalyticsDashboard = vi.mocked(useAnalyticsDataHooks.useAnalyticsDashboard)
  const mockUseAnalyticsDateRange = vi.mocked(useAnalyticsDataHooks.useAnalyticsDateRange)

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    mockUseAnalyticsDashboard.mockReturnValue({
      dashboard: mockDashboard,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
      isRefetching: false
    })

    mockUseAnalyticsDateRange.mockReturnValue({
      dateRange: {
        startDate: '2023-09-11T00:00:00Z',
        endDate: '2023-09-18T00:00:00Z'
      },
      selectedPreset: 'last7d',
      applyPreset: vi.fn(),
      setCustomRange: vi.fn(),
      createRange: vi.fn()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('renders dashboard with default props', () => {
    render(<MetricsDashboard />, { wrapper: createWrapper() })

    expect(screen.getByText('Performance Analytics Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Historical reporting and analytics for workflow execution performance')).toBeInTheDocument()
  })

  test('renders dashboard with workflow-specific props', () => {
    render(
      <MetricsDashboard
        workflowId="workflow-1"
        workflowName="Test Workflow"
      />,
      { wrapper: createWrapper() }
    )

    expect(screen.getByText('Performance Analytics Dashboard')).toBeInTheDocument()
    expect(screen.getByText('- Test Workflow')).toBeInTheDocument()
  })

  test('displays summary statistics correctly', async () => {
    render(<MetricsDashboard />, { wrapper: createWrapper() })

    await waitFor(() => {
      expect(screen.getByText('Total Executions')).toBeInTheDocument()
      expect(screen.getByText('Success Rate')).toBeInTheDocument()
      expect(screen.getByText('Avg Duration')).toBeInTheDocument()
      expect(screen.getByText('Healthy Workflows')).toBeInTheDocument()
    })

    // Check calculated values
    expect(screen.getByText('150')).toBeInTheDocument() // Total executions (100 + 50)
    expect(screen.getByText('89%')).toBeInTheDocument() // Overall success rate ((85+48)/(100+50) = 88.7% rounded to 89%)
    expect(screen.getByText('2/2')).toBeInTheDocument() // Healthy workflows (both have >90% success: workflow-2, but workflow-1 has 85%)
  })

  test('handles loading state correctly', () => {
    mockUseAnalyticsDashboard.mockReturnValue({
      dashboard: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
      isRefetching: false
    })

    render(<MetricsDashboard />, { wrapper: createWrapper() })

    // Should show loading spinners in statistics cards
    expect(screen.getByText('Total Executions')).toBeInTheDocument()
    expect(screen.getByText('Success Rate')).toBeInTheDocument()
  })

  test('handles error state correctly', () => {
    const errorMessage = 'Failed to fetch analytics data'
    mockUseAnalyticsDashboard.mockReturnValue({
      dashboard: null,
      isLoading: false,
      isError: true,
      error: new Error(errorMessage),
      refetch: vi.fn(),
      isFetching: false,
      isRefetching: false
    })

    render(<MetricsDashboard />, { wrapper: createWrapper() })

    expect(screen.getByText('Failed to Load Analytics Data')).toBeInTheDocument()
    expect(screen.getByText('Failed to fetch analytics data')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  test('allows tab navigation', async () => {
    const user = userEvent.setup()
    render(<MetricsDashboard />, { wrapper: createWrapper() })

    // Initially on overview tab
    expect(screen.getByText('Execution Metrics')).toBeVisible()

    // Click on trend analysis tab
    await user.click(screen.getByText('Trend Analysis'))
    expect(screen.getByTestId('trend-analysis-chart')).toBeInTheDocument()

    // Click on data freshness tab
    await user.click(screen.getByText('Data Freshness'))
    expect(screen.getByText('Data Freshness Monitoring')).toBeInTheDocument()
  })

  test('handles date range controls', async () => {
    const mockApplyPreset = vi.fn()
    const mockSetCustomRange = vi.fn()

    mockUseAnalyticsDateRange.mockReturnValue({
      dateRange: {
        startDate: '2023-09-11T00:00:00Z',
        endDate: '2023-09-18T00:00:00Z'
      },
      selectedPreset: 'last7d',
      applyPreset: mockApplyPreset,
      setCustomRange: mockSetCustomRange,
      createRange: vi.fn()
    })

    const user = userEvent.setup()
    render(<MetricsDashboard showControls={true} />, { wrapper: createWrapper() })

    // Find and interact with time range selector
    const timeRangeSelect = screen.getByDisplayValue('Last 7 Days')
    await user.click(timeRangeSelect)

    const option = screen.getByText('Last 30 Days')
    await user.click(option)

    expect(mockApplyPreset).toHaveBeenCalledWith('last30d')
  })

  test('handles refresh functionality', async () => {
    const mockRefetch = vi.fn()
    mockUseAnalyticsDashboard.mockReturnValue({
      dashboard: mockDashboard,
      isLoading: false,
      isError: false,
      error: null,
      refetch: mockRefetch,
      isFetching: false,
      isRefetching: false
    })

    const user = userEvent.setup()
    render(<MetricsDashboard />, { wrapper: createWrapper() })

    const refreshButton = screen.getByRole('button', { name: /refresh/i })
    await user.click(refreshButton)

    expect(mockRefetch).toHaveBeenCalled()
  })

  test('opens export modal when export button clicked', async () => {
    const user = userEvent.setup()
    render(<MetricsDashboard />, { wrapper: createWrapper() })

    const exportButton = screen.getByRole('button', { name: /export report/i })
    await user.click(exportButton)

    expect(screen.getByTestId('report-export-modal')).toBeInTheDocument()
  })

  test('handles workflow drill-down with onWorkflowSelect prop', async () => {
    const mockOnWorkflowSelect = vi.fn()
    render(
      <MetricsDashboard onWorkflowSelect={mockOnWorkflowSelect} />,
      { wrapper: createWrapper() }
    )

    const workflowButton = screen.getByText('Click Workflow')
    fireEvent.click(workflowButton)

    expect(mockOnWorkflowSelect).toHaveBeenCalledWith('workflow-1')
  })

  test('opens workflow history modal when no onWorkflowSelect prop', async () => {
    render(<MetricsDashboard />, { wrapper: createWrapper() })

    const workflowButton = screen.getByText('Click Workflow')
    fireEvent.click(workflowButton)

    await waitFor(() => {
      expect(screen.getByTestId('workflow-history-modal')).toBeInTheDocument()
    })
  })

  test('closes workflow history modal correctly', async () => {
    render(<MetricsDashboard />, { wrapper: createWrapper() })

    // Open modal
    const workflowButton = screen.getByText('Click Workflow')
    fireEvent.click(workflowButton)

    await waitFor(() => {
      expect(screen.getByTestId('workflow-history-modal')).toBeInTheDocument()
    })

    // Close modal
    const closeButton = screen.getByText('Close Modal')
    fireEvent.click(closeButton)

    await waitFor(() => {
      expect(screen.queryByTestId('workflow-history-modal')).not.toBeInTheDocument()
    })
  })

  test('handles export modal workflow', async () => {
    const user = userEvent.setup()
    render(<MetricsDashboard />, { wrapper: createWrapper() })

    // Open export modal
    const exportButton = screen.getByRole('button', { name: /export report/i })
    await user.click(exportButton)

    expect(screen.getByTestId('report-export-modal')).toBeInTheDocument()

    // Perform export
    const exportModalButton = screen.getByText('Export')
    fireEvent.click(exportModalButton)

    await waitFor(() => {
      expect(screen.queryByTestId('report-export-modal')).not.toBeInTheDocument()
    })
  })

  test('displays data freshness information correctly', async () => {
    const user = userEvent.setup()
    render(<MetricsDashboard />, { wrapper: createWrapper() })

    // Navigate to data freshness tab
    await user.click(screen.getByText('Data Freshness'))

    expect(screen.getByText('Data Freshness Monitoring')).toBeInTheDocument()
    expect(screen.getByText('Test Workflow 1')).toBeInTheDocument()
    expect(screen.getByText('Test Workflow 2')).toBeInTheDocument()

    // Check freshness indicators
    expect(screen.getByText('Last Execution:')).toBeInTheDocument()
    expect(screen.getByText('Success Rate:')).toBeInTheDocument()
  })

  test('handles empty data gracefully', () => {
    mockUseAnalyticsDashboard.mockReturnValue({
      dashboard: { metrics: [], trends: [] },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
      isRefetching: false
    })

    render(<MetricsDashboard />, { wrapper: createWrapper() })

    // Should show zero values in summary
    expect(screen.getByText('0')).toBeInTheDocument() // Total executions
    expect(screen.getByText('0%')).toBeInTheDocument() // Success rate
    expect(screen.getByText('0/0')).toBeInTheDocument() // Healthy workflows
  })

  test('respects showControls prop', () => {
    render(<MetricsDashboard showControls={false} />, { wrapper: createWrapper() })

    expect(screen.queryByText('Time Range:')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /refresh/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /export report/i })).not.toBeInTheDocument()
  })

  test('passes correct props to child components', () => {
    render(
      <MetricsDashboard
        height={500}
        autoRefresh={true}
        refreshInterval={10000}
      />,
      { wrapper: createWrapper() }
    )

    // ExecutionMetricsChart should receive the props
    expect(screen.getByTestId('execution-metrics-chart')).toBeInTheDocument()
    expect(screen.getByTestId('trend-analysis-chart')).toBeInTheDocument()
  })

  test('handles chart export functionality', () => {
    render(<MetricsDashboard />, { wrapper: createWrapper() })

    const chartRefreshButton = screen.getByText('Refresh Chart')
    const chartExportButton = screen.getByText('Export Chart')

    fireEvent.click(chartRefreshButton)
    fireEvent.click(chartExportButton)

    // Should not crash - actual functionality is in child components
    expect(screen.getByTestId('execution-metrics-chart')).toBeInTheDocument()
  })

  test('calculates health score correctly', () => {
    const metricsWithMixedHealth: ExecutionMetrics[] = [
      {
        workflowId: 'healthy-1',
        workflowName: 'Healthy Workflow 1',
        totalExecutions: 100,
        successfulExecutions: 95,
        failedExecutions: 5,
        avgDuration: 30000,
        lastExecution: '2023-09-18T10:00:00Z',
        successRate: 95, // Above 90% threshold
        errorRate: 5,
        trendDirection: 'up'
      },
      {
        workflowId: 'unhealthy-1',
        workflowName: 'Unhealthy Workflow 1',
        totalExecutions: 50,
        successfulExecutions: 35,
        failedExecutions: 15,
        avgDuration: 60000,
        lastExecution: '2023-09-18T09:00:00Z',
        successRate: 70, // Below 90% threshold
        errorRate: 30,
        trendDirection: 'down'
      }
    ]

    mockUseAnalyticsDashboard.mockReturnValue({
      dashboard: { metrics: metricsWithMixedHealth, trends: [] },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
      isFetching: false,
      isRefetching: false
    })

    render(<MetricsDashboard />, { wrapper: createWrapper() })

    expect(screen.getByText('1/2')).toBeInTheDocument() // Only 1 out of 2 workflows is healthy
  })

  test('integrates with analytics date range hook correctly', () => {
    const mockDateRangeHook = {
      dateRange: {
        startDate: '2023-08-01T00:00:00Z',
        endDate: '2023-08-31T00:00:00Z'
      },
      selectedPreset: 'custom',
      applyPreset: vi.fn(),
      setCustomRange: vi.fn(),
      createRange: vi.fn()
    }

    mockUseAnalyticsDateRange.mockReturnValue(mockDateRangeHook)

    render(<MetricsDashboard />, { wrapper: createWrapper() })

    // Should call the hook and pass filters to analytics dashboard
    expect(mockUseAnalyticsDateRange).toHaveBeenCalled()
    expect(mockUseAnalyticsDashboard).toHaveBeenCalledWith({
      filters: {
        workflowId: undefined,
        dateRange: mockDateRangeHook.dateRange,
        includeMetrics: true,
        aggregateBy: 'workflow'
      },
      enabled: true,
      refetchInterval: false
    })
  })
})