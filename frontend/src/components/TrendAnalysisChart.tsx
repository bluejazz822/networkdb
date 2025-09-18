import React, { useMemo, useState, useCallback } from 'react'
import { Line, Area, DualAxes } from '@ant-design/plots'
import { Select, Space, Button, DatePicker, Radio, Typography } from 'antd'
import { LineChartOutlined, AreaChartOutlined, BarChartOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import BaseChart, {
  getChartTheme,
  formatChartTooltip,
  getResponsiveConfig,
  getAxisConfig,
  getLegendConfig,
  formatTimestamp,
  formatPercentage,
  getStatusColor,
  TimeSeriesDataPoint
} from './BaseChart'
import { PerformanceTrend, AnalyticsTimeRange } from '../types/workflow'

const { Text } = Typography
const { RangePicker } = DatePicker
const { Option } = Select

export interface TrendAnalysisChartProps {
  data: PerformanceTrend[]
  loading?: boolean
  error?: string | null
  height?: number
  title?: string
  timeRange: AnalyticsTimeRange
  onTimeRangeChange?: (range: AnalyticsTimeRange) => void
  onRefresh?: () => void
  onExport?: () => void
  className?: string
  style?: React.CSSProperties
  showControls?: boolean
  showComparison?: boolean
  comparisonData?: PerformanceTrend[]
}

export type ChartType = 'line' | 'area' | 'dual'
export type MetricType = 'executions' | 'success_rate' | 'duration' | 'comparison'

// Mock data generator for development
export const generateMockTrendData = (timeRange: AnalyticsTimeRange): PerformanceTrend[] => {
  const data: PerformanceTrend[] = []
  const start = dayjs(timeRange.start)
  const end = dayjs(timeRange.end)
  let current = start

  while (current.isBefore(end) || current.isSame(end)) {
    const dayProgress = current.diff(start) / end.diff(start)
    const baseExecutions = 20 + Math.sin(dayProgress * Math.PI * 4) * 10
    const noise = (Math.random() - 0.5) * 8
    const executions = Math.max(0, Math.round(baseExecutions + noise))

    const baseSuccessRate = 0.85 + Math.sin(dayProgress * Math.PI * 2) * 0.1
    const successRate = Math.max(0.6, Math.min(1, baseSuccessRate + (Math.random() - 0.5) * 0.15))
    const successes = Math.round(executions * successRate)
    const failures = executions - successes

    const baseDuration = 2000 + Math.sin(dayProgress * Math.PI * 3) * 500
    const avgDuration = Math.max(500, baseDuration + (Math.random() - 0.5) * 1000)

    data.push({
      date: current.format('YYYY-MM-DD'),
      executions,
      successes,
      failures,
      avgDuration,
      successRate: Math.round(successRate * 100)
    })

    // Increment based on granularity
    switch (timeRange.granularity) {
      case 'hour':
        current = current.add(1, 'hour')
        break
      case 'day':
        current = current.add(1, 'day')
        break
      case 'week':
        current = current.add(1, 'week')
        break
      case 'month':
        current = current.add(1, 'month')
        break
    }
  }

  return data
}

export default function TrendAnalysisChart({
  data = [],
  loading = false,
  error = null,
  height = 400,
  title = 'Execution Trends',
  timeRange,
  onTimeRangeChange,
  onRefresh,
  onExport,
  className,
  style,
  showControls = true,
  showComparison = false,
  comparisonData = []
}: TrendAnalysisChartProps) {
  const [chartType, setChartType] = useState<ChartType>('line')
  const [metricType, setMetricType] = useState<MetricType>('executions')

  // Use mock data if no real data provided
  const chartData = useMemo(() => {
    if (data.length === 0) {
      return generateMockTrendData(timeRange)
    }
    return data
  }, [data, timeRange])

  // Transform data for different chart types and metrics
  const transformedData = useMemo(() => {
    const transform = (sourceData: PerformanceTrend[], seriesName = 'Current') => {
      return sourceData.map(item => {
        const basePoint = {
          date: item.date,
          timestamp: item.date,
          series: seriesName
        }

        switch (metricType) {
          case 'executions':
            return [
              { ...basePoint, metric: 'Total Executions', value: item.executions, type: 'total' },
              { ...basePoint, metric: 'Successful', value: item.successes, type: 'success' },
              { ...basePoint, metric: 'Failed', value: item.failures, type: 'error' }
            ]
          case 'success_rate':
            return [
              { ...basePoint, metric: 'Success Rate', value: item.successRate, type: 'rate' }
            ]
          case 'duration':
            return [
              { ...basePoint, metric: 'Average Duration', value: item.avgDuration, type: 'duration' }
            ]
          case 'comparison':
            return [
              { ...basePoint, metric: 'Executions', value: item.executions, axis: 'left' },
              { ...basePoint, metric: 'Success Rate', value: item.successRate, axis: 'right' }
            ]
          default:
            return []
        }
      }).flat()
    }

    const result = transform(chartData, 'Current')

    if (showComparison && comparisonData.length > 0) {
      const comparisonResult = transform(comparisonData, 'Previous Period')
      return [...result, ...comparisonResult]
    }

    return result
  }, [chartData, comparisonData, metricType, showComparison])

  // Chart configurations
  const lineConfig = useMemo(() => ({
    ...getResponsiveConfig(height),
    data: transformedData,
    xField: 'date',
    yField: 'value',
    seriesField: metricType === 'comparison' ? 'metric' : (showComparison ? 'series' : 'metric'),
    color: (datum: any) => {
      if (metricType === 'comparison') {
        return datum.metric === 'Executions' ? getChartTheme().colors[0] : getChartTheme().colors[1]
      }
      if (showComparison) {
        return datum.series === 'Current' ? getChartTheme().colors[0] : getChartTheme().colors[1]
      }
      return getStatusColor(datum.type || 'default')
    },
    point: {
      size: 3,
      shape: 'circle'
    },
    smooth: true,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000
      }
    },
    tooltip: {
      formatter: (datum: any) => ({
        name: datum.metric,
        value: metricType === 'success_rate'
          ? `${datum.value}%`
          : metricType === 'duration'
          ? `${datum.value}ms`
          : datum.value.toLocaleString()
      }),
      title: (title: string) => dayjs(title).format('MMM DD, YYYY')
    },
    legend: getLegendConfig(),
    xAxis: {
      ...getAxisConfig().x,
      tickCount: 5
    },
    yAxis: getAxisConfig().y,
    theme: getChartTheme()
  }), [transformedData, height, metricType, showComparison])

  const areaConfig = useMemo(() => ({
    ...lineConfig,
    areaStyle: {
      fillOpacity: 0.3
    }
  }), [lineConfig])

  const dualAxesConfig = useMemo(() => {
    if (metricType !== 'comparison') return lineConfig

    const leftData = transformedData.filter(d => d.axis === 'left')
    const rightData = transformedData.filter(d => d.axis === 'right')

    return {
      ...getResponsiveConfig(height),
      data: [leftData, rightData],
      xField: 'date',
      yField: ['value', 'value'],
      geometryOptions: [
        {
          geometry: 'line',
          color: getChartTheme().colors[0],
          lineStyle: { lineWidth: 2 },
          point: { size: 3 }
        },
        {
          geometry: 'line',
          color: getChartTheme().colors[1],
          lineStyle: { lineWidth: 2, lineDash: [4, 4] },
          point: { size: 3, shape: 'square' }
        }
      ],
      yAxis: {
        left: {
          ...getAxisConfig().y,
          title: { text: 'Executions', style: { fontSize: 12 } }
        },
        right: {
          ...getAxisConfig().y,
          title: { text: 'Success Rate (%)', style: { fontSize: 12 } }
        }
      },
      legend: getLegendConfig(),
      tooltip: {
        formatter: (datum: any, mappingData: any) => {
          const isLeft = mappingData.yField === 'value' && mappingData.data === leftData
          return {
            name: isLeft ? 'Executions' : 'Success Rate',
            value: isLeft ? datum.value.toLocaleString() : `${datum.value}%`
          }
        }
      },
      theme: getChartTheme()
    }
  }, [transformedData, height])

  const handleTimeRangeChange = useCallback((dates: any) => {
    if (!dates || !onTimeRangeChange) return

    const [start, end] = dates
    const newRange: AnalyticsTimeRange = {
      start: start.format('YYYY-MM-DD'),
      end: end.format('YYYY-MM-DD'),
      granularity: timeRange.granularity
    }

    onTimeRangeChange(newRange)
  }, [onTimeRangeChange, timeRange.granularity])

  const handleGranularityChange = useCallback((granularity: AnalyticsTimeRange['granularity']) => {
    if (!onTimeRangeChange) return

    onTimeRangeChange({
      ...timeRange,
      granularity
    })
  }, [onTimeRangeChange, timeRange])

  const renderChart = () => {
    switch (chartType) {
      case 'area':
        return <Area {...areaConfig} />
      case 'dual':
        return metricType === 'comparison' ? <DualAxes {...dualAxesConfig} /> : <Line {...lineConfig} />
      default:
        return <Line {...lineConfig} />
    }
  }

  const getMetricDescription = () => {
    switch (metricType) {
      case 'executions':
        return 'Total workflow executions broken down by success and failure'
      case 'success_rate':
        return 'Percentage of successful workflow executions over time'
      case 'duration':
        return 'Average execution duration in milliseconds'
      case 'comparison':
        return 'Dual axis comparison of execution volume and success rate'
      default:
        return ''
    }
  }

  const controls = showControls && (
    <Space wrap style={{ marginBottom: 16 }}>
      <Space>
        <Text strong>Chart Type:</Text>
        <Radio.Group
          value={chartType}
          onChange={(e) => setChartType(e.target.value)}
          size="small"
          optionType="button"
        >
          <Radio.Button value="line">
            <LineChartOutlined /> Line
          </Radio.Button>
          <Radio.Button value="area">
            <AreaChartOutlined /> Area
          </Radio.Button>
          <Radio.Button value="dual">
            <BarChartOutlined /> Dual Axis
          </Radio.Button>
        </Radio.Group>
      </Space>

      <Space>
        <Text strong>Metric:</Text>
        <Select
          value={metricType}
          onChange={setMetricType}
          style={{ width: 150 }}
          size="small"
        >
          <Option value="executions">Executions</Option>
          <Option value="success_rate">Success Rate</Option>
          <Option value="duration">Duration</Option>
          <Option value="comparison">Comparison</Option>
        </Select>
      </Space>

      {onTimeRangeChange && (
        <Space>
          <Text strong>Time Range:</Text>
          <RangePicker
            value={[dayjs(timeRange.start), dayjs(timeRange.end)]}
            onChange={handleTimeRangeChange}
            size="small"
            format="YYYY-MM-DD"
          />
        </Space>
      )}

      {onTimeRangeChange && (
        <Space>
          <Text strong>Granularity:</Text>
          <Select
            value={timeRange.granularity}
            onChange={handleGranularityChange}
            style={{ width: 100 }}
            size="small"
          >
            <Option value="hour">Hour</Option>
            <Option value="day">Day</Option>
            <Option value="week">Week</Option>
            <Option value="month">Month</Option>
          </Select>
        </Space>
      )}
    </Space>
  )

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
      emptyDescription="No trend data available for the selected time range"
      extra={
        <Space>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {getMetricDescription()}
          </Text>
        </Space>
      }
    >
      <div>
        {controls}
        {renderChart()}
      </div>
    </BaseChart>
  )
}

// Helper function to calculate trend direction
export const calculateTrendDirection = (data: PerformanceTrend[]): 'up' | 'down' | 'stable' => {
  if (data.length < 2) return 'stable'

  const recent = data.slice(-7) // Last 7 data points
  const firstHalf = recent.slice(0, Math.ceil(recent.length / 2))
  const secondHalf = recent.slice(Math.floor(recent.length / 2))

  const firstAvg = firstHalf.reduce((sum, item) => sum + item.successRate, 0) / firstHalf.length
  const secondAvg = secondHalf.reduce((sum, item) => sum + item.successRate, 0) / secondHalf.length

  const diff = secondAvg - firstAvg

  if (Math.abs(diff) < 2) return 'stable' // Less than 2% change
  return diff > 0 ? 'up' : 'down'
}

// Helper function to format trend data for export
export const formatTrendDataForExport = (data: PerformanceTrend[]) => {
  return data.map(item => ({
    Date: item.date,
    'Total Executions': item.executions,
    'Successful Executions': item.successes,
    'Failed Executions': item.failures,
    'Success Rate (%)': item.successRate,
    'Average Duration (ms)': Math.round(item.avgDuration)
  }))
}