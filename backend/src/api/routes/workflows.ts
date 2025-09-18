/**
 * Workflow API Routes
 * REST API endpoints for workflow management and execution
 */

import { Router, Request, Response } from 'express';
import { validateRequest, asyncHandler } from '../middleware/validation';
import { workflowAuthMiddleware } from '../../middleware/workflowAuth';
import { workflowController } from '../../controllers/WorkflowController';
import rateLimit from 'express-rate-limit';
import Joi from 'joi';
import { 
  N8nWorkflow, 
  N8nWorkflowExecution, 
  WorkflowExecutionStats,
  N8nErrorResponse 
} from '../../types/workflow';

const router: Router = Router();

// Rate limiting specifically for trigger endpoint
const triggerRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute per IP
  message: {
    success: false,
    message: 'Too many workflow trigger requests',
    errors: [{
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Maximum 10 workflow triggers per minute exceeded. Please try again later.'
    }]
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    // Use user ID if available, otherwise fall back to IP
    return req.user?.id || req.ip;
  }
});

// Validation schemas
const workflowValidationSchemas = {
  workflowId: Joi.object({
    id: Joi.string().uuid().required().messages({
      'string.uuid': 'Workflow ID must be a valid UUID',
      'any.required': 'Workflow ID is required'
    })
  }),

  listQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('active', 'inactive').optional(),
    search: Joi.string().max(500).optional(),
    tags: Joi.array().items(Joi.string().max(50)).optional()
  }),

  executionsQuery: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    status: Joi.string().valid('new', 'running', 'succeeded', 'failed', 'canceled', 'crashed', 'waiting').optional(),
    startedAfter: Joi.date().iso().optional(),
    startedBefore: Joi.date().iso().optional(),
    includeData: Joi.boolean().default(false)
  }),

  triggerBody: Joi.object({
    input: Joi.object().optional(),
    startNodes: Joi.array().items(Joi.string()).optional(),
    destinationNode: Joi.string().optional(),
    pinData: Joi.object().optional()
  })
};

/**
 * GET /api/workflows
 * List workflows with filtering and pagination
 */
router.get('/',
  ...workflowAuthMiddleware.readOnly,
  validateRequest({ 
    query: workflowValidationSchemas.listQuery 
  }),
  asyncHandler(workflowController.listWorkflows)
);

/**
 * GET /api/workflows/:id/executions
 * Get execution history for a specific workflow
 */
router.get('/:id/executions',
  ...workflowAuthMiddleware.readOnly,
  validateRequest({
    params: workflowValidationSchemas.workflowId,
    query: workflowValidationSchemas.executionsQuery
  }),
  asyncHandler(workflowController.getExecutions)
);

/**
 * POST /api/workflows/:id/trigger
 * Manually trigger workflow execution
 */
router.post('/:id/trigger',
  ...workflowAuthMiddleware.execution,
  triggerRateLimit, // Apply rate limiting after auth
  validateRequest({
    params: workflowValidationSchemas.workflowId,
    body: workflowValidationSchemas.triggerBody
  }),
  asyncHandler(workflowController.triggerWorkflow)
);

/**
 * GET /api/workflows/status
 * Get workflow system status and dashboard summary
 */
router.get('/status',
  ...workflowAuthMiddleware.readOnly,
  asyncHandler(workflowController.getStatus)
);

/**
 * GET /api/workflows/health
 * Workflow system health check
 */
router.get('/health',
  ...workflowAuthMiddleware.optional,
  asyncHandler(workflowController.healthCheck)
);

/**
 * GET /api/workflows/:id/analytics
 * Get detailed analytics for a specific workflow
 */
router.get('/:id/analytics',
  ...workflowAuthMiddleware.readOnly,
  validateRequest({
    params: workflowValidationSchemas.workflowId
  }),
  asyncHandler(workflowController.getWorkflowAnalytics)
);

/**
 * POST /api/workflows/sync
 * Manually trigger workflow synchronization from n8n
 */
router.post('/sync',
  ...workflowAuthMiddleware.execution,
  asyncHandler(workflowController.syncWorkflows)
);

// Error handling middleware for workflow routes
router.use((error: any, req: Request, res: Response, next: any) => {
  console.error('Workflow API Error:', error);

  // Handle specific n8n error types
  if (error.code === 'WORKFLOW_NOT_FOUND') {
    return res.status(404).json({
      success: false,
      message: 'Workflow not found',
      errors: [{ code: error.code, message: error.message }]
    });
  }

  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    return res.status(429).json({
      success: false,
      message: 'Rate limit exceeded',
      errors: [{ code: error.code, message: error.message }]
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    message: 'Internal server error in workflow system',
    errors: [{
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? 'An unexpected error occurred' 
        : error.message
    }]
  });
});

export default router;