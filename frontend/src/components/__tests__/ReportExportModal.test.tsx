import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  ReportExportConfig,
  AnalyticsReportData,
  ChartExportConfig,
  EXECUTION_HISTORY_FIELDS,
  PERFORMANCE_METRICS_FIELDS,
  DATA_FRESHNESS_FIELDS
} from '../../types/workflow'

// Test the component's type definitions and default configurations
describe('ReportExportModal Types and Configurations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should have correct default field configurations for execution history', () => {
    expect(EXECUTION_HISTORY_FIELDS).toHaveLength(8)
    expect(EXECUTION_HISTORY_FIELDS[0]).toEqual({
      key: 'id',
      label: 'Execution ID',
      selected: true
    })
    expect(EXECUTION_HISTORY_FIELDS[1]).toEqual({
      key: 'workflowName',
      label: 'Workflow Name',
      selected: true
    })
    expect(EXECUTION_HISTORY_FIELDS[5]).toEqual({
      key: 'duration',
      label: 'Duration',
      selected: true,
      format: 'duration'
    })
  })

  it('should have correct default field configurations for performance metrics', () => {
    expect(PERFORMANCE_METRICS_FIELDS).toHaveLength(8)
    expect(PERFORMANCE_METRICS_FIELDS[0]).toEqual({
      key: 'workflowName',
      label: 'Workflow Name',
      selected: true
    })
    expect(PERFORMANCE_METRICS_FIELDS[4]).toEqual({
      key: 'successRate',
      label: 'Success Rate',
      selected: true,
      format: 'percentage'
    })
  })

  it('should have correct default field configurations for data freshness', () => {
    expect(DATA_FRESHNESS_FIELDS).toHaveLength(6)
    expect(DATA_FRESHNESS_FIELDS[0]).toEqual({
      key: 'workflowName',
      label: 'Workflow Name',
      selected: true
    })
    expect(DATA_FRESHNESS_FIELDS[2]).toEqual({
      key: 'dataAge',
      label: 'Data Age (hours)',
      selected: true,
      format: 'number'
    })
  })

  it('should validate ReportExportConfig structure', () => {
    const config: ReportExportConfig = {
      reportType: 'execution_history',
      format: 'csv',
      timeRange: {
        start: '2023-01-01T00:00:00Z',
        end: '2023-01-07T23:59:59Z',
        granularity: 'day'
      },
      filters: {
        workflowIds: ['workflow1', 'workflow2'],
        status: ['success', 'error'],
        includeCharts: false,
        groupBy: 'workflow'
      },
      fields: EXECUTION_HISTORY_FIELDS
    }

    expect(config.reportType).toBe('execution_history')
    expect(config.format).toBe('csv')
    expect(config.timeRange.granularity).toBe('day')
    expect(config.filters?.includeCharts).toBe(false)
    expect(config.fields).toHaveLength(8)
  })

  it('should validate AnalyticsReportData structure', () => {
    const reportData: AnalyticsReportData = {
      metadata: {
        reportType: 'performance_metrics',
        timeRange: {
          start: '2023-01-01T00:00:00Z',
          end: '2023-01-07T23:59:59Z',
          granularity: 'day'
        },
        generatedAt: '2023-01-01T12:00:00Z',
        totalRecords: 50,
        filters: {
          workflowIds: ['test-workflow']
        }
      },
      data: {
        metrics: [
          {
            workflowId: 'test-workflow',
            workflowName: 'Test Workflow',
            totalExecutions: 100,
            successfulExecutions: 85,
            failedExecutions: 15,
            avgDuration: 45000,
            successRate: 0.85,
            errorRate: 0.15,
            trendDirection: 'up'
          }
        ],
        summary: {
          totalWorkflows: 5,
          totalExecutions: 500,
          overallSuccessRate: 0.9,
          avgExecutionTime: 42000,
          activeWorkflows: 4
        }
      }
    }

    expect(reportData.metadata.reportType).toBe('performance_metrics')
    expect(reportData.metadata.totalRecords).toBe(50)
    expect(reportData.data.metrics).toHaveLength(1)
    expect(reportData.data.summary?.totalWorkflows).toBe(5)
  })

  it('should validate ChartExportConfig structure', () => {
    const chartConfig: ChartExportConfig = {
      chartId: 'trend-chart',
      title: 'Performance Trends',
      type: 'line',
      width: 800,
      height: 400,
      includeData: true
    }

    expect(chartConfig.chartId).toBe('trend-chart')
    expect(chartConfig.type).toBe('line')
    expect(chartConfig.width).toBe(800)
    expect(chartConfig.includeData).toBe(true)
  })

  it('should support all report types', () => {
    const reportTypes = ['execution_history', 'performance_metrics', 'data_freshness', 'trend_analysis'] as const

    reportTypes.forEach(type => {
      const config: ReportExportConfig = {
        reportType: type,
        format: 'pdf',
        timeRange: {
          start: '2023-01-01T00:00:00Z',
          end: '2023-01-07T23:59:59Z',
          granularity: 'day'
        },
        fields: []
      }

      expect(config.reportType).toBe(type)
    })
  })

  it('should support all export formats', () => {
    const formats = ['csv', 'pdf', 'excel'] as const

    formats.forEach(format => {
      const config: ReportExportConfig = {
        reportType: 'execution_history',
        format: format,
        timeRange: {
          start: '2023-01-01T00:00:00Z',
          end: '2023-01-07T23:59:59Z',
          granularity: 'day'
        },
        fields: []
      }

      expect(config.format).toBe(format)
    })
  })

  it('should support all granularity options', () => {
    const granularities = ['hour', 'day', 'week', 'month'] as const

    granularities.forEach(granularity => {
      const config: ReportExportConfig = {
        reportType: 'trend_analysis',
        format: 'csv',
        timeRange: {
          start: '2023-01-01T00:00:00Z',
          end: '2023-01-07T23:59:59Z',
          granularity: granularity
        },
        fields: []
      }

      expect(config.timeRange.granularity).toBe(granularity)
    })
  })

  it('should validate field format options', () => {
    const formats = ['date', 'duration', 'percentage', 'number', 'text'] as const

    formats.forEach(format => {
      const field = {
        key: 'test',
        label: 'Test Field',
        selected: true,
        format: format
      }

      expect(field.format).toBe(format)
    })
  })
})