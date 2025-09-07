/**
 * Dashboard Widget Component
 * Configurable widget system for displaying metrics, charts, and status
 */

import React, { useState, useEffect } from 'react';
import { Card, Spin, Alert, Typography, Button, Tooltip } from 'antd';
import { ReloadOutlined, FullscreenOutlined, SettingOutlined } from '@ant-design/icons';
import { DashboardWidget as WidgetConfig, WidgetConfiguration } from '../../types/reports';
import { MetricWidget } from './widgets/MetricWidget';
import { ChartWidget } from './widgets/ChartWidget';
import { TableWidget } from './widgets/TableWidget';
import { StatusWidget } from './widgets/StatusWidget';
import { ReportsApiService } from '../../services/reportsApi';

const { Title } = Typography;

interface DashboardWidgetProps {
  widget: WidgetConfig;
  onRefresh?: (widgetId: string) => void;
  onFullscreen?: (widgetId: string) => void;
  onSettings?: (widgetId: string) => void;
  allowInteraction?: boolean;
  className?: string;
}

export const DashboardWidget: React.FC<DashboardWidgetProps> = ({
  widget,
  onRefresh,
  onFullscreen,
  onSettings,
  allowInteraction = true,
  className
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Auto-refresh interval
  useEffect(() => {
    if (widget.refreshInterval && widget.refreshInterval > 0) {
      const interval = setInterval(() => {
        handleRefresh();
      }, widget.refreshInterval * 1000);

      return () => clearInterval(interval);
    }
  }, [widget.refreshInterval]);

  // Load widget data on mount
  useEffect(() => {
    loadWidgetData();
  }, [widget.id, widget.configuration]);

  const loadWidgetData = async () => {
    setLoading(true);
    setError(null);

    try {
      let result;

      // Load data based on widget type and configuration
      switch (widget.type) {
        case 'metric':
          result = await loadMetricData();
          break;
        case 'chart':
          result = await loadChartData();
          break;
        case 'table':
          result = await loadTableData();
          break;
        case 'status':
          result = await loadStatusData();
          break;
        default:
          throw new Error(`Unsupported widget type: ${widget.type}`);
      }

      if (result.success) {
        setData(result.data);
        setLastUpdated(new Date());
      } else {
        setError(result.errors?.[0]?.message || 'Failed to load widget data');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while loading data');
    } finally {
      setLoading(false);
    }
  };

  const loadMetricData = async () => {
    // Load metric data from API
    return await ReportsApiService.getWidgetData('metrics');
  };

  const loadChartData = async () => {
    const config = widget.configuration;
    if (config.chart && config.query) {
      // Generate aggregated data for chart
      const query = config.query;
      const resourceType = query.resourceTypes[0];
      const aggregation = config.chart.aggregation;
      const groupBy = config.chart.groupBy || 'status';

      return await ReportsApiService.getAggregatedData(
        resourceType,
        aggregation,
        groupBy,
        query.filters
      );
    }
    return { success: false, errors: [{ message: 'Chart configuration incomplete' }] };
  };

  const loadTableData = async () => {
    const config = widget.configuration;
    if (config.query) {
      return await ReportsApiService.generateReport(config.query);
    }
    return { success: false, errors: [{ message: 'Table query not configured' }] };
  };

  const loadStatusData = async () => {
    return await ReportsApiService.getWidgetData('status');
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh(widget.id);
    }
    loadWidgetData();
  };

  const handleFullscreen = () => {
    if (onFullscreen) {
      onFullscreen(widget.id);
    }
  };

  const handleSettings = () => {
    if (onSettings) {
      onSettings(widget.id);
    }
  };

  const renderWidgetContent = () => {
    if (loading) {
      return (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: 200 
        }}>
          <Spin size="large" />
        </div>
      );
    }

    if (error) {
      return (
        <Alert
          message="Error"
          description={error}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={handleRefresh}>
              Retry
            </Button>
          }
        />
      );
    }

    switch (widget.type) {
      case 'metric':
        return (
          <MetricWidget 
            configuration={widget.configuration.metric!}
            data={data}
          />
        );
      case 'chart':
        return (
          <ChartWidget 
            configuration={widget.configuration.chart!}
            data={data}
          />
        );
      case 'table':
        return (
          <TableWidget 
            configuration={widget.configuration.table!}
            data={data}
          />
        );
      case 'status':
        return (
          <StatusWidget 
            configuration={widget.configuration.status!}
            data={data}
          />
        );
      default:
        return <div>Unsupported widget type</div>;
    }
  };

  const cardTitle = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Title level={5} style={{ margin: 0 }}>
        {widget.title}
      </Title>
      {allowInteraction && (
        <div style={{ display: 'flex', gap: 8 }}>
          <Tooltip title="Refresh">
            <Button
              type="text"
              icon={<ReloadOutlined />}
              size="small"
              onClick={handleRefresh}
              loading={loading}
            />
          </Tooltip>
          <Tooltip title="Fullscreen">
            <Button
              type="text"
              icon={<FullscreenOutlined />}
              size="small"
              onClick={handleFullscreen}
            />
          </Tooltip>
          <Tooltip title="Settings">
            <Button
              type="text"
              icon={<SettingOutlined />}
              size="small"
              onClick={handleSettings}
            />
          </Tooltip>
        </div>
      )}
    </div>
  );

  const cardExtra = lastUpdated && (
    <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
      Updated: {lastUpdated.toLocaleTimeString()}
    </Typography.Text>
  );

  return (
    <Card
      title={cardTitle}
      extra={cardExtra}
      className={className}
      style={{
        width: widget.position.width,
        height: widget.position.height,
        ...((widget.position.x !== undefined && widget.position.y !== undefined) && {
          position: 'absolute',
          left: widget.position.x,
          top: widget.position.y
        })
      }}
      bodyStyle={{ 
        height: 'calc(100% - 64px)', 
        padding: '16px',
        overflow: 'auto'
      }}
    >
      {renderWidgetContent()}
    </Card>
  );
};