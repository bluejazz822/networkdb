import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { message } from 'antd'
import { apiClient } from '@/utils/api'
import type {
  TriggerWorkflowRequest,
  TriggerWorkflowResponse,
  SyncWorkflowsRequest,
  SyncWorkflowsResponse,
  UseWorkflowActionsOptions
} from '@/types/workflow'

// Query keys for invalidation
const WORKFLOW_QUERY_KEYS = {
  all: ['workflows'] as const,
  lists: () => [...WORKFLOW_QUERY_KEYS.all, 'list'] as const,
  executions: () => [...WORKFLOW_QUERY_KEYS.all, 'executions'] as const,
  dashboard: () => ['workflow-status', 'dashboard'] as const,
  health: () => ['workflow-status', 'health'] as const,
} as const

/**
 * Hook for triggering workflow executions manually
 */
export function useTriggerWorkflow(options: UseWorkflowActionsOptions = {}) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = options

  const triggerWorkflow = async (request: TriggerWorkflowRequest): Promise<TriggerWorkflowResponse> => {
    const response = await apiClient.post<TriggerWorkflowResponse>(
      `/workflows/${request.workflowId}/trigger`,
      {
        payload: request.payload,
        waitTill: request.waitTill,
      }
    )
    return response.data
  }

  const mutation = useMutation({
    mutationFn: triggerWorkflow,
    onSuccess: (data) => {
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.executions() })
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.dashboard() })

      // Show success message
      message.success(`Workflow triggered successfully. Execution ID: ${data.data.executionId}`)

      // Call custom success handler
      onSuccess?.(data)
    },
    onError: (error) => {
      console.error('Failed to trigger workflow:', error)
      message.error(`Failed to trigger workflow: ${error.message}`)

      // Call custom error handler
      onError?.(error as Error)
    },
  })

  return {
    triggerWorkflow: mutation.mutate,
    triggerWorkflowAsync: mutation.mutateAsync,
    isTriggering: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  }
}

/**
 * Hook for syncing workflows from n8n
 */
export function useSyncWorkflows(options: UseWorkflowActionsOptions = {}) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = options

  const syncWorkflows = async (request: SyncWorkflowsRequest = {}): Promise<SyncWorkflowsResponse> => {
    const response = await apiClient.post<SyncWorkflowsResponse>('/workflows/sync', {
      force: request.force || false,
      workflowIds: request.workflowIds,
    })
    return response.data
  }

  const mutation = useMutation({
    mutationFn: syncWorkflows,
    onSuccess: (data) => {
      // Invalidate all workflow-related queries
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.all })
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.dashboard() })
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.health() })

      // Show success message
      message.success(`Sync started successfully. ${data.data.workflowsCount} workflows will be synchronized.`)

      // Call custom success handler
      onSuccess?.(data)
    },
    onError: (error) => {
      console.error('Failed to sync workflows:', error)
      message.error(`Failed to sync workflows: ${error.message}`)

      // Call custom error handler
      onError?.(error as Error)
    },
  })

  return {
    syncWorkflows: mutation.mutate,
    syncWorkflowsAsync: mutation.mutateAsync,
    isSyncing: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
    data: mutation.data,
    reset: mutation.reset,
  }
}

/**
 * Hook for full workflow synchronization (force sync all)
 */
export function useFullSync(options: UseWorkflowActionsOptions = {}) {
  const syncMutation = useSyncWorkflows(options)

  const performFullSync = () => {
    syncMutation.syncWorkflows({ force: true })
  }

  const performFullSyncAsync = () => {
    return syncMutation.syncWorkflowsAsync({ force: true })
  }

  return {
    performFullSync,
    performFullSyncAsync,
    isFullSyncing: syncMutation.isSyncing,
    isError: syncMutation.isError,
    error: syncMutation.error,
    data: syncMutation.data,
    reset: syncMutation.reset,
  }
}

/**
 * Hook for selective workflow synchronization
 */
export function useSelectiveSync(options: UseWorkflowActionsOptions = {}) {
  const syncMutation = useSyncWorkflows(options)

  const performSelectiveSync = (workflowIds: string[], force = false) => {
    syncMutation.syncWorkflows({ workflowIds, force })
  }

  const performSelectiveSyncAsync = (workflowIds: string[], force = false) => {
    return syncMutation.syncWorkflowsAsync({ workflowIds, force })
  }

  return {
    performSelectiveSync,
    performSelectiveSyncAsync,
    isSelectiveSyncing: syncMutation.isSyncing,
    isError: syncMutation.isError,
    error: syncMutation.error,
    data: syncMutation.data,
    reset: syncMutation.reset,
  }
}

/**
 * Combined hook for all workflow actions
 */
export function useWorkflowActions(options: UseWorkflowActionsOptions = {}) {
  const triggerMutation = useTriggerWorkflow(options)
  const syncMutation = useSyncWorkflows(options)

  return {
    // Trigger actions
    triggerWorkflow: triggerMutation.triggerWorkflow,
    triggerWorkflowAsync: triggerMutation.triggerWorkflowAsync,
    isTriggering: triggerMutation.isTriggering,
    triggerError: triggerMutation.error,
    triggerData: triggerMutation.data,

    // Sync actions
    syncWorkflows: syncMutation.syncWorkflows,
    syncWorkflowsAsync: syncMutation.syncWorkflowsAsync,
    isSyncing: syncMutation.isSyncing,
    syncError: syncMutation.error,
    syncData: syncMutation.data,

    // Combined states
    isBusy: triggerMutation.isTriggering || syncMutation.isSyncing,
    hasError: triggerMutation.isError || syncMutation.isError,
    errors: [triggerMutation.error, syncMutation.error].filter(Boolean),

    // Combined actions
    reset: () => {
      triggerMutation.reset()
      syncMutation.reset()
    },
  }
}

/**
 * Hook for batch workflow operations
 */
export function useBatchWorkflowActions(options: UseWorkflowActionsOptions = {}) {
  const queryClient = useQueryClient()
  const { onSuccess, onError } = options

  const triggerMultipleWorkflows = async (requests: TriggerWorkflowRequest[]): Promise<TriggerWorkflowResponse[]> => {
    const results = await Promise.allSettled(
      requests.map(async request => {
        const response = await apiClient.post<TriggerWorkflowResponse>(
          `/workflows/${request.workflowId}/trigger`,
          {
            payload: request.payload,
            waitTill: request.waitTill,
          }
        )
        return response.data
      })
    )

    const successful = results.filter(result => result.status === 'fulfilled') as PromiseFulfilledResult<TriggerWorkflowResponse>[]
    const failed = results.filter(result => result.status === 'rejected') as PromiseRejectedResult[]

    if (failed.length > 0) {
      console.error('Some workflow triggers failed:', failed.map(f => f.reason))
      message.warning(`${successful.length} workflows triggered successfully, ${failed.length} failed`)
    } else {
      message.success(`All ${successful.length} workflows triggered successfully`)
    }

    return successful.map(result => result.value)
  }

  const batchTriggerMutation = useMutation({
    mutationFn: triggerMultipleWorkflows,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.executions() })
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.dashboard() })
      onSuccess?.(data)
    },
    onError: (error) => {
      console.error('Batch trigger failed:', error)
      message.error(`Batch workflow trigger failed: ${error.message}`)
      onError?.(error as Error)
    },
  })

  return {
    triggerMultiple: batchTriggerMutation.mutate,
    triggerMultipleAsync: batchTriggerMutation.mutateAsync,
    isBatchTriggering: batchTriggerMutation.isPending,
    batchError: batchTriggerMutation.error,
    batchData: batchTriggerMutation.data,
    resetBatch: batchTriggerMutation.reset,
  }
}

/**
 * Hook for workflow action polling (checking action status)
 */
export function useWorkflowActionPolling(actionId: string | null, enabled = true) {
  const pollActionStatus = async (): Promise<{ status: string; result?: any }> => {
    if (!actionId) throw new Error('No action ID provided')

    const response = await apiClient.get<{ data: { status: string; result?: any } }>(`/workflows/actions/${actionId}`)
    return response.data.data
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['workflow-action', actionId],
    queryFn: pollActionStatus,
    enabled: enabled && !!actionId,
    refetchInterval: (data: any) => {
      // Stop polling if action is completed
      if (data?.status === 'completed' || data?.status === 'failed') {
        return false
      }
      return 2000 // Poll every 2 seconds
    },
    retry: 3,
  })

  const isCompleted = data?.status === 'completed'
  const isFailed = data?.status === 'failed'
  const isInProgress = data?.status === 'running' || data?.status === 'pending'

  return {
    actionStatus: data?.status,
    actionResult: data?.result,
    isPolling: isLoading && !isCompleted && !isFailed,
    isCompleted,
    isFailed,
    isInProgress,
    error,
  }
}