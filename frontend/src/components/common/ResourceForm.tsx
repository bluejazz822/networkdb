import React from 'react'
import {
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Switch,
  Radio,
  Checkbox,
  Button,
  Space,
  Row,
  Col,
  Card,
  Typography,
  Alert,
} from 'antd'
import { useForm, Controller, SubmitHandler } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { z } from 'zod'

const { Title } = Typography
const { TextArea } = Input
const { Option } = Select

export type FieldType = 
  | 'text'
  | 'email'
  | 'password'
  | 'number'
  | 'textarea'
  | 'select'
  | 'multiselect'
  | 'date'
  | 'datetime'
  | 'switch'
  | 'radio'
  | 'checkbox'
  | 'ip'
  | 'cidr'

export interface FormField {
  name: string
  label: string
  type: FieldType
  required?: boolean
  placeholder?: string
  help?: string
  disabled?: boolean
  
  // Field-specific options
  options?: Array<{ label: string; value: any; disabled?: boolean }>
  min?: number
  max?: number
  rows?: number // for textarea
  format?: string // for date/datetime
  
  // Layout
  span?: number // Grid span (1-24)
  offset?: number
  
  // Conditional display
  dependsOn?: string
  showWhen?: any
}

export interface FormSection {
  title?: string
  description?: string
  fields: FormField[]
  collapsible?: boolean
  defaultOpen?: boolean
}

export interface ResourceFormProps<T extends Record<string, any>> {
  title?: string
  description?: string
  sections: FormSection[]
  schema: z.ZodSchema<T>
  defaultValues?: Partial<T>
  loading?: boolean
  onSubmit: (data: T) => void | Promise<void>
  onCancel?: () => void
  submitText?: string
  cancelText?: string
  layout?: 'horizontal' | 'vertical' | 'inline'
  size?: 'small' | 'middle' | 'large'
}

export function ResourceForm<T extends Record<string, any>>({
  title,
  description,
  sections,
  schema,
  defaultValues,
  loading = false,
  onSubmit,
  onCancel,
  submitText = 'Submit',
  cancelText = 'Cancel',
  layout = 'vertical',
  size = 'middle',
}: ResourceFormProps<T>) {
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    reset,
  } = useForm<T>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues as any,
  })

  const watchedValues = watch()

  const onSubmitHandler: SubmitHandler<T> = async (data) => {
    try {
      await onSubmit(data)
    } catch (error) {
      console.error('Form submission error:', error)
    }
  }

  // Check if field should be shown based on dependencies
  const shouldShowField = (field: FormField) => {
    if (!field.dependsOn || !field.showWhen) return true
    const dependentValue = watchedValues[field.dependsOn as keyof T]
    return dependentValue === field.showWhen
  }

  // Render individual field based on type
  const renderField = (field: FormField) => {
    const commonProps = {
      placeholder: field.placeholder,
      disabled: field.disabled || loading,
      size,
    }

    switch (field.type) {
      case 'text':
      case 'email':
      case 'password':
      case 'ip':
      case 'cidr':
        return (
          <Input
            {...commonProps}
            type={field.type === 'password' ? 'password' : 'text'}
          />
        )

      case 'number':
        return (
          <InputNumber
            {...commonProps}
            style={{ width: '100%' }}
            min={field.min}
            max={field.max}
          />
        )

      case 'textarea':
        return (
          <TextArea
            {...commonProps}
            rows={field.rows || 4}
          />
        )

      case 'select':
        return (
          <Select {...commonProps}>
            {field.options?.map((option) => (
              <Option 
                key={option.value} 
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </Option>
            ))}
          </Select>
        )

      case 'multiselect':
        return (
          <Select {...commonProps} mode="multiple">
            {field.options?.map((option) => (
              <Option 
                key={option.value} 
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </Option>
            ))}
          </Select>
        )

      case 'date':
        return (
          <DatePicker
            {...commonProps}
            style={{ width: '100%' }}
            format={field.format || 'YYYY-MM-DD'}
          />
        )

      case 'datetime':
        return (
          <DatePicker
            {...commonProps}
            style={{ width: '100%' }}
            showTime
            format={field.format || 'YYYY-MM-DD HH:mm:ss'}
          />
        )

      case 'switch':
        return <Switch {...commonProps} />

      case 'radio':
        return (
          <Radio.Group {...commonProps}>
            {field.options?.map((option) => (
              <Radio 
                key={option.value} 
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </Radio>
            ))}
          </Radio.Group>
        )

      case 'checkbox':
        return (
          <Checkbox.Group {...commonProps}>
            {field.options?.map((option) => (
              <Checkbox 
                key={option.value} 
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </Checkbox>
            ))}
          </Checkbox.Group>
        )

      default:
        return <Input {...commonProps} />
    }
  }

  return (
    <div>
      {/* Header */}
      {(title || description) && (
        <div style={{ marginBottom: 24 }}>
          {title && <Title level={3}>{title}</Title>}
          {description && (
            <p style={{ color: '#666', marginTop: 8 }}>{description}</p>
          )}
        </div>
      )}

      {/* Form */}
      <Form layout={layout} size={size}>
        <form onSubmit={handleSubmit(onSubmitHandler)}>
          {sections.map((section, sectionIndex) => (
            <Card
              key={sectionIndex}
              title={section.title}
              style={{ marginBottom: 16 }}
              size="small"
            >
              {section.description && (
                <Alert
                  message={section.description}
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}
              
              <Row gutter={[16, 16]}>
                {section.fields
                  .filter(shouldShowField)
                  .map((field) => (
                  <Col
                    key={field.name}
                    span={field.span || 24}
                    offset={field.offset || 0}
                  >
                    <Controller
                      name={field.name as any}
                      control={control}
                      rules={{ required: field.required }}
                      render={({ field: controllerField }) => (
                        <Form.Item
                          label={field.label}
                          required={field.required}
                          help={field.help || (errors[field.name as keyof T]?.message as string)}
                          validateStatus={errors[field.name as keyof T] ? 'error' : ''}
                        >
                          <div {...controllerField}>
                            {renderField(field)}
                          </div>
                        </Form.Item>
                      )}
                    />
                  </Col>
                ))}
              </Row>
            </Card>
          ))}

          {/* Actions */}
          <div style={{ textAlign: 'right', marginTop: 24 }}>
            <Space>
              {onCancel && (
                <Button onClick={onCancel} disabled={isSubmitting || loading}>
                  {cancelText}
                </Button>
              )}
              <Button 
                type="primary" 
                htmlType="submit"
                loading={isSubmitting || loading}
              >
                {submitText}
              </Button>
            </Space>
          </div>
        </form>
      </Form>
    </div>
  )
}