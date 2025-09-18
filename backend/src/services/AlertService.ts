/**
 * Alert Service
 * Handles email notifications for workflow failures and status updates
 * Implements throttling, recipient management, and graceful degradation
 */

import nodemailer from 'nodemailer';
import { Op } from 'sequelize';
import { WorkflowAlert } from '../models/WorkflowAlert';
import { WorkflowExecution } from '../models/WorkflowExecution';
import { WorkflowRegistry } from '../models/WorkflowRegistry';
import { 
  createEmailTransporter, 
  getEmailConfig, 
  getWorkflowFailureTemplate,
  getWorkflowSuccessTemplate,
  EmailTemplate 
} from '../config/email';

export interface AlertRecipient {
  email: string;
  name?: string;
  workflowTypes?: string[];
  alertTypes?: ('failure' | 'success' | 'manual_trigger')[];
}

export interface AlertServiceConfig {
  enabled: boolean;
  defaultRecipients: AlertRecipient[];
  throttleEnabled: boolean;
}

export interface AlertContext {
  workflowId: string;
  workflowName: string;
  executionId: string;
  alertType: 'failure' | 'success' | 'manual_trigger';
  executionData?: any;
  recipients?: string[];
}

export interface AlertServiceResponse {
  success: boolean;
  alertId?: number;
  error?: string;
  skipped?: boolean;
  reason?: string;
}

export class AlertService {
  private transporter: nodemailer.Transporter | null;
  private config: AlertServiceConfig;
  private emailConfig: any;

  constructor(customConfig?: Partial<AlertServiceConfig>) {
    this.emailConfig = getEmailConfig();
    this.transporter = createEmailTransporter();
    
    this.config = {
      enabled: process.env.ALERTS_ENABLED !== 'false',
      throttleEnabled: process.env.ALERT_THROTTLE_ENABLED !== 'false',
      defaultRecipients: this.parseDefaultRecipients(),
      ...customConfig
    };

    console.log(`Alert Service initialized - Enabled: ${this.config.enabled}, SMTP: ${this.transporter ? 'Available' : 'Unavailable'}`);
  }

  private parseDefaultRecipients(): AlertRecipient[] {
    try {
      const recipientsEnv = process.env.ALERT_DEFAULT_RECIPIENTS;
      if (!recipientsEnv) {
        return [];
      }

      if (recipientsEnv.includes('@')) {
        // Simple email list format: "email1@domain.com,email2@domain.com"
        return recipientsEnv.split(',').map(email => ({
          email: email.trim(),
          alertTypes: ['failure', 'success', 'manual_trigger']
        }));
      } else {
        // JSON format with full recipient configuration
        return JSON.parse(recipientsEnv);
      }
    } catch (error) {
      console.warn('Failed to parse default recipients, using empty list:', error);
      return [];
    }
  }

  /**
   * Send workflow failure alert
   */
  async sendFailureAlert(
    executionId: string,
    customRecipients?: string[]
  ): Promise<AlertServiceResponse> {
    try {
      if (!this.config.enabled) {
        return {
          success: false,
          skipped: true,
          reason: 'Alert service disabled'
        };
      }

      // Get execution and workflow details
      const execution = await WorkflowExecution.findOne({
        where: { execution_id: executionId },
        include: [{
          model: WorkflowRegistry,
          as: 'workflow'
        }]
      });

      if (!execution) {
        return {
          success: false,
          error: `Execution ${executionId} not found`
        };
      }

      // Check throttling
      if (this.config.throttleEnabled) {
        const shouldThrottle = await this.shouldThrottleAlert(execution.workflow_id, 'failure');
        if (shouldThrottle) {
          return {
            success: false,
            skipped: true,
            reason: 'Alert throttled - too many alerts sent recently'
          };
        }
      }

      const workflowName = (execution as any).workflow?.workflow_name || execution.workflow_id;
      
      const alertContext: AlertContext = {
        workflowId: execution.workflow_id,
        workflowName,
        executionId,
        alertType: 'failure',
        executionData: execution,
        recipients: customRecipients
      };

      return await this.sendAlert(alertContext);

    } catch (error) {
      console.error('Failed to send failure alert:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send workflow success notification
   */
  async sendSuccessAlert(
    executionId: string,
    customRecipients?: string[]
  ): Promise<AlertServiceResponse> {
    try {
      if (!this.config.enabled) {
        return {
          success: false,
          skipped: true,
          reason: 'Alert service disabled'
        };
      }

      const execution = await WorkflowExecution.findOne({
        where: { execution_id: executionId },
        include: [{
          model: WorkflowRegistry,
          as: 'workflow'
        }]
      });

      if (!execution) {
        return {
          success: false,
          error: `Execution ${executionId} not found`
        };
      }

      const workflowName = (execution as any).workflow?.workflow_name || execution.workflow_id;
      
      const alertContext: AlertContext = {
        workflowId: execution.workflow_id,
        workflowName,
        executionId,
        alertType: 'success',
        executionData: execution,
        recipients: customRecipients
      };

      return await this.sendAlert(alertContext);

    } catch (error) {
      console.error('Failed to send success alert:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send manual trigger notification
   */
  async sendManualTriggerAlert(
    workflowId: string,
    executionId: string,
    triggeredBy: string,
    customRecipients?: string[]
  ): Promise<AlertServiceResponse> {
    try {
      if (!this.config.enabled) {
        return {
          success: false,
          skipped: true,
          reason: 'Alert service disabled'
        };
      }

      const workflow = await WorkflowRegistry.findOne({
        where: { workflow_id: workflowId }
      });

      if (!workflow) {
        return {
          success: false,
          error: `Workflow ${workflowId} not found`
        };
      }

      const alertContext: AlertContext = {
        workflowId,
        workflowName: workflow.workflow_name,
        executionId,
        alertType: 'manual_trigger',
        executionData: { triggeredBy },
        recipients: customRecipients
      };

      return await this.sendAlert(alertContext);

    } catch (error) {
      console.error('Failed to send manual trigger alert:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Core alert sending logic
   */
  private async sendAlert(context: AlertContext): Promise<AlertServiceResponse> {
    try {
      // Graceful degradation if SMTP unavailable
      if (!this.transporter) {
        console.warn(`Alert would be sent for ${context.alertType} on ${context.workflowName} but SMTP unavailable`);
        
        // Still create alert record for tracking
        const alert = await this.createAlertRecord(context, ['smtp-unavailable@localhost']);
        
        return {
          success: false,
          alertId: alert.id,
          error: 'SMTP service unavailable',
          skipped: true,
          reason: 'SMTP service unavailable - alert logged but not sent'
        };
      }

      // Determine recipients
      const recipients = this.determineRecipients(context);
      if (recipients.length === 0) {
        return {
          success: false,
          skipped: true,
          reason: 'No recipients configured for this alert type'
        };
      }

      // Generate email template
      const template = this.generateEmailTemplate(context);
      
      // Send emails
      const sendResults = await this.sendEmails(recipients, template);
      
      // Create alert record
      const alert = await this.createAlertRecord(context, recipients);
      
      const successCount = sendResults.filter(r => r.success).length;
      const totalCount = sendResults.length;

      console.log(`Alert sent: ${context.alertType} for ${context.workflowName} to ${successCount}/${totalCount} recipients`);

      return {
        success: successCount > 0,
        alertId: alert.id,
        error: successCount === 0 ? 'Failed to send to any recipients' : undefined
      };

    } catch (error) {
      console.error('Alert sending failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Determine recipients for alert
   */
  private determineRecipients(context: AlertContext): string[] {
    // Use custom recipients if provided
    if (context.recipients && context.recipients.length > 0) {
      return context.recipients;
    }

    // Use default recipients filtered by alert type
    const filteredRecipients = this.config.defaultRecipients.filter(recipient => {
      return !recipient.alertTypes || recipient.alertTypes.includes(context.alertType);
    });

    return filteredRecipients.map(r => r.email);
  }

  /**
   * Generate email template based on alert type
   */
  private generateEmailTemplate(context: AlertContext): EmailTemplate {
    const dashboardUrl = this.emailConfig.templates.baseUrl;

    switch (context.alertType) {
      case 'failure':
        const execution = context.executionData;
        return getWorkflowFailureTemplate(
          context.workflowName,
          context.executionId,
          execution?.error_message || 'Unknown error',
          execution?.start_time || new Date(),
          dashboardUrl
        );

      case 'success':
        const successExecution = context.executionData;
        return getWorkflowSuccessTemplate(
          context.workflowName,
          context.executionId,
          successExecution?.start_time || new Date(),
          successExecution?.end_time || new Date(),
          (successExecution?.resources_created || 0) + (successExecution?.resources_updated || 0),
          dashboardUrl
        );

      case 'manual_trigger':
        const triggeredBy = context.executionData?.triggeredBy || 'Unknown user';
        return {
          subject: `🔧 Manual Trigger: ${context.workflowName}`,
          html: `
            <h2>Workflow Manually Triggered</h2>
            <p><strong>Workflow:</strong> ${context.workflowName}</p>
            <p><strong>Execution ID:</strong> ${context.executionId}</p>
            <p><strong>Triggered By:</strong> ${triggeredBy}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p><a href="${dashboardUrl}/data-sync">View Dashboard</a></p>
          `,
          text: `
Workflow Manually Triggered

Workflow: ${context.workflowName}
Execution ID: ${context.executionId}
Triggered By: ${triggeredBy}
Time: ${new Date().toLocaleString()}

Dashboard: ${dashboardUrl}/data-sync
          `
        };

      default:
        throw new Error(`Unknown alert type: ${context.alertType}`);
    }
  }

  /**
   * Send emails to recipients
   */
  private async sendEmails(recipients: string[], template: EmailTemplate): Promise<Array<{email: string, success: boolean, error?: string}>> {
    const results = [];

    for (const email of recipients) {
      try {
        const info = await this.transporter!.sendMail({
          from: `"${this.emailConfig.from.name}" <${this.emailConfig.from.address}>`,
          to: email,
          subject: template.subject,
          text: template.text,
          html: template.html
        });

        results.push({
          email,
          success: true,
          messageId: info.messageId
        });

      } catch (error) {
        console.error(`Failed to send email to ${email}:`, error);
        results.push({
          email,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Create alert record in database
   */
  private async createAlertRecord(context: AlertContext, recipients: string[]): Promise<WorkflowAlert> {
    return await WorkflowAlert.create({
      execution_id: context.executionId,
      alert_type: context.alertType,
      recipients: recipients.join(','),
      sent_at: new Date()
    });
  }

  /**
   * Check if alert should be throttled
   */
  private async shouldThrottleAlert(workflowId: string, alertType: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    // Check global throttle
    const globalAlertCount = await WorkflowAlert.count({
      where: {
        alert_type: alertType,
        sent_at: {
          [Op.gte]: oneHourAgo
        }
      }
    });

    if (globalAlertCount >= this.emailConfig.throttle.maxAlertsPerHour) {
      console.warn(`Global alert throttle hit: ${globalAlertCount} ${alertType} alerts in last hour`);
      return true;
    }

    // Check per-workflow throttle
    const workflowAlertCount = await WorkflowAlert.count({
      include: [{
        model: WorkflowExecution,
        where: { workflow_id: workflowId },
        attributes: []
      }],
      where: {
        alert_type: alertType,
        sent_at: {
          [Op.gte]: oneHourAgo
        }
      }
    });

    if (workflowAlertCount >= this.emailConfig.throttle.maxAlertsPerWorkflowPerHour) {
      console.warn(`Workflow alert throttle hit: ${workflowAlertCount} ${alertType} alerts for workflow ${workflowId} in last hour`);
      return true;
    }

    return false;
  }

  /**
   * Resolve an alert (mark as resolved)
   */
  async resolveAlert(alertId: number): Promise<boolean> {
    try {
      const [updatedCount] = await WorkflowAlert.update(
        { resolved_at: new Date() },
        { where: { id: alertId, resolved_at: null } }
      );

      return updatedCount > 0;
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      return false;
    }
  }

  /**
   * Get alert history with pagination
   */
  async getAlertHistory(options: {
    page?: number;
    limit?: number;
    workflowId?: string;
    alertType?: string;
    resolved?: boolean;
  } = {}): Promise<{
    alerts: WorkflowAlert[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const { page = 1, limit = 20, workflowId, alertType, resolved } = options;

    const whereClause: any = {};
    if (alertType) whereClause.alert_type = alertType;
    if (resolved !== undefined) {
      whereClause.resolved_at = resolved ? { [Op.not]: null } : null;
    }

    const includeClause: any = [{
      model: WorkflowExecution,
      include: [{ model: WorkflowRegistry, as: 'workflow' }]
    }];

    if (workflowId) {
      includeClause[0].where = { workflow_id: workflowId };
    }

    const { count, rows } = await WorkflowAlert.findAndCountAll({
      where: whereClause,
      include: includeClause,
      order: [['sent_at', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });

    return {
      alerts: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit)
    };
  }

  /**
   * Test email configuration
   */
  async testEmailConfig(testEmail: string): Promise<{success: boolean, error?: string}> {
    try {
      if (!this.transporter) {
        return { success: false, error: 'SMTP transporter not configured' };
      }

      const info = await this.transporter.sendMail({
        from: `"${this.emailConfig.from.name}" <${this.emailConfig.from.address}>`,
        to: testEmail,
        subject: 'Network CMDB Alert Service Test',
        text: 'This is a test email from the Network CMDB alert service. If you receive this, email configuration is working correctly.',
        html: `
          <h2>Alert Service Test</h2>
          <p>This is a test email from the Network CMDB alert service.</p>
          <p>If you receive this, email configuration is working correctly.</p>
          <p><em>Sent at: ${new Date().toLocaleString()}</em></p>
        `
      });

      console.log('Test email sent successfully:', info.messageId);
      return { success: true };

    } catch (error) {
      console.error('Test email failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Health check for alert service
   */
  getServiceHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy';
    details: any;
  } {
    const smtpAvailable = this.transporter !== null;
    const serviceEnabled = this.config.enabled;
    const recipientsConfigured = this.config.defaultRecipients.length > 0;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    
    if (serviceEnabled && smtpAvailable && recipientsConfigured) {
      status = 'healthy';
    } else if (serviceEnabled && (smtpAvailable || recipientsConfigured)) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      details: {
        enabled: serviceEnabled,
        smtpAvailable,
        recipientsConfigured,
        defaultRecipientCount: this.config.defaultRecipients.length,
        throttleEnabled: this.config.throttleEnabled
      }
    };
  }
}

// Export singleton instance
export const alertService = new AlertService();
export default alertService;