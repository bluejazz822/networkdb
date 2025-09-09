/**
 * Dynamic Table Component
 * 
 * Self-configuring table that adapts to any database schema
 * without requiring manual column definitions or hardcoded types
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
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

interface ColumnSchema {
  name: string
  type: string
  nullable: boolean
  isPrimaryKey: boolean
  filterable: boolean
  sortable: boolean
  editable: boolean
  displayType: 'text' | 'tag' | 'badge' | 'date' | 'code'
  width?: number
}

interface DynamicTableProps {
  apiEndpoint: string
  title: string
  icon?: React.ReactNode
  autoRefresh?: boolean
  refreshInterval?: number
}

export default function DynamicTable({ 
  apiEndpoint,
  title,
  icon = <CloudServerOutlined />,
  autoRefresh = true, 
  refreshInterval = 30000 
}: DynamicTableProps) {
  const [data, setData] = useState<any[]>([])
  const [schema, setSchema] = useState<ColumnSchema[]>([])
  const [loading, setLoading] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>({})
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(autoRefresh)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [form] = Form.useForm()
  
  const { hasPermission, user } = useAuth()

  // Fetch data and schema
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(apiEndpoint)
      const result = await response.json()
      if (result.success) {
        setData(result.data)
        if (result.schema) {
          setSchema(result.schema)
          // Fetch filter options for filterable columns
          await fetchFilterOptions(result.schema)
        }
        setLastUpdated(new Date())
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      message.error('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [apiEndpoint])

  // Fetch filter options for filterable columns
  const fetchFilterOptions = useCallback(async (schemaData: ColumnSchema[]) => {
    const filterableColumns = schemaData.filter(col => col.filterable)
    const options: Record<string, string[]> = {}
    
    for (const col of filterableColumns) {
      // Extract unique values from current data
      const uniqueValues = [...new Set(data.map(row => row[col.name]).filter(Boolean))]
      options[col.name] = uniqueValues.sort()
    }
    
    setFilterOptions(options)
  }, [data])

  // Initial load
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Auto refresh
  useEffect(() => {
    if (!autoRefreshEnabled) return
    
    const interval = setInterval(fetchData, refreshInterval)
    return () => clearInterval(interval)
  }, [autoRefreshEnabled, refreshInterval, fetchData])

  // Update filter options when data changes
  useEffect(() => {
    if (schema.length > 0 && data.length > 0) {
      fetchFilterOptions(schema)
    }
  }, [data, schema, fetchFilterOptions])

  // Generate table columns from schema
  const columns: ColumnsType<any> = useMemo(() => {
    if (!schema.length) return []

    const primaryKey = schema.find(col => col.isPrimaryKey)?.name || 'id'

    return schema.map(col => ({
      title: formatColumnTitle(col.name),
      dataIndex: col.name,
      key: col.name,
      width: col.width || getDefaultWidth(col.displayType),
      fixed: col.isPrimaryKey ? 'left' as const : undefined,
      render: (text: any, record: any) => {
        if (editingRow === record[primaryKey] && col.editable) {
          return renderEditableCell(col.name, col.displayType)
        }
        return renderCell(text, col.displayType, col.name)
      },
      ...(col.sortable && { sorter: (a, b) => sortColumn(a[col.name], b[col.name]) })
    })).concat([{
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_, record) => renderActions(record, primaryKey)
    }])
  }, [schema, editingRow])

  // Filter data based on search and filters
  const filteredData = useMemo(() => {
    return data.filter(row => {
      // Text search across all string fields
      const matchesSearch = !searchText || 
        schema.some(col => {
          const value = row[col.name]
          return value && String(value).toLowerCase().includes(searchText.toLowerCase())
        })

      // Column filters
      const matchesFilters = Object.entries(filters).every(([field, value]) => {
        if (!value) return true
        return row[field] === value
      })

      return matchesSearch && matchesFilters
    })
  }, [data, searchText, filters, schema])

  // Render cell based on display type
  const renderCell = (text: any, displayType: ColumnSchema['displayType'], columnName: string) => {
    if (!text && text !== 0) return <Text type="secondary">N/A</Text>

    switch (displayType) {
      case 'code':
        return (
          <Text code copyable={{ text: String(text) }}>
            {String(text)}
          </Text>
        )
      
      case 'tag':
        const color = getTagColor(text, columnName)
        if (columnName === 'ENV Name' && String(text).length > 20) {
          return (
            <div style={{ 
              wordBreak: 'break-word', 
              whiteSpace: 'pre-wrap',
              lineHeight: '1.2',
              maxWidth: '180px'
            }}>
              <Tag 
                color={color}
                style={{ 
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxWidth: '100%',
                  height: 'auto',
                  padding: '2px 8px',
                  lineHeight: '1.3'
                }}
              >
                {String(text)}
              </Tag>
            </div>
          )
        }
        return <Tag color={color}>{String(text)}</Tag>
      
      case 'badge':
        const badgeStatus = getBadgeStatus(text, columnName)
        return <Badge status={badgeStatus} text={String(text)} />
      
      case 'date':
        try {
          return new Date(text).toLocaleString()
        } catch {
          return String(text)
        }
      
      case 'text':
      default:
        return <Text strong={columnName === 'Name'}>{String(text)}</Text>
    }
  }

  // Render editable cell
  const renderEditableCell = (fieldName: string, displayType: ColumnSchema['displayType']) => {
    return (
      <Form.Item
        name={fieldName}
        style={{ margin: 0 }}
      >
        <Input size="small" />
      </Form.Item>
    )
  }

  // Render action buttons
  const renderActions = (record: any, primaryKey: string) => {
    const isEditing = editingRow === record[primaryKey]
    
    if (isEditing) {
      return (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<SaveOutlined />}
            onClick={() => handleSave(record[primaryKey])}
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
        <Tooltip title={`Only ${user?.role === 'admin' ? 'admins' : 'admin users'} can edit data`}>
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
  }

  // Edit handlers
  const handleEdit = (record: any) => {
    if (!hasPermission('edit')) {
      message.warning('You do not have permission to edit data')
      return
    }

    const primaryKey = schema.find(col => col.isPrimaryKey)?.name || 'id'
    const editableFields = schema.filter(col => col.editable)
    
    setEditingRow(record[primaryKey])
    
    const formValues: any = {}
    editableFields.forEach(col => {
      formValues[col.name] = record[col.name]
    })
    form.setFieldsValue(formValues)
  }

  const handleSave = async (id: string) => {
    try {
      const values = await form.validateFields()
      
      const response = await fetch(`${apiEndpoint}/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values)
      })
      
      const result = await response.json()
      
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'Failed to update record')
      }
      
      // Update local state
      const primaryKey = schema.find(col => col.isPrimaryKey)?.name || 'id'
      const updatedData = data.map(row => 
        row[primaryKey] === id 
          ? { ...row, ...result.data }
          : row
      )
      
      setData(updatedData)
      setEditingRow(null)
      message.success('Record updated successfully')
      
      // Refresh data to ensure consistency
      setTimeout(() => {
        fetchData()
      }, 1000)
      
    } catch (error: any) {
      console.error('Error updating record:', error)
      message.error(`Failed to update record: ${error.message}`)
    }
  }

  const handleCancel = () => {
    setEditingRow(null)
    form.resetFields()
  }

  // Generate filter controls
  const renderFilters = () => {
    const filterableColumns = schema.filter(col => col.filterable)
    const totalCols = filterableColumns.length + 1 // +1 for search
    const colSpan = Math.max(3, Math.floor(24 / totalCols))

    return (
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={colSpan}>
          <Input
            placeholder={`Search ${title.toLowerCase()}...`}
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            allowClear
          />
        </Col>
        {filterableColumns.map(col => (
          <Col key={col.name} span={colSpan}>
            <Select
              placeholder={`Filter by ${formatColumnTitle(col.name)}`}
              style={{ width: '100%' }}
              value={filters[col.name]}
              onChange={(value) => setFilters(prev => ({ ...prev, [col.name]: value }))}
              allowClear
            >
              {(filterOptions[col.name] || []).map(option => (
                <Option key={option} value={option}>
                  {renderFilterOption(option, col.displayType, col.name)}
                </Option>
              ))}
            </Select>
          </Col>
        ))}
      </Row>
    )
  }

  // Helper functions
  const formatColumnTitle = (name: string) => {
    return name.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
  }

  const getDefaultWidth = (displayType: ColumnSchema['displayType']) => {
    switch (displayType) {
      case 'code': return 180
      case 'date': return 180
      case 'badge': return 100
      case 'tag': return 120
      default: return 150
    }
  }

  const getTagColor = (text: string, columnName: string) => {
    const str = String(text).toLowerCase()
    if (columnName.includes('Type') || columnName.includes('ENV')) {
      if (str.includes('prod')) return 'red'
      if (str.includes('dev')) return 'orange'
      if (str.includes('test')) return 'purple'
      return 'blue'
    }
    if (columnName === 'Region') return 'blue'
    if (columnName === 'Tenant') return 'cyan'
    if (columnName === 'Site') return 'purple'
    return 'default'
  }

  const getBadgeStatus = (text: string, columnName: string): any => {
    const str = String(text).toLowerCase()
    if (columnName === 'status') {
      if (str === 'available') return 'success'
      if (str === 'pending') return 'processing'
      if (str === 'terminated') return 'error'
      return 'default'
    }
    if (columnName === 'IsDefault') {
      return str === 'true' ? 'success' : 'default'
    }
    return 'default'
  }

  const renderFilterOption = (option: string, displayType: ColumnSchema['displayType'], columnName: string) => {
    switch (displayType) {
      case 'tag':
        const color = getTagColor(option, columnName)
        return <Tag color={color}>{option}</Tag>
      case 'badge':
        const status = getBadgeStatus(option, columnName)
        return <Badge status={status} text={option} />
      default:
        return option
    }
  }

  const sortColumn = (a: any, b: any) => {
    if (a === b) return 0
    if (a == null) return 1
    if (b == null) return -1
    
    // Try numeric sort first
    const numA = Number(a)
    const numB = Number(b)
    if (!isNaN(numA) && !isNaN(numB)) {
      return numA - numB
    }
    
    // String sort
    return String(a).localeCompare(String(b))
  }

  const primaryKey = schema.find(col => col.isPrimaryKey)?.name || 'id'

  return (
    <Card>
      <div style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={3} style={{ margin: 0 }}>
              {icon} {title} ({filteredData.length} of {data.length})
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
                onClick={fetchData}
                loading={loading}
                type="primary"
              >
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>

        {renderFilters()}
      </div>

      <Form form={form} component={false}>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey={primaryKey}
          loading={loading}
          scroll={{ x: 1920, y: 600 }}
          pagination={{
            total: filteredData.length,
            pageSize: 20,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => 
              `${range[0]}-${range[1]} of ${total} ${title.toLowerCase()}`,
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