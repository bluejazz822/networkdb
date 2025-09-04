/**
 * Report Builder Component
 * Drag-and-drop interface for creating custom reports
 */

import React, { useState, useCallback } from 'react';
import { 
  Layout, 
  Steps, 
  Card, 
  Form, 
  Input, 
  Select, 
  Button, 
  Space, 
  Divider,
  message,
  Row,
  Col,
  Typography,
  Tag,
  Alert
} from 'antd';
import { 
  PlusOutlined, 
  DeleteOutlined, 
  EyeOutlined, 
  SaveOutlined,
  ArrowLeftOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import { 
  ReportBuilder as ReportBuilderConfig,
  ReportQuery,
  ReportFilter,
  ReportSort,
  ReportVisualization,
  BuilderStep,
  ReportCategory,
  ChartType
} from '../../types/reports';
import { ResourceType } from '../../types';
import { ReportsApiService } from '../../services/reportsApi';

const { Content, Sider } = Layout;
const { Title, Text } = Typography;
const { Option } = Select;

interface ReportBuilderProps {
  initialConfig?: ReportBuilderConfig;
  onSave?: (config: ReportBuilderConfig) => void;
  onCancel?: () => void;
}

const STEPS: { key: BuilderStep; title: string; description: string }[] = [
  { key: 'datasource', title: 'Data Source', description: 'Select resources and fields' },
  { key: 'filters', title: 'Filters', description: 'Add data filters' },
  { key: 'grouping', title: 'Grouping', description: 'Group and sort data' },
  { key: 'visualization', title: 'Visualization', description: 'Choose display format' },
  { key: 'schedule', title: 'Schedule', description: 'Set automation' },
  { key: 'permissions', title: 'Permissions', description: 'Share settings' }
];

const RESOURCE_TYPES: { value: ResourceType; label: string }[] = [
  { value: 'vpc', label: 'VPCs' },
  { value: 'transitGateway', label: 'Transit Gateways' },
  { value: 'customerGateway', label: 'Customer Gateways' },
  { value: 'vpcEndpoint', label: 'VPC Endpoints' }
];

const AVAILABLE_FIELDS: Record<ResourceType, { value: string; label: string; type: string }[]> = {
  vpc: [
    { value: 'vpc_id', label: 'VPC ID', type: 'string' },
    { value: 'cidr_block', label: 'CIDR Block', type: 'string' },
    { value: 'state', label: 'State', type: 'string' },
    { value: 'region', label: 'Region', type: 'string' },
    { value: 'created_at', label: 'Created At', type: 'date' },
    { value: 'updated_at', label: 'Updated At', type: 'date' }
  ],
  transitGateway: [
    { value: 'transit_gateway_id', label: 'Transit Gateway ID', type: 'string' },
    { value: 'state', label: 'State', type: 'string' },
    { value: 'region', label: 'Region', type: 'string' },
    { value: 'created_at', label: 'Created At', type: 'date' }
  ],
  customerGateway: [
    { value: 'customer_gateway_id', label: 'Customer Gateway ID', type: 'string' },
    { value: 'state', label: 'State', type: 'string' },
    { value: 'type', label: 'Type', type: 'string' },
    { value: 'created_at', label: 'Created At', type: 'date' }
  ],
  vpcEndpoint: [
    { value: 'vpc_endpoint_id', label: 'VPC Endpoint ID', type: 'string' },
    { value: 'service_name', label: 'Service Name', type: 'string' },
    { value: 'state', label: 'State', type: 'string' },
    { value: 'created_at', label: 'Created At', type: 'date' }
  ]
};

export const ReportBuilder: React.FC<ReportBuilderProps> = ({
  initialConfig,
  onSave,
  onCancel
}) => {
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [config, setConfig] = useState<ReportBuilderConfig>(() => ({
    step: 'datasource',
    configuration: {
      name: '',
      description: '',
      category: 'custom',
      datasource: {
        resourceTypes: [],
        fields: []
      }
    },
    ...initialConfig
  }));
  
  const [form] = Form.useForm();
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const updateConfig = useCallback((updates: Partial<ReportBuilderConfig['configuration']>) => {
    setConfig(prev => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        ...updates
      }
    }));
  }, []);

  const handleStepChange = (step: number) => {
    if (step >= 0 && step < STEPS.length) {
      setCurrentStep(step);
      setConfig(prev => ({
        ...prev,
        step: STEPS[step].key
      }));
    }
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      handleStepChange(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      handleStepChange(currentStep - 1);
    }
  };

  const handlePreview = async () => {
    if (!config.configuration.datasource) {
      message.error('Please configure data source first');
      return;
    }

    setPreviewLoading(true);
    try {
      const result = await ReportsApiService.generateReportPreview(config.configuration.datasource);
      if (result.success) {
        setPreviewData(result.data);
      } else {
        message.error(result.errors?.[0]?.message || 'Failed to generate preview');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to generate preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSave = () => {
    if (!config.configuration.name) {
      message.error('Please enter a report name');
      return;
    }

    if (!config.configuration.datasource?.resourceTypes?.length) {
      message.error('Please select at least one resource type');
      return;
    }

    if (!config.configuration.datasource?.fields?.length) {
      message.error('Please select at least one field');
      return;
    }

    if (onSave) {
      onSave(config);
    }
  };

  const renderDataSourceStep = () => (
    <Card title="Data Source Configuration" style={{ marginBottom: 16 }}>
      <Form layout="vertical" form={form}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="Report Name" required>
              <Input
                value={config.configuration.name}
                onChange={(e) => updateConfig({ name: e.target.value })}
                placeholder="Enter report name"
              />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="Category">
              <Select
                value={config.configuration.category}
                onChange={(value) => updateConfig({ category: value })}
              >
                <Option value="inventory">Inventory</Option>
                <Option value="compliance">Compliance</Option>
                <Option value="performance">Performance</Option>
                <Option value="security">Security</Option>
                <Option value="utilization">Utilization</Option>
                <Option value="custom">Custom</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item label="Description">
          <Input.TextArea
            rows={3}
            value={config.configuration.description}
            onChange={(e) => updateConfig({ description: e.target.value })}
            placeholder="Enter report description"
          />
        </Form.Item>

        <Form.Item label="Resource Types" required>
          <Select
            mode="multiple"
            value={config.configuration.datasource?.resourceTypes}
            onChange={(value) => updateConfig({
              datasource: {
                ...config.configuration.datasource!,
                resourceTypes: value
              }
            })}
            placeholder="Select resource types"
          >
            {RESOURCE_TYPES.map(type => (
              <Option key={type.value} value={type.value}>
                {type.label}
              </Option>
            ))}
          </Select>
        </Form.Item>

        <Form.Item label="Fields" required>
          <Select
            mode="multiple"
            value={config.configuration.datasource?.fields}
            onChange={(value) => updateConfig({
              datasource: {
                ...config.configuration.datasource!,
                fields: value
              }
            })}
            placeholder="Select fields to include"
          >
            {config.configuration.datasource?.resourceTypes?.map(resourceType => 
              AVAILABLE_FIELDS[resourceType]?.map(field => (
                <Option key={`${resourceType}_${field.value}`} value={field.value}>
                  <Space>
                    <Tag size="small">{resourceType}</Tag>
                    {field.label}
                  </Space>
                </Option>
              ))
            )}
          </Select>
        </Form.Item>

        <Form.Item label="Row Limit">
          <Input
            type="number"
            min={1}
            max={10000}
            value={config.configuration.datasource?.limit}
            onChange={(e) => updateConfig({
              datasource: {
                ...config.configuration.datasource!,
                limit: parseInt(e.target.value) || undefined
              }
            })}
            placeholder="Leave empty for no limit"
          />
        </Form.Item>
      </Form>
    </Card>
  );

  const renderFiltersStep = () => (
    <Card title="Filters Configuration" style={{ marginBottom: 16 }}>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Add filters to narrow down your data
      </Text>

      <Button 
        type="dashed" 
        icon={<PlusOutlined />} 
        style={{ width: '100%', marginBottom: 16 }}
        onClick={() => {
          const newFilter: ReportFilter = {
            field: '',
            operator: 'equals',
            value: ''
          };
          updateConfig({
            datasource: {
              ...config.configuration.datasource!,
              filters: [...(config.configuration.datasource?.filters || []), newFilter]
            }
          });
        }}
      >
        Add Filter
      </Button>

      {config.configuration.datasource?.filters?.map((filter, index) => (
        <Card 
          key={index} 
          size="small" 
          style={{ marginBottom: 8 }}
          extra={
            <Button 
              size="small" 
              icon={<DeleteOutlined />} 
              onClick={() => {
                const filters = [...(config.configuration.datasource?.filters || [])];
                filters.splice(index, 1);
                updateConfig({
                  datasource: {
                    ...config.configuration.datasource!,
                    filters
                  }
                });
              }}
            />
          }
        >
          <Row gutter={8}>
            <Col span={8}>
              <Select
                size="small"
                value={filter.field}
                onChange={(value) => {
                  const filters = [...(config.configuration.datasource?.filters || [])];
                  filters[index] = { ...filters[index], field: value };
                  updateConfig({
                    datasource: {
                      ...config.configuration.datasource!,
                      filters
                    }
                  });
                }}
                placeholder="Field"
                style={{ width: '100%' }}
              >
                {config.configuration.datasource?.resourceTypes?.map(resourceType => 
                  AVAILABLE_FIELDS[resourceType]?.map(field => (
                    <Option key={field.value} value={field.value}>
                      {field.label}
                    </Option>
                  ))
                )}
              </Select>
            </Col>
            <Col span={8}>
              <Select
                size="small"
                value={filter.operator}
                onChange={(value) => {
                  const filters = [...(config.configuration.datasource?.filters || [])];
                  filters[index] = { ...filters[index], operator: value };
                  updateConfig({
                    datasource: {
                      ...config.configuration.datasource!,
                      filters
                    }
                  });
                }}
                style={{ width: '100%' }}
              >
                <Option value="equals">Equals</Option>
                <Option value="not_equals">Not Equals</Option>
                <Option value="like">Contains</Option>
                <Option value="starts_with">Starts With</Option>
                <Option value="ends_with">Ends With</Option>
                <Option value="greater_than">Greater Than</Option>
                <Option value="less_than">Less Than</Option>
                <Option value="exists">Exists</Option>
                <Option value="not_exists">Does Not Exist</Option>
              </Select>
            </Col>
            <Col span={8}>
              <Input
                size="small"
                value={filter.value}
                onChange={(e) => {
                  const filters = [...(config.configuration.datasource?.filters || [])];
                  filters[index] = { ...filters[index], value: e.target.value };
                  updateConfig({
                    datasource: {
                      ...config.configuration.datasource!,
                      filters
                    }
                  });
                }}
                placeholder="Value"
              />
            </Col>
          </Row>
        </Card>
      ))}

      {(!config.configuration.datasource?.filters || config.configuration.datasource.filters.length === 0) && (
        <Alert
          message="No filters configured"
          description="Your report will include all data from selected resources. Add filters to narrow down results."
          type="info"
          showIcon
        />
      )}
    </Card>
  );

  const renderVisualizationStep = () => (
    <Card title="Visualization Configuration" style={{ marginBottom: 16 }}>
      <Form layout="vertical">
        <Form.Item label="Display Type">
          <Select
            value={config.configuration.visualization?.type || 'table'}
            onChange={(value) => updateConfig({
              visualization: {
                ...config.configuration.visualization,
                type: value,
                layout: value === 'both' ? 'vertical' : undefined
              }
            })}
          >
            <Option value="table">Table Only</Option>
            <Option value="chart">Chart Only</Option>
            <Option value="both">Table and Chart</Option>
          </Select>
        </Form.Item>

        {(config.configuration.visualization?.type === 'chart' || 
          config.configuration.visualization?.type === 'both') && (
          <>
            <Form.Item label="Chart Type">
              <Select
                value={config.configuration.visualization?.chart?.type || 'bar'}
                onChange={(value: ChartType) => updateConfig({
                  visualization: {
                    ...config.configuration.visualization,
                    chart: {
                      ...config.configuration.visualization?.chart,
                      type: value,
                      title: config.configuration.name || 'Report Chart',
                      dataSource: config.configuration.datasource?.resourceTypes?.[0] || 'vpc',
                      aggregation: 'count'
                    }
                  }
                })}
              >
                <Option value="bar">Bar Chart</Option>
                <Option value="line">Line Chart</Option>
                <Option value="pie">Pie Chart</Option>
                <Option value="donut">Donut Chart</Option>
                <Option value="area">Area Chart</Option>
                <Option value="gauge">Gauge Chart</Option>
              </Select>
            </Form.Item>

            <Form.Item label="Group By Field">
              <Select
                value={config.configuration.visualization?.chart?.groupBy}
                onChange={(value) => updateConfig({
                  visualization: {
                    ...config.configuration.visualization,
                    chart: {
                      ...config.configuration.visualization?.chart!,
                      groupBy: value
                    }
                  }
                })}
                placeholder="Select field to group by"
              >
                {config.configuration.datasource?.fields?.map(field => (
                  <Option key={field} value={field}>
                    {field}
                  </Option>
                ))}
              </Select>
            </Form.Item>
          </>
        )}
      </Form>
    </Card>
  );

  const renderCurrentStep = () => {
    switch (STEPS[currentStep].key) {
      case 'datasource':
        return renderDataSourceStep();
      case 'filters':
        return renderFiltersStep();
      case 'grouping':
        return (
          <Card title="Grouping & Sorting" style={{ marginBottom: 16 }}>
            <Alert
              message="Coming Soon"
              description="Grouping and sorting configuration will be available in the next version."
              type="info"
            />
          </Card>
        );
      case 'visualization':
        return renderVisualizationStep();
      case 'schedule':
        return (
          <Card title="Schedule Configuration" style={{ marginBottom: 16 }}>
            <Alert
              message="Coming Soon"
              description="Report scheduling will be available in the next version."
              type="info"
            />
          </Card>
        );
      case 'permissions':
        return (
          <Card title="Permissions & Sharing" style={{ marginBottom: 16 }}>
            <Alert
              message="Coming Soon"
              description="Permission and sharing settings will be available in the next version."
              type="info"
            />
          </Card>
        );
      default:
        return null;
    }
  };

  return (
    <Layout>
      <Sider width={250} theme="light" style={{ padding: 16 }}>
        <Title level={4}>Report Builder</Title>
        <Steps 
          direction="vertical" 
          current={currentStep} 
          size="small"
          onChange={handleStepChange}
        >
          {STEPS.map((step, index) => (
            <Steps.Step 
              key={step.key}
              title={step.title} 
              description={step.description}
              style={{ cursor: 'pointer' }}
            />
          ))}
        </Steps>
      </Sider>

      <Content style={{ padding: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <Title level={3}>
            {STEPS[currentStep].title}
          </Title>
          <Text type="secondary">
            {STEPS[currentStep].description}
          </Text>
        </div>

        {renderCurrentStep()}

        {previewData && (
          <Card title="Preview" style={{ marginBottom: 16 }}>
            <Text>
              Showing {previewData.data?.length || 0} of {previewData.totalCount || 0} records
              {previewData.executionTime && ` (${previewData.executionTime}ms)`}
            </Text>
            {previewData.warnings?.map((warning: string, index: number) => (
              <Alert
                key={index}
                message={warning}
                type="warning"
                showIcon
                style={{ marginTop: 8 }}
              />
            ))}
          </Card>
        )}

        <Divider />

        <Space>
          {currentStep > 0 && (
            <Button icon={<ArrowLeftOutlined />} onClick={handlePrevious}>
              Previous
            </Button>
          )}

          <Button 
            icon={<EyeOutlined />} 
            onClick={handlePreview}
            loading={previewLoading}
          >
            Preview
          </Button>

          {currentStep < STEPS.length - 1 && (
            <Button type="primary" icon={<ArrowRightOutlined />} onClick={handleNext}>
              Next
            </Button>
          )}

          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave}>
            Save Report
          </Button>

          {onCancel && (
            <Button onClick={onCancel}>
              Cancel
            </Button>
          )}
        </Space>
      </Content>
    </Layout>
  );
};