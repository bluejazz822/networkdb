import React, { useMemo } from 'react'
import { Card, Spin, Empty, Button, Space, Typography, Tooltip } from 'antd'
import { ReloadOutlined, DownloadOutlined, FullscreenOutlined } from '@ant-design/icons'

const { Text } = Typography

export interface BaseChartProps {
  title: string
  loading?: boolean
  error?: string | null
  data?: any[]
  height?: number
  className?: string
  style?: React.CSSProperties
  onRefresh?: () => void
  onExport?: () => void
  onFullscreen?: () => void
  refreshTooltip?: string
  exportTooltip?: string
  fullscreenTooltip?: string
  children?: React.ReactNode
  extra?: React.ReactNode
  bodyStyle?: React.CSSProperties
  size?: 'default' | 'small'
  bordered?: boolean
  hoverable?: boolean
  actions?: React.ReactNode[]
  emptyDescription?: string
  emptyImage?: React.ReactNode
  showHeader?: boolean
  headerStyle?: React.CSSProperties
}

export interface ChartDataPoint {
  x: string | number | Date
  y: number
  category?: string
  label?: string
  [key: string]: any
}

export interface TimeSeriesDataPoint extends ChartDataPoint {
  x: string | Date
  timestamp: string
}

export interface MetricDataPoint extends ChartDataPoint {
  metric: string
  value: number
  target?: number
  status?: 'success' | 'warning' | 'error'
}

// Chart configuration utilities
export const getChartColors = () => ({
  primary: '#1890ff',
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  info: '#722ed1',
  neutral: '#8c8c8c',
  background: '#fafafa',
  border: '#d9d9d9'
})

export const getChartTheme = () => ({
  colors: [
    '#1890ff', '#52c41a', '#faad14', '#ff4d4f', '#722ed1',
    '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb'
  ],
  styleSheet: {
    backgroundColor: 'transparent',
    brandColor: '#1890ff'
  }
})

export const formatChartTooltip = (title: string, items: any[]) => {
  return {
    title,
    showTitle: true,
    itemTpl: '<li class="g2-tooltip-list-item"><span style="background-color:{color};" class="g2-tooltip-marker"></span>{name}: {value}</li>',
    containerTpl: '<div class="g2-tooltip"><div class="g2-tooltip-title">{title}</div><ul class="g2-tooltip-list">{items}</ul></div>',
    domStyles: {
      'g2-tooltip': {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        border: '1px solid #d9d9d9',
        borderRadius: '6px',
        fontSize: '12px'
      }
    }
  }
}

export const getResponsiveConfig = (height?: number) => ({
  autoFit: true,
  height: height || 300,
  padding: 'auto'
})

export const getAxisConfig = () => ({
  x: {
    label: {
      autoRotate: true,
      autoHide: true,
      style: {
        fontSize: 12,
        fill: '#666'
      }
    },
    grid: {
      line: {
        style: {
          stroke: '#f0f0f0',
          lineWidth: 1
        }
      }
    }
  },
  y: {
    label: {
      formatter: (value: number) => {
        if (value >= 1000000) {
          return `${(value / 1000000).toFixed(1)}M`
        }
        if (value >= 1000) {
          return `${(value / 1000).toFixed(1)}K`
        }
        return value.toString()
      },
      style: {
        fontSize: 12,
        fill: '#666'
      }
    },
    grid: {
      line: {
        style: {
          stroke: '#f0f0f0',
          lineWidth: 1
        }
      }
    }
  }
})

export const getLegendConfig = () => ({
  position: 'bottom' as const,
  offsetY: 10,
  itemName: {
    style: {
      fontSize: 12,
      fill: '#666'
    }
  }
})

export default function BaseChart({
  title,
  loading = false,
  error = null,
  data = [],
  height = 300,
  className,
  style,
  onRefresh,
  onExport,
  onFullscreen,
  refreshTooltip = 'Refresh data',
  exportTooltip = 'Export chart',
  fullscreenTooltip = 'View fullscreen',
  children,
  extra,
  bodyStyle,
  size = 'default',
  bordered = true,
  hoverable = false,
  actions,
  emptyDescription = 'No data available',
  emptyImage,
  showHeader = true,
  headerStyle
}: BaseChartProps) {
  const hasData = useMemo(() => {
    return data && data.length > 0
  }, [data])

  const headerActions = useMemo(() => {
    const defaultActions = []

    if (onRefresh) {
      defaultActions.push(
        <Tooltip title={refreshTooltip} key="refresh">
          <Button
            type="text"
            size="small"
            icon={<ReloadOutlined />}
            onClick={onRefresh}
            loading={loading}
          />
        </Tooltip>
      )
    }

    if (onExport && hasData && !loading && !error) {
      defaultActions.push(
        <Tooltip title={exportTooltip} key="export">
          <Button
            type="text"
            size="small"
            icon={<DownloadOutlined />}
            onClick={onExport}
          />
        </Tooltip>
      )
    }

    if (onFullscreen && hasData && !loading && !error) {
      defaultActions.push(
        <Tooltip title={fullscreenTooltip} key="fullscreen">
          <Button
            type="text"
            size="small"
            icon={<FullscreenOutlined />}
            onClick={onFullscreen}
          />
        </Tooltip>
      )
    }

    return (
      <Space size="small">
        {extra}
        {defaultActions}
        {actions}
      </Space>
    )
  }, [onRefresh, onExport, onFullscreen, refreshTooltip, exportTooltip, fullscreenTooltip, hasData, loading, error, extra, actions])

  const renderContent = () => {
    if (loading) {
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height,
            minHeight: 200
          }}
        >
          <Spin size="large" />
        </div>
      )
    }

    if (error) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            height,
            minHeight: 200
          }}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Text type="danger">Error loading chart</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {error}
                </Text>
              </div>
            }
          >
            {onRefresh && (
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={onRefresh}
                size="small"
              >
                Try Again
              </Button>
            )}
          </Empty>
        </div>
      )
    }

    if (!hasData) {
      return (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height,
            minHeight: 200
          }}
        >
          <Empty
            image={emptyImage || Empty.PRESENTED_IMAGE_SIMPLE}
            description={emptyDescription}
            imageStyle={{ height: 60 }}
          >
            {onRefresh && (
              <Button
                type="primary"
                icon={<ReloadOutlined />}
                onClick={onRefresh}
                size="small"
              >
                Load Data
              </Button>
            )}
          </Empty>
        </div>
      )
    }

    return children
  }

  return (
    <Card
      title={showHeader ? title : undefined}
      extra={showHeader ? headerActions : undefined}
      className={className}
      style={style}
      bodyStyle={bodyStyle}
      size={size}
      bordered={bordered}
      hoverable={hoverable}
      headStyle={headerStyle}
    >
      {renderContent()}
    </Card>
  )
}

// Utility functions for data formatting
export const formatTimestamp = (timestamp: string | Date): string => {
  const date = new Date(timestamp)
  return date.toLocaleString()
}

export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
  return `${(ms / 3600000).toFixed(1)}h`
}

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

export const formatPercentage = (value: number, total: number): string => {
  if (total === 0) return '0%'
  return `${((value / total) * 100).toFixed(1)}%`
}

export const getStatusColor = (status: string): string => {
  const colors = getChartColors()
  switch (status) {
    case 'success':
    case 'active':
    case 'healthy':
      return colors.success
    case 'warning':
    case 'pending':
      return colors.warning
    case 'error':
    case 'failed':
    case 'critical':
      return colors.error
    case 'running':
    case 'processing':
      return colors.primary
    default:
      return colors.neutral
  }
}