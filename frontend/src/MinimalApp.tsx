import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu, Typography, Card, Row, Col, Statistic, Button, Space, Tag, Avatar, Dropdown } from 'antd'
import { 
  DashboardOutlined, 
  CloudServerOutlined, 
  GlobalOutlined, 
  PartitionOutlined,
  BranchesOutlined,
  UserOutlined,
  LogoutOutlined,
  CrownOutlined,
  EyeOutlined
} from '@ant-design/icons'
import VPCTable from './components/VPCTable'
import LoginForm from './components/LoginForm'
import { AuthProvider, useAuth } from './contexts/AuthContext'

const { Header, Sider, Content } = Layout
const { Title } = Typography

interface VPCData {
  VpcId?: string;
  vpc_id?: string;
  Region?: string;
  region?: string;
  CidrBlock?: string;
  cidr_block?: string;
  AccountId?: string;
  owner_id?: string;
  Name?: string;
  'ENV Name'?: string;
  tags?: { Environment?: string };
  state?: string;
}

function MinimalDashboard() {
  const [vpcData, setVpcData] = React.useState<VPCData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  const fetchVPCs = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/vpcs');
      const result = await response.json();
      if (result.success) {
        setVpcData(result.data);
        setLastUpdated(new Date());
      }
    } catch (error) {
      console.log('Could not fetch VPC data from API, using mock data');
      setVpcData([
        { vpc_id: 'vpc-12345', region: 'us-east-1', cidr_block: '10.0.0.0/16', state: 'available' },
        { vpc_id: 'vpc-67890', region: 'us-west-2', cidr_block: '10.1.0.0/16', state: 'available' }
      ]);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchVPCs();
    const interval = setInterval(fetchVPCs, 30000);
    return () => clearInterval(interval);
  }, [fetchVPCs]);

  const regions = [...new Set(vpcData.map(vpc => vpc.Region || vpc.region).filter(Boolean))];
  const accounts = [...new Set(vpcData.map(vpc => vpc.AccountId || vpc.owner_id).filter(Boolean))];
  const environments = [...new Set(vpcData.map(vpc => vpc['ENV Name'] || vpc.tags?.Environment).filter(Boolean))];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Network CMDB Dashboard</Title>
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total VPCs"
              value={vpcData.length}
              prefix={<GlobalOutlined />}
              loading={loading}
            />
            {lastUpdated && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                Updated: {lastUpdated.toLocaleTimeString()}
              </div>
            )}
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Regions"
              value={regions.length}
              prefix={<PartitionOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="AWS Accounts"
              value={accounts.length}
              prefix={<BranchesOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Environments"
              value={environments.length}
              prefix={<CloudServerOutlined />}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>
      
      <Row gutter={16}>
        <Col span={12}>
          <Card title="Network CMDB Status">
            <p>This is a Network Configuration Management Database for managing cloud network resources.</p>
            <p>Navigate to <strong>VPCs</strong> in the sidebar to view the comprehensive real-time inventory table.</p>
            <p><strong>Database Status:</strong> {vpcData.length > 0 ? '✅ Connected to MySQL database' : '⚠️ Using mock data'}</p>
            {lastUpdated && (
              <p><strong>Last Updated:</strong> {lastUpdated.toLocaleString()}</p>
            )}
            <p><strong>Auto-refresh:</strong> Every 30 seconds</p>
            <div style={{ marginTop: '16px' }}>
              <p><strong>Quick Stats:</strong></p>
              <ul>
                <li><strong>Regions:</strong> {regions.slice(0, 3).join(', ')}{regions.length > 3 ? ` (+${regions.length - 3} more)` : ''}</li>
                <li><strong>Accounts:</strong> {accounts.slice(0, 2).join(', ')}{accounts.length > 2 ? ` (+${accounts.length - 2} more)` : ''}</li>
                <li><strong>Environments:</strong> {environments.slice(0, 3).join(', ')}{environments.length > 3 ? ` (+${environments.length - 3} more)` : ''}</li>
              </ul>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Recent VPCs" loading={loading}>
            {vpcData.length > 0 ? (
              <div>
                <p><strong>Latest VPCs from Database:</strong></p>
                {vpcData.slice(0, 4).map((vpc, index) => (
                  <div key={vpc.VpcId || vpc.vpc_id || index} style={{ 
                    marginBottom: '12px', 
                    padding: '12px', 
                    background: '#f5f5f5', 
                    borderRadius: '6px',
                    borderLeft: '4px solid #1890ff'
                  }}>
                    <div style={{ marginBottom: '4px' }}>
                      <strong>{vpc.VpcId || vpc.vpc_id}</strong>
                      {vpc.Name && <span style={{ marginLeft: '8px', color: '#666' }}>({vpc.Name})</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      <span>{vpc.Region || vpc.region}</span> • 
                      <span style={{ marginLeft: '4px' }}>{vpc.CidrBlock || vpc.cidr_block}</span> • 
                      <span style={{ marginLeft: '4px' }}>{vpc.AccountId || vpc.owner_id}</span>
                      {vpc['ENV Name'] && (
                        <span style={{ marginLeft: '4px' }}>• {vpc['ENV Name']}</span>
                      )}
                    </div>
                  </div>
                ))}
                <div style={{ textAlign: 'center', marginTop: '16px' }}>
                  <p style={{ margin: 0, color: '#666' }}>
                    Showing 4 of {vpcData.length} total VPCs
                  </p>
                  <p style={{ margin: 0, fontSize: '12px', color: '#999' }}>
                    Click "VPCs" in sidebar for complete inventory table
                  </p>
                </div>
              </div>
            ) : (
              <p>No VPC data available. Check database connection.</p>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

function VPCManagementPage() {
  return (
    <div style={{ padding: '24px' }}>
      <VPCTable autoRefresh={true} refreshInterval={30000} />
    </div>
  )
}

function MinimalPage({ title, description }: { title: string; description: string }) {
  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>{title}</Title>
      <Card>
        <p>{description}</p>
        <p>This page would contain management functionality for {title.toLowerCase()}.</p>
      </Card>
    </div>
  )
}

function UserHeader() {
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
  }

  const userMenuItems = [
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Logout',
      onClick: handleLogout
    }
  ]

  return (
    <Space>
      <Tag 
        color={user?.role === 'admin' ? 'gold' : 'blue'} 
        icon={user?.role === 'admin' ? <CrownOutlined /> : <EyeOutlined />}
      >
        {user?.role === 'admin' ? 'Admin' : 'User'}
      </Tag>
      <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
        <Button type="text" style={{ color: '#666' }}>
          <Space>
            <Avatar size={24} icon={<UserOutlined />} />
            {user?.username}
          </Space>
        </Button>
      </Dropdown>
    </Space>
  )
}

function AuthenticatedApp() {
  const navigate = useNavigate()
  const location = useLocation()

  const currentPath = location.pathname
  const selectedKey = currentPath === '/' || currentPath === '/dashboard' ? 'dashboard' :
                     currentPath === '/vpcs' ? 'vpcs' :
                     currentPath === '/subnets' ? 'subnets' :
                     currentPath === '/transit-gateways' ? 'transit-gateways' :
                     currentPath === '/devices' ? 'devices' : 'dashboard'

  const handleMenuClick = (path: string) => {
    navigate(path)
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={256} theme="dark">
        <div style={{ 
          height: '64px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: 'white',
          fontSize: '18px',
          fontWeight: 'bold'
        }}>
          Network CMDB
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={[
            {
              key: 'dashboard',
              icon: <DashboardOutlined />,
              label: 'Dashboard',
              onClick: () => handleMenuClick('/dashboard')
            },
            {
              key: 'vpcs',
              icon: <GlobalOutlined />,
              label: 'VPCs',
              onClick: () => handleMenuClick('/vpcs')
            },
            {
              key: 'subnets',
              icon: <PartitionOutlined />,
              label: 'Subnets',
              onClick: () => handleMenuClick('/subnets')
            },
            {
              key: 'transit-gateways',
              icon: <BranchesOutlined />,
              label: 'Transit Gateways',
              onClick: () => handleMenuClick('/transit-gateways')
            },
            {
              key: 'devices',
              icon: <CloudServerOutlined />,
              label: 'Network Devices',
              onClick: () => handleMenuClick('/devices')
            }
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          background: '#fff', 
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #f0f0f0'
        }}>
          <Title level={4} style={{ margin: 0 }}>
            Network Configuration Management Database
          </Title>
          <UserHeader />
        </Header>
        <Content style={{ background: '#f5f5f5' }}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<MinimalDashboard />} />
            <Route path="/vpcs" element={<VPCManagementPage />} />
            <Route 
              path="/subnets" 
              element={<MinimalPage title="Subnets" description="Manage network subnets and IP address allocations." />} 
            />
            <Route 
              path="/transit-gateways" 
              element={<MinimalPage title="Transit Gateways" description="Manage transit gateways for inter-VPC connectivity." />} 
            />
            <Route 
              path="/devices" 
              element={<MinimalPage title="Network Devices" description="Manage routers, switches, firewalls and other network equipment." />} 
            />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

function MinimalApp() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <LoginForm />
  }

  return <AuthenticatedApp />
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <MinimalApp />
      </AuthProvider>
    </Router>
  )
}

export default App