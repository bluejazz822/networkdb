/**
 * Report Schedule Management API Routes
 * RESTful endpoints for managing scheduled reports
 */

import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { ReportSchedule } from '../../models/ReportSchedule';
import { ScheduleExecution } from '../../models/ScheduleExecution';
import { DeliveryLog } from '../../models/DeliveryLog';
import { WorkflowService } from '../../services/WorkflowService';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const workflowService = new WorkflowService();

// Validation middleware
const validateRequest = (req: Request, res: Response, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request parameters',
        details: errors.array()
      }
    });
  }
  next();
};

// ======================================
// SCHEDULE MANAGEMENT ENDPOINTS
// ======================================

/**
 * GET /api/report-schedules
 * List all report schedules with filtering and pagination
 */
router.get('/', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('enabled').optional().isBoolean().toBoolean(),
  query('report_id').optional().isString(),
  query('search').optional().isString()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      enabled,
      report_id,
      search
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const whereClause: any = {};

    // Apply filters
    if (enabled !== undefined) {
      whereClause.enabled = enabled;
    }

    if (report_id) {
      whereClause.report_id = report_id;
    }

    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const { rows: schedules, count: total } = await ReportSchedule.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: Number(limit),
      offset,
      include: [{
        model: ScheduleExecution,
        as: 'schedule_executions',
        limit: 5,
        order: [['created_at', 'DESC']],
        required: false
      }]
    });

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: {
        schedules,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages,
          hasNextPage: Number(page) < totalPages,
          hasPrevPage: Number(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching report schedules:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch report schedules',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/report-schedules/:scheduleId
 * Get a specific report schedule by ID
 */
router.get('/:scheduleId', [
  param('scheduleId').isString().notEmpty()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await ReportSchedule.findOne({
      where: { schedule_id: scheduleId },
      include: [{
        model: ScheduleExecution,
        as: 'schedule_executions',
        limit: 10,
        order: [['created_at', 'DESC']],
        required: false,
        include: [{
          model: DeliveryLog,
          as: 'delivery_logs',
          required: false
        }]
      }]
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SCHEDULE_NOT_FOUND',
          message: 'Report schedule not found'
        }
      });
    }

    res.json({
      success: true,
      data: { schedule }
    });

  } catch (error) {
    console.error('Error fetching report schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch report schedule',
        details: error.message
      }
    });
  }
});

/**
 * POST /api/report-schedules
 * Create a new report schedule
 */
router.post('/', [
  body('name').isString().isLength({ min: 1, max: 255 }),
  body('report_id').isString().notEmpty(),
  body('cron_expression').isString().notEmpty(),
  body('delivery_config').isObject(),
  body('delivery_config.methods').isArray({ min: 1 }),
  body('description').optional().isString(),
  body('timezone').optional().isString(),
  body('enabled').optional().isBoolean(),
  body('report_config').optional().isObject(),
  body('retry_config').optional().isObject()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const {
      name,
      report_id,
      cron_expression,
      delivery_config,
      description,
      timezone = 'UTC',
      enabled = true,
      report_config,
      retry_config
    } = req.body;

    // Validate cron expression
    const cron = require('node-cron');
    if (!cron.validate(cron_expression)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid cron expression'
        }
      });
    }

    // Generate schedule ID
    const schedule_id = `schedule_${uuidv4()}`;

    // Create the schedule
    const schedule = await ReportSchedule.create({
      schedule_id,
      name,
      report_id,
      description,
      cron_expression,
      timezone,
      enabled,
      delivery_config,
      report_config,
      retry_config,
      created_by: req.user?.id || 'system' // Assuming user middleware sets req.user
    });

    // Calculate next execution time
    await schedule.updateNextExecution();

    res.status(201).json({
      success: true,
      data: { schedule }
    });

  } catch (error) {
    console.error('Error creating report schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to create report schedule',
        details: error.message
      }
    });
  }
});

/**
 * PUT /api/report-schedules/:scheduleId
 * Update an existing report schedule
 */
router.put('/:scheduleId', [
  param('scheduleId').isString().notEmpty(),
  body('name').optional().isString().isLength({ min: 1, max: 255 }),
  body('cron_expression').optional().isString().notEmpty(),
  body('delivery_config').optional().isObject(),
  body('description').optional().isString(),
  body('timezone').optional().isString(),
  body('enabled').optional().isBoolean(),
  body('report_config').optional().isObject(),
  body('retry_config').optional().isObject()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const updateData = req.body;

    // Validate cron expression if provided
    if (updateData.cron_expression) {
      const cron = require('node-cron');
      if (!cron.validate(updateData.cron_expression)) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid cron expression'
          }
        });
      }
    }

    const schedule = await ReportSchedule.findOne({
      where: { schedule_id: scheduleId }
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SCHEDULE_NOT_FOUND',
          message: 'Report schedule not found'
        }
      });
    }

    // Update the schedule
    await schedule.update({
      ...updateData,
      updated_by: req.user?.id || 'system'
    });

    // Recalculate next execution time if cron expression changed
    if (updateData.cron_expression) {
      await schedule.updateNextExecution();
    }

    res.json({
      success: true,
      data: { schedule }
    });

  } catch (error) {
    console.error('Error updating report schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to update report schedule',
        details: error.message
      }
    });
  }
});

/**
 * DELETE /api/report-schedules/:scheduleId
 * Delete a report schedule
 */
router.delete('/:scheduleId', [
  param('scheduleId').isString().notEmpty()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await ReportSchedule.findOne({
      where: { schedule_id: scheduleId }
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SCHEDULE_NOT_FOUND',
          message: 'Report schedule not found'
        }
      });
    }

    await schedule.destroy();

    res.json({
      success: true,
      data: { deleted: true }
    });

  } catch (error) {
    console.error('Error deleting report schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to delete report schedule',
        details: error.message
      }
    });
  }
});

// ======================================
// SCHEDULE EXECUTION ENDPOINTS
// ======================================

/**
 * POST /api/report-schedules/:scheduleId/execute
 * Manually trigger a report schedule execution
 */
router.post('/:scheduleId/execute', [
  param('scheduleId').isString().notEmpty()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;

    const schedule = await ReportSchedule.findOne({
      where: { schedule_id: scheduleId }
    });

    if (!schedule) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'SCHEDULE_NOT_FOUND',
          message: 'Report schedule not found'
        }
      });
    }

    if (!schedule.enabled) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SCHEDULE_DISABLED',
          message: 'Cannot execute disabled schedule'
        }
      });
    }

    // Create a manual execution
    const execution = await ScheduleExecution.create({
      execution_id: `exec_${uuidv4()}`,
      schedule_id: scheduleId,
      scheduled_time: new Date(),
      status: 'pending'
    });

    // Execute through WorkflowService
    workflowService.initializeScheduler();
    const result = await workflowService.executeScheduledReport(execution);

    if (result.success) {
      res.json({
        success: true,
        data: {
          execution_id: execution.execution_id,
          report_execution_id: result.data?.reportExecutionId
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error executing report schedule:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: 'Failed to execute report schedule',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/report-schedules/:scheduleId/executions
 * Get execution history for a schedule
 */
router.get('/:scheduleId/executions', [
  param('scheduleId').isString().notEmpty(),
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['pending', 'running', 'completed', 'failed', 'cancelled', 'retrying'])
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { scheduleId } = req.params;
    const {
      page = 1,
      limit = 20,
      status
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const whereClause: any = { schedule_id: scheduleId };

    if (status) {
      whereClause.status = status;
    }

    const { rows: executions, count: total } = await ScheduleExecution.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: Number(limit),
      offset,
      include: [{
        model: DeliveryLog,
        as: 'delivery_logs',
        required: false
      }]
    });

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: {
        executions,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages,
          hasNextPage: Number(page) < totalPages,
          hasPrevPage: Number(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching schedule executions:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch schedule executions',
        details: error.message
      }
    });
  }
});

// ======================================
// DELIVERY MANAGEMENT ENDPOINTS
// ======================================

/**
 * POST /api/report-schedules/delivery/:deliveryLogId/retry
 * Retry a failed delivery
 */
router.post('/delivery/:deliveryLogId/retry', [
  param('deliveryLogId').isString().notEmpty()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const { deliveryLogId } = req.params;

    const result = await workflowService.retryReportDelivery(deliveryLogId);

    if (result.success) {
      res.json({
        success: true,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Error retrying delivery:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'RETRY_ERROR',
        message: 'Failed to retry delivery',
        details: error.message
      }
    });
  }
});

/**
 * GET /api/report-schedules/delivery/logs
 * Get delivery logs with filtering
 */
router.get('/delivery/logs', [
  query('page').optional().isInt({ min: 1 }).toInt(),
  query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  query('status').optional().isIn(['pending', 'delivered', 'failed', 'retrying']),
  query('method').optional().isIn(['email', 'file_storage', 'api_endpoint', 'webhook']),
  query('execution_id').optional().isString()
], validateRequest, async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      method,
      execution_id
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);
    const whereClause: any = {};

    if (status) {
      whereClause.status = status;
    }

    if (method) {
      whereClause.delivery_method = method;
    }

    if (execution_id) {
      whereClause.execution_id = execution_id;
    }

    const { rows: logs, count: total } = await DeliveryLog.findAndCountAll({
      where: whereClause,
      order: [['created_at', 'DESC']],
      limit: Number(limit),
      offset
    });

    const totalPages = Math.ceil(total / Number(limit));

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages,
          hasNextPage: Number(page) < totalPages,
          hasPrevPage: Number(page) > 1
        }
      }
    });

  } catch (error) {
    console.error('Error fetching delivery logs:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch delivery logs',
        details: error.message
      }
    });
  }
});

// ======================================
// SCHEDULE ANALYTICS ENDPOINTS
// ======================================

/**
 * GET /api/report-schedules/analytics/dashboard
 * Get scheduler dashboard metrics
 */
router.get('/analytics/dashboard', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Get schedule counts
    const totalSchedules = await ReportSchedule.count();
    const activeSchedules = await ReportSchedule.count({ where: { enabled: true } });

    // Get execution counts for today
    const todayExecutions = await ScheduleExecution.count({
      where: {
        created_at: { [Op.gte]: startOfDay }
      }
    });

    const successfulExecutions = await ScheduleExecution.count({
      where: {
        status: 'completed',
        created_at: { [Op.gte]: startOfDay }
      }
    });

    const failedExecutions = await ScheduleExecution.count({
      where: {
        status: 'failed',
        created_at: { [Op.gte]: startOfDay }
      }
    });

    const runningExecutions = await ScheduleExecution.count({
      where: { status: 'running' }
    });

    // Get next executions
    const nextExecutions = await ReportSchedule.findAll({
      where: {
        enabled: true,
        next_execution: { [Op.ne]: null }
      },
      order: [['next_execution', 'ASC']],
      limit: 5
    });

    // Calculate delivery success rate
    const totalDeliveries = await DeliveryLog.count({
      where: {
        created_at: { [Op.gte]: startOfDay }
      }
    });

    const successfulDeliveries = await DeliveryLog.count({
      where: {
        status: 'delivered',
        created_at: { [Op.gte]: startOfDay }
      }
    });

    const deliverySuccessRate = totalDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0;

    res.json({
      success: true,
      data: {
        schedules: {
          total: totalSchedules,
          active: activeSchedules,
          inactive: totalSchedules - activeSchedules
        },
        executions: {
          today: todayExecutions,
          successful: successfulExecutions,
          failed: failedExecutions,
          running: runningExecutions,
          successRate: todayExecutions > 0 ? (successfulExecutions / todayExecutions) * 100 : 0
        },
        delivery: {
          successRate: deliverySuccessRate,
          totalToday: totalDeliveries,
          successfulToday: successfulDeliveries
        },
        nextExecutions,
        lastUpdated: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Error fetching scheduler analytics:', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'DATABASE_ERROR',
        message: 'Failed to fetch scheduler analytics',
        details: error.message
      }
    });
  }
});

export default router;