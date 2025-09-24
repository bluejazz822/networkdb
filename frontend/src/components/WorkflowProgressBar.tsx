import React from 'react'
import { Progress, Space, Typography, Tooltip, Tag } from 'antd'
import { ClockCircleOutlined, PlayCircleOutlined } from '@ant-design/icons'
import type { WorkflowProgress } from '@/types/workflow'

const { Text } = Typography

interface WorkflowProgressBarProps {
  progress: WorkflowProgress
  size?: 'small' | 'default'
  showDetails?: boolean
}

export default function WorkflowProgressBar({
  progress,
  size = 'default',
  showDetails = true
}: WorkflowProgressBarProps) {
  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`
    }
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`
    }
    return `${seconds}s`
  }

  const getExecutionTime = () => {
    const started = new Date(progress.startedAt).getTime()
    const now = Date.now()
    return now - started
  }

  const formatTimeRemaining = (ms?: number) => {
    if (!ms || ms <= 0) return 'Calculating...'
    return formatDuration(ms)
  }

  const getProgressColor = () => {
    switch (progress.status) {
      case 'running':
        return '#1890ff'
      case 'success':
        return '#52c41a'
      case 'error':
        return '#ff4d4f'
      case 'waiting':
        return '#faad14'
      default:
        return '#d9d9d9'
    }
  }

  const getStatusTag = () => {
    const configs = {
      running: { color: 'blue', text: 'Running' },
      success: { color: 'green', text: 'Completed' },
      error: { color: 'red', text: 'Failed' },
      waiting: { color: 'orange', text: 'Waiting' },
      crashed: { color: 'red', text: 'Crashed' },
      aborted: { color: 'default', text: 'Aborted' },
      cancelled: { color: 'default', text: 'Cancelled' }
    }

    const config = configs[progress.status] || { color: 'default', text: 'Unknown' }
    return <Tag color={config.color} size="small">{config.text}</Tag>
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <Space size={4}>
          <PlayCircleOutlined style={{ color: getProgressColor(), fontSize: size === 'small' ? '12px' : '14px' }} />
          <Text style={{ fontSize: size === 'small' ? '11px' : '12px', fontWeight: 500 }}>
            {progress.currentStep}
          </Text>
        </Space>
        {getStatusTag()}
      </div>

      <Progress
        percent={progress.percentComplete}
        size={size}
        strokeColor={getProgressColor()}
        showInfo={false}
        trailColor="#f5f5f5"
      />

      {showDetails && (
        <div style={{ marginTop: '8px' }}>
          <Space direction="vertical" size={2} style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Step {progress.completedSteps} of {progress.totalSteps}
              </Text>
              <Text style={{ fontSize: '11px', fontWeight: 500 }}>
                {progress.percentComplete.toFixed(1)}%
              </Text>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Space size={4}>
                <ClockCircleOutlined style={{ fontSize: '10px', color: '#8c8c8c' }} />
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  Running: {formatDuration(getExecutionTime())}
                </Text>
              </Space>
              {progress.estimatedTimeRemaining && (
                <Tooltip title="Estimated time remaining">
                  <Text style={{ fontSize: '11px', color: '#1890ff' }}>
                    ETA: {formatTimeRemaining(progress.estimatedTimeRemaining)}
                  </Text>
                </Tooltip>
              )}
            </div>

            {progress.logs && progress.logs.length > 0 && (
              <div style={{
                backgroundColor: '#f6f6f6',
                padding: '4px 8px',
                borderRadius: '4px',
                marginTop: '4px',
                maxHeight: '60px',
                overflow: 'hidden'
              }}>
                <Text style={{
                  fontSize: '10px',
                  color: '#666',
                  display: 'block',
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden'
                }}>
                  {progress.logs[progress.logs.length - 1]}
                </Text>
              </div>
            )}
          </Space>
        </div>
      )}
    </div>
  )
}