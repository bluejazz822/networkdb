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
  Typography,
  message,
  Tooltip,
  Descriptions
} from 'antd';
import { 
  PlusOutlined, 
  EditOutlined, 
  DeleteOutlined,
  CrownOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roleManagementService } from '@/services/authService';
import { usePermissions } from '@/hooks/useAuth';
import { PERMISSIONS } from '@/utils/permissions';
import type { Role, CreateRoleRequest, UpdateRoleRequest } from '@/types/index';

const { Title } = Typography;
const { TextArea } = Input;

export default function RoleManagementPage() {
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();
  const { canManageRoles } = usePermissions();

  // Fetch roles
  const { data: rolesData, isLoading, error } = useQuery({
    queryKey: ['roles'],
    queryFn: () => roleManagementService.getRoles(),
    select: (response) => response.data,
  });

  // Create role mutation
  const createRoleMutation = useMutation({
    mutationFn: (roleData: CreateRoleRequest) => roleManagementService.createRole(roleData),
    onSuccess: () => {
      message.success('Role created successfully');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setIsModalVisible(false);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to create role');
    },
  });

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ roleId, roleData }: { roleId: string; roleData: UpdateRoleRequest }) =>
      roleManagementService.updateRole(roleId, roleData),
    onSuccess: () => {
      message.success('Role updated successfully');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      setIsModalVisible(false);
      setEditingRole(null);
      form.resetFields();
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to update role');
    },
  });

  // Delete role mutation
  const deleteRoleMutation = useMutation({
    mutationFn: (roleId: string) => roleManagementService.deleteRole(roleId),
    onSuccess: () => {
      message.success('Role deleted successfully');
      queryClient.invalidateQueries({ queryKey: ['roles'] });
    },
    onError: (error: any) => {
      message.error(error.response?.data?.message || 'Failed to delete role');
    },
  });

  const handleCreateRole = () => {
    setEditingRole(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    form.setFieldsValue({
      displayName: role.displayName,
      description: role.description,
      priority: role.priority,
      isActive: role.isActive,
    });
    setIsModalVisible(true);
  };

  const handleDeleteRole = (role: Role) => {
    if (role.isSystem) {
      message.error('Cannot delete system roles');
      return;
    }

    Modal.confirm({
      title: 'Delete Role',
      content: `Are you sure you want to delete role "${role.displayName}"?`,
      onOk: () => deleteRoleMutation.mutate(role.id),
    });
  };

  const handleModalOk = () => {
    form.validateFields().then((values) => {
      if (editingRole) {
        updateRoleMutation.mutate({
          roleId: editingRole.id,
          roleData: values,
        });
      } else {
        // Generate role name from display name
        const name = values.displayName
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '_')
          .replace(/_+/g, '_')
          .replace(/^_|_$/g, '');
        
        createRoleMutation.mutate({
          ...values,
          name,
        });
      }
    });
  };

  const handleModalCancel = () => {
    setIsModalVisible(false);
    setEditingRole(null);
    form.resetFields();
  };

  const columns = [
    {
      title: 'Role Name',
      dataIndex: 'displayName',
      key: 'displayName',
      sorter: true,
      render: (text: string, record: Role) => (
        <Space>
          {text}
          {record.isSystem && (
            <Tooltip title="System Role">
              <CrownOutlined style={{ color: '#faad14' }} />
            </Tooltip>
          )}
        </Space>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      sorter: true,
      width: 100,
    },
    {
      title: 'Status',
      key: 'status',
      render: (record: Role) => (
        <Space>
          <Tag color={record.isActive ? 'green' : 'red'}>
            {record.isActive ? 'Active' : 'Inactive'}
          </Tag>
          {record.isSystem && <Tag color="gold">System</Tag>}
        </Space>
      ),
    },
    {
      title: 'Permissions',
      key: 'permissions',
      render: (record: Role) => (
        <span>{record.permissions?.length || 0} permissions</span>
      ),
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
      render: (record: Role) => (
        <Space>
          {canManageRoles && !record.isSystem && (
            <>
              <Tooltip title="Edit Role">
                <Button
                  type="text"
                  icon={<EditOutlined />}
                  onClick={() => handleEditRole(record)}
                />
              </Tooltip>
              <Tooltip title="Delete Role">
                <Button
                  type="text"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteRole(record)}
                  loading={deleteRoleMutation.isPending}
                />
              </Tooltip>
            </>
          )}
          {record.isSystem && (
            <Tooltip title="System roles cannot be modified">
              <Button type="text" disabled>
                Protected
              </Button>
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  if (error) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Title level={4}>Error loading roles</Title>
          <Button 
            type="primary" 
            icon={<ReloadOutlined />} 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['roles'] })}
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
        title={<Title level={3}>Role Management</Title>}
        extra={
          canManageRoles && (
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreateRole}
            >
              Create Role
            </Button>
          )
        }
      >
        <Table
          columns={columns}
          dataSource={rolesData?.items || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            total: rolesData?.total || 0,
            pageSize: rolesData?.limit || 50,
            current: rolesData?.page || 1,
          }}
          expandable={{
            expandedRowRender: (record: Role) => (
              <Card size="small" title="Role Details">
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="Internal Name">
                    <code>{record.name}</code>
                  </Descriptions.Item>
                  <Descriptions.Item label="Priority">
                    {record.priority}
                  </Descriptions.Item>
                  <Descriptions.Item label="System Role">
                    {record.isSystem ? 'Yes' : 'No'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Active">
                    {record.isActive ? 'Yes' : 'No'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Created">
                    {new Date(record.createdAt).toLocaleString()}
                  </Descriptions.Item>
                  <Descriptions.Item label="Updated">
                    {new Date(record.updatedAt).toLocaleString()}
                  </Descriptions.Item>
                </Descriptions>
                {record.description && (
                  <div style={{ marginTop: 16 }}>
                    <strong>Description:</strong>
                    <p>{record.description}</p>
                  </div>
                )}
                {record.permissions && record.permissions.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <strong>Permissions ({record.permissions.length}):</strong>
                    <div style={{ marginTop: 8 }}>
                      {record.permissions.map(permission => (
                        <Tag key={permission.id} style={{ margin: '2px' }}>
                          {permission.displayName}
                        </Tag>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            ),
          }}
        />
      </Card>

      <Modal
        title={editingRole ? 'Edit Role' : 'Create Role'}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={handleModalCancel}
        confirmLoading={createRoleMutation.isPending || updateRoleMutation.isPending}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          preserve={false}
        >
          <Form.Item
            name="displayName"
            label="Display Name"
            rules={[
              { required: true, message: 'Please input role display name!' },
              { min: 2, message: 'Display name must be at least 2 characters!' }
            ]}
          >
            <Input placeholder="e.g., Network Administrator" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[
              { max: 1000, message: 'Description cannot exceed 1000 characters!' }
            ]}
          >
            <TextArea 
              rows={3} 
              placeholder="Describe the role's purpose and responsibilities"
            />
          </Form.Item>

          <Form.Item
            name="priority"
            label="Priority"
            initialValue={100}
            rules={[
              { required: true, message: 'Please input priority!' },
              { type: 'number', min: 0, max: 1000, message: 'Priority must be between 0 and 1000!' }
            ]}
          >
            <Input 
              type="number" 
              placeholder="Lower number = higher priority"
            />
          </Form.Item>

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