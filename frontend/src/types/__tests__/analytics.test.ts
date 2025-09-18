import { describe, test, expect } from 'vitest'
import type {
  DateRange,
  DateRangePreset,
  AnalyticsFilters,
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
  AnalyticsDashboard,
  ReportData,
  ReportFilters,
  ExportField,
  AggregationOptions,
  ComparisonOptions,
  DATE_RANGE_PRESETS,
  DEFAULT_ANALYTICS_EXPORT_FIELDS,
  ANALYTICS_QUERY_KEYS
} from '../analytics'
import type { ExecutionStatus, WorkflowExecution } from '../workflow'

describe('Analytics Types', () => {
  describe('DateRange and related types', () => {
    test('DateRange should have required properties', () => {
      const dateRange: DateRange = {
        startDate: '2023-09-01T00:00:00Z',
        endDate: '2023-09-30T00:00:00Z'
      }

      expect(dateRange.startDate).toBeDefined()
      expect(dateRange.endDate).toBeDefined()
      expect(typeof dateRange.startDate).toBe('string')
      expect(typeof dateRange.endDate).toBe('string')
    })

    test('DateRangePreset should have correct structure', () => {
      const preset: DateRangePreset = {
        key: 'last7d',
        label: 'Last 7 days',
        value: {
          startDate: '2023-09-11T00:00:00Z',
          endDate: '2023-09-18T00:00:00Z'
        }
      }

      expect(preset.key).toBeDefined()
      expect(preset.label).toBeDefined()
      expect(preset.value).toBeDefined()
      expect(preset.value.startDate).toBeDefined()
      expect(preset.value.endDate).toBeDefined()
    })

    test('DATE_RANGE_PRESETS should be properly defined', () => {
      expect(Array.isArray(DATE_RANGE_PRESETS)).toBe(true)
      expect(DATE_RANGE_PRESETS.length).toBeGreaterThan(0)

      DATE_RANGE_PRESETS.forEach(preset => {
        expect(preset.key).toBeDefined()
        expect(preset.label).toBeDefined()
        expect(preset.value.startDate).toBeDefined()
        expect(preset.value.endDate).toBeDefined()
      })
    })
  })

  describe('Metrics and Analytics types', () => {
    test('ExecutionMetrics should have all required properties', () => {
      const metrics: ExecutionMetrics = {
        workflowId: 'workflow-1',
        workflowName: 'Test Workflow',
        period: '2023-09-18',
        totalExecutions: 100,
        successfulExecutions: 85,
        failedExecutions: 15,
        runningExecutions: 0,
        averageDuration: 120000,
        minDuration: 30000,
        maxDuration: 300000,
        successRate: 85,
        errorRate: 15,
        executionsPerHour: 4.17
      }

      expect(typeof metrics.workflowId).toBe('string')
      expect(typeof metrics.workflowName).toBe('string')
      expect(typeof metrics.totalExecutions).toBe('number')
      expect(typeof metrics.successRate).toBe('number')
      expect(typeof metrics.averageDuration).toBe('number')
    })

    test('TimeSeriesData should support metadata', () => {
      const timeSeriesPoint: TimeSeriesData = {
        timestamp: '2023-09-18T10:00:00Z',
        value: 25,
        label: 'Executions',
        metadata: {
          successful: 20,
          failed: 5,
          customProperty: 'test'
        }
      }

      expect(timeSeriesPoint.timestamp).toBeDefined()
      expect(typeof timeSeriesPoint.value).toBe('number')
      expect(timeSeriesPoint.metadata).toBeDefined()
      expect(timeSeriesPoint.metadata?.successful).toBe(20)
    })

    test('TrendData should calculate trends correctly', () => {
      const trendData: TrendData = {
        current: 100,
        previous: 80,
        change: 20,
        changePercent: 25,
        trend: 'up',
        isImprovement: true
      }

      expect(['up', 'down', 'stable']).toContain(trendData.trend)
      expect(typeof trendData.isImprovement).toBe('boolean')
      expect(trendData.change).toBe(20)
      expect(trendData.changePercent).toBe(25)
    })

    test('StatusDistribution should cover all execution statuses', () => {
      const distribution: StatusDistribution = {
        success: 85,
        error: 10,
        running: 3,
        waiting: 2,
        crashed: 0,
        aborted: 0,
        cancelled: 0
      }

      // Check all possible execution statuses are covered
      const allStatuses: ExecutionStatus[] = [
        'success', 'error', 'running', 'waiting', 'crashed', 'aborted', 'cancelled'
      ]

      allStatuses.forEach(status => {
        expect(distribution).toHaveProperty(status)
        expect(typeof distribution[status]).toBe('number')
      })
    })
  })

  describe('Complex Analytics types', () => {
    test('WorkflowAnalytics should be comprehensive', () => {
      const analytics: WorkflowAnalytics = {
        workflowId: 'workflow-1',
        workflowName: 'Test Workflow',
        totalExecutions: 100,
        recentExecutions: 20,
        successRate: 85,
        averageDuration: 120000,
        uptime: 95,
        executionTrend: {
          current: 20,
          previous: 15,
          change: 5,
          changePercent: 33.33,
          trend: 'up',
          isImprovement: true
        },
        performanceTrend: {
          current: 120000,
          previous: 130000,
          change: -10000,
          changePercent: -7.69,
          trend: 'down',
          isImprovement: true
        },
        healthStatus: 'healthy',
        executionHistory: [],
        durationHistory: [],
        statusDistribution: {
          success: 85,
          error: 15,
          running: 0,
          waiting: 0,
          crashed: 0,
          aborted: 0,
          cancelled: 0
        }
      }

      expect(analytics.workflowId).toBeDefined()
      expect(analytics.executionTrend).toBeDefined()
      expect(analytics.performanceTrend).toBeDefined()
      expect(['healthy', 'warning', 'critical', 'unknown']).toContain(analytics.healthStatus)
      expect(Array.isArray(analytics.executionHistory)).toBe(true)
      expect(Array.isArray(analytics.durationHistory)).toBe(true)
    })

    test('PerformanceMetrics should include comprehensive data', () => {
      const performance: PerformanceMetrics = {
        totalWorkflows: 10,
        activeWorkflows: 8,
        totalExecutions: 1000,
        successRate: 88,
        averageDuration: 150000,
        executionsPerDay: 50,
        uptime: 95,
        healthScore: 85,
        trendsData: {
          executions: { current: 1000, previous: 900, change: 100, changePercent: 11.11, trend: 'up', isImprovement: true },
          successRate: { current: 88, previous: 85, change: 3, changePercent: 3.53, trend: 'up', isImprovement: true },
          averageDuration: { current: 150000, previous: 160000, change: -10000, changePercent: -6.25, trend: 'down', isImprovement: true },
          healthScore: { current: 85, previous: 82, change: 3, changePercent: 3.66, trend: 'up', isImprovement: true }
        },
        periodComparison: {
          current: {
            workflowId: 'all',
            workflowName: 'All Workflows',
            period: '2023-09-18',
            totalExecutions: 1000,
            successfulExecutions: 880,
            failedExecutions: 120,
            runningExecutions: 0,
            averageDuration: 150000,
            minDuration: 30000,
            maxDuration: 500000,
            successRate: 88,
            errorRate: 12,
            executionsPerHour: 41.67
          },
          previous: {
            workflowId: 'all',
            workflowName: 'All Workflows',
            period: '2023-09-11',
            totalExecutions: 900,
            successfulExecutions: 765,
            failedExecutions: 135,
            runningExecutions: 0,
            averageDuration: 160000,
            minDuration: 35000,
            maxDuration: 520000,
            successRate: 85,
            errorRate: 15,
            executionsPerHour: 37.5
          }
        }
      }

      expect(performance.trendsData).toBeDefined()
      expect(performance.periodComparison).toBeDefined()
      expect(performance.periodComparison.current).toBeDefined()
      expect(performance.periodComparison.previous).toBeDefined()
    })

    test('DataFreshnessMetrics should track data age', () => {
      const freshness: DataFreshnessMetrics = {
        lastSyncAt: '2023-09-18T10:30:00Z',
        stalenessThreshold: 120,
        isStale: false,
        dataAge: 45,
        syncFrequency: 60,
        missedSyncs: 0,
        syncHealth: 'healthy'
      }

      expect(typeof freshness.isStale).toBe('boolean')
      expect(typeof freshness.dataAge).toBe('number')
      expect(typeof freshness.missedSyncs).toBe('number')
      expect(['healthy', 'warning', 'critical', 'unknown']).toContain(freshness.syncHealth)
    })
  })

  describe('Analysis types', () => {
    test('ExecutionTimeAnalysis should provide detailed timing data', () => {
      const analysis: ExecutionTimeAnalysis = {
        workflowId: 'workflow-1',
        workflowName: 'Test Workflow',
        avgExecutionTime: 120000,
        medianExecutionTime: 110000,
        p95ExecutionTime: 200000,
        p99ExecutionTime: 250000,
        timeDistribution: [
          { range: '0-1s', count: 10, percentage: 10 },
          { range: '1-5s', count: 50, percentage: 50 },
          { range: '5-30s', count: 30, percentage: 30 },
          { range: '30s-1m', count: 8, percentage: 8 },
          { range: '1-5m', count: 2, percentage: 2 },
          { range: '5m+', count: 0, percentage: 0 }
        ],
        slowestExecutions: [],
        executionTimeHistory: []
      }

      expect(analysis.avgExecutionTime).toBeGreaterThan(0)
      expect(analysis.p99ExecutionTime).toBeGreaterThanOrEqual(analysis.p95ExecutionTime)
      expect(analysis.p95ExecutionTime).toBeGreaterThanOrEqual(analysis.medianExecutionTime)
      expect(analysis.timeDistribution).toHaveLength(6)
      expect(Array.isArray(analysis.slowestExecutions)).toBe(true)
    })

    test('ErrorAnalysis should categorize errors', () => {
      const errorAnalysis: ErrorAnalysis = {
        workflowId: 'workflow-1',
        workflowName: 'Test Workflow',
        totalErrors: 25,
        errorRate: 12.5,
        commonErrors: [
          {
            errorType: 'Network Timeout',
            count: 15,
            percentage: 60,
            lastOccurrence: '2023-09-18T10:00:00Z',
            examples: ['exec-1', 'exec-5', 'exec-12']
          },
          {
            errorType: 'Validation Error',
            count: 10,
            percentage: 40,
            lastOccurrence: '2023-09-18T09:30:00Z',
            examples: ['exec-3', 'exec-8']
          }
        ],
        errorTrend: {
          current: 25,
          previous: 30,
          change: -5,
          changePercent: -16.67,
          trend: 'down',
          isImprovement: true
        },
        errorsByNode: [],
        recentErrors: []
      }

      expect(errorAnalysis.totalErrors).toBeGreaterThan(0)
      expect(errorAnalysis.errorRate).toBeGreaterThan(0)
      expect(Array.isArray(errorAnalysis.commonErrors)).toBe(true)
      expect(errorAnalysis.commonErrors.every(error => error.count > 0)).toBe(true)
    })

    test('UsagePatterns should analyze temporal patterns', () => {
      const patterns: UsagePatterns = {
        workflowId: 'workflow-1',
        workflowName: 'Test Workflow',
        executionsByHour: [],
        executionsByDay: [],
        executionsByWeek: [],
        peakUsageTime: '14:00',
        averageExecutionsPerDay: 25,
        utilizationRate: 65,
        seasonalTrends: [
          {
            pattern: 'daily',
            confidence: 0.8,
            description: 'Higher usage during business hours'
          }
        ]
      }

      expect(patterns.peakUsageTime).toMatch(/^\d{1,2}:\d{2}$/)
      expect(patterns.averageExecutionsPerDay).toBeGreaterThan(0)
      expect(patterns.utilizationRate).toBeGreaterThanOrEqual(0)
      expect(patterns.utilizationRate).toBeLessThanOrEqual(100)
      expect(Array.isArray(patterns.seasonalTrends)).toBe(true)
    })
  })

  describe('Dashboard and Reporting types', () => {
    test('AnalyticsDashboard should aggregate all analytics', () => {
      const dashboard: Partial<AnalyticsDashboard> = {
        alertSummary: {
          critical: 2,
          warning: 5,
          info: 10
        }
      }

      expect(dashboard.alertSummary).toBeDefined()
      expect(typeof dashboard.alertSummary?.critical).toBe('number')
      expect(typeof dashboard.alertSummary?.warning).toBe('number')
      expect(typeof dashboard.alertSummary?.info).toBe('number')
    })

    test('ReportFilters should configure report generation', () => {
      const filters: ReportFilters = {
        workflowIds: ['workflow-1', 'workflow-2'],
        dateRange: {
          startDate: '2023-09-01T00:00:00Z',
          endDate: '2023-09-30T00:00:00Z'
        },
        includeCharts: true,
        includeRawData: false,
        groupBy: 'workflow',
        metrics: ['executions', 'performance', 'errors']
      }

      expect(Array.isArray(filters.workflowIds)).toBe(true)
      expect(filters.dateRange).toBeDefined()
      expect(typeof filters.includeCharts).toBe('boolean')
      expect(['workflow', 'date', 'status']).toContain(filters.groupBy)
      expect(Array.isArray(filters.metrics)).toBe(true)
    })

    test('ReportData should structure exported data', () => {
      const reportData: Partial<ReportData> = {
        metadata: {
          title: 'Monthly Analytics Report',
          generatedAt: '2023-09-18T10:00:00Z',
          dateRange: {
            startDate: '2023-09-01T00:00:00Z',
            endDate: '2023-09-30T00:00:00Z'
          },
          totalWorkflows: 10,
          totalExecutions: 1000,
          reportType: 'summary'
        }
      }

      expect(reportData.metadata).toBeDefined()
      expect(reportData.metadata?.title).toBeDefined()
      expect(['summary', 'detailed', 'comparison']).toContain(reportData.metadata?.reportType)
    })

    test('ExportField should configure data export', () => {
      const exportField: ExportField = {
        key: 'workflowName',
        label: 'Workflow Name',
        selected: true,
        format: 'text'
      }

      expect(exportField.key).toBeDefined()
      expect(exportField.label).toBeDefined()
      expect(typeof exportField.selected).toBe('boolean')
      expect(['text', 'number', 'date', 'duration', 'percentage']).toContain(exportField.format)
    })

    test('DEFAULT_ANALYTICS_EXPORT_FIELDS should be properly configured', () => {
      expect(Array.isArray(DEFAULT_ANALYTICS_EXPORT_FIELDS)).toBe(true)
      expect(DEFAULT_ANALYTICS_EXPORT_FIELDS.length).toBeGreaterThan(0)

      DEFAULT_ANALYTICS_EXPORT_FIELDS.forEach(field => {
        expect(field.key).toBeDefined()
        expect(field.label).toBeDefined()
        expect(typeof field.selected).toBe('boolean')
        if (field.format) {
          expect(['text', 'number', 'date', 'duration', 'percentage']).toContain(field.format)
        }
      })
    })
  })

  describe('Configuration and Options types', () => {
    test('AnalyticsFilters should extend ExecutionFilters', () => {
      const filters: AnalyticsFilters = {
        workflowId: 'workflow-1',
        status: ['success', 'error'],
        dateRange: {
          startDate: '2023-09-01T00:00:00Z',
          endDate: '2023-09-30T00:00:00Z'
        },
        groupBy: 'day',
        includeMetrics: true,
        aggregateBy: 'workflow'
      }

      expect(filters.dateRange).toBeDefined()
      expect(['hour', 'day', 'week', 'month']).toContain(filters.groupBy)
      expect(['workflow', 'status', 'date']).toContain(filters.aggregateBy)
      expect(typeof filters.includeMetrics).toBe('boolean')
    })

    test('AggregationOptions should configure data grouping', () => {
      const options: AggregationOptions = {
        groupBy: 'day',
        timezone: 'UTC',
        fillGaps: true,
        defaultValue: 0
      }

      expect(['hour', 'day', 'week', 'month']).toContain(options.groupBy)
      expect(typeof options.fillGaps).toBe('boolean')
      expect(typeof options.defaultValue).toBe('number')
    })

    test('ComparisonOptions should configure trend analysis', () => {
      const options: ComparisonOptions = {
        previousPeriod: true,
        comparisonType: 'percentage',
        showTrend: true
      }

      expect(typeof options.previousPeriod).toBe('boolean')
      expect(['absolute', 'percentage']).toContain(options.comparisonType)
      expect(typeof options.showTrend).toBe('boolean')
    })
  })

  describe('Query Keys', () => {
    test('ANALYTICS_QUERY_KEYS should provide consistent query key structure', () => {
      expect(ANALYTICS_QUERY_KEYS.all).toEqual(['analytics'])
      expect(ANALYTICS_QUERY_KEYS.dashboard()).toEqual(['analytics', 'dashboard'])
      expect(ANALYTICS_QUERY_KEYS.workflowAnalytics()).toEqual(['analytics', 'workflow-analytics'])

      const filters: AnalyticsFilters = { groupBy: 'day' }
      const metricKey = ANALYTICS_QUERY_KEYS.metric(filters)
      expect(metricKey).toContain('analytics')
      expect(metricKey).toContain('metrics')
      expect(metricKey).toContain(filters)

      const timeSeriesKey = ANALYTICS_QUERY_KEYS.timeSeriesData('executions', filters)
      expect(timeSeriesKey).toContain('analytics')
      expect(timeSeriesKey).toContain('time-series')
      expect(timeSeriesKey).toContain('executions')
    })

    test('Query keys should be type-safe and consistent', () => {
      // Test that all query key functions return proper readonly arrays
      const allKeys = ANALYTICS_QUERY_KEYS.all
      const dashboardKeys = ANALYTICS_QUERY_KEYS.dashboard()
      const workflowKeys = ANALYTICS_QUERY_KEYS.workflowAnalytics()

      expect(Array.isArray(allKeys)).toBe(true)
      expect(Array.isArray(dashboardKeys)).toBe(true)
      expect(Array.isArray(workflowKeys)).toBe(true)

      // Test that keys are properly nested
      expect(dashboardKeys.length).toBeGreaterThan(allKeys.length)
      expect(workflowKeys.length).toBeGreaterThan(allKeys.length)
    })
  })

  describe('Type Guards and Validation', () => {
    test('ExecutionStatus values should be valid', () => {
      const validStatuses: ExecutionStatus[] = [
        'success', 'error', 'running', 'waiting', 'crashed', 'aborted', 'cancelled'
      ]

      validStatuses.forEach(status => {
        expect(typeof status).toBe('string')
        expect(status.length).toBeGreaterThan(0)
      })
    })

    test('Health status values should be valid', () => {
      const healthStatuses = ['healthy', 'warning', 'critical', 'unknown']

      healthStatuses.forEach(status => {
        expect(typeof status).toBe('string')
        expect(status.length).toBeGreaterThan(0)
      })
    })

    test('Trend directions should be valid', () => {
      const trendDirections = ['up', 'down', 'stable']

      trendDirections.forEach(direction => {
        expect(typeof direction).toBe('string')
        expect(direction.length).toBeGreaterThan(0)
      })
    })
  })

  describe('Type Compatibility', () => {
    test('Analytics types should be compatible with workflow types', () => {
      // This test ensures that our analytics types properly extend and are compatible
      // with the base workflow types

      const mockExecution: Partial<WorkflowExecution> = {
        id: 'exec-1',
        workflowId: 'workflow-1',
        status: 'success',
        startedAt: '2023-09-18T10:00:00Z',
        stoppedAt: '2023-09-18T10:05:00Z'
      }

      // Should be able to use execution status in status distribution
      const distribution: StatusDistribution = {
        success: 0,
        error: 0,
        running: 0,
        waiting: 0,
        crashed: 0,
        aborted: 0,
        cancelled: 0
      }

      if (mockExecution.status) {
        distribution[mockExecution.status] = 1
      }

      expect(distribution.success).toBeDefined()
    })

    test('Date strings should be ISO format compatible', () => {
      const dateRange: DateRange = {
        startDate: '2023-09-01T00:00:00Z',
        endDate: '2023-09-30T23:59:59Z'
      }

      // Should be parseable as valid dates
      const startDate = new Date(dateRange.startDate)
      const endDate = new Date(dateRange.endDate)

      expect(startDate.getTime()).not.toBeNaN()
      expect(endDate.getTime()).not.toBeNaN()
      expect(endDate.getTime()).toBeGreaterThan(startDate.getTime())
    })
  })
})