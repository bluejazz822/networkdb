import React, { useState } from 'react';
import { 
  Card, 
  Table, 
  Button, 
  Space, 
  Tag, 
  Modal, 
  Form, 
  Input, 
  Switch, 
  Select, 
  Typography,
  message,
  Tooltip
} from 'antd';
import { 
  UserAddOutlined, 
  EditOutlined, 
  DeleteOutlined,
  LockOutlined,
  UnlockOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { userManagementService } from '@/services/authService';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/utils/permissions';
import type { User, CreateUserRequest, UpdateUserRequest } from '@/types/index';

const { Title } = Typography;
const { Option } = Select;

export default function UserManagementPage() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const { canManageUsers } = usePermissions();

  // Fetch users
  const { data: usersData, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => userManagementService.getUsers(),
    select: (response) => response.data,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: (userData: CreateUserRequest) => userManagementService.createUser(userData),
    onSuccess: () => {
      message.success('User created successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsModalVisible(false);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to create user');
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: ({ userId, userData }: { userId: string; userData: UpdateUserRequest }) =>
      userManagementService.updateUser(userId, userData),
    onSuccess: () => {
      message.success('User updated successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsModalVisible(false);
      setEditingUser(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to update user');
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: (userId: string) => userManagementService.deleteUser(userId),
    onSuccess: () => {
      message.success('User deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to delete user');
    },
  });

  // Lock/unlock user mutations
  const lockUserMutation = useMutation({
    mutationFn: (userId: string) => userManagementService.lockUser(userId),
    onSuccess: () => {
      message.success('User locked successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to lock user');
    },
  });

  const unlockUserMutation = useMutation({
    mutationFn: (userId: string) => userManagementService.unlockUser(userId),
    onSuccess: () => {
      message.success('User unlocked successfully');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to unlock user');
    },
  });

  const handleCreateUser = () => {
    setEditingUser(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isActive: user.isActive,
    });
    setIsModalVisible(true);
  };

  const handleDeleteUser = (user: User) => {
    Modal.confirm({
      title: 'Delete User',
      content: `Are you sure you want to delete user "${user.username}"?`,
      onOk: () => deleteUserMutation.mutate(user.id),
    });
  };

  const handleLockUser = (user: User) => {
    lockUserMutation.mutate(user.id);
  };

  const handleUnlockUser = (user: User) => {
    unlockUserMutation.mutate(user.id);
  };

  const handleModalOk = () => {
    form.validateFields().then((values) => {
      if (editingUser) {
        updateUserMutation.mutate({
          userId: editingUser.id,
          userData: values,
        });
      } else {
        createUserMutation.mutate(values);
      }
    });
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    setEditingUser(null);
    form.resetFields();
  };

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      sorter: true,
    },
    {
      title: 'Name',
      key: 'name',
      render: (record: User) => `${record.firstName} ${record.lastName}`,
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Status',
      key: 'status',
      render: (record: User) => (
        <Space>
          <Tag color={record.isActive ? 'green' : 'red'}>
            {record.isActive ? 'Active' : 'Inactive'}
          </Tag>
          {record.isEmailVerified ? (
            <Tag color="blue">Verified</Tag>
          ) : (
            <Tag color="orange">Unverified</Tag>
          )}
          {record.mfaEnabled && <Tag color="purple">MFA</Tag>}
          {record.accountLockedUntil && new Date(record.accountLockedUntil) > new Date() && (
            <Tag color="red">Locked</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      render: (date: string) => date ? new Date(date).toLocaleString() : 'Never',
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (record: User) => (
        <Space>
          {canManageUsers && (
            <>
              <Tooltip title="Edit User">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => handleEditUser(record)}
                />
              </Tooltip>
              {record.accountLockedUntil && new Date(record.accountLockedUntil) > new Date() ? (
                <Tooltip title="Unlock User">
                  <Button
                    type="text"
                    icon={<UnlockOutlined />}
                    onClick={() => handleUnlockUser(record)}
                    loading={unlockUserMutation.isPending}
                  />
                </Tooltip>
              ) : (
                <Tooltip title="Lock User">
                  <Button
                    type="text"
                    icon={<LockOutlined />}
                    onClick={() => handleLockUser(record)}
                    loading={lockUserMutation.isPending}
                  />
                </Tooltip>
              )}
              <Tooltip title="Delete User">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteUser(record)}
                  loading={deleteUserMutation.isPending}
                />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  if (error) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Title level={4}>Error loading users</Title>
          <Button 
            type="primary" 
            icon={<ReloadOutlined />} 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['users'] })}
          >
            Retry
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div>
      <Card 
        title={<Title level={3}>User Management</Title>}
        extra={
          canManageUsers && (
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={handleCreateUser}
            >
              Create User
            </Button>
          )
        }
      >
        <Table
          columns={columns}
          dataSource={usersData?.items || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            total: usersData?.total || 0,
            pageSize: usersData?.limit || 20,
            current: usersData?.page || 1,
          }}
        />
      </Card>

      <Modal
        title={editingUser ? 'Edit User' : 'Create User'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={createUserMutation.isPending || updateUserMutation.isPending}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
        >
          <Form.Item
            name="username"
            label="Username"
            rules={[
              { required: true, message: 'Please input username!' },
              { min: 3, message: 'Username must be at least 3 characters!' }
            ]}
          >
            <Input disabled={!!editingUser} />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please input email!' },
              { type: 'email', message: 'Please enter a valid email!' }
            ]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="firstName"
            label="First Name"
            rules={[{ required: true, message: 'Please input first name!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="lastName"
            label="Last Name"
            rules={[{ required: true, message: 'Please input last name!' }]}
          >
            <Input />
          </Form.Item>

          {!editingUser && (
            <Form.Item
              name="password"
              label="Password"
              rules={[
                { required: true, message: 'Please input password!' },
                { min: 8, message: 'Password must be at least 8 characters!' }
              ]}
            >
              <Input.Password />
            </Form.Item>
          )}

          <Form.Item
            name="isActive"
            label="Status"
            valuePropName="checked"
            initialValue={true}
          >
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}