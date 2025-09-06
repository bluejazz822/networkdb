import React, { useState } from 'react'
import { Modal, message, Tag } from 'antd'
import { 
  CloudOutlined, 
  EditOutlined, 
  DeleteOutlined,
  EyeOutlined 
} from '@ant-design/icons'
import { ResourceTable, ResourceTableColumn, ResourceTableAction } from '@/components/common/ResourceTable'
import { ResourceForm, FormSection } from '@/components/common/ResourceForm'
import { useVPCs, useCreateVPC, useUpdateVPC, useDeleteVPC, useBulkDeleteVPCs } from '@/hooks/useVPCs'
import { vpcSchema, VPCFormData } from '@/utils/schemas'
import type { VPC } from '@/types/index'

const VPCsNew: React.FC = () => {
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState<Record<string, any>>({})
  
  // Modal states
  const [createModalOpen, setCreateModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [viewModalOpen, setViewModalOpen] = useState(false)
  const [selectedVPC, setSelectedVPC] = useState<VPC | null>(null)

  // Hooks
  const { data: vpcsData, isLoading, refetch } = useVPCs({
    page: currentPage,
    limit: pageSize,
    search: searchTerm,
    ...filters,
  })

  const createVPCMutation = useCreateVPC()
  const updateVPCMutation = useUpdateVPC()
  const deleteVPCMutation = useDeleteVPC()
  const bulkDeleteMutation = useBulkDeleteVPCs()

  // Table columns configuration
  const columns: ResourceTableColumn<VPC>[] = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      sortable: true,
      searchable: true,
      width: 200,
      render: (name: string, record: VPC) => (
        <div>
          <strong>{name}</strong>
          <br />
          <small style={{ color: '#666' }}>{record.id}</small>
        </div>
      ),
    },
    {
      title: 'CIDR Block',
      dataIndex: 'cidr',
      key: 'cidr',
      width: 150,
      render: (cidr: string) => (
        <code style={{ background: '#f5f5f5', padding: '2px 6px', borderRadius: '3px' }}>
          {cidr}
        </code>
      ),
    },
    {
      title: 'Region',
      dataIndex: 'region',
      key: 'region',
      filterable: true,
      filterOptions: [
        { label: 'US East 1', value: 'us-east-1' },
        { label: 'US West 2', value: 'us-west-2' },
        { label: 'EU West 1', value: 'eu-west-1' },
        { label: 'AP Southeast 1', value: 'ap-southeast-1' },
      ],
      width: 150,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      filterable: true,
      filterOptions: [
        { label: 'Available', value: 'available' },
        { label: 'Pending', value: 'pending' },
        { label: 'Deleted', value: 'deleted' },
      ],
      render: (status: string) => {
        const statusColors = {
          available: 'success',
          pending: 'processing',
          deleted: 'error',
        }
        return (
          <Tag color={statusColors[status as keyof typeof statusColors]}>
            {status.toUpperCase()}
          </Tag>
        )
      },
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      sortable: true,
      render: (date: string) => new Date(date).toLocaleDateString(),
    },
  ]

  // Table actions configuration
  const actions: ResourceTableAction<VPC>[] = [
    {
      key: 'view',
      label: 'View Details',
      icon: <EyeOutlined />,
      onClick: (record) => {
        setSelectedVPC(record)
        setViewModalOpen(true)
      },
    },
  ]

  // Form configuration for VPC creation/editing
  const formSections: FormSection[] = [
    {
      title: 'Basic Information',
      description: 'Configure the basic properties of your VPC',
      fields: [
        {
          name: 'name',
          label: 'VPC Name',
          type: 'text',
          required: true,
          placeholder: 'Enter VPC name (e.g., prod-vpc-001)',
          help: 'Use only letters, numbers, hyphens, and underscores',
          span: 12,
        },
        {
          name: 'cidr',
          label: 'CIDR Block',
          type: 'cidr',
          required: true,
          placeholder: '10.0.0.0/16',
          help: 'Enter a valid CIDR block for your VPC',
          span: 12,
        },
        {
          name: 'region',
          label: 'Region',
          type: 'select',
          required: true,
          options: [
            { label: 'US East 1 (N. Virginia)', value: 'us-east-1' },
            { label: 'US West 2 (Oregon)', value: 'us-west-2' },
            { label: 'EU West 1 (Ireland)', value: 'eu-west-1' },
            { label: 'AP Southeast 1 (Singapore)', value: 'ap-southeast-1' },
          ],
          span: 12,
        },
        {
          name: 'status',
          label: 'Status',
          type: 'select',
          required: true,
          options: [
            { label: 'Available', value: 'available' },
            { label: 'Pending', value: 'pending' },
          ],
          span: 12,
        },
      ],
    },
  ]

  // Event handlers
  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    setCurrentPage(pagination.current)
    setPageSize(pagination.pageSize)
    // Handle sorting and filtering here
  }

  const handleSearch = (value: string) => {
    setSearchTerm(value)
    setCurrentPage(1) // Reset to first page when searching
  }

  const handleFilter = (filters: Record<string, any>) => {
    setFilters(filters)
    setCurrentPage(1) // Reset to first page when filtering
  }

  const handleCreate = () => {
    setSelectedVPC(null)
    setCreateModalOpen(true)
  }

  const handleEdit = (vpc: VPC) => {
    setSelectedVPC(vpc)
    setEditModalOpen(true)
  }

  const handleDelete = async (vpc: VPC) => {
    try {
      await deleteVPCMutation.mutateAsync(vpc.id)
      refetch()
    } catch (error) {
      console.error('Failed to delete VPC:', error)
    }
  }

  const handleBulkDelete = async (vpcs: VPC[]) => {
    try {
      const ids = vpcs.map(vpc => vpc.id)
      await bulkDeleteMutation.mutateAsync(ids)
      refetch()
    } catch (error) {
      console.error('Failed to bulk delete VPCs:', error)
    }
  }

  const handleFormSubmit = async (data: VPCFormData) => {
    try {
      if (selectedVPC) {
        // Update existing VPC
        await updateVPCMutation.mutateAsync({
          id: selectedVPC.id,
          data: data as Partial<VPC>,
        })
        setEditModalOpen(false)
      } else {
        // Create new VPC
        await createVPCMutation.mutateAsync(data as Omit<VPC, 'id' | 'createdAt'>)
        setCreateModalOpen(false)
      }
      refetch()
      setSelectedVPC(null)
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  const handleExport = () => {
    message.info('Export functionality will be implemented')
  }

  return (
    <>
      <ResourceTable<VPC>
        title="Virtual Private Clouds (VPCs)"
        description="Manage your virtual private cloud configurations and network isolation"
        
        data={vpcsData?.items || []}
        columns={columns}
        loading={isLoading}
        total={vpcsData?.total || 0}
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

      {/* Create VPC Modal */}
      <Modal
        title="Create New VPC"
        open={createModalOpen}
        onCancel={() => setCreateModalOpen(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        <ResourceForm<VPCFormData>
          sections={formSections}
          schema={vpcSchema}
          onSubmit={handleFormSubmit}
          onCancel={() => setCreateModalOpen(false)}
          submitText="Create VPC"
          loading={createVPCMutation.isPending}
        />
      </Modal>

      {/* Edit VPC Modal */}
      <Modal
        title="Edit VPC"
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={null}
        width={800}
        destroyOnClose
      >
        {selectedVPC && (
          <ResourceForm<VPCFormData>
            sections={formSections}
            schema={vpcSchema}
            defaultValues={selectedVPC}
            onSubmit={handleFormSubmit}
            onCancel={() => setEditModalOpen(false)}
            submitText="Update VPC"
            loading={updateVPCMutation.isPending}
          />
        )}
      </Modal>

      {/* View VPC Modal */}
      <Modal
        title="VPC Details"
        open={viewModalOpen}
        onCancel={() => setViewModalOpen(false)}
        footer={null}
        width={600}
      >
        {selectedVPC && (
          <div>
            <p><strong>ID:</strong> {selectedVPC.id}</p>
            <p><strong>Name:</strong> {selectedVPC.name}</p>
            <p><strong>CIDR Block:</strong> {selectedVPC.cidr}</p>
            <p><strong>Region:</strong> {selectedVPC.region}</p>
            <p><strong>Status:</strong> 
              <Tag color={selectedVPC.status === 'available' ? 'success' : 'processing'}>
                {selectedVPC.status.toUpperCase()}
              </Tag>
            </p>
            <p><strong>Created:</strong> {new Date(selectedVPC.createdAt).toLocaleString()}</p>
          </div>
        )}
      </Modal>
    </>
  )
}

export default VPCsNew