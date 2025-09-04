import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Button,
  Space,
  Tabs,
  Select,
  Typography,
  Tag,
  Alert,
  Spin,
  Empty,
  Tooltip,
  Badge
} from 'antd';
import {
  DatabaseOutlined,
  NodeIndexOutlined,
  MonitorOutlined,
  LinkOutlined,
  CloudOutlined,
  BranchesOutlined,
  GlobalOutlined,
  ApiOutlined,
  ArrowRightOutlined,
  ReloadOutlined,
  SettingOutlined,
  EyeOutlined
} from '@ant-design/icons';
import { NetworkTopologyView } from '../../components/network/NetworkTopologyView';
import { MonitoringDashboard } from '../../components/monitoring/MonitoringDashboard';
import { ResourceRelationshipManager } from '../../components/resources/ResourceRelationshipManager';
import { useNetworkManagement } from '../../hooks/useNetworkManagement';
import { 
  getResourceTypeColor,
  getResourceDisplayName,
  getResourceStatus,
  AWS_REGIONS,
  getRegionDisplayName
} from '../../utils/network-helpers';
import type { NetworkResource } from '../../types';

const { Title, Text } = Typography;
const { Option } = Select;
const { TabPane } = Tabs;

interface ResourceSummary {
  type: string;
  total: number;
  healthy: number;
  warning: number;
  critical: number;
  regions: string[];
}

export const NetworkResourcesPage: React.FC = () => {
  // State
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);
  const [selectedResourceTypes, setSelectedResourceTypes] = useState<string[]>(['vpc', 'transit-gateway', 'customer-gateway', 'vpc-endpoint']);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  // Hooks for each resource type
  const vpcHook = useNetworkManagement({ resourceType: 'vpc', autoLoad: true });
  const tgwHook = useNetworkManagement({ resourceType: 'transit-gateway', autoLoad: true });
  const cgwHook = useNetworkManagement({ resourceType: 'customer-gateway', autoLoad: true });
  const vpeHook = useNetworkManagement({ resourceType: 'vpc-endpoint', autoLoad: true });

  // Combine all resources
  const allResources: NetworkResource[] = [
    ...vpcHook.resources,
    ...tgwHook.resources,
    ...cgwHook.resources,
    ...vpeHook.resources
  ];

  // Filter resources by selected regions
  const filteredResources = allResources.filter((resource: any) => {
    if (selectedRegions.length === 0) return true;
    return selectedRegions.includes(resource.region);
  });

  // Get loading state
  const isLoading = vpcHook.loading || tgwHook.loading || cgwHook.loading || vpeHook.loading;

  // Calculate resource summaries
  const resourceSummaries: ResourceSummary[] = [
    {
      type: 'vpc',
      total: vpcHook.resources.length,
      healthy: Math.floor(vpcHook.resources.length * 0.85),
      warning: Math.floor(vpcHook.resources.length * 0.1),
      critical: Math.floor(vpcHook.resources.length * 0.05),
      regions: [...new Set(vpcHook.resources.map((r: any) => r.region))]
    },
    {
      type: 'transit-gateway',
      total: tgwHook.resources.length,
      healthy: Math.floor(tgwHook.resources.length * 0.9),
      warning: Math.floor(tgwHook.resources.length * 0.08),
      critical: Math.floor(tgwHook.resources.length * 0.02),
      regions: [...new Set(tgwHook.resources.map((r: any) => r.region))]
    },
    {
      type: 'customer-gateway',
      total: cgwHook.resources.length,
      healthy: Math.floor(cgwHook.resources.length * 0.88),
      warning: Math.floor(cgwHook.resources.length * 0.09),
      critical: Math.floor(cgwHook.resources.length * 0.03),
      regions: [...new Set(cgwHook.resources.map((r: any) => r.region))]
    },
    {
      type: 'vpc-endpoint',
      total: vpeHook.resources.length,
      healthy: Math.floor(vpeHook.resources.length * 0.92),
      warning: Math.floor(vpeHook.resources.length * 0.06),
      critical: Math.floor(vpeHook.resources.length * 0.02),
      regions: [...new Set(vpeHook.resources.map((r: any) => r.region))]
    }
  ];

  // Get all regions from resources
  const availableRegions = [...new Set(allResources.map((r: any) => r.region))].sort();

  // Handle refresh all
  const handleRefreshAll = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        vpcHook.refresh(),
        tgwHook.refresh(),
        cgwHook.refresh(),
        vpeHook.refresh()
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  // Navigation helpers
  const navigateToResource = (resourceType: string) => {
    // In a real app, this would use React Router
    window.location.href = `/resources/${resourceType}`;
  };

  // Resource type icons
  const getResourceIcon = (type: string) => {
    const icons = {
      'vpc': <CloudOutlined />,
      'transit-gateway': <BranchesOutlined />,
      'customer-gateway': <GlobalOutlined />,
      'vpc-endpoint': <ApiOutlined />
    };
    return icons[type as keyof typeof icons] || <DatabaseOutlined />;
  };

  // Resource type labels
  const getResourceLabel = (type: string) => {
    const labels = {
      'vpc': 'VPCs',
      'transit-gateway': 'Transit Gateways',
      'customer-gateway': 'Customer Gateways',
      'vpc-endpoint': 'VPC Endpoints'
    };
    return labels[type as keyof typeof labels] || type;
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: '16px' }}>
        <Row justify=\"space-between\" align=\"middle\">
          <Col>
            <Space>
              <DatabaseOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
              <Title level={3} style={{ margin: 0 }}>Network Resources</Title>
            </Space>
          </Col>
          <Col>
            <Space>
              <Select
                mode=\"multiple\"
                placeholder=\"Filter by regions\"
                value={selectedRegions}
                onChange={setSelectedRegions}
                style={{ minWidth: 200 }}
                maxTagCount={2}
              >
                {availableRegions.map(region => (
                  <Option key={region} value={region}>
                    <Space>
                      <Tag color=\"blue\" size=\"small\">{region}</Tag>
                      {getRegionDisplayName(region)}
                    </Space>
                  </Option>
                ))}
              </Select>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefreshAll}
                loading={refreshing || isLoading}
              >
                Refresh All
              </Button>
            </Space>
          </Col>
        </Row>
        
        {selectedRegions.length > 0 && (
          <Alert
            message={`Showing resources from ${selectedRegions.length} region(s): ${selectedRegions.join(', ')}`}
            type=\"info\"
            style={{ marginTop: '16px' }}
            closable
            onClose={() => setSelectedRegions([])}
          />
        )}
      </Card>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {/* Overview Tab */}
        <TabPane
          tab={
            <span>
              <DatabaseOutlined />
              Overview
            </span>
          }
          key=\"overview\"
        >
          {/* Resource Summary Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            {resourceSummaries.map((summary) => (
              <Col key={summary.type} xs={24} sm={12} lg={6}>
                <Card
                  hoverable
                  style={{
                    cursor: 'pointer',
                    border: `1px solid ${getResourceTypeColor(summary.type)}20`,
                    borderLeft: `4px solid ${getResourceTypeColor(summary.type)}`
                  }}
                  onClick={() => navigateToResource(summary.type)}
                >
                  <Row justify=\"space-between\" align=\"middle\">
                    <Col>
                      <Space direction=\"vertical\" size={0}>
                        <Text type=\"secondary\">{getResourceLabel(summary.type)}</Text>
                        <Title level={2} style={{ 
                          margin: 0, 
                          color: getResourceTypeColor(summary.type) 
                        }}>
                          {summary.total}
                        </Title>
                      </Space>
                    </Col>
                    <Col>
                      <div style={{ 
                        fontSize: '32px', 
                        color: getResourceTypeColor(summary.type),
                        opacity: 0.8 
                      }}>
                        {getResourceIcon(summary.type)}
                      </div>
                    </Col>
                  </Row>
                  
                  <div style={{ marginTop: '12px' }}>
                    <Space size={8}>
                      <Badge color=\"#52c41a\" />
                      <Text style={{ fontSize: '12px' }}>{summary.healthy} healthy</Text>
                      <Badge color=\"#faad14\" />
                      <Text style={{ fontSize: '12px' }}>{summary.warning} warning</Text>
                      <Badge color=\"#ff4d4f\" />
                      <Text style={{ fontSize: '12px' }}>{summary.critical} critical</Text>
                    </Space>
                  </div>
                  
                  <div style={{ marginTop: '8px' }}>
                    <Text type=\"secondary\" style={{ fontSize: '12px' }}>
                      {summary.regions.length} regions
                    </Text>
                    <ArrowRightOutlined style={{ float: 'right', color: '#999' }} />
                  </div>
                </Card>
              </Col>
            ))}
          </Row>

          {/* Quick Actions */}
          <Card title=\"Quick Actions\" style={{ marginBottom: '16px' }}>
            <Space wrap>
              <Button
                type=\"primary\"
                icon={<PlusOutlined />}
                onClick={() => navigateToResource('vpc')}
              >
                Create VPC
              </Button>
              <Button
                icon={<PlusOutlined />}
                onClick={() => navigateToResource('transit-gateway')}
              >
                Create Transit Gateway
              </Button>
              <Button
                icon={<PlusOutlined />}
                onClick={() => navigateToResource('customer-gateway')}
              >
                Create Customer Gateway
              </Button>
              <Button
                icon={<PlusOutlined />}
                onClick={() => navigateToResource('vpc-endpoint')}
              >
                Create VPC Endpoint
              </Button>
              <Button
                icon={<EyeOutlined />}
                onClick={() => setActiveTab('topology')}
              >
                View Topology
              </Button>
              <Button
                icon={<MonitorOutlined />}
                onClick={() => setActiveTab('monitoring')}
              >
                View Monitoring
              </Button>
            </Space>
          </Card>

          {/* Recent Resources */}
          <Card title=\"Recent Resources\" size=\"small\">
            {filteredResources.length === 0 ? (
              <Empty description=\"No resources found\" />
            ) : (
              <div style={{ maxHeight: '400px', overflow: 'auto' }}>
                {filteredResources.slice(0, 10).map((resource: any) => {
                  const resourceType = resource.awsVpcId ? 'vpc' : 
                                     resource.awsTgwId ? 'transit-gateway' :
                                     resource.awsCgwId ? 'customer-gateway' : 'vpc-endpoint';
                  const status = getResourceStatus(resource);
                  
                  return (
                    <Card.Grid
                      key={resource.id}
                      style={{ width: '50%', cursor: 'pointer' }}
                      onClick={() => navigateToResource(resourceType)}
                    >
                      <Space direction=\"vertical\" size={4} style={{ width: '100%' }}>
                        <Space justify=\"space-between\" style={{ width: '100%' }}>
                          <Text strong>{getResourceDisplayName(resource)}</Text>
                          <Tag color={getResourceTypeColor(resourceType)} size=\"small\">
                            {resourceType.toUpperCase()}
                          </Tag>
                        </Space>
                        <Space justify=\"space-between\" style={{ width: '100%' }}>
                          <Text type=\"secondary\" style={{ fontSize: '12px' }}>
                            {resource.region}
                          </Text>
                          <Tag color={status.color} size=\"small\">
                            {status.text}
                          </Tag>
                        </Space>
                        {resource.environment && (
                          <Tag size=\"small\">{resource.environment}</Tag>
                        )}
                      </Space>
                    </Card.Grid>
                  );
                })}
              </div>
            )}
          </Card>
        </TabPane>

        {/* Network Topology Tab */}
        <TabPane
          tab={
            <span>
              <NodeIndexOutlined />
              Network Topology
            </span>
          }
          key=\"topology\"
        >
          <NetworkTopologyView
            selectedRegions={selectedRegions}
            selectedResourceTypes={selectedResourceTypes}
            height={800}
          />
        </TabPane>

        {/* Monitoring Tab */}
        <TabPane
          tab={
            <span>
              <MonitorOutlined />
              Monitoring Dashboard
            </span>
          }
          key=\"monitoring\"
        >
          <MonitoringDashboard
            resourceTypes={selectedResourceTypes as any}
            selectedRegions={selectedRegions}
            refreshInterval={30}
          />
        </TabPane>

        {/* Relationships Tab */}
        <TabPane
          tab={
            <span>
              <LinkOutlined />
              Resource Relationships
            </span>
          }
          key=\"relationships\"
        >
          <ResourceRelationshipManager />
        </TabPane>
      </Tabs>
    </div>
  );
};