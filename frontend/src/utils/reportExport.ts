import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import 'jspdf-autotable'
import Papa from 'papaparse'
import html2canvas from 'html2canvas'
import {
  ReportExportConfig,
  ReportField,
  AnalyticsReportData,
  WorkflowExecution,
  ExecutionMetrics,
  PerformanceTrend,
  DataFreshnessMetric,
  ChartExportConfig,
  AnalyticsTimeRange
} from '../types/workflow'

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF
  }
}

// Format utility functions
export const formatReportValue = (value: any, format?: string): string => {
  if (value === null || value === undefined) {
    return 'N/A'
  }

  switch (format) {
    case 'date':
      return value ? new Date(value).toLocaleString() : 'N/A'
    case 'duration':
      return formatDuration(value)
    case 'percentage':
      return `${(value * 100).toFixed(1)}%`
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value)
    default:
      return String(value)
  }
}

export const formatDuration = (milliseconds: number): string => {
  if (!milliseconds || milliseconds < 0) return '0s'

  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  } else {
    return `${seconds}s`
  }
}

// Data preparation functions
export const prepareExecutionHistoryData = (
  executions: WorkflowExecution[],
  selectedFields: ReportField[]
): Record<string, any>[] => {
  const fieldsToExport = selectedFields.filter(field => field.selected)

  return executions.map(execution => {
    const exportItem: Record<string, any> = {}

    fieldsToExport.forEach(field => {
      let value: any

      switch (field.key) {
        case 'id':
          value = execution.id
          break
        case 'workflowName':
          value = execution.workflowData?.name || 'Unknown Workflow'
          break
        case 'status':
          value = execution.status
          break
        case 'startedAt':
          value = execution.startedAt
          break
        case 'stoppedAt':
          value = execution.stoppedAt
          break
        case 'duration':
          value = execution.stoppedAt && execution.startedAt
            ? new Date(execution.stoppedAt).getTime() - new Date(execution.startedAt).getTime()
            : null
          break
        case 'mode':
          value = execution.mode
          break
        case 'retryOf':
          value = execution.retryOf || null
          break
        default:
          value = (execution as any)[field.key]
      }

      exportItem[field.label] = formatReportValue(value, field.format)
    })

    return exportItem
  })
}

export const preparePerformanceMetricsData = (
  metrics: ExecutionMetrics[],
  selectedFields: ReportField[]
): Record<string, any>[] => {
  const fieldsToExport = selectedFields.filter(field => field.selected)

  return metrics.map(metric => {
    const exportItem: Record<string, any> = {}

    fieldsToExport.forEach(field => {
      const value = (metric as any)[field.key]
      exportItem[field.label] = formatReportValue(value, field.format)
    })

    return exportItem
  })
}

export const prepareDataFreshnessData = (
  freshness: DataFreshnessMetric[],
  selectedFields: ReportField[]
): Record<string, any>[] => {
  const fieldsToExport = selectedFields.filter(field => field.selected)

  return freshness.map(item => {
    const exportItem: Record<string, any> = {}

    fieldsToExport.forEach(field => {
      const value = (item as any)[field.key]
      exportItem[field.label] = formatReportValue(value, field.format)
    })

    return exportItem
  })
}

export const prepareTrendAnalysisData = (
  trends: PerformanceTrend[],
  selectedFields: ReportField[]
): Record<string, any>[] => {
  const fieldsToExport = selectedFields.filter(field => field.selected)

  return trends.map(trend => {
    const exportItem: Record<string, any> = {}

    fieldsToExport.forEach(field => {
      let value: any

      switch (field.key) {
        case 'date':
          value = trend.date
          break
        case 'executions':
          value = trend.executions
          break
        case 'successes':
          value = trend.successes
          break
        case 'failures':
          value = trend.failures
          break
        case 'avgDuration':
          value = trend.avgDuration
          break
        case 'successRate':
          value = trend.successRate
          break
        default:
          value = (trend as any)[field.key]
      }

      exportItem[field.label] = formatReportValue(value, field.format)
    })

    return exportItem
  })
}

// Export to CSV
export const exportAnalyticsToCSV = async (
  config: ReportExportConfig,
  reportData: AnalyticsReportData
): Promise<boolean> => {
  try {
    let exportData: Record<string, any>[] = []

    switch (config.reportType) {
      case 'execution_history':
        if (reportData.data.executions) {
          exportData = prepareExecutionHistoryData(reportData.data.executions, config.fields)
        }
        break
      case 'performance_metrics':
        if (reportData.data.metrics) {
          exportData = preparePerformanceMetricsData(reportData.data.metrics, config.fields)
        }
        break
      case 'data_freshness':
        if (reportData.data.freshness) {
          exportData = prepareDataFreshnessData(reportData.data.freshness, config.fields)
        }
        break
      case 'trend_analysis':
        if (reportData.data.trends) {
          exportData = prepareTrendAnalysisData(reportData.data.trends, config.fields)
        }
        break
    }

    if (exportData.length === 0) {
      throw new Error('No data available for export')
    }

    const csv = Papa.unparse(exportData)
    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `${config.reportType}_${timestamp}.csv`

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', filename)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)

    return true
  } catch (error) {
    console.error('CSV export error:', error)
    return false
  }
}

// Export to Excel
export const exportAnalyticsToExcel = async (
  config: ReportExportConfig,
  reportData: AnalyticsReportData
): Promise<boolean> => {
  try {
    let exportData: Record<string, any>[] = []

    switch (config.reportType) {
      case 'execution_history':
        if (reportData.data.executions) {
          exportData = prepareExecutionHistoryData(reportData.data.executions, config.fields)
        }
        break
      case 'performance_metrics':
        if (reportData.data.metrics) {
          exportData = preparePerformanceMetricsData(reportData.data.metrics, config.fields)
        }
        break
      case 'data_freshness':
        if (reportData.data.freshness) {
          exportData = prepareDataFreshnessData(reportData.data.freshness, config.fields)
        }
        break
      case 'trend_analysis':
        if (reportData.data.trends) {
          exportData = prepareTrendAnalysisData(reportData.data.trends, config.fields)
        }
        break
    }

    if (exportData.length === 0) {
      throw new Error('No data available for export')
    }

    const worksheet = XLSX.utils.json_to_sheet(exportData)

    // Set column widths
    const colWidths = config.fields
      .filter(field => field.selected)
      .map(field => ({ wpx: Math.max(field.label.length * 10, 120) }))

    worksheet['!cols'] = colWidths

    const workbook = XLSX.utils.book_new()
    const sheetName = config.reportType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)

    // Add metadata sheet
    const metadataSheet = XLSX.utils.json_to_sheet([
      { Property: 'Report Type', Value: config.reportType },
      { Property: 'Generated At', Value: reportData.metadata.generatedAt },
      { Property: 'Time Range Start', Value: config.timeRange.start },
      { Property: 'Time Range End', Value: config.timeRange.end },
      { Property: 'Total Records', Value: reportData.metadata.totalRecords },
      { Property: 'Granularity', Value: config.timeRange.granularity }
    ])
    XLSX.utils.book_append_sheet(workbook, metadataSheet, 'Metadata')

    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `${config.reportType}_${timestamp}.xlsx`

    XLSX.writeFile(workbook, filename)
    return true
  } catch (error) {
    console.error('Excel export error:', error)
    return false
  }
}

// Export chart to image
export const exportChartToImage = async (
  chartConfig: ChartExportConfig
): Promise<string | null> => {
  try {
    const chartElement = document.getElementById(chartConfig.chartId)
    if (!chartElement) {
      throw new Error(`Chart element with ID ${chartConfig.chartId} not found`)
    }

    const canvas = await html2canvas(chartElement, {
      width: chartConfig.width,
      height: chartConfig.height,
      backgroundColor: '#ffffff',
      scale: 2
    })

    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Chart export error:', error)
    return null
  }
}

// Export to PDF
export const exportAnalyticsToPDF = async (
  config: ReportExportConfig,
  reportData: AnalyticsReportData,
  chartConfigs?: ChartExportConfig[]
): Promise<boolean> => {
  try {
    let exportData: Record<string, any>[] = []

    switch (config.reportType) {
      case 'execution_history':
        if (reportData.data.executions) {
          exportData = prepareExecutionHistoryData(reportData.data.executions, config.fields)
        }
        break
      case 'performance_metrics':
        if (reportData.data.metrics) {
          exportData = preparePerformanceMetricsData(reportData.data.metrics, config.fields)
        }
        break
      case 'data_freshness':
        if (reportData.data.freshness) {
          exportData = prepareDataFreshnessData(reportData.data.freshness, config.fields)
        }
        break
      case 'trend_analysis':
        if (reportData.data.trends) {
          exportData = prepareTrendAnalysisData(reportData.data.trends, config.fields)
        }
        break
    }

    if (exportData.length === 0) {
      throw new Error('No data available for export')
    }

    const doc = new jsPDF('p', 'mm', 'a4')
    let currentY = 20

    // Add header
    doc.setFontSize(18)
    doc.setFont('helvetica', 'bold')
    const title = config.reportType.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) + ' Report'
    doc.text(title, 20, currentY)
    currentY += 10

    // Add metadata
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Generated: ${new Date(reportData.metadata.generatedAt).toLocaleString()}`, 20, currentY)
    currentY += 5
    doc.text(`Time Range: ${new Date(config.timeRange.start).toLocaleDateString()} - ${new Date(config.timeRange.end).toLocaleDateString()}`, 20, currentY)
    currentY += 5
    doc.text(`Total Records: ${reportData.metadata.totalRecords}`, 20, currentY)
    currentY += 10

    // Add summary if available
    if (reportData.data.summary) {
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('Summary', 20, currentY)
      currentY += 5

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const summary = reportData.data.summary
      doc.text(`Total Workflows: ${summary.totalWorkflows}`, 20, currentY)
      currentY += 4
      doc.text(`Total Executions: ${summary.totalExecutions}`, 20, currentY)
      currentY += 4
      doc.text(`Overall Success Rate: ${(summary.overallSuccessRate * 100).toFixed(1)}%`, 20, currentY)
      currentY += 4
      doc.text(`Average Execution Time: ${formatDuration(summary.avgExecutionTime)}`, 20, currentY)
      currentY += 10
    }

    // Add charts if provided
    if (chartConfigs && chartConfigs.length > 0 && config.filters?.includeCharts) {
      for (const chartConfig of chartConfigs) {
        if (currentY > 250) {
          doc.addPage()
          currentY = 20
        }

        const chartImage = await exportChartToImage(chartConfig)
        if (chartImage) {
          doc.setFontSize(10)
          doc.setFont('helvetica', 'bold')
          doc.text(chartConfig.title, 20, currentY)
          currentY += 10

          const imgWidth = 170
          const imgHeight = (chartConfig.height / chartConfig.width) * imgWidth

          if (currentY + imgHeight > 280) {
            doc.addPage()
            currentY = 20
          }

          doc.addImage(chartImage, 'PNG', 20, currentY, imgWidth, imgHeight)
          currentY += imgHeight + 10
        }
      }
    }

    // Add data table
    if (currentY > 200) {
      doc.addPage()
      currentY = 20
    }

    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('Data', 20, currentY)
    currentY += 10

    // Prepare table data
    const selectedFieldLabels = config.fields
      .filter(field => field.selected)
      .map(field => field.label)

    const tableRows = exportData.map(item =>
      selectedFieldLabels.map(label => String(item[label] || 'N/A'))
    )

    // Add table
    doc.autoTable({
      head: [selectedFieldLabels],
      body: tableRows,
      startY: currentY,
      styles: {
        fontSize: 7,
        cellPadding: 1.5
      },
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontStyle: 'bold'
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      margin: { top: currentY, left: 20, right: 20 },
      tableWidth: 'wrap',
      columnStyles: {}
    })

    const timestamp = new Date().toISOString().slice(0, 10)
    const filename = `${config.reportType}_${timestamp}.pdf`

    doc.save(filename)
    return true
  } catch (error) {
    console.error('PDF export error:', error)
    return false
  }
}

// Main export function
export const exportAnalyticsReport = async (
  config: ReportExportConfig,
  reportData: AnalyticsReportData,
  chartConfigs?: ChartExportConfig[]
): Promise<boolean> => {
  try {
    switch (config.format) {
      case 'csv':
        return await exportAnalyticsToCSV(config, reportData)
      case 'excel':
        return await exportAnalyticsToExcel(config, reportData)
      case 'pdf':
        return await exportAnalyticsToPDF(config, reportData, chartConfigs)
      default:
        throw new Error(`Unsupported format: ${config.format}`)
    }
  } catch (error) {
    console.error('Report export error:', error)
    return false
  }
}

// Utility to get estimated file size
export const getAnalyticsExportStats = (
  config: ReportExportConfig,
  reportData: AnalyticsReportData
) => {
  const selectedFieldCount = config.fields.filter(field => field.selected).length
  const totalRecords = reportData.metadata.totalRecords

  return {
    selectedFields: selectedFieldCount,
    totalFields: config.fields.length,
    totalRecords,
    estimatedFileSize: {
      csv: Math.round((totalRecords * selectedFieldCount * 25) / 1024), // KB estimate
      excel: Math.round((totalRecords * selectedFieldCount * 30) / 1024), // KB estimate
      pdf: Math.round((totalRecords * selectedFieldCount * 35) / 1024) // KB estimate
    },
    timeRange: config.timeRange,
    reportType: config.reportType
  }
}

// Generate sample analytics data for testing
export const generateSampleAnalyticsData = (
  reportType: string,
  timeRange: AnalyticsTimeRange
): AnalyticsReportData => {
  const now = new Date()
  const start = new Date(timeRange.start)
  const end = new Date(timeRange.end)

  const sampleData: AnalyticsReportData = {
    metadata: {
      reportType,
      timeRange,
      generatedAt: now.toISOString(),
      totalRecords: 0
    },
    data: {}
  }

  // Generate sample data based on report type
  switch (reportType) {
    case 'execution_history':
      sampleData.data.executions = generateSampleExecutions(10)
      sampleData.metadata.totalRecords = 10
      break
    case 'performance_metrics':
      sampleData.data.metrics = generateSampleMetrics(5)
      sampleData.metadata.totalRecords = 5
      break
    case 'data_freshness':
      sampleData.data.freshness = generateSampleFreshness(5)
      sampleData.metadata.totalRecords = 5
      break
    case 'trend_analysis':
      sampleData.data.trends = generateSampleTrends(30)
      sampleData.metadata.totalRecords = 30
      break
  }

  // Add summary
  sampleData.data.summary = {
    totalWorkflows: 5,
    totalExecutions: 100,
    overallSuccessRate: 0.85,
    avgExecutionTime: 45000,
    activeWorkflows: 4
  }

  return sampleData
}

// Helper functions for sample data generation
const generateSampleExecutions = (count: number): WorkflowExecution[] => {
  const executions: WorkflowExecution[] = []
  const statuses: Array<'success' | 'error' | 'running'> = ['success', 'error', 'running']

  for (let i = 0; i < count; i++) {
    const startedAt = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString()
    const stoppedAt = new Date(new Date(startedAt).getTime() + Math.random() * 60 * 60 * 1000).toISOString()

    executions.push({
      id: `exec_${i + 1}`,
      workflowId: `workflow_${Math.floor(i / 2) + 1}`,
      mode: 'trigger',
      startedAt,
      stoppedAt,
      finished: true,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      workflowData: {
        id: `workflow_${Math.floor(i / 2) + 1}`,
        name: `Sample Workflow ${Math.floor(i / 2) + 1}`,
        active: true,
        nodes: [],
        connections: {},
        settings: {}
      }
    } as WorkflowExecution)
  }

  return executions
}

const generateSampleMetrics = (count: number): ExecutionMetrics[] => {
  const metrics: ExecutionMetrics[] = []

  for (let i = 0; i < count; i++) {
    const totalExecutions = Math.floor(Math.random() * 50) + 10
    const successfulExecutions = Math.floor(totalExecutions * (0.7 + Math.random() * 0.3))

    metrics.push({
      workflowId: `workflow_${i + 1}`,
      workflowName: `Sample Workflow ${i + 1}`,
      totalExecutions,
      successfulExecutions,
      failedExecutions: totalExecutions - successfulExecutions,
      avgDuration: Math.floor(Math.random() * 120000) + 5000,
      lastExecution: new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString(),
      successRate: successfulExecutions / totalExecutions,
      errorRate: (totalExecutions - successfulExecutions) / totalExecutions,
      trendDirection: Math.random() > 0.5 ? 'up' : 'down'
    })
  }

  return metrics
}

const generateSampleFreshness = (count: number): DataFreshnessMetric[] => {
  const freshness: DataFreshnessMetric[] = []
  const statuses: Array<'fresh' | 'stale' | 'critical'> = ['fresh', 'stale', 'critical']

  for (let i = 0; i < count; i++) {
    const dataAge = Math.floor(Math.random() * 72)

    freshness.push({
      workflowId: `workflow_${i + 1}`,
      workflowName: `Sample Workflow ${i + 1}`,
      lastSuccessfulExecution: new Date(Date.now() - dataAge * 60 * 60 * 1000).toISOString(),
      dataAge,
      freshnessStatus: statuses[Math.floor(Math.random() * statuses.length)],
      expectedFrequency: 'daily',
      nextExpectedRun: new Date(Date.now() + Math.random() * 24 * 60 * 60 * 1000).toISOString()
    })
  }

  return freshness
}

const generateSampleTrends = (count: number): PerformanceTrend[] => {
  const trends: PerformanceTrend[] = []

  for (let i = 0; i < count; i++) {
    const date = new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000)
    const executions = Math.floor(Math.random() * 20) + 5
    const successes = Math.floor(executions * (0.7 + Math.random() * 0.3))

    trends.push({
      date: date.toISOString().split('T')[0],
      executions,
      successes,
      failures: executions - successes,
      avgDuration: Math.floor(Math.random() * 60000) + 10000,
      successRate: successes / executions
    })
  }

  return trends
}