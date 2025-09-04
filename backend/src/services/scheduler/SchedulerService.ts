/**
 * Scheduler Service
 * Handles scheduled report generation and email delivery
 */

import * as cron from 'node-cron';
import * as nodemailer from 'nodemailer';
import {
  ReportSchedule,
  ReportExecution,
  ReportDefinition,
  ReportApiResponse,
  ExecutionStatus,
  ScheduleFrequency,
  EmailDelivery
} from '../../types/reports';
import { ReportingService } from './ReportingService';
import { ExportService } from './ExportService';

interface ScheduledJob {
  id: string;
  reportId: number;
  schedule: ReportSchedule;
  task: cron.ScheduledTask;
}

export class SchedulerService {
  private reportingService: ReportingService;
  private exportService: ExportService;
  private emailTransporter: nodemailer.Transporter;
  private scheduledJobs: Map<string, ScheduledJob> = new Map();

  constructor(
    reportingService: ReportingService,
    exportService: ExportService,
    emailConfig?: nodemailer.TransportOptions
  ) {
    this.reportingService = reportingService;
    this.exportService = exportService;
    
    // Initialize email transporter
    this.emailTransporter = nodemailer.createTransporter(
      emailConfig || {
        host: process.env.SMTP_HOST || 'localhost',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      }
    );
  }

  /**
   * Schedule a report for automatic generation
   */
  async scheduleReport(reportId: number, reportDefinition: ReportDefinition): Promise<ReportApiResponse> {
    try {
      if (!reportDefinition.schedule?.enabled) {
        return {
          success: false,
          errors: [{
            code: 'SCHEDULE_DISABLED',
            message: 'Report schedule is not enabled'
          }]
        };
      }

      const schedule = reportDefinition.schedule;
      const jobId = `report_${reportId}`;

      // Remove existing job if it exists
      if (this.scheduledJobs.has(jobId)) {
        await this.unscheduleReport(reportId);
      }

      // Generate cron expression
      const cronExpression = schedule.cronExpression || this.generateCronExpression(schedule);

      if (!cron.validate(cronExpression)) {
        return {
          success: false,
          errors: [{
            code: 'INVALID_CRON',
            message: `Invalid cron expression: ${cronExpression}`
          }]
        };
      }

      // Create scheduled task
      const task = cron.schedule(cronExpression, async () => {
        await this.executeScheduledReport(reportId, reportDefinition);
      }, {
        scheduled: false,
        timezone: schedule.timezone || 'UTC'
      });

      // Store job reference
      this.scheduledJobs.set(jobId, {
        id: jobId,
        reportId,
        schedule,
        task
      });

      // Start the task
      task.start();

      return {
        success: true,
        data: {
          jobId,
          cronExpression,
          nextRun: this.getNextRunTime(cronExpression),
          status: 'scheduled'
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          code: 'SCHEDULE_ERROR',
          message: `Failed to schedule report: ${error.message}`
        }]
      };
    }
  }

  /**
   * Unschedule a report
   */
  async unscheduleReport(reportId: number): Promise<ReportApiResponse> {
    try {
      const jobId = `report_${reportId}`;
      const job = this.scheduledJobs.get(jobId);

      if (!job) {
        return {
          success: false,
          errors: [{
            code: 'JOB_NOT_FOUND',
            message: `Scheduled job not found for report ${reportId}`
          }]
        };
      }

      // Destroy the cron task
      job.task.destroy();
      this.scheduledJobs.delete(jobId);

      return {
        success: true,
        data: {
          jobId,
          status: 'unscheduled'
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [{
          code: 'UNSCHEDULE_ERROR',
          message: `Failed to unschedule report: ${error.message}`
        }]
      };
    }
  }

  /**
   * Get all scheduled jobs
   */
  getScheduledJobs(): ScheduledJob[] {
    return Array.from(this.scheduledJobs.values());
  }

  /**
   * Execute a scheduled report
   */
  private async executeScheduledReport(reportId: number, reportDefinition: ReportDefinition): Promise<void> {
    const execution: ReportExecution = {
      reportId,
      status: 'running' as ExecutionStatus,
      startTime: new Date(),
      executedBy: 0, // System execution
      parameters: reportDefinition.schedule?.parameters
    };

    try {
      console.log(`Executing scheduled report ${reportId}`);

      // Execute the report
      const reportResult = await this.reportingService.executeReport(reportDefinition.query);

      if (!reportResult.success) {
        throw new Error(reportResult.errors?.[0]?.message || 'Report execution failed');
      }

      execution.status = 'completed';
      execution.endTime = new Date();
      execution.executionTime = execution.endTime.getTime() - execution.startTime.getTime();
      execution.recordCount = reportResult.data?.results?.length || 0;

      // Handle delivery
      if (reportDefinition.schedule?.delivery) {
        await this.handleReportDelivery(reportDefinition, reportResult.data, execution);
      }

      console.log(`Scheduled report ${reportId} completed successfully`);
    } catch (error) {
      execution.status = 'failed';
      execution.endTime = new Date();
      execution.errorMessage = error.message;
      
      console.error(`Scheduled report ${reportId} failed:`, error.message);
      
      // Optionally send error notification
      await this.sendErrorNotification(reportDefinition, error.message);
    }
  }

  /**
   * Handle report delivery (email, webhook, storage)
   */
  private async handleReportDelivery(
    reportDefinition: ReportDefinition,
    reportData: any,
    execution: ReportExecution
  ): Promise<void> {
    const delivery = reportDefinition.schedule?.delivery;
    if (!delivery) return;

    // Email delivery
    if (delivery.method.includes('email') && delivery.email) {
      await this.sendEmailDelivery(reportDefinition, reportData, delivery.email, execution);
    }

    // Webhook delivery
    if (delivery.method.includes('webhook') && delivery.webhook) {
      await this.sendWebhookDelivery(reportData, delivery.webhook);
    }

    // Storage delivery
    if (delivery.method.includes('storage') && delivery.storage) {
      await this.handleStorageDelivery(reportData, delivery.storage);
    }
  }

  /**
   * Send report via email
   */
  private async sendEmailDelivery(
    reportDefinition: ReportDefinition,
    reportData: any,
    emailConfig: EmailDelivery,
    execution: ReportExecution
  ): Promise<void> {
    try {
      const attachments: any[] = [];

      // Generate report files for each requested format
      for (const format of emailConfig.formats) {
        const exportResult = await this.exportService.exportData(
          reportData.results,
          format,
          { format, includeCharts: emailConfig.includeCharts },
          {
            title: reportDefinition.name,
            generatedAt: new Date(),
            executionTime: execution.executionTime,
            recordCount: execution.recordCount
          }
        );

        if (exportResult.success) {
          attachments.push({
            filename: exportResult.data!.fileName,
            path: exportResult.data!.filePath
          });
        }
      }

      // Prepare email content
      const subject = emailConfig.subject || `Scheduled Report: ${reportDefinition.name}`;
      const htmlBody = this.generateEmailBody(reportDefinition, reportData, execution);

      // Send email
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'reports@networkdb.com',
        to: emailConfig.recipients.join(', '),
        subject,
        html: htmlBody,
        attachments
      });

      console.log(`Report emailed to ${emailConfig.recipients.length} recipients`);
    } catch (error) {
      console.error('Failed to send email delivery:', error);
      throw error;
    }
  }

  /**
   * Send report via webhook
   */
  private async sendWebhookDelivery(reportData: any, webhookConfig: any): Promise<void> {
    // Implementation for webhook delivery
    console.log('Webhook delivery not implemented yet');
  }

  /**
   * Handle storage delivery
   */
  private async handleStorageDelivery(reportData: any, storageConfig: any): Promise<void> {
    // Implementation for storage delivery
    console.log('Storage delivery not implemented yet');
  }

  /**
   * Generate email body for report delivery
   */
  private generateEmailBody(
    reportDefinition: ReportDefinition,
    reportData: any,
    execution: ReportExecution
  ): string {
    return `
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .header { background-color: #f5f5f5; padding: 20px; text-align: center; }
          .content { padding: 20px; }
          .stats { background-color: #e7f3ff; padding: 15px; margin: 15px 0; }
          .footer { background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Scheduled Report: ${reportDefinition.name}</h1>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="content">
          <h2>Report Summary</h2>
          <div class="stats">
            <p><strong>Total Records:</strong> ${execution.recordCount}</p>
            <p><strong>Execution Time:</strong> ${execution.executionTime}ms</p>
            <p><strong>Status:</strong> ${execution.status}</p>
          </div>
          
          ${reportDefinition.description ? `<p><strong>Description:</strong> ${reportDefinition.description}</p>` : ''}
          
          <p>Please find the report attached in the requested format(s).</p>
        </div>
        
        <div class="footer">
          <p>This is an automated message from Network CMDB Reporting System</p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send error notification
   */
  private async sendErrorNotification(reportDefinition: ReportDefinition, errorMessage: string): Promise<void> {
    try {
      if (reportDefinition.schedule?.delivery?.email?.recipients) {
        await this.emailTransporter.sendMail({
          from: process.env.SMTP_FROM || 'reports@networkdb.com',
          to: reportDefinition.schedule.delivery.email.recipients.join(', '),
          subject: `Report Generation Failed: ${reportDefinition.name}`,
          html: `
            <h2>Report Generation Failed</h2>
            <p><strong>Report:</strong> ${reportDefinition.name}</p>
            <p><strong>Error:</strong> ${errorMessage}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            <p>Please check the report configuration and try again.</p>
          `
        });
      }
    } catch (error) {
      console.error('Failed to send error notification:', error);
    }
  }

  /**
   * Generate cron expression from schedule frequency
   */
  private generateCronExpression(schedule: ReportSchedule): string {
    const { frequency } = schedule;

    switch (frequency) {
      case 'daily':
        return '0 9 * * *'; // 9 AM daily
      case 'weekly':
        return '0 9 * * 1'; // 9 AM every Monday
      case 'monthly':
        return '0 9 1 * *'; // 9 AM on 1st of month
      case 'quarterly':
        return '0 9 1 1,4,7,10 *'; // 9 AM on 1st of quarter months
      case 'custom':
        return schedule.cronExpression || '0 9 * * *';
      default:
        return '0 9 * * *';
    }
  }

  /**
   * Get next run time for a cron expression
   */
  private getNextRunTime(cronExpression: string): Date | null {
    try {
      // This is a simplified implementation
      // In production, you'd use a proper cron parser
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // Next day as fallback
    } catch {
      return null;
    }
  }

  /**
   * Stop all scheduled jobs
   */
  async stopAllJobs(): Promise<void> {
    for (const [jobId, job] of this.scheduledJobs) {
      try {
        job.task.destroy();
        console.log(`Stopped scheduled job: ${jobId}`);
      } catch (error) {
        console.error(`Error stopping job ${jobId}:`, error);
      }
    }
    this.scheduledJobs.clear();
  }
}