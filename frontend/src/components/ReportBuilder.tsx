import React, { useState, useEffect } from 'react'
import {
  Card,
  Steps,
  Button,
  Form,
  Input,
  Select,
  Checkbox,
  Table,
  Space,
  Typography,
  Row,
  Col,
  Divider,
  Tag,
  Alert,
  Spin,
  message,
  DatePicker,
  Radio,
  InputNumber,
  Switch,
  Tooltip
} from 'antd'
import {
  PlusOutlined,
  DeleteOutlined,
  EyeOutlined,
  SaveOutlined,
  FileTextOutlined,
  BarChartOutlined,
  SettingOutlined,
  CalendarOutlined,
  LockOutlined,
  PlayCircleOutlined
} from '@ant-design/icons'
import type {
  ReportBuilderState,
  ReportTemplate,
  ReportQuery,
  ReportFilter,
  ReportSort,
  ResourceType,
  FilterOperator,
  ReportCategory,
  ChartType,
  AggregationType,
  ExportFormat
} from '@/types/reports'
import {
  useReportTemplates,
  useReportPreview,
  useGenerateReport,
  useScheduleReport
} from '@/hooks/useReports'

const { Title, Text } = Typography
const { Option } = Select
const { TextArea } = Input
const { RangePicker } = DatePicker

interface ReportBuilderProps {
  onReportCreated?: (reportId: number) => void
  templateId?: string
  initialData?: Partial<ReportBuilderState['configuration']>
}

const steps = [
  {
    title: 'Data Source',
    description: 'Select resource types and fields',
    icon: <FileTextOutlined />
  },
  {
    title: 'Filters',
    description: 'Add filters and conditions',
    icon: <SettingOutlined />
  },
  {
    title: 'Grouping & Sorting',
    description: 'Configure data organization',
    icon: <BarChartOutlined />
  },
  {
    title: 'Visualization',
    description: 'Choose how to display data',
    icon: <EyeOutlined />
  },
  {
    title: 'Schedule',
    description: 'Set up automatic generation',
    icon: <CalendarOutlined />
  },
  {
    title: 'Permissions',
    description: 'Configure access control',
    icon: <LockOutlined />
  }
]

const resourceTypeOptions: { value: ResourceType; label: string }[] = [
  { value: 'vpc', label: 'VPCs' },
  { value: 'subnet', label: 'Subnets' },
  { value: 'transitGateway', label: 'Transit Gateways' },
  { value: 'customerGateway', label: 'Customer Gateways' },
  { value: 'vpcEndpoint', label: 'VPC Endpoints' }
]

const availableFields: Record<ResourceType, string[]> = {
  vpc: ['name', 'vpc_id', 'cidr_block', 'region', 'state', 'provider', 'created_at'],
  subnet: ['name', 'subnet_id', 'vpc_id', 'cidr_block', 'availability_zone', 'state'],
  transitGateway: ['name', 'transit_gateway_id', 'state', 'region', 'amazon_side_asn'],
  customerGateway: ['name', 'customer_gateway_id', 'state', 'type', 'bgp_asn'],
  vpcEndpoint: ['name', 'vpc_endpoint_id', 'service_name', 'vpc_id', 'state', 'type']
}

const filterOperatorOptions: { value: FilterOperator; label: string }[] = [
  { value: 'eq', label: 'Equals' },
  { value: 'ne', label: 'Not Equals' },
  { value: 'gt', label: 'Greater Than' },
  { value: 'gte', label: 'Greater Than or Equal' },
  { value: 'lt', label: 'Less Than' },
  { value: 'lte', label: 'Less Than or Equal' },
  { value: 'in', label: 'In' },
  { value: 'nin', label: 'Not In' },
  { value: 'contains', label: 'Contains' },
  { value: 'startsWith', label: 'Starts With' },
  { value: 'endsWith', label: 'Ends With' }
]

const chartTypeOptions: { value: ChartType; label: string }[] = [
  { value: 'bar', label: 'Bar Chart' },
  { value: 'line', label: 'Line Chart' },
  { value: 'pie', label: 'Pie Chart' },
  { value: 'donut', label: 'Donut Chart' },
  { value: 'area', label: 'Area Chart' }
]

const aggregationOptions: { value: AggregationType; label: string }[] = [
  { value: 'count', label: 'Count' },
  { value: 'sum', label: 'Sum' },
  { value: 'avg', label: 'Average' },
  { value: 'min', label: 'Minimum' },
  { value: 'max', label: 'Maximum' },
  { value: 'distinct', label: 'Distinct Count' }
]

export default function ReportBuilder({
  onReportCreated,
  templateId,
  initialData
}: ReportBuilderProps) {
  const [form] = Form.useForm()
  const [currentStep, setCurrentStep] = useState(0)
  const [builderState, setBuilderState] = useState<ReportBuilderState>({
    step: 'datasource',
    configuration: {
      ...initialData,
      permissions: {
        isPublic: false,
        owner: 1, // Will be set from auth context
        viewers: [],
        editors: []
      }
    },
    isValid: false,
    validationErrors: []
  })

  const { templates, isLoading: templatesLoading } = useReportTemplates()
  const previewMutation = useReportPreview()
  const generateMutation = useGenerateReport()
  const scheduleMutation = useScheduleReport()

  // Load template if templateId is provided
  useEffect(() => {
    if (templateId && templates) {
      const template = templates.find(t => t.id === templateId)
      if (template) {
        setBuilderState(prev => ({
          ...prev,
          configuration: {
            ...prev.configuration,
            name: template.name,
            description: template.description,
            category: template.category,
            query: {
              resourceTypes: ['vpc'], // Default, user can change
              fields: template.fields,
              filters: template.defaultFilters,
              orderBy: template.defaultSorting,
              groupBy: template.defaultGrouping
            }
          }
        }))
      }
    }
  }, [templateId, templates])

  const validateCurrentStep = () => {
    const { configuration } = builderState
    const errors: string[] = []

    switch (currentStep) {
      case 0: // Data Source
        if (!configuration.query?.resourceTypes?.length) {
          errors.push('Please select at least one resource type')
        }
        if (!configuration.query?.fields?.length) {
          errors.push('Please select at least one field')
        }
        break
      case 1: // Filters (optional)
        break
      case 2: // Grouping & Sorting (optional)
        break
      case 3: // Visualization
        if (!configuration.name) {
          errors.push('Please enter a report name')
        }
        break
      case 4: // Schedule (optional)
        break
      case 5: // Permissions (optional)
        break
    }

    setBuilderState(prev => ({
      ...prev,
      isValid: errors.length === 0,
      validationErrors: errors
    }))

    return errors.length === 0
  }

  const handleNext = () => {
    if (validateCurrentStep()) {
      const nextStep = Math.min(currentStep + 1, steps.length - 1)
      setCurrentStep(nextStep)
      setBuilderState(prev => ({
        ...prev,
        step: steps[nextStep].title.toLowerCase().replace(/[^a-z]/g, '') as any
      }))
    }
  }

  const handlePrev = () => {
    const prevStep = Math.max(currentStep - 1, 0)
    setCurrentStep(prevStep)
    setBuilderState(prev => ({
      ...prev,
      step: steps[prevStep].title.toLowerCase().replace(/[^a-z]/g, '') as any
    }))
  }

  const handlePreview = async () => {
    if (!builderState.configuration.query) {
      message.error('Please configure the query first')
      return
    }

    try {
      const result = await previewMutation.mutateAsync(builderState.configuration.query)
      setBuilderState(prev => ({
        ...prev,
        preview: result
      }))
      message.success('Preview generated successfully')
    } catch (error) {
      message.error('Failed to generate preview')
    }
  }

  const handleSave = async () => {
    if (!validateCurrentStep()) return

    try {
      const reportDefinition = {
        name: builderState.configuration.name!,
        description: builderState.configuration.description,
        category: builderState.configuration.category || 'custom' as ReportCategory,
        query: builderState.configuration.query!,
        visualization: builderState.configuration.visualization,
        schedule: builderState.configuration.schedule,
        permissions: builderState.configuration.permissions!
      }

      if (builderState.configuration.schedule?.enabled) {
        await scheduleMutation.mutateAsync(reportDefinition)
        message.success('Report scheduled successfully')
      } else {
        const result = await generateMutation.mutateAsync(builderState.configuration.query!)
        message.success('Report generated successfully')
      }

      onReportCreated?.(1) // Mock ID
    } catch (error) {
      message.error('Failed to save report')
    }
  }

  const updateConfiguration = (updates: Partial<typeof builderState.configuration>) => {
    setBuilderState(prev => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        ...updates
      }
    }))
  }

  const addFilter = () => {
    const newFilter: ReportFilter = {
      field: '',
      operator: 'eq',
      value: '',
      logicalOperator: 'AND'
    }

    updateConfiguration({
      query: {
        ...builderState.configuration.query!,
        filters: [...(builderState.configuration.query?.filters || []), newFilter]
      }
    })
  }

  const removeFilter = (index: number) => {
    const filters = [...(builderState.configuration.query?.filters || [])]
    filters.splice(index, 1)

    updateConfiguration({
      query: {
        ...builderState.configuration.query!,
        filters
      }
    })
  }

  const updateFilter = (index: number, updates: Partial<ReportFilter>) => {
    const filters = [...(builderState.configuration.query?.filters || [])]
    filters[index] = { ...filters[index], ...updates }

    updateConfiguration({
      query: {
        ...builderState.configuration.query!,
        filters
      }
    })
  }

  const renderDataSourceStep = () => (
    <Card title="Configure Data Source" size="small">
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Form.Item label="Resource Types" required>
            <Select
              mode="multiple"
              placeholder="Select resource types"
              value={builderState.configuration.query?.resourceTypes}
              onChange={(resourceTypes) => updateConfiguration({
                query: { ...builderState.configuration.query!, resourceTypes }
              })}
            >
              {resourceTypeOptions.map(option => (
                <Option key={option.value} value={option.value}>
                  {option.label}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </Col>
        <Col span={12}>
          <Form.Item label="Fields" required>
            <Select
              mode="multiple"
              placeholder="Select fields to include"
              value={builderState.configuration.query?.fields}
              onChange={(fields) => updateConfiguration({
                query: { ...builderState.configuration.query!, fields }
              })}
              disabled={!builderState.configuration.query?.resourceTypes?.length}
            >
              {builderState.configuration.query?.resourceTypes?.flatMap(type =>
                availableFields[type]?.map(field => (
                  <Option key={`${type}-${field}`} value={field}>
                    {field}
                  </Option>
                ))
              )}
            </Select>
          </Form.Item>
        </Col>
      </Row>

      {templates && templates.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Divider>Or choose from a template</Divider>
          <Select
            placeholder="Select a template"
            style={{ width: '100%' }}
            onChange={(templateId) => {
              const template = templates.find(t => t.id === templateId)
              if (template) {
                updateConfiguration({
                  name: template.name,
                  description: template.description,
                  category: template.category,
                  query: {
                    resourceTypes: ['vpc'], // Default
                    fields: template.fields,
                    filters: template.defaultFilters,
                    orderBy: template.defaultSorting,
                    groupBy: template.defaultGrouping
                  }
                })
              }
            }}
          >
            {templates.map(template => (
              <Option key={template.id} value={template.id}>
                <Space>
                  <Tag color="blue">{template.category}</Tag>
                  {template.name}
                </Space>
              </Option>
            ))}
          </Select>
        </div>
      )}
    </Card>
  )

  const renderFiltersStep = () => (
    <Card
      title="Configure Filters"
      size="small"
      extra={
        <Button type="dashed" icon={<PlusOutlined />} onClick={addFilter}>
          Add Filter
        </Button>
      }
    >
      {builderState.configuration.query?.filters?.map((filter, index) => (
        <Card key={index} size="small" style={{ marginBottom: 8 }}>
          <Row gutter={[8, 8]} align="middle">
            <Col span={5}>
              <Select
                placeholder="Field"
                value={filter.field}
                onChange={(field) => updateFilter(index, { field })}
                style={{ width: '100%' }}
              >
                {builderState.configuration.query?.resourceTypes?.flatMap(type =>
                  availableFields[type]?.map(field => (
                    <Option key={`${type}-${field}`} value={field}>
                      {field}
                    </Option>
                  ))
                )}
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="Operator"
                value={filter.operator}
                onChange={(operator) => updateFilter(index, { operator })}
                style={{ width: '100%' }}
              >
                {filterOperatorOptions.map(option => (
                  <Option key={option.value} value={option.value}>
                    {option.label}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col span={6}>
              <Input
                placeholder="Value"
                value={filter.value}
                onChange={(e) => updateFilter(index, { value: e.target.value })}
              />
            </Col>
            <Col span={3}>
              <Select
                value={filter.logicalOperator}
                onChange={(logicalOperator) => updateFilter(index, { logicalOperator })}
                style={{ width: '100%' }}
              >
                <Option value="AND">AND</Option>
                <Option value="OR">OR</Option>
                <Option value="NOT">NOT</Option>
              </Select>
            </Col>
            <Col span={2}>
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                onClick={() => removeFilter(index)}
              />
            </Col>
          </Row>
        </Card>
      ))}

      {(!builderState.configuration.query?.filters || builderState.configuration.query.filters.length === 0) && (
        <Alert
          message="No filters configured"
          description="Add filters to narrow down your data selection. This is optional."
          type="info"
          showIcon
        />
      )}
    </Card>
  )

  const renderGroupingSortingStep = () => (
    <Row gutter={[16, 16]}>
      <Col span={12}>
        <Card title="Grouping" size="small">
          <Select
            mode="multiple"
            placeholder="Group by fields"
            value={builderState.configuration.query?.groupBy}
            onChange={(groupBy) => updateConfiguration({
              query: { ...builderState.configuration.query!, groupBy }
            })}
            style={{ width: '100%' }}
          >
            {builderState.configuration.query?.fields?.map(field => (
              <Option key={field} value={field}>
                {field}
              </Option>
            ))}
          </Select>
        </Card>
      </Col>
      <Col span={12}>
        <Card title="Sorting" size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            {builderState.configuration.query?.orderBy?.map((sort, index) => (
              <Row key={index} gutter={[8, 8]}>
                <Col span={16}>
                  <Select
                    placeholder="Sort field"
                    value={sort.field}
                    onChange={(field) => {
                      const orderBy = [...(builderState.configuration.query?.orderBy || [])]
                      orderBy[index] = { ...orderBy[index], field }
                      updateConfiguration({
                        query: { ...builderState.configuration.query!, orderBy }
                      })
                    }}
                    style={{ width: '100%' }}
                  >
                    {builderState.configuration.query?.fields?.map(field => (
                      <Option key={field} value={field}>
                        {field}
                      </Option>
                    ))}
                  </Select>
                </Col>
                <Col span={6}>
                  <Select
                    value={sort.direction}
                    onChange={(direction) => {
                      const orderBy = [...(builderState.configuration.query?.orderBy || [])]
                      orderBy[index] = { ...orderBy[index], direction }
                      updateConfiguration({
                        query: { ...builderState.configuration.query!, orderBy }
                      })
                    }}
                    style={{ width: '100%' }}
                  >
                    <Option value="ASC">ASC</Option>
                    <Option value="DESC">DESC</Option>
                  </Select>
                </Col>
                <Col span={2}>
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => {
                      const orderBy = [...(builderState.configuration.query?.orderBy || [])]
                      orderBy.splice(index, 1)
                      updateConfiguration({
                        query: { ...builderState.configuration.query!, orderBy }
                      })
                    }}
                  />
                </Col>
              </Row>
            ))}
            <Button
              type="dashed"
              icon={<PlusOutlined />}
              onClick={() => {
                const orderBy = [...(builderState.configuration.query?.orderBy || [])]
                orderBy.push({ field: '', direction: 'ASC' })
                updateConfiguration({
                  query: { ...builderState.configuration.query!, orderBy }
                })
              }}
              style={{ width: '100%' }}
            >
              Add Sort Field
            </Button>
          </Space>
        </Card>
      </Col>
    </Row>
  )

  const renderVisualizationStep = () => (
    <Row gutter={[16, 16]}>
      <Col span={12}>
        <Card title="Report Details" size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Form.Item label="Report Name" required>
              <Input
                placeholder="Enter report name"
                value={builderState.configuration.name}
                onChange={(e) => updateConfiguration({ name: e.target.value })}
              />
            </Form.Item>
            <Form.Item label="Description">
              <TextArea
                placeholder="Enter report description"
                value={builderState.configuration.description}
                onChange={(e) => updateConfiguration({ description: e.target.value })}
                rows={3}
              />
            </Form.Item>
            <Form.Item label="Category">
              <Select
                placeholder="Select category"
                value={builderState.configuration.category}
                onChange={(category) => updateConfiguration({ category })}
              >
                <Option value="inventory">Inventory</Option>
                <Option value="compliance">Compliance</Option>
                <Option value="utilization">Utilization</Option>
                <Option value="security">Security</Option>
                <Option value="custom">Custom</Option>
              </Select>
            </Form.Item>
          </Space>
        </Card>
      </Col>
      <Col span={12}>
        <Card title="Visualization Options" size="small">
          <Space direction="vertical" style={{ width: '100%' }}>
            <Form.Item label="Display Type">
              <Radio.Group
                value={builderState.configuration.visualization?.type || 'table'}
                onChange={(e) => updateConfiguration({
                  visualization: {
                    ...builderState.configuration.visualization,
                    type: e.target.value
                  }
                })}
              >
                <Radio value="table">Table Only</Radio>
                <Radio value="chart">Chart Only</Radio>
                <Radio value="both">Table + Chart</Radio>
              </Radio.Group>
            </Form.Item>

            {(builderState.configuration.visualization?.type === 'chart' ||
              builderState.configuration.visualization?.type === 'both') && (
              <>
                <Form.Item label="Chart Type">
                  <Select
                    placeholder="Select chart type"
                    value={builderState.configuration.visualization?.chart?.type}
                    onChange={(type) => updateConfiguration({
                      visualization: {
                        ...builderState.configuration.visualization,
                        chart: {
                          ...builderState.configuration.visualization?.chart,
                          type,
                          title: builderState.configuration.name || 'Chart',
                          dataSource: 'query',
                          aggregation: 'count'
                        }
                      }
                    })}
                  >
                    {chartTypeOptions.map(option => (
                      <Option key={option.value} value={option.value}>
                        {option.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item label="Aggregation">
                  <Select
                    placeholder="Select aggregation"
                    value={builderState.configuration.visualization?.chart?.aggregation}
                    onChange={(aggregation) => updateConfiguration({
                      visualization: {
                        ...builderState.configuration.visualization,
                        chart: {
                          ...builderState.configuration.visualization?.chart!,
                          aggregation
                        }
                      }
                    })}
                  >
                    {aggregationOptions.map(option => (
                      <Option key={option.value} value={option.value}>
                        {option.label}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item label="Group By Field">
                  <Select
                    placeholder="Select field to group by"
                    value={builderState.configuration.visualization?.chart?.groupBy}
                    onChange={(groupBy) => updateConfiguration({
                      visualization: {
                        ...builderState.configuration.visualization,
                        chart: {
                          ...builderState.configuration.visualization?.chart!,
                          groupBy
                        }
                      }
                    })}
                  >
                    {builderState.configuration.query?.fields?.map(field => (
                      <Option key={field} value={field}>
                        {field}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>
              </>
            )}
          </Space>
        </Card>
      </Col>
    </Row>
  )

  const renderScheduleStep = () => (
    <Card title="Schedule Configuration" size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Form.Item>
          <Checkbox
            checked={builderState.configuration.schedule?.enabled}
            onChange={(e) => updateConfiguration({
              schedule: {
                ...builderState.configuration.schedule,
                enabled: e.target.checked,
                frequency: 'daily',
                timezone: 'UTC',
                delivery: {
                  method: ['dashboard'],
                  email: {
                    recipients: [],
                    formats: ['pdf'],
                    includeCharts: true
                  }
                }
              }
            })}
          >
            Enable automatic scheduling
          </Checkbox>
        </Form.Item>

        {builderState.configuration.schedule?.enabled && (
          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Form.Item label="Frequency">
                <Select
                  value={builderState.configuration.schedule?.frequency}
                  onChange={(frequency) => updateConfiguration({
                    schedule: {
                      ...builderState.configuration.schedule!,
                      frequency
                    }
                  })}
                >
                  <Option value="daily">Daily</Option>
                  <Option value="weekly">Weekly</Option>
                  <Option value="monthly">Monthly</Option>
                  <Option value="quarterly">Quarterly</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Start Date">
                <DatePicker
                  value={builderState.configuration.schedule?.startDate ?
                    new Date(builderState.configuration.schedule.startDate) : undefined}
                  onChange={(date) => updateConfiguration({
                    schedule: {
                      ...builderState.configuration.schedule!,
                      startDate: date?.toDate()
                    }
                  })}
                  style={{ width: '100%' }}
                />
              </Form.Item>
            </Col>
          </Row>
        )}
      </Space>
    </Card>
  )

  const renderPermissionsStep = () => (
    <Card title="Access Control" size="small">
      <Space direction="vertical" style={{ width: '100%' }}>
        <Form.Item>
          <Checkbox
            checked={builderState.configuration.permissions?.isPublic}
            onChange={(e) => updateConfiguration({
              permissions: {
                ...builderState.configuration.permissions!,
                isPublic: e.target.checked
              }
            })}
          >
            Make this report public
          </Checkbox>
        </Form.Item>

        {!builderState.configuration.permissions?.isPublic && (
          <Alert
            message="Private Report"
            description="This report will only be accessible to specified users and groups."
            type="info"
            showIcon
          />
        )}
      </Space>
    </Card>
  )

  const renderPreview = () => (
    <Card
      title="Preview"
      size="small"
      extra={
        <Space>
          <Button
            icon={<PlayCircleOutlined />}
            onClick={handlePreview}
            loading={previewMutation.isPending}
          >
            Generate Preview
          </Button>
        </Space>
      }
    >
      {builderState.preview ? (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Text strong>Records:</Text>
            <Tag color="blue">{builderState.preview.totalCount}</Tag>
            <Text strong>Execution Time:</Text>
            <Tag color="green">{builderState.preview.executionTime}ms</Tag>
          </Space>

          <Table
            dataSource={builderState.preview.data.slice(0, 10)}
            columns={builderState.configuration.query?.fields?.map(field => ({
              title: field,
              dataIndex: field,
              key: field
            }))}
            pagination={false}
            size="small"
            scroll={{ x: true }}
          />

          {builderState.preview.data.length > 10 && (
            <Alert
              message={`Showing first 10 of ${builderState.preview.totalCount} records`}
              type="info"
              style={{ marginTop: 8 }}
            />
          )}
        </div>
      ) : (
        <Alert
          message="No preview available"
          description="Click 'Generate Preview' to see a sample of your report data."
          type="info"
          showIcon
        />
      )}
    </Card>
  )

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return renderDataSourceStep()
      case 1:
        return renderFiltersStep()
      case 2:
        return renderGroupingSortingStep()
      case 3:
        return renderVisualizationStep()
      case 4:
        return renderScheduleStep()
      case 5:
        return renderPermissionsStep()
      default:
        return null
    }
  }

  if (templatesLoading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Loading templates...</div>
        </div>
      </Card>
    )
  }

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Title level={3}>
          <Space>
            <FileTextOutlined />
            Report Builder
          </Space>
        </Title>

        <Steps
          current={currentStep}
          items={steps}
          style={{ marginBottom: 24 }}
        />

        {builderState.validationErrors.length > 0 && (
          <Alert
            message="Validation Errors"
            description={
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {builderState.validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            }
            type="error"
            closable
            style={{ marginBottom: 16 }}
          />
        )}

        <Row gutter={[24, 24]}>
          <Col span={16}>
            {renderStepContent()}
          </Col>
          <Col span={8}>
            {renderPreview()}
          </Col>
        </Row>

        <Divider />

        <Row justify="space-between">
          <Col>
            <Space>
              <Button
                onClick={handlePrev}
                disabled={currentStep === 0}
              >
                Previous
              </Button>
              <Button
                type="primary"
                onClick={handleNext}
                disabled={currentStep === steps.length - 1 || !builderState.isValid}
              >
                Next
              </Button>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<EyeOutlined />}
                onClick={handlePreview}
                loading={previewMutation.isPending}
              >
                Preview
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={generateMutation.isPending || scheduleMutation.isPending}
                disabled={!builderState.isValid}
              >
                {builderState.configuration.schedule?.enabled ? 'Schedule Report' : 'Generate Report'}
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>
    </div>
  )
}