import { useState, useEffect, useCallback } from 'react'
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
  Switch,
  Form,
  message
} from 'antd'
import { 
  ReloadOutlined, 
  SearchOutlined,
  GlobalOutlined,
  CloudServerOutlined,
  PartitionOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  LockOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { useAuth } from '../contexts/AuthContext'
import ExportModal from './ExportModal'

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
  const [tenantFilter, setTenantFilter] = useState<string>('')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(autoRefresh)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [form] = Form.useForm()
  
  const { hasPermission, user } = useAuth()

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

  // Get unique regions, statuses, and tenants for filters
  const regions = [...new Set(vpcData.map(vpc => vpc.Region).filter(Boolean))]
  const statuses = [...new Set(vpcData.map(vpc => vpc.status).filter(Boolean))]
  const tenants = [...new Set(vpcData.map(vpc => vpc.Tenant).filter(Boolean))]

  // Edit handlers
  const handleEdit = (record: VPCData) => {
    if (!hasPermission('edit')) {
      message.warning('You do not have permission to edit VPC data')
      return
    }
    setEditingRow(record.VpcId)
    form.setFieldsValue({
      Name: record.Name,
      'ENV Name': record['ENV Name'],
      Tenant: record.Tenant,
      Site: record.Site
    })
  }

  const handleSave = async (vpcId: string) => {
    try {
      const values = await form.validateFields()
      
      // Call backend API to update VPC in database
      const response = await fetch(`/api/vpcs/${vpcId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values)
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update VPC')
      }
      
      // Update local state with the response from database
      const updatedData = vpcData.map(vpc => 
        vpc.VpcId === vpcId 
          ? { ...vpc, ...result.data }
          : vpc
      )
      
      setVpcData(updatedData)
      setEditingRow(null)
      message.success('VPC updated successfully in database')
      
      // Optionally refresh the data to ensure consistency
      setTimeout(() => {
        fetchVPCs()
      }, 1000)
      
    } catch (error) {
      console.error('Error updating VPC:', error)
      message.error(`Failed to update VPC: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  const handleCancel = () => {
    setEditingRow(null)
    form.resetFields()
  }

  // Filter data
  const filteredData = vpcData.filter(vpc => {
    const matchesSearch = !searchText || 
      vpc.VpcId.toLowerCase().includes(searchText.toLowerCase()) ||
      vpc.Name?.toLowerCase().includes(searchText.toLowerCase()) ||
      vpc.AccountId?.toLowerCase().includes(searchText.toLowerCase()) ||
      vpc.CidrBlock?.toLowerCase().includes(searchText.toLowerCase()) ||
      vpc.Tenant?.toLowerCase().includes(searchText.toLowerCase())
    
    const matchesRegion = !regionFilter || vpc.Region === regionFilter
    const matchesStatus = !statusFilter || vpc.status === statusFilter
    const matchesTenant = !tenantFilter || vpc.Tenant === tenantFilter
    
    return matchesSearch && matchesRegion && matchesStatus && matchesTenant
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
      render: (text, record) => {
        if (editingRow === record.VpcId) {
          return (
            <Form.Item
              name="Name"
              style={{ margin: 0 }}
            >
              <Input size="small" />
            </Form.Item>
          )
        }
        return <Text strong>{text || 'N/A'}</Text>
      },
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
      render: (text, record) => {
        if (editingRow === record.VpcId) {
          return (
            <Form.Item
              name="ENV Name"
              style={{ margin: 0 }}
            >
              <Input size="small" />
            </Form.Item>
          )
        }
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
      render: (text, record) => {
        if (editingRow === record.VpcId) {
          return (
            <Form.Item
              name="Tenant"
              style={{ margin: 0 }}
            >
              <Input size="small" />
            </Form.Item>
          )
        }
        return text ? <Tag color="cyan">{text}</Tag> : <Text type="secondary">N/A</Text>
      },
    },
    {
      title: 'Site',
      dataIndex: 'Site',
      key: 'Site',
      width: 100,
      render: (text, record) => {
        if (editingRow === record.VpcId) {
          return (
            <Form.Item
              name="Site"
              style={{ margin: 0 }}
            >
              <Input size="small" />
            </Form.Item>
          )
        }
        return text ? <Tag color="purple">{text}</Tag> : <Text type="secondary">N/A</Text>
      },
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
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_, record) => {
        const isEditing = editingRow === record.VpcId
        
        if (isEditing) {
          return (
            <Space size="small">
              <Button
                type="link"
                size="small"
                icon={<SaveOutlined />}
                onClick={() => handleSave(record.VpcId)}
              >
                Save
              </Button>
              <Button
                type="link"
                size="small"
                icon={<CloseOutlined />}
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </Space>
          )
        }
        
        if (!hasPermission('edit')) {
          return (
            <Tooltip title={`Only ${user?.role === 'admin' ? 'admins' : 'admin users'} can edit VPC data`}>
              <Button
                type="link"
                size="small"
                icon={<LockOutlined />}
                disabled
              >
                Locked
              </Button>
            </Tooltip>
          )
        }
        
        return (
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Edit
          </Button>
        )
      },
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
                icon={<DownloadOutlined />} 
                onClick={() => setExportModalVisible(true)}
                disabled={filteredData.length === 0}
              >
                Export
              </Button>
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
          <Col span={6}>
            <Input
              placeholder="Search VPCs (ID, Name, Account, CIDR, Tenant)..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={6}>
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
          <Col span={6}>
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
          <Col span={6}>
            <Select
              placeholder="Filter by Tenant"
              style={{ width: '100%' }}
              value={tenantFilter}
              onChange={setTenantFilter}
              allowClear
            >
              {tenants.map(tenant => (
                <Option key={tenant} value={tenant}>
                  <Tag color="cyan">{tenant}</Tag>
                </Option>
              ))}
            </Select>
          </Col>
        </Row>
      </div>

      <Form form={form} component={false}>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="VpcId"
          loading={loading}
          scroll={{ x: 1920, y: 600 }}
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
      </Form>

      <ExportModal
        visible={exportModalVisible}
        onCancel={() => setExportModalVisible(false)}
        data={filteredData}
        onExport={() => {
          // Optional: refresh data after export if needed
        }}
      />
    </Card>
  )
}