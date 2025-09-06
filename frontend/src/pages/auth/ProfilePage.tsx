import React, { useState } from 'react';
import { 
  Card, 
  Tabs, 
  Form, 
  Input, 
  Button, 
  Avatar, 
  Typography, 
  Row, 
  Col, 
  Space,
  Tag,
  Table,
  Modal,
  Descriptions,
  Switch,
  QRCode
} from 'antd';
import { 
  UserOutlined, 
  MailOutlined, 
  LockOutlined, 
  SafetyOutlined,
  MobileOutlined,
  HistoryOutlined,
  ShieldCheckOutlined,
  KeyOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import { useUserProfile, useMfa, useSessions, useSecurityEvents } from '@/hooks/useAuth';
import type { UpdateProfileRequest, ChangePasswordRequest } from '@/types/index';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

export default function ProfilePage() {
  const [profileForm] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [mfaSetupVisible, setMfaSetupVisible] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');

  const { 
    user, 
    updateProfile, 
    changePassword, 
    verifyEmail, 
    resendVerification 
  } = useUserProfile();

  const { 
    isMfaEnabled, 
    setupMfa, 
    verifyMfa, 
    disableMfa 
  } = useMfa();

  const { 
    sessions, 
    isLoading: sessionsLoading, 
    revokeSession, 
    revokeAllSessions 
  } = useSessions();

  const { 
    events: securityEvents, 
    isLoading: eventsLoading 
  } = useSecurityEvents();

  // Initialize profile form with user data
  React.useEffect(() => {
    if (user) {
      profileForm.setFieldsValue({
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        username: user.username,
      });
    }
  }, [user, profileForm]);

  const onUpdateProfile = async (values: UpdateProfileRequest) => {
    await updateProfile.mutateAsync(values);
  };

  const onChangePassword = async (values: ChangePasswordRequest) => {
    await changePassword.mutateAsync(values);
    passwordForm.resetFields();
  };

  const handleSetupMfa = async () => {
    try {
      const response = await setupMfa.mutateAsync();
      setMfaSecret(response.data.secret);
      setQrCodeUrl(response.data.qrCode);
      setMfaSetupVisible(true);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleVerifyMfa = async (token: string) => {
    try {
      await verifyMfa.mutateAsync({ token });
      setMfaSetupVisible(false);
      setMfaSecret('');
      setQrCodeUrl('');
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleDisableMfa = () => {
    Modal.confirm({
      title: 'Disable Two-Factor Authentication',
      content: 'Are you sure you want to disable MFA? This will make your account less secure.',
      onOk: async () => {
        // This would need a password/MFA confirmation in a real implementation
        try {
          await disableMfa.mutateAsync({ 
            password: '', // Would get from a form
            token: '' // Would get from a form
          });
        } catch (error) {
          // Error handled by mutation
        }
      },
    });
  };

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
    {
      title: 'Actions',
      key: 'actions',
      render: (_: any, session: any) => (
        <Button
          type="link"
          danger
          icon={<LogoutOutlined />}
          onClick={() => revokeSession.mutate(session.id)}
          loading={revokeSession.isPending}
        >
          Revoke
        </Button>
      ),
    },
  ];

  const eventColumns = [
    {
      title: 'Event',
      dataIndex: 'eventType',
      key: 'eventType',
      render: (type: string) => (
        <Tag color="blue">{type.replace('_', ' ').toUpperCase()}</Tag>
      ),
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
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card>
            <Row gutter={16} align="middle">
              <Col>
                <Avatar 
                  size={64} 
                  icon={<UserOutlined />}
                  style={{ backgroundColor: '#1890ff' }}
                >
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </Avatar>
              </Col>
              <Col flex="auto">
                <Title level={3} style={{ margin: 0 }}>
                  {user?.firstName} {user?.lastName}
                </Title>
                <Text type="secondary">@{user?.username}</Text>
                <br />
                <Space size="middle" style={{ marginTop: 8 }}>
                  <Tag color={user?.isActive ? 'green' : 'red'}>
                    {user?.isActive ? 'Active' : 'Inactive'}
                  </Tag>
                  {user?.isEmailVerified ? (
                    <Tag color="blue" icon={<MailOutlined />}>Verified</Tag>
                  ) : (
                    <Tag color="orange" icon={<MailOutlined />}>
                      Unverified
                      <Button 
                        type="link" 
                        size="small"
                        onClick={() => resendVerification.mutate()}
                        loading={resendVerification.isPending}
                      >
                        Verify
                      </Button>
                    </Tag>
                  )}
                  {isMfaEnabled && (
                    <Tag color="green" icon={<SafetyOutlined />}>MFA Enabled</Tag>
                  )}
                </Space>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={24}>
          <Card>
            <Tabs defaultActiveKey="profile">
              <TabPane 
                tab={
                  <span>
                    <UserOutlined />
                    Profile
                  </span>
                } 
                key="profile"
              >
                <Form
                  form={profileForm}
                  layout="vertical"
                  onFinish={onUpdateProfile}
                >
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="firstName"
                        label="First Name"
                        rules={[
                          { required: true, message: 'Please input your first name!' },
                          { min: 2, message: 'First name must be at least 2 characters!' }
                        ]}
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item
                        name="lastName"
                        label="Last Name"
                        rules={[
                          { required: true, message: 'Please input your last name!' },
                          { min: 2, message: 'Last name must be at least 2 characters!' }
                        ]}
                      >
                        <Input />
                      </Form.Item>
                    </Col>
                  </Row>

                  <Form.Item
                    name="email"
                    label="Email"
                    rules={[
                      { required: true, message: 'Please input your email!' },
                      { type: 'email', message: 'Please enter a valid email!' }
                    ]}
                  >
                    <Input />
                  </Form.Item>

                  <Form.Item
                    name="username"
                    label="Username"
                  >
                    <Input disabled />
                  </Form.Item>

                  <Form.Item>
                    <Button 
                      type="primary" 
                      htmlType="submit"
                      loading={updateProfile.isPending}
                    >
                      Update Profile
                    </Button>
                  </Form.Item>
                </Form>
              </TabPane>

              <TabPane 
                tab={
                  <span>
                    <LockOutlined />
                    Security
                  </span>
                } 
                key="security"
              >
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  {/* Password Change */}
                  <Card title="Change Password" size="small">
                    <Form
                      form={passwordForm}
                      layout="vertical"
                      onFinish={onChangePassword}
                    >
                      <Form.Item
                        name="currentPassword"
                        label="Current Password"
                        rules={[{ required: true, message: 'Please input your current password!' }]}
                      >
                        <Input.Password />
                      </Form.Item>

                      <Form.Item
                        name="newPassword"
                        label="New Password"
                        rules={[
                          { required: true, message: 'Please input your new password!' },
                          { min: 8, message: 'Password must be at least 8 characters!' }
                        ]}
                      >
                        <Input.Password />
                      </Form.Item>

                      <Form.Item
                        name="confirmPassword"
                        label="Confirm New Password"
                        dependencies={['newPassword']}
                        rules={[
                          { required: true, message: 'Please confirm your new password!' },
                          ({ getFieldValue }) => ({
                            validator(_, value) {
                              if (!value || getFieldValue('newPassword') === value) {
                                return Promise.resolve();
                              }
                              return Promise.reject(new Error('Passwords do not match!'));
                            },
                          }),
                        ]}
                      >
                        <Input.Password />
                      </Form.Item>

                      <Form.Item>
                        <Button 
                          type="primary" 
                          htmlType="submit"
                          loading={changePassword.isPending}
                        >
                          Change Password
                        </Button>
                      </Form.Item>
                    </Form>
                  </Card>

                  {/* MFA Settings */}
                  <Card title="Two-Factor Authentication" size="small">
                    <Descriptions column={1}>
                      <Descriptions.Item label="Status">
                        <Tag color={isMfaEnabled ? 'green' : 'orange'}>
                          {isMfaEnabled ? 'Enabled' : 'Disabled'}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="Action">
                        {isMfaEnabled ? (
                          <Button 
                            danger 
                            onClick={handleDisableMfa}
                            loading={disableMfa.isPending}
                          >
                            Disable MFA
                          </Button>
                        ) : (
                          <Button 
                            type="primary" 
                            onClick={handleSetupMfa}
                            loading={setupMfa.isPending}
                          >
                            Enable MFA
                          </Button>
                        )}
                      </Descriptions.Item>
                    </Descriptions>
                  </Card>
                </Space>
              </TabPane>

              <TabPane 
                tab={
                  <span>
                    <MobileOutlined />
                    Sessions
                  </span>
                } 
                key="sessions"
              >
                <Space direction="vertical" style={{ width: '100%' }} size="large">
                  <div>
                    <Button 
                      danger 
                      onClick={() => revokeAllSessions.mutate()}
                      loading={revokeAllSessions.isPending}
                    >
                      Revoke All Sessions
                    </Button>
                  </div>
                  <Table
                    columns={sessionColumns}
                    dataSource={sessions}
                    rowKey="id"
                    loading={sessionsLoading}
                    pagination={false}
                  />
                </Space>
              </TabPane>

              <TabPane 
                tab={
                  <span>
                    <HistoryOutlined />
                    Security Events
                  </span>
                } 
                key="events"
              >
                <Table
                  columns={eventColumns}
                  dataSource={securityEvents}
                  rowKey="id"
                  loading={eventsLoading}
                  pagination={{ pageSize: 10 }}
                />
              </TabPane>
            </Tabs>
          </Card>
        </Col>
      </Row>

      {/* MFA Setup Modal */}
      <Modal
        title="Setup Two-Factor Authentication"
        open={mfaSetupVisible}
        onCancel={() => setMfaSetupVisible(false)}
        footer={null}
        width={400}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large" align="center">
          <Text>Scan this QR code with your authenticator app:</Text>
          {qrCodeUrl && <QRCode value={qrCodeUrl} />}
          <Text>Or enter this secret key manually:</Text>
          <Input value={mfaSecret} readOnly />
          <Form
            onFinish={(values) => handleVerifyMfa(values.token)}
            layout="vertical"
            style={{ width: '100%' }}
          >
            <Form.Item
              name="token"
              label="Enter verification code"
              rules={[{ required: true, message: 'Please enter the verification code!' }]}
            >
              <Input placeholder="6-digit code" maxLength={6} />
            </Form.Item>
            <Form.Item>
              <Button 
                type="primary" 
                htmlType="submit" 
                block
                loading={verifyMfa.isPending}
              >
                Verify and Enable
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Modal>
    </div>
  );
}