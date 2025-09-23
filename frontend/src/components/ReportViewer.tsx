import React, { useState, useEffect } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Row,
  Col,
  Statistic,
  Tag,
  Dropdown,
  Modal,
  Form,
  Input,
  Select,
  message,
  Spin,
  Alert,
  Tabs,
  Divider,
  Tooltip,
  Progress,
  Badge
} from 'antd'
import {
  FileTextOutlined,
  DownloadOutlined,
  ShareAltOutlined,
  MoreOutlined,
  ReloadOutlined,
  EditOutlined,
  DeleteOutlined,
  BarChartOutlined,
  TableOutlined,
  CalendarOutlined,
  EyeOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SettingOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title as ChartTitle,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js'
import { Bar, Line, Pie, Doughnut } from 'react-chartjs-2'
import type {
  ReportDefinition,
  ReportExecution,
  ExportOptions,
  ExportFormat,
  ChartType,
  DashboardData
} from '@/types/reports'
import {
  useReportsDashboard,
  useReportsWidget,
  useReportHistory,
  useExportReport,
  useGenerateReport,
  useReportAnalytics
} from '@/hooks/useReports'

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  ChartTitle,
  ChartTooltip,
  Legend
)

const { Title, Text } = Typography
const { Option } = Select
const { TabPane } = Tabs

interface ReportViewerProps {
  reportId?: number
  data?: any[]
  reportDefinition?: ReportDefinition
  showDashboard?: boolean
  onEditReport?: (reportId: number) => void
  onDeleteReport?: (reportId: number) => void
}

interface ExportModalProps {
  visible: boolean
  onClose: () => void
  onExport: (options: ExportOptions) => void
  data: any[]
  loading?: boolean
}

const ExportModal: React.FC<ExportModalProps> = ({
  visible,
  onClose,
  onExport,
  data,
  loading = false
}) => {
  const [form] = Form.useForm()

  const handleExport = () => {
    form.validateFields().then(values => {
      onExport(values)
      form.resetFields()
    })
  }

  return (
    <Modal
      title="Export Report"
      open={visible}
      onCancel={onClose}
      onOk={handleExport}
      confirmLoading={loading}
      width={600}
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="format"
          label="Export Format"
          rules={[{ required: true, message: 'Please select export format' }]}
        >
          <Select placeholder="Select format">
            <Option value="pdf">PDF</Option>
            <Option value="excel">Excel</Option>
            <Option value="csv">CSV</Option>
            <Option value="json">JSON</Option>
            <Option value="html">HTML</Option>
          </Select>
        </Form.Item>

        <Form.Item name="includeCharts" valuePropName="checked">
          <input type="checkbox" /> Include Charts
        </Form.Item>

        <Form.Item name="includeMetadata" valuePropName="checked">
          <input type="checkbox" defaultChecked /> Include Metadata
        </Form.Item>

        <Form.Item name="compression" valuePropName="checked">
          <input type="checkbox" /> Enable Compression
        </Form.Item>

        <Form.Item name="password" label="Password Protection (Optional)">
          <Input.Password placeholder="Enter password for file protection" />
        </Form.Item>
      </Form>

      <Alert
        message={`Ready to export ${data.length} records`}
        type="info"
        showIcon
        style={{ marginTop: 16 }}
      />
    </Modal>
  )
}

const DashboardOverview: React.FC = () => {
  const { dashboard, isLoading, isError, error } = useReportsDashboard()
  const {
    widget: metricsWidget,
    isLoading: metricsLoading
  } = useReportsWidget('metrics')
  const {
    widget: statusWidget,
    isLoading: statusLoading
  } = useReportsWidget('status')

  if (isLoading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Loading dashboard...</div>
        </div>
      </Card>
    )
  }

  if (isError) {
    return (
      <Alert
        message="Failed to load dashboard"
        description={error?.message || 'Unknown error occurred'}
        type="error"
        showIcon
      />
    )
  }

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Resources"
              value={dashboard?.resourceCounts?.totalResources || 0}
              prefix={<FileTextOutlined />}
              loading={metricsLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="VPCs"
              value={dashboard?.resourceCounts?.vpcs || 0}
              prefix={<BarChartOutlined />}
              loading={metricsLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Subnets"
              value={dashboard?.resourceCounts?.subnets || 0}
              prefix={<BarChartOutlined />}
              loading={metricsLoading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Transit Gateways"
              value={dashboard?.resourceCounts?.transitGateways || 0}
              prefix={<BarChartOutlined />}
              loading={metricsLoading}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card title="Resource Health Status" loading={statusLoading}>
            {dashboard?.healthStatus && (
              <Space direction="vertical" style={{ width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>Healthy</Text>
                  <Badge count={dashboard.healthStatus.healthy} style={{ backgroundColor: '#52c41a' }} />
                </div>
                <Progress
                  percent={Math.round((dashboard.healthStatus.healthy /
                    (dashboard.healthStatus.healthy + dashboard.healthStatus.warning + dashboard.healthStatus.critical)) * 100)}
                  strokeColor="#52c41a"
                  showInfo={false}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>Warning</Text>
                  <Badge count={dashboard.healthStatus.warning} style={{ backgroundColor: '#faad14' }} />
                </div>
                <Progress
                  percent={Math.round((dashboard.healthStatus.warning /
                    (dashboard.healthStatus.healthy + dashboard.healthStatus.warning + dashboard.healthStatus.critical)) * 100)}
                  strokeColor="#faad14"
                  showInfo={false}
                />

                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text>Critical</Text>
                  <Badge count={dashboard.healthStatus.critical} style={{ backgroundColor: '#ff4d4f' }} />
                </div>
                <Progress
                  percent={Math.round((dashboard.healthStatus.critical /
                    (dashboard.healthStatus.healthy + dashboard.healthStatus.warning + dashboard.healthStatus.critical)) * 100)}
                  strokeColor="#ff4d4f"
                  showInfo={false}
                />
              </Space>
            )}
          </Card>
        </Col>

        <Col span={12}>
          <Card title="Resource Utilization">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Statistic
                title="Average Utilization"
                value={dashboard?.utilizationMetrics?.averageUtilization || 0}
                suffix="%"
                precision={1}
              />
              <div>
                <Text strong>High Utilization Resources: </Text>
                <Tag color="orange">{dashboard?.utilizationMetrics?.highUtilizationResources || 0}</Tag>
              </div>
              <div>
                <Text strong>Low Utilization Resources: </Text>
                <Tag color="green">{dashboard?.utilizationMetrics?.lowUtilizationResources || 0}</Tag>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      <Card title="Recent Activity" style={{ marginTop: 16 }}>
        <Table
          dataSource={dashboard?.recentActivity || []}
          columns={[
            {
              title: 'Type',
              dataIndex: 'type',
              key: 'type',
              render: (type) => <Tag color="blue">{type}</Tag>
            },
            {
              title: 'Resource',
              dataIndex: 'resource',
              key: 'resource'
            },
            {
              title: 'Action',
              dataIndex: 'action',
              key: 'action'
            },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              render: (status) => {
                const color = status === 'success' ? 'green' : status === 'warning' ? 'orange' : 'red'
                const icon = status === 'success' ? <CheckCircleOutlined /> :
                            status === 'warning' ? <ExclamationCircleOutlined /> : <ClockCircleOutlined />
                return <Tag color={color} icon={icon}>{status}</Tag>
              }
            },
            {
              title: 'Timestamp',
              dataIndex: 'timestamp',
              key: 'timestamp',
              render: (timestamp) => new Date(timestamp).toLocaleString()
            }
          ]}
          pagination={{ pageSize: 5 }}
          size="small"
        />
      </Card>
    </div>
  )
}

const ReportChart: React.FC<{
  type: ChartType
  data: any[]
  title: string
  groupBy?: string
  aggregation?: string
}> = ({ type, data, title, groupBy, aggregation = 'count' }) => {
  const processData = () => {
    if (!data || !groupBy) return { labels: [], datasets: [] }

    // Group data by the specified field
    const grouped = data.reduce((acc, item) => {
      const key = item[groupBy] || 'Unknown'
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {})

    const labels = Object.keys(grouped)
    const values = Object.values(grouped)

    const colors = [
      '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
      '#13c2c2', '#eb2f96', '#fa541c', '#a0d911', '#2f54eb'
    ]

    return {
      labels,
      datasets: [{
        label: title,
        data: values,
        backgroundColor: colors.slice(0, labels.length),
        borderColor: colors.slice(0, labels.length),
        borderWidth: 1
      }]
    }
  }

  const chartData = processData()
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: title
      }
    }
  }

  const renderChart = () => {
    switch (type) {
      case 'bar':
        return <Bar data={chartData} options={options} />
      case 'line':
        return <Line data={chartData} options={options} />
      case 'pie':
        return <Pie data={chartData} options={options} />
      case 'donut':
        return <Doughnut data={chartData} options={options} />
      default:
        return <Bar data={chartData} options={options} />
    }
  }

  return (
    <div style={{ height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {chartData.labels.length > 0 ? renderChart() : (
        <Alert
          message="No data available for chart"
          description="The chart cannot be displayed because there is no data or the grouping field is not available."
          type="info"
          showIcon
        />
      )}
    </div>
  )
}

export default function ReportViewer({
  reportId,
  data,
  reportDefinition,
  showDashboard = false,
  onEditReport,
  onDeleteReport
}: ReportViewerProps) {
  const [exportModalVisible, setExportModalVisible] = useState(false)
  const [activeTab, setActiveTab] = useState(showDashboard ? 'dashboard' : 'table')

  const { history, isLoading: historyLoading } = useReportHistory(reportId)
  const { analytics, isLoading: analyticsLoading } = useReportAnalytics(reportId)
  const exportMutation = useExportReport()
  const generateMutation = useGenerateReport()

  const handleExport = async (options: ExportOptions) => {
    if (!data || data.length === 0) {
      message.warning('No data available to export')
      return
    }

    try {
      const result = await exportMutation.mutateAsync({
        data,
        format: options.format,
        options,
        metadata: {
          reportName: reportDefinition?.name || 'Untitled Report',
          generatedAt: new Date().toISOString(),
          recordCount: data.length
        }
      })

      message.success('Export completed successfully')

      // Download the file
      if (result.downloadUrl) {
        const link = document.createElement('a')
        link.href = result.downloadUrl
        link.download = result.fileName || 'report'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      }

      setExportModalVisible(false)
    } catch (error) {
      message.error('Export failed')
    }
  }

  const handleRefresh = async () => {
    if (reportDefinition?.query) {
      try {
        await generateMutation.mutateAsync(reportDefinition.query)
        message.success('Report refreshed successfully')
      } catch (error) {
        message.error('Failed to refresh report')
      }
    }
  }

  const getTableColumns = (): ColumnsType<any> => {
    if (!data || data.length === 0) return []

    const sampleRow = data[0]
    return Object.keys(sampleRow).map(key => ({
      title: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      dataIndex: key,
      key: key,
      sorter: (a, b) => {
        if (typeof a[key] === 'string') {
          return a[key].localeCompare(b[key])
        }
        return a[key] - b[key]
      },
      render: (value) => {
        if (typeof value === 'boolean') {
          return <Tag color={value ? 'green' : 'red'}>{value ? 'Yes' : 'No'}</Tag>
        }
        if (key.includes('date') || key.includes('time')) {
          return new Date(value).toLocaleString()
        }
        if (key === 'state' || key === 'status') {
          const color = value === 'active' || value === 'available' ? 'green' :
                       value === 'pending' ? 'orange' : 'red'
          return <Tag color={color}>{value}</Tag>
        }
        return value
      }
    }))
  }

  const menuItems: MenuProps['items'] = [
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Edit Report',
      onClick: () => onEditReport?.(reportId!),
      disabled: !reportId
    },
    {
      key: 'share',
      icon: <ShareAltOutlined />,
      label: 'Share Report'
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Delete Report',
      onClick: () => onDeleteReport?.(reportId!),
      disabled: !reportId,
      danger: true
    }
  ]

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardOverview />

      case 'table':
        return (
          <Table
            dataSource={data}
            columns={getTableColumns()}
            rowKey={(record, index) => record.id || index}
            pagination={{
              total: data?.length || 0,
              pageSize: 50,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} items`
            }}
            scroll={{ x: true }}
            loading={generateMutation.isPending}
          />
        )

      case 'chart':
        return reportDefinition?.visualization?.chart ? (
          <ReportChart
            type={reportDefinition.visualization.chart.type}
            data={data || []}
            title={reportDefinition.visualization.chart.title}
            groupBy={reportDefinition.visualization.chart.groupBy}
            aggregation={reportDefinition.visualization.chart.aggregation}
          />
        ) : (
          <Alert
            message="No chart configuration"
            description="This report doesn't have a chart configuration. Edit the report to add visualization."
            type="info"
            showIcon
          />
        )

      case 'history':
        return (
          <Table
            dataSource={history}
            loading={historyLoading}
            columns={[
              {
                title: 'Execution ID',
                dataIndex: 'id',
                key: 'id'
              },
              {
                title: 'Status',
                dataIndex: 'status',
                key: 'status',
                render: (status) => {
                  const color = status === 'completed' ? 'green' :
                               status === 'running' ? 'blue' :
                               status === 'failed' ? 'red' : 'orange'
                  return <Tag color={color}>{status}</Tag>
                }
              },
              {
                title: 'Start Time',
                dataIndex: 'startTime',
                key: 'startTime',
                render: (time) => new Date(time).toLocaleString()
              },
              {
                title: 'Duration',
                dataIndex: 'executionTime',
                key: 'executionTime',
                render: (time) => time ? `${time}ms` : '-'
              },
              {
                title: 'Records',
                dataIndex: 'recordCount',
                key: 'recordCount'
              }
            ]}
            pagination={{ pageSize: 10 }}
          />
        )

      case 'analytics':
        return (
          <Row gutter={[16, 16]}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Total Executions"
                  value={analytics?.totalExecutions || 0}
                  loading={analyticsLoading}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Avg Execution Time"
                  value={analytics?.averageExecutionTime || 0}
                  suffix="ms"
                  loading={analyticsLoading}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="Error Rate"
                  value={analytics?.errorRate || 0}
                  suffix="%"
                  loading={analyticsLoading}
                />
              </Card>
            </Col>
          </Row>
        )

      default:
        return null
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
          <Col>
            <Title level={3}>
              <Space>
                <FileTextOutlined />
                {reportDefinition?.name || 'Report Viewer'}
              </Space>
            </Title>
            {reportDefinition?.description && (
              <Text type="secondary">{reportDefinition.description}</Text>
            )}
          </Col>
          <Col>
            <Space>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                loading={generateMutation.isPending}
              >
                Refresh
              </Button>
              <Button
                icon={<DownloadOutlined />}
                onClick={() => setExportModalVisible(true)}
                disabled={!data || data.length === 0}
              >
                Export
              </Button>
              <Dropdown menu={{ items: menuItems }} trigger={['click']}>
                <Button icon={<MoreOutlined />} />
              </Dropdown>
            </Space>
          </Col>
        </Row>

        {reportDefinition && (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col>
              <Tag color="blue">{reportDefinition.category}</Tag>
            </Col>
            <Col>
              <Text strong>Resource Types: </Text>
              {reportDefinition.query.resourceTypes.map(type => (
                <Tag key={type}>{type}</Tag>
              ))}
            </Col>
            <Col>
              <Text strong>Fields: </Text>
              <Text>{reportDefinition.query.fields.length} selected</Text>
            </Col>
            {data && (
              <Col>
                <Text strong>Records: </Text>
                <Badge count={data.length} style={{ backgroundColor: '#52c41a' }} />
              </Col>
            )}
          </Row>
        )}

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            ...(showDashboard ? [{
              key: 'dashboard',
              label: (
                <span>
                  <BarChartOutlined />
                  Dashboard
                </span>
              ),
              children: null
            }] : []),
            {
              key: 'table',
              label: (
                <span>
                  <TableOutlined />
                  Table View
                </span>
              ),
              children: null
            },
            ...(reportDefinition?.visualization?.chart ? [{
              key: 'chart',
              label: (
                <span>
                  <BarChartOutlined />
                  Chart View
                </span>
              ),
              children: null
            }] : []),
            ...(reportId ? [{
              key: 'history',
              label: (
                <span>
                  <ClockCircleOutlined />
                  History
                </span>
              ),
              children: null
            }, {
              key: 'analytics',
              label: (
                <span>
                  <SettingOutlined />
                  Analytics
                </span>
              ),
              children: null
            }] : [])
          ]}
        />

        <div style={{ marginTop: 16 }}>
          {renderTabContent()}
        </div>
      </Card>

      <ExportModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        onExport={handleExport}
        data={data || []}
        loading={exportMutation.isPending}
      />
    </div>
  )
}