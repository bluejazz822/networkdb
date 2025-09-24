import React, { useState, useEffect } from 'react'
import {
  Modal,
  Timeline,
  Table,
  Tabs,
  Typography,
  Space,
  Button,
  Input,
  DatePicker,
  Select,
  Tag,
  Tooltip,
  Empty,
  Spin,
  message
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  LoadingOutlined,
  EyeOutlined,
  DownloadOutlined,
  ReloadOutlined,
  FilterOutlined
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import dayjs from 'dayjs'
import type { WorkflowExecution, ExecutionStatus } from '@/types/workflow'
import { apiClient } from '@/utils/api'

const { Text, Title } = Typography
const { RangePicker } = DatePicker
const { Option } = Select
const { TabPane } = Tabs

interface WorkflowHistoryModalProps {
  visible: boolean
  workflowId: string | null
  workflowName?: string
  onCancel: () => void
}

interface ExecutionHistoryResponse {
  success: boolean
  data: WorkflowExecution[]
  total: number
  page: number
  limit: number
}

interface StatusChangeEvent {
  id: string
  workflowId: string
  timestamp: string
  fromStatus: ExecutionStatus | null
  toStatus: ExecutionStatus
  duration?: number
  details?: string
  triggeredBy?: string
}

export default function WorkflowHistoryModal({
  visible,
  workflowId,
  workflowName,
  onCancel
}: WorkflowHistoryModalProps) {
  const [activeTab, setActiveTab] = useState('executions')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchText, setSearchText] = useState('')

  // Fetch execution history
  const {
    data: executionHistory,
    isLoading: isLoadingExecutions,
    refetch: refetchExecutions,
    error: executionError
  } = useQuery({
    queryKey: ['workflow-execution-history', workflowId, dateRange, statusFilter],
    queryFn: async () => {
      if (!workflowId) return null

      const params = new URLSearchParams({
        workflowId,
        limit: '50',
        sortBy: 'startedAt',
        sortOrder: 'desc'
      })

      if (dateRange) {
        params.append('startedAfter', dateRange[0].toISOString())
        params.append('startedBefore', dateRange[1].toISOString())
      }

      if (statusFilter) {
        params.append('status', statusFilter)
      }

      const response = await apiClient.get<ExecutionHistoryResponse>(`/workflows/executions?${params}`)
      return response.data
    },
    enabled: visible && !!workflowId,
    staleTime: 30000
  })

  const getStatusIcon = (status: ExecutionStatus) => {
    switch (status) {
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />
      case 'running':
        return <LoadingOutlined style={{ color: '#1890ff' }} />
      case 'error':
      case 'crashed':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
      default:
        return <ClockCircleOutlined style={{ color: '#8c8c8c' }} />
    }
  }

  const getStatusColor = (status: ExecutionStatus) => {
    switch (status) {
      case 'success':
        return 'green'
      case 'running':
      case 'waiting':
        return 'blue'
      case 'error':
      case 'crashed':
        return 'red'
      case 'cancelled':
      case 'aborted':
        return 'default'
      default:
        return 'orange'
    }
  }

  const formatDuration = (startedAt: string, stoppedAt?: string) => {
    const start = dayjs(startedAt)
    const end = stoppedAt ? dayjs(stoppedAt) : dayjs()
    const duration = end.diff(start, 'second')

    if (duration < 60) return `${duration}s`
    if (duration < 3600) return `${Math.floor(duration / 60)}m ${duration % 60}s`
    const hours = Math.floor(duration / 3600)
    const minutes = Math.floor((duration % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const executionColumns: ColumnsType<WorkflowExecution> = [
    {
      title: 'Execution ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
      render: (id: string) => (
        <Text code style={{ fontSize: '11px' }}>
          {id.substring(0, 8)}...
        </Text>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ExecutionStatus) => (
        <Space>
          {getStatusIcon(status)}
          <Tag color={getStatusColor(status)} size="small">
            {status.toUpperCase()}
          </Tag>
        </Space>
      )
    },
    {
      title: 'Started',
      dataIndex: 'startedAt',
      key: 'startedAt',
      width: 140,
      render: (startedAt: string) => (
        <Text style={{ fontSize: '12px' }}>
          {dayjs(startedAt).format('MMM DD, HH:mm')}
        </Text>
      )
    },
    {
      title: 'Duration',
      key: 'duration',
      width: 80,
      render: (_, record) => (
        <Text style={{ fontSize: '12px' }}>
          {formatDuration(record.startedAt, record.stoppedAt)}
        </Text>
      )
    },
    {
      title: 'Mode',
      dataIndex: 'mode',
      key: 'mode',
      width: 80,
      render: (mode: string) => (
        <Tag size="small">{mode}</Tag>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space>
          <Tooltip title="View Details">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewExecution(record.id)}
            />
          </Tooltip>
          {record.finished && (
            <Tooltip title="Download Logs">
              <Button
                type="text"
                size="small"
                icon={<DownloadOutlined />}
                onClick={() => handleDownloadLogs(record.id)}
              />
            </Tooltip>
          )}
        </Space>
      )
    }
  ]

  const handleViewExecution = (executionId: string) => {
    message.info(`Viewing execution ${executionId}`)
    // TODO: Open execution details modal or navigate to details page
  }

  const handleDownloadLogs = async (executionId: string) => {
    try {
      // TODO: Implement log download
      message.success(`Downloaded logs for execution ${executionId}`)
    } catch (error) {
      message.error('Failed to download logs')
    }
  }

  const handleClearFilters = () => {
    setDateRange(null)
    setStatusFilter('')
    setSearchText('')
  }

  // Generate status change timeline from execution history
  const generateStatusTimeline = (executions: WorkflowExecution[]) => {
    const events: StatusChangeEvent[] = []

    executions.forEach(execution => {
      events.push({
        id: `${execution.id}-start`,
        workflowId: execution.workflowId,
        timestamp: execution.startedAt,
        fromStatus: null,
        toStatus: 'running',
        details: `Execution started (${execution.mode} mode)`,
        triggeredBy: execution.mode === 'manual' ? 'User' : 'System'
      })

      if (execution.stoppedAt) {
        events.push({
          id: `${execution.id}-end`,
          workflowId: execution.workflowId,
          timestamp: execution.stoppedAt,
          fromStatus: 'running',
          toStatus: execution.status,
          duration: dayjs(execution.stoppedAt).diff(execution.startedAt, 'second'),
          details: `Execution ${execution.status}`,
          triggeredBy: 'System'
        })
      }
    })

    return events.sort((a, b) => dayjs(b.timestamp).diff(dayjs(a.timestamp)))
  }

  const renderTimelineView = () => {
    if (!executionHistory?.data || executionHistory.data.length === 0) {
      return <Empty description="No execution history found" />
    }

    const timelineEvents = generateStatusTimeline(executionHistory.data)

    return (
      <Timeline
        mode="left"
        style={{ marginTop: '16px' }}
        items={timelineEvents.map(event => ({
          dot: getStatusIcon(event.toStatus),
          color: getStatusColor(event.toStatus),
          label: (
            <Text style={{ fontSize: '11px', color: '#8c8c8c' }}>
              {dayjs(event.timestamp).format('MMM DD, HH:mm:ss')}
            </Text>
          ),
          children: (
            <div>
              <Text style={{ fontSize: '13px' }}>{event.details}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '11px' }}>
                Triggered by: {event.triggeredBy}
                {event.duration && ` • Duration: ${event.duration}s`}
              </Text>
            </div>
          )
        }))}
      />
    )
  }

  return (
    <Modal
      title={
        <Space>
          <ClockCircleOutlined />
          <span>Execution History</span>
          {workflowName && <Text type="secondary">- {workflowName}</Text>}
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={900}
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={() => refetchExecutions()}>
          Refresh
        </Button>,
        <Button key="close" onClick={onCancel}>
          Close
        </Button>
      ]}
    >
      {/* Filters */}
      <div style={{ marginBottom: '16px', padding: '12px', backgroundColor: '#fafafa', borderRadius: '6px' }}>
        <Space wrap>
          <RangePicker
            size="small"
            value={dateRange}
            onChange={setDateRange}
            placeholder={['Start Date', 'End Date']}
            style={{ width: 200 }}
          />
          <Select
            size="small"
            placeholder="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 120 }}
            allowClear
          >
            <Option value="success">Success</Option>
            <Option value="error">Error</Option>
            <Option value="running">Running</Option>
            <Option value="cancelled">Cancelled</Option>
            <Option value="waiting">Waiting</Option>
          </Select>
          <Button size="small" icon={<FilterOutlined />} onClick={handleClearFilters}>
            Clear Filters
          </Button>
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="Execution History" key="executions">
          {isLoadingExecutions ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px' }}>Loading execution history...</div>
            </div>
          ) : executionError ? (
            <Empty
              description="Failed to load execution history"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button type="primary" onClick={() => refetchExecutions()}>
                Retry
              </Button>
            </Empty>
          ) : (
            <Table
              dataSource={executionHistory?.data || []}
              columns={executionColumns}
              rowKey="id"
              size="small"
              pagination={{
                total: executionHistory?.total || 0,
                pageSize: 50,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} executions`
              }}
            />
          )}
        </TabPane>
        <TabPane tab="Status Timeline" key="timeline">
          {isLoadingExecutions ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px' }}>Loading status timeline...</div>
            </div>
          ) : (
            renderTimelineView()
          )}
        </TabPane>
      </Tabs>
    </Modal>
  )
}