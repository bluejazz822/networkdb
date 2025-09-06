import React from 'react'
import { Table, Typography, Space, Tag, Button, Input } from 'antd'
import { SearchOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { TransitGateway } from '@/types/index'

const { Title } = Typography
const { Search } = Input

const TransitGateways: React.FC = () => {
  // Mock data - will be replaced with actual API calls
  const mockTGWs: TransitGateway[] = [
    {
      id: 'tgw-1',
      name: 'production-tgw',
      description: 'Production environment transit gateway',
      amazonSideAsn: 64512,
      status: 'available',
      createdAt: '2024-01-10T10:00:00Z',
    },
    {
      id: 'tgw-2',
      name: 'staging-tgw',
      description: 'Staging environment transit gateway',
      amazonSideAsn: 64513,
      status: 'available',
      createdAt: '2024-01-12T16:30:00Z',
    },
    {
      id: 'tgw-3',
      name: 'development-tgw',
      amazonSideAsn: 64514,
      status: 'pending',
      createdAt: '2024-01-15T09:45:00Z',
    },
  ]

  const columns: ColumnsType<TransitGateway> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
    },
    {
      title: 'Transit Gateway ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (description: string) => description || '-',
    },
    {
      title: 'Amazon Side ASN',
      dataIndex: 'amazonSideAsn',
      key: 'amazonSideAsn',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusColors = {
          available: 'success',
          pending: 'processing',
          modifying: 'processing',
          deleting: 'warning',
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
            <Title level={2}>Transit Gateways</Title>
            <p style={{ color: '#8c8c8c' }}>
              Manage transit gateway configurations for inter-VPC connectivity and hybrid cloud networking
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />}>
            Create Transit Gateway
          </Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Search
            placeholder="Search transit gateways..."
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
          dataSource={mockTGWs}
          rowKey="id"
          pagination={{
            total: mockTGWs.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
        />
      </Space>
    </div>
  )
}

export default TransitGateways