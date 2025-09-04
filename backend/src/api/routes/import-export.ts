/**
 * Import/Export API Routes
 * RESTful endpoints for file import and export operations
 */

import { Router, Request, Response } from 'express';
import Joi from 'joi';
import multer from 'multer';
import { ImportService, ExportService } from '../../services/import-export';
import { FileFormat } from '../../utils/file-processors';
import { validateRequest, asyncHandler } from '../middleware/validation';

const router = Router();
const importService = new ImportService();
const exportService = new ExportService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = ['text/csv', 'application/json', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
    if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(csv|json|xlsx|xls)$/)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV, JSON, and Excel files are allowed.'));
    }
  }
});

// Validation schemas
const importPreviewSchema = Joi.object({
  resourceType: Joi.string().valid('vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint').required(),
  mode: Joi.string().valid('create', 'update', 'upsert').default('create'),
  skipValidation: Joi.boolean().default(false)
});

const importExecuteSchema = Joi.object({
  resourceType: Joi.string().valid('vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint').required(),
  mode: Joi.string().valid('create', 'update', 'upsert').default('create'),
  batchSize: Joi.number().integer().min(1).max(1000).default(100),
  continueOnError: Joi.boolean().default(true),
  rollbackOnFailure: Joi.boolean().default(false),
  skipValidation: Joi.boolean().default(false),
  fieldMapping: Joi.object().optional()
});

const exportRequestSchema = Joi.object({
  format: Joi.string().valid('csv', 'json', 'excel').required(),
  resourceType: Joi.string().valid('vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint', 'all').required(),
  fields: Joi.array().items(Joi.string()).optional(),
  filters: Joi.object().optional(),
  includeHeaders: Joi.boolean().default(true),
  includeMetadata: Joi.boolean().default(false),
  includeDeleted: Joi.boolean().default(false),
  fileName: Joi.string().optional(),
  dateRange: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional()
  }).optional()
});

const templateRequestSchema = Joi.object({
  format: Joi.string().valid('csv', 'json', 'excel').required(),
  resourceType: Joi.string().valid('vpc', 'transitGateway', 'customerGateway', 'vpcEndpoint').required()
});

/**
 * POST /api/import/preview
 * Generate preview of import operation
 */
router.post('/import/preview',
  upload.single('file'),
  validateRequest({ body: importPreviewSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
        errors: [{ code: 'MISSING_FILE', message: 'File is required for import preview' }]
      });
    }

    try {
      // Detect file format from MIME type and extension
      const format = detectFileFormat(req.file);
      const metadata = {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        format
      };

      const options = {
        ...req.body,
        userId: req.user?.id || 'system'
      };

      const preview = await importService.generatePreview(req.file.buffer, metadata, options);

      res.json({
        success: true,
        data: preview,
        message: 'Import preview generated successfully'
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Preview generation failed',
        errors: [{ code: 'PREVIEW_ERROR', message: error.message }]
      });
    }
  })
);

/**
 * POST /api/import/execute
 * Execute import operation
 */
router.post('/import/execute',
  upload.single('file'),
  validateRequest({ body: importExecuteSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded',
        errors: [{ code: 'MISSING_FILE', message: 'File is required for import' }]
      });
    }

    try {
      const format = detectFileFormat(req.file);
      const metadata = {
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        format
      };

      const options = {
        ...req.body,
        userId: req.user?.id || 'system'
      };

      const { importId, promise } = await importService.executeImport(req.file.buffer, metadata, options);

      // Return import ID immediately for progress tracking
      res.status(202).json({
        success: true,
        data: {
          importId,
          message: 'Import started successfully. Use the import ID to track progress.'
        }
      });

      // Handle import completion in background
      promise.then(result => {
        importService.emit('importComplete', importId, result);
      }).catch(error => {
        importService.emit('importError', importId, error);
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Import execution failed',
        errors: [{ code: 'IMPORT_ERROR', message: error.message }]
      });
    }
  })
);

/**
 * GET /api/import/progress/:importId
 * Get import progress
 */
router.get('/import/progress/:importId',
  asyncHandler(async (req: Request, res: Response) => {
    const progress = importService.getImportProgress(req.params.importId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Import not found',
        errors: [{ code: 'IMPORT_NOT_FOUND', message: 'Import ID not found or expired' }]
      });
    }

    res.json({
      success: true,
      data: progress
    });
  })
);

/**
 * GET /api/import/result/:importId
 * Get import result
 */
router.get('/import/result/:importId',
  asyncHandler(async (req: Request, res: Response) => {
    const result = importService.getImportResult(req.params.importId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Import result not found',
        errors: [{ code: 'RESULT_NOT_FOUND', message: 'Import result not found or expired' }]
      });
    }

    res.json({
      success: true,
      data: result
    });
  })
);

/**
 * DELETE /api/import/:importId
 * Cancel import operation
 */
router.delete('/import/:importId',
  asyncHandler(async (req: Request, res: Response) => {
    const cancelled = await importService.cancelImport(req.params.importId);
    
    if (!cancelled) {
      return res.status(400).json({
        success: false,
        message: 'Cannot cancel import',
        errors: [{ code: 'CANCEL_FAILED', message: 'Import cannot be cancelled or not found' }]
      });
    }

    res.json({
      success: true,
      message: 'Import cancelled successfully'
    });
  })
);

/**
 * POST /api/export
 * Execute export operation
 */
router.post('/export',
  validateRequest({ body: exportRequestSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      // Convert format string to FileFormat enum
      const formatMap = {
        'csv': FileFormat.CSV,
        'json': FileFormat.JSON,
        'excel': FileFormat.EXCEL
      };

      const options = {
        ...req.body,
        format: formatMap[req.body.format],
        userId: req.user?.id || 'system'
      };

      const { exportId, promise } = await exportService.executeExport(options);

      // For small exports, wait for completion and return file
      // For large exports, return export ID for progress tracking
      if (req.body.resourceType !== 'all') {
        try {
          // Wait up to 30 seconds for completion
          const result = await Promise.race([
            promise,
            new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('timeout')), 30000)
            )
          ]);

          if (result) {
            // Return the file directly
            res.set({
              'Content-Type': getContentType(result.format),
              'Content-Disposition': `attachment; filename="${result.fileName}"`,
              'Content-Length': result.fileSize.toString()
            });

            return res.send(result.fileBuffer);
          }
        } catch (error) {
          // Fall through to async response if timeout or error
        }
      }

      // Return export ID for progress tracking
      res.status(202).json({
        success: true,
        data: {
          exportId,
          message: 'Export started successfully. Use the export ID to track progress.'
        }
      });

    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Export execution failed',
        errors: [{ code: 'EXPORT_ERROR', message: error.message }]
      });
    }
  })
);

/**
 * GET /api/export/progress/:exportId
 * Get export progress
 */
router.get('/export/progress/:exportId',
  asyncHandler(async (req: Request, res: Response) => {
    const progress = exportService.getExportProgress(req.params.exportId);
    
    if (!progress) {
      return res.status(404).json({
        success: false,
        message: 'Export not found',
        errors: [{ code: 'EXPORT_NOT_FOUND', message: 'Export ID not found or expired' }]
      });
    }

    res.json({
      success: true,
      data: progress
    });
  })
);

/**
 * GET /api/export/download/:exportId
 * Download export result
 */
router.get('/export/download/:exportId',
  asyncHandler(async (req: Request, res: Response) => {
    const result = exportService.getExportResult(req.params.exportId);
    
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Export result not found',
        errors: [{ code: 'RESULT_NOT_FOUND', message: 'Export result not found or expired' }]
      });
    }

    res.set({
      'Content-Type': getContentType(result.format),
      'Content-Disposition': `attachment; filename="${result.fileName}"`,
      'Content-Length': result.fileSize.toString()
    });

    res.send(result.fileBuffer);
  })
);

/**
 * GET /api/templates/:format/:resourceType
 * Download import template
 */
router.get('/templates/:format/:resourceType',
  validateRequest({ params: templateRequestSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    try {
      const formatMap = {
        'csv': FileFormat.CSV,
        'json': FileFormat.JSON,
        'excel': FileFormat.EXCEL
      };

      const format = formatMap[req.params.format];
      const template = await exportService.generateExportTemplate(format, req.params.resourceType);

      const fileName = `${req.params.resourceType}-template.${req.params.format}`;

      res.set({
        'Content-Type': getContentType(format),
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': template.length.toString()
      });

      res.send(template);

    } catch (error) {
      res.status(400).json({
        success: false,
        message: 'Template generation failed',
        errors: [{ code: 'TEMPLATE_ERROR', message: error.message }]
      });
    }
  })
);

/**
 * Helper function to detect file format
 */
function detectFileFormat(file: Express.Multer.File): FileFormat {
  if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
    return FileFormat.CSV;
  }
  if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
    return FileFormat.JSON;
  }
  if (file.mimetype.includes('spreadsheet') || file.originalname.match(/\.(xlsx|xls)$/)) {
    return FileFormat.EXCEL;
  }
  
  // Default to CSV if can't determine
  return FileFormat.CSV;
}

/**
 * Helper function to get content type for response
 */
function getContentType(format: FileFormat): string {
  switch (format) {
    case FileFormat.CSV:
      return 'text/csv';
    case FileFormat.JSON:
      return 'application/json';
    case FileFormat.EXCEL:
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return 'application/octet-stream';
  }
}

export default router;