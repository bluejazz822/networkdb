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
  CloudServerOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
  LockOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import { Resizable } from 'react-resizable'
import type { ResizeCallbackData } from 'react-resizable'
import 'react-resizable/css/styles.css'
import './DynamicTable.css'
import { useAuth } from '../contexts/AuthContext'
import ExportModal from './ExportModal'

const { Title, Text } = Typography
const { Option } = Select

// Resizable column title component
const ResizableTitle = (props: any) => {
  const { onResize, width, ...restProps } = props

  if (!width) {
    return <th {...restProps} />
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => {
            e.stopPropagation()
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  )
}

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
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({})
  const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>({})
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(autoRefresh)
  const [editingRow, setEditingRow] = useState<string | null>(null)
  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [form] = Form.useForm()

  const { hasPermission, user } = useAuth()

  // Fetch data and schema
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(apiEndpoint)
      const result = await response.json()
      if (result.success && result.data) {
        // Transform data to ensure unique ID for all network resources
        let transformedData = result.data.map((item: any, index: number) => {
          // Determine ID field based on resource type
          let id = item.id || `item-${index}`

          if (apiEndpoint.includes('/vpcs')) {
            id = item.VpcId || item.VcnId || item.VNetName || item.id || `vpc-${index}`
          } else if (apiEndpoint.includes('/loadbalancers')) {
            id = item.LoadBalancerArn || item.LoadBalancerId || item.LoadBalancerName || item.id || `lb-${index}`
          } else if (apiEndpoint.includes('/natgateways')) {
            id = item.NatGatewayId || item.GatewayId || item.id || `ngw-${index}`
          } else if (apiEndpoint.includes('/vpnconnections')) {
            id = item.VpnConnectionId || item.ConnectionId || item.id || `vpn-${index}`
          } else if (apiEndpoint.includes('/transitgatewayattachments')) {
            id = item.TransitGatewayAttachmentId || item.AttachmentId || item.id || `tgw-attach-${index}`
          } else if (apiEndpoint.includes('/vpcendpoints')) {
            id = item.VpcEndpointId || item.EndpointId || item.id || `vpce-${index}`
          }

          return {
            ...item,
            id,
            Site: item.Region || item.region || item.Site || item.Location || 'Unknown'
          }
        })

        setData(transformedData)
        if (result.schema) {
          setSchema(result.schema)
        }
        setLastUpdated(new Date())
        console.log('Dynamic table data loaded:', transformedData.length, 'records')
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      message.error('Failed to fetch data')
    } finally {
      setLoading(false)
    }
  }, [apiEndpoint])


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
      const filterableColumns = schema.filter(col => col.filterable)
      const options: Record<string, string[]> = {}
      
      for (const col of filterableColumns) {
        const uniqueValues = [...new Set(data.map(row => row[col.name]).filter(Boolean))]
        options[col.name] = uniqueValues.sort()
      }
      
      setFilterOptions(options)
    }
  }, [data, schema])

  // Helper functions - format column titles for display
  const formatColumnTitle = (name: string) => {
    if (!name || typeof name !== 'string') {
      console.warn('formatColumnTitle received invalid name:', name)
      return 'Unknown Column'
    }
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

  const sortColumn = (a: any, b: any): number => {
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

  // Handle column resize
  const handleResize = useCallback((colKey: string) =>
    (_: React.SyntheticEvent, { size }: ResizeCallbackData) => {
      setColumnWidths(prev => ({
        ...prev,
        [colKey]: size.width
      }))
    }, []
  )

  // Generate table columns from schema
  const columns: ColumnsType<any> = useMemo(() => {
    if (!schema.length) return []

    const primaryKey = schema.find(col => col.isPrimaryKey)?.name || 'id'

    const dataColumns = schema.map(col => {
      const defaultWidth = col.width || getDefaultWidth(col.displayType)
      const currentWidth = columnWidths[col.name] || defaultWidth

      return {
        title: formatColumnTitle(col.name),
        dataIndex: col.name,
        key: col.name,
        width: currentWidth,
        fixed: col.isPrimaryKey ? 'left' as const : undefined,
        ellipsis: {
          showTitle: false,
        },
        onHeaderCell: () => ({
          width: currentWidth,
          onResize: handleResize(col.name),
        }),
        render: (text: any, record: any) => {
          if (editingRow === record[primaryKey] && col.editable) {
            return renderEditableCell(col.name, col.displayType)
          }

          const cellContent = renderCell(text, col.displayType, col.name)

          // Wrap long text content with Tooltip
          if (text && String(text).length > 30) {
            return (
              <Tooltip placement="topLeft" title={String(text)}>
                {cellContent}
              </Tooltip>
            )
          }

          return cellContent
        },
        ...(col.sortable && { sorter: (a: any, b: any) => sortColumn(a[col.name], b[col.name]) })
      }
    })

    const actionsColumn = {
      title: 'Actions',
      key: 'actions',
      width: 120,
      fixed: 'right' as const,
      render: (_: any, record: any) => renderActions(record, primaryKey)
    }

    return [...dataColumns, actionsColumn]
  }, [schema, editingRow, columnWidths, handleResize])

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

  // Reset to first page when search or filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [searchText, filters])

  // Render cell based on display type
  const renderCell = (text: any, displayType: ColumnSchema['displayType'], columnName: string) => {
    if (!text && text !== 0) return <Text type="secondary">N/A</Text>

    switch (displayType) {
      case 'code':
        return (
          <Text
            code
            copyable={{ text: String(text) }}
            style={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {String(text)}
          </Text>
        )

      case 'tag':
        const color = getTagColor(text, columnName)
        return (
          <Tag
            color={color}
            style={{
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'inline-block'
            }}
          >
            {String(text)}
          </Tag>
        )

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
        return (
          <Text
            strong={columnName === 'Name'}
            style={{
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {String(text)}
          </Text>
        )
    }
  }

  // Render editable cell
  const renderEditableCell = (fieldName: string, _displayType: ColumnSchema['displayType']) => {
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
      <Row gutter={16}>
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

  const primaryKey = schema.find(col => col.isPrimaryKey)?.name || 'id'

  return (
    <Card className="dynamic-table-card" bordered={false}>
      <div className="dynamic-table-header">
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <div className="dynamic-table-title">
              <span className="dynamic-table-title-icon">{icon}</span>
              <Title level={3} style={{ margin: 0, display: 'inline' }}>
                {title}
              </Title>
              <span className="dynamic-table-count-badge">
                {filteredData.length} of {data.length}
              </span>
            </div>
          </Col>
          <Col>
            <Space size="middle">
              <Text type="secondary" style={{ fontSize: '13px' }}>
                {lastUpdated && `🕐 ${lastUpdated.toLocaleTimeString()}`}
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
                className="dynamic-table-button"
                icon={<DownloadOutlined />}
                onClick={() => setExportModalVisible(true)}
                disabled={filteredData.length === 0}
              >
                Export
              </Button>
              <Button
                className="dynamic-table-button"
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

        <div className="dynamic-table-filters">
          {renderFilters()}
        </div>
      </div>

      <Form form={form} component={false}>
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey={primaryKey}
          loading={loading}
          scroll={{ x: 1920, y: 600 }}
          components={{
            header: {
              cell: ResizableTitle,
            },
          }}
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: filteredData.length,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} ${title.toLowerCase()}`,
            onChange: (page, newPageSize) => {
              setCurrentPage(page)
              if (newPageSize !== pageSize) {
                setPageSize(newPageSize)
                setCurrentPage(1) // Reset to first page when page size changes
              }
            },
            pageSizeOptions: ['10', '20', '50', '100', '200'],
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