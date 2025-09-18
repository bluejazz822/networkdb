// Workflow status types
export type WorkflowStatus = 'active' | 'inactive' | 'error' | 'unknown' | 'running' | 'paused'

// Execution status types
export type ExecutionStatus = 'success' | 'error' | 'running' | 'waiting' | 'crashed' | 'aborted' | 'cancelled'

// Health status types
export type HealthStatus = 'healthy' | 'warning' | 'critical' | 'unknown'

// Workflow interface matching n8n API structure
export interface Workflow {
  id: string
  name: string
  active: boolean
  tags?: string[]
  createdAt: string
  updatedAt: string
  settings?: {
    callerPolicy?: string
    executionOrder?: string
    saveDataErrorExecution?: string
    saveDataSuccessExecution?: string
    saveManualExecutions?: boolean
    saveExecutionProgress?: boolean
    timezone?: string
  }
  nodes?: WorkflowNode[]
  connections?: Record<string, any>
  versionId?: string
  pinData?: Record<string, any>
  staticData?: Record<string, any>
  meta?: {
    templateCredsSetupCompleted?: boolean
    instanceId?: string
  }
}

// Workflow node interface for visualization
export interface WorkflowNode {
  id: string
  name: string
  type: string
  typeVersion: number
  position: [number, number]
  parameters?: Record<string, any>
  credentials?: Record<string, any>
  webhookId?: string
  disabled?: boolean
}

// Workflow execution interface
export interface WorkflowExecution {
  id: string
  workflowId: string
  mode: 'cli' | 'error' | 'integrated' | 'internal' | 'manual' | 'retry' | 'trigger' | 'webhook'
  retryOf?: string
  retrySuccessId?: string
  startedAt: string
  stoppedAt?: string
  finished: boolean
  status: ExecutionStatus
  waitTill?: string
  workflowData?: {
    id: string
    name: string
    active: boolean
    nodes: WorkflowNode[]
    connections: Record<string, any>
    settings: Record<string, any>
    staticData?: Record<string, any>
    pinData?: Record<string, any>
  }
  data?: {
    resultData?: {
      runData?: Record<string, any>
      pinData?: Record<string, any>
      lastNodeExecuted?: string
    }
    executionData?: Record<string, any>
    startData?: Record<string, any>
  }
}

// Dashboard summary interface
export interface WorkflowDashboard {
  totalWorkflows: number
  activeWorkflows: number
  inactiveWorkflows: number
  errorWorkflows: number
  totalExecutions: number
  recentExecutions: WorkflowExecution[]
  healthStatus: HealthStatus
  lastSyncAt?: string
  syncInProgress: boolean
}

// Health check response
export interface WorkflowHealth {
  status: HealthStatus
  checks: {
    database: HealthStatus
    n8nConnection: HealthStatus
    webhooks: HealthStatus
    executions: HealthStatus
  }
  uptime: number
  version: string
  lastCheck: string
}

// Workflow filters for data fetching
export interface WorkflowFilters {
  active?: boolean
  tags?: string[]
  search?: string
  sortBy?: 'name' | 'createdAt' | 'updatedAt'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// Execution filters
export interface ExecutionFilters {
  workflowId?: string
  status?: ExecutionStatus[]
  startedAfter?: string
  startedBefore?: string
  mode?: string[]
  sortBy?: 'startedAt' | 'stoppedAt'
  sortOrder?: 'asc' | 'desc'
  page?: number
  limit?: number
}

// API Response types extending base ApiResponse
export interface WorkflowResponse {
  success: boolean
  data: Workflow[]
  total?: number
  page?: number
  limit?: number
  message?: string
  error?: string
}

export interface WorkflowDashboardResponse {
  success: boolean
  data: WorkflowDashboard
  message?: string
  error?: string
}

export interface WorkflowExecutionResponse {
  success: boolean
  data: WorkflowExecution[]
  total?: number
  page?: number
  limit?: number
  message?: string
  error?: string
}

export interface WorkflowHealthResponse {
  success: boolean
  data: WorkflowHealth
  message?: string
  error?: string
}

// Trigger and sync operation types
export interface TriggerWorkflowRequest {
  workflowId: string
  payload?: Record<string, any>
  waitTill?: string
}

export interface TriggerWorkflowResponse {
  success: boolean
  data: {
    executionId: string
    status: ExecutionStatus
    startedAt: string
  }
  message?: string
  error?: string
}

export interface SyncWorkflowsRequest {
  force?: boolean
  workflowIds?: string[]
}

export interface SyncWorkflowsResponse {
  success: boolean
  data: {
    syncId: string
    status: 'started' | 'completed' | 'failed'
    workflowsCount: number
    startedAt: string
    completedAt?: string
  }
  message?: string
  error?: string
}

// Status badge configuration
export interface WorkflowStatusConfig {
  status: WorkflowStatus
  label: string
  color: 'success' | 'processing' | 'error' | 'warning' | 'default'
  icon?: React.ReactNode
}

export interface ExecutionStatusConfig {
  status: ExecutionStatus
  label: string
  color: 'success' | 'processing' | 'error' | 'warning' | 'default'
  icon?: React.ReactNode
}

// Table and display types
export interface WorkflowTableItem extends Workflow {
  executionCount?: number
  lastExecution?: WorkflowExecution
  healthStatus?: HealthStatus
}

// Modal and form types
export interface ManualTriggerFormData {
  payload: string // JSON string
  waitTill?: string
}

export interface SyncFormData {
  force: boolean
  specificWorkflows: boolean
  workflowIds: string[]
}

// Query keys for React Query
export const WORKFLOW_QUERY_KEYS = {
  all: ['workflows'] as const,
  lists: () => [...WORKFLOW_QUERY_KEYS.all, 'list'] as const,
  list: (filters: WorkflowFilters) => [...WORKFLOW_QUERY_KEYS.lists(), filters] as const,
  details: () => [...WORKFLOW_QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...WORKFLOW_QUERY_KEYS.details(), id] as const,
  executions: () => [...WORKFLOW_QUERY_KEYS.all, 'executions'] as const,
  execution: (filters: ExecutionFilters) => [...WORKFLOW_QUERY_KEYS.executions(), filters] as const,
  dashboard: () => [...WORKFLOW_QUERY_KEYS.all, 'dashboard'] as const,
  health: () => [...WORKFLOW_QUERY_KEYS.all, 'health'] as const,
} as const

// Hook configuration types
export interface UseWorkflowDataOptions {
  filters?: WorkflowFilters
  enabled?: boolean
  refetchInterval?: number
  retry?: number
}

export interface UseWorkflowStatusOptions {
  enabled?: boolean
  refetchInterval?: number
  retry?: number
}

export interface UseWorkflowActionsOptions {
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
}