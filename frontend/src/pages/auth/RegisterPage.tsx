import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Form, Input, Button, Checkbox, Alert, Typography, Card, Row, Col } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuthMutations } from '@/hooks/useAuth';
import type { RegisterRequest } from '@/types/index';

const { Title, Text } = Typography;

const passwordRules = [
  { required: true, message: 'Please input your password!' },
  { min: 8, message: 'Password must be at least 8 characters long!' },
  {
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    message: 'Password must contain uppercase, lowercase, number, and special character!',
  },
];

export default function RegisterPage() {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const { register } = useAuthMutations();

  const onFinish = async (values: any) => {
    const registerData: RegisterRequest = {
      username: values.username,
      email: values.email,
      password: values.password,
      confirmPassword: values.confirmPassword,
      firstName: values.firstName,
      lastName: values.lastName,
      acceptTerms: values.acceptTerms,
    };

    try {
      await register.mutateAsync(registerData);
      navigate('/auth/login', { 
        state: { 
          message: 'Registration successful! Please check your email to verify your account before signing in.' 
        }
      });
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log('Registration form validation failed:', errorInfo);
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
          maxWidth: 500, 
          margin: '20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            Create Account
          </Title>
          <Text type="secondary">Join Network CMDB</Text>
        </div>

        <Form
          form={form}
          name="register"
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          size="large"
          layout="vertical"
          scrollToFirstError
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="firstName"
                label="First Name"
                rules={[
                  { required: true, message: 'Please input your first name!' },
                  { min: 2, message: 'First name must be at least 2 characters!' }
                ]}
              >
                <Input 
                  placeholder="First name"
                  autoComplete="given-name"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="lastName"
                label="Last Name"
                rules={[
                  { required: true, message: 'Please input your last name!' },
                  { min: 2, message: 'Last name must be at least 2 characters!' }
                ]}
              >
                <Input 
                  placeholder="Last name"
                  autoComplete="family-name"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="username"
            label="Username"
            rules={[
              { required: true, message: 'Please input your username!' },
              { min: 3, message: 'Username must be at least 3 characters!' },
              { max: 50, message: 'Username cannot exceed 50 characters!' },
              {
                pattern: /^[a-zA-Z0-9_]+$/,
                message: 'Username can only contain letters, numbers, and underscores!',
              },
            ]}
          >
            <Input 
              prefix={<UserOutlined />}
              placeholder="Username"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="Email"
            rules={[
              { required: true, message: 'Please input your email!' },
              { type: 'email', message: 'Please enter a valid email address!' },
              { max: 255, message: 'Email cannot exceed 255 characters!' }
            ]}
          >
            <Input 
              prefix={<MailOutlined />}
              placeholder="Email address"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="Password"
            rules={passwordRules}
            hasFeedback
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Password"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            dependencies={['password']}
            hasFeedback
            rules={[
              { required: true, message: 'Please confirm your password!' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Passwords do not match!'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<SafetyOutlined />}
              placeholder="Confirm password"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="acceptTerms"
            valuePropName="checked"
            rules={[
              {
                validator: (_, value) =>
                  value ? Promise.resolve() : Promise.reject(new Error('Please accept the terms and conditions!')),
              },
            ]}
          >
            <Checkbox>
              I agree to the{' '}
              <Link to="/terms" target="_blank">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank">
                Privacy Policy
              </Link>
            </Checkbox>
          </Form.Item>

          <Alert
            message="Password Requirements"
            description={
              <ul style={{ marginBottom: 0, paddingLeft: 16 }}>
                <li>At least 8 characters long</li>
                <li>Contains uppercase and lowercase letters</li>
                <li>Contains at least one number</li>
                <li>Contains at least one special character (@$!%*?&)</li>
              </ul>
            }
            type="info"
            style={{ marginBottom: 16 }}
            showIcon
          />

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={register.isPending}
              block
            >
              {register.isPending ? 'Creating account...' : 'Create account'}
            </Button>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'center' }}>
            <Text type="secondary">
              Already have an account?{' '}
              <Link to="/auth/login">Sign in here</Link>
            </Text>
          </Form.Item>
        </Form>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            By creating an account, you agree to our terms and conditions
            <br />
            © 2024 Network CMDB. All rights reserved.
          </Text>
        </div>
      </Card>
    </div>
  );
}