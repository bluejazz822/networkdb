import { useState, useEffect } from 'react'
import {
  Modal,
  Form,
  Checkbox,
  Radio,
  Button,
  Space,
  Typography,
  Card,
  Row,
  Col,
  message,
  Statistic,
  DatePicker,
  Select,
  Divider,
  Switch,
  Tabs
} from 'antd'
import {
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  DownloadOutlined,
  BarChartOutlined,
  CalendarOutlined,
  FilterOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import {
  ReportExportConfig,
  ReportField,
  AnalyticsReportData,
  AnalyticsTimeRange,
  ChartExportConfig,
  EXECUTION_HISTORY_FIELDS,
  PERFORMANCE_METRICS_FIELDS,
  DATA_FRESHNESS_FIELDS,
  ExecutionStatus
} from '../types/workflow'
import {
  exportAnalyticsReport,
  getAnalyticsExportStats,
  generateSampleAnalyticsData
} from '../utils/reportExport'

const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { Option } = Select
const { TabPane } = Tabs

interface ReportExportModalProps {
  visible: boolean
  onCancel: () => void
  reportData?: AnalyticsReportData
  availableCharts?: ChartExportConfig[]
  onExport?: (config: ReportExportConfig) => void
}

const DEFAULT_FIELD_CONFIGS = {
  execution_history: EXECUTION_HISTORY_FIELDS,
  performance_metrics: PERFORMANCE_METRICS_FIELDS,
  data_freshness: DATA_FRESHNESS_FIELDS,
  trend_analysis: [
    { key: 'date', label: 'Date', selected: true, format: 'date' },
    { key: 'executions', label: 'Total Executions', selected: true, format: 'number' },
    { key: 'successes', label: 'Successful', selected: true, format: 'number' },
    { key: 'failures', label: 'Failed', selected: true, format: 'number' },
    { key: 'successRate', label: 'Success Rate', selected: true, format: 'percentage' },
    { key: 'avgDuration', label: 'Average Duration', selected: false, format: 'duration' }
  ]
}

export default function ReportExportModal({
  visible,
  onCancel,
  reportData,
  availableCharts = [],
  onExport
}: ReportExportModalProps) {
  const [form] = Form.useForm()
  const [config, setConfig] = useState<ReportExportConfig>({
    reportType: 'execution_history',
    format: 'csv',
    timeRange: {
      start: dayjs().subtract(7, 'days').toISOString(),
      end: dayjs().toISOString(),
      granularity: 'day'
    },
    filters: {
      includeCharts: false,
      groupBy: 'workflow'
    },
    fields: [...DEFAULT_FIELD_CONFIGS.execution_history]
  })
  const [exporting, setExporting] = useState(false)
  const [previewData, setPreviewData] = useState<AnalyticsReportData | null>(null)

  // Update fields when report type changes
  useEffect(() => {
    const defaultFields = DEFAULT_FIELD_CONFIGS[config.reportType as keyof typeof DEFAULT_FIELD_CONFIGS]
    setConfig(prev => ({
      ...prev,
      fields: [...defaultFields]
    }))
  }, [config.reportType])

  // Generate preview data when config changes
  useEffect(() => {
    if (visible && !reportData) {
      const preview = generateSampleAnalyticsData(config.reportType, config.timeRange)
      setPreviewData(preview)
    } else {
      setPreviewData(reportData || null)
    }
  }, [config.reportType, config.timeRange, reportData, visible])

  const stats = previewData ? getAnalyticsExportStats(config, previewData) : null

  const handleFieldChange = (fieldKey: string, checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      fields: prev.fields.map(field =>
        field.key === fieldKey ? { ...field, selected: checked } : field
      )
    }))
  }

  const handleSelectAll = (checked: boolean) => {
    setConfig(prev => ({
      ...prev,
      fields: prev.fields.map(field => ({ ...field, selected: checked }))
    }))
  }

  const handleTimeRangeChange = (dates: any, dateStrings: [string, string]) => {
    if (dates && dates.length === 2) {
      setConfig(prev => ({
        ...prev,
        timeRange: {
          ...prev.timeRange,
          start: dates[0].toISOString(),
          end: dates[1].toISOString()
        }
      }))
    }
  }

  const handleExport = async () => {
    const selectedFields = config.fields.filter(field => field.selected)
    if (selectedFields.length === 0) {
      message.warning('Please select at least one field to export')
      return
    }

    if (!previewData) {
      message.error('No data available for export')
      return
    }

    setExporting(true)

    try {
      const chartConfigs = config.filters?.includeCharts ? availableCharts : undefined
      const success = await exportAnalyticsReport(config, previewData, chartConfigs)

      if (success) {
        message.success(`Successfully exported ${config.reportType.replace('_', ' ')} report to ${config.format.toUpperCase()}`)
        onExport?.(config)
        onCancel()
      } else {
        message.error(`Failed to export to ${config.format.toUpperCase()}`)
      }
    } catch (error) {
      console.error('Export error:', error)
      message.error('Export failed due to an unexpected error')
    } finally {
      setExporting(false)
    }
  }

  const formatOptions = [
    {
      value: 'csv',
      label: 'CSV',
      icon: <FileTextOutlined />,
      description: 'Comma-separated values, compatible with Excel and spreadsheet applications',
      color: '#52c41a'
    },
    {
      value: 'excel',
      label: 'Excel',
      icon: <FileExcelOutlined />,
      description: 'Microsoft Excel format with multiple sheets and formatting',
      color: '#1890ff'
    },
    {
      value: 'pdf',
      label: 'PDF',
      icon: <FilePdfOutlined />,
      description: 'Comprehensive report with charts, summaries, and tables',
      color: '#f5222d'
    }
  ] as const

  const reportTypeOptions = [
    {
      value: 'execution_history',
      label: 'Execution History',
      description: 'Detailed log of workflow executions with timestamps and results'
    },
    {
      value: 'performance_metrics',
      label: 'Performance Metrics',
      description: 'Aggregated metrics showing success rates and execution times'
    },
    {
      value: 'data_freshness',
      label: 'Data Freshness',
      description: 'Status of data freshness and expected execution schedules'
    },
    {
      value: 'trend_analysis',
      label: 'Trend Analysis',
      description: 'Time-series data showing performance trends over time'
    }
  ]

  return (
    <Modal
      title={
        <Space>
          <BarChartOutlined />
          Export Analytics Report
        </Space>
      }
      open={visible}
      onCancel={onCancel}
      width={1000}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          Cancel
        </Button>,
        <Button
          key="export"
          type="primary"
          icon={<DownloadOutlined />}
          onClick={handleExport}
          loading={exporting}
          disabled={!stats || stats.selectedFields === 0}
        >
          Export Report
        </Button>
      ]}
    >
      <Form form={form} layout="vertical">
        {stats && (
          <Card size="small" style={{ marginBottom: 16 }}>
            <Row gutter={16}>
              <Col span={6}>
                <Statistic
                  title="Total Records"
                  value={stats.totalRecords}
                  valueStyle={{ color: '#1890ff' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Selected Fields"
                  value={stats.selectedFields}
                  suffix={`/ ${stats.totalFields}`}
                  valueStyle={{ color: stats.selectedFields > 0 ? '#52c41a' : '#ff4d4f' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Est. File Size"
                  value={stats.estimatedFileSize[config.format]}
                  suffix="KB"
                  valueStyle={{ color: '#722ed1' }}
                />
              </Col>
              <Col span={6}>
                <Statistic
                  title="Time Range"
                  value={`${dayjs(config.timeRange.start).format('MMM DD')} - ${dayjs(config.timeRange.end).format('MMM DD')}`}
                  valueStyle={{ color: '#fa8c16' }}
                />
              </Col>
            </Row>
          </Card>
        )}

        <Tabs defaultActiveKey="general" size="small">
          <TabPane tab={<Space><FilterOutlined />Report Configuration</Space>} key="general">
            <Row gutter={24}>
              <Col span={12}>
                <Form.Item label="Report Type">
                  <Select
                    value={config.reportType}
                    onChange={(value) => setConfig(prev => ({ ...prev, reportType: value }))}
                    style={{ width: '100%' }}
                  >
                    {reportTypeOptions.map(option => (
                      <Option key={option.value} value={option.value}>
                        <div>
                          <Text strong>{option.label}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {option.description}
                          </Text>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item label={<Space><CalendarOutlined />Time Range</Space>}>
                  <RangePicker
                    value={[dayjs(config.timeRange.start), dayjs(config.timeRange.end)]}
                    onChange={handleTimeRangeChange}
                    style={{ width: '100%' }}
                    showTime={false}
                  />
                </Form.Item>

                <Form.Item label="Granularity">
                  <Select
                    value={config.timeRange.granularity}
                    onChange={(value) => setConfig(prev => ({
                      ...prev,
                      timeRange: { ...prev.timeRange, granularity: value }
                    }))}
                    style={{ width: '100%' }}
                  >
                    <Option value="hour">Hourly</Option>
                    <Option value="day">Daily</Option>
                    <Option value="week">Weekly</Option>
                    <Option value="month">Monthly</Option>
                  </Select>
                </Form.Item>

                <Form.Item label="Group By">
                  <Select
                    value={config.filters?.groupBy}
                    onChange={(value) => setConfig(prev => ({
                      ...prev,
                      filters: { ...prev.filters, groupBy: value }
                    }))}
                    style={{ width: '100%' }}
                  >
                    <Option value="workflow">Workflow</Option>
                    <Option value="date">Date</Option>
                    <Option value="status">Status</Option>
                  </Select>
                </Form.Item>
              </Col>

              <Col span={12}>
                <Title level={5}>Export Format</Title>
                <Radio.Group
                  value={config.format}
                  onChange={(e) => setConfig(prev => ({ ...prev, format: e.target.value }))}
                  style={{ width: '100%' }}
                >
                  <Space direction="vertical" style={{ width: '100%' }}>
                    {formatOptions.map(option => (
                      <Radio key={option.value} value={option.value}>
                        <Card
                          size="small"
                          style={{
                            marginLeft: 8,
                            border: config.format === option.value ? `2px solid ${option.color}` : '1px solid #d9d9d9'
                          }}
                        >
                          <Space>
                            <span style={{ color: option.color }}>{option.icon}</span>
                            <div>
                              <Text strong>{option.label}</Text>
                              <br />
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                {option.description}
                              </Text>
                            </div>
                          </Space>
                        </Card>
                      </Radio>
                    ))}
                  </Space>
                </Radio.Group>

                {config.format === 'pdf' && availableCharts.length > 0 && (
                  <>
                    <Divider />
                    <Form.Item>
                      <Space>
                        <Switch
                          checked={config.filters?.includeCharts}
                          onChange={(checked) => setConfig(prev => ({
                            ...prev,
                            filters: { ...prev.filters, includeCharts: checked }
                          }))}
                        />
                        <Text>Include Charts in PDF</Text>
                      </Space>
                      <br />
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        Available charts: {availableCharts.length}
                      </Text>
                    </Form.Item>
                  </>
                )}
              </Col>
            </Row>
          </TabPane>

          <TabPane tab="Fields Selection" key="fields">
            <Row gutter={24}>
              <Col span={24}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <Title level={5} style={{ margin: 0 }}>Select Fields to Export</Title>
                  <Space>
                    <Button size="small" onClick={() => handleSelectAll(true)}>
                      Select All
                    </Button>
                    <Button size="small" onClick={() => handleSelectAll(false)}>
                      Clear All
                    </Button>
                  </Space>
                </div>

                <div style={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 6, padding: 16 }}>
                  <Row gutter={[16, 8]}>
                    {config.fields.map(field => (
                      <Col span={12} key={field.key}>
                        <Checkbox
                          checked={field.selected}
                          onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                        >
                          <Space direction="vertical" size={0}>
                            <Text strong={field.selected}>{field.label}</Text>
                            {field.format && (
                              <Text type="secondary" style={{ fontSize: '11px' }}>
                                Format: {field.format}
                              </Text>
                            )}
                          </Space>
                        </Checkbox>
                      </Col>
                    ))}
                  </Row>
                </div>
              </Col>
            </Row>
          </TabPane>

          {config.reportType === 'execution_history' && (
            <TabPane tab="Filters" key="filters">
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item label="Execution Status">
                    <Select
                      mode="multiple"
                      placeholder="Filter by status (all if none selected)"
                      value={config.filters?.status}
                      onChange={(value) => setConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, status: value }
                      }))}
                      style={{ width: '100%' }}
                    >
                      <Option value="success">Success</Option>
                      <Option value="error">Error</Option>
                      <Option value="running">Running</Option>
                      <Option value="waiting">Waiting</Option>
                      <Option value="crashed">Crashed</Option>
                      <Option value="aborted">Aborted</Option>
                      <Option value="cancelled">Cancelled</Option>
                    </Select>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Workflow IDs">
                    <Select
                      mode="tags"
                      placeholder="Filter by specific workflows (all if none selected)"
                      value={config.filters?.workflowIds}
                      onChange={(value) => setConfig(prev => ({
                        ...prev,
                        filters: { ...prev.filters, workflowIds: value }
                      }))}
                      style={{ width: '100%' }}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </TabPane>
          )}
        </Tabs>
      </Form>
    </Modal>
  )
}