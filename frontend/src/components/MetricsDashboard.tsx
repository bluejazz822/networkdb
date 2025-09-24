import React, { useState, useCallback, useEffect } from 'react'
import {
  Card,
  Row,
  Col,
  Space,
  Button,
  Typography,
  Select,
  DatePicker,
  Tabs,
  Spin,
  message,
  Divider,
  Statistic,
  Alert
} from 'antd'
import {
  BarChartOutlined,
  LineChartOutlined,
  DownloadOutlined,
  ReloadOutlined,
  CalendarOutlined,
  DashboardOutlined,
  ExportOutlined,
  HistoryOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import ExecutionMetricsChart from './ExecutionMetricsChart'
import TrendAnalysisChart from './TrendAnalysisChart'
import WorkflowHistoryModal from './WorkflowHistoryModal'
import ReportExportModal from './ReportExportModal'
import { useAnalyticsDashboard, useAnalyticsDateRange } from '@/hooks/useAnalyticsData'
import {
  AnalyticsTimeRange,
  ExecutionMetrics,
  PerformanceTrend,
  ChartExportConfig
} from '@/types/workflow'

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { Option } = Select
const { TabPane } = Tabs

export interface MetricsDashboardProps {
  workflowId?: string
  workflowName?: string
  height?: number
  showControls?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
  onWorkflowSelect?: (workflowId: string) => void
}

export default function MetricsDashboard({
  workflowId,
  workflowName,
  height = 400,
  showControls = true,
  autoRefresh = false,
  refreshInterval = 5 * 60 * 1000, // 5 minutes
  onWorkflowSelect
}: MetricsDashboardProps) {
  const [activeTab, setActiveTab] = useState('overview')
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [selectedWorkflowForHistory, setSelectedWorkflowForHistory] = useState<string | null>(null)

  // Date range management
  const {
    dateRange,
    selectedPreset,
    applyPreset,
    setCustomRange
  } = useAnalyticsDateRange()

  // Analytics time range for API calls
  const analyticsTimeRange: AnalyticsTimeRange = {
    start: dateRange.startDate,
    end: dateRange.endDate,
    granularity: 'day'
  }

  // Fetch analytics dashboard data
  const {
    dashboard,
    isLoading,
    isError,
    error,
    refetch,
    isFetching
  } = useAnalyticsDashboard({
    filters: {
      workflowId,
      dateRange,
      includeMetrics: true,
      aggregateBy: 'workflow'
    },
    enabled: true,
    refetchInterval: autoRefresh ? refreshInterval : false
  })

  // Handle date range changes
  const handleDateRangeChange = useCallback((dates: any) => {
    if (dates && dates.length === 2) {
      const newRange = {
        startDate: dates[0].format('YYYY-MM-DD'),
        endDate: dates[1].format('YYYY-MM-DD')
      }
      setCustomRange(newRange)
    }
  }, [setCustomRange])

  const handlePresetChange = useCallback((preset: string) => {
    applyPreset(preset)
  }, [applyPreset])

  // Handle workflow drill-down
  const handleWorkflowClick = useCallback((clickedWorkflowId: string) => {
    if (onWorkflowSelect) {
      onWorkflowSelect(clickedWorkflowId)
    } else {
      setSelectedWorkflowForHistory(clickedWorkflowId)
      setShowHistoryModal(true)
    }
  }, [onWorkflowSelect])

  // Handle export functionality
  const handleExportRequest = useCallback(() => {
    setShowExportModal(true)
  }, [])

  const handleExport = useCallback((config: any) => {
    message.success('Report export initiated')
    setShowExportModal(false)
  }, [])

  // Refresh handler
  const handleRefresh = useCallback(() => {
    refetch()
    message.success('Dashboard data refreshed')
  }, [refetch])

  // Transform dashboard data for components
  const executionMetrics: ExecutionMetrics[] = dashboard?.metrics || []
  const trendData: PerformanceTrend[] = dashboard?.trends || []

  // Calculate summary statistics
  const summaryStats = React.useMemo(() => {
    if (!executionMetrics.length) {
      return {
        totalExecutions: 0,
        overallSuccessRate: 0,
        avgDuration: 0,
        activeWorkflows: 0,
        healthyWorkflows: 0
      }
    }

    const totals = executionMetrics.reduce((acc, metric) => ({
      totalExecutions: acc.totalExecutions + metric.totalExecutions,
      successfulExecutions: acc.successfulExecutions + metric.successfulExecutions,
      totalDuration: acc.totalDuration + (metric.avgDuration * metric.totalExecutions)
    }), { totalExecutions: 0, successfulExecutions: 0, totalDuration: 0 })

    const overallSuccessRate = totals.totalExecutions > 0
      ? Math.round((totals.successfulExecutions / totals.totalExecutions) * 100)
      : 0

    const avgDuration = totals.totalExecutions > 0
      ? Math.round(totals.totalDuration / totals.totalExecutions)
      : 0

    return {
      totalExecutions: totals.totalExecutions,
      overallSuccessRate,
      avgDuration,
      activeWorkflows: executionMetrics.length,
      healthyWorkflows: executionMetrics.filter(m => m.successRate >= 90).length
    }
  }, [executionMetrics])

  // Chart export configurations
  const chartConfigs: ChartExportConfig[] = [
    {
      id: 'execution-metrics',
      name: 'Execution Metrics',
      type: 'column',
      data: executionMetrics
    },
    {
      id: 'trend-analysis',
      name: 'Trend Analysis',
      type: 'line',
      data: trendData
    }
  ]

  const renderControls = () => {
    if (!showControls) return null

    return (
      <Space wrap style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>Time Range:</Text>
          <Select
            value={selectedPreset}
            onChange={handlePresetChange}
            style={{ width: 120 }}
            size="small"
          >
            <Option value="last7d">Last 7 Days</Option>
            <Option value="last30d">Last 30 Days</Option>
            <Option value="last90d">Last 90 Days</Option>
            <Option value="custom">Custom</Option>
          </Select>
          {selectedPreset === 'custom' && (
            <RangePicker
              value={[dayjs(dateRange.startDate), dayjs(dateRange.endDate)]}
              onChange={handleDateRangeChange}
              size="small"
              format="YYYY-MM-DD"
            />
          )}
        </Space>

        <Space>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={isFetching}
          >
            Refresh
          </Button>
          <Button
            size="small"
            icon={<ExportOutlined />}
            onClick={handleExportRequest}
          >
            Export Report
          </Button>
        </Space>
      </Space>
    )
  }

  const renderSummaryCards = () => (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      <Col xs={24} sm={12} lg={6}>
        <Card size="small" style={{ height: '100%' }}>
          <Statistic
            title="Total Executions"
            value={summaryStats.totalExecutions}
            prefix={<BarChartOutlined />}
            valueStyle={{ color: '#1890ff' }}
            loading={isLoading}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card size="small" style={{ height: '100%' }}>
          <Statistic
            title="Success Rate"
            value={summaryStats.overallSuccessRate}
            suffix="%"
            prefix={<LineChartOutlined />}
            valueStyle={{
              color: summaryStats.overallSuccessRate >= 90 ? '#52c41a' :
                     summaryStats.overallSuccessRate >= 70 ? '#faad14' : '#ff4d4f'
            }}
            loading={isLoading}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card size="small" style={{ height: '100%' }}>
          <Statistic
            title="Avg Duration"
            value={`${(summaryStats.avgDuration / 1000).toFixed(1)}s`}
            prefix={<CalendarOutlined />}
            valueStyle={{ color: '#722ed1' }}
            loading={isLoading}
          />
        </Card>
      </Col>
      <Col xs={24} sm={12} lg={6}>
        <Card size="small" style={{ height: '100%' }}>
          <Statistic
            title="Healthy Workflows"
            value={`${summaryStats.healthyWorkflows}/${summaryStats.activeWorkflows}`}
            prefix={<DashboardOutlined />}
            valueStyle={{ color: '#52c41a' }}
            loading={isLoading}
          />
        </Card>
      </Col>
    </Row>
  )

  if (isError) {
    return (
      <Alert
        message="Failed to Load Analytics Data"
        description={error?.message || 'An unexpected error occurred while loading the analytics dashboard.'}
        type="error"
        showIcon
        action={
          <Button size="small" onClick={handleRefresh}>
            Retry
          </Button>
        }
      />
    )
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <Title level={3} style={{ margin: 0 }}>
          <Space>
            <DashboardOutlined />
            Performance Analytics Dashboard
            {workflowName && <Text type="secondary">- {workflowName}</Text>}
          </Space>
        </Title>
        <Text type="secondary">
          Historical reporting and analytics for workflow execution performance
        </Text>
      </div>

      {renderControls()}
      {renderSummaryCards()}

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane
          tab={
            <Space>
              <BarChartOutlined />
              Execution Metrics
            </Space>
          }
          key="overview"
        >
          <ExecutionMetricsChart
            metrics={executionMetrics}
            loading={isLoading}
            height={height}
            title="Workflow Execution Metrics"
            onRefresh={handleRefresh}
            onExport={handleExportRequest}
            onWorkflowClick={handleWorkflowClick}
            showComparison={false}
            autoRefresh={autoRefresh}
            refreshInterval={refreshInterval}
          />
        </TabPane>

        <TabPane
          tab={
            <Space>
              <LineChartOutlined />
              Trend Analysis
            </Space>
          }
          key="trends"
        >
          <TrendAnalysisChart
            data={trendData}
            loading={isLoading}
            height={height}
            title="Performance Trends Over Time"
            timeRange={analyticsTimeRange}
            onRefresh={handleRefresh}
            onExport={handleExportRequest}
            showControls={false} // Controls are handled at dashboard level
          />
        </TabPane>

        <TabPane
          tab={
            <Space>
              <HistoryOutlined />
              Data Freshness
            </Space>
          }
          key="freshness"
        >
          <Card loading={isLoading}>
            <Title level={4}>Data Freshness Monitoring</Title>
            <Text type="secondary">
              Monitor data freshness and identify workflows that haven't executed within expected timeframes.
            </Text>

            <Divider />

            <Row gutter={[16, 16]}>
              {executionMetrics.map((metric, index) => {
                const lastExecuted = dayjs(metric.lastExecution)
                const hoursAgo = dayjs().diff(lastExecuted, 'hour')
                const isStale = hoursAgo > 24 // Consider stale if no execution in 24 hours

                return (
                  <Col xs={24} sm={12} lg={8} key={metric.workflowId}>
                    <Card
                      size="small"
                      title={metric.workflowName}
                      extra={
                        isStale ? (
                          <Alert message="Stale" type="warning" size="small" showIcon={false} />
                        ) : (
                          <Alert message="Fresh" type="success" size="small" showIcon={false} />
                        )
                      }
                    >
                      <Space direction="vertical" size="small" style={{ width: '100%' }}>
                        <div>
                          <Text strong>Last Execution:</Text>
                          <br />
                          <Text type={isStale ? 'warning' : 'secondary'}>
                            {lastExecuted.format('MMM DD, YYYY HH:mm')} ({hoursAgo}h ago)
                          </Text>
                        </div>
                        <div>
                          <Text strong>Success Rate:</Text>
                          <br />
                          <Text style={{
                            color: metric.successRate >= 90 ? '#52c41a' :
                                   metric.successRate >= 70 ? '#faad14' : '#ff4d4f'
                          }}>
                            {metric.successRate}%
                          </Text>
                        </div>
                      </Space>
                    </Card>
                  </Col>
                )
              })}
            </Row>

            {executionMetrics.length === 0 && !isLoading && (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Text type="secondary">No workflow data available for the selected time range</Text>
              </div>
            )}
          </Card>
        </TabPane>
      </Tabs>

      {/* Execution History Modal */}
      <WorkflowHistoryModal
        visible={showHistoryModal}
        workflowId={selectedWorkflowForHistory}
        workflowName={
          selectedWorkflowForHistory
            ? executionMetrics.find(m => m.workflowId === selectedWorkflowForHistory)?.workflowName
            : undefined
        }
        onCancel={() => {
          setShowHistoryModal(false)
          setSelectedWorkflowForHistory(null)
        }}
      />

      {/* Export Modal */}
      <ReportExportModal
        visible={showExportModal}
        onCancel={() => setShowExportModal(false)}
        reportData={{
          executionHistory: [],
          performanceMetrics: executionMetrics,
          trendData,
          dataFreshness: []
        }}
        availableCharts={chartConfigs}
        onExport={handleExport}
      />
    </div>
  )
}