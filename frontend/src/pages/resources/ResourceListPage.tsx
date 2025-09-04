import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Row,
  Col,
  Space,
  Button,
  Input,
  Select,
  Tag,
  Dropdown,
  Modal,
  Drawer,
  message,
  Checkbox,
  Divider,
  Typography,
  Badge,
  Tooltip,
  Spin
} from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  SettingOutlined,
  DownloadOutlined,
  ReloadOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  EyeOutlined,
  MenuOutlined,
  SaveOutlined,
  ShareAltOutlined
} from '@ant-design/icons';
import { ResourceTable } from '../../components/common/ResourceTable';
import { useNetworkManagement, NetworkResourceType } from '../../hooks/useNetworkManagement';
import { 
  getResourceDisplayName, 
  getResourceStatus, 
  getResourceTypeColor,
  buildQuickFilters,
  getRegionDisplayName
} from '../../utils/network-helpers';
import type { ResourceTableColumn, SearchFilter } from '../../types';

const { Title, Text } = Typography;
const { Option } = Select;

interface ResourceListPageProps {
  resourceType: NetworkResourceType;
  title: string;
  description?: string;
  onCreateNew?: () => void;
  onViewResource?: (resource: any) => void;
  onEditResource?: (resource: any) => void;
}

export const ResourceListPage: React.FC<ResourceListPageProps> = ({
  resourceType,
  title,
  description,
  onCreateNew,
  onViewResource,
  onEditResource
}) => {
  // Network management hook
  const {
    resources,
    loading,
    error,
    total,
    page,
    pageSize,
    selectedItems,
    searchQuery,
    hasSelection,
    isAllSelected,
    loadResources,
    search,
    applyFilters,
    sort,
    paginate,
    refresh,
    deleteResource,
    setSelectedItems,
    selectAll,
    clearSelection,
    bulkDelete,
    exportResources
  } = useNetworkManagement({ resourceType });

  // Local state for UI
  const [searchValue, setSearchValue] = useState('');
  const [activeFilters, setActiveFilters] = useState<SearchFilter[]>([]);
  const [filterDrawerVisible, setFilterDrawerVisible] = useState(false);
  const [columnSettingsVisible, setColumnSettingsVisible] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [saveSearchModalVisible, setSaveSearchModalVisible] = useState(false);

  // Quick filters for the resource type
  const quickFilters = useMemo(() => buildQuickFilters(resourceType), [resourceType]);

  // Column definitions based on resource type
  const getColumns = (): ResourceTableColumn[] => {
    const baseColumns: ResourceTableColumn[] = [
      {
        title: 'Name',
        dataIndex: 'name',
        key: 'name',
        width: 200,
        sortable: true,
        searchable: true,
        render: (value, record) => (
          <Space direction=\"vertical\" size={0}>
            <Text strong>{getResourceDisplayName(record)}</Text>
            <Text type=\"secondary\" style={{ fontSize: '12px' }}>
              {record.awsVpcId || record.awsTgwId || record.awsCgwId || record.awsVpeId}
            </Text>
          </Space>
        )
      },
      {
        title: 'Status',
        dataIndex: 'state',
        key: 'status',
        width: 120,
        sortable: true,
        filterable: true,
        render: (value, record) => {
          const status = getResourceStatus(record);
          return <Tag color={status.color}>{status.text}</Tag>;
        }
      },
      {
        title: 'Region',
        dataIndex: 'region',
        key: 'region',
        width: 140,
        sortable: true,
        filterable: true,
        render: (value) => (
          <Space>
            <Tag color=\"blue\">{value}</Tag>
            <Text type=\"secondary\" style={{ fontSize: '12px' }}>
              {getRegionDisplayName(value)}
            </Text>
          </Space>
        )
      },
      {
        title: 'Environment',
        dataIndex: 'environment',
        key: 'environment',
        width: 120,
        sortable: true,
        filterable: true,
        render: (value) => value ? <Tag>{value}</Tag> : '-'
      },
      {
        title: 'Project',
        dataIndex: 'project',
        key: 'project',
        width: 150,
        sortable: true,
        searchable: true,
        render: (value) => value || '-'
      },
      {
        title: 'Owner',
        dataIndex: 'owner',
        key: 'owner',
        width: 120,
        sortable: true,
        searchable: true,
        render: (value) => value || '-'
      },
      {
        title: 'Created',
        dataIndex: 'createdAt',
        key: 'createdAt',
        width: 140,
        sortable: true,
        render: (value) => new Date(value).toLocaleDateString()
      }
    ];

    // Add resource-specific columns
    if (resourceType === 'vpc') {
      baseColumns.splice(2, 0, {
        title: 'CIDR Block',
        dataIndex: 'cidrBlock',
        key: 'cidrBlock',
        width: 130,
        sortable: true,
        render: (value) => <Tag color=\"purple\">{value}</Tag>
      });
    } else if (resourceType === 'transit-gateway') {
      baseColumns.splice(2, 0, {
        title: 'ASN',
        dataIndex: 'amazonSideAsn',
        key: 'amazonSideAsn',
        width: 100,
        sortable: true
      });
    } else if (resourceType === 'customer-gateway') {
      baseColumns.splice(2, 0, {
        title: 'IP Address',
        dataIndex: 'ipAddress',
        key: 'ipAddress',
        width: 130,
        sortable: true,
        render: (value) => <Tag color=\"cyan\">{value}</Tag>
      }, {
        title: 'BGP ASN',
        dataIndex: 'bgpAsn',
        key: 'bgpAsn',
        width: 100,
        sortable: true
      });
    } else if (resourceType === 'vpc-endpoint') {
      baseColumns.splice(2, 0, {
        title: 'Service',
        dataIndex: 'serviceName',
        key: 'serviceName',
        width: 200,
        sortable: true,
        searchable: true,
        render: (value) => <Text code>{value}</Text>
      }, {
        title: 'Type',
        dataIndex: 'vpcEndpointType',
        key: 'vpcEndpointType',
        width: 120,
        sortable: true,
        filterable: true,
        render: (value) => <Tag color=\"geekblue\">{value}</Tag>
      });
    }

    return baseColumns.filter(col => visibleColumns.length === 0 || visibleColumns.includes(col.key));
  };

  // Handle search
  const handleSearch = (value: string) => {
    setSearchValue(value);
    search(value);
  };

  // Handle filter changes
  const handleFilterChange = (filters: SearchFilter[]) => {
    setActiveFilters(filters);
    applyFilters(filters);
  };

  // Handle quick filter click
  const handleQuickFilter = (filter: SearchFilter) => {
    const newFilters = [...activeFilters, filter];
    handleFilterChange(newFilters);
  };

  // Remove filter
  const removeFilter = (index: number) => {
    const newFilters = activeFilters.filter((_, i) => i !== index);
    handleFilterChange(newFilters);
  };

  // Clear all filters
  const clearAllFilters = () => {
    setActiveFilters([]);
    setSearchValue('');
    applyFilters([]);
  };

  // Handle bulk actions
  const handleBulkDelete = () => {
    Modal.confirm({
      title: `Delete ${selectedItems.length} ${resourceType}(s)?`,
      content: 'This action cannot be undone. The selected resources will be permanently deleted.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: () => bulkDelete()
    });
  };

  // Handle export
  const handleExport = (format: 'csv' | 'json' | 'excel' = 'csv') => {
    const selectedOnly = hasSelection;
    exportResources(format, selectedOnly);
  };

  // Initialize visible columns
  useEffect(() => {
    const columns = getColumns();
    setVisibleColumns(columns.map(col => col.key));
  }, [resourceType]);

  // Resource actions
  const resourceActions = [
    {
      key: 'view',
      label: 'View Details',
      icon: <EyeOutlined />,
      onClick: (record: any) => onViewResource?.(record)
    },
    {
      key: 'edit',
      label: 'Edit',
      icon: <EditOutlined />,
      onClick: (record: any) => onEditResource?.(record)
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: (record: any) => {
        Modal.confirm({
          title: `Delete ${getResourceDisplayName(record)}?`,
          content: 'This action cannot be undone.',
          okText: 'Delete',
          okType: 'danger',
          onOk: () => deleteResource(record.id)
        });
      }
    }
  ];

  // Bulk actions
  const bulkActions = [
    {
      key: 'delete',
      label: 'Delete',
      icon: <DeleteOutlined />,
      danger: true,
      onClick: handleBulkDelete
    }
  ];

  // Export menu
  const exportMenu = {
    items: [
      {
        key: 'csv',
        label: 'Export as CSV',
        onClick: () => handleExport('csv')
      },
      {
        key: 'excel',
        label: 'Export as Excel',
        onClick: () => handleExport('excel')
      },
      {
        key: 'json',
        label: 'Export as JSON',
        onClick: () => handleExport('json')
      }
    ]
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: '16px' }}>
        <Row justify=\"space-between\" align=\"middle\">
          <Col>
            <Space direction=\"vertical\" size={4}>
              <Title level={3} style={{ margin: 0, color: getResourceTypeColor(resourceType) }}>
                {title}
              </Title>
              {description && (
                <Text type=\"secondary\">{description}</Text>
              )}
              <Space size={8}>
                <Badge count={total} overflowCount={999999} />
                <Text type=\"secondary\">resources</Text>
                {hasSelection && (
                  <>
                    <Divider type=\"vertical\" />
                    <Text type=\"secondary\">{selectedItems.length} selected</Text>
                  </>
                )}
              </Space>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                type=\"primary\"
                icon={<PlusOutlined />}
                onClick={onCreateNew}
                disabled={!onCreateNew}
              >
                Create New
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={refresh}
                loading={loading}
              >
                Refresh
              </Button>
              <Dropdown menu={exportMenu} placement=\"bottomRight\">
                <Button icon={<DownloadOutlined />}>
                  Export
                </Button>
              </Dropdown>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Filters and Search */}
      <Card style={{ marginBottom: '16px' }}>
        <Row gutter={[16, 16]}>
          {/* Search */}
          <Col xs={24} md={12} lg={8}>
            <Input.Search
              placeholder={`Search ${resourceType}s...`}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onSearch={handleSearch}
              enterButton={<SearchOutlined />}
              size=\"large\"
            />
          </Col>
          
          {/* Quick Filters */}
          <Col xs={24} md={12} lg={16}>
            <Space wrap>
              <Text strong>Quick Filters:</Text>
              {quickFilters.map((qf, index) => (
                <Button
                  key={index}
                  size=\"small\"
                  onClick={() => handleQuickFilter(qf.filter)}
                  type={activeFilters.some(f => f.field === qf.filter.field && f.value === qf.filter.value) ? 'primary' : 'default'}
                >
                  {qf.label}
                </Button>
              ))}
              <Button
                icon={<FilterOutlined />}
                onClick={() => setFilterDrawerVisible(true)}
              >
                Advanced Filters
              </Button>
              <Button
                icon={<SettingOutlined />}
                onClick={() => setColumnSettingsVisible(true)}
              >
                Columns
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <Row style={{ marginTop: '16px' }}>
            <Col span={24}>
              <Space wrap>
                <Text strong>Active Filters:</Text>
                {activeFilters.map((filter, index) => (
                  <Tag
                    key={index}
                    closable
                    onClose={() => removeFilter(index)}
                    color=\"blue\"
                  >
                    {filter.label || `${filter.field} ${filter.operator} ${filter.value}`}
                  </Tag>
                ))}
                <Button
                  size=\"small\"
                  type=\"link\"
                  onClick={clearAllFilters}
                >
                  Clear All
                </Button>
                <Button
                  size=\"small\"
                  type=\"link\"
                  icon={<SaveOutlined />}
                  onClick={() => setSaveSearchModalVisible(true)}
                >
                  Save Search
                </Button>
              </Space>
            </Col>
          </Row>
        )}
      </Card>

      {/* Main Table */}
      <ResourceTable
        data={resources}
        columns={getColumns()}
        loading={loading}
        total={total}
        page={page}
        pageSize={pageSize}
        rowKey=\"id\"
        actions={resourceActions}
        bulkActions={bulkActions}
        onTableChange={(pagination, filters, sorter) => {
          if (pagination.current && pagination.pageSize) {
            paginate(pagination.current, pagination.pageSize);
          }
          if (sorter && typeof sorter === 'object' && !Array.isArray(sorter)) {
            sort(sorter.field as string, sorter.order === 'ascend' ? 'asc' : 'desc');
          }
        }}
        onRefresh={refresh}
        enableSelection={true}
        showBulkActions={true}
        scroll={{ x: 1200 }}
      />

      {/* Advanced Filters Drawer */}
      <Drawer
        title=\"Advanced Filters\"
        placement=\"right\"
        width={400}
        open={filterDrawerVisible}
        onClose={() => setFilterDrawerVisible(false)}
        extra={
          <Space>
            <Button onClick={clearAllFilters}>Clear All</Button>
            <Button type=\"primary\" onClick={() => setFilterDrawerVisible(false)}>
              Apply
            </Button>
          </Space>
        }
      >
        <div>
          <Text>Filter configuration will be implemented here.</Text>
          <p>Features to include:</p>
          <ul>
            <li>Field selection dropdown</li>
            <li>Operator selection (equals, contains, etc.)</li>
            <li>Value input with validation</li>
            <li>Add/remove filter conditions</li>
            <li>Filter groups with AND/OR logic</li>
          </ul>
        </div>
      </Drawer>

      {/* Column Settings Modal */}
      <Modal
        title=\"Column Settings\"
        open={columnSettingsVisible}
        onCancel={() => setColumnSettingsVisible(false)}
        onOk={() => setColumnSettingsVisible(false)}
        width={500}
      >
        <div>
          <Text strong>Select columns to display:</Text>
          <div style={{ marginTop: '16px' }}>
            <Checkbox.Group
              value={visibleColumns}
              onChange={setVisibleColumns}
              style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
            >
              {getColumns().map(col => (
                <Checkbox key={col.key} value={col.key}>
                  {col.title}
                </Checkbox>
              ))}
            </Checkbox.Group>
          </div>
        </div>
      </Modal>

      {/* Save Search Modal */}
      <Modal
        title=\"Save Search\"
        open={saveSearchModalVisible}
        onCancel={() => setSaveSearchModalVisible(false)}
        onOk={() => {
          // TODO: Implement save search functionality
          message.success('Search saved successfully');
          setSaveSearchModalVisible(false);
        }}
      >
        <div>
          <Text>Save search functionality will be implemented here.</Text>
        </div>
      </Modal>
    </div>
  );
};