import React from 'react'
import { Row, Col, Card, Statistic, Typography, Space, Alert, Skeleton, Tag } from 'antd'
import {
  GlobalOutlined,
  CloudOutlined,
  BranchesOutlined,
  SwapOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useDashboardStats, useRecentActivity, useSystemHealth } from '@/hooks/useDashboard'

const { Title, Paragraph } = Typography

const DashboardNew: React.FC = () => {
  const navigate = useNavigate()
  
  // Data hooks
  const { data: stats, isLoading: statsLoading } = useDashboardStats()
  const { data: activities, isLoading: activitiesLoading } = useRecentActivity()
  const { data: health, isLoading: healthLoading } = useSystemHealth()

  // Mock data fallback for when backend is not available
  const mockStats = {
    totalDevices: 124,
    activeDevices: 118,
    totalVPCs: 8,
    totalSubnets: 45,
    totalTransitGateways: 3,
  }

  const mockActivities = [
    {
      id: '1',
      type: 'device',
      action: 'created',
      resource: 'Router-001',
      timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      description: 'Router-001 added in us-east-1',
    },
    {
      id: '2',
      type: 'vpc',
      action: 'created',
      resource: 'prod-vpc-001',
      timestamp: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
      description: 'VPC prod-vpc-001 created with CIDR 10.0.0.0/16',
    },
    {
      id: '3',
      type: 'subnet',
      action: 'updated',
      resource: 'public-subnet-001',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      description: 'Subnet public-subnet-001 status changed to active',
    },
  ]

  const mockHealth = {
    database: 'online' as const,
    api: 'healthy' as const,
    monitoring: 'active' as const,
    lastSync: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
  }

  // Use real data if available, otherwise fallback to mock data
  const dashboardStats = stats || mockStats
  const recentActivities = activities || mockActivities
  const systemHealth = health || mockHealth

  const getHealthStatus = (status: string) => {
    switch (status) {
      case 'online':
      case 'healthy':
      case 'active':
        return { color: '#52c41a', icon: '●', text: status.toUpperCase() }
      case 'degraded':
      case 'warning':
        return { color: '#faad14', icon: '●', text: status.toUpperCase() }
      case 'offline':
      case 'unhealthy':
      case 'inactive':
        return { color: '#ff4d4f', icon: '●', text: status.toUpperCase() }
      default:
        return { color: '#d9d9d9', icon: '●', text: 'UNKNOWN' }
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'device':
        return <GlobalOutlined style={{ color: '#1890ff' }} />
      case 'vpc':
        return <CloudOutlined style={{ color: '#722ed1' }} />
      case 'subnet':
        return <BranchesOutlined style={{ color: '#faad14' }} />
      case 'transit-gateway':
        return <SwapOutlined style={{ color: '#52c41a' }} />
      default:
        return <ExclamationCircleOutlined style={{ color: '#8c8c8c' }} />
    }
  }

  const getTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))
    
    if (diffMinutes < 1) return 'just now'
    if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes > 1 ? 's' : ''} ago`
    
    const diffHours = Math.floor(diffMinutes / 60)
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div>
          <Title level={2}>Dashboard</Title>
          <Paragraph style={{ color: '#8c8c8c', fontSize: '16px' }}>
            Overview of your network infrastructure and configuration management database
          </Paragraph>
        </div>

        {/* Welcome Alert */}
        <Alert
          message="Welcome to Network CMDB Dashboard"
          description="Monitor and manage your network infrastructure from this centralized dashboard. Use the navigation menu to explore different network components."
          type="info"
          showIcon
          closable
        />

        {/* Statistics Cards */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <Card 
              hoverable
              onClick={() => navigate('/devices')}
              style={{ cursor: 'pointer' }}
            >
              {statsLoading ? (
                <Skeleton active paragraph={{ rows: 2 }} />
              ) : (
                <Statistic
                  title="Network Devices"
                  value={dashboardStats.totalDevices}
                  prefix={<GlobalOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
              )}
            </Card>
          </Col>
          
          <Col xs={24} sm={12} lg={6}>
            <Card 
              hoverable
              onClick={() => navigate('/devices')}
              style={{ cursor: 'pointer' }}
            >
              {statsLoading ? (
                <Skeleton active paragraph={{ rows: 2 }} />
              ) : (
                <Statistic
                  title="Active Devices"
                  value={dashboardStats.activeDevices}
                  prefix={<CheckCircleOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                  suffix={`/ ${dashboardStats.totalDevices}`}
                />
              )}
            </Card>
          </Col>
          
          <Col xs={24} sm={12} lg={6}>
            <Card 
              hoverable
              onClick={() => navigate('/vpcs')}
              style={{ cursor: 'pointer' }}
            >
              {statsLoading ? (
                <Skeleton active paragraph={{ rows: 2 }} />
              ) : (
                <Statistic
                  title="VPCs"
                  value={dashboardStats.totalVPCs}
                  prefix={<CloudOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
              )}
            </Card>
          </Col>
          
          <Col xs={24} sm={12} lg={6}>
            <Card 
              hoverable
              onClick={() => navigate('/subnets')}
              style={{ cursor: 'pointer' }}
            >
              {statsLoading ? (
                <Skeleton active paragraph={{ rows: 2 }} />
              ) : (
                <Statistic
                  title="Subnets"
                  value={dashboardStats.totalSubnets}
                  prefix={<BranchesOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
              )}
            </Card>
          </Col>
        </Row>

        {/* Main Content */}
        <Row gutter={[16, 16]}>
          {/* Recent Activity */}
          <Col xs={24} lg={12}>
            <Card title="Recent Activity" style={{ height: '400px' }}>
              {activitiesLoading ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {[1, 2, 3].map(key => (
                    <Skeleton key={key} active avatar paragraph={{ rows: 1 }} />
                  ))}
                </Space>
              ) : (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {recentActivities.map((activity) => (
                    <div key={activity.id} style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        {getActivityIcon(activity.type)}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 500, marginBottom: 4 }}>
                            {activity.description}
                          </div>
                          <div style={{ fontSize: '12px', color: '#8c8c8c', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <ClockCircleOutlined />
                            {getTimeAgo(activity.timestamp)}
                          </div>
                        </div>
                        <Tag color="blue" size="small">
                          {activity.action.toUpperCase()}
                        </Tag>
                      </div>
                    </div>
                  ))}
                  
                  {recentActivities.length === 0 && (
                    <div style={{ textAlign: 'center', color: '#8c8c8c', padding: '40px 0' }}>
                      <ExclamationCircleOutlined style={{ fontSize: '24px', marginBottom: 8 }} />
                      <div>No recent activity</div>
                    </div>
                  )}
                </Space>
              )}
            </Card>
          </Col>
          
          {/* System Health */}
          <Col xs={24} lg={12}>
            <Card title="System Health" style={{ height: '400px' }}>
              {healthLoading ? (
                <Space direction="vertical" style={{ width: '100%' }}>
                  {[1, 2, 3, 4].map(key => (
                    <Skeleton key={key} active paragraph={{ rows: 1 }} />
                  ))}
                </Space>
              ) : (
                <Space direction="vertical" style={{ width: '100%', gap: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                    <span style={{ fontWeight: 500 }}>Database Connection</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: getHealthStatus(systemHealth.database).color }}>
                        {getHealthStatus(systemHealth.database).icon}
                      </span>
                      <span style={{ color: getHealthStatus(systemHealth.database).color }}>
                        {getHealthStatus(systemHealth.database).text}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                    <span style={{ fontWeight: 500 }}>API Services</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: getHealthStatus(systemHealth.api).color }}>
                        {getHealthStatus(systemHealth.api).icon}
                      </span>
                      <span style={{ color: getHealthStatus(systemHealth.api).color }}>
                        {getHealthStatus(systemHealth.api).text}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                    <span style={{ fontWeight: 500 }}>Monitoring</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: getHealthStatus(systemHealth.monitoring).color }}>
                        {getHealthStatus(systemHealth.monitoring).icon}
                      </span>
                      <span style={{ color: getHealthStatus(systemHealth.monitoring).text }}>
                        {getHealthStatus(systemHealth.monitoring).text}
                      </span>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
                    <span style={{ fontWeight: 500 }}>Last Sync</span>
                    <span style={{ color: '#8c8c8c' }}>
                      {getTimeAgo(systemHealth.lastSync)}
                    </span>
                  </div>
                </Space>
              )}
            </Card>
          </Col>
        </Row>

        {/* Quick Actions */}
        <Card title="Quick Actions">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card 
                size="small" 
                hoverable
                onClick={() => navigate('/devices')}
                style={{ textAlign: 'center', cursor: 'pointer' }}
              >
                <GlobalOutlined style={{ fontSize: '32px', color: '#1890ff', marginBottom: 8 }} />
                <div style={{ fontWeight: 500 }}>Add Device</div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>Network equipment</div>
              </Card>
            </Col>
            
            <Col xs={24} sm={12} md={6}>
              <Card 
                size="small" 
                hoverable
                onClick={() => navigate('/vpcs')}
                style={{ textAlign: 'center', cursor: 'pointer' }}
              >
                <CloudOutlined style={{ fontSize: '32px', color: '#722ed1', marginBottom: 8 }} />
                <div style={{ fontWeight: 500 }}>Create VPC</div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>Virtual private cloud</div>
              </Card>
            </Col>
            
            <Col xs={24} sm={12} md={6}>
              <Card 
                size="small" 
                hoverable
                onClick={() => navigate('/subnets')}
                style={{ textAlign: 'center', cursor: 'pointer' }}
              >
                <BranchesOutlined style={{ fontSize: '32px', color: '#faad14', marginBottom: 8 }} />
                <div style={{ fontWeight: 500 }}>Add Subnet</div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>Network segment</div>
              </Card>
            </Col>
            
            <Col xs={24} sm={12} md={6}>
              <Card 
                size="small" 
                hoverable
                onClick={() => navigate('/transit-gateways')}
                style={{ textAlign: 'center', cursor: 'pointer' }}
              >
                <SwapOutlined style={{ fontSize: '32px', color: '#52c41a', marginBottom: 8 }} />
                <div style={{ fontWeight: 500 }}>Configure TGW</div>
                <div style={{ fontSize: '12px', color: '#8c8c8c' }}>Transit gateway</div>
              </Card>
            </Col>
          </Row>
        </Card>
      </Space>
    </div>
  )
}

export default DashboardNew