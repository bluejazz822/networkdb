import React, { useState, useEffect } from 'react';
import {
  Modal,
  Card,
  Steps,
  Form,
  Select,
  Input,
  Button,
  Space,
  Progress,
  Alert,
  Typography,
  Table,
  Tag,
  Divider,
  Checkbox,
  Upload,
  message,
  Row,
  Col,
  Spin
} from 'antd';
import {
  PlayCircleOutlined,
  PauseCircleOutlined,
  StopOutlined,
  DownloadOutlined,
  UploadOutlined,
  EditOutlined,
  DeleteOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { useNetworkManagement, NetworkResourceType, NetworkResource } from '../../hooks/useNetworkManagement';
import { getResourceDisplayName, getResourceStatus, prepareResourceForExport } from '../../utils/network-helpers';
import type { BulkOperation, TemplateParameter, ResourceTemplate } from '../../types';

const { Step } = Steps;
const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

interface BulkOperationsPanelProps {
  resourceType: NetworkResourceType;
  selectedResources: NetworkResource[];
  visible: boolean;
  onClose: () => void;
  onComplete: () => void;
}

type BulkOperationType = 'update' | 'delete' | 'export' | 'import' | 'template';

interface BulkOperationConfig {
  type: BulkOperationType;
  title: string;
  description: string;
  icon: React.ReactNode;
  steps: string[];
  dangerous?: boolean;
}

const BULK_OPERATIONS: Record<BulkOperationType, BulkOperationConfig> = {
  update: {
    type: 'update',
    title: 'Bulk Update',
    description: 'Update multiple resources with the same values',
    icon: <EditOutlined />,
    steps: ['Select Fields', 'Set Values', 'Review', 'Execute']
  },
  delete: {
    type: 'delete',
    title: 'Bulk Delete',
    description: 'Permanently delete multiple resources',
    icon: <DeleteOutlined />,
    steps: ['Confirm Selection', 'Review Dependencies', 'Execute'],
    dangerous: true
  },
  export: {
    type: 'export',
    title: 'Export Resources',
    description: 'Export selected resources to various formats',
    icon: <DownloadOutlined />,
    steps: ['Select Format', 'Configure Options', 'Generate']
  },
  import: {
    type: 'import',
    title: 'Import Resources',
    description: 'Import resources from file',
    icon: <UploadOutlined />,
    steps: ['Upload File', 'Map Fields', 'Validate', 'Import']
  },
  template: {
    type: 'template',
    title: 'Apply Template',
    description: 'Apply a resource template to create new resources',
    icon: <CheckCircleOutlined />,
    steps: ['Select Template', 'Configure Parameters', 'Preview', 'Create']
  }
};

export const BulkOperationsPanel: React.FC<BulkOperationsPanelProps> = ({
  resourceType,
  selectedResources,
  visible,
  onClose,
  onComplete
}) => {
  // State
  const [currentStep, setCurrentStep] = useState(0);
  const [operationType, setOperationType] = useState<BulkOperationType>('update');
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [operation, setOperation] = useState<BulkOperation | null>(null);
  const [templates, setTemplates] = useState<ResourceTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<ResourceTemplate | null>(null);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<any[]>([]);
  const [fieldMappings, setFieldMappings] = useState<Record<string, string>>({});

  // Hooks
  const { 
    bulkUpdate, 
    bulkDelete, 
    exportResources, 
    loadBulkOperations,
    bulkOperations 
  } = useNetworkManagement({ resourceType, autoLoad: false });

  // Load templates and operations on mount
  useEffect(() => {
    if (visible) {
      loadBulkOperations();
      // In a real implementation, you'd load templates from the API
      setTemplates([]);
    }
  }, [visible, loadBulkOperations]);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (visible) {
      setCurrentStep(0);
      setOperationType('update');
      setOperation(null);
      form.resetFields();
    }
  }, [visible, form]);

  // Handle operation type selection
  const handleOperationSelect = (type: BulkOperationType) => {
    setOperationType(type);
    setCurrentStep(0);
    form.resetFields();
  };

  // Get updatable fields based on resource type
  const getUpdatableFields = () => {
    const baseFields = [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'environment', label: 'Environment', type: 'text' },
      { key: 'project', label: 'Project', type: 'text' },
      { key: 'owner', label: 'Owner', type: 'text' },
      { key: 'costCenter', label: 'Cost Center', type: 'text' }
    ];

    const typeSpecificFields: Record<string, any[]> = {
      'vpc': [
        { key: 'enableDnsSupport', label: 'DNS Support', type: 'boolean' },
        { key: 'enableDnsHostnames', label: 'DNS Hostnames', type: 'boolean' }
      ],
      'transit-gateway': [
        { key: 'autoAcceptSharedAttachments', label: 'Auto Accept Attachments', type: 'boolean' },
        { key: 'dnsSupport', label: 'DNS Support', type: 'select', options: ['enable', 'disable'] }
      ]
    };

    return [...baseFields, ...(typeSpecificFields[resourceType] || [])];
  };

  // Execute bulk operation
  const executeBulkOperation = async () => {
    setLoading(true);
    try {
      let success = false;
      
      switch (operationType) {
        case 'update':
          const updates = form.getFieldsValue();
          success = await bulkUpdate(updates);
          break;
        case 'delete':
          success = await bulkDelete();
          break;
        case 'export':
          const exportConfig = form.getFieldsValue();
          success = await exportResources(exportConfig.format, true);
          break;
        case 'import':
          // Implementation for import would go here
          message.info('Import functionality not yet implemented');
          break;
        case 'template':
          // Implementation for template application would go here
          message.info('Template functionality not yet implemented');
          break;
      }

      if (success) {
        message.success('Bulk operation completed successfully');
        onComplete();
        onClose();
      }
    } catch (error) {
      console.error('Bulk operation failed:', error);
      message.error('Bulk operation failed');
    } finally {
      setLoading(false);
    }
  };

  // Render operation selection
  const renderOperationSelection = () => (
    <div>
      <Title level={4}>Select Bulk Operation</Title>
      <Row gutter={[16, 16]}>
        {Object.values(BULK_OPERATIONS).map((op) => (
          <Col key={op.type} xs={24} sm={12} md={8}>
            <Card
              hoverable
              style={{
                cursor: 'pointer',
                border: operationType === op.type ? '2px solid #1890ff' : '1px solid #d9d9d9',
                ...(op.dangerous && { borderColor: '#ff4d4f' })
              }}
              onClick={() => handleOperationSelect(op.type)}
            >
              <Space direction=\"vertical\" align=\"center\" style={{ width: '100%' }}>
                <div style={{ fontSize: '24px', color: op.dangerous ? '#ff4d4f' : '#1890ff' }}>
                  {op.icon}
                </div>
                <Text strong>{op.title}</Text>
                <Text type=\"secondary\" style={{ textAlign: 'center' }}>
                  {op.description}
                </Text>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );

  // Render step content based on operation type and current step
  const renderStepContent = () => {
    const config = BULK_OPERATIONS[operationType];
    
    if (operationType === 'update') {
      if (currentStep === 0) {
        // Select fields to update
        const fields = getUpdatableFields();
        return (
          <div>
            <Title level={5}>Select Fields to Update</Title>
            <Form form={form} layout=\"vertical\">
              <Form.Item name=\"selectedFields\" label=\"Fields to Update\">
                <Checkbox.Group>
                  <Row>
                    {fields.map((field) => (
                      <Col key={field.key} span={8}>
                        <Checkbox value={field.key}>{field.label}</Checkbox>
                      </Col>
                    ))}
                  </Row>
                </Checkbox.Group>
              </Form.Item>
            </Form>
          </div>
        );
      } else if (currentStep === 1) {
        // Set values for selected fields
        const selectedFields = form.getFieldValue('selectedFields') || [];
        const fields = getUpdatableFields().filter(f => selectedFields.includes(f.key));
        
        return (
          <div>
            <Title level={5}>Set New Values</Title>
            <Form form={form} layout=\"vertical\">
              {fields.map((field) => {
                if (field.type === 'boolean') {
                  return (
                    <Form.Item key={field.key} name={field.key} label={field.label}>
                      <Select>
                        <Option value={true}>Yes</Option>
                        <Option value={false}>No</Option>
                      </Select>
                    </Form.Item>
                  );
                } else if (field.type === 'select') {
                  return (
                    <Form.Item key={field.key} name={field.key} label={field.label}>
                      <Select>
                        {field.options.map((option: string) => (
                          <Option key={option} value={option}>{option}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                  );
                } else if (field.type === 'textarea') {
                  return (
                    <Form.Item key={field.key} name={field.key} label={field.label}>
                      <TextArea rows={3} />
                    </Form.Item>
                  );
                } else {
                  return (
                    <Form.Item key={field.key} name={field.key} label={field.label}>
                      <Input />
                    </Form.Item>
                  );
                }
              })}
            </Form>
          </div>
        );
      } else if (currentStep === 2) {
        // Review changes
        const selectedFields = form.getFieldValue('selectedFields') || [];
        const values = form.getFieldsValue();
        
        return (
          <div>
            <Title level={5}>Review Changes</Title>
            <Alert
              message={`${selectedResources.length} resources will be updated`}
              type=\"info\"
              style={{ marginBottom: '16px' }}
            />
            <div>
              <Text strong>Changes to be applied:</Text>
              <div style={{ marginTop: '8px' }}>
                {selectedFields.map((fieldKey: string) => (
                  <div key={fieldKey} style={{ marginBottom: '4px' }}>
                    <Text code>{fieldKey}</Text>: {String(values[fieldKey] || 'N/A')}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }
    } else if (operationType === 'delete') {
      if (currentStep === 0) {
        return (
          <div>
            <Title level={5}>Confirm Deletion</Title>
            <Alert
              message=\"Warning: This action cannot be undone\"
              description={`${selectedResources.length} resources will be permanently deleted.`}
              type=\"error\"
              showIcon
              style={{ marginBottom: '16px' }}
            />
            <Text strong>Resources to be deleted:</Text>
            <div style={{ marginTop: '8px', maxHeight: '200px', overflow: 'auto' }}>
              {selectedResources.map((resource) => (
                <div key={resource.id} style={{ marginBottom: '4px' }}>
                  <Text code>{getResourceDisplayName(resource)}</Text>
                </div>
              ))}
            </div>
          </div>
        );
      }
    } else if (operationType === 'export') {
      if (currentStep === 0) {
        return (
          <div>
            <Title level={5}>Export Configuration</Title>
            <Form form={form} layout=\"vertical\" initialValues={{ format: 'csv' }}>
              <Form.Item name=\"format\" label=\"Export Format\" rules={[{ required: true }]}>
                <Select>
                  <Option value=\"csv\">CSV (Comma-separated values)</Option>
                  <Option value=\"excel\">Excel (XLSX)</Option>
                  <Option value=\"json\">JSON</Option>
                </Select>
              </Form.Item>
              <Form.Item name=\"includeRelationships\" valuePropName=\"checked\">
                <Checkbox>Include resource relationships</Checkbox>
              </Form.Item>
              <Form.Item name=\"includeHealthData\" valuePropName=\"checked\">
                <Checkbox>Include health monitoring data</Checkbox>
              </Form.Item>
            </Form>
            <Alert
              message={`${selectedResources.length} resources will be exported`}
              type=\"info\"
            />
          </div>
        );
      }
    }

    return (
      <div>
        <Title level={5}>{config.steps[currentStep]}</Title>
        <Text>This step is not yet implemented.</Text>
      </div>
    );
  };

  // Check if can proceed to next step
  const canProceedToNextStep = () => {
    if (operationType === 'update') {
      if (currentStep === 0) {
        const selectedFields = form.getFieldValue('selectedFields');
        return selectedFields && selectedFields.length > 0;
      }
    }
    return true;
  };

  // Check if can execute operation
  const canExecute = () => {
    const config = BULK_OPERATIONS[operationType];
    return currentStep === config.steps.length - 1 && canProceedToNextStep();
  };

  return (
    <Modal
      title=\"Bulk Operations\"
      open={visible}
      onCancel={onClose}
      width={800}
      footer={null}
      destroyOnClose
    >
      <div style={{ minHeight: '400px' }}>
        {/* Operation Selection */}
        {currentStep === -1 || !operationType ? (
          renderOperationSelection()
        ) : (
          <>
            {/* Progress Steps */}
            <div style={{ marginBottom: '24px' }}>
              <Space align=\"center\" style={{ marginBottom: '16px' }}>
                {BULK_OPERATIONS[operationType].icon}
                <Title level={4} style={{ margin: 0 }}>
                  {BULK_OPERATIONS[operationType].title}
                </Title>
              </Space>
              
              <Steps current={currentStep} size=\"small\">
                {BULK_OPERATIONS[operationType].steps.map((step, index) => (
                  <Step key={index} title={step} />
                ))}
              </Steps>
            </div>

            {/* Step Content */}
            <div style={{ marginBottom: '24px', minHeight: '200px' }}>
              {renderStepContent()}
            </div>

            {/* Active Operations Status */}
            {bulkOperations.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <Title level={5}>Active Operations</Title>
                {bulkOperations.map((op) => (
                  <Card key={op.id} size=\"small\" style={{ marginBottom: '8px' }}>
                    <Row justify=\"space-between\" align=\"middle\">
                      <Col>
                        <Space>
                          <Tag color=\"blue\">{op.type}</Tag>
                          <Text>{op.resourceType}</Text>
                          <Text type=\"secondary\">({op.resourceIds.length} items)</Text>
                        </Space>
                      </Col>
                      <Col>
                        <Space>
                          <Progress 
                            percent={Math.round((op.processedItems / op.totalItems) * 100)} 
                            size=\"small\" 
                            status={op.status === 'failed' ? 'exception' : 'active'}
                          />
                          <Tag color={
                            op.status === 'completed' ? 'success' : 
                            op.status === 'failed' ? 'error' : 'processing'
                          }>
                            {op.status}
                          </Tag>
                        </Space>
                      </Col>
                    </Row>
                  </Card>
                ))}
              </div>
            )}

            {/* Footer Actions */}
            <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: '16px' }}>
              <Space style={{ float: 'right' }}>
                <Button onClick={onClose}>Cancel</Button>
                <Button 
                  onClick={() => setOperationType('' as any)}
                  disabled={loading}
                >
                  Back to Selection
                </Button>
                {currentStep > 0 && (
                  <Button 
                    onClick={() => setCurrentStep(currentStep - 1)}
                    disabled={loading}
                  >
                    Previous
                  </Button>
                )}
                {!canExecute() && (
                  <Button 
                    type=\"primary\"
                    onClick={() => setCurrentStep(currentStep + 1)}
                    disabled={!canProceedToNextStep() || loading}
                  >
                    Next
                  </Button>
                )}
                {canExecute() && (
                  <Button 
                    type=\"primary\"
                    onClick={executeBulkOperation}
                    loading={loading}
                    danger={BULK_OPERATIONS[operationType].dangerous}
                  >
                    {operationType === 'delete' ? 'Delete Resources' : 'Execute'}
                  </Button>
                )}
              </Space>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};