import { useState, useEffect, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/utils/api'
import type { WorkflowProgress, EnhancedWorkflowData } from '@/types/workflow'

interface ProgressResponse {
  success: boolean
  data: WorkflowProgress
  message?: string
  error?: string
}

interface UseWorkflowProgressOptions {
  workflowId: string
  enabled?: boolean
  pollingInterval?: number
  onStatusChange?: (status: string) => void
}

/**
 * Hook for real-time workflow progress tracking
 * Provides live updates for running workflow executions
 */
export function useWorkflowProgress({
  workflowId,
  enabled = true,
  pollingInterval = 2000, // 2 seconds for real-time updates
  onStatusChange
}: UseWorkflowProgressOptions) {
  const [lastStatus, setLastStatus] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const fetchProgress = useCallback(async (): Promise<WorkflowProgress | null> => {
    if (!workflowId) return null

    try {
      const response = await apiClient.get<ProgressResponse>(`/workflows/${workflowId}/progress`)

      if (response.data.success && response.data.data) {
        const progress = response.data.data

        // Trigger status change callback if status changed
        if (progress.status !== lastStatus) {
          setLastStatus(progress.status)
          onStatusChange?.(progress.status)
        }

        return progress
      }

      return null
    } catch (error) {
      console.warn('Failed to fetch workflow progress:', error)
      return null
    }
  }, [workflowId, lastStatus, onStatusChange])

  const progressQuery = useQuery({
    queryKey: ['workflow-progress', workflowId],
    queryFn: fetchProgress,
    enabled: enabled && !!workflowId,
    refetchInterval: (data) => {
      // Only poll if workflow is in a running state
      if (!data || !['running', 'queued'].includes(data.status)) {
        return false
      }
      return pollingInterval
    },
    staleTime: 1000, // 1 second stale time for real-time updates
    gcTime: 10 * 1000, // 10 seconds cache time
  })

  // Cleanup when component unmounts or workflow completes
  useEffect(() => {
    if (progressQuery.data && !['running', 'queued'].includes(progressQuery.data.status)) {
      // Stop polling when workflow completes
      queryClient.removeQueries({ queryKey: ['workflow-progress', workflowId] })
    }
  }, [progressQuery.data, queryClient, workflowId])

  return {
    progress: progressQuery.data,
    isLoading: progressQuery.isLoading,
    isError: progressQuery.isError,
    error: progressQuery.error,
    refetch: progressQuery.refetch,
    isPolling: progressQuery.isFetching && !progressQuery.isLoading,
  }
}

/**
 * Hook for managing multiple workflow progress tracking
 * Useful for grid views with multiple running workflows
 */
export function useMultipleWorkflowProgress(workflowIds: string[]) {
  const [progressData, setProgressData] = useState<Map<string, WorkflowProgress>>(new Map())
  const [pollingWorkflows, setPollingWorkflows] = useState<Set<string>>(new Set())

  const updateProgress = useCallback((workflowId: string, progress: WorkflowProgress | null) => {
    setProgressData(prev => {
      const newMap = new Map(prev)
      if (progress) {
        newMap.set(workflowId, progress)
      } else {
        newMap.delete(workflowId)
      }
      return newMap
    })
  }, [])

  const startPolling = useCallback((workflowId: string) => {
    setPollingWorkflows(prev => new Set(prev).add(workflowId))
  }, [])

  const stopPolling = useCallback((workflowId: string) => {
    setPollingWorkflows(prev => {
      const newSet = new Set(prev)
      newSet.delete(workflowId)
      return newSet
    })
  }, [])

  // Set up individual progress hooks for running workflows
  const progressHooks = workflowIds.map(workflowId => {
    const isPolling = pollingWorkflows.has(workflowId)

    return useWorkflowProgress({
      workflowId,
      enabled: isPolling,
      onStatusChange: (status) => {
        if (!['running', 'queued'].includes(status)) {
          stopPolling(workflowId)
        }
      }
    })
  })

  // Update progress data from individual hooks
  useEffect(() => {
    progressHooks.forEach((hook, index) => {
      const workflowId = workflowIds[index]
      if (hook.progress) {
        updateProgress(workflowId, hook.progress)
      }
    })
  }, [progressHooks, workflowIds, updateProgress])

  return {
    progressData,
    startPolling,
    stopPolling,
    isAnyPolling: pollingWorkflows.size > 0,
    pollingWorkflows: Array.from(pollingWorkflows),
  }
}

/**
 * Hook for enhanced workflow status refresh with exponential backoff
 * Provides smart polling that adapts based on workflow states
 */
export function useSmartWorkflowRefresh(workflows: EnhancedWorkflowData[]) {
  const [refreshInterval, setRefreshInterval] = useState(30000) // Start with 30s
  const [errorCount, setErrorCount] = useState(0)
  const queryClient = useQueryClient()

  const hasRunningWorkflows = workflows.some(w => ['running', 'queued'].includes(w.status))
  const hasErrorWorkflows = workflows.some(w => ['error', 'failed'].includes(w.status))

  // Adaptive refresh interval based on workflow states
  useEffect(() => {
    let newInterval = 30000 // Default 30s

    if (hasRunningWorkflows) {
      newInterval = 10000 // 10s when workflows are running
    } else if (hasErrorWorkflows) {
      newInterval = 60000 // 60s when there are errors
    }

    // Exponential backoff on errors
    if (errorCount > 0) {
      newInterval = Math.min(newInterval * Math.pow(2, errorCount), 300000) // Max 5 minutes
    }

    setRefreshInterval(newInterval)
  }, [hasRunningWorkflows, hasErrorWorkflows, errorCount])

  const incrementErrorCount = useCallback(() => {
    setErrorCount(prev => prev + 1)
  }, [])

  const resetErrorCount = useCallback(() => {
    setErrorCount(0)
  }, [])

  const forceRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['workflows'] })
    queryClient.invalidateQueries({ queryKey: ['workflow-status'] })
    resetErrorCount()
  }, [queryClient, resetErrorCount])

  return {
    refreshInterval,
    errorCount,
    incrementErrorCount,
    resetErrorCount,
    forceRefresh,
    hasRunningWorkflows,
    hasErrorWorkflows,
  }
}