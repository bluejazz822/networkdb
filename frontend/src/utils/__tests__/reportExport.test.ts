import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  formatReportValue,
  formatDuration,
  prepareExecutionHistoryData,
  preparePerformanceMetricsData,
  prepareDataFreshnessData,
  prepareTrendAnalysisData,
  exportAnalyticsToCSV,
  exportAnalyticsToExcel,
  exportAnalyticsToPDF,
  exportAnalyticsReport,
  getAnalyticsExportStats,
  generateSampleAnalyticsData,
  exportChartToImage
} from '../reportExport'
import {
  ReportExportConfig,
  AnalyticsReportData,
  WorkflowExecution,
  ExecutionMetrics,
  DataFreshnessMetric,
  PerformanceTrend,
  ReportField,
  ChartExportConfig
} from '../../types/workflow'

describe('reportExport utility functions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('formatReportValue', () => {
    it('should return N/A for null or undefined values', () => {
      expect(formatReportValue(null)).toBe('N/A')
      expect(formatReportValue(undefined)).toBe('N/A')
    })

    it('should format dates correctly', () => {
      const date = '2023-01-01T12:00:00Z'
      const result = formatReportValue(date, 'date')
      expect(result).toContain('2023')
    })

    it('should format durations correctly', () => {
      expect(formatReportValue(65000, 'duration')).toBe('1m 5s')
      expect(formatReportValue(3665000, 'duration')).toBe('1h 1m 5s')
    })

    it('should format percentages correctly', () => {
      expect(formatReportValue(0.85, 'percentage')).toBe('85.0%')
      expect(formatReportValue(1, 'percentage')).toBe('100.0%')
    })

    it('should format numbers correctly', () => {
      expect(formatReportValue(1000, 'number')).toBe('1,000')
      expect(formatReportValue(1000000, 'number')).toBe('1,000,000')
    })

    it('should return string representation for other values', () => {
      expect(formatReportValue('test')).toBe('test')
      expect(formatReportValue(123)).toBe('123')
    })
  })

  describe('formatDuration', () => {
    it('should format durations correctly', () => {
      expect(formatDuration(0)).toBe('0s')
      expect(formatDuration(-1)).toBe('0s')
      expect(formatDuration(1000)).toBe('1s')
      expect(formatDuration(60000)).toBe('1m 0s')
      expect(formatDuration(3600000)).toBe('1h 0m 0s')
      expect(formatDuration(3665000)).toBe('1h 1m 5s')
    })
  })

  describe('prepareExecutionHistoryData', () => {
    const mockExecutions: WorkflowExecution[] = [
      {
        id: 'exec_1',
        workflowId: 'workflow_1',
        mode: 'trigger',
        startedAt: '2023-01-01T10:00:00Z',
        stoppedAt: '2023-01-01T10:01:00Z',
        finished: true,
        status: 'success',
        workflowData: {
          id: 'workflow_1',
          name: 'Test Workflow',
          active: true,
          nodes: [],
          connections: {},
          settings: {}
        }
      } as WorkflowExecution
    ]

    const mockFields: ReportField[] = [
      { key: 'id', label: 'Execution ID', selected: true },
      { key: 'workflowName', label: 'Workflow Name', selected: true },
      { key: 'status', label: 'Status', selected: true },
      { key: 'duration', label: 'Duration', selected: true, format: 'duration' }
    ]

    it('should prepare execution history data correctly', () => {
      const result = prepareExecutionHistoryData(mockExecutions, mockFields)

      expect(result).toHaveLength(1)
      expect(result[0]['Execution ID']).toBe('exec_1')
      expect(result[0]['Workflow Name']).toBe('Test Workflow')
      expect(result[0]['Status']).toBe('success')
      expect(result[0]['Duration']).toBe('1m 0s')
    })

    it('should handle missing workflow data', () => {
      const executionWithoutWorkflowData = {
        ...mockExecutions[0],
        workflowData: undefined
      }

      const result = prepareExecutionHistoryData([executionWithoutWorkflowData], mockFields)
      expect(result[0]['Workflow Name']).toBe('Unknown Workflow')
    })
  })

  describe('preparePerformanceMetricsData', () => {
    const mockMetrics: ExecutionMetrics[] = [
      {
        workflowId: 'workflow_1',
        workflowName: 'Test Workflow',
        totalExecutions: 100,
        successfulExecutions: 85,
        failedExecutions: 15,
        avgDuration: 45000,
        successRate: 0.85,
        errorRate: 0.15,
        trendDirection: 'up'
      }
    ]

    const mockFields: ReportField[] = [
      { key: 'workflowName', label: 'Workflow Name', selected: true },
      { key: 'totalExecutions', label: 'Total Executions', selected: true, format: 'number' },
      { key: 'successRate', label: 'Success Rate', selected: true, format: 'percentage' }
    ]

    it('should prepare performance metrics data correctly', () => {
      const result = preparePerformanceMetricsData(mockMetrics, mockFields)

      expect(result).toHaveLength(1)
      expect(result[0]['Workflow Name']).toBe('Test Workflow')
      expect(result[0]['Total Executions']).toBe('100')
      expect(result[0]['Success Rate']).toBe('85.0%')
    })
  })

  describe('prepareDataFreshnessData', () => {
    const mockFreshness: DataFreshnessMetric[] = [
      {
        workflowId: 'workflow_1',
        workflowName: 'Test Workflow',
        lastSuccessfulExecution: '2023-01-01T10:00:00Z',
        dataAge: 24,
        freshnessStatus: 'stale',
        expectedFrequency: 'daily'
      }
    ]

    const mockFields: ReportField[] = [
      { key: 'workflowName', label: 'Workflow Name', selected: true },
      { key: 'dataAge', label: 'Data Age (hours)', selected: true, format: 'number' },
      { key: 'freshnessStatus', label: 'Status', selected: true }
    ]

    it('should prepare data freshness data correctly', () => {
      const result = prepareDataFreshnessData(mockFreshness, mockFields)

      expect(result).toHaveLength(1)
      expect(result[0]['Workflow Name']).toBe('Test Workflow')
      expect(result[0]['Data Age (hours)']).toBe('24')
      expect(result[0]['Status']).toBe('stale')
    })
  })

  describe('prepareTrendAnalysisData', () => {
    const mockTrends: PerformanceTrend[] = [
      {
        date: '2023-01-01',
        executions: 50,
        successes: 45,
        failures: 5,
        avgDuration: 30000,
        successRate: 0.9
      }
    ]

    const mockFields: ReportField[] = [
      { key: 'date', label: 'Date', selected: true, format: 'date' },
      { key: 'executions', label: 'Total Executions', selected: true, format: 'number' },
      { key: 'successRate', label: 'Success Rate', selected: true, format: 'percentage' }
    ]

    it('should prepare trend analysis data correctly', () => {
      const result = prepareTrendAnalysisData(mockTrends, mockFields)

      expect(result).toHaveLength(1)
      expect(result[0]['Date']).toContain('2023')
      expect(result[0]['Total Executions']).toBe('50')
      expect(result[0]['Success Rate']).toBe('90.0%')
    })
  })

  describe('export functions', () => {
    const mockConfig: ReportExportConfig = {
      reportType: 'execution_history',
      format: 'csv',
      timeRange: {
        start: '2023-01-01T00:00:00Z',
        end: '2023-01-07T23:59:59Z',
        granularity: 'day'
      },
      fields: [
        { key: 'id', label: 'Execution ID', selected: true },
        { key: 'workflowName', label: 'Workflow Name', selected: true }
      ]
    }

    const mockReportData: AnalyticsReportData = {
      metadata: {
        reportType: 'execution_history',
        timeRange: mockConfig.timeRange,
        generatedAt: '2023-01-01T12:00:00Z',
        totalRecords: 1
      },
      data: {
        executions: [
          {
            id: 'exec_1',
            workflowId: 'workflow_1',
            mode: 'trigger',
            startedAt: '2023-01-01T10:00:00Z',
            stoppedAt: '2023-01-01T10:01:00Z',
            finished: true,
            status: 'success',
            workflowData: {
              id: 'workflow_1',
              name: 'Test Workflow',
              active: true,
              nodes: [],
              connections: {},
              settings: {}
            }
          } as WorkflowExecution
        ]
      }
    }

    describe('exportAnalyticsToCSV', () => {
      it('should export data to CSV successfully', async () => {
        const result = await exportAnalyticsToCSV(mockConfig, mockReportData)
        expect(result).toBe(true)
      })

      it('should fail when no data is available', async () => {
        const emptyReportData = {
          ...mockReportData,
          data: {}
        }

        const result = await exportAnalyticsToCSV(mockConfig, emptyReportData)
        expect(result).toBe(false)
      })
    })

    describe('exportAnalyticsToExcel', () => {
      it('should export data to Excel successfully', async () => {
        const result = await exportAnalyticsToExcel(mockConfig, mockReportData)
        expect(result).toBe(true)
      })

      it('should fail when no data is available', async () => {
        const emptyReportData = {
          ...mockReportData,
          data: {}
        }

        const result = await exportAnalyticsToExcel(mockConfig, emptyReportData)
        expect(result).toBe(false)
      })
    })

    describe('exportAnalyticsToPDF', () => {
      it('should export data to PDF successfully', async () => {
        const result = await exportAnalyticsToPDF(mockConfig, mockReportData)
        expect(result).toBe(true)
      })

      it('should export data to PDF with charts successfully', async () => {
        const chartConfigs: ChartExportConfig[] = [
          {
            chartId: 'test-chart',
            title: 'Test Chart',
            type: 'line',
            width: 400,
            height: 300
          }
        ]

        // Mock chart element
        const mockElement = document.createElement('div')
        mockElement.id = 'test-chart'
        vi.spyOn(document, 'getElementById').mockReturnValue(mockElement)

        const configWithCharts = {
          ...mockConfig,
          format: 'pdf' as const,
          filters: { includeCharts: true }
        }

        const result = await exportAnalyticsToPDF(configWithCharts, mockReportData, chartConfigs)
        expect(result).toBe(true)
      })
    })

    describe('exportAnalyticsReport', () => {
      it('should route to correct export function based on format', async () => {
        const csvResult = await exportAnalyticsReport(mockConfig, mockReportData)
        expect(csvResult).toBe(true)

        const excelConfig = { ...mockConfig, format: 'excel' as const }
        const excelResult = await exportAnalyticsReport(excelConfig, mockReportData)
        expect(excelResult).toBe(true)

        const pdfConfig = { ...mockConfig, format: 'pdf' as const }
        const pdfResult = await exportAnalyticsReport(pdfConfig, mockReportData)
        expect(pdfResult).toBe(true)
      })

      it('should fail for unsupported format', async () => {
        const invalidConfig = { ...mockConfig, format: 'invalid' as any }
        const result = await exportAnalyticsReport(invalidConfig, mockReportData)
        expect(result).toBe(false)
      })
    })
  })

  describe('getAnalyticsExportStats', () => {
    const mockConfig: ReportExportConfig = {
      reportType: 'execution_history',
      format: 'csv',
      timeRange: {
        start: '2023-01-01T00:00:00Z',
        end: '2023-01-07T23:59:59Z',
        granularity: 'day'
      },
      fields: [
        { key: 'id', label: 'Execution ID', selected: true },
        { key: 'workflowName', label: 'Workflow Name', selected: false }
      ]
    }

    const mockReportData: AnalyticsReportData = {
      metadata: {
        reportType: 'execution_history',
        timeRange: mockConfig.timeRange,
        generatedAt: '2023-01-01T12:00:00Z',
        totalRecords: 10
      },
      data: {}
    }

    it('should calculate export stats correctly', () => {
      const stats = getAnalyticsExportStats(mockConfig, mockReportData)

      expect(stats.selectedFields).toBe(1)
      expect(stats.totalFields).toBe(2)
      expect(stats.totalRecords).toBe(10)
      expect(stats.reportType).toBe('execution_history')
      expect(stats.timeRange).toEqual(mockConfig.timeRange)
      expect(stats.estimatedFileSize).toHaveProperty('csv')
      expect(stats.estimatedFileSize).toHaveProperty('excel')
      expect(stats.estimatedFileSize).toHaveProperty('pdf')
    })
  })

  describe('generateSampleAnalyticsData', () => {
    const mockTimeRange = {
      start: '2023-01-01T00:00:00Z',
      end: '2023-01-07T23:59:59Z',
      granularity: 'day' as const
    }

    it('should generate sample execution history data', () => {
      const data = generateSampleAnalyticsData('execution_history', mockTimeRange)

      expect(data.metadata.reportType).toBe('execution_history')
      expect(data.metadata.timeRange).toEqual(mockTimeRange)
      expect(data.metadata.totalRecords).toBe(10)
      expect(data.data.executions).toHaveLength(10)
      expect(data.data.summary).toBeDefined()
    })

    it('should generate sample performance metrics data', () => {
      const data = generateSampleAnalyticsData('performance_metrics', mockTimeRange)

      expect(data.metadata.reportType).toBe('performance_metrics')
      expect(data.metadata.totalRecords).toBe(5)
      expect(data.data.metrics).toHaveLength(5)
    })

    it('should generate sample data freshness data', () => {
      const data = generateSampleAnalyticsData('data_freshness', mockTimeRange)

      expect(data.metadata.reportType).toBe('data_freshness')
      expect(data.metadata.totalRecords).toBe(5)
      expect(data.data.freshness).toHaveLength(5)
    })

    it('should generate sample trend analysis data', () => {
      const data = generateSampleAnalyticsData('trend_analysis', mockTimeRange)

      expect(data.metadata.reportType).toBe('trend_analysis')
      expect(data.metadata.totalRecords).toBe(30)
      expect(data.data.trends).toHaveLength(30)
    })
  })

  describe('exportChartToImage', () => {
    const mockChartConfig: ChartExportConfig = {
      chartId: 'test-chart',
      title: 'Test Chart',
      type: 'line',
      width: 400,
      height: 300
    }

    it('should export chart to image successfully', async () => {
      // Mock chart element
      const mockElement = document.createElement('div')
      mockElement.id = 'test-chart'
      vi.spyOn(document, 'getElementById').mockReturnValue(mockElement)

      const result = await exportChartToImage(mockChartConfig)
      expect(result).toBe('data:image/png;base64,mockImageData')
    })

    it('should return null when chart element not found', async () => {
      vi.spyOn(document, 'getElementById').mockReturnValue(null)

      const result = await exportChartToImage(mockChartConfig)
      expect(result).toBeNull()
    })
  })
})