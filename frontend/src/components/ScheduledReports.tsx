import React, { useState } from 'react'
import {
  Card,
  Table,
  Button,
  Space,
  Typography,
  Tag,
  Dropdown,
  Modal,
  Form,
  Input,
  Select,
  DatePicker,
  TimePicker,
  Switch,
  message,
  Popconfirm,
  Badge,
  Tooltip,
  Alert,
  Row,
  Col,
  Statistic,
  Progress,
  Empty
} from 'antd'
import {
  CalendarOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  MoreOutlined,
  ClockCircleOutlined,
  MailOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  StopOutlined,
  EyeOutlined,
  SettingOutlined
} from '@ant-design/icons'
import type { ColumnsType } from 'antd/es/table'
import type { MenuProps } from 'antd'
import dayjs, { Dayjs } from 'dayjs'
import type {
  ScheduledReport,
  ReportSchedule,
  ExportFormat,
  ReportDefinition
} from '@/types/reports'
import {
  useScheduledReports,
  useScheduleReport,
  useUnscheduleReport,
  useReportTemplates
} from '@/hooks/useReports'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input

interface ScheduledReportsProps {
  onCreateReport?: () => void
  onViewReport?: (reportId: number) => void
  onEditReport?: (reportId: number) => void
}

interface ScheduleModalProps {
  visible: boolean
  onClose: () => void
  onSubmit: (schedule: ReportDefinition) => void
  editingSchedule?: ScheduledReport
  loading?: boolean
}

const ScheduleModal: React.FC<ScheduleModalProps> = ({
  visible,
  onClose,
  onSubmit,
  editingSchedule,
  loading = false
}) => {
  const [form] = Form.useForm()
  const { templates, isLoading: templatesLoading } = useReportTemplates()

  const handleSubmit = () => {
    form.validateFields().then(values => {
      const scheduleData: ReportDefinition = {
        name: values.name,
        description: values.description,
        category: 'custom',
        query: {
          resourceTypes: values.resourceTypes || ['vpc'],
          fields: values.fields || ['name', 'vpc_id', 'region'],
          filters: [],
          groupBy: [],
          orderBy: []
        },
        schedule: {
          enabled: true,
          frequency: values.frequency,
          cronExpression: values.cronExpression,
          startDate: values.startDate?.toDate(),
          endDate: values.endDate?.toDate(),
          timezone: values.timezone || 'UTC',
          delivery: {
            method: values.deliveryMethods || ['dashboard'],
            email: values.deliveryMethods?.includes('email') ? {
              recipients: values.emailRecipients || [],
              subject: values.emailSubject || `Scheduled Report: ${values.name}`,
              body: values.emailBody || '',
              formats: values.emailFormats || ['pdf'],
              includeCharts: values.includeCharts
            } : undefined
          }
        },
        permissions: {
          isPublic: false,
          owner: 1, // Will be set from auth context
          viewers: [],
          editors: []
        }
      }

      onSubmit(scheduleData)
      form.resetFields()
    })
  }

  const frequencyOptions = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'quarterly', label: 'Quarterly' },
    { value: 'custom', label: 'Custom (Cron)' }
  ]

  const formatOptions: { value: ExportFormat; label: string }[] = [
    { value: 'pdf', label: 'PDF' },
    { value: 'excel', label: 'Excel' },
    { value: 'csv', label: 'CSV' },
    { value: 'json', label: 'JSON' },
    { value: 'html', label: 'HTML' }
  ]

  const deliveryMethodOptions = [
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'email', label: 'Email' },
    { value: 'webhook', label: 'Webhook' },
    { value: 'storage', label: 'File Storage' }
  ]

  return (
    <Modal
      title={editingSchedule ? 'Edit Scheduled Report' : 'Create Scheduled Report'}
      open={visible}
      onCancel={onClose}
      onOk={handleSubmit}
      confirmLoading={loading}
      width={800}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={editingSchedule ? {
          name: editingSchedule.reportName,
          frequency: editingSchedule.frequency,
          enabled: editingSchedule.enabled,
          format: editingSchedule.format,
          recipients: editingSchedule.recipients,
          deliveryMethods: ['dashboard']
        } : {
          frequency: 'daily',
          enabled: true,
          deliveryMethods: ['dashboard'],
          timezone: 'UTC'
        }}
      >
        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Form.Item
              name="name"
              label="Report Name"
              rules={[{ required: true, message: 'Please enter report name' }]}
            >
              <Input placeholder="Enter report name" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="description" label="Description">
              <Input placeholder="Enter description (optional)" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Form.Item
              name="frequency"
              label="Frequency"
              rules={[{ required: true, message: 'Please select frequency' }]}
            >
              <Select placeholder="Select frequency">
                {frequencyOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="timezone" label="Timezone">
              <Select placeholder="Select timezone" defaultValue="UTC">
                <Option value="UTC">UTC</Option>
                <Option value="America/New_York">Eastern Time</Option>
                <Option value="America/Chicago">Central Time</Option>
                <Option value="America/Denver">Mountain Time</Option>
                <Option value="America/Los_Angeles">Pacific Time</Option>
                <Option value="Europe/London">London</Option>
                <Option value="Europe/Paris">Paris</Option>
                <Option value="Asia/Tokyo">Tokyo</Option>
                <Option value="Asia/Shanghai">Shanghai</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.frequency !== currentValues.frequency
          }
        >
          {({ getFieldValue }) =>
            getFieldValue('frequency') === 'custom' ? (
              <Form.Item
                name="cronExpression"
                label="Cron Expression"
                rules={[{ required: true, message: 'Please enter cron expression' }]}
                help="Format: minute hour day month day-of-week (e.g., '0 9 * * 1' for every Monday at 9 AM)"
              >
                <Input placeholder="0 9 * * 1" />
              </Form.Item>
            ) : null
          }
        </Form.Item>

        <Row gutter={[16, 16]}>
          <Col span={12}>
            <Form.Item name="startDate" label="Start Date">
              <DatePicker
                style={{ width: '100%' }}
                showTime
                placeholder="Select start date"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="endDate" label="End Date (Optional)">
              <DatePicker
                style={{ width: '100%' }}
                showTime
                placeholder="Select end date"
              />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          name="deliveryMethods"
          label="Delivery Methods"
          rules={[{ required: true, message: 'Please select at least one delivery method' }]}
        >
          <Select mode="multiple" placeholder="Select delivery methods">
            {deliveryMethodOptions.map(option => (
              <Option key={option.value} value={option.value}>
                {option.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prevValues, currentValues) =>
            prevValues.deliveryMethods !== currentValues.deliveryMethods
          }
        >
          {({ getFieldValue }) =>
            getFieldValue('deliveryMethods')?.includes('email') ? (
              <div>
                <Form.Item
                  name="emailRecipients"
                  label="Email Recipients"
                  rules={[{ required: true, message: 'Please enter email recipients' }]}
                >
                  <Select
                    mode="tags"
                    placeholder="Enter email addresses"
                    tokenSeparators={[',', ';']}
                  />
                </Form.Item>

                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Form.Item name="emailSubject" label="Email Subject">
                      <Input placeholder="Email subject" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="emailFormats" label="Email Formats">
                      <Select mode="multiple" placeholder="Select formats">
                        {formatOptions.map(option => (
                          <Option key={option.value} value={option.value}>
                            {option.label}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Form.Item name="emailBody" label="Email Body">
                  <TextArea
                    rows={3}
                    placeholder="Optional email body content"
                  />
                </Form.Item>

                <Form.Item name="includeCharts" valuePropName="checked">
                  <Switch /> Include charts in email
                </Form.Item>
              </div>
            ) : null
          }
        </Form.Item>

        {templates && templates.length > 0 && (
          <Alert
            message="Template Integration"
            description="You can use existing report templates as a starting point. Select a template to pre-populate report configuration."
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Form>
    </Modal>
  )
}

export default function ScheduledReports({
  onCreateReport,
  onViewReport,
  onEditReport
}: ScheduledReportsProps) {
  const [scheduleModalVisible, setScheduleModalVisible] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState<ScheduledReport | undefined>()

  const {
    scheduledReports,
    isLoading,
    isError,
    error,
    refetch
  } = useScheduledReports()

  const scheduleMutation = useScheduleReport()
  const unscheduleMutation = useUnscheduleReport()

  const handleCreateSchedule = async (scheduleData: ReportDefinition) => {
    try {
      await scheduleMutation.mutateAsync(scheduleData)
      message.success('Report scheduled successfully')
      setScheduleModalVisible(false)
      setEditingSchedule(undefined)
      refetch()
    } catch (error) {
      message.error('Failed to schedule report')
    }
  }

  const handleDeleteSchedule = async (reportId: number) => {
    try {
      await unscheduleMutation.mutateAsync(reportId)
      message.success('Scheduled report deleted successfully')
      refetch()
    } catch (error) {
      message.error('Failed to delete scheduled report')
    }
  }

  const handleToggleSchedule = async (schedule: ScheduledReport) => {
    // This would typically call an API to enable/disable the schedule
    message.info('Toggle functionality not implemented yet')
  }

  const handleRunNow = async (schedule: ScheduledReport) => {
    // This would typically trigger an immediate execution
    message.info('Run now functionality not implemented yet')
  }

  const getMenuItems = (schedule: ScheduledReport): MenuProps['items'] => [
    {
      key: 'view',
      icon: <EyeOutlined />,
      label: 'View Report',
      onClick: () => onViewReport?.(schedule.reportId)
    },
    {
      key: 'edit',
      icon: <EditOutlined />,
      label: 'Edit Schedule',
      onClick: () => {
        setEditingSchedule(schedule)
        setScheduleModalVisible(true)
      }
    },
    {
      key: 'run',
      icon: <PlayCircleOutlined />,
      label: 'Run Now',
      onClick: () => handleRunNow(schedule)
    },
    {
      key: 'toggle',
      icon: schedule.enabled ? <PauseCircleOutlined /> : <PlayCircleOutlined />,
      label: schedule.enabled ? 'Disable' : 'Enable',
      onClick: () => handleToggleSchedule(schedule)
    },
    {
      type: 'divider'
    },
    {
      key: 'delete',
      icon: <DeleteOutlined />,
      label: 'Delete',
      danger: true,
      onClick: () => {
        Modal.confirm({
          title: 'Delete Scheduled Report',
          content: `Are you sure you want to delete the scheduled report "${schedule.reportName}"?`,
          okText: 'Delete',
          okType: 'danger',
          onOk: () => handleDeleteSchedule(schedule.reportId)
        })
      }
    }
  ]

  const columns: ColumnsType<ScheduledReport> = [
    {
      title: 'Report Name',
      dataIndex: 'reportName',
      key: 'reportName',
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            ID: {record.reportId}
          </Text>
        </div>
      )
    },
    {
      title: 'Frequency',
      dataIndex: 'frequency',
      key: 'frequency',
      render: (frequency) => {
        const color = frequency === 'daily' ? 'blue' :
                     frequency === 'weekly' ? 'green' :
                     frequency === 'monthly' ? 'orange' : 'purple'
        return <Tag color={color}>{frequency}</Tag>
      }
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        if (!record.enabled) {
          return <Tag color="red" icon={<StopOutlined />}>Disabled</Tag>
        }

        const color = status === 'active' ? 'green' :
                     status === 'paused' ? 'orange' : 'red'
        const icon = status === 'active' ? <CheckCircleOutlined /> :
                    status === 'paused' ? <PauseCircleOutlined /> : <ExclamationCircleOutlined />

        return <Tag color={color} icon={icon}>{status}</Tag>
      }
    },
    {
      title: 'Next Run',
      dataIndex: 'nextRun',
      key: 'nextRun',
      render: (nextRun, record) => {
        if (!record.enabled) {
          return <Text type="secondary">-</Text>
        }

        const now = new Date()
        const next = new Date(nextRun)
        const isOverdue = next < now

        return (
          <div>
            <Text type={isOverdue ? 'danger' : undefined}>
              {next.toLocaleString()}
            </Text>
            {isOverdue && (
              <div>
                <Tag color="red" size="small">Overdue</Tag>
              </div>
            )}
          </div>
        )
      }
    },
    {
      title: 'Last Run',
      dataIndex: 'lastRun',
      key: 'lastRun',
      render: (lastRun) => lastRun ? new Date(lastRun).toLocaleString() : '-'
    },
    {
      title: 'Format',
      dataIndex: 'format',
      key: 'format',
      render: (format) => <Tag>{format?.toUpperCase()}</Tag>
    },
    {
      title: 'Recipients',
      dataIndex: 'recipients',
      key: 'recipients',
      render: (recipients) => (
        <div>
          {recipients && recipients.length > 0 ? (
            <Tooltip title={recipients.join(', ')}>
              <Tag icon={<MailOutlined />}>
                {recipients.length} recipient{recipients.length > 1 ? 's' : ''}
              </Tag>
            </Tooltip>
          ) : (
            <Tag>Dashboard only</Tag>
          )}
        </div>
      )
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 60,
      render: (_, record) => (
        <Dropdown
          menu={{ items: getMenuItems(record) }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button
            type="text"
            icon={<MoreOutlined />}
            size="small"
          />
        </Dropdown>
      )
    }
  ]

  const getScheduleStats = () => {
    const total = scheduledReports.length
    const active = scheduledReports.filter(r => r.enabled && r.status === 'active').length
    const paused = scheduledReports.filter(r => !r.enabled || r.status === 'paused').length
    const error = scheduledReports.filter(r => r.status === 'error').length

    return { total, active, paused, error }
  }

  const stats = getScheduleStats()

  if (isError) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message="Failed to load scheduled reports"
          description={error?.message || 'Unknown error occurred'}
          type="error"
          showIcon
          action={
            <Button size="small" onClick={() => refetch()}>
              Retry
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Row justify="space-between" align="middle" style={{ marginBottom: 24 }}>
          <Col>
            <Title level={3}>
              <Space>
                <CalendarOutlined />
                Scheduled Reports
              </Space>
            </Title>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<FileTextOutlined />}
                onClick={onCreateReport}
              >
                Create Report
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setScheduleModalVisible(true)}
              >
                Schedule Report
              </Button>
            </Space>
          </Col>
        </Row>

        {/* Statistics Cards */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Total Scheduled"
                value={stats.total}
                prefix={<CalendarOutlined />}
                loading={isLoading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Active"
                value={stats.active}
                prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
                loading={isLoading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Paused"
                value={stats.paused}
                prefix={<PauseCircleOutlined style={{ color: '#faad14' }} />}
                loading={isLoading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Error"
                value={stats.error}
                prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
                loading={isLoading}
              />
            </Card>
          </Col>
        </Row>

        {/* Scheduled Reports Table */}
        <Table
          dataSource={scheduledReports}
          columns={columns}
          rowKey="id"
          loading={isLoading}
          pagination={{
            total: scheduledReports.length,
            pageSize: 10,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} scheduled reports`
          }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div>
                    <Text>No scheduled reports found</Text>
                    <br />
                    <Button
                      type="link"
                      onClick={() => setScheduleModalVisible(true)}
                    >
                      Create your first scheduled report
                    </Button>
                  </div>
                }
              />
            )
          }}
        />

        {scheduledReports.length > 0 && (
          <Alert
            message="Schedule Management"
            description="You can enable/disable, edit, or delete scheduled reports using the actions menu. Reports can be run immediately using the 'Run Now' option."
            type="info"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Card>

      <ScheduleModal
        visible={scheduleModalVisible}
        onClose={() => {
          setScheduleModalVisible(false)
          setEditingSchedule(undefined)
        }}
        onSubmit={handleCreateSchedule}
        editingSchedule={editingSchedule}
        loading={scheduleMutation.isPending}
      />
    </div>
  )
}