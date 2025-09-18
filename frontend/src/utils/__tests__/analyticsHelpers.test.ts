import {
  createDateRange,
  getDateRangePreset,
  isDateInRange,
  generateDateSeries,
  aggregateExecutionsByDate,
  aggregateExecutionsByStatus,
  aggregateExecutionsByWorkflow,
  calculateTrend,
  calculateExecutionTrend,
  calculateSuccessRateTrend,
  calculateAverageDurationTrend,
  calculateAverageExecutionDuration,
  calculateExecutionPercentiles,
  calculateExecutionUptime,
  calculateHealthScore,
  generateWorkflowAnalytics,
  generateExecutionTimeAnalysis,
  generateErrorAnalysis,
  generateUsagePatterns,
  calculateDataFreshness,
  formatAnalyticsValue,
  sanitizeAnalyticsData
} from '../analyticsHelpers'
import type { WorkflowExecution } from '@/types/workflow'
import type { DateRange, AggregationOptions } from '@/types/analytics'

// Mock data for testing
const mockExecution: WorkflowExecution = {
  id: 'exec-1',
  workflowId: 'workflow-1',
  mode: 'trigger',
  startedAt: '2023-09-18T10:00:00Z',
  stoppedAt: '2023-09-18T10:05:00Z',
  finished: true,
  status: 'success',
  workflowData: {
    id: 'workflow-1',
    name: 'Test Workflow',
    active: true,
    nodes: [],
    connections: {},
    settings: {}
  }
}

const mockExecutions: WorkflowExecution[] = [
  {
    ...mockExecution,
    id: 'exec-1',
    startedAt: '2023-09-18T10:00:00Z',
    stoppedAt: '2023-09-18T10:05:00Z',
    status: 'success'
  },
  {
    ...mockExecution,
    id: 'exec-2',
    startedAt: '2023-09-18T11:00:00Z',
    stoppedAt: '2023-09-18T11:03:00Z',
    status: 'success'
  },
  {
    ...mockExecution,
    id: 'exec-3',
    startedAt: '2023-09-18T12:00:00Z',
    stoppedAt: '2023-09-18T12:10:00Z',
    status: 'error'
  },
  {
    ...mockExecution,
    id: 'exec-4',
    startedAt: '2023-09-19T10:00:00Z',
    stoppedAt: '2023-09-19T10:02:00Z',
    status: 'success'
  }
]

describe('analyticsHelpers', () => {
  describe('Date utilities', () => {
    test('createDateRange should create valid date range', () => {
      const range = createDateRange(7)

      expect(range.startDate).toBeDefined()
      expect(range.endDate).toBeDefined()

      const start = new Date(range.startDate)
      const end = new Date(range.endDate)
      const diff = end.getTime() - start.getTime()
      const daysDiff = Math.round(diff / (1000 * 60 * 60 * 24))

      expect(daysDiff).toBe(7)
    })

    test('getDateRangePreset should return correct preset', () => {
      const preset = getDateRangePreset('last7d')

      expect(preset).toBeDefined()
      expect(preset?.startDate).toBeDefined()
      expect(preset?.endDate).toBeDefined()
    })

    test('getDateRangePreset should return null for invalid preset', () => {
      const preset = getDateRangePreset('invalid')

      expect(preset).toBeNull()
    })

    test('isDateInRange should correctly identify dates in range', () => {
      const range: DateRange = {
        startDate: '2023-09-18T00:00:00Z',
        endDate: '2023-09-19T00:00:00Z'
      }

      expect(isDateInRange('2023-09-18T12:00:00Z', range)).toBe(true)
      expect(isDateInRange('2023-09-17T12:00:00Z', range)).toBe(false)
      expect(isDateInRange('2023-09-20T12:00:00Z', range)).toBe(false)
    })

    test('generateDateSeries should create correct date intervals', () => {
      const range: DateRange = {
        startDate: '2023-09-18T00:00:00Z',
        endDate: '2023-09-20T00:00:00Z'
      }

      const dailySeries = generateDateSeries(range, 'day')
      expect(dailySeries).toHaveLength(3) // 18th, 19th, 20th

      const hourlySeries = generateDateSeries(range, 'hour')
      expect(hourlySeries.length).toBeGreaterThan(24) // More than 24 hours
    })
  })

  describe('Data aggregation', () => {
    test('aggregateExecutionsByDate should group executions by date', () => {
      const options: AggregationOptions = { groupBy: 'day' }
      const result = aggregateExecutionsByDate(mockExecutions, options)

      expect(result).toHaveLength(2) // 2 different days
      expect(result[0].value).toBe(3) // 3 executions on first day
      expect(result[1].value).toBe(1) // 1 execution on second day
    })

    test('aggregateExecutionsByDate should fill gaps when requested', () => {
      const options: AggregationOptions = { groupBy: 'day', fillGaps: true, defaultValue: 0 }
      const result = aggregateExecutionsByDate(mockExecutions, options)

      // Should include the gap day between 18th and 19th if there's any
      expect(result.length).toBeGreaterThanOrEqual(2)
      expect(result.every(item => typeof item.value === 'number')).toBe(true)
    })

    test('aggregateExecutionsByStatus should count status correctly', () => {
      const result = aggregateExecutionsByStatus(mockExecutions)

      expect(result.success).toBe(3)
      expect(result.error).toBe(1)
      expect(result.running).toBe(0)
    })

    test('aggregateExecutionsByWorkflow should group by workflow', () => {
      const multiWorkflowExecutions = [
        ...mockExecutions,
        { ...mockExecution, id: 'exec-5', workflowId: 'workflow-2' }
      ]

      const result = aggregateExecutionsByWorkflow(multiWorkflowExecutions)

      expect(Object.keys(result)).toHaveLength(2)
      expect(result['workflow-1']).toHaveLength(4)
      expect(result['workflow-2']).toHaveLength(1)
    })
  })

  describe('Trend calculations', () => {
    test('calculateTrend should calculate upward trend correctly', () => {
      const trend = calculateTrend(100, 80, true)

      expect(trend.current).toBe(100)
      expect(trend.previous).toBe(80)
      expect(trend.change).toBe(20)
      expect(trend.changePercent).toBe(25)
      expect(trend.trend).toBe('up')
      expect(trend.isImprovement).toBe(true)
    })

    test('calculateTrend should calculate downward trend correctly', () => {
      const trend = calculateTrend(80, 100, true)

      expect(trend.current).toBe(80)
      expect(trend.previous).toBe(100)
      expect(trend.change).toBe(-20)
      expect(trend.changePercent).toBe(-20)
      expect(trend.trend).toBe('down')
      expect(trend.isImprovement).toBe(false)
    })

    test('calculateTrend should identify stable trend', () => {
      const trend = calculateTrend(100, 98, true)

      expect(trend.trend).toBe('stable')
    })

    test('calculateTrend should handle inverted improvement logic', () => {
      const trend = calculateTrend(80, 100, false) // Lower is better

      expect(trend.isImprovement).toBe(true) // Lower value is improvement
    })

    test('calculateExecutionTrend should compare execution counts', () => {
      const current = mockExecutions.slice(0, 2)
      const previous = mockExecutions.slice(2, 3)

      const trend = calculateExecutionTrend(current, previous)

      expect(trend.current).toBe(2)
      expect(trend.previous).toBe(1)
      expect(trend.isImprovement).toBe(true)
    })
  })

  describe('Performance calculations', () => {
    test('calculateAverageExecutionDuration should compute correct average', () => {
      const avgDuration = calculateAverageExecutionDuration(mockExecutions)

      // Expected: (5min + 3min + 10min + 2min) / 4 = 5min = 300000ms
      expect(avgDuration).toBe(300000)
    })

    test('calculateAverageExecutionDuration should handle empty array', () => {
      const avgDuration = calculateAverageExecutionDuration([])

      expect(avgDuration).toBe(0)
    })

    test('calculateAverageExecutionDuration should handle executions without end time', () => {
      const incompleteExecution = {
        ...mockExecution,
        stoppedAt: undefined
      }

      const avgDuration = calculateAverageExecutionDuration([incompleteExecution])

      expect(avgDuration).toBe(0)
    })

    test('calculateExecutionPercentiles should compute percentiles correctly', () => {
      const percentiles = calculateExecutionPercentiles(mockExecutions)

      expect(percentiles.p50).toBeGreaterThan(0)
      expect(percentiles.p95).toBeGreaterThan(0)
      expect(percentiles.p99).toBeGreaterThan(0)
      expect(percentiles.p99).toBeGreaterThanOrEqual(percentiles.p95)
      expect(percentiles.p95).toBeGreaterThanOrEqual(percentiles.p50)
    })

    test('calculateExecutionUptime should calculate uptime percentage', () => {
      const uptime = calculateExecutionUptime(mockExecutions)

      // 3 successful out of 4 total = 75%
      expect(uptime).toBe(75)
    })

    test('calculateExecutionUptime should handle empty array', () => {
      const uptime = calculateExecutionUptime([])

      expect(uptime).toBe(100)
    })

    test('calculateHealthScore should compute reasonable health score', () => {
      const healthScore = calculateHealthScore(80, 90, 60000, 60000)

      expect(healthScore).toBeGreaterThanOrEqual(0)
      expect(healthScore).toBeLessThanOrEqual(100)
      expect(typeof healthScore).toBe('number')
    })
  })

  describe('Analytics generation', () => {
    test('generateWorkflowAnalytics should create comprehensive analytics', () => {
      const dateRange: DateRange = {
        startDate: '2023-09-18T00:00:00Z',
        endDate: '2023-09-20T00:00:00Z'
      }

      const analytics = generateWorkflowAnalytics(
        'workflow-1',
        'Test Workflow',
        mockExecutions,
        dateRange
      )

      expect(analytics.workflowId).toBe('workflow-1')
      expect(analytics.workflowName).toBe('Test Workflow')
      expect(analytics.totalExecutions).toBe(4)
      expect(analytics.successRate).toBe(75)
      expect(analytics.averageDuration).toBe(300000)
      expect(analytics.uptime).toBe(75)
      expect(analytics.executionHistory).toHaveLength(2)
      expect(analytics.statusDistribution.success).toBe(3)
      expect(analytics.statusDistribution.error).toBe(1)
      expect(['healthy', 'warning', 'critical']).toContain(analytics.healthStatus)
    })

    test('generateExecutionTimeAnalysis should analyze execution times', () => {
      const analysis = generateExecutionTimeAnalysis(
        'workflow-1',
        'Test Workflow',
        mockExecutions
      )

      expect(analysis.workflowId).toBe('workflow-1')
      expect(analysis.workflowName).toBe('Test Workflow')
      expect(analysis.avgExecutionTime).toBe(300000)
      expect(analysis.timeDistribution).toHaveLength(6) // 6 time ranges
      expect(analysis.timeDistribution.every(d => d.count >= 0)).toBe(true)
      expect(analysis.slowestExecutions).toHaveLength(4)
      expect(analysis.executionTimeHistory).toHaveLength(2) // 2 days
    })

    test('generateErrorAnalysis should analyze errors', () => {
      const analysis = generateErrorAnalysis(
        'workflow-1',
        'Test Workflow',
        mockExecutions
      )

      expect(analysis.workflowId).toBe('workflow-1')
      expect(analysis.workflowName).toBe('Test Workflow')
      expect(analysis.totalErrors).toBe(1)
      expect(analysis.errorRate).toBe(25)
      expect(analysis.commonErrors.length).toBeGreaterThan(0)
      expect(analysis.recentErrors).toHaveLength(1)
    })

    test('generateUsagePatterns should analyze usage patterns', () => {
      const patterns = generateUsagePatterns(
        'workflow-1',
        'Test Workflow',
        mockExecutions
      )

      expect(patterns.workflowId).toBe('workflow-1')
      expect(patterns.workflowName).toBe('Test Workflow')
      expect(patterns.executionsByHour.length).toBeGreaterThan(0)
      expect(patterns.executionsByDay).toHaveLength(2)
      expect(patterns.executionsByWeek.length).toBeGreaterThan(0)
      expect(patterns.peakUsageTime).toMatch(/^\d{1,2}:00$/)
      expect(patterns.averageExecutionsPerDay).toBeGreaterThan(0)
      expect(patterns.utilizationRate).toBeGreaterThanOrEqual(0)
      expect(patterns.seasonalTrends).toBeInstanceOf(Array)
    })
  })

  describe('Data freshness', () => {
    test('calculateDataFreshness should determine fresh data', () => {
      const recentTime = new Date(Date.now() - 30 * 60 * 1000).toISOString() // 30 minutes ago
      const freshness = calculateDataFreshness(recentTime, 60) // Expected every 60 minutes

      expect(freshness.isStale).toBe(false)
      expect(freshness.syncHealth).toBe('healthy')
      expect(freshness.dataAge).toBe(30)
      expect(freshness.missedSyncs).toBe(0)
    })

    test('calculateDataFreshness should determine stale data', () => {
      const oldTime = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString() // 3 hours ago
      const freshness = calculateDataFreshness(oldTime, 60) // Expected every 60 minutes

      expect(freshness.isStale).toBe(true)
      expect(freshness.syncHealth).toBe('critical')
      expect(freshness.dataAge).toBe(180)
      expect(freshness.missedSyncs).toBe(2)
    })

    test('calculateDataFreshness should handle undefined last execution', () => {
      const freshness = calculateDataFreshness(undefined, 60)

      expect(freshness.isStale).toBe(true)
      expect(freshness.syncHealth).toBe('critical')
      expect(freshness.dataAge).toBe(Infinity)
    })
  })

  describe('Utility functions', () => {
    test('formatAnalyticsValue should format different value types', () => {
      expect(formatAnalyticsValue('2023-09-18T10:00:00Z', 'date')).toContain('2023')
      expect(formatAnalyticsValue(300000, 'duration')).toBe('5m')
      expect(formatAnalyticsValue(0.75, 'percentage')).toBe('0.75%')
      expect(formatAnalyticsValue(1234, 'number')).toBe('1,234')
      expect(formatAnalyticsValue('test', 'text')).toBe('test')
      expect(formatAnalyticsValue(null, 'text')).toBe('N/A')
      expect(formatAnalyticsValue(undefined, 'text')).toBe('N/A')
    })

    test('sanitizeAnalyticsData should remove internal fields', () => {
      const data = [
        {
          id: '1',
          name: 'test',
          _internal: 'private',
          _cache: {},
          method: () => 'function',
          value: 123
        }
      ]

      const sanitized = sanitizeAnalyticsData(data)

      expect(sanitized[0]).toHaveProperty('id')
      expect(sanitized[0]).toHaveProperty('name')
      expect(sanitized[0]).toHaveProperty('value')
      expect(sanitized[0]).not.toHaveProperty('_internal')
      expect(sanitized[0]).not.toHaveProperty('_cache')
      expect(sanitized[0]).not.toHaveProperty('method')
    })
  })

  describe('Edge cases and error handling', () => {
    test('should handle empty executions arrays gracefully', () => {
      expect(() => aggregateExecutionsByDate([], { groupBy: 'day' })).not.toThrow()
      expect(() => aggregateExecutionsByStatus([])).not.toThrow()
      expect(() => aggregateExecutionsByWorkflow([])).not.toThrow()
      expect(() => calculateAverageExecutionDuration([])).not.toThrow()
      expect(() => calculateExecutionPercentiles([])).not.toThrow()
      expect(() => calculateExecutionUptime([])).not.toThrow()
    })

    test('should handle invalid date strings', () => {
      const invalidRange: DateRange = {
        startDate: 'invalid-date',
        endDate: '2023-09-20T00:00:00Z'
      }

      expect(() => isDateInRange('2023-09-18T12:00:00Z', invalidRange)).not.toThrow()
    })

    test('should handle division by zero in trend calculations', () => {
      const trend = calculateTrend(100, 0, true)

      expect(trend.changePercent).toBe(0)
      expect(trend.current).toBe(100)
      expect(trend.previous).toBe(0)
    })

    test('should handle malformed execution data', () => {
      const malformedExecution = {
        ...mockExecution,
        startedAt: 'invalid-date',
        stoppedAt: null
      } as any

      expect(() => calculateAverageExecutionDuration([malformedExecution])).not.toThrow()
      expect(() => aggregateExecutionsByDate([malformedExecution], { groupBy: 'day' })).not.toThrow()
    })
  })

  describe('Performance and scalability', () => {
    test('should handle large datasets efficiently', () => {
      // Generate a large dataset
      const largeDataset: WorkflowExecution[] = Array.from({ length: 1000 }, (_, i) => ({
        ...mockExecution,
        id: `exec-${i}`,
        startedAt: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(), // Spread over 1000 hours
        stoppedAt: new Date(Date.now() - i * 60 * 60 * 1000 + 60000).toISOString() // 1 minute duration
      }))

      const start = performance.now()

      const analytics = generateWorkflowAnalytics(
        'workflow-large',
        'Large Workflow',
        largeDataset,
        createDateRange(30)
      )

      const end = performance.now()
      const duration = end - start

      expect(analytics).toBeDefined()
      expect(analytics.totalExecutions).toBeGreaterThan(0)
      expect(duration).toBeLessThan(1000) // Should complete in less than 1 second
    })

    test('should handle date range edge cases', () => {
      const sameStartEnd: DateRange = {
        startDate: '2023-09-18T10:00:00Z',
        endDate: '2023-09-18T10:00:00Z'
      }

      expect(() => generateDateSeries(sameStartEnd, 'hour')).not.toThrow()

      const reversedRange: DateRange = {
        startDate: '2023-09-20T10:00:00Z',
        endDate: '2023-09-18T10:00:00Z'
      }

      expect(() => generateDateSeries(reversedRange, 'day')).not.toThrow()
    })
  })
})