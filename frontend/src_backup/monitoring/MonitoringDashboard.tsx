import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Progress,
  Alert,
  Badge,
  Table,
  Tag,
  Space,
  Button,
  Select,
  DatePicker,
  Typography,
  Tooltip,
  Switch,
  Divider,
  List,
  Avatar,
  Empty,
  Spin
} from 'antd';
import {
  MonitorOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  SettingOutlined,
  AlertOutlined,
  TrendingUpOutlined,
  TrendingDownOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Line, Area, Gauge } from '@ant-design/plots';
import { useNetworkManagement, NetworkResourceType } from '../../hooks/useNetworkManagement';
import {
  getResourceDisplayName,
  getResourceStatus,
  getHealthStatusColor,
  getResourceTypeColor
} from '../../utils/network-helpers';
import type { ResourceHealth, Alert as AlertType, NetworkResource } from '../../types';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

interface MonitoringDashboardProps {
  resourceTypes?: NetworkResourceType[];
  selectedRegions?: string[];
  refreshInterval?: number; // in seconds
}

interface HealthSummary {
  healthy: number;
  warning: number;
  critical: number;
  unknown: number;
  total: number;
}

interface MetricData {
  timestamp: string;
  value: number;
  metric: string;
}

interface SLAMetric {
  name: string;
  current: number;
  target: number;
  status: 'healthy' | 'warning' | 'critical';
}

export const MonitoringDashboard: React.FC<MonitoringDashboardProps> = ({
  resourceTypes = ['vpc', 'transit-gateway', 'customer-gateway', 'vpc-endpoint'],
  selectedRegions = [],
  refreshInterval = 30
}) => {
  // State
  const [healthData, setHealthData] = useState<Record<string, ResourceHealth>>({});
  const [alerts, setAlerts] = useState<AlertType[]>([]);
  const [healthSummary, setHealthSummary] = useState<HealthSummary>({
    healthy: 0,
    warning: 0,
    critical: 0,
    unknown: 0,
    total: 0
  });
  const [metricsData, setMetricsData] = useState<MetricData[]>([]);
  const [slaMetrics, setSlaMetrics] = useState<SLAMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('24h');

  // Hooks for each resource type
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
  ].filter((resource: NetworkResource) => {
    if (selectedRegions.length > 0) {
      return selectedRegions.includes((resource as any).region);
    }
    return true;
  });

  // Load health data
  const loadHealthData = useCallback(async () => {
    if (allResources.length === 0) return;

    try {
      // Mock health data - in real implementation, this would call the monitoring API
      const mockHealthData: Record<string, ResourceHealth> = {};
      const mockAlerts: AlertType[] = [];
      
      allResources.forEach((resource, index) => {
        // Generate mock health status
        const statuses = ['healthy', 'warning', 'critical', 'unknown'];
        const status = statuses[Math.floor(Math.random() * statuses.length)] as any;
        
        mockHealthData[resource.id] = {
          resourceId: resource.id,
          resourceType: resource.id.startsWith('vpc-') ? 'vpc' : 
                       resource.id.startsWith('tgw-') ? 'transit-gateway' :
                       resource.id.startsWith('cgw-') ? 'customer-gateway' : 'vpc-endpoint',
          status,
          lastChecked: new Date().toISOString(),
          metrics: {
            'cpu_utilization': Math.random() * 100,
            'memory_utilization': Math.random() * 100,
            'network_throughput': Math.random() * 1000,
            'connection_count': Math.floor(Math.random() * 500)
          }
        };

        // Generate mock alerts for critical/warning resources
        if (status === 'critical' || status === 'warning') {
          mockAlerts.push({
            id: `alert-${resource.id}-${index}`,
            resourceId: resource.id,
            resourceType: mockHealthData[resource.id].resourceType,
            severity: status === 'critical' ? 'critical' : status === 'warning' ? 'medium' : 'low',
            title: `${status === 'critical' ? 'Critical' : 'Warning'} Alert`,
            description: `Resource ${getResourceDisplayName(resource)} requires attention`,
            status: 'active',
            createdAt: new Date(Date.now() - Math.random() * 86400000).toISOString()
          });
        }
      });

      setHealthData(mockHealthData);
      setAlerts(mockAlerts);

      // Calculate health summary
      const summary = Object.values(mockHealthData).reduce(
        (acc, health) => {
          acc[health.status]++;
          acc.total++;
          return acc;
        },
        { healthy: 0, warning: 0, critical: 0, unknown: 0, total: 0 }
      );
      setHealthSummary(summary);

      // Generate mock metrics data
      const now = new Date();
      const mockMetrics: MetricData[] = [];
      const hours = selectedTimeRange === '1h' ? 1 : selectedTimeRange === '6h' ? 6 : selectedTimeRange === '24h' ? 24 : 168;
      
      for (let i = hours; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 60 * 60 * 1000).toISOString();
        mockMetrics.push({
          timestamp,
          value: 70 + Math.random() * 30,
          metric: 'availability'
        });
      }
      setMetricsData(mockMetrics);

      // Mock SLA metrics
      setSlaMetrics([
        { name: 'Uptime', current: 99.9, target: 99.5, status: 'healthy' },
        { name: 'Response Time', current: 95.2, target: 95.0, status: 'healthy' },
        { name: 'Error Rate', current: 0.1, target: 1.0, status: 'healthy' },
        { name: 'Connectivity', current: 98.5, target: 99.0, status: 'warning' }
      ]);

    } catch (error) {
      console.error('Failed to load health data:', error);
    } finally {
      setLoading(false);
    }
  }, [allResources, selectedTimeRange]);

  // Auto-refresh effect
  useEffect(() => {
    loadHealthData();
    
    if (autoRefresh) {
      const interval = setInterval(loadHealthData, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [loadHealthData, autoRefresh, refreshInterval]);

  // Alert columns
  const alertColumns: ColumnsType<AlertType> = [
    {
      title: 'Severity',
      dataIndex: 'severity',
      key: 'severity',
      width: 100,
      render: (severity) => {
        const colors = {
          'critical': 'red',
          'high': 'orange',
          'medium': 'yellow',
          'low': 'blue'
        };
        return <Tag color={colors[severity as keyof typeof colors]}>{severity.toUpperCase()}</Tag>;
      }
    },
    {
      title: 'Resource',
      dataIndex: 'resourceId',
      key: 'resourceId',
      width: 200,
      render: (resourceId) => {
        const resource = allResources.find(r => r.id === resourceId);
        return resource ? getResourceDisplayName(resource) : resourceId;
      }
    },
    {
      title: 'Alert',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <Space direction=\"vertical\" size={0}>
          <Text strong>{title}</Text>
          <Text type=\"secondary\" style={{ fontSize: '12px' }}>{record.description}</Text>
        </Space>
      )
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date) => new Date(date).toLocaleString()
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={status === 'active' ? 'red' : 'green'}>
          {status.toUpperCase()}
        </Tag>
      )
    }
  ];

  // Availability chart config
  const availabilityChartConfig = {
    data: metricsData,
    xField: 'timestamp',
    yField: 'value',
    smooth: true,
    color: '#1890ff',
    point: {
      size: 2,
      shape: 'circle'
    },
    yAxis: {
      min: 0,
      max: 100,
      tickCount: 5
    },
    tooltip: {
      formatter: (datum: any) => {
        return {
          name: 'Availability',
          value: `${datum.value.toFixed(1)}%`
        };
      }
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: '16px' }}>
        <Row justify=\"space-between\" align=\"middle\">
          <Col>
            <Space>
              <MonitorOutlined style={{ fontSize: '24px', color: '#1890ff' }} />
              <Title level={3} style={{ margin: 0 }}>Network Monitoring Dashboard</Title>
            </Space>
          </Col>
          <Col>
            <Space>
              <Select
                value={selectedTimeRange}
                onChange={setSelectedTimeRange}
                style={{ width: 100 }}
              >
                <Option value=\"1h\">1 Hour</Option>
                <Option value=\"6h\">6 Hours</Option>
                <Option value=\"24h\">24 Hours</Option>
                <Option value=\"7d\">7 Days</Option>
              </Select>
              <Switch
                checked={autoRefresh}
                onChange={setAutoRefresh}
                checkedChildren=\"Auto\"
                unCheckedChildren=\"Manual\"
              />
              <Button
                icon={<ReloadOutlined />}
                onClick={loadHealthData}
                loading={loading}
              >
                Refresh
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Health Summary */}
      <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title=\"Total Resources\"
              value={healthSummary.total}
              prefix={<MonitorOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title=\"Healthy\"
              value={healthSummary.healthy}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title=\"Warning\"
              value={healthSummary.warning}
              valueStyle={{ color: '#cf1322' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title=\"Critical\"
              value={healthSummary.critical}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* SLA Metrics */}
      <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
        <Col span={24}>
          <Card title=\"SLA Metrics\" size=\"small\">
            <Row gutter={[16, 16]}>
              {slaMetrics.map((metric) => (
                <Col key={metric.name} xs={12} sm={6}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ marginBottom: '8px' }}>
                      <Text strong>{metric.name}</Text>
                    </div>
                    <Progress
                      type=\"circle\"
                      percent={metric.current}
                      width={80}
                      strokeColor={getHealthStatusColor(metric.status)}
                      format={(percent) => `${percent}%`}
                    />
                    <div style={{ marginTop: '4px' }}>
                      <Text type=\"secondary\">Target: {metric.target}%</Text>
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* Availability Chart */}
        <Col xs={24} lg={16}>
          <Card title=\"System Availability\" size=\"small\">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size=\"large\" />
              </div>
            ) : (
              <Line {...availabilityChartConfig} height={300} />
            )}
          </Card>
        </Col>

        {/* Health Status by Resource Type */}
        <Col xs={24} lg={8}>
          <Card title=\"Health by Resource Type\" size=\"small\">
            <div style={{ height: '300px', overflow: 'auto' }}>
              {resourceTypes.map((type) => {
                const resources = allResources.filter((r: any) => {
                  const resourceType = r.awsVpcId ? 'vpc' : 
                                     r.awsTgwId ? 'transit-gateway' :
                                     r.awsCgwId ? 'customer-gateway' : 'vpc-endpoint';
                  return resourceType === type;
                });
                
                const healthCounts = resources.reduce(
                  (acc, resource) => {
                    const health = healthData[resource.id];
                    if (health) {
                      acc[health.status]++;
                    }
                    return acc;
                  },
                  { healthy: 0, warning: 0, critical: 0, unknown: 0 }
                );

                return (
                  <div key={type} style={{ marginBottom: '16px' }}>
                    <Space justify=\"space-between\" style={{ width: '100%' }}>
                      <Text strong style={{ color: getResourceTypeColor(type) }}>
                        {type.toUpperCase().replace('-', ' ')}
                      </Text>
                      <Text type=\"secondary\">({resources.length})</Text>
                    </Space>
                    <div style={{ marginTop: '8px' }}>
                      <Progress
                        percent={resources.length > 0 ? Math.round((healthCounts.healthy / resources.length) * 100) : 0}
                        strokeColor=\"#52c41a\"
                        trailColor=\"#ff4d4f\"
                        showInfo={false}
                        size=\"small\"
                      />
                      <div style={{ marginTop: '4px' }}>
                        <Space size={4}>
                          <Badge color=\"#52c41a\" />
                          <Text style={{ fontSize: '12px' }}>{healthCounts.healthy} healthy</Text>
                          <Badge color=\"#faad14\" />
                          <Text style={{ fontSize: '12px' }}>{healthCounts.warning} warning</Text>
                          <Badge color=\"#ff4d4f\" />
                          <Text style={{ fontSize: '12px' }}>{healthCounts.critical} critical</Text>
                        </Space>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </Col>
      </Row>

      {/* Active Alerts */}
      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col span={24}>
          <Card
            title={
              <Space>
                <AlertOutlined />
                <Text>Active Alerts</Text>
                <Badge count={alerts.length} />
              </Space>
            }
            size=\"small\"
          >
            {alerts.length === 0 ? (
              <Empty 
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description=\"No active alerts\"
              />
            ) : (
              <Table
                dataSource={alerts}
                columns={alertColumns}
                rowKey=\"id\"
                pagination={false}
                size=\"small\"
                scroll={{ y: 300 }}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Resource Health Details */}
      <Row gutter={[16, 16]} style={{ marginTop: '16px' }}>
        <Col span={24}>
          <Card title=\"Resource Health Details\" size=\"small\">
            <List
              dataSource={allResources.slice(0, 10)} // Show first 10 resources
              renderItem={(resource: NetworkResource) => {
                const health = healthData[resource.id];
                const status = getResourceStatus(resource);
                
                return (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        <Avatar 
                          style={{ 
                            backgroundColor: health ? getHealthStatusColor(health.status) : '#d9d9d9'
                          }}
                        >
                          {getResourceDisplayName(resource).charAt(0).toUpperCase()}
                        </Avatar>
                      }
                      title={
                        <Space>
                          <Text strong>{getResourceDisplayName(resource)}</Text>
                          <Tag color={status.color}>{status.text}</Tag>
                          {health && (
                            <Tag color={getHealthStatusColor(health.status)}>
                              {health.status.toUpperCase()}
                            </Tag>
                          )}
                        </Space>
                      }
                      description={
                        <Space direction=\"vertical\" size={4}>
                          <Text type=\"secondary\">
                            Region: {(resource as any).region} | 
                            Type: {resource.id.startsWith('vpc-') ? 'VPC' : 
                                  resource.id.startsWith('tgw-') ? 'Transit Gateway' :
                                  resource.id.startsWith('cgw-') ? 'Customer Gateway' : 'VPC Endpoint'}
                          </Text>
                          {health && health.metrics && (
                            <Space size={16}>
                              {Object.entries(health.metrics).slice(0, 2).map(([key, value]) => (
                                <Text key={key} type=\"secondary\" style={{ fontSize: '12px' }}>
                                  {key}: {typeof value === 'number' ? value.toFixed(1) : value}
                                  {key.includes('utilization') ? '%' : ''}
                                </Text>
                              ))}
                            </Space>
                          )}
                        </Space>
                      }
                    />
                    {health?.lastChecked && (
                      <Text type=\"secondary\" style={{ fontSize: '12px' }}>
                        Last checked: {new Date(health.lastChecked).toLocaleTimeString()}
                      </Text>
                    )}
                  </List.Item>
                );
              }}
              pagination={{
                pageSize: 10,
                showSizeChanger: false,
                showTotal: (total) => `${total} resources`
              }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};