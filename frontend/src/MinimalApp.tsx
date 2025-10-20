import React from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
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
  EyeOutlined,
  AmazonOutlined,
  WindowsOutlined,
  AlipayOutlined,
  ApiOutlined,
  GoogleOutlined,
  CloudOutlined,
  SyncOutlined,
  FileTextOutlined,
  BarChartOutlined,
  CalendarOutlined,
  LockOutlined,
  ClusterOutlined,
  LinkOutlined
} from '@ant-design/icons'
import ProviderNetworkPage from './components/ProviderNetworkPage'
import DataSyncPage from './components/DataSyncPage'
import LoginForm from './components/LoginForm'
import ReportBuilder from './components/ReportBuilder'
import ReportViewer from './components/ReportViewer'
import ScheduledReports from './components/ScheduledReports'
import { AuthProvider, useAuth } from './contexts/AuthContext'

const { Header, Sider, Content } = Layout
const { Title } = Typography

// Create a QueryClient instance
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
})

// Helper functions for provider colors
const getProviderColor = (provider?: string) => {
  switch (provider?.toLowerCase()) {
    case 'aws': return '#FF9900'
    case 'ali': return '#FF6A00'
    case 'azure': return '#0078D4'
    case 'huawei': return '#FF0000'
    case 'oci': return '#F80000'
    case 'others': return '#722ED1'
    default: return '#1890ff'
  }
}

const getProviderTagColor = (provider?: string) => {
  switch (provider?.toLowerCase()) {
    case 'aws': return 'orange'
    case 'ali': return 'red'
    case 'azure': return 'blue'
    case 'huawei': return 'volcano'
    case 'oci': return 'red'
    case 'others': return 'purple'
    default: return 'default'
  }
}

interface VPCData {
  VpcId?: string;
  vpc_id?: string;
  VNetName?: string; // Azure
  VcnId?: string; // OCI
  VcnName?: string; // OCI
  Region?: string;
  region?: string;
  Location?: string; // Azure
  CidrBlock?: string;
  cidr_block?: string;
  AddressSpaces?: string; // Azure
  AccountId?: string;
  owner_id?: string;
  SubscriptionId?: string; // Azure
  ResourceGroup?: string; // Azure
  CompartmentName?: string; // OCI
  CompartmentId?: string; // OCI
  LifecycleState?: string; // OCI
  Name?: string;
  'ENV Name'?: string;
  tags?: { Environment?: string };
  state?: string;
  status?: string;
  provider?: string;
  providerIcon?: string;
}

function MinimalDashboard() {
  const [vpcData, setVpcData] = React.useState<VPCData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);

  const fetchVPCs = React.useCallback(async () => {
    setLoading(true);
    try {
      // Fetch data from all cloud providers with data
      const providers = ['aws', 'ali', 'azure', 'huawei', 'oci', 'others'];
      const fetchPromises = providers.map(async (provider) => {
        try {
          const response = await fetch(`/api/vpcs/${provider}`);
          const result = await response.json();
          if (result.success) {
            // Add provider info to each VPC record
            return result.data.map((vpc: any) => ({
              ...vpc,
              provider: provider.toUpperCase(),
              providerIcon: provider
            }));
          }
          return [];
        } catch (error) {
          console.log(`Could not fetch ${provider} VPC data:`, error);
          return [];
        }
      });

      const results = await Promise.all(fetchPromises);
      const allVpcData = results.flat();

      setVpcData(allVpcData);
      setLastUpdated(new Date());
      console.log(`Dashboard loaded ${allVpcData.length} VPCs from ${providers.length} providers`);
    } catch (error) {
      console.log('Could not fetch VPC data from API, using mock data');
      setVpcData([
        { vpc_id: 'vpc-12345', region: 'us-east-1', cidr_block: '10.0.0.0/16', state: 'available', provider: 'MOCK' },
        { vpc_id: 'vpc-67890', region: 'us-west-2', cidr_block: '10.1.0.0/16', state: 'available', provider: 'MOCK' }
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

  const regions = [...new Set(vpcData.map(vpc =>
    vpc.Region || vpc.region || vpc.Location || vpc.Site
  ).filter(Boolean))];

  const accounts = [...new Set(vpcData.map(vpc =>
    vpc.AccountId || vpc.owner_id || vpc.SubscriptionId || vpc.Tenant
  ).filter(Boolean))];

  const environments = [...new Set(vpcData.map(vpc =>
    vpc['ENV Name'] || vpc.tags?.Environment
  ).filter(Boolean))];

  const providers = [...new Set(vpcData.map(vpc => vpc.provider).filter(Boolean))];

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
              title="Cloud Providers"
              value={providers.length}
              prefix={<CloudServerOutlined />}
              loading={loading}
            />
            {providers.length > 0 && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                {providers.join(', ')}
              </div>
            )}
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
            <p><strong>Database Status:</strong> {vpcData.length > 0 ? `✅ Connected to MySQL database (${providers.length} providers)` : '⚠️ Using mock data'}</p>
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
                {vpcData.slice(0, 4).map((vpc, index) => {
                  const vpcId = vpc.VpcId || vpc.vpc_id || vpc.VNetName || vpc.VcnId || vpc.id
                  const vpcName = vpc.Name || vpc.VNetName || vpc.VcnName
                  const region = vpc.Region || vpc.region || vpc.Location || vpc.Site
                  const cidr = vpc.CidrBlock || vpc.cidr_block || vpc.AddressSpaces
                  const account = vpc.AccountId || vpc.owner_id || vpc.SubscriptionId || vpc.CompartmentName || vpc.Tenant

                  return (
                    <div key={vpcId || index} style={{
                      marginBottom: '12px',
                      padding: '12px',
                      background: '#f5f5f5',
                      borderRadius: '6px',
                      borderLeft: `4px solid ${getProviderColor(vpc.provider)}`
                    }}>
                      <div style={{ marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <strong>{vpcId}</strong>
                          {vpcName && <span style={{ marginLeft: '8px', color: '#666' }}>({vpcName})</span>}
                        </div>
                        <Tag color={getProviderTagColor(vpc.provider)} size="small">
                          {vpc.provider}
                        </Tag>
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        <span>{region}</span>
                        {cidr && <> • <span>{cidr}</span></>}
                        {account && <> • <span>{account}</span></>}
                        {vpc['ENV Name'] && <> • <span>{vpc['ENV Name']}</span></>}
                      </div>
                    </div>
                  )
                })}
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


function ProviderVPCPage() {
  return (
    <div style={{ padding: '24px' }}>
      <ProviderNetworkPage networkType="vpcs" />
    </div>
  )
}

function ProviderLoadBalancerPage() {
  return (
    <div style={{ padding: '24px' }}>
      <ProviderNetworkPage networkType="loadbalancers" />
    </div>
  )
}

function ProviderNatGatewayPage() {
  return (
    <div style={{ padding: '24px' }}>
      <ProviderNetworkPage networkType="natgateways" />
    </div>
  )
}

function ProviderVpnConnectionPage() {
  return (
    <div style={{ padding: '24px' }}>
      <ProviderNetworkPage networkType="vpnconnections" />
    </div>
  )
}

function ProviderTransitGatewayAttachmentPage() {
  return (
    <div style={{ padding: '24px' }}>
      <ProviderNetworkPage networkType="transitgatewayattachments" />
    </div>
  )
}

function ProviderVpcEndpointPage() {
  return (
    <div style={{ padding: '24px' }}>
      <ProviderNetworkPage networkType="vpcendpoints" />
    </div>
  )
}

function ReportsPage() {
  return <ReportViewer showDashboard={true} />
}

function ReportBuilderPage() {
  return <ReportBuilder />
}

function ScheduledReportsPage() {
  return <ScheduledReports />
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
  const [openKeys, setOpenKeys] = React.useState<string[]>([])

  const currentPath = location.pathname
  const getSelectedKeys = (path: string): string[] => {
    if (path === '/' || path === '/dashboard') return ['dashboard']
    
    // Handle provider-specific paths
    if (path.includes('/vpcs/')) {
      const provider = path.split('/')[2]
      return ['vpcs', `vpcs-${provider}`]
    }
    if (path.includes('/loadbalancers/')) {
      const provider = path.split('/')[2]
      return ['loadbalancers', `loadbalancers-${provider}`]
    }
    if (path.includes('/natgateways/')) {
      const provider = path.split('/')[2]
      return ['natgateways', `natgateways-${provider}`]
    }
    if (path.includes('/vpnconnections/')) {
      const provider = path.split('/')[2]
      return ['vpnconnections', `vpnconnections-${provider}`]
    }
    if (path.includes('/transitgatewayattachments/')) {
      const provider = path.split('/')[2]
      return ['transitgatewayattachments', `transitgatewayattachments-${provider}`]
    }
    if (path.includes('/vpcendpoints/')) {
      const provider = path.split('/')[2]
      return ['vpcendpoints', `vpcendpoints-${provider}`]
    }
    
    // Handle main category paths
    if (path === '/vpcs') return ['vpcs']
    if (path === '/loadbalancers') return ['loadbalancers']
    if (path === '/natgateways') return ['natgateways']
    if (path === '/vpnconnections') return ['vpnconnections']
    if (path === '/transitgatewayattachments') return ['transitgatewayattachments']
    if (path === '/vpcendpoints') return ['vpcendpoints']
    if (path === '/data-sync') return ['data-sync']

    // Handle report paths
    if (path === '/reports') return ['reports']
    if (path === '/reports/dashboard') return ['reports', 'reports-dashboard']
    if (path === '/reports/builder') return ['reports', 'reports-builder']
    if (path === '/reports/scheduled') return ['reports', 'reports-scheduled']

    return ['dashboard']
  }
  
  const selectedKeys = getSelectedKeys(currentPath)
  
  // Auto-open the submenu when navigating to a provider-specific page
  React.useEffect(() => {
    if (selectedKeys.length > 1) {
      setOpenKeys(prev => {
        const parentKey = selectedKeys[0]
        if (!prev.includes(parentKey)) {
          return [...prev, parentKey]
        }
        return prev
      })
    }
  }, [selectedKeys])

  const handleMenuClick = (path: string) => {
    navigate(path)
  }

  const handleOpenChange = (keys: string[]) => {
    setOpenKeys(keys)
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
          selectedKeys={selectedKeys}
          openKeys={openKeys}
          onOpenChange={handleOpenChange}
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
              children: [
                {
                  key: 'vpcs-aws',
                  icon: <AmazonOutlined />,
                  label: 'AWS',
                  onClick: () => handleMenuClick('/vpcs/aws')
                },
                {
                  key: 'vpcs-azure',
                  icon: <WindowsOutlined />,
                  label: 'Azure',
                  onClick: () => handleMenuClick('/vpcs/azure')
                },
                {
                  key: 'vpcs-ali',
                  icon: <AlipayOutlined />,
                  label: 'Alibaba Cloud',
                  onClick: () => handleMenuClick('/vpcs/ali')
                },
                {
                  key: 'vpcs-oci',
                  icon: <ApiOutlined />,
                  label: 'Oracle Cloud',
                  onClick: () => handleMenuClick('/vpcs/oci')
                },
                {
                  key: 'vpcs-gcp',
                  icon: <GoogleOutlined />,
                  label: 'Google Cloud',
                  onClick: () => handleMenuClick('/vpcs/gcp')
                },
                {
                  key: 'vpcs-huawei',
                  icon: <CloudOutlined />,
                  label: 'Huawei Cloud',
                  onClick: () => handleMenuClick('/vpcs/huawei')
                },
                {
                  key: 'vpcs-others',
                  icon: <CloudServerOutlined />,
                  label: 'Others',
                  onClick: () => handleMenuClick('/vpcs/others')
                }
              ]
            },
            {
              key: 'loadbalancers',
              icon: <CloudServerOutlined />,
              label: 'Load Balancers',
              children: [
                {
                  key: 'loadbalancers-aws',
                  icon: <AmazonOutlined />,
                  label: 'AWS',
                  onClick: () => handleMenuClick('/loadbalancers/aws')
                },
                {
                  key: 'loadbalancers-azure',
                  icon: <WindowsOutlined />,
                  label: 'Azure',
                  onClick: () => handleMenuClick('/loadbalancers/azure')
                },
                {
                  key: 'loadbalancers-ali',
                  icon: <AlipayOutlined />,
                  label: 'Alibaba Cloud',
                  onClick: () => handleMenuClick('/loadbalancers/ali')
                },
                {
                  key: 'loadbalancers-oci',
                  icon: <ApiOutlined />,
                  label: 'Oracle Cloud',
                  onClick: () => handleMenuClick('/loadbalancers/oci')
                },
                {
                  key: 'loadbalancers-huawei',
                  icon: <CloudOutlined />,
                  label: 'Huawei Cloud',
                  onClick: () => handleMenuClick('/loadbalancers/huawei')
                }
              ]
            },
            {
              key: 'natgateways',
              icon: <GlobalOutlined />,
              label: 'NAT Gateways',
              children: [
                {
                  key: 'natgateways-aws',
                  icon: <AmazonOutlined />,
                  label: 'AWS',
                  onClick: () => handleMenuClick('/natgateways/aws')
                },
                {
                  key: 'natgateways-azure',
                  icon: <WindowsOutlined />,
                  label: 'Azure',
                  onClick: () => handleMenuClick('/natgateways/azure')
                },
                {
                  key: 'natgateways-ali',
                  icon: <AlipayOutlined />,
                  label: 'Alibaba Cloud',
                  onClick: () => handleMenuClick('/natgateways/ali')
                },
                {
                  key: 'natgateways-oci',
                  icon: <ApiOutlined />,
                  label: 'Oracle Cloud',
                  onClick: () => handleMenuClick('/natgateways/oci')
                },
                {
                  key: 'natgateways-huawei',
                  icon: <CloudOutlined />,
                  label: 'Huawei Cloud',
                  onClick: () => handleMenuClick('/natgateways/huawei')
                }
              ]
            },
            {
              key: 'vpnconnections',
              icon: <LockOutlined />,
              label: 'VPN Connections',
              children: [
                {
                  key: 'vpnconnections-aws',
                  icon: <AmazonOutlined />,
                  label: 'AWS',
                  onClick: () => handleMenuClick('/vpnconnections/aws')
                },
                {
                  key: 'vpnconnections-azure',
                  icon: <WindowsOutlined />,
                  label: 'Azure',
                  onClick: () => handleMenuClick('/vpnconnections/azure')
                },
                {
                  key: 'vpnconnections-ali',
                  icon: <AlipayOutlined />,
                  label: 'Alibaba Cloud',
                  onClick: () => handleMenuClick('/vpnconnections/ali')
                },
                {
                  key: 'vpnconnections-oci',
                  icon: <ApiOutlined />,
                  label: 'Oracle Cloud',
                  onClick: () => handleMenuClick('/vpnconnections/oci')
                },
                {
                  key: 'vpnconnections-huawei',
                  icon: <CloudOutlined />,
                  label: 'Huawei Cloud',
                  onClick: () => handleMenuClick('/vpnconnections/huawei')
                }
              ]
            },
            {
              key: 'transitgatewayattachments',
              icon: <ClusterOutlined />,
              label: 'Transit Gateways',
              children: [
                {
                  key: 'transitgatewayattachments-aws',
                  icon: <AmazonOutlined />,
                  label: 'AWS',
                  onClick: () => handleMenuClick('/transitgatewayattachments/aws')
                },
                {
                  key: 'transitgatewayattachments-azure',
                  icon: <WindowsOutlined />,
                  label: 'Azure',
                  onClick: () => handleMenuClick('/transitgatewayattachments/azure')
                },
                {
                  key: 'transitgatewayattachments-ali',
                  icon: <AlipayOutlined />,
                  label: 'Alibaba Cloud',
                  onClick: () => handleMenuClick('/transitgatewayattachments/ali')
                },
                {
                  key: 'transitgatewayattachments-oci',
                  icon: <ApiOutlined />,
                  label: 'Oracle Cloud',
                  onClick: () => handleMenuClick('/transitgatewayattachments/oci')
                },
                {
                  key: 'transitgatewayattachments-gcp',
                  icon: <GoogleOutlined />,
                  label: 'Google Cloud',
                  onClick: () => handleMenuClick('/transitgatewayattachments/gcp')
                },
                {
                  key: 'transitgatewayattachments-huawei',
                  icon: <CloudOutlined />,
                  label: 'Huawei Cloud',
                  onClick: () => handleMenuClick('/transitgatewayattachments/huawei')
                },
                {
                  key: 'transitgatewayattachments-others',
                  icon: <CloudServerOutlined />,
                  label: 'Others',
                  onClick: () => handleMenuClick('/transitgatewayattachments/others')
                }
              ]
            },
            {
              key: 'vpcendpoints',
              icon: <LinkOutlined />,
              label: 'Private Link',
              children: [
                {
                  key: 'vpcendpoints-aws',
                  icon: <AmazonOutlined />,
                  label: 'AWS',
                  onClick: () => handleMenuClick('/vpcendpoints/aws')
                },
                {
                  key: 'vpcendpoints-azure',
                  icon: <WindowsOutlined />,
                  label: 'Azure',
                  onClick: () => handleMenuClick('/vpcendpoints/azure')
                },
                {
                  key: 'vpcendpoints-ali',
                  icon: <AlipayOutlined />,
                  label: 'Alibaba Cloud',
                  onClick: () => handleMenuClick('/vpcendpoints/ali')
                },
                {
                  key: 'vpcendpoints-oci',
                  icon: <ApiOutlined />,
                  label: 'Oracle Cloud',
                  onClick: () => handleMenuClick('/vpcendpoints/oci')
                },
                {
                  key: 'vpcendpoints-gcp',
                  icon: <GoogleOutlined />,
                  label: 'Google Cloud',
                  onClick: () => handleMenuClick('/vpcendpoints/gcp')
                },
                {
                  key: 'vpcendpoints-huawei',
                  icon: <CloudOutlined />,
                  label: 'Huawei Cloud',
                  onClick: () => handleMenuClick('/vpcendpoints/huawei')
                }
              ]
            },
            {
              key: 'reports',
              icon: <FileTextOutlined />,
              label: 'Reports',
              children: [
                {
                  key: 'reports-dashboard',
                  icon: <BarChartOutlined />,
                  label: 'Dashboard',
                  onClick: () => handleMenuClick('/reports')
                },
                {
                  key: 'reports-builder',
                  icon: <FileTextOutlined />,
                  label: 'Report Builder',
                  onClick: () => handleMenuClick('/reports/builder')
                },
                {
                  key: 'reports-scheduled',
                  icon: <CalendarOutlined />,
                  label: 'Scheduled Reports',
                  onClick: () => handleMenuClick('/reports/scheduled')
                }
              ]
            },
            {
              key: 'data-sync',
              icon: <SyncOutlined />,
              label: 'Data Synchronization',
              onClick: () => handleMenuClick('/data-sync')
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
            
            {/* VPC Routes */}
            <Route path="/vpcs" element={<Navigate to="/vpcs/aws" replace />} />
            <Route path="/vpcs/:provider" element={<ProviderVPCPage />} />

            {/* Reports Routes */}
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reports/builder" element={<ReportBuilderPage />} />
            <Route path="/reports/scheduled" element={<ScheduledReportsPage />} />

            {/* Data Synchronization Route */}
            <Route path="/data-sync" element={<DataSyncPage />} />

            {/* Load Balancer Routes */}
            <Route path="/loadbalancers" element={<Navigate to="/loadbalancers/aws" replace />} />
            <Route path="/loadbalancers/:provider" element={<ProviderLoadBalancerPage />} />

            {/* NAT Gateway Routes */}
            <Route path="/natgateways" element={<Navigate to="/natgateways/aws" replace />} />
            <Route path="/natgateways/:provider" element={<ProviderNatGatewayPage />} />

            {/* VPN Connection Routes */}
            <Route path="/vpnconnections" element={<Navigate to="/vpnconnections/aws" replace />} />
            <Route path="/vpnconnections/:provider" element={<ProviderVpnConnectionPage />} />

            {/* Transit Gateway Attachment Routes */}
            <Route path="/transitgatewayattachments" element={<Navigate to="/transitgatewayattachments/aws" replace />} />
            <Route path="/transitgatewayattachments/:provider" element={<ProviderTransitGatewayAttachmentPage />} />

            {/* VPC Endpoint Routes */}
            <Route path="/vpcendpoints" element={<Navigate to="/vpcendpoints/aws" replace />} />
            <Route path="/vpcendpoints/:provider" element={<ProviderVpcEndpointPage />} />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Content>
      </Layout>
    </Layout>
  )
}

function AppContent() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <LoginForm />
  }

  return <AuthenticatedApp />
}

function MinimalApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true
        }}
      >
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  )
}


function App() {
  return <MinimalApp />
}

export default App