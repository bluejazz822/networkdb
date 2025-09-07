/**
 * Status Widget Component
 * Displays system status and health indicators
 */

import React from 'react';
import { Card, Progress, Tag, Space, Typography, Row, Col, Statistic } from 'antd';
import { 
  CheckCircleOutlined, 
  WarningOutlined, 
  ExclamationCircleOutlined,
  ClockCircleOutlined 
} from '@ant-design/icons';
import { StatusConfiguration } from '../../../types/reports';
import dayjs from 'dayjs';

const { Text, Title } = Typography;

interface StatusWidgetProps {
  configuration: StatusConfiguration;
  data: any;
}

export const StatusWidget: React.FC<StatusWidgetProps> = ({
  configuration,
  data
}) => {
  const getStatusIcon = (status: string) => {
    const statusLower = status.toLowerCase();
    
    switch (statusLower) {
      case 'healthy':
      case 'active':
      case 'available':
      case 'success':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'warning':
      case 'pending':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case 'critical':
      case 'error':
      case 'failed':
        return <ExclamationCircleOutlined style={{ color: '#f5222d' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#8c8c8c' }} />;
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    
    switch (statusLower) {
      case 'healthy':
      case 'active':
      case 'available':
      case 'success':
        return 'success';
      case 'warning':
      case 'pending':
        return 'warning';
      case 'critical':
      case 'error':
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const renderHealthSummary = () => {
    if (!data?.healthStatus) {
      return <Text type="secondary">No health data available</Text>;
    }

    const { healthy, warning, critical, total, healthPercentage } = data.healthStatus;

    return (
      <div>
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={8}>
            <Statistic
              title="Healthy"
              value={healthy}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a', fontSize: '18px' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Warning"
              value={warning}
              prefix={<WarningOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14', fontSize: '18px' }}
            />
          </Col>
          <Col span={8}>
            <Statistic
              title="Critical"
              value={critical}
              prefix={<ExclamationCircleOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#f5222d', fontSize: '18px' }}
            />
          </Col>
        </Row>

        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>
            Overall Health: {healthPercentage}%
          </Title>
          <Progress 
            percent={healthPercentage} 
            status={healthPercentage >= 90 ? 'success' : healthPercentage >= 70 ? 'normal' : 'exception'}
            strokeWidth={8}
          />
        </div>

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Total Resources: {total}
            {data.healthStatus.lastChecked && (
              <span> • Last Checked: {dayjs(data.healthStatus.lastChecked).format('HH:mm:ss')}</span>
            )}
          </Text>
        </div>
      </div>
    );
  };

  const renderResourceCounts = () => {
    if (!data?.resourceCounts) {
      return <Text type="secondary">No resource data available</Text>;
    }

    const resources = Object.entries(data.resourceCounts)
      .filter(([key]) => key !== 'total')
      .map(([key, value]) => ({ name: key, count: value as number }));

    return (
      <div>
        <Title level={5} style={{ textAlign: 'center', marginBottom: 16 }}>
          Resource Distribution
        </Title>
        
        <Space direction="vertical" style={{ width: '100%' }}>
          {resources.map(resource => (
            <Card 
              key={resource.name} 
              size="small" 
              style={{ textAlign: 'center' }}
              bodyStyle={{ padding: '8px 12px' }}
            >
              <Statistic
                title={resource.name.charAt(0).toUpperCase() + resource.name.slice(1)}
                value={resource.count}
                valueStyle={{ fontSize: '16px' }}
              />
            </Card>
          ))}
        </Space>

        <div style={{ textAlign: 'center', marginTop: 16 }}>
          <Text strong>Total: {data.resourceCounts.total}</Text>
        </div>
      </div>
    );
  };

  const renderCustomStatus = () => {
    if (!data || !configuration.statusMap) {
      return <Text type="secondary">No status data available</Text>;
    }

    // Extract status from data based on configuration
    const statusField = configuration.statusField;
    const statusValue = data[statusField];
    
    if (!statusValue) {
      return <Text type="secondary">Status information not available</Text>;
    }

    const statusConfig = configuration.statusMap[statusValue];
    
    if (!statusConfig) {
      return (
        <Tag color="default">
          {statusValue}
        </Tag>
      );
    }

    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 16 }}>
          <Tag 
            color={statusConfig.color} 
            style={{ fontSize: '16px', padding: '8px 16px' }}
            icon={getStatusIcon(statusValue)}
          >
            {statusConfig.label}
          </Tag>
        </div>
        
        <Text type="secondary">
          Current Status: {statusConfig.label}
        </Text>
      </div>
    );
  };

  const renderActivityList = () => {
    if (!data?.recentActivity) {
      return <Text type="secondary">No recent activity</Text>;
    }

    const activities = data.recentActivity.slice(0, 5); // Show last 5 activities

    return (
      <div>
        <Title level={5} style={{ marginBottom: 16 }}>Recent Activity</Title>
        
        <Space direction="vertical" style={{ width: '100%' }}>
          {activities.map((activity: any, index: number) => (
            <Card 
              key={activity.id || index}
              size="small"
              bodyStyle={{ padding: '8px 12px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>{activity.type}</Text>
                  <br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {activity.name || activity.id}
                  </Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Tag color={getStatusColor(activity.action)}>
                    {activity.action}
                  </Tag>
                  <br />
                  <Text type="secondary" style={{ fontSize: '10px' }}>
                    {dayjs(activity.timestamp).format('MM/DD HH:mm')}
                  </Text>
                </div>
              </div>
            </Card>
          ))}
        </Space>
      </div>
    );
  };

  const renderContent = () => {
    // Determine what to render based on available data
    if (data?.healthStatus) {
      return renderHealthSummary();
    } else if (data?.resourceCounts) {
      return renderResourceCounts();
    } else if (data?.recentActivity) {
      return renderActivityList();
    } else if (configuration.statusMap) {
      return renderCustomStatus();
    } else {
      return (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <Text type="secondary">No status data available</Text>
        </div>
      );
    }
  };

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
      {renderContent()}
    </div>
  );
};