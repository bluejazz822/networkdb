/**
 * Workflow Controller
 * REST API controller for workflow management operations
 * Bridges Express routes with WorkflowService business logic
 */

import { Request, Response } from 'express';
import { WorkflowService, WorkflowFilters, ExecutionFilters } from '../services/WorkflowService';
import { N8nErrorCode } from '../types/workflow';

// Extend Express Request type to include user information
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        [key: string]: any;
      };
    }
  }
}

/**
 * Standard API response format
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message: string;
  errors?: Array<{
    code: string;
    message: string;
    field?: string;
  }>;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  timestamp: string;
}

/**
 * WorkflowController - Handles all workflow-related HTTP requests
 */
export class WorkflowController {
  private workflowService: WorkflowService;

  constructor() {
    this.workflowService = new WorkflowService();
  }

  /**
   * Convert service error to HTTP status code
   */
  private getHttpStatusFromError(errorCode: string): number {
    switch (errorCode) {
      case 'VALIDATION_ERROR':
      case 'INVALID_PARAMETERS':
      case 'INVALID_WORKFLOW_DATA':
        return 400;
      case 'AUTHENTICATION_FAILED':
      case 'PERMISSION_DENIED':
        return 401;
      case 'WORKFLOW_NOT_FOUND':
      case 'EXECUTION_NOT_FOUND':
        return 404;
      case 'WORKFLOW_INACTIVE':
        return 409;
      case 'RATE_LIMIT_EXCEEDED':
        return 429;
      case 'CONNECTION_ERROR':
      case 'DATABASE_ERROR':
      case 'WORKFLOW_EXECUTION_ERROR':
      case 'TIMEOUT_ERROR':
        return 500;
      default:
        return 500;
    }
  }

  /**
   * Create standardized API response
   */
  private createResponse<T>(
    success: boolean,
    message: string,
    data?: T,
    errors?: Array<{ code: string; message: string; field?: string }>,
    pagination?: any
  ): ApiResponse<T> {
    return {
      success,
      message,
      ...(data && { data }),
      ...(errors && { errors }),
      ...(pagination && { pagination }),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle service errors and send appropriate HTTP response
   */
  private handleServiceError(res: Response, error: any): void {
    const statusCode = this.getHttpStatusFromError(error.code);
    const response = this.createResponse(
      false,
      error.message,
      undefined,
      [{
        code: error.code,
        message: error.message
      }]
    );

    // Log error for debugging
    console.error('[WorkflowController] Service Error:', {
      code: error.code,
      message: error.message,
      details: error.details,
      timestamp: new Date().toISOString()
    });

    res.status(statusCode).json(response);
  }

  /**
   * GET /api/workflows
   * List workflows with filtering and pagination
   */
  listWorkflows = async (req: Request, res: Response): Promise<void> => {
    try {
      const filters: WorkflowFilters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        type: req.query.type as any,
        provider: req.query.provider as any,
        active: req.query.active !== undefined ? req.query.active === 'true' : undefined,
        search: req.query.search as string,
        tags: req.query.tags ? (Array.isArray(req.query.tags) ? req.query.tags : [req.query.tags]) as string[] : undefined
      };

      const result = await this.workflowService.getWorkflows(filters);

      if (!result.success) {
        this.handleServiceError(res, result.error);
        return;
      }

      const response = this.createResponse(
        true,
        `Retrieved ${result.data?.length || 0} workflows`,
        {
          workflows: result.data,
          filters: {
            page: filters.page,
            limit: filters.limit,
            type: filters.type,
            provider: filters.provider,
            active: filters.active,
            search: filters.search,
            tags: filters.tags
          }
        },
        undefined,
        result.pagination
      );

      res.json(response);

    } catch (error) {
      console.error('[WorkflowController] listWorkflows error:', error);
      const response = this.createResponse(
        false,
        'Failed to retrieve workflows',
        undefined,
        [{
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while retrieving workflows'
        }]
      );
      res.status(500).json(response);
    }
  };

  /**
   * GET /api/workflows/:id/executions
   * Get execution history for a specific workflow
   */
  getExecutions = async (req: Request, res: Response): Promise<void> => {
    try {
      const workflowId = req.params.id;
      const filters: ExecutionFilters = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        status: req.query.status as any,
        dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom as string) : undefined,
        dateTo: req.query.dateTo ? new Date(req.query.dateTo as string) : undefined
      };

      const result = await this.workflowService.getExecutionHistory(workflowId, filters);

      if (!result.success) {
        this.handleServiceError(res, result.error);
        return;
      }

      const response = this.createResponse(
        true,
        `Retrieved ${result.data?.length || 0} executions for workflow ${workflowId}`,
        {
          executions: result.data,
          workflowId,
          filters: {
            page: filters.page,
            limit: filters.limit,
            status: filters.status,
            dateFrom: filters.dateFrom?.toISOString(),
            dateTo: filters.dateTo?.toISOString()
          }
        },
        undefined,
        result.pagination
      );

      res.json(response);

    } catch (error) {
      console.error('[WorkflowController] getExecutions error:', error);
      const response = this.createResponse(
        false,
        'Failed to retrieve execution history',
        undefined,
        [{
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while retrieving execution history'
        }]
      );
      res.status(500).json(response);
    }
  };

  /**
   * POST /api/workflows/:id/trigger
   * Manually trigger workflow execution
   */
  triggerWorkflow = async (req: Request, res: Response): Promise<void> => {
    try {
      const workflowId = req.params.id;
      const { input, startNodes, destinationNode, pinData } = req.body;
      const userId = req.user?.id;

      // Log trigger attempt for audit
      console.log('[WorkflowController] Workflow trigger attempt:', {
        workflowId,
        userId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });

      const triggerParams = {
        input,
        startNodes,
        destinationNode,
        pinData
      };

      const result = await this.workflowService.executeWorkflow(workflowId, triggerParams, userId);

      if (!result.success) {
        this.handleServiceError(res, result.error);
        return;
      }

      const response = this.createResponse(
        true,
        `Workflow ${workflowId} triggered successfully. Execution ID: ${result.data?.id}`,
        {
          execution: result.data,
          workflowId,
          triggeredBy: userId,
          triggeredAt: new Date().toISOString()
        }
      );

      res.status(201).json(response);

    } catch (error) {
      console.error('[WorkflowController] triggerWorkflow error:', error);
      const response = this.createResponse(
        false,
        'Failed to trigger workflow',
        undefined,
        [{
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while triggering the workflow'
        }]
      );
      res.status(500).json(response);
    }
  };

  /**
   * GET /api/workflows/status
   * Get workflow system status and dashboard summary
   */
  getStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const timeRange = (req.query.timeRange as 'last24h' | 'last7d' | 'last30d') || 'last24h';

      const result = await this.workflowService.getDashboardMetrics(timeRange);

      if (!result.success) {
        this.handleServiceError(res, result.error);
        return;
      }

      // Get additional workflow statistics
      const analyticsPromises = [];
      // Could extend this to get individual workflow analytics if needed

      const response = this.createResponse(
        true,
        'Workflow system status retrieved successfully',
        {
          summary: result.data,
          timeRange,
          refreshedAt: new Date().toISOString()
        }
      );

      res.json(response);

    } catch (error) {
      console.error('[WorkflowController] getStatus error:', error);
      const response = this.createResponse(
        false,
        'Failed to retrieve workflow system status',
        undefined,
        [{
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while retrieving system status'
        }]
      );
      res.status(500).json(response);
    }
  };

  /**
   * GET /api/workflows/health
   * Workflow system health check
   */
  healthCheck = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.workflowService.healthCheck();

      if (!result.success) {
        // For health checks, we still want to return the error details
        const response = this.createResponse(
          false,
          'Health check failed',
          result.data, // Include health data even if check failed
          [{
            code: result.error?.code || 'HEALTH_CHECK_FAILED',
            message: result.error?.message || 'Health check failed'
          }]
        );
        res.status(503).json(response); // Service Unavailable
        return;
      }

      const response = this.createResponse(
        true,
        'Workflow system is healthy',
        result.data
      );

      // Return appropriate status based on health
      const statusCode = result.data?.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(response);

    } catch (error) {
      console.error('[WorkflowController] healthCheck error:', error);
      const response = this.createResponse(
        false,
        'Health check failed',
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          services: {
            n8n: 'unknown',
            database: 'unknown',
            cache: 'unknown'
          }
        },
        [{
          code: 'HEALTH_CHECK_ERROR',
          message: 'Health check encountered an unexpected error'
        }]
      );
      res.status(503).json(response);
    }
  };

  /**
   * GET /api/workflows/:id/analytics
   * Get detailed analytics for a specific workflow
   */
  getWorkflowAnalytics = async (req: Request, res: Response): Promise<void> => {
    try {
      const workflowId = req.params.id;

      const result = await this.workflowService.getWorkflowAnalytics(workflowId);

      if (!result.success) {
        this.handleServiceError(res, result.error);
        return;
      }

      const response = this.createResponse(
        true,
        `Analytics retrieved for workflow ${workflowId}`,
        {
          analytics: result.data,
          workflowId,
          generatedAt: new Date().toISOString()
        }
      );

      res.json(response);

    } catch (error) {
      console.error('[WorkflowController] getWorkflowAnalytics error:', error);
      const response = this.createResponse(
        false,
        'Failed to retrieve workflow analytics',
        undefined,
        [{
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while retrieving workflow analytics'
        }]
      );
      res.status(500).json(response);
    }
  };

  /**
   * POST /api/workflows/sync
   * Manually trigger workflow synchronization from n8n
   */
  syncWorkflows = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.id;

      // Log sync attempt for audit
      console.log('[WorkflowController] Manual workflow sync triggered:', {
        userId,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
      });

      const result = await this.workflowService.syncWorkflows();

      if (!result.success) {
        this.handleServiceError(res, result.error);
        return;
      }

      const response = this.createResponse(
        true,
        `Successfully synchronized ${result.data?.synced || 0} workflows`,
        {
          syncedCount: result.data?.synced || 0,
          syncedBy: userId,
          syncedAt: new Date().toISOString()
        }
      );

      res.json(response);

    } catch (error) {
      console.error('[WorkflowController] syncWorkflows error:', error);
      const response = this.createResponse(
        false,
        'Failed to synchronize workflows',
        undefined,
        [{
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during workflow synchronization'
        }]
      );
      res.status(500).json(response);
    }
  };
}

// Export singleton instance
export const workflowController = new WorkflowController();