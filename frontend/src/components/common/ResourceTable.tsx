import React, { useState } from 'react'
import {
  Table,
  Button,
  Space,
  Input,
  Modal,
  message,
  Tooltip,
  Popconfirm,
  Select,
  Row,
  Col,
  Card,
  Tag,
} from 'antd'
import {
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FilterOutlined,
} from '@ant-design/icons'
import type { ColumnsType, TableProps } from 'antd/es/table'
import type { SelectProps } from 'antd'

const { Search } = Input

export interface ResourceTableColumn<T = any> {
  title: string
  dataIndex: keyof T
  key: string
  width?: number
  fixed?: 'left' | 'right'
  sortable?: boolean
  filterable?: boolean
  filterOptions?: Array<{ label: string; value: any }>
  render?: (value: any, record: T, index: number) => React.ReactNode
  searchable?: boolean
}

export interface ResourceTableAction<T = any> {
  key: string
  label: string
  icon?: React.ReactNode
  type?: 'primary' | 'default' | 'dashed' | 'link' | 'text'
  danger?: boolean
  disabled?: (record: T) => boolean
  onClick: (record: T) => void
}

export interface ResourceTableProps<T = any> {
  title?: string
  description?: string
  data?: T[]
  columns: ResourceTableColumn<T>[]
  loading?: boolean
  total?: number
  page?: number
  pageSize?: number
  rowKey: string | ((record: T) => string)
  
  // Actions
  actions?: ResourceTableAction<T>[]
  bulkActions?: Array<{
    key: string
    label: string
    icon?: React.ReactNode
    danger?: boolean
    onClick: (selectedRowKeys: React.Key[], selectedRows: T[]) => void
  }>
  
  // CRUD operations
  onCreate?: () => void
  onEdit?: (record: T) => void
  onDelete?: (record: T) => void
  onBulkDelete?: (records: T[]) => void
  
  // Table events
  onTableChange?: (pagination: any, filters: any, sorter: any) => void
  onSearch?: (value: string) => void
  onFilter?: (filters: Record<string, any>) => void
  onRefresh?: () => void
  onExport?: () => void
  
  // Customization
  showActions?: boolean
  showBulkActions?: boolean
  showSearch?: boolean
  showFilters?: boolean
  showRefresh?: boolean
  showExport?: boolean
  enableSelection?: boolean
  size?: 'small' | 'middle' | 'large'
  
  // Additional features
  expandable?: TableProps<T>['expandable']
  scroll?: { x?: number; y?: number }
}

export function ResourceTable<T extends Record<string, any>>({
  title,
  description,
  data = [],
  columns,
  loading = false,
  total = 0,
  page = 1,
  pageSize = 10,
  rowKey,
  
  actions = [],
  bulkActions = [],
  
  onCreate,
  onEdit,
  onDelete,
  onBulkDelete,
  
  onTableChange,
  onSearch,
  onFilter,
  onRefresh,
  onExport,
  
  showActions = true,
  showBulkActions = true,
  showSearch = true,
  showFilters = false,
  showRefresh = true,
  showExport = true,
  enableSelection = true,
  size = 'middle',
  
  expandable,
  scroll,
}: ResourceTableProps<T>) {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [selectedRows, setSelectedRows] = useState<T[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [filters, setFilters] = useState<Record<string, any>>({})

  // Handle row selection
  const rowSelection = enableSelection ? {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[], newSelectedRows: T[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
      setSelectedRows(newSelectedRows)
    },
    getCheckboxProps: (record: T) => ({
      disabled: false,
    }),
  } : undefined

  // Build table columns
  const tableColumns: ColumnsType<T> = [
    ...columns.map((col) => ({
      title: col.title,
      dataIndex: col.dataIndex as string,
      key: col.key,
      width: col.width,
      fixed: col.fixed,
      sorter: col.sortable,
      filterDropdown: col.filterable && col.filterOptions ? (
        <Select
          style={{ width: 200 }}
          placeholder={`Filter ${col.title}`}
          allowClear
          options={col.filterOptions}
          onChange={(value) => {
            const newFilters = { ...filters, [col.key]: value }
            setFilters(newFilters)
            onFilter?.(newFilters)
          }}
        />
      ) : undefined,
      render: col.render,
    })),
  ]

  // Add actions column if needed
  if (showActions && (actions.length > 0 || onEdit || onDelete)) {
    tableColumns.push({
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 150,
      render: (_, record) => (
        <Space size="middle">
          {actions.map((action) => (
            <Tooltip key={action.key} title={action.label}>
              <Button
                type={action.type || 'text'}
                icon={action.icon}
                size="small"
                danger={action.danger}
                disabled={action.disabled?.(record)}
                onClick={() => action.onClick(record)}
              />
            </Tooltip>
          ))}
          
          {onEdit && (
            <Tooltip title="Edit">
              <Button
                type="text"
                icon={<EditOutlined />}
                size="small"
                onClick={() => onEdit(record)}
              />
            </Tooltip>
          )}
          
          {onDelete && (
            <Popconfirm
              title="Are you sure you want to delete this item?"
              onConfirm={() => onDelete(record)}
              okText="Yes"
              cancelText="No"
            >
              <Tooltip title="Delete">
                <Button
                  type="text"
                  icon={<DeleteOutlined />}
                  size="small"
                  danger
                />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    })
  }

  // Handle search
  const handleSearch = (value: string) => {
    setSearchValue(value)
    onSearch?.(value)
  }

  return (
    <Card>
      {/* Header Section */}
      <div style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Space direction="vertical" size={4}>
              {title && <h3 style={{ margin: 0 }}>{title}</h3>}
              {description && (
                <p style={{ margin: 0, color: '#666' }}>{description}</p>
              )}
            </Space>
          </Col>
          <Col>
            <Space>
              {onCreate && (
                <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
                  Create New
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </div>

      {/* Controls Section */}
      <div style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle">
          <Col flex="auto">
            <Space>
              {showSearch && (
                <Search
                  placeholder="Search resources..."
                  allowClear
                  style={{ width: 300 }}
                  onSearch={handleSearch}
                  prefix={<SearchOutlined />}
                />
              )}
              
              {showFilters && (
                <Button icon={<FilterOutlined />}>
                  Filters
                </Button>
              )}
            </Space>
          </Col>
          
          <Col>
            <Space>
              {/* Bulk Actions */}
              {showBulkActions && selectedRowKeys.length > 0 && (
                <>
                  {bulkActions.map((action) => (
                    <Button
                      key={action.key}
                      icon={action.icon}
                      danger={action.danger}
                      onClick={() => action.onClick(selectedRowKeys, selectedRows)}
                    >
                      {action.label} ({selectedRowKeys.length})
                    </Button>
                  ))}
                  
                  {onBulkDelete && (
                    <Popconfirm
                      title={`Are you sure you want to delete ${selectedRowKeys.length} items?`}
                      onConfirm={() => onBulkDelete(selectedRows)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button danger icon={<DeleteOutlined />}>
                        Delete ({selectedRowKeys.length})
                      </Button>
                    </Popconfirm>
                  )}
                </>
              )}
              
              {showRefresh && (
                <Button icon={<ReloadOutlined />} onClick={onRefresh}>
                  Refresh
                </Button>
              )}
              
              {showExport && (
                <Button icon={<DownloadOutlined />} onClick={onExport}>
                  Export
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </div>

      {/* Table */}
      <Table<T>
        rowSelection={rowSelection}
        columns={tableColumns}
        dataSource={data}
        loading={loading}
        rowKey={rowKey}
        size={size}
        expandable={expandable}
        scroll={scroll}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} of ${total} items`,
        }}
        onChange={onTableChange}
      />
    </Card>
  )
}