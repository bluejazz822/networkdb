import React, { useState } from 'react'
import { Layout, Menu, Typography, Avatar, Dropdown, Space } from 'antd'
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
import type { MenuProps } from 'antd'

const { Header, Sider } = Layout
const { Title } = Typography

interface MainLayoutProps {
  children: React.ReactNode
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

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
        collapsed={collapsed}
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
          {collapsed ? 'CMDB' : 'Network CMDB'}
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
      
      <Layout style={{ marginLeft: collapsed ? 80 : 200, transition: 'margin-left 0.2s' }}>
        <Header style={{
          background: '#001529',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'fixed',
          top: 0,
          right: 0,
          left: collapsed ? 80 : 200,
          zIndex: 1000,
          transition: 'left 0.2s',
        }}>
          <Space align="center">
            {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined, {
              className: 'trigger',
              onClick: () => setCollapsed(!collapsed),
              style: { fontSize: '18px', cursor: 'pointer', padding: '0 12px' },
            })}
            <Title level={4} style={{ color: '#fff', margin: 0 }}>
              Network Configuration Management Database
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
          {children}
        </Layout>
      </Layout>
    </>
  )
}

export default MainLayout