import React from 'react'
import { Card, Badge, Space, Typography, Button, Tooltip, Dropdown, Tag, Progress, Divider } from 'antd'
import type { MenuProps } from 'antd'
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
  EyeOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  StopOutlined,
  CalendarOutlined,
  FireOutlined,
  TrophyOutlined,
  AlertOutlined,
  SyncOutlined,
  MoreOutlined,
  StarOutlined,
  StarFilled
} from '@ant-design/icons'
import WorkflowProgressBar from './WorkflowProgressBar'
import type { WorkflowStatus, WorkflowProgress, WorkflowHealthMetrics, PerformanceTrendType } from '@/types/workflow'

const { Text, Title } = Typography

export interface WorkflowData {
  id: string
  name: string
  status: WorkflowStatus
  lastExecution: string | null
  executionCount: number
  successRate: number
  description?: string
  nextExecution?: string | null
  progress?: WorkflowProgress
  healthMetrics?: WorkflowHealthMetrics
  tags?: string[]
  isStarred?: boolean
  averageExecutionTime?: number
}

interface WorkflowStatusCardProps {
  workflow: WorkflowData
  loading?: boolean
  onTrigger?: (workflowId: string) => void
  onView?: (workflowId: string) => void
  onEdit?: (workflowId: string) => void
  onToggleStatus?: (workflowId: string, newStatus: 'active' | 'inactive') => void
  onSync?: (workflowId: string) => void
}

export default function WorkflowStatusCard({
  workflow,
  loading = false,
  onTrigger,
  onView,
  onEdit,
  onToggleStatus,
  onSync
}: WorkflowStatusCardProps) {
  const getStatusConfig = (status: WorkflowStatus) => {
    switch (status) {
      case 'active':
        return {
          badge: 'success' as const,
          color: '#52c41a',
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
          text: 'Active',
          priority: 1
        }
      case 'running':
        return {
          badge: 'processing' as const,
          color: '#1890ff',
          icon: <LoadingOutlined style={{ color: '#1890ff' }} />,
          text: 'Running',
          priority: 0
        }
      case 'queued':
        return {
          badge: 'processing' as const,
          color: '#722ed1',
          icon: <ClockCircleOutlined style={{ color: '#722ed1' }} />,
          text: 'Queued',
          priority: 2
        }
      case 'completed':
        return {
          badge: 'success' as const,
          color: '#52c41a',
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
          text: 'Completed',
          priority: 3
        }
      case 'failed':
        return {
          badge: 'error' as const,
          color: '#ff4d4f',
          icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
          text: 'Failed',
          priority: 4
        }
      case 'cancelled':
        return {
          badge: 'default' as const,
          color: '#8c8c8c',
          icon: <StopOutlined style={{ color: '#8c8c8c' }} />,
          text: 'Cancelled',
          priority: 5
        }
      case 'paused':
        return {
          badge: 'warning' as const,
          color: '#faad14',
          icon: <PauseCircleOutlined style={{ color: '#faad14' }} />,
          text: 'Paused',
          priority: 6
        }
      case 'scheduled':
        return {
          badge: 'processing' as const,
          color: '#13c2c2',
          icon: <CalendarOutlined style={{ color: '#13c2c2' }} />,
          text: 'Scheduled',
          priority: 7
        }
      case 'inactive':
        return {
          badge: 'default' as const,
          color: '#d9d9d9',
          icon: <PauseCircleOutlined style={{ color: '#d9d9d9' }} />,
          text: 'Inactive',
          priority: 8
        }
      case 'error':
        return {
          badge: 'error' as const,
          color: '#ff4d4f',
          icon: <AlertOutlined style={{ color: '#ff4d4f' }} />,
          text: 'Error',
          priority: 9
        }
      case 'pending':
        return {
          badge: 'processing' as const,
          color: '#1890ff',
          icon: <SyncOutlined style={{ color: '#1890ff' }} />,
          text: 'Pending',
          priority: 10
        }
      case 'unknown':
      default:
        return {
          badge: 'default' as const,
          color: '#d9d9d9',
          icon: <WarningOutlined style={{ color: '#d9d9d9' }} />,
          text: 'Unknown',
          priority: 11
        }
    }
  }

  const formatLastExecution = (lastExecution: string | null) => {
    if (!lastExecution) return 'Never'
    try {
      const date = new Date(lastExecution)
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

  const formatNextExecution = (nextExecution: string | null) => {
    if (!nextExecution) return null
    try {
      const date = new Date(nextExecution)
      const now = new Date()
      const diffMs = date.getTime() - now.getTime()
      const diffMins = Math.floor(diffMs / (1000 * 60))

      if (diffMins < 0) return 'Overdue'
      if (diffMins < 60) return `In ${diffMins}m`
      if (diffMins < 1440) return `In ${Math.floor(diffMins / 60)}h`
      return `On ${date.toLocaleDateString()}`
    } catch {
      return 'Invalid date'
    }
  }

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return '#52c41a'
    if (rate >= 70) return '#faad14'
    return '#ff4d4f'
  }

  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return '#52c41a'
    if (score >= 60) return '#faad14'
    if (score >= 40) return '#fa8c16'
    return '#ff4d4f'
  }

  const getTrendIcon = (trend: PerformanceTrendType) => {
    switch (trend) {
      case 'improving':
        return <TrophyOutlined style={{ color: '#52c41a', fontSize: '12px' }} />
      case 'degrading':
        return <AlertOutlined style={{ color: '#ff4d4f', fontSize: '12px' }} />
      case 'stable':
        return <CheckCircleOutlined style={{ color: '#1890ff', fontSize: '12px' }} />
      default:
        return null
    }
  }

  const formatExecutionTime = (ms?: number) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
    if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`
    return `${(ms / 3600000).toFixed(1)}h`
  }

  const statusConfig = getStatusConfig(workflow.status)
  const nextExecutionText = formatNextExecution(workflow.nextExecution)

  const dropdownItems: MenuProps['items'] = [
    {
      key: 'view',
      label: 'View Details',
      icon: <EyeOutlined />,
      onClick: () => onView?.(workflow.id)
    },
    {
      key: 'edit',
      label: 'Edit Workflow',
      icon: <SettingOutlined />,
      onClick: () => onEdit?.(workflow.id)
    },
    {
      key: 'sync',
      label: 'Sync Individual',
      icon: <SyncOutlined />,
      onClick: () => onSync?.(workflow.id)
    },
    {
      type: 'divider'
    },
    {
      key: 'toggle',
      label: ['active', 'running', 'queued', 'scheduled'].includes(workflow.status) ? 'Pause Workflow' : 'Activate Workflow',
      icon: ['active', 'running', 'queued', 'scheduled'].includes(workflow.status) ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
      onClick: () => onToggleStatus?.(workflow.id, ['active', 'running', 'queued', 'scheduled'].includes(workflow.status) ? 'paused' : 'active')
    },
    ...(workflow.status === 'running' ? [{
      key: 'cancel',
      label: 'Cancel Execution',
      icon: <StopOutlined />,
      onClick: () => onToggleStatus?.(workflow.id, 'cancelled'),
      danger: true
    }] : [])
  ]

  return (
    <Card
      size="small"
      loading={loading}
      style={{
        height: '100%',
        borderLeft: `4px solid ${statusConfig.color}`
      }}
      actions={[
        <Tooltip title={workflow.status === 'running' ? 'Execution in progress' : 'Trigger Manual Execution'} key="trigger">
          <Button
            type="text"
            icon={<PlayCircleOutlined />}
            onClick={() => onTrigger?.(workflow.id)}
            disabled={['running', 'queued', 'error', 'failed'].includes(workflow.status)}
            loading={workflow.status === 'running'}
          >
            {workflow.status === 'running' ? 'Running' : 'Trigger'}
          </Button>
        </Tooltip>,
        <Tooltip title="Refresh Status" key="refresh">
          <Button
            type="text"
            icon={<ReloadOutlined />}
            onClick={() => window.location.reload()}
          >
            Refresh
          </Button>
        </Tooltip>,
        <Dropdown menu={{ items: dropdownItems }} key="more">
          <Button type="text" icon={<MoreOutlined />}>
            More
          </Button>
        </Dropdown>
      ]}
      extra={workflow.isStarred ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined style={{ color: '#d9d9d9' }} />}
    >
      <div style={{ minHeight: workflow.progress ? '180px' : '140px' }}>
        <div style={{ marginBottom: '12px' }}>
          <Space direction="vertical" size={4} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <Title level={5} style={{ margin: 0, maxWidth: '70%' }} ellipsis={{ tooltip: workflow.name }}>
                {workflow.name}
              </Title>
              <Badge status={statusConfig.badge} />
            </div>

            <Space size={8}>
              {statusConfig.icon}
              <Text strong style={{ color: statusConfig.color }}>
                {statusConfig.text}
              </Text>
              {workflow.healthMetrics?.performanceTrend && getTrendIcon(workflow.healthMetrics.performanceTrend)}
              {['error', 'failed'].includes(workflow.status) && (
                <Tag color="red" size="small">
                  Attention Required
                </Tag>
              )}
              {workflow.tags && workflow.tags.length > 0 && (
                <Tag size="small" color="blue">
                  {workflow.tags[0]}
                </Tag>
              )}
            </Space>
          </Space>
        </div>

        {workflow.description && (
          <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
            {workflow.description.length > 80
              ? `${workflow.description.substring(0, 80)}...`
              : workflow.description
            }
          </Text>
        )}

        {/* Real-time Progress Tracking */}
        {workflow.progress && workflow.status === 'running' && (
          <div style={{ marginBottom: '12px' }}>
            <WorkflowProgressBar progress={workflow.progress} size="small" showDetails={true} />
            <Divider style={{ margin: '8px 0' }} />
          </div>
        )}

        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Last execution:
            </Text>
            <Text style={{ fontSize: '12px' }}>
              {formatLastExecution(workflow.lastExecution)}
            </Text>
          </div>

          {nextExecutionText && workflow.status === 'active' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Next execution:
              </Text>
              <Text style={{ fontSize: '12px' }}>
                {nextExecutionText}
              </Text>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              Executions:
            </Text>
            <Text style={{ fontSize: '12px' }}>
              {workflow.executionCount}
            </Text>
          </div>

          <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Success Rate:
              </Text>
              <Text style={{ fontSize: '12px', color: getSuccessRateColor(workflow.successRate) }}>
                {workflow.successRate}%
              </Text>
            </div>
            <Progress
              percent={workflow.successRate}
              size="small"
              strokeColor={getSuccessRateColor(workflow.successRate)}
              showInfo={false}
            />
          </div>

          {/* Enhanced Health Metrics */}
          {workflow.healthMetrics && (
            <div style={{ marginTop: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Health Score:
                </Text>
                <Text style={{ fontSize: '12px', color: getHealthScoreColor(workflow.healthMetrics.healthScore) }}>
                  {workflow.healthMetrics.healthScore}/100
                </Text>
              </div>
              <Progress
                percent={workflow.healthMetrics.healthScore}
                size="small"
                strokeColor={getHealthScoreColor(workflow.healthMetrics.healthScore)}
                showInfo={false}
              />

              {workflow.averageExecutionTime && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <Space>
                    <FireOutlined style={{ fontSize: '10px', color: '#8c8c8c' }} />
                    <Text type="secondary" style={{ fontSize: '11px' }}>
                      Avg Time:
                    </Text>
                  </Space>
                  <Text style={{ fontSize: '11px' }}>
                    {formatExecutionTime(workflow.averageExecutionTime)}
                  </Text>
                </div>
              )}
            </div>
          )}
        </Space>
      </div>
    </Card>
  )
}