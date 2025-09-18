/**
 * Email Configuration Module
 * SMTP configuration and email service settings for workflow notifications
 */

import nodemailer from 'nodemailer';

export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
  };
  from: {
    name: string;
    address: string;
  };
  throttle: {
    maxAlertsPerHour: number;
    maxAlertsPerWorkflowPerHour: number;
  };
  templates: {
    baseUrl: string;
  };
}

export function getEmailConfig(): EmailConfig {
  return {
    smtp: {
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || ''
      }
    },
    from: {
      name: process.env.EMAIL_FROM_NAME || 'Network CMDB Alerts',
      address: process.env.EMAIL_FROM_ADDRESS || 'noreply@networkdb.local'
    },
    throttle: {
      maxAlertsPerHour: parseInt(process.env.MAX_ALERTS_PER_HOUR || '10'),
      maxAlertsPerWorkflowPerHour: parseInt(process.env.MAX_ALERTS_PER_WORKFLOW_PER_HOUR || '1')
    },
    templates: {
      baseUrl: process.env.FRONTEND_URL || 'http://localhost:3000'
    }
  };
}

export function createEmailTransporter(): nodemailer.Transporter | null {
  try {
    const config = getEmailConfig();
    
    if (!config.smtp.host || !config.smtp.auth.user) {
      console.warn('SMTP configuration incomplete, email service will be disabled');
      return null;
    }

    const transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.auth.user,
        pass: config.smtp.auth.pass
      },
      // Connection timeout and retry settings
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      // Disable pool to avoid connection issues
      pool: false,
      // Custom logger for debugging in development
      logger: process.env.NODE_ENV === 'development',
      debug: process.env.NODE_ENV === 'development'
    });

    // Test connection on startup
    transporter.verify((error: any, success: any) => {
      if (error) {
        console.error('SMTP configuration error:', error.message);
      } else {
        console.log('✅ SMTP server connection verified');
      }
    });

    return transporter;
  } catch (error) {
    console.error('Failed to create email transporter:', error);
    return null;
  }
}

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export function getWorkflowFailureTemplate(
  workflowName: string,
  executionId: string,
  errorMessage: string,
  startTime: Date,
  dashboardUrl: string
): EmailTemplate {
  const subject = `🚨 Workflow Failure Alert: ${workflowName}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workflow Failure Alert</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #dc3545; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
        .footer { background: #6c757d; color: white; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; }
        .alert-icon { font-size: 24px; margin-right: 10px; }
        .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .button { display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .error-box { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 10px; border-radius: 5px; }
        .timestamp { color: #6c757d; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <span class="alert-icon">🚨</span>
            <strong>Workflow Failure Alert</strong>
        </div>
        
        <div class="content">
            <h2>Workflow "${workflowName}" has failed</h2>
            
            <div class="details">
                <p><strong>Execution ID:</strong> ${executionId}</p>
                <p><strong>Workflow:</strong> ${workflowName}</p>
                <p><strong>Started:</strong> <span class="timestamp">${startTime.toLocaleString()}</span></p>
                <p><strong>Failed:</strong> <span class="timestamp">${new Date().toLocaleString()}</span></p>
            </div>
            
            <div class="error-box">
                <strong>Error Details:</strong><br>
                ${errorMessage}
            </div>
            
            <p>Please investigate this issue and take appropriate action to restore the workflow.</p>
            
            <a href="${dashboardUrl}/data-sync" class="button">View Dashboard</a>
            <a href="${dashboardUrl}/data-sync/workflow/${executionId}" class="button">View Execution Details</a>
        </div>
        
        <div class="footer">
            <p>Network CMDB Alert System</p>
            <p style="font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
🚨 WORKFLOW FAILURE ALERT

Workflow "${workflowName}" has failed.

Execution Details:
- Execution ID: ${executionId}
- Workflow: ${workflowName}
- Started: ${startTime.toLocaleString()}
- Failed: ${new Date().toLocaleString()}

Error Details:
${errorMessage}

Please investigate this issue and take appropriate action to restore the workflow.

Dashboard: ${dashboardUrl}/data-sync
Execution Details: ${dashboardUrl}/data-sync/workflow/${executionId}

---
Network CMDB Alert System
This is an automated message. Please do not reply to this email.
`;

  return { subject, html, text };
}

export function getWorkflowSuccessTemplate(
  workflowName: string,
  executionId: string,
  startTime: Date,
  endTime: Date,
  resourcesProcessed: number,
  dashboardUrl: string
): EmailTemplate {
  const duration = Math.round((endTime.getTime() - startTime.getTime()) / 1000);
  const subject = `✅ Workflow Success: ${workflowName}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Workflow Success Notification</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #28a745; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .content { background: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
        .footer { background: #6c757d; color: white; padding: 15px; border-radius: 0 0 5px 5px; text-align: center; }
        .success-icon { font-size: 24px; margin-right: 10px; }
        .details { background: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .button { display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; margin: 10px 0; }
        .stats { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 10px; border-radius: 5px; }
        .timestamp { color: #6c757d; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <span class="success-icon">✅</span>
            <strong>Workflow Success Notification</strong>
        </div>
        
        <div class="content">
            <h2>Workflow "${workflowName}" completed successfully</h2>
            
            <div class="details">
                <p><strong>Execution ID:</strong> ${executionId}</p>
                <p><strong>Workflow:</strong> ${workflowName}</p>
                <p><strong>Started:</strong> <span class="timestamp">${startTime.toLocaleString()}</span></p>
                <p><strong>Completed:</strong> <span class="timestamp">${endTime.toLocaleString()}</span></p>
                <p><strong>Duration:</strong> ${duration} seconds</p>
            </div>
            
            <div class="stats">
                <strong>Resources Processed:</strong> ${resourcesProcessed}
            </div>
            
            <a href="${dashboardUrl}/data-sync" class="button">View Dashboard</a>
        </div>
        
        <div class="footer">
            <p>Network CMDB Alert System</p>
            <p style="font-size: 12px;">This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>`;

  const text = `
✅ WORKFLOW SUCCESS NOTIFICATION

Workflow "${workflowName}" completed successfully.

Execution Details:
- Execution ID: ${executionId}
- Workflow: ${workflowName}
- Started: ${startTime.toLocaleString()}
- Completed: ${endTime.toLocaleString()}
- Duration: ${duration} seconds
- Resources Processed: ${resourcesProcessed}

Dashboard: ${dashboardUrl}/data-sync

---
Network CMDB Alert System
This is an automated message. Please do not reply to this email.
`;

  return { subject, html, text };
}

export default {
  getEmailConfig,
  createEmailTransporter,
  getWorkflowFailureTemplate,
  getWorkflowSuccessTemplate
};