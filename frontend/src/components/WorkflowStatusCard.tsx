import React from 'react'
import { Card, Badge, Space, Typography, Button, Tooltip, Dropdown, Tag, Progress } from 'antd'
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
  MoreOutlined
} from '@ant-design/icons'

const { Text, Title } = Typography

export interface WorkflowData {
  id: string
  name: string
  status: 'active' | 'inactive' | 'error' | 'pending'
  lastExecution: string | null
  executionCount: number
  successRate: number
  description?: string
  nextExecution?: string | null
}

interface WorkflowStatusCardProps {
  workflow: WorkflowData
  loading?: boolean
  onTrigger?: (workflowId: string) => void
  onView?: (workflowId: string) => void
  onEdit?: (workflowId: string) => void
  onToggleStatus?: (workflowId: string, newStatus: 'active' | 'inactive') => void
}

export default function WorkflowStatusCard({
  workflow,
  loading = false,
  onTrigger,
  onView,
  onEdit,
  onToggleStatus
}: WorkflowStatusCardProps) {
  const getStatusConfig = (status: WorkflowData['status']) => {
    switch (status) {
      case 'active':
        return {
          badge: 'success' as const,
          color: '#52c41a',
          icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
          text: 'Active'
        }
      case 'inactive':
        return {
          badge: 'default' as const,
          color: '#d9d9d9',
          icon: <PauseCircleOutlined style={{ color: '#d9d9d9' }} />,
          text: 'Inactive'
        }
      case 'error':
        return {
          badge: 'error' as const,
          color: '#ff4d4f',
          icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
          text: 'Error'
        }
      case 'pending':
        return {
          badge: 'processing' as const,
          color: '#1890ff',
          icon: <ClockCircleOutlined style={{ color: '#1890ff' }} />,
          text: 'Pending'
        }
      default:
        return {
          badge: 'default' as const,
          color: '#d9d9d9',
          icon: <WarningOutlined style={{ color: '#d9d9d9' }} />,
          text: 'Unknown'
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
      type: 'divider'
    },
    {
      key: 'toggle',
      label: workflow.status === 'active' ? 'Pause Workflow' : 'Activate Workflow',
      icon: workflow.status === 'active' ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
      onClick: () => onToggleStatus?.(workflow.id, workflow.status === 'active' ? 'inactive' : 'active')
    }
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
        <Tooltip title="Trigger Manual Execution" key="trigger">
          <Button
            type="text"
            icon={<PlayCircleOutlined />}
            onClick={() => onTrigger?.(workflow.id)}
            disabled={workflow.status === 'error'}
          >
            Trigger
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
    >
      <div style={{ minHeight: '120px' }}>
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
              {workflow.status === 'error' && (
                <Tag color="red" size="small">
                  Attention Required
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
        </Space>
      </div>
    </Card>
  )
}