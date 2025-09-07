import { useState } from 'react'
import { Form, Input, Button, Card, Typography, Alert, Space, Divider } from 'antd'
import { UserOutlined, LockOutlined, LoginOutlined } from '@ant-design/icons'
import { useAuth } from '../contexts/AuthContext'

const { Title, Text } = Typography

export default function LoginForm() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { login } = useAuth()

  const handleLogin = async (values: { username: string; password: string }) => {
    setLoading(true)
    setError(null)

    try {
      const success = await login(values.username, values.password)
      if (!success) {
        setError('Invalid username or password')
      }
    } catch (err) {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ 
      minHeight: '100vh', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card 
        style={{ 
          width: 400, 
          boxShadow: '0 10px 25px rgba(0,0,0,0.1)' 
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Title level={2} style={{ margin: 0, color: '#1890ff' }}>
            Network CMDB
          </Title>
          <Text type="secondary">Configuration Management Database</Text>
        </div>

        <Form
          name="login"
          onFinish={handleLogin}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Please input your username!' }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Username"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
              autoComplete="current-password"
            />
          </Form.Item>

          {error && (
            <Form.Item>
              <Alert message={error} type="error" showIcon closable />
            </Form.Item>
          )}

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              icon={<LoginOutlined />}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        <Divider />

        <div style={{ textAlign: 'center' }}>
          <Title level={5} style={{ marginBottom: '16px' }}>Demo Accounts</Title>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Card size="small" style={{ background: '#f6ffed', border: '1px solid #b7eb8f' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>Admin Account</Text><br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>Full edit permissions</Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text code>admin</Text><br />
                  <Text code>admin123</Text>
                </div>
              </div>
            </Card>
            <Card size="small" style={{ background: '#fff2e8', border: '1px solid #ffcc99' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <Text strong>User Account</Text><br />
                  <Text type="secondary" style={{ fontSize: '12px' }}>Read-only access</Text>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Text code>user</Text><br />
                  <Text code>user123</Text>
                </div>
              </div>
            </Card>
          </Space>
        </div>
      </Card>
    </div>
  )
}