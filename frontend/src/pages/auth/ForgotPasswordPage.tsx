import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Form, Input, Button, Result, Typography, Card } from 'antd';
import { MailOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useAuthMutations } from '@/hooks/useAuth';
import type { ForgotPasswordRequest } from '@/types/index';

const { Title, Text } = Typography;

export default function ForgotPasswordPage() {
  const [form] = Form.useForm();
  const [emailSent, setEmailSent] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const { forgotPassword } = useAuthMutations();

  const onFinish = async (values: ForgotPasswordRequest) => {
    try {
      await forgotPassword.mutateAsync(values);
      setSentEmail(values.email);
      setEmailSent(true);
    } catch (error) {
      // Error is handled by the mutation
    }
  };

  const onFinishFailed = (errorInfo: any) => {
    console.log('Forgot password form validation failed:', errorInfo);
  };

  if (emailSent) {
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
            title="Check Your Email"
            subTitle={
              <div>
                <Text>
                  We've sent a password reset link to <strong>{sentEmail}</strong>
                </Text>
                <br />
                <br />
                <Text type="secondary">
                  Please check your email and click the link to reset your password. 
                  The link will expire in 10 minutes for security reasons.
                </Text>
              </div>
            }
            extra={[
              <Button 
                type="primary" 
                key="login"
                onClick={() => window.location.href = '/auth/login'}
              >
                Back to Login
              </Button>,
              <Button 
                key="resend"
                onClick={() => setEmailSent(false)}
              >
                Send Another Email
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
            Enter your email address and we'll send you a link to reset your password
          </Text>
        </div>

        <Form
          form={form}
          name="forgot-password"
          onFinish={onFinish}
          onFinishFailed={onFinishFailed}
          size="large"
          layout="vertical"
        >
          <Form.Item
            name="email"
            label="Email Address"
            rules={[
              { required: true, message: 'Please input your email address!' },
              { type: 'email', message: 'Please enter a valid email address!' }
            ]}
          >
            <Input 
              prefix={<MailOutlined />}
              placeholder="Enter your email address"
              autoComplete="email"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={forgotPassword.isPending}
              block
            >
              {forgotPassword.isPending ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'center' }}>
            <Link to="/auth/login">
              <Button type="text" icon={<ArrowLeftOutlined />}>
                Back to Login
              </Button>
            </Link>
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
            <strong>Security Note:</strong> If an account with this email exists, 
            you will receive a password reset link. The link will expire in 10 minutes.
          </Text>
        </div>
      </Card>
    </div>
  );
}