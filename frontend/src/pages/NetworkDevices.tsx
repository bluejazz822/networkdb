import React from 'react'
import { Table, Typography, Space, Tag, Button, Input } from 'antd'
import { SearchOutlined, PlusOutlined } from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { NetworkDevice } from '@/types/index'

const { Title } = Typography
const { Search } = Input

const NetworkDevices: React.FC = () => {
  // Mock data - will be replaced with actual API calls
  const mockDevices: NetworkDevice[] = [
    {
      id: '1',
      name: 'Router-001',
      type: 'router',
      ipAddress: '10.0.1.1',
      status: 'active',
      location: 'us-east-1a',
      lastSeen: '2024-01-15T10:30:00Z',
    },
    {
      id: '2',
      name: 'Switch-001',
      type: 'switch',
      ipAddress: '10.0.1.10',
      status: 'active',
      location: 'us-east-1a',
      lastSeen: '2024-01-15T10:25:00Z',
    },
    {
      id: '3',
      name: 'Firewall-001',
      type: 'firewall',
      ipAddress: '10.0.1.100',
      status: 'maintenance',
      location: 'us-east-1b',
      lastSeen: '2024-01-15T09:45:00Z',
    },
  ]

  const columns: ColumnsType<NetworkDevice> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      render: (type: string) => {
        const typeColors = {
          router: 'blue',
          switch: 'purple',
          firewall: 'red',
          'load-balancer': 'orange',
        }
        return <Tag color={typeColors[type as keyof typeof typeColors]}>{type.toUpperCase()}</Tag>
      },
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        const statusColors = {
          active: 'success',
          inactive: 'default',
          maintenance: 'warning',
        }
        return <Tag color={statusColors[status as keyof typeof statusColors]}>{status.toUpperCase()}</Tag>
      },
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
    },
    {
      title: 'Last Seen',
      dataIndex: 'lastSeen',
      key: 'lastSeen',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: () => (
        <Space size="middle">
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
            <Title level={2}>Network Devices</Title>
            <p style={{ color: '#8c8c8c' }}>
              Manage and monitor all network devices in your infrastructure
            </p>
          </div>
          <Button type="primary" icon={<PlusOutlined />}>
            Add Device
          </Button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Search
            placeholder="Search devices..."
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
          dataSource={mockDevices}
          rowKey="id"
          pagination={{
            total: mockDevices.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
          }}
        />
      </Space>
    </div>
  )
}

export default NetworkDevices