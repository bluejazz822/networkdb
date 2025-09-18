import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '@/utils/api'
import type {
  Workflow,
  WorkflowResponse,
  WorkflowFilters,
  UseWorkflowDataOptions,
  WorkflowExecutionResponse,
  ExecutionFilters
} from '@/types/workflow'

// Query keys
const WORKFLOW_QUERY_KEYS = {
  all: ['workflows'] as const,
  lists: () => [...WORKFLOW_QUERY_KEYS.all, 'list'] as const,
  list: (filters: WorkflowFilters) => [...WORKFLOW_QUERY_KEYS.lists(), filters] as const,
  details: () => [...WORKFLOW_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...WORKFLOW_QUERY_KEYS.details(), id] as const,
  executions: () => [...WORKFLOW_QUERY_KEYS.all, 'executions'] as const,
  execution: (filters: ExecutionFilters) => [...WORKFLOW_QUERY_KEYS.executions(), filters] as const,
} as const

/**
 * Hook for fetching workflow list with filtering and pagination
 */
export function useWorkflowData(options: UseWorkflowDataOptions = {}) {
  const {
    filters = {},
    enabled = true,
    refetchInterval = 30000, // 30 seconds
    retry = 2
  } = options

  const buildQueryParams = (filters: WorkflowFilters): string => {
    const params = new URLSearchParams()

    if (filters.active !== undefined) {
      params.append('active', String(filters.active))
    }
    if (filters.tags?.length) {
      filters.tags.forEach(tag => params.append('tags', tag))
    }
    if (filters.search) {
      params.append('search', filters.search)
    }
    if (filters.sortBy) {
      params.append('sortBy', filters.sortBy)
    }
    if (filters.sortOrder) {
      params.append('sortOrder', filters.sortOrder)
    }
    if (filters.page) {
      params.append('page', String(filters.page))
    }
    if (filters.limit) {
      params.append('limit', String(filters.limit))
    }

    return params.toString()
  }

  const fetchWorkflows = async (): Promise<WorkflowResponse> => {
    const queryParams = buildQueryParams(filters)
    const url = `/workflows${queryParams ? `?${queryParams}` : ''}`
    const response = await apiClient.get<WorkflowResponse>(url)
    return response.data
  }

  const query = useQuery({
    queryKey: WORKFLOW_QUERY_KEYS.list(filters),
    queryFn: fetchWorkflows,
    enabled,
    refetchInterval,
    retry,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })

  return {
    workflows: query.data?.data || [],
    total: query.data?.total,
    page: query.data?.page,
    limit: query.data?.limit,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
    isRefetching: query.isRefetching,
  }
}

/**
 * Hook for fetching a single workflow by ID
 */
export function useWorkflow(workflowId: string, enabled = true) {
  const fetchWorkflow = async (): Promise<Workflow> => {
    const response = await apiClient.get<{ data: Workflow }>(`/workflows/${workflowId}`)
    return response.data.data
  }

  const query = useQuery({
    queryKey: WORKFLOW_QUERY_KEYS.detail(workflowId),
    queryFn: fetchWorkflow,
    enabled: enabled && !!workflowId,
    retry: 2,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    workflow: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}

/**
 * Hook for fetching workflow executions with filtering
 */
export function useWorkflowExecutions(options: {
  filters?: ExecutionFilters
  enabled?: boolean
  refetchInterval?: number
} = {}) {
  const {
    filters = {},
    enabled = true,
    refetchInterval = 30000 // 30 seconds
  } = options

  const buildExecutionQueryParams = (filters: ExecutionFilters): string => {
    const params = new URLSearchParams()

    if (filters.workflowId) {
      params.append('workflowId', filters.workflowId)
    }
    if (filters.status?.length) {
      filters.status.forEach(status => params.append('status', status))
    }
    if (filters.startedAfter) {
      params.append('startedAfter', filters.startedAfter)
    }
    if (filters.startedBefore) {
      params.append('startedBefore', filters.startedBefore)
    }
    if (filters.mode?.length) {
      filters.mode.forEach(mode => params.append('mode', mode))
    }
    if (filters.sortBy) {
      params.append('sortBy', filters.sortBy)
    }
    if (filters.sortOrder) {
      params.append('sortOrder', filters.sortOrder)
    }
    if (filters.page) {
      params.append('page', String(filters.page))
    }
    if (filters.limit) {
      params.append('limit', String(filters.limit))
    }

    return params.toString()
  }

  const fetchExecutions = async (): Promise<WorkflowExecutionResponse> => {
    const queryParams = buildExecutionQueryParams(filters)
    const baseUrl = filters.workflowId
      ? `/workflows/${filters.workflowId}/executions`
      : '/executions'
    const url = `${baseUrl}${queryParams ? `?${queryParams}` : ''}`
    const response = await apiClient.get<WorkflowExecutionResponse>(url)
    return response.data
  }

  const query = useQuery({
    queryKey: WORKFLOW_QUERY_KEYS.execution(filters),
    queryFn: fetchExecutions,
    enabled,
    refetchInterval,
    retry: 2,
    staleTime: 1 * 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
  })

  return {
    executions: query.data?.data || [],
    total: query.data?.total,
    page: query.data?.page,
    limit: query.data?.limit,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  }
}

/**
 * Hook for fetching execution history for a specific workflow
 */
export function useWorkflowExecutionHistory(
  workflowId: string,
  options: {
    enabled?: boolean
    limit?: number
    refetchInterval?: number
  } = {}
) {
  const {
    enabled = true,
    limit = 20,
    refetchInterval = 30000
  } = options

  return useWorkflowExecutions({
    filters: {
      workflowId,
      limit,
      sortBy: 'startedAt',
      sortOrder: 'desc'
    },
    enabled: enabled && !!workflowId,
    refetchInterval
  })
}

/**
 * Utility hook for invalidating workflow queries
 */
export function useWorkflowQueryInvalidation() {
  const queryClient = useQueryClient()

  const invalidateWorkflows = () => {
    queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.lists() })
  }

  const invalidateWorkflow = (workflowId: string) => {
    queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.detail(workflowId) })
  }

  const invalidateExecutions = (workflowId?: string) => {
    if (workflowId) {
      queryClient.invalidateQueries({
        queryKey: WORKFLOW_QUERY_KEYS.execution({ workflowId })
      })
    } else {
      queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.executions() })
    }
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: WORKFLOW_QUERY_KEYS.all })
  }

  return {
    invalidateWorkflows,
    invalidateWorkflow,
    invalidateExecutions,
    invalidateAll,
  }
}