/**
 * Export Modal Component
 * Modal for exporting reports in various formats
 */

import React, { useState } from 'react';
import { 
  Modal, 
  Form, 
  Select, 
  Input, 
  Checkbox, 
  Button, 
  Space, 
  Typography,
  Progress,
  Alert,
  message
} from 'antd';
import { DownloadOutlined, FileTextOutlined } from '@ant-design/icons';
import { ExportFormat, ReportExportOptions } from '../../types/reports';
import { ReportsApiService } from '../../services/reportsApi';

const { Text } = Typography;
const { Option } = Select;

interface ExportModalProps {
  visible: boolean;
  onCancel: () => void;
  data: any[];
  reportName: string;
  metadata?: any;
}

const EXPORT_FORMATS: { value: ExportFormat; label: string; description: string }[] = [
  { 
    value: 'pdf', 
    label: 'PDF', 
    description: 'Portable Document Format - Good for printing and sharing' 
  },
  { 
    value: 'excel', 
    label: 'Excel (XLSX)', 
    description: 'Microsoft Excel format - Good for data analysis' 
  },
  { 
    value: 'csv', 
    label: 'CSV', 
    description: 'Comma-separated values - Good for data import/export' 
  },
  { 
    value: 'json', 
    label: 'JSON', 
    description: 'JavaScript Object Notation - Good for API integration' 
  },
  { 
    value: 'html', 
    label: 'HTML', 
    description: 'Web format - Good for web publishing' 
  }
];

export const ExportModal: React.FC<ExportModalProps> = ({
  visible,
  onCancel,
  data,
  reportName,
  metadata
}) => {
  const [form] = Form.useForm();
  const [exporting, setExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const handleExport = async () => {
    try {
      const values = await form.validateFields();
      
      setExporting(true);
      setExportProgress(0);
      setDownloadUrl(null);

      const options: ReportExportOptions = {
        format: values.format,
        includeCharts: values.includeCharts || false,
        includeMetadata: values.includeMetadata !== false,
        compression: values.compression || false,
        password: values.password,
        template: values.template
      };

      // Simulate progress for better UX
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev < 90) return prev + 10;
          return prev;
        });
      }, 200);

      const result = await ReportsApiService.exportReport(
        data,
        values.format,
        options,
        {
          ...metadata,
          reportName,
          exportedAt: new Date().toISOString(),
          recordCount: data.length
        }
      );

      clearInterval(progressInterval);
      setExportProgress(100);

      if (result.success && result.data) {
        setDownloadUrl(result.data.downloadUrl);
        message.success(`Report exported successfully as ${values.format.toUpperCase()}`);
      } else {
        throw new Error(result.errors?.[0]?.message || 'Export failed');
      }
    } catch (error: any) {
      message.error(error.message || 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = () => {
    if (downloadUrl) {
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = ReportsApiService.formatExportFilename(reportName, form.getFieldValue('format'));
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success('Download started');
    }
  };

  const handleReset = () => {
    setExporting(false);
    setExportProgress(0);
    setDownloadUrl(null);
    form.resetFields();
  };

  const getFormatIcon = (format: ExportFormat) => {
    const icons = {
      pdf: '📄',
      excel: '📊',
      csv: '📋',
      json: '🔗',
      html: '🌐'
    };
    return icons[format] || '📄';
  };

  return (
    <Modal
      title={
        <Space>
          <FileTextOutlined />
          Export Report: {reportName}
        </Space>
      }
      open={visible}
      onCancel={downloadUrl ? onCancel : () => {
        if (!exporting) {
          handleReset();
          onCancel();
        }
      }}
      width={600}
      footer={
        downloadUrl ? (
          <Space>
            <Button onClick={handleDownload} type="primary" icon={<DownloadOutlined />}>
              Download File
            </Button>
            <Button onClick={() => {
              handleReset();
              onCancel();
            }}>
              Close
            </Button>
          </Space>
        ) : (
          <Space>
            <Button onClick={() => {
              if (!exporting) {
                handleReset();
                onCancel();
              }
            }} disabled={exporting}>
              Cancel
            </Button>
            <Button 
              type="primary" 
              onClick={handleExport}
              loading={exporting}
              disabled={!data || data.length === 0}
            >
              {exporting ? 'Exporting...' : 'Export'}
            </Button>
          </Space>
        )
      }
      maskClosable={!exporting}
      closable={!exporting}
    >
      {!downloadUrl ? (
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            format: 'pdf',
            includeMetadata: true,
            includeCharts: false,
            compression: false
          }}
        >
          <Alert
            message={`Ready to export ${data?.length || 0} records`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item
            name="format"
            label="Export Format"
            rules={[{ required: true, message: 'Please select an export format' }]}
          >
            <Select placeholder="Select format" size="large">
              {EXPORT_FORMATS.map(format => (
                <Option key={format.value} value={format.value}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ marginRight: 8, fontSize: '16px' }}>
                      {getFormatIcon(format.value)}
                    </span>
                    <div>
                      <div><strong>{format.label}</strong></div>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {format.description}
                      </Text>
                    </div>
                  </div>
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item label="Export Options">
            <Space direction="vertical" style={{ width: '100%' }}>
              <Form.Item name="includeMetadata" valuePropName="checked" noStyle>
                <Checkbox>Include metadata (report details, timestamps, etc.)</Checkbox>
              </Form.Item>
              
              <Form.Item name="includeCharts" valuePropName="checked" noStyle>
                <Checkbox>Include charts and visualizations (PDF/HTML only)</Checkbox>
              </Form.Item>
              
              <Form.Item name="compression" valuePropName="checked" noStyle>
                <Checkbox>Enable compression (smaller file size)</Checkbox>
              </Form.Item>
            </Space>
          </Form.Item>

          <Form.Item
            name="password"
            label="Password Protection (Optional)"
          >
            <Input.Password 
              placeholder="Enter password to protect the file"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="template"
            label="Template (Optional)"
          >
            <Select placeholder="Select a template" allowClear>
              <Option value="standard">Standard Report</Option>
              <Option value="executive">Executive Summary</Option>
              <Option value="detailed">Detailed Analysis</Option>
            </Select>
          </Form.Item>

          {exporting && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <Progress 
                percent={exportProgress} 
                status="active"
                strokeColor={{
                  '0%': '#108ee9',
                  '100%': '#87d068',
                }}
              />
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                {exportProgress < 30 ? 'Preparing data...' :
                 exportProgress < 60 ? 'Generating report...' :
                 exportProgress < 90 ? 'Formatting output...' :
                 'Finalizing export...'}
              </Text>
            </div>
          )}
        </Form>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: '48px', marginBottom: 16 }}>
            {getFormatIcon(form.getFieldValue('format'))}
          </div>
          <Text strong style={{ fontSize: '16px', display: 'block', marginBottom: 8 }}>
            Export Complete!
          </Text>
          <Text type="secondary">
            Your report has been successfully exported as {form.getFieldValue('format').toUpperCase()}.
            Click the download button to save the file.
          </Text>
        </div>
      )}

      {!data || data.length === 0 ? (
        <Alert
          message="No Data Available"
          description="There is no data to export. Please run the report first to generate data."
          type="warning"
          showIcon
          style={{ marginTop: 16 }}
        />
      ) : null}
    </Modal>
  );
};