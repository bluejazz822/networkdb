import React from 'react'
import { Table, Typography, Space, Tag, Button, Input } from 'antd'
import { SearchOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { VPC } from '@/types/index'

const { Title } = Typography
const { Search } = Input

const VPCs: React.FC = () => {
  // Mock data - will be replaced with actual API calls
  const mockVPCs: VPC[] = [
    {
      id: 'vpc-1',
      name: 'production-vpc',
      cidr: '10.0.0.0/16',
      region: 'us-east-1',
      status: 'available',
      createdAt: '2024-01-10T08:00:00Z',
    },
    {
      id: 'vpc-2',
      name: 'staging-vpc',
      cidr: '10.1.0.0/16',
      region: 'us-east-1',
      status: 'available',
      createdAt: '2024-01-12T14:30:00Z',
    },
    {
      id: 'vpc-3',
      name: 'development-vpc',
      cidr: '10.2.0.0/16',
      region: 'us-west-2',
      status: 'pending',
      createdAt: '2024-01-15T09:15:00Z',
    },
  ]

  const columns: ColumnsType<VPC> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
    },
    {
      title: 'VPC ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'CIDR Block',
      dataIndex: 'cidr',
      key: 'cidr',
    },
    {
      title: 'Region',
      dataIndex: 'region',
      key: 'region',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusColors = {
          available: 'success',
          pending: 'processing',
          deleted: 'error',
        }
        return <Tag color={statusColors[status as keyof typeof statusColors]}>{status.toUpperCase()}</Tag>
      },
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: () => (
        <Space size="middle">
          <Button type="link" size="small">View</Button>
          <Button type="link" size="small">Edit</Button>
          <Button type="link" size="small" danger>Delete</Button>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={2}>Virtual Private Clouds (VPCs)</Title>
            <p style={{ color: '#8c8c8c' }}>
              Manage your virtual private cloud configurations and network isolation
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />}>
            Create VPC
          </Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Search
            placeholder="Search VPCs..."
            allowClear
            style={{ width: 300 }}
            prefix={<SearchOutlined />}
          />
          <Space>
            <Button>Export</Button>
            <Button>Refresh</Button>
          </Space>
        </div>

        <Table
          columns={columns}
          dataSource={mockVPCs}
          rowKey="id"
          pagination={{
            total: mockVPCs.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
        />
      </Space>
    </div>
  )
}

export default VPCs