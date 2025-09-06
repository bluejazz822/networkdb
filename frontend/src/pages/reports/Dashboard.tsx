/**
 * Dashboard Page
 * Main dashboard with customizable widgets and real-time data
 */

import React, { useState, useEffect, useCallback } from 'react';
import { 
  Layout, 
  Row, 
  Col, 
  Button, 
  message, 
  Spin, 
  Alert,
  Space,
  Typography,
  Dropdown,
  Modal
} from 'antd';
import { 
  ReloadOutlined, 
  PlusOutlined, 
  SettingOutlined,
  FullscreenOutlined
} from '@ant-design/icons';
import { DashboardWidget } from '../../components/reports/DashboardWidget';
import { DashboardWidget as WidgetConfig, DashboardData } from '../../types/reports';
import { ReportsApiService } from '../../services/reportsApi';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const { Content } = Layout;
const { Title } = Typography;

export const Dashboard: React.FC = () => {
  const [refreshing, setRefreshing] = useState(false);
  const [fullscreenWidget, setFullscreenWidget] = useState<string | null>(null);
  const [widgets, setWidgets] = useState<WidgetConfig[]>([]);
  const queryClient = useQueryClient();

  // Query for dashboard data
  const {
    data: dashboardData,
    error: dashboardError,
    isLoading,
    refetch: refetchDashboard
  } = useQuery({
    queryKey: ['dashboard-data'],
    queryFn: () => ReportsApiService.getDashboardData(),
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000 // Data is fresh for 10 seconds
  });

  // Initialize default widgets on mount
  useEffect(() => {
    initializeDefaultWidgets();
  }, []);

  const initializeDefaultWidgets = () => {
    const defaultWidgets: WidgetConfig[] = [
      {
        id: 'resource-metrics',
        type: 'metric',
        title: 'Total Resources',
        position: { x: 0, y: 0, width: 300, height: 200 },
        configuration: {
          dataSource: 'dashboard',
          metric: {
            value: '0',
            label: 'Network Resources',
            format: 'number',
            unit: 'resources'
          }
        },
        refreshInterval: 60
      },
      {
        id: 'health-status',
        type: 'status',
        title: 'System Health',
        position: { x: 320, y: 0, width: 400, height: 300 },
        configuration: {
          dataSource: 'dashboard',
          status: {
            statusField: 'healthStatus',
            statusMap: {
              healthy: { label: 'Healthy', color: 'green' },
              warning: { label: 'Warning', color: 'orange' },
              critical: { label: 'Critical', color: 'red' }
            }
          }
        },
        refreshInterval: 30
      },
      {
        id: 'resource-distribution',
        type: 'chart',
        title: 'Resource Distribution',
        position: { x: 0, y: 220, width: 500, height: 300 },
        configuration: {
          dataSource: 'aggregated',
          chart: {
            type: 'pie',
            title: 'Resources by Type',
            dataSource: 'vpc',
            aggregation: 'count',
            groupBy: 'state'
          }
        },
        refreshInterval: 120
      },
      {
        id: 'recent-activity',
        type: 'table',
        title: 'Recent Activity',
        position: { x: 520, y: 220, width: 600, height: 300 },
        configuration: {
          dataSource: 'dashboard',
          table: {
            columns: [
              { field: 'type', title: 'Type', type: 'text', sortable: true },
              { field: 'name', title: 'Resource', type: 'text', sortable: true },
              { field: 'action', title: 'Action', type: 'status', sortable: true },
              { field: 'timestamp', title: 'Time', type: 'date', sortable: true }
            ],
            pagination: true,
            sorting: true,
            filtering: false
          }
        },
        refreshInterval: 60
      }
    ];

    setWidgets(defaultWidgets);
  };

  const handleRefreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetchDashboard();
      // Invalidate all widget-specific queries
      await queryClient.invalidateQueries({ queryKey: ['widget-data'] });
      message.success('Dashboard refreshed successfully');
    } catch (error: any) {
      message.error('Failed to refresh dashboard');
      console.error('Dashboard refresh error:', error);
    } finally {
      setRefreshing(false);
    }
  }, [refetchDashboard, queryClient]);

  const handleWidgetRefresh = useCallback((widgetId: string) => {
    // Invalidate specific widget queries
    queryClient.invalidateQueries({ queryKey: ['widget-data', widgetId] });
    message.success(`Widget ${widgetId} refreshed`);
  }, [queryClient]);

  const handleWidgetFullscreen = useCallback((widgetId: string) => {
    setFullscreenWidget(widgetId);
  }, []);

  const handleWidgetSettings = useCallback((widgetId: string) => {
    message.info(`Widget settings for ${widgetId} - Coming soon!`);
  }, []);

  const handleCloseFullscreen = () => {
    setFullscreenWidget(null);
  };

  const addWidgetMenuItems = [
    {
      key: 'metric',
      label: 'Metric Widget',
      onClick: () => message.info('Add Metric Widget - Coming soon!')
    },
    {
      key: 'chart',
      label: 'Chart Widget', 
      onClick: () => message.info('Add Chart Widget - Coming soon!')
    },
    {
      key: 'table',
      label: 'Table Widget',
      onClick: () => message.info('Add Table Widget - Coming soon!')
    },
    {
      key: 'status',
      label: 'Status Widget',
      onClick: () => message.info('Add Status Widget - Coming soon!')
    }
  ];

  // Update widget data when dashboard data changes
  useEffect(() => {
    if (dashboardData?.success && dashboardData.data) {
      updateWidgetData(dashboardData.data);
    }
  }, [dashboardData]);

  const updateWidgetData = (data: DashboardData) => {
    setWidgets(prevWidgets => 
      prevWidgets.map(widget => {
        const updatedWidget = { ...widget };
        
        switch (widget.id) {
          case 'resource-metrics':
            if (updatedWidget.configuration.metric) {
              updatedWidget.configuration.metric.value = data.resourceCounts.total || 0;
            }
            break;
          // Add other widget data updates as needed
        }
        
        return updatedWidget;
      })
    );
  };

  const renderFullscreenModal = () => {
    const widget = widgets.find(w => w.id === fullscreenWidget);
    if (!widget) return null;

    return (
      <Modal
        title={widget.title}
        open={!!fullscreenWidget}
        onCancel={handleCloseFullscreen}
        width="90%"
        style={{ top: 20 }}
        footer={null}
        bodyStyle={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}
      >
        <DashboardWidget
          widget={{
            ...widget,
            position: { ...widget.position, width: 800, height: 600 }
          }}
          onRefresh={handleWidgetRefresh}
          onSettings={handleWidgetSettings}
          allowInteraction={true}
        />
      </Modal>
    );
  };

  if (isLoading && widgets.length === 0) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px' 
      }}>
        <Spin size="large" tip="Loading dashboard..." />
      </div>
    );
  }

  if (dashboardError) {
    return (
      <Alert
        message="Dashboard Error"
        description="Failed to load dashboard data. Please try refreshing the page."
        type="error"
        showIcon
        action={
          <Button onClick={handleRefreshAll}>
            Retry
          </Button>
        }
      />
    );
  }

  return (
    <Layout>
      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        {/* Dashboard Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          marginBottom: 24 
        }}>
          <Title level={2} style={{ margin: 0 }}>
            Network CMDB Dashboard
          </Title>
          
          <Space>
            <Dropdown
              menu={{ items: addWidgetMenuItems }}
              placement="bottomRight"
            >
              <Button icon={<PlusOutlined />}>
                Add Widget
              </Button>
            </Dropdown>
            
            <Button 
              icon={<SettingOutlined />}
              onClick={() => message.info('Dashboard settings - Coming soon!')}
            >
              Settings
            </Button>
            
            <Button 
              type="primary"
              icon={<ReloadOutlined />}
              loading={refreshing}
              onClick={handleRefreshAll}
            >
              Refresh All
            </Button>
          </Space>
        </div>

        {/* Dashboard Widgets Grid */}
        <div style={{ position: 'relative', minHeight: '600px' }}>
          {/* For now, using a simple grid layout */}
          <Row gutter={[16, 16]}>
            <Col span={8}>
              {widgets[0] && (
                <DashboardWidget
                  key={widgets[0].id}
                  widget={widgets[0]}
                  onRefresh={handleWidgetRefresh}
                  onFullscreen={handleWidgetFullscreen}
                  onSettings={handleWidgetSettings}
                />
              )}
            </Col>
            
            <Col span={16}>
              {widgets[1] && (
                <DashboardWidget
                  key={widgets[1].id}
                  widget={widgets[1]}
                  onRefresh={handleWidgetRefresh}
                  onFullscreen={handleWidgetFullscreen}
                  onSettings={handleWidgetSettings}
                />
              )}
            </Col>
            
            <Col span={12}>
              {widgets[2] && (
                <DashboardWidget
                  key={widgets[2].id}
                  widget={widgets[2]}
                  onRefresh={handleWidgetRefresh}
                  onFullscreen={handleWidgetFullscreen}
                  onSettings={handleWidgetSettings}
                />
              )}
            </Col>
            
            <Col span={12}>
              {widgets[3] && (
                <DashboardWidget
                  key={widgets[3].id}
                  widget={widgets[3]}
                  onRefresh={handleWidgetRefresh}
                  onFullscreen={handleWidgetFullscreen}
                  onSettings={handleWidgetSettings}
                />
              )}
            </Col>
          </Row>
        </div>

        {/* Last Updated Info */}
        {dashboardData?.data?.lastUpdated && (
          <div style={{ 
            textAlign: 'center', 
            marginTop: 24, 
            color: '#8c8c8c',
            fontSize: '12px'
          }}>
            Last updated: {new Date(dashboardData.data.lastUpdated).toLocaleString()}
            {dashboardData.metadata?.executionTime && (
              <span> • Load time: {dashboardData.metadata.executionTime}ms</span>
            )}
          </div>
        )}

        {/* Fullscreen Modal */}
        {renderFullscreenModal()}
      </Content>
    </Layout>
  );
};