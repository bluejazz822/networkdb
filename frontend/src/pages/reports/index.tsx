/**
 * Reports Index Page
 * Main entry point for the reporting system
 */

import React, { useState } from 'react';
import { 
  Layout, 
  Tabs, 
  Button, 
  Space, 
  Typography, 
  Card,
  Row,
  Col,
  Statistic,
  Tag
} from 'antd';
import { 
  DashboardOutlined, 
  FileTextOutlined, 
  BarChartOutlined,
  ScheduleOutlined,
  PlusOutlined,
  HistoryOutlined
} from '@ant-design/icons';
import { Dashboard } from './Dashboard';
import { ReportBuilder } from '../../components/reports/ReportBuilder';
import { ReportBuilder as ReportBuilderConfig } from '../../types/reports';

const { Content } = Layout;
const { Title, Text } = Typography;
const { TabPane } = Tabs;

export const ReportsIndex: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showReportBuilder, setShowReportBuilder] = useState(false);

  const handleCreateReport = () => {
    setShowReportBuilder(true);
  };

  const handleSaveReport = (config: ReportBuilderConfig) => {
    console.log('Saving report configuration:', config);
    // Here you would typically save to the backend
    setShowReportBuilder(false);
    // You might also switch to a different tab or show a success message
  };

  const handleCancelReportBuilder = () => {
    setShowReportBuilder(false);
  };

  const renderOverview = () => (
    <div>
      <Title level={3}>Reports Overview</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Welcome to the Network CMDB Reporting System. Create custom reports, view dashboards, and schedule automated reports.
      </Text>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card hoverable onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="Dashboard"
              value="4"
              prefix={<DashboardOutlined style={{ color: '#1890ff' }} />}
              suffix="Widgets"
            />
            <Text type="secondary">Real-time metrics and visualizations</Text>
          </Card>
        </Col>

        <Col span={6}>
          <Card hoverable onClick={handleCreateReport} style={{ cursor: 'pointer' }}>
            <Statistic
              title="Custom Reports"
              value="12"
              prefix={<FileTextOutlined style={{ color: '#52c41a' }} />}
              suffix="Available"
            />
            <Text type="secondary">Create and manage custom reports</Text>
          </Card>
        </Col>

        <Col span={6}>
          <Card hoverable onClick={() => setActiveTab('templates')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="Templates"
              value="6"
              prefix={<BarChartOutlined style={{ color: '#faad14' }} />}
              suffix="Ready"
            />
            <Text type="secondary">Pre-built report templates</Text>
          </Card>
        </Col>

        <Col span={6}>
          <Card hoverable onClick={() => setActiveTab('scheduled')} style={{ cursor: 'pointer' }}>
            <Statistic
              title="Scheduled"
              value="3"
              prefix={<ScheduleOutlined style={{ color: '#722ed1' }} />}
              suffix="Active"
            />
            <Text type="secondary">Automated report generation</Text>
          </Card>
        </Col>
      </Row>

      <Card title="Quick Actions" style={{ marginBottom: 24 }}>
        <Space wrap>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={handleCreateReport}
          >
            Create New Report
          </Button>
          <Button 
            icon={<DashboardOutlined />}
            onClick={() => setActiveTab('dashboard')}
          >
            View Dashboard
          </Button>
          <Button 
            icon={<BarChartOutlined />}
            onClick={() => setActiveTab('templates')}
          >
            Browse Templates
          </Button>
          <Button 
            icon={<HistoryOutlined />}
            onClick={() => setActiveTab('history')}
          >
            Report History
          </Button>
        </Space>
      </Card>

      <Card title="Recent Reports" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { name: 'VPC Inventory Report', category: 'inventory', lastRun: '2 hours ago', status: 'completed' },
            { name: 'Security Compliance Summary', category: 'compliance', lastRun: '1 day ago', status: 'completed' },
            { name: 'Resource Utilization Analysis', category: 'performance', lastRun: '3 days ago', status: 'completed' }
          ].map((report, index) => (
            <div key={index} style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: index < 2 ? '1px solid #f0f0f0' : 'none'
            }}>
              <div>
                <Text strong>{report.name}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Category: <Tag size="small">{report.category}</Tag> • Last run: {report.lastRun}
                </Text>
              </div>
              <Tag color={report.status === 'completed' ? 'green' : 'orange'}>
                {report.status}
              </Tag>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderTemplates = () => (
    <div>
      <Title level={3}>Report Templates</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Pre-built report templates for common use cases. Click on a template to create a new report based on it.
      </Text>

      <Row gutter={[16, 16]}>
        {[
          {
            title: 'Inventory Summary',
            description: 'Overview of all network resources with current status',
            category: 'inventory',
            fields: 6,
            estimatedTime: '< 1 min'
          },
          {
            title: 'Compliance Report',
            description: 'Security and compliance status of all resources',
            category: 'compliance',
            fields: 8,
            estimatedTime: '< 2 min'
          },
          {
            title: 'Performance Analysis',
            description: 'Resource utilization and performance metrics',
            category: 'performance',
            fields: 10,
            estimatedTime: '< 3 min'
          },
          {
            title: 'Cost Analysis',
            description: 'Resource costs and optimization recommendations',
            category: 'utilization',
            fields: 7,
            estimatedTime: '< 2 min'
          },
          {
            title: 'Network Topology',
            description: 'Visual representation of network connections',
            category: 'custom',
            fields: 12,
            estimatedTime: '< 5 min'
          },
          {
            title: 'Change Log',
            description: 'Recent changes and updates to resources',
            category: 'custom',
            fields: 5,
            estimatedTime: '< 1 min'
          }
        ].map((template, index) => (
          <Col span={8} key={index}>
            <Card 
              hoverable
              onClick={() => {
                // You could pre-populate the report builder with template data here
                setShowReportBuilder(true);
              }}
              style={{ cursor: 'pointer' }}
            >
              <div style={{ marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0 }}>
                  {template.title}
                </Title>
                <Tag color="blue" size="small" style={{ marginTop: 4 }}>
                  {template.category}
                </Tag>
              </div>
              
              <Text type="secondary" style={{ fontSize: '14px', display: 'block', marginBottom: 16 }}>
                {template.description}
              </Text>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  {template.fields} fields • {template.estimatedTime}
                </Text>
                <Button type="link" size="small">
                  Use Template
                </Button>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );

  const renderScheduled = () => (
    <div>
      <Title level={3}>Scheduled Reports</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Manage automated report generation and delivery schedules.
      </Text>
      
      <Card>
        <Text type="secondary">
          Scheduled reports feature is coming soon. You'll be able to set up automated report generation and email delivery.
        </Text>
      </Card>
    </div>
  );

  const renderHistory = () => (
    <div>
      <Title level={3}>Report History</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        View and manage previously generated reports.
      </Text>
      
      <Card>
        <Text type="secondary">
          Report history feature is coming soon. You'll be able to view, download, and manage all your generated reports.
        </Text>
      </Card>
    </div>
  );

  if (showReportBuilder) {
    return (
      <ReportBuilder
        onSave={handleSaveReport}
        onCancel={handleCancelReportBuilder}
      />
    );
  }

  return (
    <Layout>
      <Content style={{ padding: '24px', background: '#f0f2f5' }}>
        <div style={{ background: '#fff', minHeight: 'calc(100vh - 112px)' }}>
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            size="large"
            style={{ padding: '0 24px' }}
          >
            <TabPane 
              tab={
                <Space>
                  <FileTextOutlined />
                  Overview
                </Space>
              } 
              key="overview"
            >
              <div style={{ padding: '0 0 24px' }}>
                {renderOverview()}
              </div>
            </TabPane>

            <TabPane 
              tab={
                <Space>
                  <DashboardOutlined />
                  Dashboard
                </Space>
              } 
              key="dashboard"
            >
              <Dashboard />
            </TabPane>

            <TabPane 
              tab={
                <Space>
                  <BarChartOutlined />
                  Templates
                </Space>
              } 
              key="templates"
            >
              <div style={{ padding: '24px' }}>
                {renderTemplates()}
              </div>
            </TabPane>

            <TabPane 
              tab={
                <Space>
                  <ScheduleOutlined />
                  Scheduled
                </Space>
              } 
              key="scheduled"
            >
              <div style={{ padding: '24px' }}>
                {renderScheduled()}
              </div>
            </TabPane>

            <TabPane 
              tab={
                <Space>
                  <HistoryOutlined />
                  History
                </Space>
              } 
              key="history"
            >
              <div style={{ padding: '24px' }}>
                {renderHistory()}
              </div>
            </TabPane>
          </Tabs>
        </div>
      </Content>
    </Layout>
  );
};