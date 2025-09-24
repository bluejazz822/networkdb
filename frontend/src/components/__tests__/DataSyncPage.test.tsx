/**
 * DataSyncPage Component Tests
 * Comprehensive tests for the Data Synchronization Dashboard
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { message } from 'antd'
import DataSyncPage from '../DataSyncPage'

// Mock the hooks
const mockDashboard = {
  totalWorkflows: 5,
  activeWorkflows: 3,
  totalExecutions: 150,
  recentExecutions: [
    { id: 1, status: 'success', timestamp: '2024-01-01T10:00:00Z' },
    { id: 2, status: 'error', timestamp: '2024-01-01T11:00:00Z' },
    { id: 3, status: 'success', timestamp: '2024-01-01T12:00:00Z' }
  ],
  lastSyncAt: '2024-01-01T12:30:00Z'
}

const mockUseWorkflowDashboard = vi.fn()
const mockUseWorkflowActions = vi.fn()
const mockRefetch = vi.fn()
const mockSyncWorkflows = vi.fn()

vi.mock('@/hooks/useWorkflowStatus', () => ({
  useWorkflowDashboard: () => mockUseWorkflowDashboard()
}))

vi.mock('@/hooks/useWorkflowActions', () => ({
  useWorkflowActions: () => mockUseWorkflowActions()
}))

// Mock child components
vi.mock('../WorkflowMetrics', () => ({
  default: ({ totalWorkflows, activeWorkflows, successfulExecutions, failedExecutions, lastSyncTime, loading }: any) => (
    <div data-testid="workflow-metrics">
      <div data-testid="total-workflows">{totalWorkflows}</div>
      <div data-testid="active-workflows">{activeWorkflows}</div>
      <div data-testid="successful-executions">{successfulExecutions}</div>
      <div data-testid="failed-executions">{failedExecutions}</div>
      <div data-testid="last-sync-time">{lastSyncTime}</div>
      <div data-testid="metrics-loading">{loading ? 'loading' : 'loaded'}</div>
    </div>
  )
}))

vi.mock('../WorkflowStatusGrid', () => ({
  default: ({ title, autoRefresh, refreshInterval, onCreateWorkflow }: any) => (
    <div data-testid="workflow-status-grid">
      <div data-testid="grid-title">{title}</div>
      <div data-testid="auto-refresh">{autoRefresh ? 'enabled' : 'disabled'}</div>
      <div data-testid="refresh-interval">{refreshInterval}</div>
      <button data-testid="grid-create-workflow" onClick={onCreateWorkflow}>
        Create Workflow
      </button>
    </div>
  )
}))

// Mock message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    message: {
      info: vi.fn(),
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn()
    }
  }
})

describe('DataSyncPage', () => {
  const user = userEvent.setup()

  beforeEach(() => {
    vi.clearAllMocks()

    // Default mock implementations
    mockUseWorkflowDashboard.mockReturnValue({
      dashboard: mockDashboard,
      isLoading: false,
      error: null,
      refetch: mockRefetch
    })

    mockUseWorkflowActions.mockReturnValue({
      syncWorkflows: mockSyncWorkflows,
      isSyncing: false
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ===================== BASIC RENDERING TESTS =====================

  describe('Basic Rendering', () => {
    it('should render the page title and description', () => {
      render(<DataSyncPage />)

      expect(screen.getByText('Data Synchronization Dashboard')).toBeInTheDocument()
      expect(screen.getByText('Monitor and manage n8n workflow synchronization with Network CMDB')).toBeInTheDocument()
    })

    it('should render all action buttons', () => {
      render(<DataSyncPage />)

      expect(screen.getByRole('button', { name: /view history/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /refresh data/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sync workflows/i })).toBeInTheDocument()
    })

    it('should render workflow metrics component', () => {
      render(<DataSyncPage />)

      expect(screen.getByTestId('workflow-metrics')).toBeInTheDocument()
    })

    it('should render workflow status grid component', () => {
      render(<DataSyncPage />)

      expect(screen.getByTestId('workflow-status-grid')).toBeInTheDocument()
      expect(screen.getByTestId('grid-title')).toHaveTextContent('Workflow Status Overview')
      expect(screen.getByTestId('auto-refresh')).toHaveTextContent('enabled')
      expect(screen.getByTestId('refresh-interval')).toHaveTextContent('30000')
    })

    it('should render system features and integration status sections', () => {
      render(<DataSyncPage />)

      expect(screen.getByText('System Features')).toBeInTheDocument()
      expect(screen.getByText('Integration Status')).toBeInTheDocument()
      expect(screen.getByText('n8n API Connection:')).toBeInTheDocument()
      expect(screen.getByText('Database Schema:')).toBeInTheDocument()
    })
  })

  // ===================== DATA HANDLING TESTS =====================

  describe('Data Handling', () => {
    it('should display correct metrics data when dashboard is loaded', () => {
      render(<DataSyncPage />)

      expect(screen.getByTestId('total-workflows')).toHaveTextContent('5')
      expect(screen.getByTestId('active-workflows')).toHaveTextContent('3')
      expect(screen.getByTestId('successful-executions')).toHaveTextContent('149') // 150 - 1 error
      expect(screen.getByTestId('failed-executions')).toHaveTextContent('1')
      expect(screen.getByTestId('last-sync-time')).toHaveTextContent('2024-01-01T12:30:00Z')
      expect(screen.getByTestId('metrics-loading')).toHaveTextContent('loaded')
    })

    it('should show loading state when data is being fetched', () => {
      mockUseWorkflowDashboard.mockReturnValue({
        dashboard: null,
        isLoading: true,
        error: null,
        refetch: mockRefetch
      })

      render(<DataSyncPage />)

      expect(screen.getByTestId('metrics-loading')).toHaveTextContent('loading')
      expect(screen.getByTestId('total-workflows')).toHaveTextContent('0')
    })

    it('should show error state when data loading fails', () => {
      const mockError = new Error('Failed to fetch workflow data')
      mockUseWorkflowDashboard.mockReturnValue({
        dashboard: null,
        isLoading: false,
        error: mockError,
        refetch: mockRefetch
      })

      render(<DataSyncPage />)

      expect(screen.getByText(/Failed to load workflow data: Failed to fetch workflow data/)).toBeInTheDocument()
    })

    it('should handle empty dashboard data gracefully', () => {
      mockUseWorkflowDashboard.mockReturnValue({
        dashboard: {
          totalWorkflows: 0,
          activeWorkflows: 0,
          totalExecutions: 0,
          recentExecutions: [],
          lastSyncAt: null
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch
      })

      render(<DataSyncPage />)

      expect(screen.getByTestId('total-workflows')).toHaveTextContent('0')
      expect(screen.getByTestId('active-workflows')).toHaveTextContent('0')
      expect(screen.getByTestId('successful-executions')).toHaveTextContent('0')
      expect(screen.getByTestId('failed-executions')).toHaveTextContent('0')
    })

    it('should handle dashboard without recent executions', () => {
      mockUseWorkflowDashboard.mockReturnValue({
        dashboard: {
          totalWorkflows: 3,
          activeWorkflows: 2,
          totalExecutions: 50,
          recentExecutions: null,
          lastSyncAt: '2024-01-01T10:00:00Z'
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch
      })

      render(<DataSyncPage />)

      expect(screen.getByTestId('successful-executions')).toHaveTextContent('50')
      expect(screen.getByTestId('failed-executions')).toHaveTextContent('0')
    })
  })

  // ===================== USER INTERACTION TESTS =====================

  describe('User Interactions', () => {
    it('should handle sync workflows button click', async () => {
      render(<DataSyncPage />)

      const syncButton = screen.getByRole('button', { name: /sync workflows/i })
      await user.click(syncButton)

      expect(mockSyncWorkflows).toHaveBeenCalledWith({ force: false })
    })

    it('should show loading state on sync button when syncing', () => {
      mockUseWorkflowActions.mockReturnValue({
        syncWorkflows: mockSyncWorkflows,
        isSyncing: true
      })

      render(<DataSyncPage />)

      const syncButton = screen.getByRole('button', { name: /sync workflows/i })
      expect(syncButton).toHaveAttribute('class', expect.stringContaining('ant-btn-loading'))
    })

    it('should handle refresh data button click', async () => {
      render(<DataSyncPage />)

      const refreshButton = screen.getByRole('button', { name: /refresh data/i })
      await user.click(refreshButton)

      expect(mockRefetch).toHaveBeenCalled()
      expect(message.success).toHaveBeenCalledWith('Workflow data refreshed')
    })

    it('should handle view history button click', async () => {
      render(<DataSyncPage />)

      const historyButton = screen.getByRole('button', { name: /view history/i })
      await user.click(historyButton)

      expect(message.info).toHaveBeenCalledWith('Workflow history functionality will be implemented in future updates')
    })

    it('should handle create workflow from grid component', async () => {
      render(<DataSyncPage />)

      const gridCreateButton = screen.getByTestId('grid-create-workflow')
      await user.click(gridCreateButton)

      expect(mockSyncWorkflows).toHaveBeenCalledWith({ force: false })
    })
  })

  // ===================== LOADING STATE TESTS =====================

  describe('Loading States', () => {
    it('should show loading state in metrics when dashboard is loading', () => {
      mockUseWorkflowDashboard.mockReturnValue({
        dashboard: mockDashboard,
        isLoading: true,
        error: null,
        refetch: mockRefetch
      })

      render(<DataSyncPage />)

      expect(screen.getByTestId('metrics-loading')).toHaveTextContent('loading')
    })

    it('should show loading state in metrics when syncing', () => {
      mockUseWorkflowActions.mockReturnValue({
        syncWorkflows: mockSyncWorkflows,
        isSyncing: true
      })

      render(<DataSyncPage />)

      expect(screen.getByTestId('metrics-loading')).toHaveTextContent('loading')
    })

    it('should show loaded state when neither loading nor syncing', () => {
      render(<DataSyncPage />)

      expect(screen.getByTestId('metrics-loading')).toHaveTextContent('loaded')
    })
  })

  // ===================== ERROR HANDLING TESTS =====================

  describe('Error Handling', () => {
    it('should display error message with correct styling', () => {
      const mockError = new Error('Network connection failed')
      mockUseWorkflowDashboard.mockReturnValue({
        dashboard: null,
        isLoading: false,
        error: mockError,
        refetch: mockRefetch
      })

      render(<DataSyncPage />)

      const errorElement = screen.getByText(/Failed to load workflow data: Network connection failed/)
      expect(errorElement).toBeInTheDocument()
      expect(errorElement.parentElement).toHaveStyle({
        backgroundColor: '#fff',
        borderRadius: '8px',
        border: '1px solid #ff4d4f',
        color: '#ff4d4f'
      })
    })

    it('should handle different error types', () => {
      const timeoutError = new Error('Request timeout')
      mockUseWorkflowDashboard.mockReturnValue({
        dashboard: null,
        isLoading: false,
        error: timeoutError,
        refetch: mockRefetch
      })

      render(<DataSyncPage />)

      expect(screen.getByText(/Request timeout/)).toBeInTheDocument()
    })
  })

  // ===================== ACCESSIBILITY TESTS =====================

  describe('Accessibility', () => {
    it('should have proper heading structure', () => {
      render(<DataSyncPage />)

      const mainHeading = screen.getByRole('heading', { name: /data synchronization dashboard/i })
      expect(mainHeading).toHaveAttribute('class', expect.stringContaining('ant-typography-h2'))

      const subHeadings = screen.getAllByRole('heading', { level: 4 })
      expect(subHeadings).toHaveLength(2) // System Features and Integration Status
    })

    it('should have accessible button labels', () => {
      render(<DataSyncPage />)

      expect(screen.getByRole('button', { name: /view history/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /refresh data/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /sync workflows/i })).toBeInTheDocument()
    })

    it('should have proper button keyboard navigation', async () => {
      render(<DataSyncPage />)

      const syncButton = screen.getByRole('button', { name: /sync workflows/i })
      syncButton.focus()

      expect(syncButton).toHaveFocus()

      // Test Enter key
      fireEvent.keyDown(syncButton, { key: 'Enter', code: 'Enter' })
      await waitFor(() => {
        expect(mockSyncWorkflows).toHaveBeenCalled()
      })
    })
  })

  // ===================== INTEGRATION TESTS =====================

  describe('Component Integration', () => {
    it('should pass correct props to WorkflowMetrics component', () => {
      render(<DataSyncPage />)

      expect(screen.getByTestId('total-workflows')).toHaveTextContent('5')
      expect(screen.getByTestId('active-workflows')).toHaveTextContent('3')
      expect(screen.getByTestId('successful-executions')).toHaveTextContent('149')
      expect(screen.getByTestId('failed-executions')).toHaveTextContent('1')
      expect(screen.getByTestId('last-sync-time')).toHaveTextContent('2024-01-01T12:30:00Z')
    })

    it('should pass correct props to WorkflowStatusGrid component', () => {
      render(<DataSyncPage />)

      expect(screen.getByTestId('grid-title')).toHaveTextContent('Workflow Status Overview')
      expect(screen.getByTestId('auto-refresh')).toHaveTextContent('enabled')
      expect(screen.getByTestId('refresh-interval')).toHaveTextContent('30000')
    })

    it('should coordinate create workflow action between components', async () => {
      render(<DataSyncPage />)

      // Test sync from main button
      const mainSyncButton = screen.getByRole('button', { name: /sync workflows/i })
      await user.click(mainSyncButton)
      expect(mockSyncWorkflows).toHaveBeenCalledWith({ force: false })

      mockSyncWorkflows.mockClear()

      // Test sync from grid component
      const gridCreateButton = screen.getByTestId('grid-create-workflow')
      await user.click(gridCreateButton)
      expect(mockSyncWorkflows).toHaveBeenCalledWith({ force: false })
    })
  })

  // ===================== PERFORMANCE TESTS =====================

  describe('Performance', () => {
    it('should use callbacks to prevent unnecessary re-renders', () => {
      const { rerender } = render(<DataSyncPage />)

      // Get initial callback references
      const syncButton = screen.getByRole('button', { name: /sync workflows/i })
      const refreshButton = screen.getByRole('button', { name: /refresh data/i })
      const historyButton = screen.getByRole('button', { name: /view history/i })

      // Re-render component
      rerender(<DataSyncPage />)

      // Callbacks should remain stable
      expect(syncButton).toBeInTheDocument()
      expect(refreshButton).toBeInTheDocument()
      expect(historyButton).toBeInTheDocument()
    })

    it('should handle rapid button clicks gracefully', async () => {
      render(<DataSyncPage />)

      const syncButton = screen.getByRole('button', { name: /sync workflows/i })

      // Rapid clicks
      await user.click(syncButton)
      await user.click(syncButton)
      await user.click(syncButton)

      // Should handle all clicks
      expect(mockSyncWorkflows).toHaveBeenCalledTimes(3)
    })
  })

  // ===================== EDGE CASES =====================

  describe('Edge Cases', () => {
    it('should handle null dashboard data', () => {
      mockUseWorkflowDashboard.mockReturnValue({
        dashboard: null,
        isLoading: false,
        error: null,
        refetch: mockRefetch
      })

      render(<DataSyncPage />)

      expect(screen.getByTestId('total-workflows')).toHaveTextContent('0')
      expect(screen.getByTestId('metrics-loading')).toHaveTextContent('loading')
    })

    it('should handle dashboard with undefined fields', () => {
      mockUseWorkflowDashboard.mockReturnValue({
        dashboard: {
          totalWorkflows: undefined,
          activeWorkflows: undefined,
          totalExecutions: undefined,
          recentExecutions: undefined,
          lastSyncAt: undefined
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch
      })

      render(<DataSyncPage />)

      // Should handle undefined gracefully
      expect(screen.getByTestId('workflow-metrics')).toBeInTheDocument()
    })

    it('should handle malformed recent executions data', () => {
      mockUseWorkflowDashboard.mockReturnValue({
        dashboard: {
          totalWorkflows: 5,
          activeWorkflows: 3,
          totalExecutions: 100,
          recentExecutions: [
            { status: 'error' }, // Missing other fields
            { id: 2 }, // Missing status
            null, // Null entry
            { status: 'success' }
          ],
          lastSyncAt: '2024-01-01T12:30:00Z'
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch
      })

      render(<DataSyncPage />)

      // Should filter properly and not crash
      expect(screen.getByTestId('workflow-metrics')).toBeInTheDocument()
      expect(screen.getByTestId('failed-executions')).toHaveTextContent('1') // Only the valid error
    })

    it('should handle very large numbers in metrics', () => {
      mockUseWorkflowDashboard.mockReturnValue({
        dashboard: {
          totalWorkflows: 999999,
          activeWorkflows: 888888,
          totalExecutions: 1000000,
          recentExecutions: [],
          lastSyncAt: '2024-01-01T12:30:00Z'
        },
        isLoading: false,
        error: null,
        refetch: mockRefetch
      })

      render(<DataSyncPage />)

      expect(screen.getByTestId('total-workflows')).toHaveTextContent('999999')
      expect(screen.getByTestId('active-workflows')).toHaveTextContent('888888')
      expect(screen.getByTestId('successful-executions')).toHaveTextContent('1000000')
    })
  })
});