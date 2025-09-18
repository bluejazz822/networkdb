import React, { useMemo, useState, useCallback } from 'react'
import { Column, Pie, Bar, Gauge, Progress } from '@ant-design/plots'
import { Row, Col, Card, Statistic, Select, Space, Button, Switch, Typography, Tooltip, Badge } from 'antd'
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  TrendingUpOutlined,
  TrendingDownOutlined,
  MinusOutlined,
  BarChartOutlined,
  PieChartOutlined,
  DashboardOutlined
} from '@ant-design/icons'
import BaseChart, {
  getChartTheme,
  getResponsiveConfig,
  getAxisConfig,
  getLegendConfig,
  formatDuration,
  formatPercentage,
  getStatusColor,
  MetricDataPoint
} from './BaseChart'
import { ExecutionMetrics, WorkflowExecution, ExecutionStatus } from '../types/workflow'

const { Text, Title } = Typography
const { Option } = Select

export interface ExecutionMetricsChartProps {
  metrics: ExecutionMetrics[]
  executions?: WorkflowExecution[]
  loading?: boolean
  error?: string | null
  height?: number
  title?: string
  onRefresh?: () => void
  onExport?: () => void
  onWorkflowClick?: (workflowId: string) => void
  className?: string
  style?: React.CSSProperties
  showComparison?: boolean
  compactMode?: boolean
  autoRefresh?: boolean
  refreshInterval?: number
}

export type MetricsViewType = 'overview' | 'success_rate' | 'duration' | 'volume' | 'status_distribution'
export type ChartDisplayType = 'column' | 'bar' | 'pie' | 'gauge'

// Mock data generator for development
export const generateMockMetricsData = (): ExecutionMetrics[] => {
  const workflows = [
    'Network Device Discovery',
    'VPC Configuration Sync',
    'Compliance Report Generator',
    'Backup Monitoring',
    'Alert Notification Service',
    'Performance Analytics',
    'Security Scan',
    'Data Validation'
  ]

  return workflows.map((name, index) => {
    const totalExecutions = Math.floor(Math.random() * 200) + 50
    const successRate = 0.7 + Math.random() * 0.3 // 70-100%
    const successfulExecutions = Math.floor(totalExecutions * successRate)
    const failedExecutions = totalExecutions - successfulExecutions
    const avgDuration = 1000 + Math.random() * 5000 // 1-6 seconds
    const errorRate = 1 - successRate

    return {
      workflowId: `workflow-${index + 1}`,
      workflowName: name,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      avgDuration,
      lastExecution: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      successRate: Math.round(successRate * 100),
      errorRate: Math.round(errorRate * 100),
      trendDirection: Math.random() > 0.5 ? 'up' : Math.random() > 0.3 ? 'down' : 'stable'
    }
  })
}

export default function ExecutionMetricsChart({
  metrics = [],
  executions = [],
  loading = false,
  error = null,
  height = 400,
  title = 'Execution Metrics',
  onRefresh,
  onExport,
  onWorkflowClick,
  className,
  style,
  showComparison = false,
  compactMode = false,
  autoRefresh = false,
  refreshInterval = 30000
}: ExecutionMetricsChartProps) {
  const [viewType, setViewType] = useState<MetricsViewType>('overview')
  const [chartType, setChartType] = useState<ChartDisplayType>('column')
  const [sortBy, setSortBy] = useState<keyof ExecutionMetrics>('totalExecutions')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Use mock data if no real data provided
  const chartData = useMemo(() => {
    if (metrics.length === 0) {
      return generateMockMetricsData()
    }
    return metrics
  }, [metrics])

  // Sort and transform data based on current view
  const transformedData = useMemo(() => {
    const sorted = [...chartData].sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]
      const multiplier = sortOrder === 'asc' ? 1 : -1

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return (aVal - bVal) * multiplier
      }
      return String(aVal).localeCompare(String(bVal)) * multiplier
    })

    return sorted.map(metric => {
      const basePoint = {
        workflowId: metric.workflowId,
        workflowName: metric.workflowName,
        workflow: metric.workflowName.length > 20
          ? `${metric.workflowName.substring(0, 20)}...`
          : metric.workflowName
      }

      switch (viewType) {
        case 'success_rate':
          return {
            ...basePoint,
            value: metric.successRate,
            label: `${metric.successRate}%`,
            type: metric.successRate >= 90 ? 'excellent' : metric.successRate >= 70 ? 'good' : 'poor'
          }
        case 'duration':
          return {
            ...basePoint,
            value: metric.avgDuration,
            label: formatDuration(metric.avgDuration),
            type: metric.avgDuration < 2000 ? 'fast' : metric.avgDuration < 5000 ? 'medium' : 'slow'
          }
        case 'volume':
          return {
            ...basePoint,
            value: metric.totalExecutions,
            label: metric.totalExecutions.toLocaleString(),
            type: 'volume'
          }
        case 'status_distribution':
          return [
            { ...basePoint, status: 'Successful', value: metric.successfulExecutions, type: 'success' },
            { ...basePoint, status: 'Failed', value: metric.failedExecutions, type: 'error' }
          ]
        default: // overview
          return {
            ...basePoint,
            totalExecutions: metric.totalExecutions,
            successfulExecutions: metric.successfulExecutions,
            failedExecutions: metric.failedExecutions,
            successRate: metric.successRate,
            avgDuration: metric.avgDuration
          }
      }
    }).flat().filter(Boolean)
  }, [chartData, viewType, sortBy, sortOrder])

  // Calculate summary statistics
  const summaryStats = useMemo(() => {
    const total = chartData.reduce((acc, metric) => ({
      totalExecutions: acc.totalExecutions + metric.totalExecutions,
      successfulExecutions: acc.successfulExecutions + metric.successfulExecutions,
      failedExecutions: acc.failedExecutions + metric.failedExecutions,
      totalDuration: acc.totalDuration + (metric.avgDuration * metric.totalExecutions)
    }), { totalExecutions: 0, successfulExecutions: 0, failedExecutions: 0, totalDuration: 0 })

    const overallSuccessRate = total.totalExecutions > 0
      ? (total.successfulExecutions / total.totalExecutions) * 100
      : 0

    const avgDuration = total.totalExecutions > 0
      ? total.totalDuration / total.totalExecutions
      : 0

    return {
      ...total,
      overallSuccessRate: Math.round(overallSuccessRate),
      avgDuration: Math.round(avgDuration),
      activeWorkflows: chartData.length,
      healthyWorkflows: chartData.filter(m => m.successRate >= 90).length
    }
  }, [chartData])

  // Chart configurations
  const columnConfig = useMemo(() => ({
    ...getResponsiveConfig(height),
    data: transformedData,
    xField: 'workflow',
    yField: 'value',
    seriesField: viewType === 'status_distribution' ? 'status' : undefined,
    color: (datum: any) => {
      if (viewType === 'status_distribution') {
        return getStatusColor(datum.type)
      }
      return getStatusColor(datum.type || 'default')
    },
    columnWidthRatio: 0.6,
    animation: {
      appear: {
        animation: 'scale-in-y',
        duration: 800
      }
    },
    tooltip: {
      formatter: (datum: any) => ({
        name: viewType === 'status_distribution' ? datum.status : 'Value',
        value: datum.label || datum.value
      })
    },
    legend: viewType === 'status_distribution' ? getLegendConfig() : false,
    xAxis: {
      ...getAxisConfig().x,
      label: {
        autoRotate: true,
        autoHide: true,
        style: { fontSize: 10 }
      }
    },
    yAxis: getAxisConfig().y,
    theme: getChartTheme(),
    interactions: [
      {
        type: 'element-active',
        enable: true
      }
    ]
  }), [transformedData, height, viewType])

  const pieConfig = useMemo(() => {
    if (viewType !== 'status_distribution') return null

    const pieData = chartData.reduce((acc, metric) => {
      acc.successful += metric.successfulExecutions
      acc.failed += metric.failedExecutions
      return acc
    }, { successful: 0, failed: 0 })

    return {
      ...getResponsiveConfig(height),
      data: [
        { type: 'Successful', value: pieData.successful },
        { type: 'Failed', value: pieData.failed }
      ],
      angleField: 'value',
      colorField: 'type',
      color: ['#52c41a', '#ff4d4f'],
      radius: 0.8,
      innerRadius: 0.4,
      label: {
        type: 'outer',
        content: '{name}: {percentage}'
      },
      statistic: {
        title: false,
        content: {
          style: { fontSize: '16px', fontWeight: 'bold' },
          content: 'Total\nExecutions'
        }
      },
      theme: getChartTheme()
    }
  }, [chartData, height, viewType])

  const gaugeConfig = useMemo(() => {
    if (viewType !== 'success_rate') return null

    return {
      ...getResponsiveConfig(height),
      percent: summaryStats.overallSuccessRate / 100,
      range: {
        color: summaryStats.overallSuccessRate >= 90 ? '#52c41a' :
              summaryStats.overallSuccessRate >= 70 ? '#faad14' : '#ff4d4f'
      },
      axis: {
        label: {
          formatter: (v: string) => `${(parseFloat(v) * 100).toFixed(0)}%`
        }
      },
      indicator: {
        pointer: {
          style: {
            stroke: '#D0D0D0'
          }
        },
        pin: {
          style: {
            stroke: '#D0D0D0'
          }
        }
      },
      statistic: {
        content: {
          style: {
            fontSize: '24px',
            fontWeight: 'bold'
          },
          content: `${summaryStats.overallSuccessRate}%`
        }
      }
    }
  }, [summaryStats.overallSuccessRate, height, viewType])

  const handleWorkflowClick = useCallback((datum: any) => {
    if (onWorkflowClick && datum.workflowId) {
      onWorkflowClick(datum.workflowId)
    }
  }, [onWorkflowClick])

  const renderChart = () => {
    if (viewType === 'status_distribution' && chartType === 'pie') {
      return <Pie {...pieConfig} />
    }

    if (viewType === 'success_rate' && chartType === 'gauge') {
      return <Gauge {...gaugeConfig} />
    }

    if (chartType === 'bar') {
      return <Bar {...{ ...columnConfig, coordinate: { transpose: true } }} />
    }

    return <Column {...columnConfig} onReady={(plot: any) => {
      plot.on('element:click', handleWorkflowClick)
    }} />
  }

  const renderSummaryCards = () => {
    if (compactMode) return null

    return (
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Total Executions"
              value={summaryStats.totalExecutions}
              prefix={<BarChartOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Overall Success Rate"
              value={summaryStats.overallSuccessRate}
              suffix="%"
              prefix={<CheckCircleOutlined />}
              valueStyle={{
                color: summaryStats.overallSuccessRate >= 90 ? '#52c41a' :
                       summaryStats.overallSuccessRate >= 70 ? '#faad14' : '#ff4d4f'
              }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Avg Duration"
              value={formatDuration(summaryStats.avgDuration)}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card size="small">
            <Statistic
              title="Healthy Workflows"
              value={`${summaryStats.healthyWorkflows}/${summaryStats.activeWorkflows}`}
              prefix={<TrendingUpOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>
    )
  }

  const renderControls = () => {
    return (
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8} md={6}>
          <Space>
            <Text strong>View:</Text>
            <Select
              value={viewType}
              onChange={setViewType}
              style={{ width: 150 }}
              size="small"
            >
              <Option value="overview">Overview</Option>
              <Option value="success_rate">Success Rate</Option>
              <Option value="duration">Duration</Option>
              <Option value="volume">Volume</Option>
              <Option value="status_distribution">Status Distribution</Option>
            </Select>
          </Space>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Space>
            <Text strong>Chart:</Text>
            <Select
              value={chartType}
              onChange={setChartType}
              style={{ width: 120 }}
              size="small"
            >
              <Option value="column" disabled={viewType === 'success_rate'}>
                <BarChartOutlined /> Column
              </Option>
              <Option value="bar" disabled={viewType === 'success_rate'}>
                <BarChartOutlined style={{ transform: 'rotate(90deg)' }} /> Bar
              </Option>
              <Option value="pie" disabled={viewType !== 'status_distribution'}>
                <PieChartOutlined /> Pie
              </Option>
              <Option value="gauge" disabled={viewType !== 'success_rate'}>
                <DashboardOutlined /> Gauge
              </Option>
            </Select>
          </Space>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Space>
            <Text strong>Sort:</Text>
            <Select
              value={sortBy}
              onChange={setSortBy}
              style={{ width: 140 }}
              size="small"
            >
              <Option value="workflowName">Name</Option>
              <Option value="totalExecutions">Total Executions</Option>
              <Option value="successRate">Success Rate</Option>
              <Option value="avgDuration">Duration</Option>
              <Option value="lastExecution">Last Execution</Option>
            </Select>
          </Space>
        </Col>
        <Col xs={24} sm={8} md={6}>
          <Space>
            <Text strong>Order:</Text>
            <Select
              value={sortOrder}
              onChange={setSortOrder}
              style={{ width: 100 }}
              size="small"
            >
              <Option value="asc">Ascending</Option>
              <Option value="desc">Descending</Option>
            </Select>
          </Space>
        </Col>
      </Row>
    )
  }

  const getTrendIcon = (direction: string) => {
    switch (direction) {
      case 'up':
        return <TrendingUpOutlined style={{ color: '#52c41a' }} />
      case 'down':
        return <TrendingDownOutlined style={{ color: '#ff4d4f' }} />
      default:
        return <MinusOutlined style={{ color: '#8c8c8c' }} />
    }
  }

  const getViewDescription = () => {
    switch (viewType) {
      case 'success_rate':
        return 'Success rate percentage for each workflow'
      case 'duration':
        return 'Average execution duration for each workflow'
      case 'volume':
        return 'Total number of executions per workflow'
      case 'status_distribution':
        return 'Distribution of successful vs failed executions'
      default:
        return 'Comprehensive execution metrics overview'
    }
  }

  return (
    <BaseChart
      title={title}
      loading={loading}
      error={error}
      data={chartData}
      height={height}
      className={className}
      style={style}
      onRefresh={onRefresh}
      onExport={onExport}
      emptyDescription="No execution metrics available"
      extra={
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {getViewDescription()}
          </Text>
          {autoRefresh && (
            <Badge status="processing" text={`Auto-refresh: ${refreshInterval / 1000}s`} />
          )}
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

// Helper function to format metrics data for export
export const formatMetricsDataForExport = (metrics: ExecutionMetrics[]) => {
  return metrics.map(metric => ({
    'Workflow Name': metric.workflowName,
    'Total Executions': metric.totalExecutions,
    'Successful Executions': metric.successfulExecutions,
    'Failed Executions': metric.failedExecutions,
    'Success Rate (%)': metric.successRate,
    'Error Rate (%)': metric.errorRate,
    'Average Duration (ms)': Math.round(metric.avgDuration),
    'Average Duration (formatted)': formatDuration(metric.avgDuration),
    'Last Execution': metric.lastExecution,
    'Trend Direction': metric.trendDirection
  }))
}

// Helper function to calculate health score
export const calculateHealthScore = (metrics: ExecutionMetrics[]): number => {
  if (metrics.length === 0) return 0

  const totalScore = metrics.reduce((sum, metric) => {
    // Weight by execution volume
    const volumeWeight = Math.min(metric.totalExecutions / 100, 1) // Cap at 100 executions
    const successRateScore = metric.successRate
    const durationScore = Math.max(0, 100 - (metric.avgDuration / 1000) * 10) // Penalize long durations

    return sum + (successRateScore * 0.7 + durationScore * 0.3) * volumeWeight
  }, 0)

  const totalWeight = metrics.reduce((sum, metric) => {
    return sum + Math.min(metric.totalExecutions / 100, 1)
  }, 0)

  return totalWeight > 0 ? Math.round(totalScore / totalWeight) : 0
}