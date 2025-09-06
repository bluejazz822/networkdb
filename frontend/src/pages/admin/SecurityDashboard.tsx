import React from 'react';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Table, 
  Tag, 
  Typography, 
  Space,
  Button,
  Tooltip
} from 'antd';
import { 
  UserOutlined, 
  LockOutlined, 
  SafetyOutlined, 
  WarningOutlined,
  ReloadOutlined,
  ShieldCheckOutlined,
  KeyOutlined
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { userManagementService } from '@/services/authService';
import { useSecurityEvents, useSessions } from '@/hooks/useAuth';

const { Title } = Typography;

export default function SecurityDashboard() {
  // Fetch users for statistics
  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['users', 'stats'],
    queryFn: () => userManagementService.getUsers(),
    select: (response) => response.data,
  });

  // Fetch security events
  const { events, isLoading: eventsLoading } = useSecurityEvents(1, 10);

  // Fetch active sessions
  const { sessions, isLoading: sessionsLoading } = useSessions();

  // Calculate statistics
  const totalUsers = usersData?.total || 0;
  const activeUsers = usersData?.items?.filter(user => user.isActive).length || 0;
  const verifiedUsers = usersData?.items?.filter(user => user.isEmailVerified).length || 0;
  const mfaEnabledUsers = usersData?.items?.filter(user => user.mfaEnabled).length || 0;
  const lockedUsers = usersData?.items?.filter(user => 
    user.accountLockedUntil && new Date(user.accountLockedUntil) > new Date()
  ).length || 0;

  const eventColumns = [
    {
      title: 'Event Type',
      dataIndex: 'eventType',
      key: 'eventType',
      render: (type: string) => {
        const colors = {
          'login': 'green',
          'logout': 'blue',
          'failed_login': 'red',
          'password_change': 'orange',
          'mfa_enabled': 'purple',
          'mfa_disabled': 'orange',
          'account_locked': 'red'
        };
        return (
          <Tag color={colors[type as keyof typeof colors] || 'default'}>
            {type.replace('_', ' ').toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
    },
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
  ];

  const sessionColumns = [
    {
      title: 'Device',
      dataIndex: 'deviceInfo',
      key: 'deviceInfo',
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
    },
    {
      title: 'Last Activity',
      dataIndex: 'lastActivity',
      key: 'lastActivity',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Security Dashboard</Title>
      
      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Total Users"
              value={totalUsers}
              prefix={<UserOutlined />}
              loading={usersLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Users"
              value={activeUsers}
              prefix={<ShieldCheckOutlined />}
              valueStyle={{ color: '#3f8600' }}
              loading={usersLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="MFA Enabled"
              value={mfaEnabledUsers}
              prefix={<SafetyOutlined />}
              valueStyle={{ color: '#1890ff' }}
              loading={usersLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Locked Accounts"
              value={lockedUsers}
              prefix={<LockOutlined />}
              valueStyle={{ color: lockedUsers > 0 ? '#cf1322' : '#3f8600' }}
              loading={usersLoading}
            />
          </Card>
        </Col>
      </Row>

      {/* Additional Security Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Email Verified"
              value={verifiedUsers}
              suffix={`/ ${totalUsers}`}
              prefix={<KeyOutlined />}
              loading={usersLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Active Sessions"
              value={sessions.filter(s => s.isActive).length}
              prefix={<UserOutlined />}
              loading={sessionsLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Security Score"
              value={Math.round(((verifiedUsers + mfaEnabledUsers) / (totalUsers * 2)) * 100)}
              suffix="%"
              prefix={<SafetyOutlined />}
              valueStyle={{ 
                color: ((verifiedUsers + mfaEnabledUsers) / (totalUsers * 2)) > 0.8 ? '#3f8600' : 
                       ((verifiedUsers + mfaEnabledUsers) / (totalUsers * 2)) > 0.6 ? '#faad14' : '#cf1322'
              }}
              loading={usersLoading}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Failed Logins"
              value={events.filter(e => e.eventType === 'failed_login').length}
              prefix={<WarningOutlined />}
              suffix="(recent)"
              valueStyle={{ 
                color: events.filter(e => e.eventType === 'failed_login').length > 5 ? '#cf1322' : '#3f8600'
              }}
              loading={eventsLoading}
            />
          </Card>
        </Col>
      </Row>

      {/* Recent Security Events */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <SafetyOutlined />
                Recent Security Events
              </Space>
            }
            extra={
              <Tooltip title="Refresh">
                <Button 
                  type="text" 
                  icon={<ReloadOutlined />} 
                />
              </Tooltip>
            }
          >
            <Table
              columns={eventColumns}
              dataSource={events}
              rowKey="id"
              loading={eventsLoading}
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {/* Active Sessions */}
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <UserOutlined />
                Active User Sessions
              </Space>
            }
            extra={
              <Tooltip title="Refresh">
                <Button 
                  type="text" 
                  icon={<ReloadOutlined />} 
                />
              </Tooltip>
            }
          >
            <Table
              columns={sessionColumns}
              dataSource={sessions.filter(session => session.isActive)}
              rowKey="id"
              loading={sessionsLoading}
              pagination={{ pageSize: 5 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}