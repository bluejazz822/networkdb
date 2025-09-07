import React, { useState, useEffect, useCallback } from 'react'
import { 
  Table, 
  Tag, 
  Space, 
  Typography, 
  Card, 
  Button,
  Input,
  Select,
  Row,
  Col,
  Badge,
  Tooltip,
  Switch
} from 'antd'
import { 
  ReloadOutlined, 
  SearchOutlined,
  GlobalOutlined,
  CloudServerOutlined,
  PartitionOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'

const { Title, Text } = Typography
const { Option } = Select

interface VPCData {
  id: string
  VpcId: string
  AccountId: string
  Region: string
  CidrBlock: string
  IsDefault: string
  Name: string
  'ENV Name': string
  Tenant: string
  Site: string
  status: string
  created_time: string
  termindated_time: string
}

interface VPCTableProps {
  autoRefresh?: boolean
  refreshInterval?: number
}

export default function VPCTable({ autoRefresh = true, refreshInterval = 30000 }: VPCTableProps) {
  const [vpcData, setVpcData] = useState<VPCData[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [regionFilter, setRegionFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(autoRefresh)

  const fetchVPCs = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/vpcs')
      const result = await response.json()
      if (result.success) {
        setVpcData(result.data)
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Error fetching VPCs:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load
  useEffect(() => {
    fetchVPCs()
  }, [fetchVPCs])

  // Auto refresh
  useEffect(() => {
    if (!autoRefreshEnabled) return
    
    const interval = setInterval(fetchVPCs, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefreshEnabled, refreshInterval, fetchVPCs])

  // Get unique regions for filter
  const regions = [...new Set(vpcData.map(vpc => vpc.Region).filter(Boolean))]
  const statuses = [...new Set(vpcData.map(vpc => vpc.status).filter(Boolean))]

  // Filter data
  const filteredData = vpcData.filter(vpc => {
    const matchesSearch = !searchText || 
      vpc.VpcId.toLowerCase().includes(searchText.toLowerCase()) ||
      vpc.Name?.toLowerCase().includes(searchText.toLowerCase()) ||
      vpc.AccountId?.toLowerCase().includes(searchText.toLowerCase()) ||
      vpc.CidrBlock?.toLowerCase().includes(searchText.toLowerCase())
    
    const matchesRegion = !regionFilter || vpc.Region === regionFilter
    const matchesStatus = !statusFilter || vpc.status === statusFilter
    
    return matchesSearch && matchesRegion && matchesStatus
  })

  const columns: ColumnsType<VPCData> = [
    {
      title: 'VPC ID',
      dataIndex: 'VpcId',
      key: 'VpcId',
      fixed: 'left',
      width: 180,
      render: (text) => (
        <Text code copyable={{ text }}>
          {text}
        </Text>
      ),
    },
    {
      title: 'Name',
      dataIndex: 'Name',
      key: 'Name',
      width: 200,
      render: (text) => <Text strong>{text || 'N/A'}</Text>,
    },
    {
      title: 'Account ID',
      dataIndex: 'AccountId',
      key: 'AccountId',
      width: 150,
      render: (text) => <Text code>{text}</Text>,
    },
    {
      title: 'Region',
      dataIndex: 'Region',
      key: 'Region',
      width: 150,
      render: (text) => (
        <Tag icon={<GlobalOutlined />} color="blue">
          {text}
        </Tag>
      ),
    },
    {
      title: 'CIDR Block',
      dataIndex: 'CidrBlock',
      key: 'CidrBlock',
      width: 140,
      render: (text) => (
        <Tag icon={<PartitionOutlined />} color="green">
          {text}
        </Tag>
      ),
    },
    {
      title: 'Environment',
      dataIndex: 'ENV Name',
      key: 'ENV Name',
      width: 180,
      render: (text) => {
        if (!text) return <Text type="secondary">N/A</Text>
        const color = text.includes('prod') ? 'red' : 
                     text.includes('dev') ? 'orange' : 
                     text.includes('test') ? 'purple' : 'default'
        return <Tag color={color}>{text}</Tag>
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (text) => {
        const color = text === 'available' ? 'green' : 
                     text === 'pending' ? 'orange' : 
                     text === 'terminated' ? 'red' : 'default'
        return <Badge status={color as any} text={text || 'unknown'} />
      },
    },
    {
      title: 'Default VPC',
      dataIndex: 'IsDefault',
      key: 'IsDefault',
      width: 120,
      render: (text) => (
        <Badge 
          status={text === 'True' ? 'success' : 'default'} 
          text={text === 'True' ? 'Yes' : 'No'} 
        />
      ),
    },
    {
      title: 'Tenant',
      dataIndex: 'Tenant',
      key: 'Tenant',
      width: 120,
      render: (text) => text ? <Tag color="cyan">{text}</Tag> : <Text type="secondary">N/A</Text>,
    },
    {
      title: 'Site',
      dataIndex: 'Site',
      key: 'Site',
      width: 100,
      render: (text) => text ? <Tag color="purple">{text}</Tag> : <Text type="secondary">N/A</Text>,
    },
    {
      title: 'Created Time',
      dataIndex: 'created_time',
      key: 'created_time',
      width: 180,
      render: (text) => text ? new Date(text).toLocaleString() : 'N/A',
    },
    {
      title: 'Terminated Time',
      dataIndex: 'termindated_time',
      key: 'termindated_time',
      width: 180,
      render: (text) => text ? new Date(text).toLocaleString() : 'N/A',
    },
  ]

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              <CloudServerOutlined /> VPC Inventory ({filteredData.length} of {vpcData.length})
            </Title>
          </Col>
          <Col>
            <Space>
              <Text type="secondary">
                {lastUpdated && `Last updated: ${lastUpdated.toLocaleTimeString()}`}
              </Text>
              <Tooltip title={`Auto-refresh every ${refreshInterval/1000}s`}>
                <Switch 
                  checked={autoRefreshEnabled}
                  onChange={setAutoRefreshEnabled}
                  checkedChildren="Auto"
                  unCheckedChildren="Manual"
                />
              </Tooltip>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={fetchVPCs}
                loading={loading}
                type="primary"
              >
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>

        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Input
              placeholder="Search VPCs (ID, Name, Account, CIDR)..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={8}>
            <Select
              placeholder="Filter by Region"
              style={{ width: '100%' }}
              value={regionFilter}
              onChange={setRegionFilter}
              allowClear
            >
              {regions.map(region => (
                <Option key={region} value={region}>
                  <GlobalOutlined /> {region}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={8}>
            <Select
              placeholder="Filter by Status"
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
              allowClear
            >
              {statuses.map(status => (
                <Option key={status} value={status}>
                  <Badge status={status === 'available' ? 'success' : 'default'} text={status} />
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </div>

      <Table
        columns={columns}
        dataSource={filteredData}
        rowKey="VpcId"
        loading={loading}
        scroll={{ x: 1800, y: 600 }}
        pagination={{
          total: filteredData.length,
          pageSize: 20,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => 
            `${range[0]}-${range[1]} of ${total} VPCs`,
        }}
        size="small"
      />
    </Card>
  )
}