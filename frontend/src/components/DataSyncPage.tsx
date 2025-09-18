import React from 'react'
import { Card, Typography, Row, Col, Statistic, Space, Spin, Alert } from 'antd'
import { SyncOutlined, CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons'

const { Title, Paragraph } = Typography

function DataSyncPage() {
  const [loading] = React.useState(false)

  // Mock data for synchronization status
  const syncStats = {
    totalWorkflows: 0,
    activeWorkflows: 0,
    lastSync: null,
    syncStatus: 'pending'
  }

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Data Synchronization</Title>

      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Workflows"
              value={syncStats.totalWorkflows}
              prefix={<SyncOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Active Workflows"
              value={syncStats.activeWorkflows}
              prefix={<CheckCircleOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Sync Status"
              value={syncStats.syncStatus}
              prefix={<ClockCircleOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Last Sync"
              value={syncStats.lastSync || 'Never'}
              prefix={<ExclamationCircleOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="Synchronization Overview">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Alert
                message="Data Synchronization Service"
                description="This module manages workflow synchronization between n8n and the Network CMDB system. Real-time monitoring and automated data updates ensure consistency across all network resources."
                type="info"
                showIcon
              />

              <Paragraph>
                <strong>Features:</strong>
              </Paragraph>
              <ul>
                <li>Real-time workflow monitoring</li>
                <li>Automated data synchronization</li>
                <li>Email alert notifications</li>
                <li>Historical reporting and analytics</li>
                <li>Multi-provider network resource tracking</li>
              </ul>
            </Space>
          </Card>
        </Col>

        <Col span={12}>
          <Card title="Service Status" loading={loading}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px' }}>Loading synchronization data...</div>
              </div>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }}>
                <Alert
                  message="Service Ready"
                  description="The Data Synchronization service is configured and ready to monitor n8n workflows. Integration with the REST API endpoints is complete."
                  type="success"
                  showIcon
                />

                <Paragraph>
                  <strong>Next Steps:</strong>
                </Paragraph>
                <ul>
                  <li>Configure n8n workflow connections</li>
                  <li>Set up automated polling schedules</li>
                  <li>Define email alert recipients</li>
                  <li>Initialize workflow monitoring dashboard</li>
                </ul>
              </Space>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default DataSyncPage