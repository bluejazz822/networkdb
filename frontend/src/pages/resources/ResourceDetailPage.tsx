import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Space,
  Button,
  Descriptions,
  Tag,
  Alert,
  Spin,
  Tabs,
  Timeline,
  Table,
  Badge,
  Typography,
  Tooltip,
  Divider,
  Modal,
  message
} from 'antd';
import {
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  ShareAltOutlined,
  HistoryOutlined,
  ApiOutlined,
  MonitorOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ArrowLeftOutlined
} from '@ant-design/icons';
import { useNetworkManagement, NetworkResourceType } from '../../hooks/useNetworkManagement';
import {
  getResourceDisplayName,
  getResourceStatus,
  getResourceTypeColor,
  getRegionDisplayName,
  getAwsResourceId,
  isVPC,
  isTransitGateway,
  isCustomerGateway,
  isVpcEndpoint
} from '../../utils/network-helpers';
import type { NetworkResource, ResourceHealth, ResourceRelationship, Alert as AlertType } from '../../types';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

interface ResourceDetailPageProps {
  resourceType: NetworkResourceType;
  resourceId: string;
  onEdit?: (resource: NetworkResource) => void;
  onBack?: () => void;
}

export const ResourceDetailPage: React.FC<ResourceDetailPageProps> = ({
  resourceType,
  resourceId,
  onEdit,
  onBack
}) => {
  const [resource, setResource] = useState<NetworkResource | null>(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState<ResourceHealth | null>(null);
  const [relationships, setRelationships] = useState<ResourceRelationship[]>([]);
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [auditLog, setAuditLog] = useState<any[]>([]);
  
  const { loadResource, deleteResource, loadHealthData, loadNetworkTopology } = useNetworkManagement({ 
    resourceType, 
    autoLoad: false 
  });

  // Load resource details
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const resourceData = await loadResource(resourceId);
        if (resourceData) {
          setResource(resourceData);
        }
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [resourceId, loadResource]);

  // Handle delete
  const handleDelete = () => {
    if (!resource) return;

    Modal.confirm({
      title: `Delete ${getResourceDisplayName(resource)}?`,
      content: 'This action cannot be undone. The resource will be permanently deleted.',
      icon: <ExclamationCircleOutlined />,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        const success = await deleteResource(resourceId);
        if (success) {
          onBack?.();
        }
      }
    });
  };

  // Render resource-specific details
  const renderResourceDetails = (resource: NetworkResource) => {
    const items = [
      {
        key: 'id',
        label: 'Resource ID',
        children: <Text code>{resource.id}</Text>
      },
      {
        key: 'awsId',
        label: 'AWS ID',
        children: <Text code>{getAwsResourceId(resource)}</Text>
      },
      {
        key: 'name',
        label: 'Name',
        children: resource.name || '-'
      },
      {
        key: 'description',
        label: 'Description',
        children: resource.description || '-'
      },
      {
        key: 'region',
        label: 'Region',
        children: (
          <Space>
            <Tag color=\"blue\">{(resource as any).region}</Tag>
            <Text type=\"secondary\">{getRegionDisplayName((resource as any).region)}</Text>
          </Space>
        )
      },
      {
        key: 'status',
        label: 'Status',
        children: (() => {
          const status = getResourceStatus(resource);
          return <Tag color={status.color}>{status.text}</Tag>;
        })()
      },
      {
        key: 'environment',
        label: 'Environment',
        children: resource.environment ? <Tag>{resource.environment}</Tag> : '-'
      },
      {
        key: 'project',
        label: 'Project',
        children: resource.project || '-'
      },
      {
        key: 'owner',
        label: 'Owner',
        children: resource.owner || '-'
      },
      {
        key: 'costCenter',
        label: 'Cost Center',
        children: resource.costCenter || '-'
      }
    ];

    // Add resource-specific fields
    if (isVPC(resource)) {
      items.push(
        {
          key: 'cidrBlock',
          label: 'CIDR Block',
          children: <Tag color=\"purple\">{resource.cidrBlock}</Tag>
        },
        {
          key: 'isDefault',
          label: 'Default VPC',
          children: resource.isDefault ? <Tag color=\"green\">Yes</Tag> : <Tag>No</Tag>
        },
        {
          key: 'instanceTenancy',
          label: 'Instance Tenancy',
          children: <Tag>{resource.instanceTenancy}</Tag>
        },
        {
          key: 'dnsSupport',
          label: 'DNS Support',
          children: resource.enableDnsSupport ? <Tag color=\"green\">Enabled</Tag> : <Tag color=\"red\">Disabled</Tag>
        },
        {
          key: 'dnsHostnames',
          label: 'DNS Hostnames',
          children: resource.enableDnsHostnames ? <Tag color=\"green\">Enabled</Tag> : <Tag color=\"red\">Disabled</Tag>
        }
      );
    } else if (isTransitGateway(resource)) {
      items.push(
        {
          key: 'amazonSideAsn',
          label: 'Amazon Side ASN',
          children: <Text code>{resource.amazonSideAsn}</Text>
        },
        {
          key: 'autoAccept',
          label: 'Auto Accept Attachments',
          children: resource.autoAcceptSharedAttachments ? <Tag color=\"green\">Enabled</Tag> : <Tag color=\"red\">Disabled</Tag>
        },
        {
          key: 'dnsSupport',
          label: 'DNS Support',
          children: <Tag color={resource.dnsSupport === 'enable' ? 'green' : 'red'}>{resource.dnsSupport}</Tag>
        },
        {
          key: 'multicast',
          label: 'Multicast',
          children: <Tag color={resource.multicast === 'enable' ? 'green' : 'red'}>{resource.multicast}</Tag>
        }
      );
    } else if (isCustomerGateway(resource)) {
      items.push(
        {
          key: 'ipAddress',
          label: 'IP Address',
          children: <Tag color=\"cyan\">{resource.ipAddress}</Tag>
        },
        {
          key: 'bgpAsn',
          label: 'BGP ASN',
          children: <Text code>{resource.bgpAsn}</Text>
        },
        {
          key: 'type',
          label: 'Type',
          children: <Tag>{resource.type}</Tag>
        },
        {
          key: 'deviceName',
          label: 'Device Name',
          children: resource.deviceName || '-'
        }
      );
    } else if (isVpcEndpoint(resource)) {
      items.push(
        {
          key: 'serviceName',
          label: 'Service Name',
          children: <Text code>{resource.serviceName}</Text>
        },
        {
          key: 'vpcEndpointType',
          label: 'Endpoint Type',
          children: <Tag color=\"geekblue\">{resource.vpcEndpointType}</Tag>
        },
        {
          key: 'vpcId',
          label: 'VPC ID',
          children: resource.vpcId ? <Text code>{resource.vpcId}</Text> : '-'
        },
        {
          key: 'privateDns',
          label: 'Private DNS',
          children: resource.privateDnsEnabled ? <Tag color=\"green\">Enabled</Tag> : <Tag color=\"red\">Disabled</Tag>
        }
      );
    }

    items.push(
      {
        key: 'createdAt',
        label: 'Created',
        children: new Date(resource.createdAt).toLocaleString()
      },
      {
        key: 'updatedAt',
        label: 'Updated',
        children: new Date(resource.updatedAt).toLocaleString()
      }
    );

    return <Descriptions bordered items={items} column={2} size=\"middle\" />;
  };

  // Render health status
  const renderHealthStatus = () => {
    if (!health) {
      return <Text type=\"secondary\">No health data available</Text>;
    }

    const statusConfig = {
      'healthy': { color: 'success', icon: <CheckCircleOutlined /> },
      'warning': { color: 'warning', icon: <WarningOutlined /> },
      'critical': { color: 'error', icon: <ExclamationCircleOutlined /> },
      'unknown': { color: 'default', icon: <WarningOutlined /> }
    };

    const config = statusConfig[health.status];

    return (
      <div>
        <Space align=\"center\" style={{ marginBottom: '16px' }}>
          <Badge status={config.color as any} />
          {config.icon}
          <Text strong>
            Health Status: {health.status.charAt(0).toUpperCase() + health.status.slice(1)}
          </Text>
          <Text type=\"secondary\">
            (Last checked: {new Date(health.lastChecked).toLocaleString()})
          </Text>
        </Space>

        {health.metrics && Object.keys(health.metrics).length > 0 && (
          <div>
            <Title level={5}>Metrics</Title>
            <Row gutter={[16, 16]}>
              {Object.entries(health.metrics).map(([key, value]) => (
                <Col key={key} xs={12} sm={8} md={6}>
                  <Card size=\"small\">
                    <Text type=\"secondary\">{key}</Text>
                    <div>
                      <Text strong>{value}</Text>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        )}

        {health.alerts && health.alerts.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <Title level={5}>Active Alerts</Title>
            {health.alerts.map((alert, index) => (
              <Alert
                key={index}
                type={alert.severity === 'critical' ? 'error' : alert.severity === 'high' ? 'warning' : 'info'}
                message={alert.title}
                description={alert.description}
                showIcon
                style={{ marginBottom: '8px' }}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render relationships
  const renderRelationships = () => {
    if (relationships.length === 0) {
      return <Text type=\"secondary\">No relationships found</Text>;
    }

    const columns = [
      {
        title: 'Relationship',
        dataIndex: 'relationshipType',
        key: 'relationshipType',
        render: (type: string) => <Tag color=\"blue\">{type.replace('_', ' ')}</Tag>
      },
      {
        title: 'Target Resource',
        dataIndex: 'targetId',
        key: 'targetId',
        render: (id: string) => <Text code>{id}</Text>
      },
      {
        title: 'Type',
        dataIndex: 'targetType',
        key: 'targetType',
        render: (type: string) => <Tag>{type}</Tag>
      },
      {
        title: 'Created',
        dataIndex: 'createdAt',
        key: 'createdAt',
        render: (date: string) => new Date(date).toLocaleDateString()
      }
    ];

    return (
      <Table
        dataSource={relationships}
        columns={columns}
        rowKey=\"id\"
        pagination={false}
        size=\"small\"
      />
    );
  };

  // Render audit log
  const renderAuditLog = () => {
    if (auditLog.length === 0) {
      return <Text type=\"secondary\">No audit log entries found</Text>;
    }

    return (
      <Timeline>
        {auditLog.map((entry, index) => (
          <Timeline.Item
            key={index}
            color={entry.action === 'create' ? 'green' : entry.action === 'delete' ? 'red' : 'blue'}
          >
            <Space direction=\"vertical\" size={4}>
              <Text strong>{entry.action} - {entry.description}</Text>
              <Text type=\"secondary\">
                By {entry.user} on {new Date(entry.timestamp).toLocaleString()}
              </Text>
              {entry.changes && (
                <Text type=\"secondary\">Changes: {JSON.stringify(entry.changes)}</Text>
              )}
            </Space>
          </Timeline.Item>
        ))}
      </Timeline>
    );
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size=\"large\" />
        <div style={{ marginTop: '16px' }}>
          <Text>Loading resource details...</Text>
        </div>
      </div>
    );
  }

  if (!resource) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message=\"Resource Not Found\"
          description=\"The requested resource could not be found or you don't have permission to view it.\"
          type=\"warning\"
          showIcon
          action={
            <Button size=\"small\" onClick={onBack}>
              Go Back
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: '16px' }}>
        <Row justify=\"space-between\" align=\"middle\">
          <Col>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={onBack}>
                Back
              </Button>
              <Divider type=\"vertical\" />
              <Space direction=\"vertical\" size={4}>
                <Title level={3} style={{ margin: 0, color: getResourceTypeColor(resourceType) }}>
                  {getResourceDisplayName(resource)}
                </Title>
                <Space>
                  <Text type=\"secondary\">{getAwsResourceId(resource)}</Text>
                  <Divider type=\"vertical\" />
                  {(() => {
                    const status = getResourceStatus(resource);
                    return <Tag color={status.color}>{status.text}</Tag>;
                  })()}
                </Space>
              </Space>
            </Space>
          </Col>
          <Col>
            <Space>
              <Tooltip title=\"Refresh\">
                <Button icon={<ReloadOutlined />} onClick={() => window.location.reload()} />
              </Tooltip>
              <Tooltip title=\"Share\">
                <Button icon={<ShareAltOutlined />} onClick={() => {
                  navigator.clipboard.writeText(window.location.href);
                  message.success('Link copied to clipboard');
                }} />
              </Tooltip>
              <Button
                type=\"primary\"
                icon={<EditOutlined />}
                onClick={() => onEdit?.(resource)}
              >
                Edit
              </Button>
              <Button
                danger
                icon={<DeleteOutlined />}
                onClick={handleDelete}
              >
                Delete
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Main Content */}
      <Tabs defaultActiveKey=\"details\" size=\"large\">
        <TabPane tab=\"Details\" key=\"details\" icon={<ApiOutlined />}>
          <Card>
            {renderResourceDetails(resource)}
            
            {resource.tags && Object.keys(resource.tags).length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <Title level={5}>Tags</Title>
                <Space wrap>
                  {Object.entries(resource.tags).map(([key, value]) => (
                    <Tag key={key} color=\"default\">
                      {key}: {String(value)}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}
          </Card>
        </TabPane>

        <TabPane tab=\"Health\" key=\"health\" icon={<MonitorOutlined />}>
          <Card>
            {renderHealthStatus()}
          </Card>
        </TabPane>

        <TabPane tab=\"Relationships\" key=\"relationships\" icon={<ApiOutlined />}>
          <Card>
            {renderRelationships()}
          </Card>
        </TabPane>

        <TabPane tab=\"Audit Log\" key=\"audit\" icon={<HistoryOutlined />}>
          <Card>
            {renderAuditLog()}
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};