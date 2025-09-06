/**
 * Script Management API Routes
 * RESTful endpoints for script CRUD operations, execution, and monitoring
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import ScriptManager from '../../services/scripts/ScriptManager';
import ExecutionEngine from '../../services/scripts/ExecutionEngine';
import MonitoringService from '../../services/scripts/MonitoringService';
import { ScriptExecutionPriority } from '../../models/ScriptExecution';
import { validateRequest, requireAuth, requirePermission } from '../middleware/validation';

const router = Router();
const scriptManager = new ScriptManager();
const executionEngine = new ExecutionEngine();
const monitoringService = new MonitoringService();

// Configure multer for file uploads
const upload = scriptManager.getUploadMiddleware();

/**
 * @route GET /api/scripts
 * @desc Get scripts with search and filtering
 */
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const {
      query,
      language,
      tags,
      authorId,
      isActive,
      isTemplate,
      limit = '20',
      offset = '0',
      sortBy = 'updatedAt',
      sortOrder = 'DESC'
    } = req.query;

    const options = {
      query: query as string,
      language: language as string,
      tags: tags ? (tags as string).split(',') : undefined,
      authorId: authorId as string,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      isTemplate: isTemplate === 'true' ? true : isTemplate === 'false' ? false : undefined,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      sortBy: sortBy as any,
      sortOrder: sortOrder as 'ASC' | 'DESC'
    };

    const result = await scriptManager.searchScripts(options);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route GET /api/scripts/stats
 * @desc Get script statistics
 */
router.get('/stats', requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await scriptManager.getScriptStats();
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route GET /api/scripts/templates
 * @desc Get script templates
 */
router.get('/templates', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await scriptManager.searchScripts({
      isTemplate: true,
      isActive: true,
      sortBy: 'name'
    });
    
    res.json({
      success: true,
      data: result.scripts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route GET /api/scripts/:id
 * @desc Get script by ID
 */
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { include } = req.query;
    
    const script = await scriptManager.getScript(id, include === 'true');
    
    if (!script) {
      return res.status(404).json({
        success: false,
        error: 'Script not found'
      });
    }

    res.json({
      success: true,
      data: script
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route GET /api/scripts/:id/content
 * @desc Get script content
 */
router.get('/:id/content', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const script = await scriptManager.getScript(id);
    if (!script) {
      return res.status(404).json({
        success: false,
        error: 'Script not found'
      });
    }

    const content = await scriptManager.getScriptContent(id);
    
    res.json({
      success: true,
      data: {
        content,
        language: script.language,
        fileName: script.filePath
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route GET /api/scripts/:name/versions
 * @desc Get all versions of a script
 */
router.get('/:name/versions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    
    const versions = await scriptManager.getScriptVersions(name);
    
    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route POST /api/scripts
 * @desc Create new script
 */
router.post('/', requireAuth, requirePermission('script:create'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const scriptData = {
      name: req.body.name,
      displayName: req.body.displayName,
      description: req.body.description,
      language: req.body.language || 'python',
      content: req.body.content,
      parameters: req.body.parameters ? JSON.parse(req.body.parameters) : undefined,
      requirements: req.body.requirements,
      estimatedExecutionTime: req.body.estimatedExecutionTime ? parseInt(req.body.estimatedExecutionTime) : undefined,
      maxExecutionTime: req.body.maxExecutionTime ? parseInt(req.body.maxExecutionTime) : undefined,
      resourceLimits: req.body.resourceLimits ? JSON.parse(req.body.resourceLimits) : undefined,
      tags: req.body.tags ? req.body.tags.split(',').map((tag: string) => tag.trim()) : [],
      isTemplate: req.body.isTemplate === 'true',
      permissions: req.body.permissions ? req.body.permissions.split(',') : undefined,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined
    };

    const authorId = (req as any).user?.id;
    if (!authorId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const script = await scriptManager.uploadScript(scriptData, authorId, req.file);
    
    res.status(201).json({
      success: true,
      data: script
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route POST /api/scripts/:id/versions
 * @desc Create new version of existing script
 */
router.post('/:id/versions', requireAuth, requirePermission('script:update'), upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = {
      displayName: req.body.displayName,
      description: req.body.description,
      language: req.body.language,
      content: req.body.content,
      parameters: req.body.parameters ? JSON.parse(req.body.parameters) : undefined,
      requirements: req.body.requirements,
      estimatedExecutionTime: req.body.estimatedExecutionTime ? parseInt(req.body.estimatedExecutionTime) : undefined,
      maxExecutionTime: req.body.maxExecutionTime ? parseInt(req.body.maxExecutionTime) : undefined,
      resourceLimits: req.body.resourceLimits ? JSON.parse(req.body.resourceLimits) : undefined,
      tags: req.body.tags ? req.body.tags.split(',').map((tag: string) => tag.trim()) : undefined,
      permissions: req.body.permissions ? req.body.permissions.split(',') : undefined,
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : undefined
    };

    const modifiedBy = (req as any).user?.id;
    if (!modifiedBy) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const newVersion = await scriptManager.createVersion(id, updates, modifiedBy, req.file);
    
    res.status(201).json({
      success: true,
      data: newVersion
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route PUT /api/scripts/:id
 * @desc Update script metadata
 */
router.put('/:id', requireAuth, requirePermission('script:update'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = {
      displayName: req.body.displayName,
      description: req.body.description,
      requirements: req.body.requirements,
      estimatedExecutionTime: req.body.estimatedExecutionTime,
      maxExecutionTime: req.body.maxExecutionTime,
      resourceLimits: req.body.resourceLimits,
      tags: req.body.tags,
      permissions: req.body.permissions,
      metadata: req.body.metadata,
      isActive: req.body.isActive
    };

    const modifiedBy = (req as any).user?.id;
    if (!modifiedBy) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const script = await scriptManager.updateScript(id, updates, modifiedBy);
    
    res.json({
      success: true,
      data: script
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route DELETE /api/scripts/:id
 * @desc Archive (soft delete) script
 */
router.delete('/:id', requireAuth, requirePermission('script:delete'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { permanent } = req.query;

    const archivedBy = (req as any).user?.id;
    if (!archivedBy) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (permanent === 'true') {
      await scriptManager.deleteScript(id);
      res.json({
        success: true,
        message: 'Script permanently deleted'
      });
    } else {
      await scriptManager.archiveScript(id, archivedBy);
      res.json({
        success: true,
        message: 'Script archived successfully'
      });
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route POST /api/scripts/:id/restore
 * @desc Restore archived script
 */
router.post('/:id/restore', requireAuth, requirePermission('script:update'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const restoredBy = (req as any).user?.id;
    if (!restoredBy) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    await scriptManager.restoreScript(id, restoredBy);
    
    res.json({
      success: true,
      message: 'Script restored successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * Script Execution Routes
 */

/**
 * @route POST /api/scripts/:id/execute
 * @desc Execute a script
 */
router.post('/:id/execute', requireAuth, requirePermission('script:execute'), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      parameters,
      environment,
      resourceLimits,
      networkAccess = false,
      timeout,
      priority = ScriptExecutionPriority.NORMAL,
      workingDirectory
    } = req.body;

    const executorId = (req as any).user?.id;
    if (!executorId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const executionId = await executionEngine.executeScript(id, executorId, {
      parameters,
      environment,
      resourceLimits,
      networkAccess,
      timeout,
      priority,
      workingDirectory
    });
    
    res.status(202).json({
      success: true,
      data: { executionId },
      message: 'Script execution started'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route GET /api/scripts/executions/:executionId
 * @desc Get execution status
 */
router.get('/executions/:executionId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    
    const execution = await executionEngine.getExecutionStatus(executionId);
    
    if (!execution) {
      return res.status(404).json({
        success: false,
        error: 'Execution not found'
      });
    }

    res.json({
      success: true,
      data: execution
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route GET /api/scripts/executions/:executionId/logs
 * @desc Get execution logs
 */
router.get('/executions/:executionId/logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    
    const logs = await executionEngine.getExecutionLogs(executionId);
    
    res.json({
      success: true,
      data: { logs }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route POST /api/scripts/executions/:executionId/cancel
 * @desc Cancel execution
 */
router.post('/executions/:executionId/cancel', requireAuth, requirePermission('script:execute'), async (req: Request, res: Response) => {
  try {
    const { executionId } = req.params;
    const { reason } = req.body;
    
    await executionEngine.cancelExecution(executionId, reason);
    
    res.json({
      success: true,
      message: 'Execution cancelled successfully'
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route GET /api/scripts/:id/executions
 * @desc Get execution history for a script
 */
router.get('/:id/executions', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      limit = '50',
      offset = '0',
      status,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = req.query;

    const options = {
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
      status: status as any,
      sortBy: sortBy as any,
      sortOrder: sortOrder as 'ASC' | 'DESC'
    };

    const result = await monitoringService.getExecutionHistory(id, options);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * Monitoring Routes
 */

/**
 * @route GET /api/scripts/monitoring/metrics
 * @desc Get overall execution metrics
 */
router.get('/monitoring/metrics', requireAuth, async (req: Request, res: Response) => {
  try {
    const { from, to } = req.query;
    
    const timeRange = from && to ? {
      from: new Date(from as string),
      to: new Date(to as string)
    } : undefined;

    const metrics = await monitoringService.getExecutionMetrics(timeRange);
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route GET /api/scripts/:id/metrics
 * @desc Get metrics for specific script
 */
router.get('/:id/metrics', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;
    
    const timeRange = from && to ? {
      from: new Date(from as string),
      to: new Date(to as string)
    } : undefined;

    const metrics = await monitoringService.getScriptMetrics(id, timeRange);
    
    if (!metrics) {
      return res.status(404).json({
        success: false,
        error: 'Script not found'
      });
    }

    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route GET /api/scripts/monitoring/system
 * @desc Get system metrics
 */
router.get('/monitoring/system', requireAuth, async (req: Request, res: Response) => {
  try {
    const metrics = await monitoringService.getSystemMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route GET /api/scripts/monitoring/dashboard
 * @desc Get dashboard statistics
 */
router.get('/monitoring/dashboard', requireAuth, async (req: Request, res: Response) => {
  try {
    const stats = await monitoringService.getDashboardStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route GET /api/scripts/monitoring/alerts
 * @desc Get current alerts
 */
router.get('/monitoring/alerts', requireAuth, async (req: Request, res: Response) => {
  try {
    const { severity } = req.query;
    
    const alerts = monitoringService.getAlerts(severity as any);
    
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route POST /api/scripts/monitoring/alerts/:alertId/acknowledge
 * @desc Acknowledge an alert
 */
router.post('/monitoring/alerts/:alertId/acknowledge', requireAuth, async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    
    const acknowledged = monitoringService.acknowledgeAlert(alertId);
    
    if (!acknowledged) {
      return res.status(404).json({
        success: false,
        error: 'Alert not found'
      });
    }

    res.json({
      success: true,
      message: 'Alert acknowledged successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route GET /api/scripts/monitoring/logs
 * @desc Get system logs
 */
router.get('/monitoring/logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const { level, executionId, limit = '100' } = req.query;
    
    const logs = monitoringService.getLogs(
      level as any,
      executionId as string,
      parseInt(limit as string)
    );
    
    res.json({
      success: true,
      data: logs
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

/**
 * @route GET /api/scripts/monitoring/running
 * @desc Get currently running executions
 */
router.get('/monitoring/running', requireAuth, async (req: Request, res: Response) => {
  try {
    const runningExecutions = executionEngine.getRunningExecutions();
    const runningCount = executionEngine.getRunningExecutionsCount();
    
    res.json({
      success: true,
      data: {
        count: runningCount,
        executions: runningExecutions
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

export default router;