import React, { useMemo, useState, useCallback } from 'react'
import { Scatter, Heatmap, Radar, Liquid, Progress as G2Progress } from '@ant-design/plots'
import { Row, Col, Card, Statistic, Select, Space, Button, Typography, Tooltip, Tag, Progress, Alert } from 'antd'
import {
  ThunderboltOutlined,
  ClockCircleOutlined,
  BugOutlined,
  TrophyOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  DashboardOutlined,
  HeatMapOutlined,
  DotChartOutlined,
  RadarChartOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import BaseChart, {
  getChartTheme,
  getResponsiveConfig,
  getAxisConfig,
  getLegendConfig,
  formatDuration,
  formatPercentage,
  getStatusColor
} from './BaseChart'
import { ExecutionMetrics, DataFreshnessMetric, WorkflowExecution } from '../types/workflow'

const { Text, Title } = Typography
const { Option } = Select

export interface WorkflowPerformanceChartProps {
  metrics: ExecutionMetrics[]
  freshnessData?: DataFreshnessMetric[]
  recentExecutions?: WorkflowExecution[]
  loading?: boolean
  error?: string | null
  height?: number
  title?: string
  onRefresh?: () => void
  onExport?: () => void
  onWorkflowClick?: (workflowId: string) => void
  className?: string
  style?: React.CSSProperties
  showAlerts?: boolean
  compactMode?: boolean
  performanceThresholds?: PerformanceThresholds
}

export interface PerformanceThresholds {
  successRateWarning: number
  successRateCritical: number
  durationWarning: number // in ms
  durationCritical: number // in ms
  freshnessWarning: number // in hours
  freshnessCritical: number // in hours
}

export type PerformanceViewType = 'scatter' | 'heatmap' | 'radar' | 'alerts' | 'freshness'

const DEFAULT_THRESHOLDS: PerformanceThresholds = {
  successRateWarning: 90,
  successRateCritical: 80,
  durationWarning: 5000,
  durationCritical: 10000,
  freshnessWarning: 25,
  freshnessCritical: 48
}

// Mock data generators
export const generateMockFreshnessData = (): DataFreshnessMetric[] => {
  const workflows = [
    'Network Device Discovery',
    'VPC Configuration Sync',
    'Compliance Report Generator',
    'Backup Monitoring',
    'Alert Notification Service',
    'Performance Analytics'
  ]

  return workflows.map((name, index) => {
    const hoursAgo = Math.random() * 72 // 0-72 hours ago
    const lastExecution = dayjs().subtract(hoursAgo, 'hour').toISOString()
    const expectedFrequency = ['1 hour', '4 hours', '12 hours', '24 hours'][Math.floor(Math.random() * 4)]

    let freshnessStatus: 'fresh' | 'stale' | 'critical'
    if (hoursAgo < 6) freshnessStatus = 'fresh'
    else if (hoursAgo < 24) freshnessStatus = 'stale'
    else freshnessStatus = 'critical'

    return {
      workflowId: `workflow-${index + 1}`,
      workflowName: name,
      lastSuccessfulExecution: lastExecution,
      dataAge: Math.round(hoursAgo),
      freshnessStatus,
      expectedFrequency,
      nextExpectedRun: dayjs().add(Math.random() * 24, 'hour').toISOString()
    }
  })
}

export default function WorkflowPerformanceChart({
  metrics = [],
  freshnessData = [],
  recentExecutions = [],
  loading = false,
  error = null,
  height = 400,
  title = 'Workflow Performance',
  onRefresh,
  onExport,
  onWorkflowClick,
  className,
  style,
  showAlerts = true,
  compactMode = false,
  performanceThresholds = DEFAULT_THRESHOLDS
}: WorkflowPerformanceChartProps) {
  const [viewType, setViewType] = useState<PerformanceViewType>('scatter')

  // Use mock data if no real data provided
  const performanceData = useMemo(() => {
    if (metrics.length === 0) {
      // Generate mock metrics data
      const mockMetrics: ExecutionMetrics[] = [
        {
          workflowId: 'workflow-1',
          workflowName: 'Network Discovery',
          totalExecutions: 150,
          successfulExecutions: 145,
          failedExecutions: 5,
          avgDuration: 2500,
          successRate: 97,
          errorRate: 3,
          trendDirection: 'up',
          lastExecution: dayjs().subtract(2, 'hour').toISOString()
        },
        {
          workflowId: 'workflow-2',
          workflowName: 'VPC Sync',
          totalExecutions: 89,
          successfulExecutions: 82,
          failedExecutions: 7,
          avgDuration: 4200,
          successRate: 92,
          errorRate: 8,
          trendDirection: 'stable',
          lastExecution: dayjs().subtract(1, 'hour').toISOString()
        },
        {
          workflowId: 'workflow-3',
          workflowName: 'Compliance Check',
          totalExecutions: 45,
          successfulExecutions: 35,
          failedExecutions: 10,
          avgDuration: 8500,
          successRate: 78,
          errorRate: 22,
          trendDirection: 'down',
          lastExecution: dayjs().subtract(6, 'hour').toISOString()
        }
      ]
      return mockMetrics
    }
    return metrics
  }, [metrics])

  const freshnessMetrics = useMemo(() => {
    if (freshnessData.length === 0) {
      return generateMockFreshnessData()
    }
    return freshnessData
  }, [freshnessData])

  // Performance analysis
  const performanceAnalysis = useMemo(() => {
    const alerts = []
    const healthyWorkflows = []
    const problematicWorkflows = []

    performanceData.forEach(metric => {
      const issues = []

      // Success rate analysis
      if (metric.successRate < performanceThresholds.successRateCritical) {
        issues.push({ type: 'critical', message: `Low success rate: ${metric.successRate}%` })
      } else if (metric.successRate < performanceThresholds.successRateWarning) {
        issues.push({ type: 'warning', message: `Below target success rate: ${metric.successRate}%` })
      }

      // Duration analysis
      if (metric.avgDuration > performanceThresholds.durationCritical) {
        issues.push({ type: 'critical', message: `Very slow execution: ${formatDuration(metric.avgDuration)}` })
      } else if (metric.avgDuration > performanceThresholds.durationWarning) {
        issues.push({ type: 'warning', message: `Slow execution: ${formatDuration(metric.avgDuration)}` })
      }

      // Freshness analysis
      const freshnessMetric = freshnessMetrics.find(f => f.workflowId === metric.workflowId)
      if (freshnessMetric) {
        if (freshnessMetric.dataAge > performanceThresholds.freshnessCritical) {
          issues.push({ type: 'critical', message: `Stale data: ${freshnessMetric.dataAge}h old` })
        } else if (freshnessMetric.dataAge > performanceThresholds.freshnessWarning) {
          issues.push({ type: 'warning', message: `Data aging: ${freshnessMetric.dataAge}h old` })
        }
      }

      if (issues.length === 0) {
        healthyWorkflows.push(metric)
      } else {
        problematicWorkflows.push({ ...metric, issues })
        alerts.push(...issues.map(issue => ({
          ...issue,
          workflowId: metric.workflowId,
          workflowName: metric.workflowName
        })))
      }
    })

    return {
      alerts,
      healthyWorkflows,
      problematicWorkflows,
      overallHealth: (healthyWorkflows.length / performanceData.length) * 100
    }
  }, [performanceData, freshnessMetrics, performanceThresholds])

  // Transform data for different chart types
  const scatterData = useMemo(() => {
    return performanceData.map(metric => ({
      x: metric.avgDuration,
      y: metric.successRate,
      size: Math.log(metric.totalExecutions + 1) * 3,
      workflow: metric.workflowName,
      workflowId: metric.workflowId,
      executions: metric.totalExecutions,
      status: metric.successRate >= performanceThresholds.successRateWarning ? 'good' :
              metric.successRate >= performanceThresholds.successRateCritical ? 'warning' : 'critical'
    }))
  }, [performanceData, performanceThresholds])

  const heatmapData = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => i)
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

    return days.flatMap(day =>
      hours.map(hour => ({
        day,
        hour: `${hour}:00`,
        value: Math.floor(Math.random() * 100),
        executions: Math.floor(Math.random() * 50)
      }))
    )
  }, [])

  const radarData = useMemo(() => {
    return performanceData.map(metric => {
      const normalizedDuration = Math.max(0, 100 - (metric.avgDuration / 10000) * 100)
      const volumeScore = Math.min(100, (metric.totalExecutions / 200) * 100)
      const reliabilityScore = metric.successRate
      const freshnessMetric = freshnessMetrics.find(f => f.workflowId === metric.workflowId)
      const freshnessScore = freshnessMetric
        ? Math.max(0, 100 - (freshnessMetric.dataAge / 72) * 100)
        : 50

      return [
        { metric: 'Success Rate', value: reliabilityScore, workflow: metric.workflowName },
        { metric: 'Performance', value: normalizedDuration, workflow: metric.workflowName },
        { metric: 'Volume', value: volumeScore, workflow: metric.workflowName },
        { metric: 'Freshness', value: freshnessScore, workflow: metric.workflowName }
      ]
    }).flat()
  }, [performanceData, freshnessMetrics])

  // Chart configurations
  const scatterConfig = useMemo(() => ({
    ...getResponsiveConfig(height),
    data: scatterData,
    xField: 'x',
    yField: 'y',
    sizeField: 'size',
    colorField: 'status',
    color: (datum: any) => getStatusColor(datum.status),
    size: [4, 20],
    shape: 'circle',
    pointStyle: {
      fillOpacity: 0.7,
      stroke: '#fff',
      lineWidth: 1
    },
    xAxis: {
      ...getAxisConfig().x,
      title: { text: 'Average Duration (ms)' }
    },
    yAxis: {
      ...getAxisConfig().y,
      title: { text: 'Success Rate (%)' },
      min: 0,
      max: 100
    },
    tooltip: {
      formatter: (datum: any) => [
        { name: 'Workflow', value: datum.workflow },
        { name: 'Success Rate', value: `${datum.y}%` },
        { name: 'Avg Duration', value: formatDuration(datum.x) },
        { name: 'Total Executions', value: datum.executions }
      ]
    },
    theme: getChartTheme(),
    quadrant: {
      xBaseline: performanceThresholds.durationWarning,
      yBaseline: performanceThresholds.successRateWarning,
      labels: [
        { content: 'Fast & Reliable', position: 'top-left' },
        { content: 'Slow & Reliable', position: 'top-right' },
        { content: 'Fast & Unreliable', position: 'bottom-left' },
        { content: 'Slow & Unreliable', position: 'bottom-right' }
      ]
    }
  }), [scatterData, height, performanceThresholds])

  const heatmapConfig = useMemo(() => ({
    ...getResponsiveConfig(height),
    data: heatmapData,
    xField: 'hour',
    yField: 'day',
    colorField: 'value',
    color: ['#BAE7FF', '#1890FF', '#0050B3'],
    sizeRatio: 0.8,
    tooltip: {
      formatter: (datum: any) => ({
        name: 'Executions',
        value: datum.executions
      })
    },
    xAxis: {
      label: { style: { fontSize: 10 } }
    },
    yAxis: {
      label: { style: { fontSize: 12 } }
    },
    theme: getChartTheme()
  }), [heatmapData, height])

  const radarConfig = useMemo(() => ({
    ...getResponsiveConfig(height),
    data: radarData,
    xField: 'metric',
    yField: 'value',
    seriesField: 'workflow',
    color: getChartTheme().colors,
    point: { size: 3 },
    area: { style: { fillOpacity: 0.1 } },
    line: { style: { lineWidth: 2 } },
    legend: getLegendConfig(),
    xAxis: {
      label: { style: { fontSize: 12 } },
      grid: { line: { style: { lineDash: [0, 0] } } }
    },
    yAxis: {
      label: false,
      grid: {
        line: {
          type: 'line',
          style: { lineDash: [0, 0] }
        }
      },
      min: 0,
      max: 100
    },
    theme: getChartTheme()
  }), [radarData, height])

  const renderChart = () => {
    switch (viewType) {
      case 'scatter':
        return <Scatter {...scatterConfig} />
      case 'heatmap':
        return <Heatmap {...heatmapConfig} />
      case 'radar':
        return <Radar {...radarConfig} />
      case 'freshness':
        return renderFreshnessView()
      case 'alerts':
        return renderAlertsView()
      default:
        return <Scatter {...scatterConfig} />
    }
  }

  const renderFreshnessView = () => (
    <Row gutter={[16, 16]}>
      {freshnessMetrics.map(metric => {
        const freshnessPercentage = Math.max(0, 100 - (metric.dataAge / 72) * 100)
        const status = metric.freshnessStatus === 'fresh' ? 'success' :
                      metric.freshnessStatus === 'stale' ? 'warning' : 'error'

        return (
          <Col xs={24} sm={12} lg={8} key={metric.workflowId}>
            <Card size="small" hoverable onClick={() => onWorkflowClick?.(metric.workflowId)}>
              <div style={{ textAlign: 'center' }}>
                <Title level={5} style={{ margin: '0 0 8px 0', fontSize: 14 }}>
                  {metric.workflowName}
                </Title>
                <Progress
                  type="circle"
                  size={80}
                  percent={freshnessPercentage}
                  status={status}
                  format={() => `${metric.dataAge}h`}
                  strokeColor={getStatusColor(metric.freshnessStatus)}
                />
                <div style={{ marginTop: 8 }}>
                  <Tag color={getStatusColor(metric.freshnessStatus)}>
                    {metric.freshnessStatus.toUpperCase()}
                  </Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Expected: {metric.expectedFrequency}
                  </Text>
                </div>
              </div>
            </Card>
          </Col>
        )
      })}
    </Row>
  )

  const renderAlertsView = () => (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <Alert
            message={`Overall System Health: ${performanceAnalysis.overallHealth.toFixed(1)}%`}
            description={`${performanceAnalysis.healthyWorkflows.length} workflows healthy, ${performanceAnalysis.problematicWorkflows.length} need attention`}
            type={performanceAnalysis.overallHealth >= 80 ? 'success' : performanceAnalysis.overallHealth >= 60 ? 'warning' : 'error'}
            showIcon
          />
        </Col>
      </Row>

      {performanceAnalysis.alerts.length > 0 ? (
        <Row gutter={[16, 16]}>
          {performanceAnalysis.alerts.map((alert, index) => (
            <Col xs={24} sm={12} lg={8} key={index}>
              <Card
                size="small"
                title={
                  <Space>
                    {alert.type === 'critical' ? <BugOutlined style={{ color: '#ff4d4f' }} /> :
                     <WarningOutlined style={{ color: '#faad14' }} />}
                    <Text strong>{alert.workflowName}</Text>
                  </Space>
                }
                hoverable
                onClick={() => onWorkflowClick?.(alert.workflowId)}
              >
                <Text type={alert.type === 'critical' ? 'danger' : 'warning'}>
                  {alert.message}
                </Text>
              </Card>
            </Col>
          ))}
        </Row>
      ) : (
        <Card>
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a', marginBottom: 16 }} />
            <Title level={4}>All Workflows Healthy</Title>
            <Text type="secondary">No performance issues detected</Text>
          </div>
        </Card>
      )}
    </div>
  )

  const renderSummaryCards = () => {
    if (compactMode) return null

    return (
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Health Score"
              value={performanceAnalysis.overallHealth.toFixed(1)}
              suffix="%"
              prefix={<TrophyOutlined />}
              valueStyle={{
                color: performanceAnalysis.overallHealth >= 80 ? '#52c41a' :
                       performanceAnalysis.overallHealth >= 60 ? '#faad14' : '#ff4d4f'
              }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Critical Issues"
              value={performanceAnalysis.alerts.filter(a => a.type === 'critical').length}
              prefix={<BugOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Warnings"
              value={performanceAnalysis.alerts.filter(a => a.type === 'warning').length}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic
              title="Healthy Workflows"
              value={performanceAnalysis.healthyWorkflows.length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>
    )
  }

  const renderControls = () => (
    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col xs={24} sm={12} md={8}>
        <Space>
          <Text strong>View:</Text>
          <Select
            value={viewType}
            onChange={setViewType}
            style={{ width: 150 }}
            size="small"
          >
            <Option value="scatter">
              <DotChartOutlined /> Performance Map
            </Option>
            <Option value="radar">
              <RadarChartOutlined /> Multi-dimensional
            </Option>
            <Option value="heatmap">
              <HeatMapOutlined /> Execution Heatmap
            </Option>
            <Option value="freshness">
              <ClockCircleOutlined /> Data Freshness
            </Option>
            <Option value="alerts">
              <WarningOutlined /> Alerts & Issues
            </Option>
          </Select>
        </Space>
      </Col>
    </Row>
  )

  const getViewDescription = () => {
    switch (viewType) {
      case 'scatter':
        return 'Performance scatter plot showing duration vs success rate'
      case 'radar':
        return 'Multi-dimensional performance analysis'
      case 'heatmap':
        return 'Execution patterns by time of day and day of week'
      case 'freshness':
        return 'Data freshness metrics for each workflow'
      case 'alerts':
        return 'Performance alerts and system health overview'
      default:
        return ''
    }
  }

  return (
    <BaseChart
      title={title}
      loading={loading}
      error={error}
      data={performanceData}
      height={viewType === 'freshness' || viewType === 'alerts' ? undefined : height}
      className={className}
      style={style}
      onRefresh={onRefresh}
      onExport={onExport}
      emptyDescription="No performance data available"
      extra={
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {getViewDescription()}
          </Text>
        </Space>
      }
    >
      <div>
        {renderSummaryCards()}
        {renderControls()}
        {renderChart()}
      </div>
    </BaseChart>
  )
}

// Helper function to format performance data for export
export const formatPerformanceDataForExport = (
  metrics: ExecutionMetrics[],
  freshnessData: DataFreshnessMetric[]
) => {
  return metrics.map(metric => {
    const freshnessMetric = freshnessData.find(f => f.workflowId === metric.workflowId)

    return {
      'Workflow Name': metric.workflowName,
      'Success Rate (%)': metric.successRate,
      'Average Duration (ms)': Math.round(metric.avgDuration),
      'Average Duration (formatted)': formatDuration(metric.avgDuration),
      'Total Executions': metric.totalExecutions,
      'Data Age (hours)': freshnessMetric?.dataAge || 'N/A',
      'Freshness Status': freshnessMetric?.freshnessStatus || 'N/A',
      'Performance Score': calculatePerformanceScore(metric, freshnessMetric),
      'Trend Direction': metric.trendDirection
    }
  })
}

// Helper function to calculate overall performance score
export const calculatePerformanceScore = (
  metric: ExecutionMetrics,
  freshnessMetric?: DataFreshnessMetric
): number => {
  const successRateScore = metric.successRate
  const durationScore = Math.max(0, 100 - (metric.avgDuration / 10000) * 100)
  const volumeScore = Math.min(100, (metric.totalExecutions / 200) * 100)
  const freshnessScore = freshnessMetric
    ? Math.max(0, 100 - (freshnessMetric.dataAge / 72) * 100)
    : 50

  // Weighted average
  return Math.round(
    successRateScore * 0.4 +
    durationScore * 0.3 +
    volumeScore * 0.15 +
    freshnessScore * 0.15
  )
}