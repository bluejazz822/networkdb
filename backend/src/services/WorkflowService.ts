/**
 * Workflow Service
 * High-level service layer that provides unified workflow management operations
 * Acts as a bridge between the controller layer and N8nService/database models
 */

import { N8nService } from './N8nService';
import { AlertService } from './AlertService';
import { WorkflowRegistry } from '../models/WorkflowRegistry';
import { WorkflowExecution } from '../models/WorkflowExecution';
import { WorkflowAlert } from '../models/WorkflowAlert';
import { ReportSchedule } from '../models/ReportSchedule';
import { ScheduleExecution } from '../models/ScheduleExecution';
import { DeliveryLog } from '../models/DeliveryLog';
import { SchedulerService } from './scheduler/SchedulerService';
import { ReportService } from './ReportService';
import Joi from 'joi';
import { Op } from 'sequelize';
import {
  N8nWorkflow,
  N8nWorkflowExecution,
  WorkflowExecutionStats,
  N8nErrorCode
} from '../types/workflow';

export interface WorkflowFilters {
  page?: number;
  limit?: number;
  type?: 'vpc' | 'subnet' | 'transit_gateway' | 'nat_gateway' | 'vpn';
  provider?: 'aws' | 'azure' | 'gcp' | 'ali' | 'oci' | 'huawei' | 'others';
  active?: boolean;
  search?: string;
  tags?: string[];
}

export interface ExecutionFilters {
  page?: number;
  limit?: number;
  status?: 'success' | 'failure' | 'running' | 'cancelled';
  dateFrom?: Date;
  dateTo?: Date;
}

export interface WorkflowServiceError {
  code: N8nErrorCode | 'VALIDATION_ERROR' | 'DATABASE_ERROR';
  message: string;
  details?: any;
}

export interface WorkflowServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: WorkflowServiceError;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface DashboardMetrics {
  totalWorkflows: number;
  activeWorkflows: number;
  inactiveWorkflows: number;
  runningExecutions: number;
  totalExecutionsToday: number;
  successfulExecutionsToday: number;
  failedExecutionsToday: number;
  averageExecutionTime: number;
  systemHealth: 'healthy' | 'degraded' | 'unhealthy';
  lastSyncTime: string;
}

/**
 * Validation schemas for service inputs
 */
export const workflowValidationSchemas = {
  workflowFilters: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    type: Joi.string().valid('vpc', 'subnet', 'transit_gateway', 'nat_gateway', 'vpn').optional(),
    provider: Joi.string().valid('aws', 'azure', 'gcp', 'ali', 'oci', 'huawei', 'others').optional(),
    active: Joi.boolean().optional(),
    search: Joi.string().max(500).optional(),
    tags: Joi.array().items(Joi.string().max(50)).optional()
  }),

  executionFilters: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('success', 'failure', 'running', 'cancelled').optional(),
    dateFrom: Joi.date().optional(),
    dateTo: Joi.date().optional()
  }),

  workflowId: Joi.string().uuid().required(),

  triggerParameters: Joi.object({
    input: Joi.object().optional(),
    startNodes: Joi.array().items(Joi.string()).optional(),
    destinationNode: Joi.string().optional(),
    pinData: Joi.object().optional()
  })
};

/**
 * WorkflowService - Main service class for workflow management
 */
export class WorkflowService {
  private n8nService: N8nService;
  private alertService: AlertService;

  constructor() {
    this.n8nService = new N8nService();
    this.alertService = new AlertService();
  }

  /**
   * Validate input parameters using Joi schema
   */
  private validateInput<T>(schema: Joi.Schema, data: any): { value: T; error?: string } {
    const { error, value } = schema.validate(data);
    return {
      value: value as T,
      error: error?.details[0]?.message
    };
  }

  /**
   * Create error response
   */
  private createErrorResponse(error: WorkflowServiceError): WorkflowServiceResponse<any> {
    return {
      success: false,
      error
    };
  }

  /**
   * Create success response with optional pagination
   */
  private createSuccessResponse<T>(data: T, pagination?: any): WorkflowServiceResponse<T> {
    return {
      success: true,
      data,
      ...(pagination && { pagination })
    };
  }

  /**
   * Calculate pagination metadata
   */
  private calculatePagination(page: number, limit: number, total: number) {
    const totalPages = Math.ceil(total / limit);
    return {
      page,
      limit,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    };
  }

  /**
   * Get workflows with filtering and pagination
   */
  async getWorkflows(filters: WorkflowFilters): Promise<WorkflowServiceResponse<WorkflowRegistry[]>> {
    try {
      // Validate input
      const { value: validatedFilters, error } = this.validateInput<WorkflowFilters>(
        workflowValidationSchemas.workflowFilters,
        filters
      );

      if (error) {
        return this.createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: error
        });
      }

      const { page = 1, limit = 20, type, provider, active, search } = validatedFilters;

      // Build database query
      const whereClause: any = {};

      if (type) whereClause.workflow_type = type;
      if (provider) whereClause.provider = provider;
      if (active !== undefined) whereClause.is_active = active;
      if (search) {
        whereClause.workflow_name = {
          [Op.iLike]: `%${search}%`
        };
      }

      const { count, rows } = await WorkflowRegistry.findAndCountAll({
        where: whereClause,
        order: [['updated_at', 'DESC']],
        limit,
        offset: (page - 1) * limit
      });

      const pagination = this.calculatePagination(page, limit, count);

      return this.createSuccessResponse(rows, pagination);

    } catch (dbError) {
      return this.createErrorResponse({
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve workflows',
        details: dbError
      });
    }
  }

  /**
   * Get execution history for a specific workflow
   */
  async getExecutionHistory(
    workflowId: string,
    filters: ExecutionFilters
  ): Promise<WorkflowServiceResponse<WorkflowExecution[]>> {
    try {
      // Validate workflow ID
      const { error: idError } = this.validateInput(workflowValidationSchemas.workflowId, workflowId);
      if (idError) {
        return this.createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: idError
        });
      }

      // Validate filters
      const { value: validatedFilters, error } = this.validateInput<ExecutionFilters>(
        workflowValidationSchemas.executionFilters,
        filters
      );

      if (error) {
        return this.createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: error
        });
      }

      const { page = 1, limit = 20, status, dateFrom, dateTo } = validatedFilters;

      // Check if workflow exists
      const workflow = await WorkflowRegistry.findOne({
        where: { workflow_id: workflowId }
      });

      if (!workflow) {
        return this.createErrorResponse({
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow with ID ${workflowId} not found`
        });
      }

      // Build query for executions
      const whereClause: any = { workflow_id: workflowId };

      if (status) whereClause.status = status;
      if (dateFrom || dateTo) {
        whereClause.start_time = {};
        if (dateFrom) whereClause.start_time[Op.gte] = dateFrom;
        if (dateTo) whereClause.start_time[Op.lte] = dateTo;
      }

      const { count, rows } = await WorkflowExecution.findAndCountAll({
        where: whereClause,
        order: [['start_time', 'DESC']],
        limit,
        offset: (page - 1) * limit
      });

      const pagination = this.calculatePagination(page, limit, count);

      return this.createSuccessResponse(rows, pagination);

    } catch (dbError) {
      return this.createErrorResponse({
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve execution history',
        details: dbError
      });
    }
  }

  /**
   * Execute a workflow manually
   */
  async executeWorkflow(
    workflowId: string,
    parameters: any = {},
    userId?: string
  ): Promise<WorkflowServiceResponse<N8nWorkflowExecution>> {
    try {
      // Validate workflow ID
      const { error: idError } = this.validateInput(workflowValidationSchemas.workflowId, workflowId);
      if (idError) {
        return this.createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: idError
        });
      }

      // Validate parameters
      const { value: validatedParams, error } = this.validateInput(
        workflowValidationSchemas.triggerParameters,
        parameters
      );

      if (error) {
        return this.createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: error
        });
      }

      // Check if workflow exists and is active
      const workflow = await WorkflowRegistry.findOne({
        where: { workflow_id: workflowId }
      });

      if (!workflow) {
        return this.createErrorResponse({
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow with ID ${workflowId} not found`
        });
      }

      if (!workflow.is_active) {
        return this.createErrorResponse({
          code: 'WORKFLOW_INACTIVE',
          message: `Workflow ${workflowId} is inactive and cannot be executed`
        });
      }

      // Execute via N8nService
      const executionResponse = await this.n8nService.executeWorkflow(workflowId, validatedParams);

      if (!executionResponse.success) {
        return this.createErrorResponse({
          code: executionResponse.error?.code || 'WORKFLOW_EXECUTION_ERROR',
          message: executionResponse.error?.message || 'Workflow execution failed',
          details: executionResponse.error?.details
        });
      }

      return this.createSuccessResponse(executionResponse.data!);

    } catch (error) {
      return this.createErrorResponse({
        code: 'WORKFLOW_EXECUTION_ERROR',
        message: 'Failed to execute workflow',
        details: error
      });
    }
  }

  /**
   * Get dashboard metrics and summary statistics
   */
  async getDashboardMetrics(timeRange: 'last24h' | 'last7d' | 'last30d' = 'last24h'): Promise<WorkflowServiceResponse<DashboardMetrics>> {
    try {
      const now = new Date();
      let startDate: Date;

      switch (timeRange) {
        case 'last24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case 'last7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
      }

      // Get real n8n workflow data
      const n8nWorkflowsResponse = await this.n8nService.discoverWorkflows();
      if (!n8nWorkflowsResponse.success) {
        return this.createErrorResponse({
          code: n8nWorkflowsResponse.error?.code || 'CONNECTION_ERROR',
          message: 'Failed to fetch workflows from n8n: ' + (n8nWorkflowsResponse.error?.message || 'Unknown error')
        });
      }

      const workflows = n8nWorkflowsResponse.data || [];
      const totalWorkflows = workflows.length;
      const activeWorkflows = workflows.filter(w => w.is_active).length;

      // Get execution data from n8n for each workflow
      let totalExecutionsToday = 0;
      let successfulExecutionsToday = 0;
      let failedExecutionsToday = 0;

      for (const workflow of workflows) {
        if (workflow.workflow_id) {
          const executionsResponse = await this.n8nService.getWorkflowExecutionHistory(workflow.workflow_id, 100, 0);

          if (executionsResponse.success && executionsResponse.data) {
            const executions = executionsResponse.data.executions;
            // Filter executions for today
            const todayExecutions = executions.filter(exec => {
              if (!exec.start_time) return false;
              const execDate = new Date(exec.start_time);
              return execDate >= startDate;
            });

            totalExecutionsToday += todayExecutions.length;
            successfulExecutionsToday += todayExecutions.filter(e => e.status === 'success').length;
            failedExecutionsToday += todayExecutions.filter(e => e.status === 'failure').length;
          }
        }
      }
      const runningExecutions = 0; // n8n doesn't track running in this simple format

      // Calculate average execution time (n8n doesn't provide duration easily)
      const averageExecutionTime = 0;

      // Determine system health
      const failureRate = totalExecutionsToday > 0 ? (failedExecutionsToday / totalExecutionsToday) : 0;
      let systemHealth: 'healthy' | 'degraded' | 'unhealthy';

      if (failureRate < 0.05) {
        systemHealth = 'healthy';
      } else if (failureRate < 0.2) {
        systemHealth = 'degraded';
      } else {
        systemHealth = 'unhealthy';
      }

      const metrics: DashboardMetrics = {
        totalWorkflows,
        activeWorkflows,
        inactiveWorkflows: totalWorkflows - activeWorkflows,
        runningExecutions,
        totalExecutionsToday,
        successfulExecutionsToday,
        failedExecutionsToday,
        averageExecutionTime,
        systemHealth,
        lastSyncTime: new Date().toISOString()
      };

      return this.createSuccessResponse(metrics);

    } catch (error) {
      return this.createErrorResponse({
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve dashboard metrics',
        details: error
      });
    }
  }

  /**
   * Get workflow analytics and statistics
   */
  async getWorkflowAnalytics(workflowId: string): Promise<WorkflowServiceResponse<WorkflowExecutionStats>> {
    try {
      // Validate workflow ID
      const { error: idError } = this.validateInput(workflowValidationSchemas.workflowId, workflowId);
      if (idError) {
        return this.createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: idError
        });
      }

      // Use N8nService to get workflow stats
      const statsResponse = await this.n8nService.getWorkflowStats(workflowId);

      if (!statsResponse.success) {
        return this.createErrorResponse({
          code: statsResponse.error?.code || 'WORKFLOW_NOT_FOUND',
          message: statsResponse.error?.message || 'Failed to retrieve workflow analytics',
          details: statsResponse.error?.details
        });
      }

      return this.createSuccessResponse(statsResponse.data!);

    } catch (error) {
      return this.createErrorResponse({
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve workflow analytics',
        details: error
      });
    }
  }

  /**
   * Send workflow failure alert
   */
  async sendWorkflowFailureAlert(executionId: string, customRecipients?: string[]): Promise<WorkflowServiceResponse<{alertSent: boolean, alertId?: number}>> {
    try {
      const alertResponse = await this.alertService.sendFailureAlert(executionId, customRecipients);
      
      return this.createSuccessResponse({
        alertSent: alertResponse.success,
        alertId: alertResponse.alertId
      });
    } catch (error) {
      return this.createErrorResponse({
        code: 'CONNECTION_ERROR',
        message: 'Failed to send failure alert',
        details: error
      });
    }
  }

  /**
   * Send workflow success alert
   */
  async sendWorkflowSuccessAlert(executionId: string, customRecipients?: string[]): Promise<WorkflowServiceResponse<{alertSent: boolean, alertId?: number}>> {
    try {
      const alertResponse = await this.alertService.sendSuccessAlert(executionId, customRecipients);
      
      return this.createSuccessResponse({
        alertSent: alertResponse.success,
        alertId: alertResponse.alertId
      });
    } catch (error) {
      return this.createErrorResponse({
        code: 'CONNECTION_ERROR',
        message: 'Failed to send success alert',
        details: error
      });
    }
  }

  /**
   * Get alert history
   */
  async getAlertHistory(options: {
    page?: number;
    limit?: number;
    workflowId?: string;
    alertType?: string;
    resolved?: boolean;
  } = {}): Promise<WorkflowServiceResponse<{
    alerts: WorkflowAlert[];
    total: number;
    page: number;
    totalPages: number;
  }>> {
    try {
      const alertHistory = await this.alertService.getAlertHistory(options);
      
      return this.createSuccessResponse(alertHistory);
    } catch (error) {
      return this.createErrorResponse({
        code: 'DATABASE_ERROR',
        message: 'Failed to retrieve alert history',
        details: error
      });
    }
  }

  /**
   * Test email configuration
   */
  async testEmailConfiguration(testEmail: string): Promise<WorkflowServiceResponse<{testSent: boolean}>> {
    try {
      const testResult = await this.alertService.testEmailConfig(testEmail);
      
      return this.createSuccessResponse({
        testSent: testResult.success
      });
    } catch (error) {
      return this.createErrorResponse({
        code: 'CONNECTION_ERROR',
        message: 'Failed to test email configuration',
        details: error
      });
    }
  }

  /**
   * Perform health check on workflow system
   */
  async healthCheck(): Promise<WorkflowServiceResponse<{ status: string; services: any; timestamp: string }>> {
    try {
      const healthStatus = {
        status: this.n8nService.isReady() ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          n8n: this.n8nService.isReady() ? 'connected' : 'disconnected',
          database: 'connected', // Assume connected if we can run this query
          cache: 'connected' // TODO: Add actual cache health check
        }
      };

      // Test database connection
      try {
        await WorkflowRegistry.count();
      } catch (dbError) {
        healthStatus.services.database = 'disconnected';
        healthStatus.status = 'unhealthy';
      }

      return this.createSuccessResponse(healthStatus);

    } catch (error) {
      return this.createErrorResponse({
        code: 'CONNECTION_ERROR',
        message: 'Health check failed',
        details: error
      });
    }
  }

  /**
   * Sync workflows from N8n to database
   */
  async syncWorkflows(): Promise<WorkflowServiceResponse<{ synced: number }>> {
    try {
      const syncResponse = await this.n8nService.discoverWorkflows();

      if (!syncResponse.success) {
        return this.createErrorResponse({
          code: syncResponse.error?.code || 'CONNECTION_ERROR',
          message: syncResponse.error?.message || 'Failed to sync workflows',
          details: syncResponse.error?.details
        });
      }

      return this.createSuccessResponse({
        synced: syncResponse.data?.length || 0
      });

    } catch (error) {
      return this.createErrorResponse({
        code: 'CONNECTION_ERROR',
        message: 'Failed to sync workflows',
        details: error
      });
    }
  }

  // ======================================
  // REPORT SCHEDULER INTEGRATION
  // ======================================

  private schedulerService: SchedulerService;
  private reportService: ReportService;

  /**
   * Initialize scheduler integration (call this after WorkflowService construction)
   */
  initializeScheduler() {
    if (!this.schedulerService) {
      this.schedulerService = new SchedulerService();
    }
    if (!this.reportService) {
      this.reportService = new ReportService();
    }
  }

  /**
   * Execute a scheduled report through the workflow system
   */
  async executeScheduledReport(scheduleExecution: ScheduleExecution): Promise<WorkflowServiceResponse<{ reportExecutionId: string }>> {
    try {
      // Ensure scheduler is initialized
      this.initializeScheduler();

      // Mark execution as started
      await scheduleExecution.markAsStarted();

      // Get the schedule configuration
      const schedule = await ReportSchedule.findOne({
        where: { schedule_id: scheduleExecution.schedule_id }
      });

      if (!schedule) {
        await scheduleExecution.markAsFailed(`Schedule not found: ${scheduleExecution.schedule_id}`);
        return this.createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: 'Schedule not found'
        });
      }

      // Generate the report using ReportService
      const reportResult = await this.reportService.generateReport(
        schedule.report_id,
        schedule.report_config || {},
        {
          format: schedule.delivery_config.format || 'html',
          streaming: true,
          metadata: {
            schedule_id: schedule.schedule_id,
            execution_id: scheduleExecution.execution_id
          }
        }
      );

      if (!reportResult.success) {
        await scheduleExecution.markAsFailed(reportResult.error?.message || 'Report generation failed');
        return this.createErrorResponse({
          code: 'WORKFLOW_EXECUTION_FAILED',
          message: 'Report generation failed',
          details: reportResult.error
        });
      }

      // Update execution with report metadata
      await scheduleExecution.markAsCompleted({
        report_execution_id: reportResult.data?.executionId,
        report_size: reportResult.data?.size,
        record_count: reportResult.data?.recordCount,
        format: reportResult.data?.format,
        generation_time: reportResult.data?.duration
      });

      // Deliver the report through configured methods
      await this.deliverScheduledReport(scheduleExecution, reportResult.data);

      // Update schedule statistics
      await schedule.incrementExecutionCount();
      await schedule.updateNextExecution();

      return this.createSuccessResponse({
        reportExecutionId: reportResult.data?.executionId || ''
      });

    } catch (error) {
      await scheduleExecution.markAsFailed(`Execution failed: ${error.message}`);

      // Update schedule failure count
      const schedule = await ReportSchedule.findOne({
        where: { schedule_id: scheduleExecution.schedule_id }
      });
      if (schedule) {
        await schedule.incrementFailureCount();
      }

      return this.createErrorResponse({
        code: 'WORKFLOW_EXECUTION_FAILED',
        message: 'Scheduled report execution failed',
        details: error
      });
    }
  }

  /**
   * Deliver report through configured delivery methods
   */
  private async deliverScheduledReport(execution: ScheduleExecution, reportData: any): Promise<void> {
    const schedule = await ReportSchedule.findOne({
      where: { schedule_id: execution.schedule_id }
    });

    if (!schedule) {
      throw new Error('Schedule not found for delivery');
    }

    // Process each delivery method
    for (const deliveryMethod of schedule.delivery_config.methods) {
      const logId = `delivery_${execution.execution_id}_${deliveryMethod.type}_${Date.now()}`;

      try {
        let deliveryLog: DeliveryLog;

        switch (deliveryMethod.type) {
          case 'email':
            deliveryLog = await DeliveryLog.create({
              log_id: logId,
              execution_id: execution.execution_id,
              delivery_method: 'email',
              recipient: deliveryMethod.config.to,
              status: 'pending'
            });

            await this.deliverReportByEmail(deliveryMethod.config, reportData, deliveryLog);
            break;

          case 'file_storage':
            deliveryLog = await DeliveryLog.create({
              log_id: logId,
              execution_id: execution.execution_id,
              delivery_method: 'file_storage',
              recipient: deliveryMethod.config.path,
              status: 'pending'
            });

            await this.deliverReportToStorage(deliveryMethod.config, reportData, deliveryLog);
            break;

          case 'api_endpoint':
            deliveryLog = await DeliveryLog.create({
              log_id: logId,
              execution_id: execution.execution_id,
              delivery_method: 'api_endpoint',
              recipient: deliveryMethod.config.url,
              status: 'pending'
            });

            await this.deliverReportToAPI(deliveryMethod.config, reportData, deliveryLog);
            break;

          case 'webhook':
            deliveryLog = await DeliveryLog.create({
              log_id: logId,
              execution_id: execution.execution_id,
              delivery_method: 'webhook',
              recipient: deliveryMethod.config.url,
              status: 'pending'
            });

            await this.deliverReportByWebhook(deliveryMethod.config, reportData, deliveryLog);
            break;
        }

        await execution.updateDeliveryStatus(deliveryMethod.type, 'delivered');

      } catch (error) {
        console.error(`Delivery failed for ${deliveryMethod.type}:`, error);
        await execution.updateDeliveryStatus(deliveryMethod.type, 'failed', error.message);
      }
    }
  }

  /**
   * Deliver report via email
   */
  private async deliverReportByEmail(config: any, reportData: any, deliveryLog: DeliveryLog): Promise<void> {
    const emailService = require('../config/email');
    const transporter = emailService.createEmailTransporter();

    if (!transporter) {
      throw new Error('Email service not configured');
    }

    const mailOptions = {
      from: `${emailService.getEmailConfig().from.name} <${emailService.getEmailConfig().from.address}>`,
      to: config.to,
      subject: config.subject || `Scheduled Report: ${reportData.name}`,
      html: `
        <h2>Scheduled Report</h2>
        <p>Your scheduled report has been generated and is attached to this email.</p>
        <p><strong>Report:</strong> ${reportData.name}</p>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Format:</strong> ${reportData.format}</p>
      `,
      attachments: [{
        filename: reportData.filename,
        content: reportData.content,
        contentType: reportData.contentType
      }]
    };

    const result = await transporter.sendMail(mailOptions);

    await deliveryLog.markAsDelivered({
      email_message_id: result.messageId
    });
  }

  /**
   * Deliver report to file storage
   */
  private async deliverReportToStorage(config: any, reportData: any, deliveryLog: DeliveryLog): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');

    const fullPath = path.join(config.path, reportData.filename);
    await fs.writeFile(fullPath, reportData.content);

    const stats = await fs.stat(fullPath);

    await deliveryLog.markAsDelivered({
      file_path: fullPath,
      file_size: stats.size
    });
  }

  /**
   * Deliver report to API endpoint
   */
  private async deliverReportToAPI(config: any, reportData: any, deliveryLog: DeliveryLog): Promise<void> {
    const axios = require('axios');

    const response = await axios.post(config.url, {
      report: reportData,
      metadata: {
        execution_id: deliveryLog.execution_id,
        delivery_log_id: deliveryLog.log_id
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        ...config.headers
      },
      timeout: config.timeout || 30000
    });

    await deliveryLog.markAsDelivered({
      http_status: response.status,
      response_body: JSON.stringify(response.data)
    });
  }

  /**
   * Deliver report via webhook
   */
  private async deliverReportByWebhook(config: any, reportData: any, deliveryLog: DeliveryLog): Promise<void> {
    const axios = require('axios');

    const webhookPayload = {
      event: 'report.generated',
      timestamp: new Date().toISOString(),
      data: {
        report: reportData,
        execution_id: deliveryLog.execution_id,
        delivery_log_id: deliveryLog.log_id
      }
    };

    const response = await axios.post(config.url, webhookPayload, {
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': config.signature || '',
        ...config.headers
      },
      timeout: config.timeout || 10000
    });

    await deliveryLog.markAsDelivered({
      http_status: response.status,
      response_body: JSON.stringify(response.data)
    });
  }

  /**
   * Retry failed report delivery
   */
  async retryReportDelivery(deliveryLogId: string): Promise<WorkflowServiceResponse<{ retried: boolean }>> {
    try {
      const deliveryLog = await DeliveryLog.findOne({
        where: { log_id: deliveryLogId }
      });

      if (!deliveryLog) {
        return this.createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: 'Delivery log not found'
        });
      }

      if (!deliveryLog.canRetry(3)) {
        return this.createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: 'Maximum retry attempts exceeded'
        });
      }

      const execution = await ScheduleExecution.findOne({
        where: { execution_id: deliveryLog.execution_id }
      });

      if (!execution) {
        return this.createErrorResponse({
          code: 'VALIDATION_ERROR',
          message: 'Schedule execution not found'
        });
      }

      // Mark as retrying
      await deliveryLog.markAsRetrying();

      // Retry the delivery (this is a simplified version - in practice, you'd reconstruct the report data)
      // For now, we'll just mark it as a retry attempt
      await deliveryLog.incrementAttempt();

      return this.createSuccessResponse({ retried: true });

    } catch (error) {
      return this.createErrorResponse({
        code: 'DATABASE_ERROR',
        message: 'Failed to retry delivery',
        details: error
      });
    }
  }
}