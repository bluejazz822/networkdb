/**
 * WorkflowStatusGrid Component Tests
 * Comprehensive tests for the workflow status grid component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { message } from 'antd'
import WorkflowStatusGrid from '../WorkflowStatusGrid'

// Mock hooks
const mockWorkflowData = [
  {
    id: 1,
    name: 'AWS VPC Sync',
    status: 'active',
    lastExecution: '2024-01-01T10:00:00Z',
    nextExecution: '2024-01-01T11:00:00Z',
    provider: 'aws',
    resourceType: 'vpc'
  },
  {
    id: 2,
    name: 'Azure Network Sync',
    status: 'paused',
    lastExecution: '2024-01-01T09:30:00Z',
    nextExecution: null,
    provider: 'azure',
    resourceType: 'vnet'
  },
  {
    id: 3,
    name: 'GCP Transit Gateway Sync',
    status: 'error',
    lastExecution: '2024-01-01T08:00:00Z',
    nextExecution: '2024-01-01T12:00:00Z',
    provider: 'gcp',
    resourceType: 'transitGateway'
  }
]

const mockUseWorkflowStatus = vi.fn()
const mockRefetch = vi.fn()

vi.mock('@/hooks/useWorkflowStatus', () => ({
  useWorkflowStatus: () => mockUseWorkflowStatus()
}))

// Mock antd message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      warning: vi.fn()
    }
  }
})

// Mock timers
vi.useFakeTimers()

describe('WorkflowStatusGrid', () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const defaultProps = {
    title: 'Test Workflow Grid',
    autoRefresh: false,
    refreshInterval: 30000,
    onCreateWorkflow: vi.fn()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()

    // Default mock implementation
    mockUseWorkflowStatus.mockReturnValue({
      data: mockWorkflowData,
      isLoading: false,
      error: null,
      refetch: mockRefetch
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
  })

  // ===================== BASIC RENDERING TESTS =====================

  describe('Basic Rendering', () => {
    it('should render with title', () => {
      render(<WorkflowStatusGrid {...defaultProps} />)

      expect(screen.getByText('Test Workflow Grid')).toBeInTheDocument()
    })

    it('should render workflow data in table format', () => {
      render(<WorkflowStatusGrid {...defaultProps} />)

      // Check for table headers
      expect(screen.getByText('Workflow Name')).toBeInTheDocument()
      expect(screen.getByText('Status')).toBeInTheDocument()
      expect(screen.getByText('Provider')).toBeInTheDocument()
      expect(screen.getByText('Resource Type')).toBeInTheDocument()
      expect(screen.getByText('Last Execution')).toBeInTheDocument()
      expect(screen.getByText('Next Execution')).toBeInTheDocument()
      expect(screen.getByText('Actions')).toBeInTheDocument()

      // Check for workflow data
      expect(screen.getByText('AWS VPC Sync')).toBeInTheDocument()
      expect(screen.getByText('Azure Network Sync')).toBeInTheDocument()
      expect(screen.getByText('GCP Transit Gateway Sync')).toBeInTheDocument()
    })

    it('should render status badges with correct colors', () => {
      render(<WorkflowStatusGrid {...defaultProps} />)

      const activeStatus = screen.getByText('Active')
      const pausedStatus = screen.getByText('Paused')
      const errorStatus = screen.getByText('Error')

      expect(activeStatus).toHaveClass('ant-tag-success')
      expect(pausedStatus).toHaveClass('ant-tag-warning')
      expect(errorStatus).toHaveClass('ant-tag-error')
    })

    it('should render action buttons for each workflow', () => {
      render(<WorkflowStatusGrid {...defaultProps} />)

      const playButtons = screen.getAllByLabelText('play-circle')
      const stopButtons = screen.getAllByLabelText('pause-circle')
      const editButtons = screen.getAllByLabelText('edit')
      const deleteButtons = screen.getAllByLabelText('delete')

      expect(playButtons).toHaveLength(3)
      expect(stopButtons).toHaveLength(3)
      expect(editButtons).toHaveLength(3)
      expect(deleteButtons).toHaveLength(3)
    })

    it('should render refresh button', () => {
      render(<WorkflowStatusGrid {...defaultProps} />)

      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument()
    })

    it('should render create workflow button when onCreateWorkflow is provided', () => {
      render(<WorkflowStatusGrid {...defaultProps} />)

      expect(screen.getByRole('button', { name: /create workflow/i })).toBeInTheDocument()
    })
  })

  // ===================== LOADING STATE TESTS =====================

  describe('Loading States', () => {
    it('should show loading spinner when data is loading', () => {
      mockUseWorkflowStatus.mockReturnValue({
        data: null,
        isLoading: true,
        error: null,
        refetch: mockRefetch
      })

      render(<WorkflowStatusGrid {...defaultProps} />)

      expect(screen.getByRole('table')).toHaveClass('ant-table-loading')
    })

    it('should hide loading spinner when data is loaded', () => {
      render(<WorkflowStatusGrid {...defaultProps} />)

      expect(screen.getByRole('table')).not.toHaveClass('ant-table-loading')
    })
  })

  // ===================== ERROR HANDLING TESTS =====================

  describe('Error Handling', () => {
    it('should display error message when data loading fails', () => {
      const mockError = new Error('Failed to fetch workflows')
      mockUseWorkflowStatus.mockReturnValue({
        data: null,
        isLoading: false,
        error: mockError,
        refetch: mockRefetch
      })

      render(<WorkflowStatusGrid {...defaultProps} />)

      expect(screen.getByText(/failed to load workflow data/i)).toBeInTheDocument()
      expect(screen.getByText(/failed to fetch workflows/i)).toBeInTheDocument()
    })

    it('should show retry button on error', () => {
      const mockError = new Error('Network error')
      mockUseWorkflowStatus.mockReturnValue({
        data: null,
        isLoading: false,
        error: mockError,
        refetch: mockRefetch
      })

      render(<WorkflowStatusGrid {...defaultProps} />)

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })

    it('should call refetch when retry button is clicked', async () => {
      const mockError = new Error('Network error')
      mockUseWorkflowStatus.mockReturnValue({
        data: null,
        isLoading: false,
        error: mockError,
        refetch: mockRefetch
      })

      render(<WorkflowStatusGrid {...defaultProps} />)

      const retryButton = screen.getByRole('button', { name: /try again/i })
      await user.click(retryButton)

      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  // ===================== EMPTY STATE TESTS =====================

  describe('Empty State', () => {
    it('should display empty state when no workflows exist', () => {
      mockUseWorkflowStatus.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch
      })

      render(<WorkflowStatusGrid {...defaultProps} />)

      expect(screen.getByText(/no workflows found/i)).toBeInTheDocument()
      expect(screen.getByText(/create your first workflow/i)).toBeInTheDocument()
    })

    it('should show create workflow button in empty state', () => {
      mockUseWorkflowStatus.mockReturnValue({
        data: [],
        isLoading: false,
        error: null,
        refetch: mockRefetch
      })

      render(<WorkflowStatusGrid {...defaultProps} />)

      const createButtons = screen.getAllByRole('button', { name: /create workflow/i })
      expect(createButtons.length).toBeGreaterThan(0)
    })
  })

  // ===================== USER INTERACTION TESTS =====================

  describe('User Interactions', () => {
    it('should handle refresh button click', async () => {
      render(<WorkflowStatusGrid {...defaultProps} />)

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      await user.click(refreshButton)

      expect(mockRefetch).toHaveBeenCalled()
      expect(message.success).toHaveBeenCalledWith('Workflow data refreshed')
    })

    it('should handle create workflow button click', async () => {
      const mockOnCreateWorkflow = vi.fn()
      render(<WorkflowStatusGrid {...defaultProps} onCreateWorkflow={mockOnCreateWorkflow} />)

      const createButton = screen.getByRole('button', { name: /create workflow/i })
      await user.click(createButton)

      expect(mockOnCreateWorkflow).toHaveBeenCalled()
    })

    it('should handle workflow action buttons', async () => {
      render(<WorkflowStatusGrid {...defaultProps} />)

      // Test play button
      const playButtons = screen.getAllByLabelText('play-circle')
      await user.click(playButtons[0])
      expect(message.info).toHaveBeenCalledWith('Start workflow functionality will be implemented')

      // Test stop button
      const stopButtons = screen.getAllByLabelText('pause-circle')
      await user.click(stopButtons[0])
      expect(message.info).toHaveBeenCalledWith('Stop workflow functionality will be implemented')

      // Test edit button
      const editButtons = screen.getAllByLabelText('edit')
      await user.click(editButtons[0])
      expect(message.info).toHaveBeenCalledWith('Edit workflow functionality will be implemented')

      // Test delete button
      const deleteButtons = screen.getAllByLabelText('delete')
      await user.click(deleteButtons[0])
      expect(message.info).toHaveBeenCalledWith('Delete workflow functionality will be implemented')
    })
  })

  // ===================== AUTO-REFRESH TESTS =====================

  describe('Auto-refresh Functionality', () => {
    it('should start auto-refresh when enabled', () => {
      render(<WorkflowStatusGrid {...defaultProps} autoRefresh={true} refreshInterval={5000} />)

      // Fast-forward time by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(mockRefetch).toHaveBeenCalled()
    })

    it('should not auto-refresh when disabled', () => {
      render(<WorkflowStatusGrid {...defaultProps} autoRefresh={false} refreshInterval={5000} />)

      // Fast-forward time by 5 seconds
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      expect(mockRefetch).not.toHaveBeenCalled()
    })

    it('should use custom refresh interval', () => {
      render(<WorkflowStatusGrid {...defaultProps} autoRefresh={true} refreshInterval={10000} />)

      // Fast-forward time by 5 seconds (should not refresh yet)
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(mockRefetch).not.toHaveBeenCalled()

      // Fast-forward time by another 5 seconds (total 10 seconds)
      act(() => {
        vi.advanceTimersByTime(5000)
      })
      expect(mockRefetch).toHaveBeenCalled()
    })

    it('should clean up auto-refresh on unmount', () => {
      const { unmount } = render(<WorkflowStatusGrid {...defaultProps} autoRefresh={true} refreshInterval={5000} />)

      unmount()

      // Fast-forward time
      act(() => {
        vi.advanceTimersByTime(5000)
      })

      // Should not call refetch after unmount
      expect(mockRefetch).not.toHaveBeenCalled()
    })

    it('should restart auto-refresh when interval changes', () => {
      const { rerender } = render(<WorkflowStatusGrid {...defaultProps} autoRefresh={true} refreshInterval={5000} />)

      // Fast-forward time by 3 seconds
      act(() => {
        vi.advanceTimersByTime(3000)
      })

      // Change interval
      rerender(<WorkflowStatusGrid {...defaultProps} autoRefresh={true} refreshInterval={2000} />)

      // Fast-forward time by 2 seconds (should refresh with new interval)
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  // ===================== DATA FORMATTING TESTS =====================

  describe('Data Formatting', () => {
    it('should format dates correctly', () => {
      render(<WorkflowStatusGrid {...defaultProps} />)

      // Check if dates are displayed (exact format may vary based on locale)
      expect(screen.getByText(/2024/)).toBeInTheDocument()
    })

    it('should handle null/undefined dates', () => {
      const dataWithNullDates = [
        {
          id: 1,
          name: 'Test Workflow',
          status: 'active',
          lastExecution: null,
          nextExecution: undefined,
          provider: 'aws',
          resourceType: 'vpc'
        }
      ]

      mockUseWorkflowStatus.mockReturnValue({
        data: dataWithNullDates,
        isLoading: false,
        error: null,
        refetch: mockRefetch
      })

      render(<WorkflowStatusGrid {...defaultProps} />)

      expect(screen.getByText('Test Workflow')).toBeInTheDocument()
      // Should handle null dates gracefully without crashing
    })

    it('should display provider badges correctly', () => {
      render(<WorkflowStatusGrid {...defaultProps} />)

      expect(screen.getByText('AWS')).toBeInTheDocument()
      expect(screen.getByText('Azure')).toBeInTheDocument()
      expect(screen.getByText('GCP')).toBeInTheDocument()
    })

    it('should display resource types correctly', () => {
      render(<WorkflowStatusGrid {...defaultProps} />)

      expect(screen.getByText('VPC')).toBeInTheDocument()
      expect(screen.getByText('VNet')).toBeInTheDocument()
      expect(screen.getByText('Transit Gateway')).toBeInTheDocument()
    })
  })

  // ===================== ACCESSIBILITY TESTS =====================

  describe('Accessibility', () => {
    it('should have proper table structure', () => {
      render(<WorkflowStatusGrid {...defaultProps} />)

      const table = screen.getByRole('table')
      expect(table).toBeInTheDocument()

      const columnHeaders = screen.getAllByRole('columnheader')
      expect(columnHeaders).toHaveLength(7) // 7 columns
    })

    it('should have accessible action buttons', () => {
      render(<WorkflowStatusGrid {...defaultProps} />)

      const actionButtons = screen.getAllByRole('button', { name: /play|pause|edit|delete/i })
      actionButtons.forEach(button => {
        expect(button).toHaveAttribute('aria-label')
      })
    })

    it('should support keyboard navigation', async () => {
      render(<WorkflowStatusGrid {...defaultProps} />)

      const refreshButton = screen.getByRole('button', { name: /refresh/i })
      refreshButton.focus()

      expect(refreshButton).toHaveFocus()

      // Test Tab navigation
      fireEvent.keyDown(refreshButton, { key: 'Tab' })

      // Should move focus to next interactive element
      const nextElement = document.activeElement
      expect(nextElement).not.toBe(refreshButton)
    })
  })

  // ===================== PERFORMANCE TESTS =====================

  describe('Performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, index) => ({
        id: index + 1,
        name: `Workflow ${index + 1}`,
        status: index % 3 === 0 ? 'active' : index % 3 === 1 ? 'paused' : 'error',
        lastExecution: '2024-01-01T10:00:00Z',
        nextExecution: '2024-01-01T11:00:00Z',
        provider: index % 3 === 0 ? 'aws' : index % 3 === 1 ? 'azure' : 'gcp',
        resourceType: 'vpc'
      }))

      mockUseWorkflowStatus.mockReturnValue({
        data: largeDataset,
        isLoading: false,
        error: null,
        refetch: mockRefetch
      })

      const startTime = performance.now()
      render(<WorkflowStatusGrid {...defaultProps} />)
      const endTime = performance.now()

      // Should render within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(1000) // 1 second
    })

    it('should not cause memory leaks with auto-refresh', () => {
      const { unmount } = render(<WorkflowStatusGrid {...defaultProps} autoRefresh={true} />)

      // Should clean up properly
      unmount()

      // No active timers should remain
      expect(vi.getTimerCount()).toBe(0)
    })
  })

  // ===================== EDGE CASES =====================

  describe('Edge Cases', () => {
    it('should handle malformed workflow data', () => {
      const malformedData = [
        { id: 1, name: 'Valid Workflow', status: 'active' },
        { id: 2 }, // Missing required fields
        null, // Null entry
        { name: 'No ID Workflow', status: 'error' },
        { id: 3, name: 'Special chars: <>?/\\', status: 'active', provider: 'aws&<>' }
      ]

      mockUseWorkflowStatus.mockReturnValue({
        data: malformedData,
        isLoading: false,
        error: null,
        refetch: mockRefetch
      })

      // Should not crash with malformed data
      expect(() => render(<WorkflowStatusGrid {...defaultProps} />)).not.toThrow()
    })

    it('should handle very long workflow names', () => {
      const dataWithLongNames = [
        {
          id: 1,
          name: 'Very Long Workflow Name That Exceeds Normal Length Expectations And Should Be Handled Gracefully Without Breaking The Layout',
          status: 'active',
          provider: 'aws',
          resourceType: 'vpc'
        }
      ]

      mockUseWorkflowStatus.mockReturnValue({
        data: dataWithLongNames,
        isLoading: false,
        error: null,
        refetch: mockRefetch
      })

      render(<WorkflowStatusGrid {...defaultProps} />)

      expect(screen.getByText(/Very Long Workflow Name/)).toBeInTheDocument()
    })

    it('should handle unknown status values', () => {
      const dataWithUnknownStatus = [
        {
          id: 1,
          name: 'Test Workflow',
          status: 'unknown_status',
          provider: 'aws',
          resourceType: 'vpc'
        }
      ]

      mockUseWorkflowStatus.mockReturnValue({
        data: dataWithUnknownStatus,
        isLoading: false,
        error: null,
        refetch: mockRefetch
      })

      render(<WorkflowStatusGrid {...defaultProps} />)

      // Should handle unknown status gracefully
      expect(screen.getByText('Test Workflow')).toBeInTheDocument()
    })
  })
});