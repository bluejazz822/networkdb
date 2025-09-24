/**
 * ManualSyncModal Component Tests
 * Comprehensive tests for the Manual Workflow Synchronization Modal
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { message } from 'antd'
import ManualSyncModal from '../ManualSyncModal'
import type { Workflow } from '@/types/workflow'

// Mock workflows data
const mockWorkflows: Workflow[] = [
  {
    id: 'workflow-1',
    name: 'AWS VPC Sync',
    active: true,
    tags: ['aws', 'vpc'],
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-01-02T10:00:00Z'
  },
  {
    id: 'workflow-2',
    name: 'Azure Network Monitor',
    active: false,
    tags: ['azure', 'monitor'],
    createdAt: '2024-01-01T11:00:00Z',
    updatedAt: '2024-01-02T11:00:00Z'
  },
  {
    id: 'workflow-3',
    name: 'GCP Resource Tracker',
    active: true,
    tags: ['gcp', 'resources'],
    createdAt: '2024-01-01T12:00:00Z',
    updatedAt: '2024-01-02T12:00:00Z'
  }
]

// Mock hooks
const mockSyncWorkflows = vi.fn()
const mockTriggerMultiple = vi.fn()

const mockUseWorkflowActions = vi.fn(() => ({
  syncWorkflows: mockSyncWorkflows,
  isSyncing: false
}))

const mockUseBatchWorkflowActions = vi.fn(() => ({
  triggerMultiple: mockTriggerMultiple,
  isBatchTriggering: false
}))

const mockUseWorkflowData = vi.fn(() => ({
  workflows: mockWorkflows,
  isLoading: false
}))

vi.mock('@/hooks/useWorkflowActions', () => ({
  useWorkflowActions: () => mockUseWorkflowActions()
}))

vi.mock('@/hooks/useWorkflowData', () => ({
  useWorkflowData: () => mockUseWorkflowData()
}))

vi.mock('@/hooks/useWorkflowActions', () => ({
  useWorkflowActions: () => mockUseWorkflowActions(),
  useBatchWorkflowActions: () => mockUseBatchWorkflowActions()
}))

// Mock workflow helpers
vi.mock('@/utils/workflowHelpers', () => ({
  getWorkflowStatusConfig: (status: string) => ({
    status,
    label: status === 'active' ? 'Active' : 'Inactive',
    color: status === 'active' ? 'success' : 'default',
    icon: null
  })
}))

// Mock message
vi.mock('antd', async () => {
  const actual = await vi.importActual('antd')
  return {
    ...actual,
    message: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn()
    }
  }
})

describe('ManualSyncModal', () => {
  const user = userEvent.setup()
  const mockOnCancel = vi.fn()
  const mockOnSuccess = vi.fn()

  const defaultProps = {
    visible: true,
    onCancel: mockOnCancel,
    onSuccess: mockOnSuccess,
    preselectedWorkflows: []
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  // ===================== BASIC RENDERING TESTS =====================

  describe('Basic Rendering', () => {
    it('should render modal when visible is true', () => {
      render(<ManualSyncModal {...defaultProps} />)

      expect(screen.getByText('Manual Workflow Synchronization')).toBeInTheDocument()
      expect(screen.getByText('Workflow Synchronization')).toBeInTheDocument()
    })

    it('should not render modal when visible is false', () => {
      render(<ManualSyncModal {...defaultProps} visible={false} />)

      expect(screen.queryByText('Manual Workflow Synchronization')).not.toBeInTheDocument()
    })

    it('should render all sync type options', () => {
      render(<ManualSyncModal {...defaultProps} />)

      expect(screen.getByText('Full Sync (Standard)')).toBeInTheDocument()
      expect(screen.getByText('Selective Sync')).toBeInTheDocument()
      expect(screen.getByText('Force Full Sync (Advanced)')).toBeInTheDocument()
    })

    it('should render sync statistics card', () => {
      render(<ManualSyncModal {...defaultProps} />)

      expect(screen.getByText('Workflows to Sync')).toBeInTheDocument()
      expect(screen.getByText('Active Workflows')).toBeInTheDocument()
      expect(screen.getByText('Estimated Time')).toBeInTheDocument()
      expect(screen.getByText('Risk Level')).toBeInTheDocument()
    })

    it('should render action buttons', () => {
      render(<ManualSyncModal {...defaultProps} />)

      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /start sync/i })).toBeInTheDocument()
    })
  })

  // ===================== SYNC TYPE SELECTION TESTS =====================

  describe('Sync Type Selection', () => {
    it('should default to full sync type', () => {
      render(<ManualSyncModal {...defaultProps} />)

      const fullSyncOption = screen.getByDisplayValue('full')
      expect(fullSyncOption).toBeChecked()
    })

    it('should allow changing sync type to selective', async () => {
      render(<ManualSyncModal {...defaultProps} />)

      const selectiveOption = screen.getByText('Selective Sync')
      await user.click(selectiveOption)

      const selectiveRadio = screen.getByDisplayValue('selective')
      expect(selectiveRadio).toBeChecked()
    })

    it('should show workflow selection when selective sync is chosen', async () => {
      render(<ManualSyncModal {...defaultProps} />)

      const selectiveOption = screen.getByText('Selective Sync')
      await user.click(selectiveOption)

      expect(screen.getByText('Select Workflows to Sync')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Search workflows...')).toBeInTheDocument()
    })

    it('should not show workflow selection for full sync', () => {
      render(<ManualSyncModal {...defaultProps} />)

      expect(screen.queryByText('Select Workflows to Sync')).not.toBeInTheDocument()
    })

    it('should change stats when switching sync types', async () => {
      render(<ManualSyncModal {...defaultProps} />)

      // Initial full sync stats
      expect(screen.getByText('2-5 minutes')).toBeInTheDocument()

      // Switch to selective
      const selectiveOption = screen.getByText('Selective Sync')
      await user.click(selectiveOption)

      expect(screen.getByText('30 seconds - 2 minutes')).toBeInTheDocument()
    })
  })

  // ===================== WORKFLOW SELECTION TESTS =====================

  describe('Workflow Selection (Selective Sync)', () => {
    beforeEach(async () => {
      render(<ManualSyncModal {...defaultProps} />)

      const selectiveOption = screen.getByText('Selective Sync')
      await user.click(selectiveOption)
    })

    it('should display all available workflows', () => {
      expect(screen.getByText('AWS VPC Sync')).toBeInTheDocument()
      expect(screen.getByText('Azure Network Monitor')).toBeInTheDocument()
      expect(screen.getByText('GCP Resource Tracker')).toBeInTheDocument()
    })

    it('should allow selecting individual workflows', async () => {
      const awsWorkflowCheckbox = screen.getAllByRole('checkbox')[0] // First workflow
      await user.click(awsWorkflowCheckbox)

      expect(awsWorkflowCheckbox).toBeChecked()
    })

    it('should allow selecting all workflows', async () => {
      const selectAllButton = screen.getByRole('button', { name: /select all/i })
      await user.click(selectAllButton)

      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach(checkbox => {
        expect(checkbox).toBeChecked()
      })
    })

    it('should allow clearing all selections', async () => {
      // First select all
      const selectAllButton = screen.getByRole('button', { name: /select all/i })
      await user.click(selectAllButton)

      // Then clear all
      const clearAllButton = screen.getByRole('button', { name: /clear all/i })
      await user.click(clearAllButton)

      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach(checkbox => {
        expect(checkbox).not.toBeChecked()
      })
    })

    it('should filter workflows based on search text', async () => {
      const searchInput = screen.getByPlaceholderText('Search workflows...')
      await user.type(searchInput, 'AWS')

      expect(screen.getByText('AWS VPC Sync')).toBeInTheDocument()
      expect(screen.queryByText('Azure Network Monitor')).not.toBeInTheDocument()
      expect(screen.queryByText('GCP Resource Tracker')).not.toBeInTheDocument()
    })

    it('should update stats when workflows are selected', async () => {
      const awsWorkflowCheckbox = screen.getAllByRole('checkbox')[0]
      await user.click(awsWorkflowCheckbox)

      // Stats should update to reflect selection
      await waitFor(() => {
        const workflowCount = screen.getAllByText('1')[0] // First statistic showing count
        expect(workflowCount).toBeInTheDocument()
      })
    })

    it('should show empty state when no workflows match search', async () => {
      const searchInput = screen.getByPlaceholderText('Search workflows...')
      await user.type(searchInput, 'NonexistentWorkflow')

      expect(screen.getByText('No workflows found matching "NonexistentWorkflow"')).toBeInTheDocument()
    })
  })

  // ===================== PRESELECTED WORKFLOWS TESTS =====================

  describe('Preselected Workflows', () => {
    it('should preselect workflows when provided', async () => {
      render(<ManualSyncModal {...defaultProps} preselectedWorkflows={['workflow-1']} />)

      const selectiveOption = screen.getByText('Selective Sync')
      await user.click(selectiveOption)

      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes[0]).toBeChecked() // First workflow should be selected
    })

    it('should automatically switch to selective sync when workflows are preselected', () => {
      render(<ManualSyncModal {...defaultProps} preselectedWorkflows={['workflow-1']} />)

      // Should show selective sync UI immediately
      expect(screen.getByText('Select Workflows to Sync')).toBeInTheDocument()
    })
  })

  // ===================== SYNC EXECUTION TESTS =====================

  describe('Sync Execution', () => {
    it('should execute full sync without confirmation', async () => {
      render(<ManualSyncModal {...defaultProps} />)

      const startSyncButton = screen.getByRole('button', { name: /start sync/i })
      await user.click(startSyncButton)

      expect(mockSyncWorkflows).toHaveBeenCalledWith({ force: false })
      expect(mockOnSuccess).toHaveBeenCalled()
      expect(mockOnCancel).toHaveBeenCalled()
    })

    it('should show confirmation dialog for force full sync', async () => {
      render(<ManualSyncModal {...defaultProps} />)

      const forceFullOption = screen.getByText('Force Full Sync (Advanced)')
      await user.click(forceFullOption)

      const startSyncButton = screen.getByRole('button', { name: /start sync/i })
      await user.click(startSyncButton)

      expect(screen.getByText('Confirm Sync Operation')).toBeInTheDocument()
      expect(screen.getByText('High Risk Operation')).toBeInTheDocument()
    })

    it('should execute force sync after confirmation', async () => {
      render(<ManualSyncModal {...defaultProps} />)

      const forceFullOption = screen.getByText('Force Full Sync (Advanced)')
      await user.click(forceFullOption)

      const startSyncButton = screen.getByRole('button', { name: /start sync/i })
      await user.click(startSyncButton)

      const confirmButton = screen.getByRole('button', { name: /force sync/i })
      await user.click(confirmButton)

      expect(mockSyncWorkflows).toHaveBeenCalledWith({ force: true })
    })

    it('should prevent sync when no workflows selected in selective mode', async () => {
      render(<ManualSyncModal {...defaultProps} />)

      const selectiveOption = screen.getByText('Selective Sync')
      await user.click(selectiveOption)

      const startSyncButton = screen.getByRole('button', { name: /start sync/i })
      expect(startSyncButton).toBeDisabled()
    })

    it('should execute selective sync with selected workflows', async () => {
      render(<ManualSyncModal {...defaultProps} />)

      const selectiveOption = screen.getByText('Selective Sync')
      await user.click(selectiveOption)

      const firstCheckbox = screen.getAllByRole('checkbox')[0]
      await user.click(firstCheckbox)

      const startSyncButton = screen.getByRole('button', { name: /start sync/i })
      await user.click(startSyncButton)

      expect(mockSyncWorkflows).toHaveBeenCalledWith({
        force: false,
        workflowIds: ['workflow-1']
      })
    })
  })

  // ===================== LOADING STATE TESTS =====================

  describe('Loading States', () => {
    it('should show loading state when syncing', () => {
      mockUseWorkflowActions.mockReturnValue({
        syncWorkflows: mockSyncWorkflows,
        isSyncing: true
      })

      render(<ManualSyncModal {...defaultProps} />)

      const startSyncButton = screen.getByRole('button', { name: /syncing\.\.\./i })
      expect(startSyncButton).toBeDisabled()
    })

    it('should show loading state when workflows are being loaded', () => {
      mockUseWorkflowData.mockReturnValue({
        workflows: [],
        isLoading: true
      })

      render(<ManualSyncModal {...defaultProps} />)

      const selectiveOption = screen.getByText('Selective Sync')
      user.click(selectiveOption)

      expect(screen.getByText('Loading workflows...')).toBeInTheDocument()
    })

    it('should disable start sync button when workflows are loading', () => {
      mockUseWorkflowData.mockReturnValue({
        workflows: [],
        isLoading: true
      })

      render(<ManualSyncModal {...defaultProps} />)

      const selectiveOption = screen.getByText('Selective Sync')
      user.click(selectiveOption)

      const startSyncButton = screen.getByRole('button', { name: /start sync/i })
      expect(startSyncButton).toBeDisabled()
    })
  })

  // ===================== ERROR HANDLING TESTS =====================

  describe('Error Handling', () => {
    it('should handle sync failure gracefully', async () => {
      const syncError = new Error('Sync failed')
      mockSyncWorkflows.mockRejectedValue(syncError)

      render(<ManualSyncModal {...defaultProps} />)

      const startSyncButton = screen.getByRole('button', { name: /start sync/i })
      await user.click(startSyncButton)

      // Modal should stay open on error
      expect(screen.getByText('Manual Workflow Synchronization')).toBeInTheDocument()
    })

    it('should show warning for large selective sync', async () => {
      // Mock more than 10 workflows
      const manyWorkflows = Array.from({ length: 15 }, (_, i) => ({
        id: `workflow-${i}`,
        name: `Workflow ${i}`,
        active: true,
        tags: [],
        createdAt: '2024-01-01T10:00:00Z',
        updatedAt: '2024-01-02T10:00:00Z'
      }))

      mockUseWorkflowData.mockReturnValue({
        workflows: manyWorkflows,
        isLoading: false
      })

      render(<ManualSyncModal {...defaultProps} />)

      const selectiveOption = screen.getByText('Selective Sync')
      await user.click(selectiveOption)

      const selectAllButton = screen.getByRole('button', { name: /select all/i })
      await user.click(selectAllButton)

      const startSyncButton = screen.getByRole('button', { name: /start sync/i })
      await user.click(startSyncButton)

      expect(screen.getByText('Large Selective Sync')).toBeInTheDocument()
    })
  })

  // ===================== ACCESSIBILITY TESTS =====================

  describe('Accessibility', () => {
    it('should have proper modal title', () => {
      render(<ManualSyncModal {...defaultProps} />)

      expect(screen.getByRole('dialog')).toHaveAccessibleName(/manual workflow synchronization/i)
    })

    it('should have proper form structure', () => {
      render(<ManualSyncModal {...defaultProps} />)

      expect(screen.getByRole('radiogroup')).toBeInTheDocument()
    })

    it('should have keyboard navigation support', async () => {
      render(<ManualSyncModal {...defaultProps} />)

      const selectiveRadio = screen.getByDisplayValue('selective')
      selectiveRadio.focus()
      fireEvent.keyDown(selectiveRadio, { key: ' ', code: 'Space' })

      expect(selectiveRadio).toBeChecked()
    })
  })

  // ===================== INTEGRATION TESTS =====================

  describe('Integration', () => {
    it('should handle cancel properly', async () => {
      render(<ManualSyncModal {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      await user.click(cancelButton)

      expect(mockOnCancel).toHaveBeenCalled()
    })

    it('should call onSuccess after successful sync', async () => {
      mockSyncWorkflows.mockResolvedValue({})

      render(<ManualSyncModal {...defaultProps} />)

      const startSyncButton = screen.getByRole('button', { name: /start sync/i })
      await user.click(startSyncButton)

      await waitFor(() => {
        expect(mockOnSuccess).toHaveBeenCalled()
      })
    })

    it('should close modal after successful sync', async () => {
      mockSyncWorkflows.mockResolvedValue({})

      render(<ManualSyncModal {...defaultProps} />)

      const startSyncButton = screen.getByRole('button', { name: /start sync/i })
      await user.click(startSyncButton)

      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalled()
      })
    })
  })

  // ===================== EDGE CASES =====================

  describe('Edge Cases', () => {
    it('should handle empty workflow list', () => {
      mockUseWorkflowData.mockReturnValue({
        workflows: [],
        isLoading: false
      })

      render(<ManualSyncModal {...defaultProps} />)

      const selectiveOption = screen.getByText('Selective Sync')
      user.click(selectiveOption)

      expect(screen.getByText('No workflows available')).toBeInTheDocument()
    })

    it('should handle workflows without names', () => {
      const workflowsWithoutNames = [
        {
          id: 'workflow-1',
          name: '',
          active: true,
          tags: [],
          createdAt: '2024-01-01T10:00:00Z',
          updatedAt: '2024-01-02T10:00:00Z'
        }
      ]

      mockUseWorkflowData.mockReturnValue({
        workflows: workflowsWithoutNames,
        isLoading: false
      })

      render(<ManualSyncModal {...defaultProps} />)

      const selectiveOption = screen.getByText('Selective Sync')
      user.click(selectiveOption)

      // Should still render the workflow
      expect(screen.getByText('workflow-1')).toBeInTheDocument()
    })

    it('should prevent modal close when sync is in progress', () => {
      mockUseWorkflowActions.mockReturnValue({
        syncWorkflows: mockSyncWorkflows,
        isSyncing: true
      })

      render(<ManualSyncModal {...defaultProps} />)

      const cancelButton = screen.getByRole('button', { name: /cancel/i })
      expect(cancelButton).toBeDisabled()
    })
  })
})