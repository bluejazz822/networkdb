/**
 * Metric Widget Component
 * Displays key performance indicators and metrics with trends
 */

import React from 'react';
import { Statistic, Card, Progress, Typography, Space } from 'antd';
import { 
  ArrowUpOutlined, 
  ArrowDownOutlined, 
  MinusOutlined,
  WarningOutlined,
  ExclamationCircleOutlined 
} from '@ant-design/icons';
import { MetricConfiguration } from '../../../types/reports';

const { Text } = Typography;

interface MetricWidgetProps {
  configuration: MetricConfiguration;
  data: any;
}

export const MetricWidget: React.FC<MetricWidgetProps> = ({
  configuration,
  data
}) => {
  const formatValue = (value: string | number): string => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    
    if (isNaN(numValue)) {
      return String(value);
    }

    switch (configuration.format) {
      case 'percentage':
        return `${numValue.toFixed(1)}%`;
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(numValue);
      case 'bytes':
        return formatBytes(numValue);
      case 'number':
      default:
        return new Intl.NumberFormat().format(numValue);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getTrendIcon = () => {
    if (!configuration.trend) return null;

    switch (configuration.trend.direction) {
      case 'up':
        return <ArrowUpOutlined style={{ color: '#52c41a' }} />;
      case 'down':
        return <ArrowDownOutlined style={{ color: '#f5222d' }} />;
      case 'stable':
      default:
        return <MinusOutlined style={{ color: '#8c8c8c' }} />;
    }
  };

  const getTrendColor = () => {
    if (!configuration.trend) return undefined;

    // Determine if trend direction is good based on threshold configuration
    const isGoodTrend = configuration.threshold?.goodDirection === configuration.trend.direction;
    
    switch (configuration.trend.direction) {
      case 'up':
        return isGoodTrend ? '#52c41a' : '#f5222d';
      case 'down':
        return isGoodTrend ? '#52c41a' : '#f5222d';
      case 'stable':
      default:
        return '#8c8c8c';
    }
  };

  const getThresholdStatus = (): 'success' | 'warning' | 'error' | 'normal' => {
    if (!configuration.threshold) return 'normal';

    const numValue = typeof configuration.value === 'string' 
      ? parseFloat(configuration.value) 
      : configuration.value;

    if (isNaN(numValue)) return 'normal';

    const { warning, critical, goodDirection } = configuration.threshold;

    if (goodDirection === 'up') {
      if (numValue >= critical) return 'success';
      if (numValue >= warning) return 'warning';
      return 'error';
    } else {
      if (numValue <= critical) return 'success';
      if (numValue <= warning) return 'warning';
      return 'error';
    }
  };

  const getThresholdIcon = () => {
    const status = getThresholdStatus();
    switch (status) {
      case 'warning':
        return <WarningOutlined style={{ color: '#faad14' }} />;
      case 'error':
        return <ExclamationCircleOutlined style={{ color: '#f5222d' }} />;
      default:
        return null;
    }
  };

  const renderProgressBar = () => {
    if (!configuration.threshold) return null;

    const numValue = typeof configuration.value === 'string' 
      ? parseFloat(configuration.value) 
      : configuration.value;

    if (isNaN(numValue)) return null;

    const { warning, critical, goodDirection } = configuration.threshold;
    const max = Math.max(numValue, critical, warning) * 1.2;
    const percent = (numValue / max) * 100;

    let status: 'success' | 'exception' | 'normal' | undefined = 'normal';
    const thresholdStatus = getThresholdStatus();
    
    if (thresholdStatus === 'success') status = 'success';
    else if (thresholdStatus === 'error') status = 'exception';

    return (
      <div style={{ marginTop: 8 }}>
        <Progress
          percent={percent}
          size="small"
          status={status}
          showInfo={false}
        />
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          fontSize: '12px',
          color: '#8c8c8c',
          marginTop: 4
        }}>
          <span>0</span>
          <span>Warning: {formatValue(warning)}</span>
          <span>Critical: {formatValue(critical)}</span>
        </div>
      </div>
    );
  };

  // Use data if provided, otherwise use configuration value
  const displayValue = data?.value ?? configuration.value;
  const displayLabel = data?.label ?? configuration.label;

  return (
    <div style={{ textAlign: 'center' }}>
      <Statistic
        title={
          <Space>
            {displayLabel}
            {getThresholdIcon()}
          </Space>
        }
        value={displayValue}
        formatter={(value) => formatValue(value)}
        suffix={configuration.unit}
        valueStyle={{ fontSize: '2em', fontWeight: 'bold' }}
      />

      {configuration.trend && (
        <div style={{ marginTop: 16 }}>
          <Space>
            {getTrendIcon()}
            <Text style={{ color: getTrendColor() }}>
              {Math.abs(configuration.trend.value)}% vs {configuration.trend.period}
            </Text>
          </Space>
        </div>
      )}

      {renderProgressBar()}

      {data?.description && (
        <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginTop: 12 }}>
          {data.description}
        </Text>
      )}
    </div>
  );
};