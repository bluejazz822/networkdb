import React from 'react'
import { Row, Col, Card, Statistic, Typography, Space, Alert } from 'antd'
import {
  GlobalOutlined,
  CloudOutlined,
  BranchesOutlined,
  SwapOutlined,
} from '@ant-design/icons'

const { Title } = Typography

const Dashboard: React.FC = () => {
  // Mock data - will be replaced with actual API calls
  const dashboardStats = {
    totalDevices: 124,
    activeDevices: 118,
    totalVPCs: 8,
    totalSubnets: 45,
  }

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div>
          <Title level={2}>Dashboard</Title>
          <p style={{ color: '#8c8c8c' }}>
            Overview of your network infrastructure and configuration management database
          </p>
        </div>

        <Alert
          message="Welcome to Network CMDB Dashboard"
          description="This is a comprehensive network configuration management database dashboard. Use the navigation menu to explore different network components."
          type="info"
          showIcon
          closable
        />

        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card className="dashboard-stat-card">
              <Statistic
                title="Network Devices"
                value={dashboardStats.totalDevices}
                prefix={<GlobalOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={12} lg={6}>
            <Card className="dashboard-stat-card">
              <Statistic
                title="Active Devices"
                value={dashboardStats.activeDevices}
                prefix={<GlobalOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={12} lg={6}>
            <Card className="dashboard-stat-card">
              <Statistic
                title="VPCs"
                value={dashboardStats.totalVPCs}
                prefix={<CloudOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={12} lg={6}>
            <Card className="dashboard-stat-card">
              <Statistic
                title="Subnets"
                value={dashboardStats.totalSubnets}
                prefix={<BranchesOutlined />}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="Recent Activity" className="dashboard-card">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div>
                  <strong>Device Added:</strong> Router-001 in us-east-1
                  <div style={{ color: '#8c8c8c', fontSize: '12px' }}>2 minutes ago</div>
                </div>
                <div>
                  <strong>VPC Created:</strong> prod-vpc-001 (10.0.0.0/16)
                  <div style={{ color: '#8c8c8c', fontSize: '12px' }}>1 hour ago</div>
                </div>
                <div>
                  <strong>Subnet Updated:</strong> public-subnet-001 status changed to active
                  <div style={{ color: '#8c8c8c', fontSize: '12px' }}>3 hours ago</div>
                </div>
              </Space>
            </Card>
          </Col>
          
          <Col xs={24} lg={12}>
            <Card title="System Health" className="dashboard-card">
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Database Connection</span>
                  <span style={{ color: '#52c41a' }}>● Online</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>API Services</span>
                  <span style={{ color: '#52c41a' }}>● Healthy</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Monitoring</span>
                  <span style={{ color: '#52c41a' }}>● Active</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Last Sync</span>
                  <span style={{ color: '#8c8c8c' }}>5 minutes ago</span>
                </div>
              </Space>
            </Card>
          </Col>
        </Row>

        <Card title="Quick Actions" className="dashboard-card">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" hoverable>
                <div style={{ textAlign: 'center' }}>
                  <GlobalOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
                  <div style={{ marginTop: '8px' }}>Add Device</div>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" hoverable>
                <div style={{ textAlign: 'center' }}>
                  <CloudOutlined style={{ fontSize: '24px', color: '#722ed1' }} />
                  <div style={{ marginTop: '8px' }}>Create VPC</div>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" hoverable>
                <div style={{ textAlign: 'center' }}>
                  <BranchesOutlined style={{ fontSize: '24px', color: '#faad14' }} />
                  <div style={{ marginTop: '8px' }}>Add Subnet</div>
                </div>
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small" hoverable>
                <div style={{ textAlign: 'center' }}>
                  <SwapOutlined style={{ fontSize: '24px', color: '#52c41a' }} />
                  <div style={{ marginTop: '8px' }}>Configure TGW</div>
                </div>
              </Card>
            </Col>
          </Row>
        </Card>
      </Space>
    </div>
  )
}

export default Dashboard