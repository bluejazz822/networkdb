import React, { useState, useCallback } from 'react'
import { Typography, Row, Col, Space, Divider, Button, message } from 'antd'
import { PlusOutlined, SettingOutlined, HistoryOutlined } from '@ant-design/icons'
import WorkflowMetrics from './WorkflowMetrics'
import WorkflowStatusGrid from './WorkflowStatusGrid'

const { Title, Paragraph } = Typography

function DataSyncPage() {
  const [loading, setLoading] = useState(false)

  // Mock data for metrics - will be replaced with real API data
  const metricsData = {
    totalWorkflows: 6,
    activeWorkflows: 4,
    successfulExecutions: 847,
    failedExecutions: 23,
    lastSyncTime: new Date(Date.now() - 5 * 60000).toISOString() // 5 minutes ago
  }

  const handleCreateWorkflow = useCallback(() => {
    message.info('Create workflow functionality will be implemented in future updates')
    // TODO: Navigate to workflow creation page or open modal
  }, [])

  const handleViewHistory = useCallback(() => {
    message.info('Workflow history functionality will be implemented in future updates')
    // TODO: Navigate to workflow history page or open modal
  }, [])

  const handleSettings = useCallback(() => {
    message.info('Settings functionality will be implemented in future updates')
    // TODO: Navigate to settings page or open modal
  }, [])

  return (
    <div style={{ padding: '24px', backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              Data Synchronization Dashboard
            </Title>
            <Paragraph type="secondary" style={{ margin: '8px 0 0 0' }}>
              Monitor and manage n8n workflow synchronization with Network CMDB
            </Paragraph>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<HistoryOutlined />}
                onClick={handleViewHistory}
              >
                View History
              </Button>
              <Button
                icon={<SettingOutlined />}
                onClick={handleSettings}
              >
                Settings
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleCreateWorkflow}
              >
                Create Workflow
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {/* Metrics Section */}
      <div style={{ marginBottom: '24px' }}>
        <WorkflowMetrics
          totalWorkflows={metricsData.totalWorkflows}
          activeWorkflows={metricsData.activeWorkflows}
          successfulExecutions={metricsData.successfulExecutions}
          failedExecutions={metricsData.failedExecutions}
          lastSyncTime={metricsData.lastSyncTime}
          loading={loading}
        />
      </div>

      <Divider />

      {/* Workflow Status Grid */}
      <div style={{ marginBottom: '24px' }}>
        <WorkflowStatusGrid
          title="Workflow Status Overview"
          autoRefresh={true}
          refreshInterval={30000}
          onCreateWorkflow={handleCreateWorkflow}
        />
      </div>

      {/* Additional Information */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <div style={{
            padding: '16px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #f0f0f0'
          }}>
            <Title level={4}>System Features</Title>
            <ul>
              <li>Real-time workflow monitoring and status tracking</li>
              <li>Automated data synchronization with n8n workflows</li>
              <li>Email alert notifications for critical events</li>
              <li>Historical reporting and analytics dashboard</li>
              <li>Multi-provider network resource management</li>
              <li>Manual trigger capabilities for immediate sync</li>
            </ul>
          </div>
        </Col>

        <Col xs={24} lg={12}>
          <div style={{
            padding: '16px',
            backgroundColor: '#fff',
            borderRadius: '8px',
            border: '1px solid #f0f0f0'
          }}>
            <Title level={4}>Integration Status</Title>
            <Space direction="vertical" style={{ width: '100%' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>n8n API Connection:</span>
                <span style={{ color: '#52c41a', fontWeight: 'bold' }}>Connected</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Database Schema:</span>
                <span style={{ color: '#52c41a', fontWeight: 'bold' }}>Initialized</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Email Service:</span>
                <span style={{ color: '#52c41a', fontWeight: 'bold' }}>Active</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Monitoring Service:</span>
                <span style={{ color: '#52c41a', fontWeight: 'bold' }}>Running</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Auto-sync Enabled:</span>
                <span style={{ color: '#52c41a', fontWeight: 'bold' }}>Yes</span>
              </div>
            </Space>
          </div>
        </Col>
      </Row>
    </div>
  )
}

export default DataSyncPage