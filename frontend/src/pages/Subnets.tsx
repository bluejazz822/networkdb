import React from 'react'
import { Table, Typography, Space, Tag, Button, Input } from 'antd'
import { SearchOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { Subnet } from '@/types/index'

const { Title } = Typography
const { Search } = Input

const Subnets: React.FC = () => {
  // Mock data - will be replaced with actual API calls
  const mockSubnets: Subnet[] = [
    {
      id: 'subnet-1',
      name: 'public-subnet-1a',
      vpcId: 'vpc-1',
      cidr: '10.0.1.0/24',
      availabilityZone: 'us-east-1a',
      type: 'public',
      status: 'available',
    },
    {
      id: 'subnet-2',
      name: 'private-subnet-1a',
      vpcId: 'vpc-1',
      cidr: '10.0.2.0/24',
      availabilityZone: 'us-east-1a',
      type: 'private',
      status: 'available',
    },
    {
      id: 'subnet-3',
      name: 'public-subnet-1b',
      vpcId: 'vpc-1',
      cidr: '10.0.3.0/24',
      availabilityZone: 'us-east-1b',
      type: 'public',
      status: 'pending',
    },
  ]

  const columns: ColumnsType<Subnet> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
    },
    {
      title: 'Subnet ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'VPC ID',
      dataIndex: 'vpcId',
      key: 'vpcId',
    },
    {
      title: 'CIDR Block',
      dataIndex: 'cidr',
      key: 'cidr',
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeColors = {
          public: 'blue',
          private: 'orange',
        }
        return <Tag color={typeColors[type as keyof typeof typeColors]}>{type.toUpperCase()}</Tag>
      },
    },
    {
      title: 'Availability Zone',
      dataIndex: 'availabilityZone',
      key: 'availabilityZone',
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
            <Title level={2}>Subnets</Title>
            <p style={{ color: '#8c8c8c' }}>
              Manage subnet configurations within your VPCs for network segmentation
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />}>
            Create Subnet
          </Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Search
            placeholder="Search subnets..."
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
          dataSource={mockSubnets}
          rowKey="id"
          pagination={{
            total: mockSubnets.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
        />
      </Space>
    </div>
  )
}

export default Subnets