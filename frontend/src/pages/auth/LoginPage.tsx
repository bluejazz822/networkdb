import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Form, Input, Button, Checkbox, Divider, Alert, Space, Typography, Card } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuthMutations } from '@/hooks/useAuth';
import type { LoginRequest } from '@/types/index';

const { Title, Text } = Typography;

interface LocationState {
  from: string;
  message?: string;
}

export default function LoginPage() {
  const [form] = Form.useForm();
  const [requireMfa, setRequireMfa] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  
  const { login } = useAuthMutations();
  
  const locationState = location.state as LocationState;
  const redirectTo = locationState?.from || '/dashboard';
  const redirectMessage = locationState?.message;

  useEffect(() => {
    // Clear any existing error states when component mounts
    setRequireMfa(false);
  }, []);

  const onFinish = async (values: any) => {
    const loginData: LoginRequest = {
      username: values.username,
      password: values.password,
      mfaToken: values.mfaToken,
      rememberMe: values.rememberMe,
    };

    try {
      await login.mutateAsync(loginData);
      navigate(redirectTo, { replace: true });
    } catch (error: any) {
      // Check if MFA is required
      if (error.response?.data?.code === 'MFA_REQUIRED') {
        setRequireMfa(true);
      }
    }
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log('Login form validation failed:', errorInfo);
  };

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
          width: '100%', 
          maxWidth: 400, 
          margin: '20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            Network CMDB
          </Title>
          <Text type="secondary">Sign in to your account</Text>
        </div>

        {redirectMessage && (
          <Alert
            message={redirectMessage}
            type="info"
            style={{ marginBottom: 16 }}
            showIcon
          />
        )}

        <Form
          form={form}
          name="login"
          initialValues={{ rememberMe: true }}
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="username"
            label="Username or Email"
            rules={[
              { required: true, message: 'Please input your username or email!' },
              { min: 3, message: 'Username must be at least 3 characters long!' }
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="Username or email"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={[{ required: true, message: 'Please input your password!' }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
              autoComplete="current-password"
            />
          </Form.Item>

          {requireMfa && (
            <Form.Item
              name="mfaToken"
              label="Two-Factor Authentication Code"
              rules={[
                { required: true, message: 'Please input your 2FA code!' },
                { len: 6, message: '2FA code must be 6 digits!' }
              ]}
            >
              <Input
                prefix={<SafetyOutlined />}
                placeholder="6-digit code"
                maxLength={6}
                autoComplete="one-time-code"
              />
            </Form.Item>
          )}

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Form.Item name="rememberMe" valuePropName="checked" noStyle>
                <Checkbox>Remember me</Checkbox>
              </Form.Item>
              <Link to="/auth/forgot-password">
                <Text type="secondary">Forgot password?</Text>
              </Link>
            </Space>
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={login.isPending}
              block
            >
              {login.isPending ? 'Signing in...' : 'Sign in'}
            </Button>
          </Form.Item>

          <Divider plain>
            <Text type="secondary">New to Network CMDB?</Text>
          </Divider>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button 
              type="default" 
              block
              onClick={() => navigate('/auth/register')}
            >
              Create an account
            </Button>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            Network Configuration Management Database
            <br />
            © 2024 Network CMDB. All rights reserved.
          </Text>
        </div>
      </Card>
    </div>
  );
}