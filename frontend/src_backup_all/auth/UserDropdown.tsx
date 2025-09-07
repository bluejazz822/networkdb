import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Dropdown, 
  Avatar, 
  Space, 
  Typography, 
  Menu, 
  Tag, 
  Divider 
} from 'antd';
import { 
  UserOutlined, 
  SettingOutlined, 
  LogoutOutlined, 
  SafetyOutlined,
  KeyOutlined,
  CrownOutlined
} from '@ant-design/icons';
import { useAuth, usePermissions } from '@/hooks/useAuth';
import RoleBasedRender from './RoleBasedRender';

const { Text } = Typography;

export default function UserDropdown() {
  const { user, logout } = useAuth();
  const { isAdmin, isSuperAdmin } = usePermissions();
  const navigate = useNavigate();

  if (!user) return null;

  const handleMenuClick = ({ key }: { key: string }) => {
    switch (key) {
      case 'profile':
        navigate('/auth/profile');
        break;
      case 'admin-users':
        navigate('/admin/users');
        break;
      case 'admin-roles':
        navigate('/admin/roles');
        break;
      case 'admin-permissions':
        navigate('/admin/permissions');
        break;
      case 'security':
        navigate('/admin/security');
        break;
      case 'logout':
        logout();
        break;
    }
  };

  const menu = (
    <Menu onClick={handleMenuClick}>
      {/* User Info Section */}
      <Menu.Item key="user-info" disabled style={{ cursor: 'default', opacity: 1 }}>
        <Space direction="vertical" size={4} style={{ width: '100%' }}>
          <Text strong>{user.firstName} {user.lastName}</Text>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            @{user.username}
          </Text>
          <Space size={4}>
            {user.isEmailVerified ? (
              <Tag color="green" size="small">Verified</Tag>
            ) : (
              <Tag color="orange" size="small">Unverified</Tag>
            )}
            {user.mfaEnabled && (
              <Tag color="blue" size="small" icon={<SafetyOutlined />}>
                MFA
              </Tag>
            )}
            {isSuperAdmin ? (
              <Tag color="red" size="small" icon={<CrownOutlined />}>
                Super Admin
              </Tag>
            ) : isAdmin ? (
              <Tag color="purple" size="small" icon={<KeyOutlined />}>
                Admin
              </Tag>
            ) : null}
          </Space>
        </Space>
      </Menu.Item>
      
      <Menu.Divider />

      {/* Profile Management */}
      <Menu.Item key="profile" icon={<UserOutlined />}>
        My Profile
      </Menu.Item>

      <RoleBasedRender permissions={['user:read', 'role:read', 'permission:read']}>
        <Menu.Divider />
        
        {/* Admin Section */}
        <Menu.SubMenu 
          key="admin" 
          icon={<SettingOutlined />} 
          title="Administration"
        >
          <RoleBasedRender permission="user:read">
            <Menu.Item key="admin-users">
              User Management
            </Menu.Item>
          </RoleBasedRender>
          
          <RoleBasedRender permission="role:read">
            <Menu.Item key="admin-roles">
              Role Management
            </Menu.Item>
          </RoleBasedRender>
          
          <RoleBasedRender permission="permission:read">
            <Menu.Item key="admin-permissions">
              Permission Management
            </Menu.Item>
          </RoleBasedRender>
          
          <RoleBasedRender permission="system:read">
            <Menu.Item key="security">
              Security Dashboard
            </Menu.Item>
          </RoleBasedRender>
        </Menu.SubMenu>
      </RoleBasedRender>

      <Menu.Divider />

      {/* Logout */}
      <Menu.Item key="logout" icon={<LogoutOutlined />} danger>
        Logout
      </Menu.Item>
    </Menu>
  );

  return (
    <Dropdown 
      overlay={menu} 
      trigger={['click']} 
      placement="bottomRight"
      arrow
    >
      <Space 
        style={{ 
          cursor: 'pointer', 
          padding: '8px 12px',
          borderRadius: '6px',
          transition: 'background-color 0.2s'
        }}
        className="user-dropdown-trigger"
      >
        <Avatar 
          size="small" 
          style={{ backgroundColor: '#1890ff' }}
          icon={<UserOutlined />}
        >
          {user.firstName?.[0]}{user.lastName?.[0]}
        </Avatar>
        <Text style={{ color: 'inherit', maxWidth: '120px' }} ellipsis>
          {user.firstName} {user.lastName}
        </Text>
      </Space>
    </Dropdown>
  );
}