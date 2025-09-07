import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Table,
  Button,
  Space,
  Modal,
  Form,
  Select,
  Input,
  Tree,
  Alert,
  Tag,
  Tooltip,
  Typography,
  Divider,
  Drawer,
  Switch,
  message,
  Empty,
  Badge
} from 'antd';
import {
  LinkOutlined,
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  NodeIndexOutlined,
  BranchesOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  SearchOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { DataNode } from 'antd/es/tree';
import { useNetworkManagement, NetworkResourceType } from '../../hooks/useNetworkManagement';
import {
  getResourceDisplayName,
  getResourceTypeColor,
  getResourceStatus
} from '../../utils/network-helpers';
import type { ResourceRelationship, NetworkResource } from '../../types';

const { Title, Text } = Typography;
const { Option } = Select;

interface ResourceRelationshipManagerProps {
  selectedResource?: NetworkResource;
  onResourceSelect?: (resource: NetworkResource) => void;
}

type RelationshipType = 'depends_on' | 'contains' | 'connects_to' | 'routes_to' | 'attached_to';

interface RelationshipRule {
  sourceType: string;
  targetType: string;
  relationshipType: RelationshipType;
  bidirectional: boolean;
  description: string;
}

// Define valid relationship rules
const RELATIONSHIP_RULES: RelationshipRule[] = [
  {
    sourceType: 'vpc',
    targetType: 'vpc-endpoint',
    relationshipType: 'contains',
    bidirectional: false,
    description: 'VPC contains VPC Endpoints'
  },
  {
    sourceType: 'transit-gateway',
    targetType: 'vpc',
    relationshipType: 'attached_to',
    bidirectional: true,
    description: 'Transit Gateway attached to VPC'
  },
  {
    sourceType: 'customer-gateway',
    targetType: 'vpc',
    relationshipType: 'connects_to',
    bidirectional: false,
    description: 'Customer Gateway connects to VPC'
  },
  {
    sourceType: 'transit-gateway',
    targetType: 'customer-gateway',
    relationshipType: 'routes_to',
    bidirectional: true,
    description: 'Transit Gateway routes to Customer Gateway'
  }
];

export const ResourceRelationshipManager: React.FC<ResourceRelationshipManagerProps> = ({
  selectedResource,
  onResourceSelect
}) => {
  // State
  const [relationships, setRelationships] = useState<ResourceRelationship[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [editingRelationship, setEditingRelationship] = useState<ResourceRelationship | null>(null);
  const [detailsDrawerVisible, setDetailsDrawerVisible] = useState(false);
  const [selectedRelationship, setSelectedRelationship] = useState<ResourceRelationship | null>(null);
  const [showDependencyTree, setShowDependencyTree] = useState(false);
  const [form] = Form.useForm();

  // Network management hooks
  const vpcHook = useNetworkManagement({ resourceType: 'vpc', autoLoad: true });
  const tgwHook = useNetworkManagement({ resourceType: 'transit-gateway', autoLoad: true });
  const cgwHook = useNetworkManagement({ resourceType: 'customer-gateway', autoLoad: true });
  const vpeHook = useNetworkManagement({ resourceType: 'vpc-endpoint', autoLoad: true });

  // Get all resources
  const allResources = [
    ...vpcHook.resources,
    ...tgwHook.resources,
    ...cgwHook.resources,
    ...vpeHook.resources
  ];

  // Load relationships
  const loadRelationships = async () => {
    setLoading(true);
    try {
      // Mock relationships data - in real implementation, this would call the API
      const mockRelationships: ResourceRelationship[] = [
        {
          id: 'rel-1',
          sourceId: vpcHook.resources[0]?.id || 'vpc-1',
          sourceType: 'vpc',
          targetId: vpeHook.resources[0]?.id || 'vpce-1',
          targetType: 'vpc-endpoint',
          relationshipType: 'contains',
          metadata: { created_by: 'system', auto_detected: true },
          createdAt: new Date().toISOString()
        },
        {
          id: 'rel-2',
          sourceId: tgwHook.resources[0]?.id || 'tgw-1',
          sourceType: 'transit-gateway',
          targetId: vpcHook.resources[0]?.id || 'vpc-1',
          targetType: 'vpc',
          relationshipType: 'attached_to',
          metadata: { attachment_id: 'tgw-attach-123', state: 'available' },
          createdAt: new Date().toISOString()
        }
      ];
      
      setRelationships(mockRelationships);
    } catch (error) {
      console.error('Failed to load relationships:', error);
      message.error('Failed to load relationships');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRelationships();
  }, []);

  // Get resource by ID
  const getResourceById = (id: string): NetworkResource | undefined => {
    return allResources.find(resource => resource.id === id);
  };

  // Get resource type from ID
  const getResourceTypeFromId = (id: string): string => {
    if (id.startsWith('vpc-') && !id.includes('vpce-')) return 'vpc';
    if (id.startsWith('tgw-')) return 'transit-gateway';
    if (id.startsWith('cgw-')) return 'customer-gateway';
    if (id.includes('vpce-')) return 'vpc-endpoint';
    return 'unknown';
  };

  // Get valid target types for a source resource
  const getValidTargetTypes = (sourceType: string): string[] => {
    const validTypes = RELATIONSHIP_RULES
      .filter(rule => rule.sourceType === sourceType)
      .map(rule => rule.targetType);
    
    // Add bidirectional relationships
    RELATIONSHIP_RULES
      .filter(rule => rule.targetType === sourceType && rule.bidirectional)
      .forEach(rule => validTypes.push(rule.sourceType));
    
    return [...new Set(validTypes)];
  };

  // Get valid relationship types for source-target pair
  const getValidRelationshipTypes = (sourceType: string, targetType: string): RelationshipType[] => {
    const directRules = RELATIONSHIP_RULES
      .filter(rule => rule.sourceType === sourceType && rule.targetType === targetType)
      .map(rule => rule.relationshipType);
    
    const bidirectionalRules = RELATIONSHIP_RULES
      .filter(rule => rule.targetType === sourceType && rule.sourceType === targetType && rule.bidirectional)
      .map(rule => rule.relationshipType);
    
    return [...directRules, ...bidirectionalRules];
  };

  // Create new relationship
  const handleCreateRelationship = async (values: any) => {
    try {
      const newRelationship: ResourceRelationship = {
        id: `rel-${Date.now()}`,
        sourceId: values.sourceId,
        sourceType: getResourceTypeFromId(values.sourceId),
        targetId: values.targetId,
        targetType: getResourceTypeFromId(values.targetId),
        relationshipType: values.relationshipType,
        metadata: values.metadata ? JSON.parse(values.metadata) : {},
        createdAt: new Date().toISOString()
      };

      setRelationships(prev => [...prev, newRelationship]);
      message.success('Relationship created successfully');
      setCreateModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('Failed to create relationship:', error);
      message.error('Failed to create relationship');
    }
  };

  // Delete relationship
  const handleDeleteRelationship = (relationship: ResourceRelationship) => {
    Modal.confirm({
      title: 'Delete Relationship',
      content: 'Are you sure you want to delete this relationship?',
      okText: 'Delete',
      okType: 'danger',
      onOk: () => {
        setRelationships(prev => prev.filter(r => r.id !== relationship.id));
        message.success('Relationship deleted successfully');
      }
    });
  };

  // Build dependency tree
  const buildDependencyTree = (rootResourceId: string): DataNode[] => {
    const visited = new Set<string>();
    
    const buildNode = (resourceId: string): DataNode => {
      if (visited.has(resourceId)) {
        return {
          title: 'Circular reference detected',
          key: `circular-${resourceId}`,
          disabled: true
        };
      }
      
      visited.add(resourceId);
      const resource = getResourceById(resourceId);
      const resourceType = getResourceTypeFromId(resourceId);
      
      // Find relationships where this resource is the source
      const childRelationships = relationships.filter(rel => rel.sourceId === resourceId);
      
      const children: DataNode[] = childRelationships.map(rel => {
        const childNode = buildNode(rel.targetId);
        return {
          ...childNode,
          title: (
            <Space>
              <Tag color={getResourceTypeColor(rel.targetType)}>{rel.relationshipType}</Tag>
              {childNode.title}
            </Space>
          ),
          key: `${rel.id}-${childNode.key}`
        };
      });
      
      visited.delete(resourceId);
      
      return {
        title: (
          <Space>
            <Text strong>{resource ? getResourceDisplayName(resource) : resourceId}</Text>
            <Tag color={getResourceTypeColor(resourceType)}>{resourceType}</Tag>
          </Space>
        ),
        key: resourceId,
        children: children.length > 0 ? children : undefined
      };
    };
    
    return [buildNode(rootResourceId)];
  };

  // Table columns
  const columns: ColumnsType<ResourceRelationship> = [
    {
      title: 'Source Resource',
      key: 'source',
      render: (_, record) => {
        const resource = getResourceById(record.sourceId);
        return (
          <Space direction=\"vertical\" size={0}>
            <Text strong>{resource ? getResourceDisplayName(resource) : record.sourceId}</Text>
            <Tag color={getResourceTypeColor(record.sourceType)} size=\"small\">
              {record.sourceType}
            </Tag>
          </Space>
        );
      }
    },
    {
      title: 'Relationship',
      dataIndex: 'relationshipType',
      key: 'relationshipType',
      render: (type) => (
        <Tag color=\"blue\">{type.replace('_', ' ')}</Tag>
      )
    },
    {
      title: 'Target Resource',
      key: 'target',
      render: (_, record) => {
        const resource = getResourceById(record.targetId);
        return (
          <Space direction=\"vertical\" size={0}>
            <Text strong>{resource ? getResourceDisplayName(resource) : record.targetId}</Text>
            <Tag color={getResourceTypeColor(record.targetType)} size=\"small\">
              {record.targetType}
            </Tag>
          </Space>
        );
      }
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString()
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Tooltip title=\"View Details\">
            <Button 
              size=\"small\" 
              icon={<InfoCircleOutlined />}
              onClick={() => {
                setSelectedRelationship(record);
                setDetailsDrawerVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title=\"Edit\">
            <Button 
              size=\"small\" 
              icon={<EditOutlined />}
              onClick={() => {
                setEditingRelationship(record);
                form.setFieldsValue(record);
                setCreateModalVisible(true);
              }}
            />
          </Tooltip>
          <Tooltip title=\"Delete\">
            <Button 
              size=\"small\" 
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDeleteRelationship(record)}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  // Filter relationships by selected resource
  const filteredRelationships = selectedResource 
    ? relationships.filter(rel => 
        rel.sourceId === selectedResource.id || rel.targetId === selectedResource.id
      )
    : relationships;

  return (
    <div>
      {/* Header */}
      <Card style={{ marginBottom: '16px' }}>
        <Row justify=\"space-between\" align=\"middle\">
          <Col>
            <Space>
              <LinkOutlined style={{ fontSize: '20px', color: '#1890ff' }} />
              <Title level={4} style={{ margin: 0 }}>Resource Relationships</Title>
              <Badge count={filteredRelationships.length} />
            </Space>
          </Col>
          <Col>
            <Space>
              <Switch
                checked={showDependencyTree}
                onChange={setShowDependencyTree}
                checkedChildren=\"Tree View\"
                unCheckedChildren=\"Table View\"
              />
              <Button
                type=\"primary\"
                icon={<PlusOutlined />}
                onClick={() => {
                  setEditingRelationship(null);
                  form.resetFields();
                  setCreateModalVisible(true);
                }}
              >
                Create Relationship
              </Button>
            </Space>
          </Col>
        </Row>

        {selectedResource && (
          <Alert
            message={`Showing relationships for: ${getResourceDisplayName(selectedResource)}`}
            type=\"info\"
            style={{ marginTop: '16px' }}
            closable
            onClose={() => onResourceSelect?.(undefined as any)}
          />
        )}
      </Card>

      {/* Content */}
      <Card>
        {showDependencyTree && selectedResource ? (
          <div>
            <Title level={5}>
              <BranchesOutlined /> Dependency Tree for {getResourceDisplayName(selectedResource)}
            </Title>
            <Tree
              showLine
              showIcon
              treeData={buildDependencyTree(selectedResource.id)}
              defaultExpandAll
            />
          </div>
        ) : (
          <Table
            dataSource={filteredRelationships}
            columns={columns}
            rowKey=\"id\"
            loading={loading}
            pagination={false}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description=\"No relationships found\"
                />
              )
            }}
          />
        )}
      </Card>

      {/* Create/Edit Relationship Modal */}
      <Modal
        title={editingRelationship ? 'Edit Relationship' : 'Create Relationship'}
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          setEditingRelationship(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form
          form={form}
          layout=\"vertical\"
          onFinish={handleCreateRelationship}
          initialValues={selectedResource ? { sourceId: selectedResource.id } : {}}
        >
          <Form.Item
            name=\"sourceId\"
            label=\"Source Resource\"
            rules={[{ required: true, message: 'Please select source resource' }]}
          >
            <Select
              showSearch
              placeholder=\"Select source resource\"
              filterOption={(input, option) =>
                (option?.children as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {allResources.map(resource => (
                <Option key={resource.id} value={resource.id}>
                  <Space>
                    <Tag color={getResourceTypeColor(getResourceTypeFromId(resource.id))} size=\"small\">
                      {getResourceTypeFromId(resource.id)}
                    </Tag>
                    {getResourceDisplayName(resource)}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name=\"targetId\"
            label=\"Target Resource\"
            rules={[{ required: true, message: 'Please select target resource' }]}
          >
            <Select
              showSearch
              placeholder=\"Select target resource\"
              filterOption={(input, option) =>
                (option?.children as string)?.toLowerCase().includes(input.toLowerCase())
              }
            >
              {allResources.map(resource => (
                <Option key={resource.id} value={resource.id}>
                  <Space>
                    <Tag color={getResourceTypeColor(getResourceTypeFromId(resource.id))} size=\"small\">
                      {getResourceTypeFromId(resource.id)}
                    </Tag>
                    {getResourceDisplayName(resource)}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name=\"relationshipType\"
            label=\"Relationship Type\"
            rules={[{ required: true, message: 'Please select relationship type' }]}
          >
            <Select placeholder=\"Select relationship type\">
              <Option value=\"depends_on\">Depends On</Option>
              <Option value=\"contains\">Contains</Option>
              <Option value=\"connects_to\">Connects To</Option>
              <Option value=\"routes_to\">Routes To</Option>
              <Option value=\"attached_to\">Attached To</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name=\"metadata\"
            label=\"Metadata (JSON)\"
          >
            <Input.TextArea
              rows={3}
              placeholder='{\"key\": \"value\"}'
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Relationship Details Drawer */}
      <Drawer
        title=\"Relationship Details\"
        placement=\"right\"
        width={400}
        open={detailsDrawerVisible}
        onClose={() => setDetailsDrawerVisible(false)}
      >
        {selectedRelationship && (
          <Space direction=\"vertical\" style={{ width: '100%' }} size=\"middle\">
            <div>
              <Text strong>Relationship ID:</Text>
              <br />
              <Text code>{selectedRelationship.id}</Text>
            </div>

            <Divider />

            <div>
              <Text strong>Source Resource:</Text>
              <br />
              <Space direction=\"vertical\" size={4}>
                <Text>{getResourceById(selectedRelationship.sourceId)?.name || selectedRelationship.sourceId}</Text>
                <Tag color={getResourceTypeColor(selectedRelationship.sourceType)}>
                  {selectedRelationship.sourceType}
                </Tag>
              </Space>
            </div>

            <div>
              <Text strong>Target Resource:</Text>
              <br />
              <Space direction=\"vertical\" size={4}>
                <Text>{getResourceById(selectedRelationship.targetId)?.name || selectedRelationship.targetId}</Text>
                <Tag color={getResourceTypeColor(selectedRelationship.targetType)}>
                  {selectedRelationship.targetType}
                </Tag>
              </Space>
            </div>

            <div>
              <Text strong>Relationship Type:</Text>
              <br />
              <Tag color=\"blue\">{selectedRelationship.relationshipType.replace('_', ' ')}</Tag>
            </div>

            <Divider />

            <div>
              <Text strong>Created:</Text>
              <br />
              <Text>{new Date(selectedRelationship.createdAt).toLocaleString()}</Text>
            </div>

            {selectedRelationship.metadata && Object.keys(selectedRelationship.metadata).length > 0 && (
              <div>
                <Text strong>Metadata:</Text>
                <br />
                <pre style={{ fontSize: '12px', background: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                  {JSON.stringify(selectedRelationship.metadata, null, 2)}
                </pre>
              </div>
            )}
          </Space>
        )}
      </Drawer>
    </div>
  );
};