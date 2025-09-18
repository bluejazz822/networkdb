import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Card,
  Row,
  Col,
  Typography,
  Button,
  Input,
  Select,
  Space,
  Switch,
  Tooltip,
  message,
  Modal,
  Empty,
  Spin
} from 'antd'
import {
  ReloadOutlined,
  SearchOutlined,
  PlusOutlined,
  SyncOutlined,
  FilterOutlined,
  AppstoreOutlined,
  UnorderedListOutlined
} from '@ant-design/icons'
import WorkflowStatusCard, { WorkflowData } from './WorkflowStatusCard'
import DynamicTable from './DynamicTable'

const { Title, Text } = Typography
const { Option } = Select

interface WorkflowStatusGridProps {
  title?: string
  autoRefresh?: boolean
  refreshInterval?: number
  onCreateWorkflow?: () => void
}

// Mock data interface - will be replaced with real API data
interface MockWorkflowResponse {
  success: boolean
  data: WorkflowData[]
  total: number
  schema?: any[]
}

export default function WorkflowStatusGrid({
  title = 'Workflow Status',
  autoRefresh = true,
  refreshInterval = 30000,
  onCreateWorkflow
}: WorkflowStatusGridProps) {
  const [workflows, setWorkflows] = useState<WorkflowData[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(autoRefresh)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  // Mock data for development - will be replaced with actual API calls
  const generateMockData = useCallback((): WorkflowData[] => {
    return [
      {
        id: '1',
        name: 'Network Device Discovery',
        status: 'active',
        lastExecution: new Date(Date.now() - 5 * 60000).toISOString(), // 5 minutes ago
        executionCount: 147,
        successRate: 98,
        description: 'Automatically discover and catalog network devices across all provider networks',
        nextExecution: new Date(Date.now() + 10 * 60000).toISOString() // 10 minutes from now
      },
      {
        id: '2',
        name: 'VPC Configuration Sync',
        status: 'active',
        lastExecution: new Date(Date.now() - 15 * 60000).toISOString(), // 15 minutes ago
        executionCount: 89,
        successRate: 95,
        description: 'Synchronize VPC configurations and metadata from AWS, Azure, and GCP',
        nextExecution: new Date(Date.now() + 30 * 60000).toISOString() // 30 minutes from now
      },
      {
        id: '3',
        name: 'Compliance Report Generator',
        status: 'error',
        lastExecution: new Date(Date.now() - 2 * 60 * 60000).toISOString(), // 2 hours ago
        executionCount: 23,
        successRate: 74,
        description: 'Generate compliance reports for security and governance teams',
        nextExecution: null
      },
      {
        id: '4',
        name: 'Backup Monitoring',
        status: 'inactive',
        lastExecution: new Date(Date.now() - 24 * 60 * 60000).toISOString(), // 24 hours ago
        executionCount: 312,
        successRate: 99,
        description: 'Monitor backup status across all network infrastructure components',
        nextExecution: null
      },
      {
        id: '5',
        name: 'Alert Notification Service',
        status: 'pending',
        lastExecution: null,
        executionCount: 0,
        successRate: 0,
        description: 'Send email alerts for critical network events and threshold breaches',
        nextExecution: new Date(Date.now() + 60 * 60000).toISOString() // 1 hour from now
      },
      {
        id: '6',
        name: 'Performance Analytics',
        status: 'active',
        lastExecution: new Date(Date.now() - 10 * 60000).toISOString(), // 10 minutes ago
        executionCount: 203,
        successRate: 92,
        description: 'Collect and analyze performance metrics from network devices and services',
        nextExecution: new Date(Date.now() + 20 * 60000).toISOString() // 20 minutes from now
      }
    ]
  }, [])

  // Fetch workflows data
  const fetchWorkflows = useCallback(async () => {
    setLoading(true)
    try {
      // TODO: Replace with actual API call
      // const response = await fetch('/api/workflows')
      // const result: MockWorkflowResponse = await response.json()

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500))

      // Mock response
      const result: MockWorkflowResponse = {
        success: true,
        data: generateMockData(),
        total: 6
      }

      if (result.success) {
        setWorkflows(result.data)
        setLastUpdated(new Date())
      } else {
        throw new Error('Failed to fetch workflows')
      }
    } catch (error) {
      console.error('Error fetching workflows:', error)
      message.error('Failed to fetch workflow data')
    } finally {
      setLoading(false)
    }
  }, [generateMockData])

  // Initial load
  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  // Auto refresh
  useEffect(() => {
    if (!autoRefreshEnabled) return

    const interval = setInterval(fetchWorkflows, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefreshEnabled, refreshInterval, fetchWorkflows])

  // Filter workflows
  const filteredWorkflows = useMemo(() => {
    return workflows.filter(workflow => {
      const matchesSearch = !searchText ||
        workflow.name.toLowerCase().includes(searchText.toLowerCase()) ||
        workflow.description?.toLowerCase().includes(searchText.toLowerCase())

      const matchesStatus = !statusFilter || workflow.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [workflows, searchText, statusFilter])

  // Workflow action handlers
  const handleTriggerWorkflow = useCallback(async (workflowId: string) => {
    try {
      // TODO: Replace with actual API call
      // await fetch(`/api/workflows/${workflowId}/trigger`, { method: 'POST' })

      message.success('Workflow triggered successfully')
      // Refresh data after triggering
      setTimeout(fetchWorkflows, 1000)
    } catch (error) {
      console.error('Error triggering workflow:', error)
      message.error('Failed to trigger workflow')
    }
  }, [fetchWorkflows])

  const handleViewWorkflow = useCallback((workflowId: string) => {
    // TODO: Navigate to workflow details page or open modal
    message.info(`Viewing workflow ${workflowId}`)
  }, [])

  const handleEditWorkflow = useCallback((workflowId: string) => {
    // TODO: Navigate to workflow edit page or open modal
    message.info(`Editing workflow ${workflowId}`)
  }, [])

  const handleToggleWorkflowStatus = useCallback(async (workflowId: string, newStatus: 'active' | 'inactive') => {
    try {
      // TODO: Replace with actual API call
      // await fetch(`/api/workflows/${workflowId}/status`, {
      //   method: 'PUT',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ status: newStatus })
      // })

      // Update local state optimistically
      setWorkflows(prev => prev.map(workflow =>
        workflow.id === workflowId
          ? { ...workflow, status: newStatus }
          : workflow
      ))

      message.success(`Workflow ${newStatus === 'active' ? 'activated' : 'paused'} successfully`)
    } catch (error) {
      console.error('Error updating workflow status:', error)
      message.error('Failed to update workflow status')
      // Refresh to get actual state
      fetchWorkflows()
    }
  }, [fetchWorkflows])

  const statusOptions = [
    { label: 'All', value: '' },
    { label: 'Active', value: 'active' },
    { label: 'Inactive', value: 'inactive' },
    { label: 'Error', value: 'error' },
    { label: 'Pending', value: 'pending' }
  ]

  const renderGridView = () => {
    if (filteredWorkflows.length === 0) {
      return (
        <Empty
          description="No workflows found"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          {workflows.length === 0 && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreateWorkflow}>
              Create First Workflow
            </Button>
          )}
        </Empty>
      )
    }

    return (
      <Row gutter={[16, 16]}>
        {filteredWorkflows.map(workflow => (
          <Col key={workflow.id} xs={24} sm={12} lg={8} xl={6}>
            <WorkflowStatusCard
              workflow={workflow}
              loading={loading}
              onTrigger={handleTriggerWorkflow}
              onView={handleViewWorkflow}
              onEdit={handleEditWorkflow}
              onToggleStatus={handleToggleWorkflowStatus}
            />
          </Col>
        ))}
      </Row>
    )
  }

  const renderTableView = () => {
    // Use DynamicTable for table view with mock API endpoint
    // TODO: Replace with actual workflow API endpoint
    return (
      <DynamicTable
        apiEndpoint="/api/workflows"
        title="Workflows"
        icon={<SyncOutlined />}
        autoRefresh={autoRefreshEnabled}
        refreshInterval={refreshInterval}
      />
    )
  }

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              <SyncOutlined /> {title} ({filteredWorkflows.length} of {workflows.length})
            </Title>
          </Col>
          <Col>
            <Space>
              <Text type="secondary">
                {lastUpdated && `Last updated: ${lastUpdated.toLocaleTimeString()}`}
              </Text>
              <Tooltip title={`Auto-refresh every ${refreshInterval / 1000}s`}>
                <Switch
                  checked={autoRefreshEnabled}
                  onChange={setAutoRefreshEnabled}
                  checkedChildren="Auto"
                  unCheckedChildren="Manual"
                />
              </Tooltip>
              <Tooltip title="Toggle View Mode">
                <Button.Group>
                  <Button
                    type={viewMode === 'grid' ? 'primary' : 'default'}
                    icon={<AppstoreOutlined />}
                    onClick={() => setViewMode('grid')}
                  >
                    Grid
                  </Button>
                  <Button
                    type={viewMode === 'table' ? 'primary' : 'default'}
                    icon={<UnorderedListOutlined />}
                    onClick={() => setViewMode('table')}
                  >
                    Table
                  </Button>
                </Button.Group>
              </Tooltip>
              {onCreateWorkflow && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={onCreateWorkflow}
                >
                  Create Workflow
                </Button>
              )}
              <Button
                icon={<ReloadOutlined />}
                onClick={fetchWorkflows}
                loading={loading}
              >
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Filters */}
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Input
              placeholder="Search workflows..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Select
              placeholder="Filter by status"
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
            >
              {statusOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </div>

      {loading && workflows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <Spin size="large" />
          <div style={{ marginTop: '16px' }}>Loading workflows...</div>
        </div>
      ) : (
        viewMode === 'grid' ? renderGridView() : renderTableView()
      )}
    </Card>
  )
}