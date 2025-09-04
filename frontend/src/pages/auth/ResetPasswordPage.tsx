import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Form, Input, Button, Result, Alert, Typography, Card } from 'antd';
import { LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuthMutations } from '@/hooks/useAuth';
import type { ResetPasswordRequest } from '@/types/index';

const { Title, Text } = Typography;

const passwordRules = [
  { required: true, message: 'Please input your new password!' },
  { min: 8, message: 'Password must be at least 8 characters long!' },
  {
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
    message: 'Password must contain uppercase, lowercase, number, and special character!',
  },
];

export default function ResetPasswordPage() {
  const [form] = Form.useForm();
  const [searchParams] = useSearchParams();
  const [resetSuccess, setResetSuccess] = useState(false);
  const [invalidToken, setInvalidToken] = useState(false);
  const navigate = useNavigate();
  const { resetPassword } = useAuthMutations();

  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setInvalidToken(true);
    }
  }, [token]);

  const onFinish = async (values: any) => {
    if (!token) {
      setInvalidToken(true);
      return;
    }

    const resetData: ResetPasswordRequest = {
      token,
      password: values.password,
      confirmPassword: values.confirmPassword,
    };

    try {
      await resetPassword.mutateAsync(resetData);
      setResetSuccess(true);
    } catch (error: any) {
      if (error.response?.data?.code === 'INVALID_TOKEN' || 
          error.response?.data?.code === 'EXPIRED_TOKEN') {
        setInvalidToken(true);
      }
    }
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log('Reset password form validation failed:', errorInfo);
  };

  if (invalidToken) {
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
          <Result
            status="error"
            title="Invalid Reset Link"
            subTitle="This password reset link is invalid or has expired. Please request a new one."
            extra={[
              <Button 
                type="primary" 
                key="forgot"
                onClick={() => navigate('/auth/forgot-password')}
              >
                Request New Link
              </Button>,
              <Button 
                key="login"
                onClick={() => navigate('/auth/login')}
              >
                Back to Login
              </Button>
            ]}
          />
        </Card>
      </div>
    );
  }

  if (resetSuccess) {
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
          <Result
            status="success"
            title="Password Reset Successfully"
            subTitle="Your password has been reset successfully. You can now log in with your new password."
            extra={[
              <Button 
                type="primary" 
                key="login"
                onClick={() => navigate('/auth/login')}
              >
                Go to Login
              </Button>
            ]}
          />
        </Card>
      </div>
    );
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
          width: '100%', 
          maxWidth: 400, 
          margin: '20px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <Title level={2} style={{ marginBottom: 8 }}>
            Reset Password
          </Title>
          <Text type="secondary">
            Enter your new password below
          </Text>
        </div>

        <Form
          form={form}
          name="reset-password"
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          size="large"
          layout="vertical"
          scrollToFirstError
        >
          <Form.Item
            name="password"
            label="New Password"
            rules={passwordRules}
            hasFeedback
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Enter new password"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm New Password"
            dependencies={['password']}
            hasFeedback
            rules={[
              { required: true, message: 'Please confirm your new password!' },
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
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
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
              loading={resetPassword.isPending}
              block
            >
              {resetPassword.isPending ? 'Resetting password...' : 'Reset password'}
            </Button>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'center' }}>
            <Text type="secondary">
              Remember your password?{' '}
              <Button type="link" onClick={() => navigate('/auth/login')}>
                Sign in here
              </Button>
            </Text>
          </Form.Item>
        </Form>

        <div style={{ 
          marginTop: 24, 
          padding: 16, 
          backgroundColor: '#f6f8fa', 
          borderRadius: 6,
          border: '1px solid #e1e4e8'
        }}>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            <strong>Security Note:</strong> Your password reset link can only be used once 
            and will expire in 10 minutes for security reasons.
          </Text>
        </div>
      </Card>
    </div>
  );
}