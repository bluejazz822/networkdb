import React from 'react'
import { Card, Row, Col, Statistic, Badge, Space, Typography } from 'antd'
import {
  SyncOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  WarningOutlined
} from '@ant-design/icons'

const { Text } = Typography

interface WorkflowMetricsProps {
  totalWorkflows: number
  activeWorkflows: number
  successfulExecutions: number
  failedExecutions: number
  lastSyncTime: string | null
  loading?: boolean
}

interface MetricCardProps {
  title: string
  value: number | string
  icon: React.ReactNode
  loading?: boolean
  status?: 'success' | 'error' | 'warning' | 'processing' | 'default'
  color?: string
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  loading = false,
  status = 'default',
  color
}) => {
  const getStatusColor = () => {
    switch (status) {
      case 'success': return '#52c41a'
      case 'error': return '#ff4d4f'
      case 'warning': return '#faad14'
      case 'processing': return '#1890ff'
      default: return color || '#d9d9d9'
    }
  }

  return (
    <Card
      size="small"
      style={{
        height: '100%',
        borderLeft: `4px solid ${getStatusColor()}`
      }}
    >
      <Statistic
        title={
          <Space>
            {React.cloneElement(icon as React.ReactElement, {
              style: { color: getStatusColor() }
            })}
            <Text strong>{title}</Text>
          </Space>
        }
        value={value}
        loading={loading}
        valueStyle={{
          color: getStatusColor(),
          fontSize: '24px',
          fontWeight: 'bold'
        }}
      />
    </Card>
  )
}

export default function WorkflowMetrics({
  totalWorkflows,
  activeWorkflows,
  successfulExecutions,
  failedExecutions,
  lastSyncTime,
  loading = false
}: WorkflowMetricsProps) {
  const formatLastSyncTime = (time: string | null) => {
    if (!time) return 'Never'
    try {
      const date = new Date(time)
      const now = new Date()
      const diffMs = now.getTime() - date.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))

      if (diffMins < 1) return 'Just now'
      if (diffMins < 60) return `${diffMins}m ago`
      if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
      return date.toLocaleDateString()
    } catch {
      return 'Invalid date'
    }
  }

  const getLastSyncStatus = (time: string | null) => {
    if (!time) return 'warning'
    const diffMs = new Date().getTime() - new Date(time).getTime()
    const diffMins = Math.floor(diffMs / (1000 * 60))

    if (diffMins > 60) return 'warning' // More than 1 hour
    if (diffMins > 30) return 'processing' // More than 30 minutes
    return 'success' // Recent sync
  }

  const executionRate = totalWorkflows > 0
    ? Math.round((successfulExecutions / (successfulExecutions + failedExecutions)) * 100) || 0
    : 0

  const getExecutionRateStatus = (rate: number) => {
    if (rate >= 90) return 'success'
    if (rate >= 70) return 'warning'
    return 'error'
  }

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} sm={12} md={6}>
        <MetricCard
          title="Total Workflows"
          value={totalWorkflows}
          icon={<SyncOutlined />}
          loading={loading}
          status={totalWorkflows > 0 ? 'processing' : 'default'}
        />
      </Col>

      <Col xs={24} sm={12} md={6}>
        <MetricCard
          title="Active Workflows"
          value={activeWorkflows}
          icon={<PlayCircleOutlined />}
          loading={loading}
          status={activeWorkflows > 0 ? 'success' : 'default'}
        />
      </Col>

      <Col xs={24} sm={12} md={6}>
        <MetricCard
          title="Success Rate"
          value={`${executionRate}%`}
          icon={<CheckCircleOutlined />}
          loading={loading}
          status={getExecutionRateStatus(executionRate)}
        />
      </Col>

      <Col xs={24} sm={12} md={6}>
        <MetricCard
          title="Last Sync"
          value={formatLastSyncTime(lastSyncTime)}
          icon={<ClockCircleOutlined />}
          loading={loading}
          status={getLastSyncStatus(lastSyncTime)}
        />
      </Col>

      <Col xs={24} sm={12} md={6}>
        <MetricCard
          title="Successful Executions"
          value={successfulExecutions}
          icon={<CheckCircleOutlined />}
          loading={loading}
          status="success"
        />
      </Col>

      <Col xs={24} sm={12} md={6}>
        <MetricCard
          title="Failed Executions"
          value={failedExecutions}
          icon={<ExclamationCircleOutlined />}
          loading={loading}
          status={failedExecutions > 0 ? 'error' : 'default'}
        />
      </Col>

      <Col xs={24} sm={12} md={6}>
        <MetricCard
          title="Inactive Workflows"
          value={totalWorkflows - activeWorkflows}
          icon={<PauseCircleOutlined />}
          loading={loading}
          status={(totalWorkflows - activeWorkflows) > 0 ? 'warning' : 'default'}
        />
      </Col>

      <Col xs={24} sm={12} md={6}>
        <MetricCard
          title="Health Score"
          value={`${Math.max(0, 100 - (failedExecutions * 10))}%`}
          icon={<WarningOutlined />}
          loading={loading}
          status={failedExecutions === 0 ? 'success' : failedExecutions < 3 ? 'warning' : 'error'}
        />
      </Col>
    </Row>
  )
}