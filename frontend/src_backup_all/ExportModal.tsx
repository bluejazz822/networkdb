import React, { useState } from 'react'
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
  Divider,
  message,
  Statistic
} from 'antd'
import {
  FileExcelOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  DownloadOutlined
} from '@ant-design/icons'
import {
  ExportField,
  ExportData,
  DEFAULT_EXPORT_FIELDS,
  exportToCSV,
  exportToExcel,
  exportToPDF,
  getExportStats
} from '../utils/exportUtils'

const { Title, Text } = Typography

interface ExportModalProps {
  visible: boolean
  onCancel: () => void
  data: ExportData[]
  onExport?: () => void
}

export default function ExportModal({
  visible,
  onCancel,
  data,
  onExport
}: ExportModalProps) {
  const [form] = Form.useForm()
  const [selectedFields, setSelectedFields] = useState<ExportField[]>(DEFAULT_EXPORT_FIELDS)
  const [exportFormat, setExportFormat] = useState<'csv' | 'excel' | 'pdf'>('csv')
  const [exporting, setExporting] = useState(false)

  const stats = getExportStats(data, selectedFields)

  const handleFieldChange = (fieldKey: string, checked: boolean) => {
    setSelectedFields(prev =>
      prev.map(field =>
        field.key === fieldKey ? { ...field, selected: checked } : field
      )
    )
  }

  const handleSelectAll = (checked: boolean) => {
    setSelectedFields(prev =>
      prev.map(field => ({ ...field, selected: checked }))
    )
  }

  const handleExport = async () => {
    if (stats.selectedFields === 0) {
      message.warning('Please select at least one field to export')
      return
    }

    setExporting(true)
    
    try {
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const filename = `vpc_export_${timestamp}`
      
      let success = false
      
      switch (exportFormat) {
        case 'csv':
          success = exportToCSV(data, selectedFields, `${filename}.csv`)
          break
        case 'excel':
          success = exportToExcel(data, selectedFields, `${filename}.xlsx`)
          break
        case 'pdf':
          success = exportToPDF(data, selectedFields, `${filename}.pdf`)
          break
      }

      if (success) {
        message.success(`Successfully exported ${stats.totalRecords} VPCs to ${exportFormat.toUpperCase()}`)
        onExport?.()
        onCancel()
      } else {
        message.error(`Failed to export to ${exportFormat.toUpperCase()}`)
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
      description: 'Microsoft Excel format with formatting and column widths',
      color: '#1890ff'
    },
    {
      value: 'pdf',
      label: 'PDF',
      icon: <FilePdfOutlined />,
      description: 'Portable document format for reports and printing',
      color: '#f5222d'
    }
  ]

  return (
    <Modal
      title="Export VPC Data"
      open={visible}
      onCancel={onCancel}
      width={800}
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
          disabled={stats.selectedFields === 0}
        >
          Export {stats.totalRecords} VPCs
        </Button>
      ]}
    >
      <Form form={form} layout="vertical">
        <Row gutter={24}>
          <Col span={24}>
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
                    value={stats.estimatedFileSize[exportFormat]}
                    suffix="KB"
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="Format"
                    value={exportFormat.toUpperCase()}
                    valueStyle={{ color: '#fa8c16' }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>

          <Col span={12}>
            <Title level={5}>Select Export Format</Title>
            <Radio.Group
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value)}
              style={{ width: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {formatOptions.map(option => (
                  <Radio key={option.value} value={option.value}>
                    <Card
                      size="small"
                      style={{
                        marginLeft: 8,
                        border: exportFormat === option.value ? `2px solid ${option.color}` : '1px solid #d9d9d9'
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
          </Col>

          <Col span={12}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Title level={5} style={{ margin: 0 }}>Select Fields to Export</Title>
              <Space>
                <Button
                  size="small"
                  onClick={() => handleSelectAll(true)}
                >
                  Select All
                </Button>
                <Button
                  size="small"
                  onClick={() => handleSelectAll(false)}
                >
                  Clear All
                </Button>
              </Space>
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 6, padding: 12 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                {selectedFields.map(field => (
                  <Checkbox
                    key={field.key}
                    checked={field.selected}
                    onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                  >
                    <Text strong={field.selected}>{field.label}</Text>
                    {field.key === 'VpcId' && <Text type="secondary"> (Primary identifier)</Text>}
                    {field.key === 'Name' && <Text type="secondary"> (Display name)</Text>}
                    {field.key === 'CidrBlock' && <Text type="secondary"> (Network range)</Text>}
                  </Checkbox>
                ))}
              </Space>
            </div>
          </Col>
        </Row>
      </Form>
    </Modal>
  )
}