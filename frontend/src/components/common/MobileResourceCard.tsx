import React from 'react'
import { Card, Space, Tag, Button, Dropdown, Typography } from 'antd'
import { MoreOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'

const { Text } = Typography

export interface MobileResourceCardProps<T = any> {
  record: T
  title: string
  subtitle?: string
  tags?: Array<{ label: string; color?: string; value: any }>
  fields?: Array<{ label: string; value: any; render?: (value: any) => React.ReactNode }>
  actions?: Array<{
    key: string
    label: string
    icon?: React.ReactNode
    danger?: boolean
    onClick: (record: T) => void
  }>
}

export function MobileResourceCard<T extends Record<string, any>>({
  record,
  title,
  subtitle,
  tags = [],
  fields = [],
  actions = [],
}: MobileResourceCardProps<T>) {
  const menuItems: MenuProps['items'] = actions.map(action => ({
    key: action.key,
    label: action.label,
    icon: action.icon,
    danger: action.danger,
    onClick: () => action.onClick(record),
  }))

  return (
    <Card 
      size="small"
      style={{ marginBottom: 8 }}
      extra={
        actions.length > 0 ? (
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <Button type="text" icon={<MoreOutlined />} />
          </Dropdown>
        ) : null
      }
    >
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {/* Title */}
        <div>
          <Text strong style={{ fontSize: '16px' }}>{title}</Text>
          {subtitle && (
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>{subtitle}</Text>
            </div>
          )}
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <Space wrap>
            {tags.map((tag, index) => (
              <Tag key={index} color={tag.color}>
                {tag.label}
              </Tag>
            ))}
          </Space>
        )}

        {/* Fields */}
        {fields.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: '13px' }}>
            {fields.map((field, index) => (
              <div key={index}>
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  {field.label}
                </Text>
                <div>
                  {field.render ? field.render(field.value) : (
                    <Text>{field.value}</Text>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Space>
    </Card>
  )
}