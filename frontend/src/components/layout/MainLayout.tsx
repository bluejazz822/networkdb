import React, { useEffect } from 'react'
import { Layout, Menu, Typography, Space, Breadcrumb } from 'antd'
import {
  DashboardOutlined,
  GlobalOutlined,
  CloudOutlined,
  BranchesOutlined,
  SwapOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import { UserDropdown } from '@/components/auth'
import { RoleBasedRender } from '@/components/auth'
import { PERMISSIONS } from '@/utils/permissions'

const { Header, Sider, Content } = Layout
const { Title } = Typography

interface MainLayoutProps {
  children: React.ReactNode
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { 
    sidebarCollapsed, 
    toggleSidebar, 
    currentPage, 
    setCurrentPage,
    breadcrumbs,
    setBreadcrumbs 
  } = useAppStore()

  // Page configuration for breadcrumbs and titles
  const pageConfig = {
    '/dashboard': { title: 'Dashboard', breadcrumbs: [{ title: 'Dashboard' }] },
    '/devices': { title: 'Network Devices', breadcrumbs: [{ title: 'Dashboard', path: '/dashboard' }, { title: 'Network Devices' }] },
    '/vpcs': { title: 'VPCs', breadcrumbs: [{ title: 'Dashboard', path: '/dashboard' }, { title: 'VPCs' }] },
    '/subnets': { title: 'Subnets', breadcrumbs: [{ title: 'Dashboard', path: '/dashboard' }, { title: 'Subnets' }] },
    '/transit-gateways': { title: 'Transit Gateways', breadcrumbs: [{ title: 'Dashboard', path: '/dashboard' }, { title: 'Transit Gateways' }] },
  }

  // Update page title and breadcrumbs when route changes
  useEffect(() => {
    const config = pageConfig[location.pathname as keyof typeof pageConfig]
    if (config) {
      setCurrentPage(config.title)
      setBreadcrumbs(config.breadcrumbs)
    }
  }, [location.pathname, setCurrentPage, setBreadcrumbs])

  // Build menu items based on user permissions
  const buildMenuItems = () => {
    const items = [];

    // Dashboard (always visible if authenticated)
    items.push({
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    });

    // Network resources (based on permissions)
    const networkItems = [];
    
    // Network Devices
    networkItems.push({
      key: '/devices',
      icon: <GlobalOutlined />,
      label: 'Network Devices',
      permission: PERMISSIONS.NETWORK_READ,
    });

    // VPCs
    networkItems.push({
      key: '/vpcs',
      icon: <CloudOutlined />,
      label: 'VPCs',
      permission: PERMISSIONS.VPC_READ,
    });

    // Subnets
    networkItems.push({
      key: '/subnets',
      icon: <BranchesOutlined />,
      label: 'Subnets',
      permission: PERMISSIONS.NETWORK_READ,
    });

    // Transit Gateways
    networkItems.push({
      key: '/transit-gateways',
      icon: <SwapOutlined />,
      label: 'Transit Gateways',
      permission: PERMISSIONS.NETWORK_READ,
    });

    // Add network items if user has any network permissions
    items.push(...networkItems);

    // Admin section
    const adminItems = [];
    adminItems.push({
      key: 'admin',
      icon: <SettingOutlined />,
      label: 'Administration',
      type: 'group',
      children: [
        {
          key: '/admin/users',
          label: 'User Management',
          permission: PERMISSIONS.USER_READ,
        },
        {
          key: '/admin/roles',
          label: 'Role Management',
          permission: PERMISSIONS.ROLE_READ,
        },
        {
          key: '/admin/security',
          label: 'Security Dashboard',
          permission: PERMISSIONS.SYSTEM_READ,
        },
      ]
    });

    // Add admin items if user has admin permissions
    items.push(...adminItems);

    return items;
  };

  const menuItems = buildMenuItems()


  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }


  return (
    <>
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={sidebarCollapsed}
        style={{
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1001,
        }}
      >
        <div style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '18px',
          fontWeight: 600,
          borderBottom: '1px solid #001529',
        }}>
          {sidebarCollapsed ? 'CMDB' : 'Network CMDB'}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </Sider>
      
      <Layout style={{ marginLeft: sidebarCollapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        <Header style={{
          background: '#001529',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'fixed',
          top: 0,
          right: 0,
          left: sidebarCollapsed ? 80 : 200,
          zIndex: 1000,
          transition: 'left 0.2s',
        }}>
          <Space align="center">
            {React.createElement(sidebarCollapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              className: 'trigger',
              onClick: toggleSidebar,
              style: { fontSize: '18px', cursor: 'pointer', padding: '0 12px' },
            })}
            <Title level={4} style={{ color: '#fff', margin: 0 }}>
              {currentPage}
            </Title>
          </Space>
          
          <UserDropdown />
        </Header>
        
        <Layout style={{ marginTop: 64, minHeight: 'calc(100vh - 64px)' }}>
          <Content style={{ margin: '16px', background: '#fff', borderRadius: 6 }}>
            {breadcrumbs.length > 1 && (
              <div style={{ padding: '12px 24px', borderBottom: '1px solid #f0f0f0' }}>
                <Breadcrumb>
                  {breadcrumbs.map((crumb, index) => (
                    <Breadcrumb.Item 
                      key={index}
                      {...(crumb.path && { 
                        onClick: () => navigate(crumb.path),
                        style: { cursor: 'pointer' }
                      })}
                    >
                      {crumb.title}
                    </Breadcrumb.Item>
                  ))}
                </Breadcrumb>
              </div>
            )}
            <div style={{ padding: '24px' }}>
              {children}
            </div>
          </Content>
        </Layout>
      </Layout>
    </>
  )
}

export default MainLayout