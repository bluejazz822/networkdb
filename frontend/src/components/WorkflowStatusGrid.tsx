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
  Spin,
  Badge
} from 'antd'
import {
  ReloadOutlined,
  SearchOutlined,
  PlusOutlined,
  SyncOutlined,
  FilterOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  HistoryOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import WorkflowStatusCard, { WorkflowData } from './WorkflowStatusCard'
import DynamicTable from './DynamicTable'
import ManualSyncModal from './ManualSyncModal'
import WorkflowHistoryModal from './WorkflowHistoryModal'
import { useSmartWorkflowRefresh, useMultipleWorkflowProgress } from '@/hooks/useWorkflowProgress'
import { apiClient } from '@/utils/api'

const { Title, Text } = Typography
const { Option } = Select

interface WorkflowStatusGridProps {
  title?: string
  autoRefresh?: boolean
  refreshInterval?: number
  onCreateWorkflow?: () => void
}

// API response interface
interface WorkflowResponse {
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
  const [manualSyncModalVisible, setManualSyncModalVisible] = useState(false)
  const [preselectedWorkflowIds, setPreselectedWorkflowIds] = useState<string[]>([])
  const [historyModalVisible, setHistoryModalVisible] = useState(false)
  const [selectedWorkflowForHistory, setSelectedWorkflowForHistory] = useState<{ id: string; name: string } | null>(null)

  // Enhanced refresh and progress tracking
  const smartRefresh = useSmartWorkflowRefresh(workflows)
  const progressTracker = useMultipleWorkflowProgress(workflows.map(w => w.id))

  // Fetch workflows data
  const fetchWorkflows = useCallback(async () => {
    setLoading(true)
    try {
      console.log('🔍 Fetching workflows from /workflows...')
      const response = await apiClient.get<WorkflowResponse>('/workflows')
      console.log('✅ Workflows response:', response)

      const result = response.data
      if (result.success && result.data && result.data.workflows && Array.isArray(result.data.workflows)) {
        // Transform the API data to match WorkflowData interface
        const transformedWorkflows: WorkflowData[] = result.data.workflows.map((workflow: any) => ({
          id: workflow.workflow_id || workflow.id || String(Math.random()),
          name: workflow.workflow_name || workflow.name || 'Unknown Workflow',
          status: workflow.is_active ? 'active' : 'inactive',
          lastExecution: workflow.updated_at || workflow.lastExecution || null,
          executionCount: workflow.executionCount || 0,
          successRate: workflow.successRate || 0,
          description: workflow.description || `${workflow.workflow_type} workflow for ${workflow.provider}`,
          nextExecution: workflow.nextExecution || null
        }))

        setWorkflows(transformedWorkflows)
        setLastUpdated(new Date())
        console.log('📊 Transformed workflows:', transformedWorkflows)
      } else {
        // If no workflows found, set empty array
        setWorkflows([])
        setLastUpdated(new Date())
        console.log('ℹ️ No workflows found')
      }
    } catch (error) {
      console.error('❌ Error fetching workflows:', error)
      message.error('Failed to fetch workflow data')
      // Set empty array on error
      setWorkflows([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  // Enhanced auto refresh with smart intervals
  useEffect(() => {
    if (!autoRefreshEnabled) return

    const interval = setInterval(() => {
      fetchWorkflows().catch(error => {
        console.error('Auto-refresh failed:', error)
        smartRefresh.incrementErrorCount()
      })
    }, smartRefresh.refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefreshEnabled, smartRefresh.refreshInterval, fetchWorkflows, smartRefresh])

  // Start progress tracking for running workflows
  useEffect(() => {
    workflows.forEach(workflow => {
      if (['running', 'queued'].includes(workflow.status)) {
        progressTracker.startPolling(workflow.id)
      }
    })
  }, [workflows, progressTracker])

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
      console.log('🚀 Triggering workflow:', workflowId)
      await apiClient.post(`/workflows/${workflowId}/trigger`)
      message.success('Workflow triggered successfully')
      // Refresh data after triggering
      setTimeout(fetchWorkflows, 1000)
    } catch (error) {
      console.error('❌ Error triggering workflow:', error)
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
      console.log('🔄 Updating workflow status:', workflowId, newStatus)
      await apiClient.put(`/workflows/${workflowId}/status`, {
        status: newStatus,
        is_active: newStatus === 'active'
      })

      // Update local state optimistically
      setWorkflows(prev => prev.map(workflow =>
        workflow.id === workflowId
          ? { ...workflow, status: newStatus }
          : workflow
      ))

      message.success(`Workflow ${newStatus === 'active' ? 'activated' : 'paused'} successfully`)
    } catch (error) {
      console.error('❌ Error updating workflow status:', error)
      message.error('Failed to update workflow status')
      // Refresh to get actual state
      fetchWorkflows()
    }
  }, [fetchWorkflows])

  // Handle manual sync modal
  const handleOpenManualSyncModal = useCallback((preselectedIds: string[] = []) => {
    setPreselectedWorkflowIds(preselectedIds)
    setManualSyncModalVisible(true)
  }, [])

  const handleCloseManualSyncModal = useCallback(() => {
    setManualSyncModalVisible(false)
    setPreselectedWorkflowIds([])
  }, [])

  const handleManualSyncSuccess = useCallback(() => {
    // Refresh data after successful sync
    fetchWorkflows()
    setManualSyncModalVisible(false)
    setPreselectedWorkflowIds([])
    smartRefresh.resetErrorCount()
  }, [fetchWorkflows, smartRefresh])

  // Handle workflow history modal
  const handleOpenHistoryModal = useCallback((workflowId: string, workflowName: string) => {
    setSelectedWorkflowForHistory({ id: workflowId, name: workflowName })
    setHistoryModalVisible(true)
  }, [])

  const handleCloseHistoryModal = useCallback(() => {
    setHistoryModalVisible(false)
    setSelectedWorkflowForHistory(null)
  }, [])

  const statusOptions = [
    { label: 'All', value: '' },
    { label: 'Running', value: 'running' },
    { label: 'Active', value: 'active' },
    { label: 'Queued', value: 'queued' },
    { label: 'Completed', value: 'completed' },
    { label: 'Scheduled', value: 'scheduled' },
    { label: 'Paused', value: 'paused' },
    { label: 'Inactive', value: 'inactive' },
    { label: 'Failed', value: 'failed' },
    { label: 'Error', value: 'error' },
    { label: 'Cancelled', value: 'cancelled' },
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
              workflow={{
                ...workflow,
                progress: progressTracker.progressData.get(workflow.id)
              }}
              loading={loading}
              onTrigger={handleTriggerWorkflow}
              onView={handleViewWorkflow}
              onEdit={handleEditWorkflow}
              onToggleStatus={handleToggleWorkflowStatus}
              onSync={(workflowId) => handleOpenManualSyncModal([workflowId])}
              onViewHistory={handleOpenHistoryModal}
            />
          </Col>
        ))}
      </Row>
    )
  }

  const renderTableView = () => {
    // Use DynamicTable for table view with real API endpoint
    return (
      <DynamicTable
        apiEndpoint="/workflows"
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
            <Space>
              <Title level={3} style={{ margin: 0 }}>
                <SyncOutlined /> {title} ({filteredWorkflows.length} of {workflows.length})
              </Title>
              {smartRefresh.hasRunningWorkflows && (
                <Badge status="processing" text="Live Updates" />
              )}
              {smartRefresh.hasErrorWorkflows && (
                <Badge status="error" text="Issues Detected" />
              )}
              {progressTracker.isAnyPolling && (
                <Badge status="processing" text={`${progressTracker.pollingWorkflows.length} Running`} />
              )}
            </Space>
          </Col>
          <Col>
            <Space>
              <Text type="secondary">
                {lastUpdated && `Updated: ${lastUpdated.toLocaleTimeString()}`}
              </Text>
              {smartRefresh.errorCount > 0 && (
                <Text type="warning" style={{ fontSize: '11px' }}>
                  ({smartRefresh.errorCount} errors)
                </Text>
              )}
              <Tooltip title={`Smart refresh: ${smartRefresh.refreshInterval / 1000}s intervals`}>
                <Switch
                  checked={autoRefreshEnabled}
                  onChange={setAutoRefreshEnabled}
                  checkedChildren="Auto"
                  unCheckedChildren="Manual"
                />
              </Tooltip>
              <Tooltip title="Toggle View Mode">
                <Space.Compact>
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
                </Space.Compact>
              </Tooltip>
              <Button
                icon={<SyncOutlined />}
                onClick={() => handleOpenManualSyncModal()}
                type="primary"
                ghost
              >
                Manual Sync
              </Button>
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
              {smartRefresh.errorCount > 0 && (
                <Tooltip title="Force refresh and reset error count">
                  <Button
                    icon={<ThunderboltOutlined />}
                    onClick={smartRefresh.forceRefresh}
                    type="primary"
                    ghost
                    danger
                  >
                    Force Reset
                  </Button>
                </Tooltip>
              )}
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

      {/* Manual Sync Modal */}
      <ManualSyncModal
        visible={manualSyncModalVisible}
        onCancel={handleCloseManualSyncModal}
        onSuccess={handleManualSyncSuccess}
        preselectedWorkflows={preselectedWorkflowIds}
      />

      {/* Workflow History Modal */}
      <WorkflowHistoryModal
        visible={historyModalVisible}
        workflowId={selectedWorkflowForHistory?.id || null}
        workflowName={selectedWorkflowForHistory?.name}
        onCancel={handleCloseHistoryModal}
      />
    </Card>
  )
}