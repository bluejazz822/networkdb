import {
  formatDuration,
  formatRelativeTime,
  getWorkflowExecutionSummary,
  getExecutionTrend
} from '@/utils/workflowHelpers'
import type {
  WorkflowExecution,
  ExecutionStatus,
  HealthStatus
} from '@/types/workflow'
import type {
  DateRange,
  DateRangePreset,
  ExecutionMetrics,
  TimeSeriesData,
  TrendData,
  WorkflowAnalytics,
  StatusDistribution,
  PerformanceMetrics,
  DataFreshnessMetrics,
  ExecutionTimeAnalysis,
  ErrorAnalysis,
  UsagePatterns,
  AggregationOptions,
  ComparisonOptions,
  DATE_RANGE_PRESETS
} from '@/types/analytics'

// Date and time utilities
export function createDateRange(days: number): DateRange {
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - (days * 24 * 60 * 60 * 1000))

  return {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  }
}

export function getDateRangePreset(key: string): DateRange | null {
  const preset = DATE_RANGE_PRESETS.find(p => p.key === key)
  return preset ? preset.value : null
}

export function isDateInRange(date: string, range: DateRange): boolean {
  const timestamp = new Date(date).getTime()
  const start = new Date(range.startDate).getTime()
  const end = new Date(range.endDate).getTime()

  return timestamp >= start && timestamp <= end
}

export function generateDateSeries(
  range: DateRange,
  interval: 'hour' | 'day' | 'week' | 'month'
): string[] {
  const dates: string[] = []
  const start = new Date(range.startDate)
  const end = new Date(range.endDate)

  let current = new Date(start)

  while (current <= end) {
    dates.push(current.toISOString())

    switch (interval) {
      case 'hour':
        current.setHours(current.getHours() + 1)
        break
      case 'day':
        current.setDate(current.getDate() + 1)
        break
      case 'week':
        current.setDate(current.getDate() + 7)
        break
      case 'month':
        current.setMonth(current.getMonth() + 1)
        break
    }
  }

  return dates
}

// Data aggregation utilities
export function aggregateExecutionsByDate(
  executions: WorkflowExecution[],
  options: AggregationOptions
): TimeSeriesData[] {
  const { groupBy, fillGaps = true, defaultValue = 0 } = options

  // Group executions by date
  const grouped = executions.reduce((acc, execution) => {
    const date = truncateDate(execution.startedAt, groupBy)
    const key = date.toISOString()

    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(execution)

    return acc
  }, {} as Record<string, WorkflowExecution[]>)

  // Convert to time series data
  const series: TimeSeriesData[] = Object.entries(grouped).map(([timestamp, execs]) => ({
    timestamp,
    value: execs.length,
    metadata: {
      executions: execs.length,
      successful: execs.filter(e => e.status === 'success').length,
      failed: execs.filter(e => ['error', 'crashed', 'aborted'].includes(e.status)).length
    }
  }))

  // Fill gaps if requested
  if (fillGaps && executions.length > 0) {
    const earliest = new Date(Math.min(...executions.map(e => new Date(e.startedAt).getTime())))
    const latest = new Date(Math.max(...executions.map(e => new Date(e.startedAt).getTime())))

    const allDates = generateDateSeries(
      { startDate: earliest.toISOString(), endDate: latest.toISOString() },
      groupBy
    )

    const existingDates = new Set(series.map(s => s.timestamp))

    allDates.forEach(date => {
      if (!existingDates.has(date)) {
        series.push({
          timestamp: date,
          value: defaultValue,
          metadata: { executions: 0, successful: 0, failed: 0 }
        })
      }
    })
  }

  return series.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

export function aggregateExecutionsByStatus(
  executions: WorkflowExecution[]
): StatusDistribution {
  return executions.reduce(
    (acc, execution) => {
      acc[execution.status] = (acc[execution.status] || 0) + 1
      return acc
    },
    {
      success: 0,
      error: 0,
      running: 0,
      waiting: 0,
      crashed: 0,
      aborted: 0,
      cancelled: 0
    } as StatusDistribution
  )
}

export function aggregateExecutionsByWorkflow(
  executions: WorkflowExecution[]
): Record<string, WorkflowExecution[]> {
  return executions.reduce((acc, execution) => {
    const workflowId = execution.workflowId

    if (!acc[workflowId]) {
      acc[workflowId] = []
    }
    acc[workflowId].push(execution)

    return acc
  }, {} as Record<string, WorkflowExecution[]>)
}

// Trend calculation utilities
export function calculateTrend(
  current: number,
  previous: number,
  isHigherBetter = true
): TrendData {
  const change = current - previous
  const changePercent = previous === 0 ? 0 : (change / previous) * 100

  let trend: 'up' | 'down' | 'stable'
  if (Math.abs(changePercent) < 5) {
    trend = 'stable'
  } else if (change > 0) {
    trend = 'up'
  } else {
    trend = 'down'
  }

  const isImprovement = isHigherBetter ? change > 0 : change < 0

  return {
    current,
    previous,
    change,
    changePercent,
    trend,
    isImprovement
  }
}

export function calculateExecutionTrend(
  currentPeriod: WorkflowExecution[],
  previousPeriod: WorkflowExecution[]
): TrendData {
  return calculateTrend(currentPeriod.length, previousPeriod.length, true)
}

export function calculateSuccessRateTrend(
  currentPeriod: WorkflowExecution[],
  previousPeriod: WorkflowExecution[]
): TrendData {
  const currentSummary = getWorkflowExecutionSummary(currentPeriod)
  const previousSummary = getWorkflowExecutionSummary(previousPeriod)

  return calculateTrend(currentSummary.successRate, previousSummary.successRate, true)
}

export function calculateAverageDurationTrend(
  currentPeriod: WorkflowExecution[],
  previousPeriod: WorkflowExecution[]
): TrendData {
  const currentAvg = calculateAverageExecutionDuration(currentPeriod)
  const previousAvg = calculateAverageExecutionDuration(previousPeriod)

  return calculateTrend(currentAvg, previousAvg, false) // Lower duration is better
}

// Performance calculation utilities
export function calculateAverageExecutionDuration(executions: WorkflowExecution[]): number {
  if (executions.length === 0) return 0

  const durations = executions
    .filter(e => e.stoppedAt && e.startedAt)
    .map(e => {
      const start = new Date(e.startedAt).getTime()
      const end = new Date(e.stoppedAt!).getTime()
      return end - start
    })

  if (durations.length === 0) return 0

  return durations.reduce((sum, duration) => sum + duration, 0) / durations.length
}

export function calculateExecutionPercentiles(
  executions: WorkflowExecution[]
): { p50: number; p95: number; p99: number } {
  const durations = executions
    .filter(e => e.stoppedAt && e.startedAt)
    .map(e => {
      const start = new Date(e.startedAt).getTime()
      const end = new Date(e.stoppedAt!).getTime()
      return end - start
    })
    .sort((a, b) => a - b)

  if (durations.length === 0) {
    return { p50: 0, p95: 0, p99: 0 }
  }

  const getPercentile = (p: number) => {
    const index = Math.ceil((p / 100) * durations.length) - 1
    return durations[Math.max(0, index)]
  }

  return {
    p50: getPercentile(50),
    p95: getPercentile(95),
    p99: getPercentile(99)
  }
}

export function calculateExecutionUptime(executions: WorkflowExecution[]): number {
  if (executions.length === 0) return 100

  const successful = executions.filter(e => e.status === 'success').length
  return Math.round((successful / executions.length) * 100)
}

export function calculateHealthScore(
  successRate: number,
  uptime: number,
  averageDuration: number,
  expectedDuration: number = 60000 // 1 minute default
): number {
  // Success rate weight: 50%
  const successScore = successRate

  // Uptime weight: 30%
  const uptimeScore = uptime

  // Performance weight: 20% (inverted - lower duration is better)
  const performanceScore = Math.max(0, 100 - ((averageDuration / expectedDuration) * 100))

  const healthScore = (successScore * 0.5) + (uptimeScore * 0.3) + (performanceScore * 0.2)

  return Math.round(Math.min(100, Math.max(0, healthScore)))
}

// Analytics data generation
export function generateWorkflowAnalytics(
  workflowId: string,
  workflowName: string,
  executions: WorkflowExecution[],
  dateRange: DateRange
): WorkflowAnalytics {
  const currentExecutions = executions.filter(e => isDateInRange(e.startedAt, dateRange))
  const summary = getWorkflowExecutionSummary(currentExecutions)

  // Calculate previous period for trends
  const periodDuration = new Date(dateRange.endDate).getTime() - new Date(dateRange.startDate).getTime()
  const previousRange: DateRange = {
    startDate: new Date(new Date(dateRange.startDate).getTime() - periodDuration).toISOString(),
    endDate: dateRange.startDate
  }
  const previousExecutions = executions.filter(e => isDateInRange(e.startedAt, previousRange))

  const averageDuration = calculateAverageExecutionDuration(currentExecutions)
  const uptime = calculateExecutionUptime(currentExecutions)
  const executionTrend = calculateExecutionTrend(currentExecutions, previousExecutions)
  const performanceTrend = calculateAverageDurationTrend(currentExecutions, previousExecutions)

  const executionHistory = aggregateExecutionsByDate(currentExecutions, { groupBy: 'day' })
  const durationHistory: TimeSeriesData[] = executionHistory.map(point => ({
    timestamp: point.timestamp,
    value: calculateAverageExecutionDuration(
      currentExecutions.filter(e =>
        truncateDate(e.startedAt, 'day').toISOString() === point.timestamp
      )
    )
  }))

  const statusDistribution = aggregateExecutionsByStatus(currentExecutions)
  const healthScore = calculateHealthScore(summary.successRate, uptime, averageDuration)

  let healthStatus: HealthStatus
  if (healthScore >= 90) healthStatus = 'healthy'
  else if (healthScore >= 70) healthStatus = 'warning'
  else healthStatus = 'critical'

  const lastExecution = currentExecutions
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())[0]

  return {
    workflowId,
    workflowName,
    totalExecutions: summary.total,
    recentExecutions: currentExecutions.length,
    successRate: summary.successRate,
    averageDuration,
    uptime,
    lastExecution,
    executionTrend,
    performanceTrend,
    healthStatus,
    executionHistory,
    durationHistory,
    statusDistribution
  }
}

export function generateExecutionTimeAnalysis(
  workflowId: string,
  workflowName: string,
  executions: WorkflowExecution[]
): ExecutionTimeAnalysis {
  const durations = executions
    .filter(e => e.stoppedAt && e.startedAt)
    .map(e => {
      const start = new Date(e.startedAt).getTime()
      const end = new Date(e.stoppedAt!).getTime()
      return { execution: e, duration: end - start }
    })

  const percentiles = calculateExecutionPercentiles(executions)
  const avgExecutionTime = calculateAverageExecutionDuration(executions)

  // Calculate duration distribution
  const timeRanges = [
    { range: '0-1s', min: 0, max: 1000 },
    { range: '1-5s', min: 1000, max: 5000 },
    { range: '5-30s', min: 5000, max: 30000 },
    { range: '30s-1m', min: 30000, max: 60000 },
    { range: '1-5m', min: 60000, max: 300000 },
    { range: '5m+', min: 300000, max: Infinity }
  ]

  const timeDistribution = timeRanges.map(range => {
    const count = durations.filter(d => d.duration >= range.min && d.duration < range.max).length
    const percentage = durations.length > 0 ? (count / durations.length) * 100 : 0

    return {
      range: range.range,
      count,
      percentage: Math.round(percentage * 100) / 100
    }
  })

  // Get slowest executions
  const slowestExecutions = durations
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10)
    .map(d => d.execution)

  // Generate execution time history
  const executionTimeHistory = aggregateExecutionsByDate(executions, { groupBy: 'day' })
    .map(point => ({
      timestamp: point.timestamp,
      value: calculateAverageExecutionDuration(
        executions.filter(e =>
          truncateDate(e.startedAt, 'day').toISOString() === point.timestamp
        )
      )
    }))

  return {
    workflowId,
    workflowName,
    avgExecutionTime,
    medianExecutionTime: percentiles.p50,
    p95ExecutionTime: percentiles.p95,
    p99ExecutionTime: percentiles.p99,
    timeDistribution,
    slowestExecutions,
    executionTimeHistory
  }
}

export function generateErrorAnalysis(
  workflowId: string,
  workflowName: string,
  executions: WorkflowExecution[]
): ErrorAnalysis {
  const errorExecutions = executions.filter(e =>
    ['error', 'crashed', 'aborted'].includes(e.status)
  )

  const totalErrors = errorExecutions.length
  const errorRate = executions.length > 0 ? (totalErrors / executions.length) * 100 : 0

  // Analyze common error patterns
  const errorTypes = errorExecutions.reduce((acc, execution) => {
    // Extract error type from execution data if available
    const errorType = extractErrorType(execution)

    if (!acc[errorType]) {
      acc[errorType] = {
        count: 0,
        examples: [],
        lastOccurrence: execution.startedAt
      }
    }

    acc[errorType].count++
    if (acc[errorType].examples.length < 3) {
      acc[errorType].examples.push(execution.id)
    }

    if (new Date(execution.startedAt) > new Date(acc[errorType].lastOccurrence)) {
      acc[errorType].lastOccurrence = execution.startedAt
    }

    return acc
  }, {} as Record<string, { count: number; examples: string[]; lastOccurrence: string }>)

  const commonErrors = Object.entries(errorTypes).map(([errorType, data]) => ({
    errorType,
    count: data.count,
    percentage: (data.count / totalErrors) * 100,
    lastOccurrence: data.lastOccurrence,
    examples: data.examples
  })).sort((a, b) => b.count - a.count)

  // Calculate error trend (compare last 30 days vs previous 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)

  const recentErrors = errorExecutions.filter(e => new Date(e.startedAt) > thirtyDaysAgo).length
  const previousErrors = errorExecutions.filter(e => {
    const date = new Date(e.startedAt)
    return date > sixtyDaysAgo && date <= thirtyDaysAgo
  }).length

  const errorTrend = calculateTrend(recentErrors, previousErrors, false) // Lower errors is better

  // Recent error executions for review
  const recentErrorExecutions = errorExecutions
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 20)

  return {
    workflowId,
    workflowName,
    totalErrors,
    errorRate,
    commonErrors,
    errorTrend,
    errorsByNode: [], // Would need node-level data to populate this
    recentErrors: recentErrorExecutions
  }
}

export function generateUsagePatterns(
  workflowId: string,
  workflowName: string,
  executions: WorkflowExecution[]
): UsagePatterns {
  // Aggregate by different time periods
  const executionsByHour = aggregateByHour(executions)
  const executionsByDay = aggregateExecutionsByDate(executions, { groupBy: 'day' })
  const executionsByWeek = aggregateExecutionsByDate(executions, { groupBy: 'week' })

  // Find peak usage time
  const hourlyUsage = executionsByHour.reduce((acc, item) => {
    const hour = new Date(item.timestamp).getHours()
    acc[hour] = (acc[hour] || 0) + item.value
    return acc
  }, {} as Record<number, number>)

  const peakHour = Object.entries(hourlyUsage)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || '0'
  const peakUsageTime = `${peakHour}:00`

  // Calculate averages
  const averageExecutionsPerDay = executionsByDay.length > 0
    ? executionsByDay.reduce((sum, day) => sum + day.value, 0) / executionsByDay.length
    : 0

  // Simple utilization rate calculation (could be more sophisticated)
  const utilizationRate = Math.min(100, (averageExecutionsPerDay / 24) * 100) // Assuming max 1 per hour is 100%

  // Basic seasonal trend analysis
  const seasonalTrends = analyzeSeasonalTrends(executions)

  return {
    workflowId,
    workflowName,
    executionsByHour,
    executionsByDay,
    executionsByWeek,
    peakUsageTime,
    averageExecutionsPerDay,
    utilizationRate,
    seasonalTrends
  }
}

// Helper functions
function truncateDate(dateString: string, interval: 'hour' | 'day' | 'week' | 'month'): Date {
  const date = new Date(dateString)

  switch (interval) {
    case 'hour':
      date.setMinutes(0, 0, 0)
      break
    case 'day':
      date.setHours(0, 0, 0, 0)
      break
    case 'week':
      const dayOfWeek = date.getDay()
      date.setDate(date.getDate() - dayOfWeek)
      date.setHours(0, 0, 0, 0)
      break
    case 'month':
      date.setDate(1)
      date.setHours(0, 0, 0, 0)
      break
  }

  return date
}

function aggregateByHour(executions: WorkflowExecution[]): TimeSeriesData[] {
  return aggregateExecutionsByDate(executions, { groupBy: 'hour' })
}

function extractErrorType(execution: WorkflowExecution): string {
  // Extract error type from execution data
  // This would need to be customized based on the actual error data structure
  if (execution.status === 'crashed') return 'Crashed'
  if (execution.status === 'aborted') return 'Aborted'
  if (execution.status === 'error') return 'Error'

  // Could extract more specific error types from execution.data if available
  return 'Unknown Error'
}

function analyzeSeasonalTrends(executions: WorkflowExecution[]): {
  pattern: 'daily' | 'weekly' | 'monthly'
  confidence: number
  description: string
}[] {
  // Simplified seasonal trend analysis
  // In a real implementation, this would use more sophisticated statistical analysis

  const trends: { pattern: 'daily' | 'weekly' | 'monthly'; confidence: number; description: string }[] = []

  // Daily pattern analysis
  const hourlyDistribution = executions.reduce((acc, exec) => {
    const hour = new Date(exec.startedAt).getHours()
    acc[hour] = (acc[hour] || 0) + 1
    return acc
  }, {} as Record<number, number>)

  const maxHourlyExecutions = Math.max(...Object.values(hourlyDistribution))
  const avgHourlyExecutions = Object.values(hourlyDistribution).reduce((a, b) => a + b, 0) / 24

  if (maxHourlyExecutions > avgHourlyExecutions * 2) {
    trends.push({
      pattern: 'daily',
      confidence: 0.8,
      description: 'Strong daily usage pattern detected'
    })
  }

  return trends
}

// Data freshness utilities
export function calculateDataFreshness(
  lastSuccessfulExecution: string | undefined,
  expectedFrequencyMinutes: number = 60
): DataFreshnessMetrics {
  const now = Date.now()
  const lastSuccess = lastSuccessfulExecution ? new Date(lastSuccessfulExecution).getTime() : 0
  const dataAge = lastSuccess ? Math.floor((now - lastSuccess) / (1000 * 60)) : Infinity

  const stalenessThreshold = expectedFrequencyMinutes * 2 // Data is stale if 2x expected frequency
  const isStale = dataAge > stalenessThreshold

  let syncHealth: HealthStatus
  if (dataAge <= expectedFrequencyMinutes) {
    syncHealth = 'healthy'
  } else if (dataAge <= stalenessThreshold) {
    syncHealth = 'warning'
  } else {
    syncHealth = 'critical'
  }

  return {
    lastSyncAt: lastSuccessfulExecution || '',
    stalenessThreshold,
    isStale,
    dataAge,
    syncFrequency: expectedFrequencyMinutes,
    missedSyncs: Math.max(0, Math.floor(dataAge / expectedFrequencyMinutes) - 1),
    syncHealth
  }
}

// Export utilities
export function formatAnalyticsValue(
  value: any,
  format: 'text' | 'number' | 'date' | 'duration' | 'percentage'
): string {
  if (value === null || value === undefined) {
    return 'N/A'
  }

  switch (format) {
    case 'date':
      return new Date(value).toLocaleString()
    case 'duration':
      return formatDuration(Number(value))
    case 'percentage':
      return `${Math.round(Number(value) * 100) / 100}%`
    case 'number':
      return Number(value).toLocaleString()
    case 'text':
    default:
      return String(value)
  }
}

export function sanitizeAnalyticsData(data: any[]): any[] {
  return data.map(item => {
    const sanitized: any = {}

    Object.entries(item).forEach(([key, value]) => {
      // Remove internal fields and functions
      if (!key.startsWith('_') && typeof value !== 'function') {
        sanitized[key] = value
      }
    })

    return sanitized
  })
}