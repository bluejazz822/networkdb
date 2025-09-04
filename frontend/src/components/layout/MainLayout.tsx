import React, { useEffect } from 'react'
import { Layout, Menu, Typography, Avatar, Dropdown, Space, Breadcrumb } from 'antd'
import {
  DashboardOutlined,
  GlobalOutlined,
  CloudOutlined,
  BranchesOutlined,
  SwapOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  SettingOutlined,
  LogoutOutlined,
} from '@ant-design/icons'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '@/store/useAppStore'
import type { MenuProps } from 'antd'

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

  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: '/devices',
      icon: <GlobalOutlined />,
      label: 'Network Devices',
    },
    {
      key: '/vpcs',
      icon: <CloudOutlined />,
      label: 'VPCs',
    },
    {
      key: '/subnets',
      icon: <BranchesOutlined />,
      label: 'Subnets',
    },
    {
      key: '/transit-gateways',
      icon: <SwapOutlined />,
      label: 'Transit Gateways',
    },
  ]

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      label: 'Profile',
      icon: <UserOutlined />,
    },
    {
      key: 'settings',
      label: 'Settings',
      icon: <SettingOutlined />,
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      label: 'Logout',
      icon: <LogoutOutlined />,
    },
  ]

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key)
  }

  const handleUserMenuClick: MenuProps['onClick'] = ({ key }) => {
    switch (key) {
      case 'logout':
        // Handle logout logic here
        console.log('Logout clicked')
        break
      default:
        console.log(`${key} clicked`)
    }
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
          
          <Dropdown
            menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
            placement="bottomRight"
          >
            <Space style={{ cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} />
              <span style={{ color: '#fff' }}>Admin User</span>
            </Space>
          </Dropdown>
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