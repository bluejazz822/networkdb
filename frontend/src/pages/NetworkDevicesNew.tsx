import React, { useState } from 'react'
import { Modal, message, Tag, Badge } from 'antd'
import { 
  GlobalOutlined, 
  EditOutlined, 
  DeleteOutlined,
  EyeOutlined,
  RouterOutlined,
  CloudServerOutlined,
  SafetyOutlined,
  LoadingOutlined,
} from '@ant-design/icons'
import { ResourceTable, ResourceTableColumn, ResourceTableAction } from '@/components/common/ResourceTable'
import { ResourceForm, FormSection } from '@/components/common/ResourceForm'
import { 
  useNetworkDevices, 
  useCreateNetworkDevice, 
  useUpdateNetworkDevice, 
  useDeleteNetworkDevice, 
  useBulkDeleteNetworkDevices 
} from '@/hooks/useNetworkDevices'
import { networkDeviceSchema, NetworkDeviceFormData } from '@/utils/schemas'
import type { NetworkDevice } from '@/types/index'

const NetworkDevicesNew: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<Record<string, any>>({})
  
  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [selectedDevice, setSelectedDevice] = useState<NetworkDevice | null>(null)

  // Hooks
  const { data: devicesData, isLoading, refetch } = useNetworkDevices({
    page: currentPage,
    limit: pageSize,
    search: searchTerm,
    ...filters,
  })

  const createDeviceMutation = useCreateNetworkDevice()
  const updateDeviceMutation = useUpdateNetworkDevice()
  const deleteDeviceMutation = useDeleteNetworkDevice()
  const bulkDeleteMutation = useBulkDeleteNetworkDevices()

  // Icon mapping for device types
  const getDeviceIcon = (type: string) => {
    const icons = {
      'router': <RouterOutlined style={{ color: '#1890ff' }} />,
      'switch': <GlobalOutlined style={{ color: '#52c41a' }} />,
      'firewall': <SafetyOutlined style={{ color: '#faad14' }} />,
      'load-balancer': <LoadingOutlined style={{ color: '#722ed1' }} />,
    }
    return icons[type as keyof typeof icons] || <GlobalOutlined />
  }

  // Table columns configuration
  const columns: ResourceTableColumn<NetworkDevice>[] = [
    {
      title: 'Device',
      dataIndex: 'name',
      key: 'name',
      sortable: true,
      searchable: true,
      width: 250,
      render: (name: string, record: NetworkDevice) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {getDeviceIcon(record.type)}
          <div>
            <strong>{name}</strong>
            <br />
            <small style={{ color: '#666' }}>{record.id}</small>
          </div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      filterable: true,
      filterOptions: [
        { label: 'Router', value: 'router' },
        { label: 'Switch', value: 'switch' },
        { label: 'Firewall', value: 'firewall' },
        { label: 'Load Balancer', value: 'load-balancer' },
      ],
      render: (type: string) => (
        <Tag color={
          type === 'router' ? 'blue' : 
          type === 'switch' ? 'green' : 
          type === 'firewall' ? 'orange' : 
          'purple'
        }>
          {type.toUpperCase().replace('-', ' ')}
        </Tag>
      ),
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      width: 140,
      render: (ip: string) => (
        <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '3px' }}>
          {ip}
        </code>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      filterable: true,
      filterOptions: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
        { label: 'Maintenance', value: 'maintenance' },
      ],
      render: (status: string) => (
        <Badge 
          status={
            status === 'active' ? 'success' : 
            status === 'inactive' ? 'error' : 
            'warning'
          }
          text={status.toUpperCase()}
        />
      ),
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      width: 200,
      filterable: true,
      filterOptions: [
        { label: 'US East 1', value: 'us-east-1' },
        { label: 'US West 2', value: 'us-west-2' },
        { label: 'EU West 1', value: 'eu-west-1' },
      ],
    },
    {
      title: 'Last Seen',
      dataIndex: 'lastSeen',
      key: 'lastSeen',
      width: 150,
      sortable: true,
      render: (date: string) => {
        const lastSeen = new Date(date)
        const now = new Date()
        const diffMinutes = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60))
        
        let color = 'success'
        let text = ''
        
        if (diffMinutes < 5) {
          text = 'Just now'
        } else if (diffMinutes < 60) {
          text = `${diffMinutes}m ago`
        } else if (diffMinutes < 1440) {
          text = `${Math.floor(diffMinutes / 60)}h ago`
          color = 'warning'
        } else {
          text = `${Math.floor(diffMinutes / 1440)}d ago`
          color = 'error'
        }
        
        return (
          <Tag color={color}>
            {text}
          </Tag>
        )
      },
    },
  ]

  // Table actions configuration
  const actions: ResourceTableAction<NetworkDevice>[] = [
    {
      key: 'view',
      label: 'View Details',
      icon: <EyeOutlined />,
      onClick: (record) => {
        setSelectedDevice(record)
        setViewModalOpen(true)
      },
    },
  ]

  // Form configuration for device creation/editing
  const formSections: FormSection[] = [
    {
      title: 'Device Information',
      description: 'Configure the basic properties of your network device',
      fields: [
        {
          name: 'name',
          label: 'Device Name',
          type: 'text',
          required: true,
          placeholder: 'Enter device name (e.g., router-001, sw-core-01)',
          span: 12,
        },
        {
          name: 'type',
          label: 'Device Type',
          type: 'select',
          required: true,
          options: [
            { label: 'Router', value: 'router' },
            { label: 'Switch', value: 'switch' },
            { label: 'Firewall', value: 'firewall' },
            { label: 'Load Balancer', value: 'load-balancer' },
          ],
          span: 12,
        },
        {
          name: 'ipAddress',
          label: 'IP Address',
          type: 'ip',
          required: true,
          placeholder: '192.168.1.1',
          help: 'Enter the management IP address for this device',
          span: 12,
        },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Inactive', value: 'inactive' },
            { label: 'Maintenance', value: 'maintenance' },
          ],
          span: 12,
        },
        {
          name: 'location',
          label: 'Location',
          type: 'text',
          required: true,
          placeholder: 'Data center location or region',
          help: 'Physical or logical location of the device',
          span: 24,
        },
      ],
    },
  ]

  // Event handlers
  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    setCurrentPage(pagination.current)
    setPageSize(pagination.pageSize)
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1)
  }

  const handleFilter = (filters: Record<string, any>) => {
    setFilters(filters)
    setCurrentPage(1)
  }

  const handleCreate = () => {
    setSelectedDevice(null)
    setCreateModalOpen(true)
  }

  const handleEdit = (device: NetworkDevice) => {
    setSelectedDevice(device)
    setEditModalOpen(true)
  }

  const handleDelete = async (device: NetworkDevice) => {
    try {
      await deleteDeviceMutation.mutateAsync(device.id)
      refetch()
    } catch (error) {
      console.error('Failed to delete device:', error)
    }
  }

  const handleBulkDelete = async (devices: NetworkDevice[]) => {
    try {
      const ids = devices.map(device => device.id)
      await bulkDeleteMutation.mutateAsync(ids)
      refetch()
    } catch (error) {
      console.error('Failed to bulk delete devices:', error)
    }
  }

  const handleFormSubmit = async (data: NetworkDeviceFormData) => {
    try {
      if (selectedDevice) {
        await updateDeviceMutation.mutateAsync({
          id: selectedDevice.id,
          data: data as Partial<NetworkDevice>,
        })
        setEditModalOpen(false)
      } else {
        await createDeviceMutation.mutateAsync(data as Omit<NetworkDevice, 'id' | 'lastSeen'>)
        setCreateModalOpen(false)
      }
      refetch()
      setSelectedDevice(null)
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  const handleExport = () => {
    message.info('Export functionality will be implemented')
  }

  return (
    <>
      <ResourceTable<NetworkDevice>
        title="Network Devices"
        description="Manage your network infrastructure devices including routers, switches, firewalls, and load balancers"
        
        data={devicesData?.items || []}
        columns={columns}
        loading={isLoading}
        total={devicesData?.total || 0}
        page={currentPage}
        pageSize={pageSize}
        rowKey="id"
        
        actions={actions}
        bulkActions={[
          {
            key: 'bulk-delete',
            label: 'Delete Selected',
            icon: <DeleteOutlined />,
            danger: true,
            onClick: (_, selectedRows) => handleBulkDelete(selectedRows),
          },
        ]}
        
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onBulkDelete={handleBulkDelete}
        
        onTableChange={handleTableChange}
        onSearch={handleSearch}
        onFilter={handleFilter}
        onRefresh={refetch}
        onExport={handleExport}
        
        showActions={true}
        showBulkActions={true}
        showSearch={true}
        showFilters={true}
        showRefresh={true}
        showExport={true}
        enableSelection={true}
      />

      {/* Create Device Modal */}
      <Modal
        title="Add Network Device"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <ResourceForm<NetworkDeviceFormData>
          sections={formSections}
          schema={networkDeviceSchema}
          onSubmit={handleFormSubmit}
          onCancel={() => setCreateModalOpen(false)}
          submitText="Add Device"
          loading={createDeviceMutation.isPending}
        />
      </Modal>

      {/* Edit Device Modal */}
      <Modal
        title="Edit Network Device"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        {selectedDevice && (
          <ResourceForm<NetworkDeviceFormData>
            sections={formSections}
            schema={networkDeviceSchema}
            defaultValues={selectedDevice}
            onSubmit={handleFormSubmit}
            onCancel={() => setEditModalOpen(false)}
            submitText="Update Device"
            loading={updateDeviceMutation.isPending}
          />
        )}
      </Modal>

      {/* View Device Modal */}
      <Modal
        title="Device Details"
        open={viewModalOpen}
        onCancel={() => setViewModalOpen(false)}
        footer={null}
        width={600}
      >
        {selectedDevice && (
          <div style={{ padding: '16px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              {getDeviceIcon(selectedDevice.type)}
              <h3 style={{ margin: 0 }}>{selectedDevice.name}</h3>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '150px 1fr', gap: 8, fontSize: 14 }}>
              <strong>Device ID:</strong>
              <span>{selectedDevice.id}</span>
              
              <strong>Type:</strong>
              <Tag color={
                selectedDevice.type === 'router' ? 'blue' : 
                selectedDevice.type === 'switch' ? 'green' : 
                selectedDevice.type === 'firewall' ? 'orange' : 
                'purple'
              }>
                {selectedDevice.type.toUpperCase().replace('-', ' ')}
              </Tag>
              
              <strong>IP Address:</strong>
              <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '3px' }}>
                {selectedDevice.ipAddress}
              </code>
              
              <strong>Status:</strong>
              <Badge 
                status={
                  selectedDevice.status === 'active' ? 'success' : 
                  selectedDevice.status === 'inactive' ? 'error' : 
                  'warning'
                }
                text={selectedDevice.status.toUpperCase()}
              />
              
              <strong>Location:</strong>
              <span>{selectedDevice.location}</span>
              
              <strong>Last Seen:</strong>
              <span>{new Date(selectedDevice.lastSeen).toLocaleString()}</span>
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}

export default NetworkDevicesNew