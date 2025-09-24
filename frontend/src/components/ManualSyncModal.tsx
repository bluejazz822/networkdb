import React, { useState, useCallback, useMemo } from 'react'
import {
  Modal,
  Form,
  Radio,
  Button,
  Space,
  Typography,
  Card,
  Row,
  Col,
  message,
  Statistic,
  Checkbox,
  Input,
  Alert,
  Spin,
  List,
  Tag,
  Tooltip,
  Divider
} from 'antd'
import {
  SyncOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons'
import { useWorkflowActions, useBatchWorkflowActions } from '@/hooks/useWorkflowActions'
import { useWorkflowData } from '@/hooks/useWorkflowData'
import type { Workflow, SyncFormData } from '@/types/workflow'
import { getWorkflowStatusConfig } from '@/utils/workflowHelpers'

const { Title, Text, Paragraph } = Typography
const { Search } = Input

interface ManualSyncModalProps {
  visible: boolean
  onCancel: () => void
  onSuccess?: () => void
  preselectedWorkflows?: string[]
}

type SyncType = 'full' | 'selective' | 'force_full'

interface SyncOption {
  value: SyncType
  label: string
  icon: React.ReactNode
  description: string
  color: string
  riskLevel: 'low' | 'medium' | 'high'
  estimatedTime: string
}

export default function ManualSyncModal({
  visible,
  onCancel,
  onSuccess,
  preselectedWorkflows = []
}: ManualSyncModalProps) {
  const [form] = Form.useForm<SyncFormData>()
  const [syncType, setSyncType] = useState<SyncType>('full')
  const [selectedWorkflowIds, setSelectedWorkflowIds] = useState<string[]>(preselectedWorkflows)
  const [searchText, setSearchText] = useState('')
  const [showConfirmation, setShowConfirmation] = useState(false)

  // Hooks
  const { syncWorkflows, isSyncing } = useWorkflowActions()
  const { triggerMultiple, isBatchTriggering } = useBatchWorkflowActions()
  const { workflows, isLoading: loadingWorkflows } = useWorkflowData({
    enabled: visible && syncType === 'selective'
  })

  const isBusy = isSyncing || isBatchTriggering

  // Sync options configuration
  const syncOptions: SyncOption[] = [
    {
      value: 'full',
      label: 'Full Sync (Standard)',
      icon: <SyncOutlined />,
      description: 'Synchronize all workflows with incremental updates. Safe for production use.',
      color: '#52c41a',
      riskLevel: 'low',
      estimatedTime: '2-5 minutes'
    },
    {
      value: 'selective',
      label: 'Selective Sync',
      icon: <CheckCircleOutlined />,
      description: 'Synchronize only selected workflows. Faster and more controlled.',
      color: '#1890ff',
      riskLevel: 'low',
      estimatedTime: '30 seconds - 2 minutes'
    },
    {
      value: 'force_full',
      label: 'Force Full Sync (Advanced)',
      icon: <ThunderboltOutlined />,
      description: 'Force refresh all workflows, clearing cached data. Use when data inconsistencies are detected.',
      color: '#fa8c16',
      riskLevel: 'high',
      estimatedTime: '5-15 minutes'
    }
  ]

  // Filter workflows for selective sync
  const filteredWorkflows = useMemo(() => {
    if (!workflows) return []
    return workflows.filter(workflow =>
      !searchText ||
      workflow.name.toLowerCase().includes(searchText.toLowerCase()) ||
      workflow.id.toLowerCase().includes(searchText.toLowerCase())
    )
  }, [workflows, searchText])

  // Calculate sync statistics
  const syncStats = useMemo(() => {
    const selectedOption = syncOptions.find(opt => opt.value === syncType)
    let workflowCount = 0
    let affectedWorkflows = 0

    switch (syncType) {
      case 'full':
      case 'force_full':
        workflowCount = workflows?.length || 0
        affectedWorkflows = workflows?.filter(w => w.active).length || 0
        break
      case 'selective':
        workflowCount = selectedWorkflowIds.length
        affectedWorkflows = workflows?.filter(w =>
          selectedWorkflowIds.includes(w.id) && w.active
        ).length || 0
        break
    }

    return {
      workflowCount,
      affectedWorkflows,
      estimatedTime: selectedOption?.estimatedTime || 'Unknown',
      riskLevel: selectedOption?.riskLevel || 'medium'
    }
  }, [syncType, selectedWorkflowIds, workflows])

  // Handle workflow selection for selective sync
  const handleWorkflowSelection = useCallback((workflowIds: string[]) => {
    setSelectedWorkflowIds(workflowIds)
  }, [])

  const toggleWorkflowSelection = useCallback((workflowId: string) => {
    setSelectedWorkflowIds(prev =>
      prev.includes(workflowId)
        ? prev.filter(id => id !== workflowId)
        : [...prev, workflowId]
    )
  }, [])

  const selectAllWorkflows = useCallback(() => {
    setSelectedWorkflowIds(filteredWorkflows.map(w => w.id))
  }, [filteredWorkflows])

  const clearAllWorkflows = useCallback(() => {
    setSelectedWorkflowIds([])
  }, [])

  // Handle sync execution
  const executeSync = useCallback(async () => {
    try {
      switch (syncType) {
        case 'full':
          await syncWorkflows({ force: false })
          break
        case 'force_full':
          await syncWorkflows({ force: true })
          break
        case 'selective':
          if (selectedWorkflowIds.length === 0) {
            message.warning('Please select at least one workflow to sync')
            return
          }
          await syncWorkflows({
            force: false,
            workflowIds: selectedWorkflowIds
          })
          break
      }

      message.success(`${syncType === 'selective' ? 'Selective' : 'Full'} sync initiated successfully`)
      onSuccess?.()
      onCancel()
      setShowConfirmation(false)
    } catch (error) {
      console.error('Sync execution failed:', error)
      // Error message is handled by the hook
      setShowConfirmation(false)
    }
  }, [syncType, selectedWorkflowIds, syncWorkflows, onSuccess, onCancel])

  const handleSync = useCallback(() => {
    // Show confirmation for risky operations
    if (syncType === 'force_full' || (syncType === 'selective' && selectedWorkflowIds.length > 10)) {
      setShowConfirmation(true)
    } else {
      executeSync()
    }
  }, [syncType, selectedWorkflowIds.length, executeSync])

  const handleCancel = useCallback(() => {
    if (!isBusy) {
      setShowConfirmation(false)
      onCancel()
    }
  }, [isBusy, onCancel])

  // Render sync type selection
  const renderSyncOptions = () => (
    <div style={{ marginBottom: 24 }}>
      <Title level={5}>Select Sync Type</Title>
      <Radio.Group
        value={syncType}
        onChange={(e) => setSyncType(e.target.value)}
        style={{ width: '100%' }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {syncOptions.map(option => (
            <Radio key={option.value} value={option.value}>
              <Card
                size="small"
                style={{
                  marginLeft: 8,
                  border: syncType === option.value ? `2px solid ${option.color}` : '1px solid #d9d9d9'
                }}
              >
                <Row align="middle">
                  <Col flex="auto">
                    <Space>
                      <span style={{ color: option.color }}>{option.icon}</span>
                      <div>
                        <Text strong>{option.label}</Text>
                        <Tag color={option.riskLevel === 'high' ? 'red' : option.riskLevel === 'medium' ? 'orange' : 'green'} size="small" style={{ marginLeft: 8 }}>
                          {option.riskLevel.toUpperCase()}
                        </Tag>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {option.description}
                        </Text>
                      </div>
                    </Space>
                  </Col>
                  <Col>
                    <Space direction="vertical" align="end" size="small">
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        <ClockCircleOutlined /> {option.estimatedTime}
                      </Text>
                    </Space>
                  </Col>
                </Row>
              </Card>
            </Radio>
          ))}
        </Space>
      </Radio.Group>
    </div>
  )

  // Render workflow selection for selective sync
  const renderWorkflowSelection = () => {
    if (syncType !== 'selective') return null

    return (
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Title level={5} style={{ margin: 0 }}>Select Workflows to Sync</Title>
          <Space>
            <Button size="small" onClick={selectAllWorkflows} disabled={filteredWorkflows.length === 0}>
              Select All ({filteredWorkflows.length})
            </Button>
            <Button size="small" onClick={clearAllWorkflows} disabled={selectedWorkflowIds.length === 0}>
              Clear All
            </Button>
          </Space>
        </div>

        <Search
          placeholder="Search workflows..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ marginBottom: 12 }}
          allowClear
        />

        {loadingWorkflows ? (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin />
            <div style={{ marginTop: 8 }}>Loading workflows...</div>
          </div>
        ) : (
          <div style={{
            maxHeight: 300,
            overflowY: 'auto',
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            padding: 8
          }}>
            <List
              dataSource={filteredWorkflows}
              renderItem={(workflow) => {
                const isSelected = selectedWorkflowIds.includes(workflow.id)
                const statusConfig = getWorkflowStatusConfig(workflow.active ? 'active' : 'inactive')

                return (
                  <List.Item
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? '#f6ffed' : 'transparent',
                      border: isSelected ? '1px solid #52c41a' : '1px solid transparent',
                      borderRadius: 4,
                      marginBottom: 4
                    }}
                    onClick={() => toggleWorkflowSelection(workflow.id)}
                  >
                    <List.Item.Meta
                      avatar={
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleWorkflowSelection(workflow.id)}
                        />
                      }
                      title={
                        <Space>
                          <Text strong={isSelected}>{workflow.name}</Text>
                          <Tag color={statusConfig.color} size="small">
                            {statusConfig.label}
                          </Tag>
                        </Space>
                      }
                      description={
                        <Space size="large">
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            ID: {workflow.id}
                          </Text>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            Updated: {new Date(workflow.updatedAt).toLocaleDateString()}
                          </Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )
              }}
              locale={{
                emptyText: searchText
                  ? `No workflows found matching "${searchText}"`
                  : 'No workflows available'
              }}
            />
          </div>
        )}
      </div>
    )
  }

  // Render sync statistics
  const renderSyncStats = () => (
    <Card size="small" style={{ marginBottom: 16, backgroundColor: '#fafafa' }}>
      <Row gutter={16}>
        <Col span={6}>
          <Statistic
            title="Workflows to Sync"
            value={syncStats.workflowCount}
            valueStyle={{ color: syncStats.workflowCount > 0 ? '#1890ff' : '#ff4d4f' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Active Workflows"
            value={syncStats.affectedWorkflows}
            suffix={`/ ${syncStats.workflowCount}`}
            valueStyle={{ color: '#52c41a' }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Estimated Time"
            value={syncStats.estimatedTime}
            valueStyle={{ color: '#722ed1', fontSize: 14 }}
          />
        </Col>
        <Col span={6}>
          <Statistic
            title="Risk Level"
            value={syncStats.riskLevel.toUpperCase()}
            valueStyle={{
              color: syncStats.riskLevel === 'high' ? '#ff4d4f' :
                     syncStats.riskLevel === 'medium' ? '#fa8c16' : '#52c41a',
              fontSize: 14
            }}
          />
        </Col>
      </Row>
    </Card>
  )

  // Render confirmation dialog
  const renderConfirmationDialog = () => (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#fa8c16' }} />
          Confirm Sync Operation
        </Space>
      }
      open={showConfirmation}
      onCancel={() => setShowConfirmation(false)}
      footer={[
        <Button key="cancel" onClick={() => setShowConfirmation(false)}>
          Cancel
        </Button>,
        <Button
          key="confirm"
          type="primary"
          danger={syncType === 'force_full'}
          loading={isBusy}
          onClick={executeSync}
        >
          {syncType === 'force_full' ? 'Force Sync' : 'Confirm Sync'}
        </Button>
      ]}
      width={500}
    >
      <Alert
        message={syncType === 'force_full' ? "High Risk Operation" : "Confirm Sync Operation"}
        description={
          syncType === 'force_full'
            ? "Force sync will clear all cached data and re-download everything from n8n. This operation may take a long time and could temporarily affect system performance."
            : `You are about to sync ${syncStats.workflowCount} workflow(s). This operation will take approximately ${syncStats.estimatedTime}.`
        }
        type={syncType === 'force_full' ? 'warning' : 'info'}
        showIcon
        style={{ marginBottom: 16 }}
      />

      {renderSyncStats()}

      {syncType === 'selective' && selectedWorkflowIds.length > 10 && (
        <Alert
          message="Large Selective Sync"
          description={`You have selected ${selectedWorkflowIds.length} workflows. Consider using Full Sync for better performance when syncing many workflows.`}
          type="warning"
          showIcon
          style={{ marginTop: 12 }}
        />
      )}
    </Modal>
  )

  return (
    <>
      <Modal
        title={
          <Space>
            <SyncOutlined />
            Manual Workflow Synchronization
          </Space>
        }
        open={visible && !showConfirmation}
        onCancel={handleCancel}
        width={800}
        footer={[
          <Button key="cancel" onClick={handleCancel} disabled={isBusy}>
            Cancel
          </Button>,
          <Button
            key="sync"
            type="primary"
            loading={isBusy}
            onClick={handleSync}
            disabled={
              (syncType === 'selective' && selectedWorkflowIds.length === 0) ||
              (loadingWorkflows && syncType === 'selective')
            }
            icon={<SyncOutlined />}
          >
            {isBusy ? 'Syncing...' : 'Start Sync'}
          </Button>
        ]}
      >
        <Form form={form} layout="vertical">
          <Alert
            message="Workflow Synchronization"
            description="Synchronize workflow data from n8n to ensure your local database has the latest workflow definitions, settings, and metadata."
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
            icon={<InfoCircleOutlined />}
          />

          {renderSyncStats()}

          <Divider />

          {renderSyncOptions()}

          {renderWorkflowSelection()}
        </Form>
      </Modal>

      {renderConfirmationDialog()}
    </>
  )
}