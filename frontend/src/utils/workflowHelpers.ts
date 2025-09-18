import React from 'react'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
  PauseCircleOutlined,
  WarningOutlined,
  LoadingOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons'
import type {
  WorkflowStatus,
  ExecutionStatus,
  HealthStatus,
  WorkflowStatusConfig,
  ExecutionStatusConfig,
  Workflow,
  WorkflowExecution,
  WorkflowDashboard,
} from '@/types/workflow'

/**
 * Configuration for workflow status display
 */
export const WORKFLOW_STATUS_CONFIG: Record<WorkflowStatus, WorkflowStatusConfig> = {
  active: {
    status: 'active',
    label: 'Active',
    color: 'success',
    icon: React.createElement(CheckCircleOutlined),
  },
  inactive: {
    status: 'inactive',
    label: 'Inactive',
    color: 'default',
    icon: React.createElement(StopOutlined),
  },
  error: {
    status: 'error',
    label: 'Error',
    color: 'error',
    icon: React.createElement(ExclamationCircleOutlined),
  },
  unknown: {
    status: 'unknown',
    label: 'Unknown',
    color: 'warning',
    icon: React.createElement(WarningOutlined),
  },
  running: {
    status: 'running',
    label: 'Running',
    color: 'processing',
    icon: React.createElement(LoadingOutlined),
  },
  paused: {
    status: 'paused',
    label: 'Paused',
    color: 'warning',
    icon: React.createElement(PauseCircleOutlined),
  },
}

/**
 * Configuration for execution status display
 */
export const EXECUTION_STATUS_CONFIG: Record<ExecutionStatus, ExecutionStatusConfig> = {
  success: {
    status: 'success',
    label: 'Success',
    color: 'success',
    icon: React.createElement(CheckCircleOutlined),
  },
  error: {
    status: 'error',
    label: 'Error',
    color: 'error',
    icon: React.createElement(ExclamationCircleOutlined),
  },
  running: {
    status: 'running',
    label: 'Running',
    color: 'processing',
    icon: React.createElement(LoadingOutlined),
  },
  waiting: {
    status: 'waiting',
    label: 'Waiting',
    color: 'default',
    icon: React.createElement(ClockCircleOutlined),
  },
  crashed: {
    status: 'crashed',
    label: 'Crashed',
    color: 'error',
    icon: React.createElement(CloseCircleOutlined),
  },
  aborted: {
    status: 'aborted',
    label: 'Aborted',
    color: 'warning',
    icon: React.createElement(StopOutlined),
  },
  cancelled: {
    status: 'cancelled',
    label: 'Cancelled',
    color: 'default',
    icon: React.createElement(StopOutlined),
  },
}

/**
 * Get workflow status configuration
 */
export function getWorkflowStatusConfig(status: WorkflowStatus): WorkflowStatusConfig {
  return WORKFLOW_STATUS_CONFIG[status] || WORKFLOW_STATUS_CONFIG.unknown
}

/**
 * Get execution status configuration
 */
export function getExecutionStatusConfig(status: ExecutionStatus): ExecutionStatusConfig {
  return EXECUTION_STATUS_CONFIG[status] || EXECUTION_STATUS_CONFIG.error
}

/**
 * Determine workflow status from workflow data
 */
export function getWorkflowStatus(workflow: Workflow): WorkflowStatus {
  if (!workflow.active) {
    return 'inactive'
  }

  // You could add more logic here based on recent executions, health checks, etc.
  return 'active'
}

/**
 * Get health status color for Ant Design components
 */
export function getHealthStatusColor(status: HealthStatus): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'healthy':
      return 'success'
    case 'warning':
      return 'warning'
    case 'critical':
      return 'error'
    case 'unknown':
    default:
      return 'default'
  }
}

/**
 * Format execution duration
 */
export function formatExecutionDuration(execution: WorkflowExecution): string {
  if (!execution.startedAt) return 'N/A'

  const startTime = new Date(execution.startedAt).getTime()
  const endTime = execution.stoppedAt ? new Date(execution.stoppedAt).getTime() : Date.now()
  const duration = endTime - startTime

  return formatDuration(duration)
}

/**
 * Format duration in milliseconds to human readable string
 */
export function formatDuration(milliseconds: number): string {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`
  }

  const seconds = Math.floor(milliseconds / 1000)
  if (seconds < 60) {
    return `${seconds}s`
  }

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

/**
 * Format relative time (e.g., "2 minutes ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  if (diffMs < 60000) { // Less than 1 minute
    const seconds = Math.floor(diffMs / 1000)
    return `${seconds}s ago`
  }

  if (diffMs < 3600000) { // Less than 1 hour
    const minutes = Math.floor(diffMs / 60000)
    return `${minutes}m ago`
  }

  if (diffMs < 86400000) { // Less than 1 day
    const hours = Math.floor(diffMs / 3600000)
    return `${hours}h ago`
  }

  const days = Math.floor(diffMs / 86400000)
  if (days < 7) {
    return `${days}d ago`
  }

  // For longer periods, show the actual date
  return date.toLocaleDateString()
}

/**
 * Get workflow execution summary
 */
export function getWorkflowExecutionSummary(executions: WorkflowExecution[]): {
  total: number
  successful: number
  failed: number
  running: number
  successRate: number
} {
  const total = executions.length
  const successful = executions.filter(e => e.status === 'success').length
  const failed = executions.filter(e => ['error', 'crashed', 'aborted'].includes(e.status)).length
  const running = executions.filter(e => e.status === 'running').length
  const successRate = total > 0 ? Math.round((successful / total) * 100) : 0

  return {
    total,
    successful,
    failed,
    running,
    successRate,
  }
}

/**
 * Calculate dashboard health score
 */
export function calculateHealthScore(dashboard: WorkflowDashboard): {
  score: number
  level: 'excellent' | 'good' | 'fair' | 'poor'
  factors: Array<{ name: string; score: number; weight: number }>
} {
  const factors = [
    {
      name: 'Active Workflows',
      score: dashboard.totalWorkflows > 0 ? (dashboard.activeWorkflows / dashboard.totalWorkflows) * 100 : 100,
      weight: 0.3,
    },
    {
      name: 'Error Rate',
      score: dashboard.totalWorkflows > 0 ? Math.max(0, 100 - (dashboard.errorWorkflows / dashboard.totalWorkflows) * 100) : 100,
      weight: 0.4,
    },
    {
      name: 'System Health',
      score: dashboard.healthStatus === 'healthy' ? 100 : dashboard.healthStatus === 'warning' ? 70 : 30,
      weight: 0.2,
    },
    {
      name: 'Sync Status',
      score: dashboard.syncInProgress ? 90 : (dashboard.lastSyncAt ? 100 : 50),
      weight: 0.1,
    },
  ]

  const weightedScore = factors.reduce((sum, factor) => sum + (factor.score * factor.weight), 0)

  let level: 'excellent' | 'good' | 'fair' | 'poor'
  if (weightedScore >= 90) level = 'excellent'
  else if (weightedScore >= 75) level = 'good'
  else if (weightedScore >= 60) level = 'fair'
  else level = 'poor'

  return {
    score: Math.round(weightedScore),
    level,
    factors,
  }
}

/**
 * Validate workflow trigger payload
 */
export function validateTriggerPayload(payload: string): { isValid: boolean; error?: string; parsed?: any } {
  if (!payload.trim()) {
    return { isValid: true, parsed: {} }
  }

  try {
    const parsed = JSON.parse(payload)
    return { isValid: true, parsed }
  } catch (error) {
    return {
      isValid: false,
      error: error instanceof Error ? error.message : 'Invalid JSON format',
    }
  }
}

/**
 * Generate workflow table search text for filtering
 */
export function getWorkflowSearchText(workflow: Workflow): string {
  return [
    workflow.name,
    workflow.id,
    ...(workflow.tags || []),
    workflow.active ? 'active' : 'inactive',
  ].filter(Boolean).join(' ').toLowerCase()
}

/**
 * Sort workflows by priority/importance
 */
export function sortWorkflowsByPriority(workflows: Workflow[]): Workflow[] {
  return workflows.sort((a, b) => {
    // Active workflows first
    if (a.active !== b.active) {
      return a.active ? -1 : 1
    }

    // Then by update time (most recently updated first)
    const aTime = new Date(a.updatedAt).getTime()
    const bTime = new Date(b.updatedAt).getTime()
    return bTime - aTime
  })
}

/**
 * Get execution status trend
 */
export function getExecutionTrend(executions: WorkflowExecution[]): {
  trend: 'improving' | 'stable' | 'declining'
  recentSuccessRate: number
  previousSuccessRate: number
} {
  if (executions.length < 10) {
    const summary = getWorkflowExecutionSummary(executions)
    return {
      trend: 'stable',
      recentSuccessRate: summary.successRate,
      previousSuccessRate: summary.successRate,
    }
  }

  // Split executions into recent and previous halves
  const sortedExecutions = [...executions].sort((a, b) =>
    new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  )

  const halfPoint = Math.floor(sortedExecutions.length / 2)
  const recentExecutions = sortedExecutions.slice(0, halfPoint)
  const previousExecutions = sortedExecutions.slice(halfPoint)

  const recentSummary = getWorkflowExecutionSummary(recentExecutions)
  const previousSummary = getWorkflowExecutionSummary(previousExecutions)

  let trend: 'improving' | 'stable' | 'declining'
  const difference = recentSummary.successRate - previousSummary.successRate

  if (difference > 5) trend = 'improving'
  else if (difference < -5) trend = 'declining'
  else trend = 'stable'

  return {
    trend,
    recentSuccessRate: recentSummary.successRate,
    previousSuccessRate: previousSummary.successRate,
  }
}

/**
 * Format workflow tags for display
 */
export function formatWorkflowTags(tags: string[] | undefined): string[] {
  if (!tags || tags.length === 0) return []

  return tags.filter(tag => tag && tag.trim()).map(tag => tag.trim())
}

/**
 * Get workflow uptime percentage
 */
export function getWorkflowUptime(executions: WorkflowExecution[]): number {
  if (executions.length === 0) return 100

  const recentExecutions = executions
    .filter(e => {
      const executionTime = new Date(e.startedAt).getTime()
      const dayAgo = Date.now() - (24 * 60 * 60 * 1000)
      return executionTime > dayAgo
    })

  if (recentExecutions.length === 0) return 100

  const successful = recentExecutions.filter(e => e.status === 'success').length
  return Math.round((successful / recentExecutions.length) * 100)
}